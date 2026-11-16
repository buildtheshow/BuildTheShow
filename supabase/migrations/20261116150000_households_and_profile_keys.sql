-- Households group people; explicit profile keys grant access. No implicit family matching.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='90s';
ALTER TABLE bts_private.email_rate_windows DROP CONSTRAINT email_rate_windows_kind_check;
ALTER TABLE bts_private.email_rate_windows ADD CONSTRAINT email_rate_windows_kind_check CHECK(kind IN('test','transactional','family_confirmation','family_volunteer'));
CREATE TABLE bts_private.households(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),creator_id uuid NOT NULL REFERENCES auth.users(id),name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE bts_private.household_members(household_id uuid REFERENCES bts_private.households(id),user_id uuid REFERENCES auth.users(id),joined_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(household_id,user_id));
CREATE TABLE bts_private.household_profiles(household_id uuid REFERENCES bts_private.households(id),profile_id uuid REFERENCES public.profiles(id),PRIMARY KEY(household_id,profile_id));
CREATE TABLE bts_private.profile_controls(profile_id uuid PRIMARY KEY REFERENCES public.profiles(id),creator_id uuid NOT NULL REFERENCES auth.users(id),manager_id uuid NOT NULL REFERENCES auth.users(id),subject_id uuid REFERENCES auth.users(id),kind text NOT NULL CHECK(kind IN ('self','child','adult')),consent_state text NOT NULL DEFAULT 'active' CHECK(consent_state IN ('pending','active','declined','withdrawn')),created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX one_subject_profile ON bts_private.profile_controls(subject_id) WHERE subject_id IS NOT NULL;
CREATE TABLE bts_private.profile_keys(profile_id uuid REFERENCES public.profiles(id),user_id uuid REFERENCES auth.users(id),kind text NOT NULL CHECK(kind IN ('self','guardian','delegate')),declared_name text,active boolean NOT NULL DEFAULT true,consented_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(profile_id,user_id));
CREATE TABLE bts_private.profile_contacts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),profile_id uuid NOT NULL REFERENCES public.profiles(id),email text NOT NULL,user_id uuid REFERENCES auth.users(id),active boolean NOT NULL DEFAULT true,confirmed_at timestamptz DEFAULT now(),unsubscribe_hash text NOT NULL,UNIQUE(profile_id,email));
CREATE TABLE bts_private.family_invites(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),sender_id uuid NOT NULL REFERENCES auth.users(id),household_id uuid REFERENCES bts_private.households(id),profile_id uuid REFERENCES public.profiles(id),email text NOT NULL,kind text NOT NULL CHECK(kind IN ('guardian','delegate','delegate_key','contact','household','claim')),token_hash text NOT NULL UNIQUE,expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','accepted','declined','revoked')),created_at timestamptz NOT NULL DEFAULT now(),accepted_by uuid REFERENCES auth.users(id));
CREATE TABLE bts_private.family_audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),profile_id uuid REFERENCES public.profiles(id),household_id uuid REFERENCES bts_private.households(id),actor_id uuid REFERENCES auth.users(id),action text NOT NULL,details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE bts_private.family_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),requester_id uuid NOT NULL REFERENCES auth.users(id),kind text NOT NULL CHECK(kind IN ('guardian_removal','record_link','duplicate_profile','duplicate_account','controller_transfer','birth_date','adult_activation')),profile_id uuid REFERENCES public.profiles(id),payload jsonb NOT NULL,state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','declined')),reason text,created_at timestamptz NOT NULL DEFAULT now(),resolved_at timestamptz);
CREATE TABLE bts_private.family_mail(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid REFERENCES auth.users(id),recipient text NOT NULL,kind text NOT NULL,profile_id uuid REFERENCES public.profiles(id),payload jsonb NOT NULL DEFAULT '{}',state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','sent','failed','cancelled')),attempts integer NOT NULL DEFAULT 0,lease_until timestamptz,provider_id text,last_error text,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX family_mail_pending ON bts_private.family_mail(state,created_at);
REVOKE ALL ON ALL TABLES IN SCHEMA bts_private FROM PUBLIC,anon,authenticated;
-- Stable self-scoped helpers are used by records, files and the account UI.
ALTER TABLE bts_private.profile_contacts ADD COLUMN contact_source text NOT NULL DEFAULT 'email_link';
ALTER TABLE bts_private.profile_contacts ADD COLUMN preference_token text;
CREATE FUNCTION public.bts_profile_access(p_profile_id uuid,p_manage boolean DEFAULT true) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.bts_account_is_active() AND EXISTS(SELECT 1 FROM public.profiles p LEFT JOIN bts_private.profile_controls c ON c.profile_id=p.id WHERE p.id=p_profile_id AND p.deleted_at IS NULL AND (
 (c.profile_id IS NULL AND coalesce(p.user_id,p.account_id)=auth.uid() AND (p.user_id IS NULL OR p.account_id IS NULL OR p.user_id=p.account_id)) OR
 EXISTS(SELECT 1 FROM bts_private.profile_keys k WHERE k.profile_id=p.id AND k.user_id=auth.uid() AND k.active AND c.consent_state='active' AND (k.kind<>'guardian' OR p.date_of_birth>(current_date-interval '18 years')::date)) OR
 (NOT p_manage AND c.manager_id=auth.uid() AND c.kind='adult' AND c.consent_state='pending')));
$$;
-- Preserve only explicit pre-existing guardian declarations; do not infer families from names or emails.
INSERT INTO bts_private.profile_controls(profile_id,creator_id,manager_id,kind) SELECT id,user_id,user_id,'child' FROM public.profiles WHERE user_id IS NOT NULL AND guardian_user_id=user_id AND guardian_consent_at IS NOT NULL;
INSERT INTO bts_private.profile_keys(profile_id,user_id,kind,declared_name,consented_at) SELECT p.id,p.user_id,'guardian',p.guardian_name,p.guardian_consent_at FROM public.profiles p JOIN bts_private.profile_controls c ON c.profile_id=p.id;
INSERT INTO bts_private.profile_contacts(profile_id,email,user_id,unsubscribe_hash,contact_source,confirmed_at) SELECT p.id,lower(u.email),p.user_id,encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),'account',NULL FROM public.profiles p JOIN bts_private.profile_controls c ON c.profile_id=p.id JOIN auth.users u ON u.id=p.user_id;
CREATE FUNCTION public.bts_profile_manager(p_profile_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.bts_profile_access(p_profile_id) AND (EXISTS(SELECT 1 FROM bts_private.profile_controls WHERE profile_id=p_profile_id AND (subject_id=auth.uid() OR (manager_id=auth.uid() AND (kind='child' OR subject_id IS NULL)))) OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_profile_id AND p.user_id=auth.uid() AND NOT EXISTS(SELECT 1 FROM bts_private.profile_controls WHERE profile_id=p.id)));
$$;
CREATE FUNCTION public.bts_family_invite_internal(p_profile_id uuid,p_household_id uuid,p_email text,p_kind text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE token text:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''); invite_id uuid; target text:=lower(trim(p_email));
BEGIN
 IF NOT public.bts_account_is_active() OR p_kind NOT IN ('guardian','delegate','delegate_key','contact','household','claim') OR target !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(target)>320 THEN RAISE EXCEPTION 'Enter a valid invitation email and type.'; END IF;
 IF (SELECT count(*) FROM bts_private.family_invites WHERE sender_id=auth.uid() AND created_at>now()-interval '1 hour')>=20 THEN RAISE EXCEPTION 'Invitation limit reached. Please try later.';END IF;
 IF p_profile_id IS NOT NULL AND NOT (public.bts_profile_manager(p_profile_id) OR (p_kind='contact' AND public.bts_profile_access(p_profile_id) AND target=(SELECT lower(u.email) FROM auth.users u WHERE u.id=auth.uid())) OR (p_kind='delegate' AND EXISTS(SELECT 1 FROM bts_private.profile_controls WHERE profile_id=p_profile_id AND manager_id=auth.uid() AND consent_state='pending'))) THEN RAISE EXCEPTION 'Only the profile access manager can invite another person.';END IF;
 IF p_household_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM bts_private.households WHERE id=p_household_id AND creator_id=auth.uid()) THEN RAISE EXCEPTION 'Only the household creator can invite a key holder.';END IF;
 IF p_profile_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM bts_private.profile_controls WHERE profile_id=p_profile_id) THEN RAISE EXCEPTION 'Confirm this existing profile relationship in Households before inviting another key.';END IF;
 IF p_kind='household' AND p_profile_id IS NOT NULL THEN RAISE EXCEPTION 'Household membership and performer access need separate invitations.';END IF;
 IF p_kind='household' AND p_household_id IS NULL OR p_kind<>'household' AND p_profile_id IS NULL THEN RAISE EXCEPTION 'Choose the household or performer.';END IF;
 IF p_kind='delegate_key' AND NOT EXISTS(SELECT 1 FROM bts_private.profile_controls WHERE profile_id=p_profile_id AND subject_id=auth.uid()) THEN RAISE EXCEPTION 'Only the adult performer can authorise another adult key.';END IF;
 IF p_kind='guardian' AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_profile_id AND date_of_birth>(current_date-interval '18 years')::date) THEN RAISE EXCEPTION 'Guardian keys apply to children only.';END IF;
 IF p_kind IN ('delegate','delegate_key','claim') AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_profile_id AND date_of_birth<=(current_date-interval '18 years')::date) THEN RAISE EXCEPTION 'Adult permission requires an adult profile.';END IF;
 IF p_kind='claim' AND EXISTS(SELECT 1 FROM bts_private.family_invites i WHERE i.profile_id=p_profile_id AND i.kind='delegate' AND i.state='accepted') AND NOT EXISTS(SELECT 1 FROM bts_private.family_invites i WHERE i.profile_id=p_profile_id AND i.kind='delegate' AND i.state='accepted' AND i.email=target) THEN RAISE EXCEPTION 'Send activation to the adult who confirmed permission.';END IF;
 IF p_kind='delegate' THEN UPDATE bts_private.family_invites SET state='revoked' WHERE profile_id=p_profile_id AND kind='delegate' AND state='pending';END IF;
 UPDATE bts_private.family_invites SET state='revoked' WHERE profile_id IS NOT DISTINCT FROM p_profile_id AND household_id IS NOT DISTINCT FROM p_household_id AND email=target AND kind=p_kind AND state='pending';
 PERFORM public.bts_bind_profile_file(p_profile_id,(SELECT headshot_url FROM public.profiles WHERE id=p_profile_id));
 INSERT INTO bts_private.family_invites(sender_id,household_id,profile_id,email,kind,token_hash) VALUES(auth.uid(),p_household_id,p_profile_id,target,p_kind,encode(sha256(convert_to(token,'UTF8')),'hex')) RETURNING id INTO invite_id;
 INSERT INTO bts_private.family_mail(actor_id,recipient,kind,profile_id,payload) VALUES(auth.uid(),target,'invitation',p_profile_id,jsonb_build_object('invite_id',invite_id,'token',token,'permission',p_kind));
 INSERT INTO bts_private.family_audit(profile_id,household_id,actor_id,action,details) VALUES(p_profile_id,p_household_id,auth.uid(),'invited',jsonb_build_object('kind',p_kind,'email',target));
 RETURN invite_id;
END $$;
REVOKE ALL ON FUNCTION public.bts_family_invite_internal(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;

ALTER FUNCTION public.bts_save_profile(jsonb,uuid,boolean) SET SCHEMA bts_private;
ALTER FUNCTION bts_private.bts_save_profile(jsonb,uuid,boolean) RENAME TO save_profile_before_households;
REVOKE ALL ON FUNCTION bts_private.save_profile_before_households(jsonb,uuid,boolean) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bts_save_profile(p_profile jsonb,p_profile_id uuid DEFAULT NULL,p_guardian_confirmed boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE person public.profiles%rowtype; control bts_private.profile_controls%rowtype; v_id uuid; kind text; email text; k text; allowed jsonb; subject uuid;
BEGIN
 IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with your adult account.';END IF;
 kind:=p_profile->>'relationship_kind';email:=lower(trim(p_profile->>'permission_email'));allowed:=p_profile-ARRAY['relationship_kind','permission_email'];
 IF p_profile_id IS NULL THEN
  kind:=coalesce(kind,CASE WHEN (p_profile->>'date_of_birth')::date>(current_date-interval '18 years')::date THEN 'child' ELSE 'self' END);
  IF kind NOT IN ('self','child','adult') THEN RAISE EXCEPTION 'Choose yourself, a child, or an adult you will help.';END IF;
  IF kind='self' AND (p_profile->>'date_of_birth')::date>(current_date-interval '18 years')::date OR kind='adult' AND (p_profile->>'date_of_birth')::date>(current_date-interval '18 years')::date THEN RAISE EXCEPTION 'Children need a guardian-managed profile.';END IF;
  IF kind='child' AND (p_profile->>'date_of_birth')::date<=(current_date-interval '18 years')::date THEN RAISE EXCEPTION 'Use an adult profile for this person.';END IF;
  IF kind='self' AND (p_profile->>'date_of_birth')::date IS DISTINCT FROM (SELECT birth_date FROM bts_private.account_controls WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Your own profile birth date must match your adult account declaration. Request a correction if needed.';END IF;
  IF kind='self' AND EXISTS(SELECT 1 FROM bts_private.profile_controls WHERE subject_id=auth.uid()) THEN RAISE EXCEPTION 'You already have a personal profile. Choose it instead of creating a duplicate.';END IF;
  IF kind='adult' AND (email IS NULL OR email=(SELECT lower(u.email) FROM auth.users u WHERE u.id=auth.uid())) THEN RAISE EXCEPTION 'Enter the other adult email so they can confirm permission.';END IF;
  v_id:=bts_private.save_profile_before_households(allowed,NULL,p_guardian_confirmed);
  INSERT INTO bts_private.profile_controls(profile_id,creator_id,manager_id,subject_id,kind,consent_state) VALUES(v_id,auth.uid(),auth.uid(),CASE WHEN kind='self' THEN auth.uid() END,kind,CASE WHEN kind='adult' THEN 'pending' ELSE 'active' END);
  INSERT INTO bts_private.profile_keys(profile_id,user_id,kind,declared_name,active) VALUES(v_id,auth.uid(),CASE WHEN kind='child' THEN 'guardian' WHEN kind='self' THEN 'self' ELSE 'delegate' END,coalesce(p_profile->>'guardian_name',p_profile->>'credit_name'),kind<>'adult');
  INSERT INTO bts_private.profile_contacts(profile_id,email,user_id,unsubscribe_hash,contact_source,confirmed_at) SELECT v_id,lower(u.email),auth.uid(),encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),'account',NULL FROM auth.users u WHERE u.id=auth.uid();
  IF kind='adult' THEN PERFORM public.bts_family_invite_internal(v_id,NULL,email,'delegate');END IF;
  INSERT INTO bts_private.family_audit(profile_id,actor_id,action,details) VALUES(v_id,auth.uid(),'profile_created',jsonb_build_object('kind',kind));
  RETURN v_id;
 END IF;
 IF NOT public.bts_profile_access(p_profile_id) THEN RAISE EXCEPTION 'You do not have permission to manage this profile.';END IF;
 SELECT * INTO person FROM public.profiles WHERE profiles.id=p_profile_id FOR UPDATE;
 IF allowed ? 'date_of_birth' AND (allowed->>'date_of_birth')::date IS DISTINCT FROM person.date_of_birth THEN RAISE EXCEPTION 'Birth-date corrections need a reviewed request. This prevents extending guardian access by changing a birthday.';END IF;
 FOR k IN SELECT jsonb_object_keys(allowed) LOOP
  IF k<>ALL(ARRAY['legal_first_name','legal_last_name','date_of_birth','credit_name','nickname','pronouns','bio','headshot_url','headshot_urls','guardian_name','guardian_email','guardian_phone','email','member_display_id','profile_display_id','sections']) THEN RAISE EXCEPTION 'That profile field cannot be edited here.';END IF;
  IF EXISTS(SELECT 1 FROM bts_private.profile_controls c WHERE c.profile_id=p_profile_id AND c.kind='adult' AND c.subject_id IS DISTINCT FROM auth.uid()) AND k IN ('legal_first_name','legal_last_name','credit_name') AND to_jsonb(person)->k IS DISTINCT FROM allowed->k THEN RAISE EXCEPTION 'The adult performer must confirm identity changes through their own account or a review.';END IF;
  IF NOT public.bts_profile_manager(p_profile_id) AND k IN ('guardian_name','guardian_email','guardian_phone') AND to_jsonb(person)->k IS DISTINCT FROM allowed->k THEN RAISE EXCEPTION 'Edit your notification contact separately; the primary guardian contact belongs to its manager.';END IF;
 END LOOP;
 person:=jsonb_populate_record(person,allowed-ARRAY['member_display_id','profile_display_id','email','guardian_email']);
 UPDATE public.profiles SET legal_first_name=person.legal_first_name,legal_last_name=person.legal_last_name,credit_name=person.credit_name,nickname=person.nickname,pronouns=person.pronouns,bio=person.bio,headshot_url=person.headshot_url,headshot_urls=person.headshot_urls,guardian_name=person.guardian_name,guardian_phone=person.guardian_phone,sections=person.sections WHERE profiles.id=p_profile_id;
 RETURN p_profile_id;
END $$;
REVOKE ALL ON FUNCTION public.bts_save_profile(jsonb,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_save_profile(jsonb,uuid,boolean) TO authenticated;
CREATE FUNCTION public.bts_profile_identity_edit(p_profile_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT public.bts_profile_access(p_profile_id) AND NOT EXISTS(SELECT 1 FROM bts_private.profile_controls WHERE profile_id=p_profile_id AND kind='adult' AND subject_id IS DISTINCT FROM auth.uid());$$;
REVOKE ALL ON FUNCTION public.bts_profile_identity_edit(uuid) FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.bts_profile_identity_edit(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION bts_private.guard_profile_ownership() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF current_user NOT IN ('anon','authenticated') THEN RETURN NEW;END IF;
 IF TG_OP='INSERT' THEN RAISE EXCEPTION 'Use the profile form to record the correct permissions.';END IF;
 IF NOT public.bts_profile_access(OLD.id) THEN RAISE EXCEPTION 'This profile is not available to your account.';END IF;
 IF NOT public.bts_profile_manager(OLD.id) AND (NEW.guardian_name IS DISTINCT FROM OLD.guardian_name OR NEW.guardian_email IS DISTINCT FROM OLD.guardian_email OR NEW.guardian_phone IS DISTINCT FROM OLD.guardian_phone) THEN RAISE EXCEPTION 'The primary guardian contact belongs to its access manager. Manage your own notification contact separately.';END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.account_id IS DISTINCT FROM OLD.account_id OR NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth OR NEW.guardian_user_id IS DISTINCT FROM OLD.guardian_user_id OR NEW.guardian_consent_at IS DISTINCT FROM OLD.guardian_consent_at OR NEW.guardian_consent_version IS DISTINCT FROM OLD.guardian_consent_version OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN RAISE EXCEPTION 'Ownership, birth date, guardian declarations and archival need the protected workflow.';END IF;
 IF (NEW.credit_name IS DISTINCT FROM OLD.credit_name OR NEW.legal_first_name IS DISTINCT FROM OLD.legal_first_name OR NEW.legal_last_name IS DISTINCT FROM OLD.legal_last_name) AND NOT public.bts_profile_identity_edit(OLD.id) THEN RAISE EXCEPTION 'The adult performer must confirm identity changes themselves.';END IF;
 IF (NEW.guardian_email IS DISTINCT FROM OLD.guardian_email OR NEW.guardian_name IS DISTINCT FROM OLD.guardian_name OR NEW.guardian_phone IS DISTINCT FROM OLD.guardian_phone) AND NOT public.bts_profile_manager(OLD.id) THEN RAISE EXCEPTION 'Only the primary manager can change that contact.';END IF;
 RETURN NEW;
END $$;
DROP POLICY "Adult accounts manage only their own profiles" ON public.profiles;
CREATE POLICY profile_key_read ON public.profiles FOR SELECT TO authenticated USING(public.bts_profile_access(id,false));
CREATE POLICY profile_key_update ON public.profiles FOR UPDATE TO authenticated USING(public.bts_profile_access(id)) WITH CHECK(public.bts_profile_access(id));
REVOKE INSERT,DELETE ON public.profiles FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bts_family(p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE id uuid; v_profile_id uuid:=public.try_uuid(p_data->>'profile_id'); v_household_id uuid:=public.try_uuid(p_data->>'household_id'); v_target_id uuid:=public.try_uuid(p_data->>'user_id'); token text:=p_data->>'token'; inv bts_private.family_invites%rowtype; v_email text; contact_token text; control bts_private.profile_controls%rowtype; person public.profiles%rowtype; result jsonb;
BEGIN
 -- Capability links are email-delivered, single-use and never returned to the inviter.
 IF p_action IN ('preview','accept','decline','unsubscribe','consent_preview','withdraw_permission','activate_profile') THEN
  IF length(coalesce(token,''))<>64 THEN RAISE EXCEPTION 'This confirmation link is invalid.';END IF;
  IF p_action IN ('consent_preview','withdraw_permission','activate_profile') THEN
   SELECT c.profile_id,c.email INTO v_profile_id,v_email FROM bts_private.profile_contacts c WHERE c.unsubscribe_hash=encode(sha256(convert_to(token,'UTF8')),'hex');
   IF v_profile_id IS NULL THEN RAISE EXCEPTION 'This permission link is invalid.';END IF;
   IF NOT EXISTS(SELECT 1 FROM bts_private.family_invites i WHERE i.profile_id=v_profile_id AND i.email=v_email AND i.kind='delegate' AND i.state='accepted') THEN RAISE EXCEPTION 'This link is for notification preferences only.';END IF;
   IF p_action='consent_preview' THEN RETURN jsonb_build_object('performer',(SELECT credit_name FROM public.profiles WHERE profiles.id=v_profile_id),'email',v_email,'requires_login',false);END IF;
   IF (p_data->>'confirmed') IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Confirm this change.';END IF;
   IF p_action='activate_profile' THEN
    IF (SELECT birth_date FROM bts_private.account_controls WHERE user_id=auth.uid()) IS DISTINCT FROM (SELECT date_of_birth FROM public.profiles WHERE id=v_profile_id) THEN RAISE EXCEPTION 'The birth dates differ. Request a reviewed correction before activating this profile.';END IF;
    IF NOT public.bts_account_is_active() OR (SELECT lower(u.email) FROM auth.users u WHERE u.id=auth.uid()) IS DISTINCT FROM v_email THEN RAISE EXCEPTION 'Sign in with the email that granted permission.';END IF;
    UPDATE bts_private.profile_controls SET subject_id=auth.uid(),consent_state='active' WHERE profile_controls.profile_id=v_profile_id AND (subject_id IS NULL OR subject_id=auth.uid());
    IF NOT FOUND THEN RAISE EXCEPTION 'This profile is already connected to another adult. Request a review.';END IF;
    INSERT INTO bts_private.profile_keys(profile_id,user_id,kind) VALUES(v_profile_id,auth.uid(),'self') ON CONFLICT(profile_id,user_id) DO UPDATE SET kind='self',active=true;
   ELSE
    UPDATE bts_private.profile_keys SET active=false WHERE profile_keys.profile_id=v_profile_id AND kind='delegate';
    UPDATE bts_private.profile_controls SET consent_state=CASE WHEN subject_id IS NULL THEN 'withdrawn' ELSE 'active' END WHERE profile_controls.profile_id=v_profile_id;
   END IF;
   INSERT INTO bts_private.family_audit(profile_id,actor_id,action) VALUES(v_profile_id,auth.uid(),p_action);RETURN jsonb_build_object('ok',true);
  END IF;
  IF p_action='unsubscribe' THEN UPDATE bts_private.profile_contacts SET active=false WHERE unsubscribe_hash=encode(sha256(convert_to(token,'UTF8')),'hex'); RETURN jsonb_build_object('ok',true);END IF;
  SELECT * INTO inv FROM bts_private.family_invites WHERE token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') FOR UPDATE;
  IF inv.id IS NULL OR inv.state<>'pending' OR inv.expires_at<now() THEN RAISE EXCEPTION 'This invitation expired or has already been used.';END IF;
  IF inv.profile_id IS NOT NULL THEN SELECT * INTO person FROM public.profiles WHERE profiles.id=inv.profile_id AND deleted_at IS NULL;IF person.id IS NULL THEN RAISE EXCEPTION 'This performer is no longer available.';END IF;END IF;
  IF inv.kind IN ('guardian','contact','claim') AND NOT EXISTS(SELECT 1 FROM bts_private.profile_controls c WHERE c.profile_id=inv.profile_id AND (c.manager_id=inv.sender_id OR c.subject_id=inv.sender_id)) THEN RAISE EXCEPTION 'The invitation manager changed. Ask for a fresh invitation.';END IF;
  IF inv.kind='delegate_key' AND NOT EXISTS(SELECT 1 FROM bts_private.profile_controls WHERE profile_controls.profile_id=inv.profile_id AND subject_id=inv.sender_id) THEN RAISE EXCEPTION 'Ask the performer for a fresh invitation.';END IF;
  IF inv.kind='delegate' AND NOT EXISTS(SELECT 1 FROM bts_private.profile_controls WHERE profile_controls.profile_id=inv.profile_id AND manager_id=inv.sender_id AND consent_state='pending' AND subject_id IS NULL) THEN RAISE EXCEPTION 'Ask for a fresh permission invitation.';END IF;
  IF p_action='preview' THEN RETURN jsonb_build_object('kind',inv.kind,'performer',person.credit_name,'date_of_birth',CASE WHEN inv.kind IN ('delegate','claim') THEN person.date_of_birth END,'expires_at',inv.expires_at,'email',inv.email,'requires_login',inv.kind IN ('guardian','delegate_key','household','claim'));END IF;
  IF p_action='decline' THEN
   UPDATE bts_private.family_invites SET state='declined' WHERE family_invites.id=inv.id;
   IF inv.kind='delegate' THEN UPDATE bts_private.profile_controls SET consent_state='declined' WHERE profile_controls.profile_id=inv.profile_id AND consent_state='pending';END IF;
   INSERT INTO bts_private.family_audit(profile_id,household_id,actor_id,action) VALUES(inv.profile_id,inv.household_id,auth.uid(),'invitation_declined');RETURN jsonb_build_object('ok',true);
  END IF;
  IF (p_data->>'confirmed') IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Confirm the permission described in this invitation.';END IF;
  IF inv.kind IN ('guardian','delegate_key','household','claim') THEN
   IF NOT public.bts_account_is_active() OR (SELECT lower(u.email) FROM auth.users u WHERE u.id=auth.uid()) IS DISTINCT FROM inv.email THEN RAISE EXCEPTION 'Sign in using the invited email address with your adult account.';END IF;
  END IF;
  IF inv.kind='guardian' THEN
   IF person.date_of_birth<=(current_date-interval '18 years')::date OR (p_data->>'guardian_confirmed') IS DISTINCT FROM 'true' OR length(trim(coalesce(p_data->>'name','')))<2 THEN RAISE EXCEPTION 'An adult guardian must confirm their name and responsibility for this child.';END IF;
   INSERT INTO bts_private.profile_keys(profile_id,user_id,kind,declared_name) VALUES(inv.profile_id,auth.uid(),'guardian',trim(p_data->>'name')) ON CONFLICT(profile_id,user_id) DO UPDATE SET active=true,kind='guardian',declared_name=excluded.declared_name,consented_at=now();
  ELSIF inv.kind='delegate_key' THEN INSERT INTO bts_private.profile_keys(profile_id,user_id,kind) VALUES(inv.profile_id,auth.uid(),'delegate') ON CONFLICT(profile_id,user_id) DO UPDATE SET active=true,kind='delegate',consented_at=now();
  ELSIF inv.kind='household' THEN INSERT INTO bts_private.household_members VALUES(inv.household_id,auth.uid(),now()) ON CONFLICT DO NOTHING;
  ELSIF inv.kind='delegate' THEN
   UPDATE bts_private.profile_controls SET consent_state='active' WHERE profile_controls.profile_id=inv.profile_id;
   INSERT INTO bts_private.profile_keys(profile_id,user_id,kind,declared_name) VALUES(inv.profile_id,inv.sender_id,'delegate',person.credit_name) ON CONFLICT(profile_id,user_id) DO UPDATE SET active=true,consented_at=now();
   -- Signing in is optional for the adult granting administrative help.
   IF public.bts_account_is_active() AND (SELECT lower(u.email) FROM auth.users u WHERE u.id=auth.uid())=inv.email AND (SELECT birth_date FROM bts_private.account_controls WHERE user_id=auth.uid())=person.date_of_birth THEN
    UPDATE bts_private.profile_controls SET subject_id=auth.uid() WHERE profile_controls.profile_id=inv.profile_id AND (subject_id IS NULL OR subject_id=auth.uid());
    INSERT INTO bts_private.profile_keys(profile_id,user_id,kind) VALUES(inv.profile_id,auth.uid(),'self') ON CONFLICT(profile_id,user_id) DO UPDATE SET active=true,kind='self';
   END IF;
  ELSIF inv.kind='claim' THEN
   IF (SELECT birth_date FROM bts_private.account_controls WHERE user_id=auth.uid()) IS DISTINCT FROM person.date_of_birth THEN RAISE EXCEPTION 'Request a reviewed correction because the birth dates differ.';END IF;
   UPDATE bts_private.profile_controls SET subject_id=auth.uid(),consent_state='active' WHERE profile_controls.profile_id=inv.profile_id AND (subject_id IS NULL OR subject_id=auth.uid());
   IF NOT FOUND THEN RAISE EXCEPTION 'This profile is already connected to another adult account. Request a review.';END IF;
   INSERT INTO bts_private.profile_keys(profile_id,user_id,kind) VALUES(inv.profile_id,auth.uid(),'self') ON CONFLICT(profile_id,user_id) DO UPDATE SET active=true,kind='self';
  END IF;
  IF inv.profile_id IS NOT NULL THEN
   contact_token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
   INSERT INTO bts_private.profile_contacts(profile_id,email,user_id,unsubscribe_hash,preference_token) VALUES(inv.profile_id,inv.email,CASE WHEN (SELECT lower(u.email) FROM auth.users u WHERE u.id=auth.uid())=inv.email THEN auth.uid() END,encode(sha256(convert_to(contact_token,'UTF8')),'hex'),contact_token) ON CONFLICT(profile_id,email) DO UPDATE SET active=true,confirmed_at=now(),user_id=coalesce(excluded.user_id,profile_contacts.user_id),unsubscribe_hash=excluded.unsubscribe_hash,preference_token=excluded.preference_token;
   INSERT INTO bts_private.family_mail(actor_id,recipient,kind,profile_id,payload) VALUES(inv.sender_id,inv.email,'consent_receipt',inv.profile_id,jsonb_build_object('token',contact_token,'permission',inv.kind));
  END IF;
  UPDATE bts_private.family_invites SET state='accepted',accepted_by=auth.uid() WHERE family_invites.id=inv.id;
  INSERT INTO bts_private.family_audit(profile_id,household_id,actor_id,action,details) VALUES(inv.profile_id,inv.household_id,auth.uid(),'permission_confirmed',jsonb_build_object('kind',inv.kind,'email',inv.email));
  RETURN jsonb_build_object('ok',true,'profile_id',inv.profile_id,'message','Permission confirmed.');
 END IF;
 IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with an active adult account.';END IF;
 IF p_action='snapshot' THEN
  RETURN jsonb_build_object(
   'households',coalesce((SELECT jsonb_agg(jsonb_build_object('id',h.id,'name',h.name,'creator',h.creator_id=auth.uid(),'members',(SELECT jsonb_agg(jsonb_build_object('user_id',m.user_id,'is_me',m.user_id=auth.uid())) FROM bts_private.household_members m WHERE m.household_id=h.id),'profiles',(SELECT jsonb_agg(hp.profile_id) FROM bts_private.household_profiles hp WHERE hp.household_id=h.id AND public.bts_profile_access(hp.profile_id,false)))) FROM bts_private.households h WHERE h.creator_id=auth.uid() OR EXISTS(SELECT 1 FROM bts_private.household_members m WHERE m.household_id=h.id AND m.user_id=auth.uid())),'[]'::jsonb),
   'profiles',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',coalesce(p.credit_name,p.name),'date_of_birth',p.date_of_birth,'kind',coalesce(c.kind,'legacy'),'state',coalesce(c.consent_state,'active'),'can_manage',public.bts_profile_access(p.id),'access_manager',public.bts_profile_manager(p.id),'is_subject',c.subject_id=auth.uid(),'needs_adult_claim',c.kind='child' AND p.date_of_birth<=(current_date-interval '18 years')::date)) FROM public.profiles p LEFT JOIN bts_private.profile_controls c ON c.profile_id=p.id WHERE p.deleted_at IS NULL AND (public.bts_profile_access(p.id,false) OR (c.manager_id=auth.uid() AND c.kind='child' AND p.date_of_birth<=(current_date-interval '18 years')::date) OR (c.manager_id=auth.uid() AND c.kind='adult' AND c.consent_state='declined'))),'[]'::jsonb),
   'invites',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'profile_id',i.profile_id,'email',i.email,'kind',i.kind,'state',i.state,'expires_at',i.expires_at,'mail_state',(SELECT state FROM bts_private.family_mail WHERE payload->>'invite_id'=i.id::text ORDER BY created_at DESC LIMIT 1))) FROM bts_private.family_invites i WHERE i.sender_id=auth.uid()),'[]'::jsonb),
   'reviews',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'state',r.state,'reason',r.reason)) FROM bts_private.family_reviews r WHERE requester_id=auth.uid()),'[]'::jsonb));
 ELSIF p_action='create_household' THEN
  IF length(trim(coalesce(p_data->>'name',''))) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Enter a household name.';END IF;
  INSERT INTO bts_private.households(creator_id,name) VALUES(auth.uid(),trim(p_data->>'name')) RETURNING households.id INTO id;INSERT INTO bts_private.household_members VALUES(id,auth.uid(),now());RETURN jsonb_build_object('id',id);
 ELSIF p_action='add_to_household' THEN
  IF NOT public.bts_profile_access(v_profile_id) OR NOT EXISTS(SELECT 1 FROM bts_private.households WHERE households.id=v_household_id AND creator_id=auth.uid()) THEN RAISE EXCEPTION 'Only the household creator and profile manager can add this connection.';END IF;
  INSERT INTO bts_private.household_profiles VALUES(v_household_id,v_profile_id) ON CONFLICT DO NOTHING;RETURN jsonb_build_object('ok',true);
 ELSIF p_action='leave_household' THEN
  IF EXISTS(SELECT 1 FROM bts_private.households WHERE households.id=v_household_id AND creator_id=auth.uid()) THEN RAISE EXCEPTION 'The creator must arrange a reviewed handover before leaving.';END IF;
  DELETE FROM bts_private.household_members WHERE household_members.household_id=v_household_id AND user_id=auth.uid();RETURN jsonb_build_object('ok',true);
 ELSIF p_action='remove_from_household' THEN
  IF NOT EXISTS(SELECT 1 FROM bts_private.households WHERE households.id=v_household_id AND creator_id=auth.uid()) THEN RAISE EXCEPTION 'Only the household creator can remove this connection.';END IF;
  DELETE FROM bts_private.household_profiles WHERE household_id=v_household_id AND profile_id=v_profile_id;
  INSERT INTO bts_private.family_audit(profile_id,household_id,actor_id,action) VALUES(v_profile_id,v_household_id,auth.uid(),'household_connection_removed');RETURN jsonb_build_object('ok',true);
 ELSIF p_action='adopt_legacy' THEN
  SELECT * INTO person FROM public.profiles WHERE profiles.id=v_profile_id AND coalesce(user_id,account_id)=auth.uid() AND deleted_at IS NULL FOR UPDATE;
  IF person.id IS NULL OR EXISTS(SELECT 1 FROM bts_private.profile_controls WHERE profile_controls.profile_id=v_profile_id) THEN RAISE EXCEPTION 'Choose one of your existing unclassified profiles.';END IF;
  IF p_data->>'kind' NOT IN ('self','child','adult') OR person.date_of_birth IS NULL THEN RAISE EXCEPTION 'Choose a relationship and arrange review if the birth date is missing.';END IF;
  IF (p_data->>'kind'='child') IS DISTINCT FROM (person.date_of_birth>(current_date-interval '18 years')::date) THEN RAISE EXCEPTION 'Choose the relationship appropriate for this performer age.';END IF;
  IF p_data->>'kind'='child' AND ((p_data->>'guardian_confirmed') IS DISTINCT FROM 'true' OR length(trim(coalesce(p_data->>'name','')))<2) THEN RAISE EXCEPTION 'Confirm your name and guardian responsibility.';END IF;
  IF p_data->>'kind'='self' AND person.date_of_birth IS DISTINCT FROM (SELECT birth_date FROM bts_private.account_controls WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Review the birth-date difference before linking this as your own profile.';END IF;
  INSERT INTO bts_private.profile_controls(profile_id,creator_id,manager_id,subject_id,kind,consent_state) VALUES(person.id,auth.uid(),auth.uid(),CASE WHEN p_data->>'kind'='self' THEN auth.uid() END,p_data->>'kind',CASE WHEN p_data->>'kind'='adult' THEN 'pending' ELSE 'active' END);
  INSERT INTO bts_private.profile_keys(profile_id,user_id,kind,declared_name,active) VALUES(person.id,auth.uid(),CASE WHEN p_data->>'kind'='child' THEN 'guardian' WHEN p_data->>'kind'='self' THEN 'self' ELSE 'delegate' END,coalesce(p_data->>'name',person.credit_name),p_data->>'kind'<>'adult');
  INSERT INTO bts_private.profile_contacts(profile_id,email,user_id,unsubscribe_hash,contact_source,confirmed_at) SELECT person.id,lower(u.email),auth.uid(),encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),'account',NULL FROM auth.users u WHERE u.id=auth.uid() ON CONFLICT(profile_id,email) DO NOTHING;
  IF p_data->>'kind'='adult' THEN PERFORM public.bts_family_invite_internal(person.id,NULL,p_data->>'email','delegate');END IF;
  INSERT INTO bts_private.family_audit(profile_id,actor_id,action) VALUES(person.id,auth.uid(),'relationship_confirmed');RETURN jsonb_build_object('ok',true);
 ELSIF p_action='request_adult_login' THEN
  IF NOT public.bts_profile_manager(v_profile_id) THEN RAISE EXCEPTION 'Ask the performer or primary manager to arrange their own login.';END IF;
  SELECT email INTO v_email FROM bts_private.family_invites WHERE profile_id=v_profile_id AND kind='delegate' AND state='accepted' ORDER BY created_at DESC LIMIT 1;
  IF v_email IS NULL THEN RAISE EXCEPTION 'No confirmed managed-adult email is available.';END IF;
  RETURN jsonb_build_object('id',public.bts_family_invite_internal(v_profile_id,NULL,v_email,'claim'));
 ELSIF p_action='refresh_my_email' THEN RETURN jsonb_build_object('id',public.bts_family_invite_internal(v_profile_id,NULL,(SELECT u.email FROM auth.users u WHERE u.id=auth.uid()),'contact'));
 ELSIF p_action='archive_profile' THEN
  IF NOT (public.bts_profile_manager(v_profile_id) OR EXISTS(SELECT 1 FROM bts_private.profile_controls WHERE profile_id=v_profile_id AND manager_id=auth.uid() AND subject_id IS NULL AND consent_state IN('pending','declined'))) THEN RAISE EXCEPTION 'Only the profile access manager can archive it.';END IF;
  IF (SELECT count(*) FROM bts_private.profile_keys WHERE profile_id=v_profile_id AND kind='guardian' AND active)>1 THEN RAISE EXCEPTION 'Archiving a shared child profile needs an operator review.';END IF;
  IF EXISTS(SELECT 1 FROM public.audition_applications a JOIN public.productions p ON p.id=a.production_id WHERE a.profile_id=v_profile_id AND coalesce(a.status,'') !~* '(cancel|withdraw)' AND (p.end_date IS NULL OR p.end_date>=current_date)) OR EXISTS(SELECT 1 FROM public.audition_bookings a JOIN public.productions p ON p.id=a.production_id WHERE a.profile_id=v_profile_id AND coalesce(a.status,'') !~* '(cancel|withdraw)' AND (p.end_date IS NULL OR p.end_date>=current_date)) THEN RAISE EXCEPTION 'Resolve active production bookings before archiving this performer.';END IF;
  UPDATE bts_private.family_invites SET state='revoked' WHERE profile_id=v_profile_id AND state='pending';UPDATE public.profiles SET deleted_at=now() WHERE profiles.id=v_profile_id;INSERT INTO bts_private.family_audit(profile_id,actor_id,action) VALUES(v_profile_id,auth.uid(),'profile_archived');RETURN jsonb_build_object('ok',true);
 ELSIF p_action='invite' THEN RETURN jsonb_build_object('id',public.bts_family_invite_internal(v_profile_id,v_household_id,p_data->>'email',p_data->>'kind'),'message','Invitation queued for email delivery.');
 ELSIF p_action='revoke_invite' THEN
  UPDATE bts_private.family_invites SET state='revoked' WHERE family_invites.id=public.try_uuid(p_data->>'invite_id') AND sender_id=auth.uid() AND state='pending';IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found.';END IF;
  UPDATE bts_private.family_mail SET state='cancelled' WHERE payload->>'invite_id'=p_data->>'invite_id' AND state IN ('pending','failed');RETURN jsonb_build_object('ok',true);
 ELSIF p_action='details' THEN
  IF NOT public.bts_profile_access(v_profile_id) THEN RAISE EXCEPTION 'This performer is not available to your account.';END IF;
  RETURN jsonb_build_object('keys',coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',k.user_id,'name',k.declared_name,'kind',k.kind,'active',k.active,'is_me',k.user_id=auth.uid(),'is_manager',c.manager_id=k.user_id)) FROM bts_private.profile_keys k JOIN bts_private.profile_controls c ON c.profile_id=k.profile_id WHERE k.profile_id=v_profile_id),'[]'::jsonb),
   'contacts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'email',c.email,'active',c.active,'is_me',c.user_id=auth.uid(),'protected_guardian',EXISTS(SELECT 1 FROM bts_private.profile_keys k WHERE k.profile_id=c.profile_id AND k.user_id=c.user_id AND k.kind='guardian' AND k.active AND k.user_id<>auth.uid()))) FROM bts_private.profile_contacts c WHERE c.profile_id=v_profile_id),'[]'::jsonb),
   'history',coalesce((SELECT jsonb_agg(jsonb_build_object('action',a.action,'at',a.created_at,'is_me',a.actor_id=auth.uid(),'actor',coalesce((SELECT declared_name FROM bts_private.profile_keys k WHERE k.profile_id=a.profile_id AND k.user_id=a.actor_id),'Production staff or email confirmation'))) FROM (SELECT * FROM bts_private.family_audit a WHERE a.profile_id=v_profile_id ORDER BY created_at DESC LIMIT 40) a),'[]'::jsonb),
   'productions',coalesce((SELECT jsonb_agg(DISTINCT jsonb_build_object('id',a.production_id,'title',p.title)) FROM (SELECT production_id FROM public.audition_applications WHERE audition_applications.profile_id=v_profile_id UNION SELECT production_id FROM public.audition_bookings WHERE audition_bookings.profile_id=v_profile_id) a JOIN public.productions p ON p.id=a.production_id),'[]'::jsonb));
 ELSIF p_action='leave_profile' THEN
  SELECT * INTO control FROM bts_private.profile_controls WHERE profile_controls.profile_id=v_profile_id FOR UPDATE;
  IF control.kind='child' AND control.manager_id=auth.uid() AND control.subject_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'The primary guardian needs a reviewed handover before leaving.';END IF;
  UPDATE bts_private.profile_keys SET active=false WHERE profile_keys.profile_id=v_profile_id AND user_id=auth.uid();UPDATE bts_private.profile_contacts SET active=false WHERE profile_contacts.profile_id=v_profile_id AND user_id=auth.uid();RETURN jsonb_build_object('ok',true);
 ELSIF p_action='withdraw_delegate' THEN
  IF NOT EXISTS(SELECT 1 FROM bts_private.profile_controls WHERE profile_controls.profile_id=v_profile_id AND subject_id=auth.uid()) THEN RAISE EXCEPTION 'Only the adult performer can withdraw delegated permission directly.';END IF;
  UPDATE bts_private.profile_keys SET active=false WHERE profile_keys.profile_id=v_profile_id AND user_id=v_target_id AND kind='delegate';RETURN jsonb_build_object('ok',true);
 ELSIF p_action='contact_preference' THEN
  IF EXISTS(SELECT 1 FROM bts_private.profile_contacts c JOIN bts_private.profile_keys k ON k.profile_id=c.profile_id AND k.user_id=c.user_id WHERE c.id=public.try_uuid(p_data->>'contact_id') AND c.user_id<>auth.uid() AND k.kind='guardian' AND k.active) THEN RAISE EXCEPTION 'Each guardian controls their own notifications. Removing guardian access needs a review.';END IF;
  UPDATE bts_private.profile_contacts SET active=coalesce((p_data->>'enabled')::boolean,false) WHERE profile_contacts.id=public.try_uuid(p_data->>'contact_id') AND (user_id=auth.uid() OR public.bts_profile_manager(profile_contacts.profile_id));IF NOT FOUND THEN RAISE EXCEPTION 'Contact not found.';END IF;RETURN jsonb_build_object('ok',true);
 ELSIF p_action='review' THEN
  IF p_data->>'kind' NOT IN ('guardian_removal','record_link','duplicate_profile','duplicate_account','controller_transfer','birth_date','adult_activation') OR NOT (public.bts_profile_manager(v_profile_id) OR (p_data->>'kind'='adult_activation' AND EXISTS(SELECT 1 FROM bts_private.profile_controls c JOIN public.profiles p ON p.id=c.profile_id WHERE c.profile_id=v_profile_id AND c.manager_id=auth.uid() AND c.kind='child' AND p.date_of_birth<=(current_date-interval '18 years')::date))) THEN RAISE EXCEPTION 'Request this review as the profile access manager.';END IF;
  IF length(coalesce(p_data->>'explanation',''))<10 THEN RAISE EXCEPTION 'Describe what needs reviewing.';END IF;
  INSERT INTO bts_private.family_reviews(requester_id,kind,profile_id,payload) VALUES(auth.uid(),p_data->>'kind',v_profile_id,p_data) RETURNING family_reviews.id INTO id;RETURN jsonb_build_object('id',id,'message','Review requested. No ownership or guardian access has changed.');
 ELSIF p_action='link_own_record' THEN
  IF NOT public.bts_profile_access(v_profile_id) THEN RAISE EXCEPTION 'Choose an authorised performer.';END IF;
  IF EXISTS(SELECT 1 FROM (SELECT id,user_id,custom_answers FROM public.audition_applications WHERE p_data->>'table'='application' UNION ALL SELECT id,user_id,custom_answers FROM public.audition_bookings WHERE p_data->>'table'='booking') a JOIN public.profiles p ON p.id=v_profile_id WHERE a.id=public.try_uuid(p_data->>'record_id') AND a.user_id=auth.uid() AND nullif(a.custom_answers->>'Date of Birth','') IS NOT NULL AND public.bts_parse_performer_birth_date(a.custom_answers->>'Date of Birth') IS DISTINCT FROM p.date_of_birth) THEN RAISE EXCEPTION 'The birth dates differ. Request a reviewed record link.';END IF;
  IF p_data->>'table'='application' THEN UPDATE public.audition_applications SET profile_id=v_profile_id WHERE audition_applications.id=public.try_uuid(p_data->>'record_id') AND user_id=auth.uid() AND audition_applications.profile_id IS NULL;
  ELSIF p_data->>'table'='booking' THEN UPDATE public.audition_bookings SET profile_id=v_profile_id WHERE audition_bookings.id=public.try_uuid(p_data->>'record_id') AND user_id=auth.uid() AND audition_bookings.profile_id IS NULL;
  ELSE RAISE EXCEPTION 'Choose an audition application or booking.';END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only your existing unlinked record can be connected here. Otherwise request a review.';END IF;RETURN jsonb_build_object('ok',true);
 ELSE RAISE EXCEPTION 'Unsupported household action.';
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.bts_family(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_family(text,jsonb) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.bts_owns_audition(p_production_id uuid,p_applicant_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.bts_account_is_active() AND (EXISTS(SELECT 1 FROM public.audition_applications a WHERE a.id=p_applicant_id AND a.production_id=p_production_id AND ((a.profile_id IS NULL AND a.user_id=auth.uid()) OR public.bts_profile_access(a.profile_id))) OR EXISTS(SELECT 1 FROM public.audition_bookings a WHERE a.id=p_applicant_id AND a.production_id=p_production_id AND ((a.profile_id IS NULL AND a.user_id=auth.uid()) OR public.bts_profile_access(a.profile_id))));
$$;
CREATE OR REPLACE FUNCTION public.bts_is_production_participant(p_production_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.bts_account_is_active() AND (EXISTS(SELECT 1 FROM public.audition_applications a WHERE a.production_id=p_production_id AND public.bts_owns_audition(a.production_id,a.id)) OR EXISTS(SELECT 1 FROM public.audition_bookings a WHERE a.production_id=p_production_id AND public.bts_owns_audition(a.production_id,a.id)) OR EXISTS(SELECT 1 FROM public.volunteer_signups WHERE production_id=p_production_id AND user_id=auth.uid()));
$$;
CREATE FUNCTION public.bts_current_account_email() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT email FROM auth.users WHERE id=auth.uid();$$;
REVOKE ALL ON FUNCTION public.bts_current_account_email() FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.bts_current_account_email() TO authenticated;
CREATE FUNCTION public.bts_current_guardian_name(p_profile_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT declared_name FROM bts_private.profile_keys WHERE profile_id=p_profile_id AND user_id=auth.uid() AND active AND public.bts_profile_access(p_profile_id);$$;
REVOKE ALL ON FUNCTION public.bts_current_guardian_name(uuid) FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.bts_current_guardian_name(uuid) TO authenticated;
CREATE FUNCTION public.bts_profile_can_declare(p_profile_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.bts_profile_access(p_profile_id) AND EXISTS(SELECT 1 FROM bts_private.profile_keys k JOIN public.profiles p ON p.id=k.profile_id WHERE k.profile_id=p_profile_id AND k.user_id=auth.uid() AND k.active AND (k.kind='self' OR (k.kind='guardian' AND p.date_of_birth>(current_date-interval '18 years')::date)));
$$;
REVOKE ALL ON FUNCTION public.bts_profile_can_declare(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_profile_can_declare(uuid) TO authenticated;
CREATE FUNCTION bts_private.prepare_family_audition() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE person public.profiles%rowtype; birth date; matches integer; full_name text; relation text; answer_key text;
BEGIN
 IF current_user NOT IN ('anon','authenticated') THEN RETURN NEW;END IF;
 IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in before booking.';END IF;
 IF TG_OP='UPDATE' AND NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN RAISE EXCEPTION 'Use the reviewed linking workflow to change performer identity.';END IF;
 IF NEW.profile_id IS NULL AND TG_OP='INSERT' THEN
  birth:=public.bts_parse_performer_birth_date(NEW.custom_answers->>'Date of Birth');full_name:=trim(NEW.name);
  SELECT count(*) INTO matches FROM public.profiles p WHERE public.bts_profile_access(p.id) AND lower(trim(coalesce(p.credit_name,p.name)))=lower(full_name) AND p.date_of_birth=birth;
  IF matches>1 THEN RAISE EXCEPTION 'Choose the existing performer profile; more than one matches.';END IF;
  IF matches=1 THEN SELECT id INTO NEW.profile_id FROM public.profiles p WHERE public.bts_profile_access(p.id) AND lower(trim(coalesce(p.credit_name,p.name)))=lower(full_name) AND p.date_of_birth=birth;
  ELSE
   relation:=coalesce(NEW.custom_answers->>'__bts_profile_relationship',CASE WHEN birth>(current_date-interval '18 years')::date THEN 'child' ELSE 'self' END);
   IF relation='adult' THEN RAISE EXCEPTION 'Create this adult profile in Households and wait for their permission before booking.';END IF;
   NEW.profile_id:=public.bts_save_profile(jsonb_build_object('credit_name',full_name,'legal_first_name',split_part(full_name,' ',1),'legal_last_name',trim(substr(full_name,length(split_part(full_name,' ',1))+1)),'date_of_birth',birth,'guardian_name',coalesce(NEW.custom_answers->>'Guardian Name',NEW.custom_answers->>'Guardian name'),'relationship_kind',relation),NULL,NEW.custom_answers->>'__bts_guardian_confirmed'='true');
  END IF;
 END IF;
 IF TG_OP='INSERT' AND NEW.profile_id IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.profile_id::text||NEW.production_id::text||TG_TABLE_NAME,0));
  IF TG_TABLE_NAME='audition_applications' AND EXISTS(SELECT 1 FROM public.bts_participant_applications a WHERE a.profile_id=NEW.profile_id AND a.production_id=NEW.production_id AND coalesce(a.status,'') !~* '(cancel|withdraw)') THEN RAISE EXCEPTION 'This performer already has an application for this show. Open their existing record.';END IF;
  IF TG_TABLE_NAME='audition_bookings' AND EXISTS(SELECT 1 FROM public.bts_participant_bookings a WHERE a.profile_id=NEW.profile_id AND a.production_id=NEW.production_id AND a.session_id IS NOT DISTINCT FROM NEW.session_id AND coalesce(a.status,'') !~* '(cancel|withdraw)') THEN RAISE EXCEPTION 'This performer already has a booking for this session. Open the existing booking instead.';END IF;
 END IF;
 IF TG_OP='INSERT' THEN NEW.email:=public.bts_current_account_email();ELSIF NEW.email IS DISTINCT FROM OLD.email AND NOT public.bts_audition_record_permission(NEW.production_id,'auditions.general',2) THEN RAISE EXCEPTION 'Use confirmed notification contacts to change email delivery.';END IF;
 IF NEW.profile_id IS NOT NULL AND NOT public.bts_profile_can_declare(NEW.profile_id) AND NOT public.bts_audition_record_permission(NEW.production_id,'auditions.general',2) THEN
  FOR answer_key IN SELECT jsonb_object_keys(coalesce(NEW.custom_answers,'{}')) LOOP
   IF answer_key ~* '(signature|final_sign|final_guardian|__bts_registration_complete|__bts_registration_status|__bts_registration_submitted_at)' AND (TG_OP='INSERT' OR NEW.custom_answers->answer_key IS DISTINCT FROM OLD.custom_answers->answer_key) THEN RAISE EXCEPTION 'The adult performer must confirm personal agreements using their own login. Booking permission does not authorise signing for them.';END IF;
  END LOOP;
 END IF;
 IF NEW.profile_id IS NOT NULL THEN
  IF NOT public.bts_profile_access(NEW.profile_id) AND NOT public.bts_audition_record_permission(NEW.production_id,'auditions.general',2) THEN RAISE EXCEPTION 'This performer needs confirmed permission before booking.';END IF;
  SELECT * INTO person FROM public.profiles WHERE id=NEW.profile_id;
  IF person.id IS NOT NULL THEN
   NEW.custom_answers:=coalesce(NEW.custom_answers,'{}')||jsonb_build_object('Date of Birth',person.date_of_birth::text);
   IF TG_OP='INSERT' THEN NEW.name:=coalesce(person.credit_name,person.name);END IF;
   IF person.date_of_birth>(current_date-interval '18 years')::date AND public.bts_profile_access(person.id) THEN
    NEW.custom_answers:=NEW.custom_answers||jsonb_build_object('__bts_guardian_confirmed',true,'Guardian Name',coalesce(public.bts_current_guardian_name(person.id),person.guardian_name));
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER bts_aa_family_audition BEFORE INSERT OR UPDATE ON public.audition_applications FOR EACH ROW EXECUTE FUNCTION bts_private.prepare_family_audition();
CREATE TRIGGER bts_aa_family_booking BEFORE INSERT OR UPDATE ON public.audition_bookings FOR EACH ROW EXECUTE FUNCTION bts_private.prepare_family_audition();
CREATE OR REPLACE FUNCTION bts_private.guard_audition_account()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE staff boolean; dob date; before_row jsonb; after_row jsonb; changed text; assignment jsonb; file_value text;
BEGIN
  -- Trusted database/service operations remain available; browser roles cannot
  -- opt into this branch using a form field or editable user metadata.
  IF current_user NOT IN ('anon','authenticated') THEN RETURN NEW; END IF;
  IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with your adult account before submitting audition information.'; END IF;
  staff:=public.bts_audition_record_permission(NEW.production_id,'auditions.general',2);
  IF TG_OP='UPDATE' THEN
    staff:=staff OR public.bts_audition_record_permission(NEW.production_id,'auditions.schedule',2)
      OR public.bts_audition_record_permission(NEW.production_id,'auditions.dashboard',2)
      OR public.bts_audition_record_permission(NEW.production_id,'auditions.callback',2)
      OR public.bts_audition_record_permission(NEW.production_id,'auditions.casting_board',2)
      OR public.bts_audition_record_permission(NEW.production_id,'auditions.final_casting',2);
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.production_id IS DISTINCT FROM OLD.production_id
      OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
      OR NEW.guardian_user_id IS DISTINCT FROM OLD.guardian_user_id
      OR NEW.guardian_consent_at IS DISTINCT FROM OLD.guardian_consent_at
      OR NEW.guardian_consent_version IS DISTINCT FROM OLD.guardian_consent_version THEN
      RAISE EXCEPTION 'Account ownership and guardian records cannot be reassigned from a form.';
    END IF;
    IF NOT staff AND NOT public.bts_owns_audition(OLD.production_id,OLD.id) THEN RAISE EXCEPTION 'This audition record does not belong to your account.'; END IF;
    before_row:=to_jsonb(OLD); after_row:=to_jsonb(NEW);
    FOR changed IN SELECT key FROM jsonb_each(after_row) WHERE value IS DISTINCT FROM before_row->key LOOP
      IF changed IN ('status','character_id') AND NOT public.bts_audition_record_permission(NEW.production_id,'auditions.casting_board',2)
        AND NOT public.bts_audition_record_permission(NEW.production_id,'auditions.final_casting',2)
        AND NOT (public.bts_owns_audition(OLD.production_id,OLD.id) AND changed='status' AND NEW.status IN ('cancelled','withdrawn')) THEN
        RAISE EXCEPTION 'Only authorised casting staff can change casting decisions.';
      END IF;
      IF changed IN ('org_notes','checked_in','checked_in_at','session_checkins','callback_status','callback_notes','callback_rating','callback_group_id') THEN
        IF NOT public.bts_audition_record_permission(NEW.production_id,
          CASE WHEN changed LIKE 'callback%' THEN 'auditions.callback' WHEN changed IN ('checked_in','checked_in_at','session_checkins') THEN 'auditions.dashboard' ELSE 'auditions.general' END,2) THEN
          RAISE EXCEPTION 'That field can only be changed by authorised production staff.';
        END IF;
      END IF;
      IF staff AND changed IN ('slot_id','time_slot_id','session_id','slot_assignments')
        AND NOT public.bts_audition_record_permission(NEW.production_id,'auditions.schedule',2) THEN
        RAISE EXCEPTION 'Schedule changes require schedule access.';
      END IF;
      IF NOT public.bts_owns_audition(OLD.production_id,OLD.id)
        AND changed <> ALL(ARRAY['status','character_id','org_notes','checked_in','checked_in_at','session_checkins','callback_status','callback_notes','callback_rating','callback_group_id','slot_id','time_slot_id','session_id','slot_assignments'])
        AND NOT public.bts_audition_record_permission(NEW.production_id,'auditions.general',2) THEN
        RAISE EXCEPTION 'Performer detail changes require edit access to general auditions.';
      END IF;
    END LOOP;
  ELSE
    IF NOT staff THEN NEW.user_id:=auth.uid();
    ELSIF NEW.user_id IS NOT NULL AND NEW.user_id<>auth.uid() THEN
      RAISE EXCEPTION 'Use the reviewed account-linking process for another person.';
    END IF;
    IF NEW.status IS DISTINCT FROM 'pending' THEN RAISE EXCEPTION 'New public applications start as pending.'; END IF;
    IF NOT staff AND NOT public.bts_audition_accepts_public(NEW.production_id) THEN
      RAISE EXCEPTION 'This production is not accepting public applications.';
    END IF;
    IF TG_TABLE_NAME='audition_applications' THEN
      after_row:=to_jsonb(NEW);
      IF coalesce((after_row->>'checked_in')::boolean,false) OR after_row->>'org_notes' IS NOT NULL
        OR after_row->>'character_id' IS NOT NULL OR coalesce(after_row->>'callback_status','none')<>'none'
        OR after_row->>'callback_notes' IS NOT NULL OR coalesce(after_row->'callback_rating','{}'::jsonb)<>'{}'::jsonb THEN
        RAISE EXCEPTION 'Staff assessment fields cannot be supplied on an application.';
      END IF;
    END IF;
  END IF;
  IF (NEW.user_id=auth.uid() OR public.bts_profile_access(NEW.profile_id)) AND (TG_OP='INSERT' OR NEW.custom_answers IS DISTINCT FROM OLD.custom_answers) THEN
    dob:=public.bts_parse_performer_birth_date(NEW.custom_answers->>'Date of Birth');
    IF dob IS NULL OR dob>current_date OR dob<(current_date-interval '120 years')::date THEN RAISE EXCEPTION 'Enter a valid performer birth date.'; END IF;
    IF dob>(current_date-interval '18 years')::date THEN
      IF TG_OP='INSERT' OR (NEW.profile_id IS NULL AND (OLD.guardian_user_id IS DISTINCT FROM auth.uid() OR OLD.guardian_consent_at IS NULL)) THEN
        IF NEW.custom_answers->>'__bts_guardian_confirmed' IS DISTINCT FROM 'true'
          OR nullif(trim(NEW.custom_answers->>'Guardian Name'),'') IS NULL THEN
          RAISE EXCEPTION 'The adult account holder must confirm they are the child''s parent or legal guardian.';
        END IF;
        NEW.guardian_user_id:=auth.uid(); NEW.guardian_consent_at:=now(); NEW.guardian_consent_version:='2026-11-15-auditions';
      END IF;
    ELSIF TG_OP='INSERT' THEN NEW.guardian_user_id:=NULL; NEW.guardian_consent_at:=NULL; NEW.guardian_consent_version:=NULL;
    END IF;
  ELSIF TG_OP='INSERT' THEN NEW.guardian_user_id:=NULL; NEW.guardian_consent_at:=NULL; NEW.guardian_consent_version:=NULL;
  END IF;
  IF NOT staff THEN
    after_row:=to_jsonb(NEW);
    IF NEW.session_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.bts_visible_audition_sessions s
      WHERE s.id=NEW.session_id AND s.production_id=NEW.production_id) THEN RAISE EXCEPTION 'Choose an audition session for this production.'; END IF;
    IF NEW.slot_id IS NOT NULL THEN
      IF TG_TABLE_NAME='audition_bookings' THEN
        IF NOT EXISTS(SELECT 1 FROM public.bts_visible_audition_time_slots ts JOIN public.bts_visible_audition_sessions s ON s.id=ts.session_id
          WHERE ts.id=NEW.slot_id AND s.id=NEW.session_id AND s.production_id=NEW.production_id) THEN
          RAISE EXCEPTION 'Choose an audition time for this production.';
        END IF;
      ELSIF EXISTS(SELECT 1 FROM public.bts_visible_audition_time_slots ts JOIN public.bts_visible_audition_sessions s ON s.id=ts.session_id
        WHERE ts.id=NEW.slot_id AND s.production_id=NEW.production_id) THEN
        -- Legacy clients put modern time-slot IDs in the legacy slot column.
        NEW.time_slot_id:=NEW.slot_id; NEW.slot_id:=NULL;
      ELSIF NOT EXISTS(SELECT 1 FROM public.bts_visible_audition_slots s WHERE s.id=NEW.slot_id AND s.production_id=NEW.production_id) THEN
        RAISE EXCEPTION 'Choose an audition time for this production.';
      END IF;
    END IF;
    FOR assignment IN SELECT value FROM jsonb_array_elements(
      CASE WHEN TG_TABLE_NAME='audition_applications' AND jsonb_typeof(after_row->'slot_assignments')='array' THEN after_row->'slot_assignments'
      ELSE '[]'::jsonb END) LOOP
      IF NOT EXISTS(SELECT 1 FROM public.bts_visible_audition_time_slots ts JOIN public.bts_visible_audition_sessions s ON s.id=ts.session_id
        WHERE ts.id=(assignment->>'slot_id')::uuid AND s.id=(assignment->>'session_id')::uuid AND s.production_id=NEW.production_id) THEN
        RAISE EXCEPTION 'Choose an audition time for this production.';
      END IF;
    END LOOP;
    FOREACH changed IN ARRAY ARRAY['headshot_url','file_url'] LOOP
      file_value:=after_row->>changed;
      IF file_value LIKE 'https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/%'
        AND file_value NOT LIKE 'https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/v1/object/public/profile-headshots/'||auth.uid()::text||'/%'
        AND NOT public.bts_family_file_access(NEW.profile_id,file_value) AND (TG_OP='INSERT' OR file_value IS DISTINCT FROM to_jsonb(OLD)->>changed) THEN
        RAISE EXCEPTION 'Upload files through your own adult account.';
      END IF;
    END LOOP;
  END IF;
  IF NEW.profile_id IS NOT NULL AND NOT staff AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=NEW.profile_id
    AND public.bts_profile_access(p.id)) THEN
    RAISE EXCEPTION 'Choose a performer profile managed by your own account.';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE VIEW public.bts_participant_applications WITH (security_barrier=true) AS SELECT id,production_id,user_id,profile_id,name,email,phone,notes,headshot_url,role_interest,status,created_at,slot_id,experience,conflicts,skills,file_url,session_id,time_slot_id,experience_level,custom_answers,date_conflicts,slot_assignments,attendance_mode,audition_method,preferred_name,pronouns,booking_id,custom_answers->>'Date of Birth' AS date_of_birth,custom_answers->>'Date of Birth' AS dob,custom_answers->>'Performer Number' AS performer_number,custom_answers->>'__bts_portal_code' AS portal_code FROM public.audition_applications WHERE public.bts_account_is_active() AND (((profile_id IS NULL AND user_id=auth.uid()) OR public.bts_profile_access(profile_id)) OR (public.bts_audition_record_permission(production_id,'auditions.general',1) OR public.bts_audition_record_permission(production_id,'auditions.dashboard',1) OR public.bts_audition_record_permission(production_id,'auditions.schedule',1) OR public.bts_audition_record_permission(production_id,'auditions.callback',1) OR public.bts_audition_record_permission(production_id,'auditions.dance_call',1) OR public.bts_audition_record_permission(production_id,'auditions.casting_board',1) OR public.bts_audition_record_permission(production_id,'auditions.final_casting',1))) WITH LOCAL CHECK OPTION;
CREATE OR REPLACE VIEW public.bts_participant_bookings WITH (security_barrier=true) AS SELECT id,production_id,session_id,slot_id,user_id,profile_id,created_at,age,is_minor,custom_answers,name,email,phone,pronouns,contact_name,role_preference,gender_preference,roles_requested,guardian_name,guardian_email,headshot_url,status,attendance_mode,portal_code,custom_answers->>'Date of Birth' AS date_of_birth,custom_answers->>'Date of Birth' AS dob,custom_answers->>'Performer Number' AS performer_number FROM public.audition_bookings WHERE public.bts_account_is_active() AND (((profile_id IS NULL AND user_id=auth.uid()) OR public.bts_profile_access(profile_id)) OR (public.bts_audition_record_permission(production_id,'auditions.general',1) OR public.bts_audition_record_permission(production_id,'auditions.dashboard',1) OR public.bts_audition_record_permission(production_id,'auditions.schedule',1) OR public.bts_audition_record_permission(production_id,'auditions.callback',1) OR public.bts_audition_record_permission(production_id,'auditions.dance_call',1) OR public.bts_audition_record_permission(production_id,'auditions.casting_board',1) OR public.bts_audition_record_permission(production_id,'auditions.final_casting',1))) WITH LOCAL CHECK OPTION;

CREATE TABLE bts_private.profile_file_keys(bucket text NOT NULL,name text NOT NULL,profile_id uuid NOT NULL REFERENCES public.profiles(id),created_by uuid NOT NULL REFERENCES auth.users(id),PRIMARY KEY(bucket,name));
REVOKE ALL ON bts_private.profile_file_keys FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bts_bind_profile_file(p_profile_id uuid,p_url text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE path text;v_bucket text;
BEGIN
 IF NOT public.bts_profile_access(p_profile_id,false) THEN RETURN false;END IF;
 IF p_url LIKE 'https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/v1/object/public/profile-headshots/%' THEN v_bucket:='profile-headshots';path:=split_part(split_part(p_url,'/profile-headshots/',2),'?',1);
 ELSIF p_url LIKE 'https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/v1/object/public/audition-headshots/%' THEN v_bucket:='audition-headshots';path:=split_part(split_part(p_url,'/audition-headshots/',2),'?',1);ELSE RETURN false;END IF;
 IF split_part(path,'/',1)<>auth.uid()::text THEN RETURN false;END IF;
 INSERT INTO bts_private.profile_file_keys VALUES(v_bucket,path,p_profile_id,auth.uid()) ON CONFLICT DO NOTHING;
 RETURN EXISTS(SELECT 1 FROM bts_private.profile_file_keys f WHERE f.bucket=v_bucket AND f.name=path AND f.profile_id=p_profile_id);
END $$;
REVOKE ALL ON FUNCTION public.bts_bind_profile_file(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_bind_profile_file(uuid,text) TO authenticated;
CREATE FUNCTION bts_private.file_permission_before_households(p_bucket text,p_name text,p_rank integer)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE first_id uuid:=public.try_uuid(split_part(p_name,'/',1)); prod_id uuid; org_id uuid; app_id uuid;
BEGIN
 IF p_rank NOT BETWEEN 1 AND 3 THEN RETURN false;END IF;
 IF p_bucket IN ('org-logos','org-banners','production-posters','past-posters') AND p_rank=1 THEN RETURN true; END IF;
 -- Published audition materials are the only anonymously readable files in the working-files bucket.
 IF p_bucket='production-files' AND p_rank=1 AND EXISTS(
 SELECT 1 FROM public.production_characters c JOIN public.productions p ON p.id=c.production_id
 WHERE p.id=first_id AND p.is_public AND p.page_status IN ('live','hidden') AND c.show_on_public_page AND EXISTS(SELECT 1 FROM public.production_files f WHERE f.production_id=p.id AND f.file_path=p_name AND (f.tags @> ARRAY['audition material']::text[] OR f.document_type='audition'))
 AND EXISTS(SELECT 1 FROM jsonb_each_text(to_jsonb(c)) kv WHERE kv.key LIKE 'audition_%' AND (kv.value=p_name OR kv.value LIKE '%/storage/v1/object/public/production-files/'||p_name))) THEN RETURN true;END IF;
 IF p_bucket='programme-ads' AND p_rank=1 AND EXISTS(SELECT 1 FROM public.programme_ads a WHERE a.production_id=first_id AND a.approval_status='approved' AND a.artwork_url LIKE '%/storage/v1/object/public/programme-ads/'||p_name) THEN RETURN true;END IF;
 IF NOT public.bts_account_is_active() THEN RETURN false;END IF;
 IF p_bucket='profile-headshots' THEN
  IF first_id=auth.uid() THEN RETURN true;END IF;
  RETURN p_rank=1 AND EXISTS(SELECT 1 FROM public.audition_applications a WHERE a.user_id=first_id AND (a.headshot_url LIKE '%/storage/v1/object/public/profile-headshots/'||p_name OR a.file_url LIKE '%/storage/v1/object/public/profile-headshots/'||p_name) AND public.bts_private_record_permission(a.production_id,'auditions.general',1));
 ELSIF p_bucket='production-files' THEN
  IF public.bts_private_record_permission(first_id,'overview',p_rank) THEN RETURN true;END IF;
  IF p_rank=1 AND public.bts_private_record_permission(first_id,'auditions.general',1) AND EXISTS(SELECT 1 FROM public.production_files WHERE production_id=first_id AND file_path=p_name AND document_type IN ('audition','callback')) THEN RETURN true;END IF;
  IF p_rank=1 AND public.bts_callback_access(first_id) AND EXISTS(SELECT 1 FROM public.bts_callback_files WHERE production_id=first_id AND file_path=p_name) THEN RETURN true;END IF;
  IF split_part(p_name,'/',2)='registrations' THEN
   app_id:=public.try_uuid(split_part(split_part(p_name,'/',3),'.',1));
   RETURN public.bts_owns_audition(first_id,app_id);
  END IF;
  RETURN false;
 ELSIF p_bucket='receipts' THEN RETURN public.bts_private_record_permission(first_id,'budget.receipts',p_rank);
 ELSIF p_bucket='org-files' OR p_bucket='venue-photos' OR p_bucket='org-logos' OR p_bucket='org-banners' THEN
  RETURN public.bts_organisation_role(first_id) IN ('owner','admin') OR (p_rank<3 AND public.bts_organisation_role(first_id)='editor') OR (p_rank=1 AND public.bts_organisation_role(first_id)='viewer') OR first_id=auth.uid();
 ELSIF p_bucket='production-posters' THEN RETURN public.bts_production_page_permission(first_id,'settings.details',greatest(p_rank,2)) OR first_id=auth.uid();
 ELSIF p_bucket='past-posters' THEN RETURN public.bts_organisation_role(first_id) IN ('owner','admin','editor');
 ELSIF p_bucket='audition-headshots' THEN RETURN first_id=auth.uid() OR public.bts_private_record_permission(first_id,'auditions.general',p_rank);
 ELSIF p_bucket='proposal-attachments' THEN
  IF first_id=auth.uid() THEN RETURN true;END IF;
  IF split_part(p_name,'/',2)='proposals' THEN SELECT organization_id INTO org_id FROM public.production_proposal_intakes WHERE id=public.try_uuid(split_part(p_name,'/',3)); RETURN public.bts_organisation_role(org_id) IN ('owner','admin','editor');END IF;
  IF split_part(p_name,'/',1)='proposals' THEN
   SELECT organization_id INTO org_id FROM public.production_proposal_intakes WHERE id=public.try_uuid(split_part(p_name,'/',2));
   RETURN public.bts_organisation_role(org_id) IN ('owner','admin','editor');
  END IF;RETURN false;
 ELSIF p_bucket='programme-ads' THEN
  RETURN public.bts_private_record_permission(first_id,'marketing.sponsors',p_rank) OR EXISTS(SELECT 1 FROM public.sponsor_businesses b WHERE b.id=public.try_uuid(split_part(p_name,'/',2)) AND b.production_id=first_id AND b.user_id=auth.uid());
 END IF;
 RETURN false;
END $$;
REVOKE ALL ON FUNCTION bts_private.file_permission_before_households(text,text,integer) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.bts_file_permission(p_bucket text,p_name text,p_rank integer) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN EXISTS(SELECT 1 FROM bts_private.profile_file_keys WHERE bucket=p_bucket AND name=p_name) THEN
 EXISTS(SELECT 1 FROM bts_private.profile_file_keys f WHERE f.bucket=p_bucket AND f.name=p_name AND ((public.bts_profile_access(f.profile_id,p_rank<>1) AND (p_rank=1 OR bts_private.file_permission_before_households(p_bucket,p_name,p_rank))) OR (p_rank=1 AND EXISTS(SELECT 1 FROM public.audition_applications a WHERE a.profile_id=f.profile_id AND (public.bts_production_page_permission(a.production_id,'auditions.general',1) OR public.bts_production_page_permission(a.production_id,'cast_list',1))))))
 ELSE bts_private.file_permission_before_households(p_bucket,p_name,p_rank) END;
$$;
REVOKE ALL ON FUNCTION public.bts_file_permission(text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_file_permission(text,text,integer) TO anon,authenticated;

ALTER TABLE bts_private.family_mail ADD COLUMN attempted_at timestamptz;
CREATE FUNCTION public.bts_family_mail_claim() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE available integer; jobs jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(725416103);
 UPDATE bts_private.profile_contacts SET preference_token=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','') WHERE preference_token IS NULL;
 UPDATE bts_private.profile_contacts SET unsubscribe_hash=encode(sha256(convert_to(preference_token,'UTF8')),'hex') WHERE unsubscribe_hash IS DISTINCT FROM encode(sha256(convert_to(preference_token,'UTF8')),'hex');
 available:=greatest(0,10-(SELECT count(*) FROM bts_private.family_mail WHERE attempted_at>now()-interval '1 minute'));
 UPDATE bts_private.family_mail m SET state='cancelled' WHERE m.state IN ('pending','failed') AND m.kind='invitation' AND EXISTS(SELECT 1 FROM bts_private.family_invites i WHERE i.id::text=m.payload->>'invite_id' AND (i.state<>'pending' OR i.expires_at<now()));
 UPDATE bts_private.family_mail m SET state='cancelled' WHERE m.state IN ('pending','failed') AND m.kind='production_template' AND m.payload->>'record_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.bts_family_recipients(public.try_uuid(m.payload->>'production_id'),public.try_uuid(m.payload->>'record_id')) r WHERE r.email=m.recipient);
 UPDATE bts_private.family_mail m SET state='cancelled' WHERE m.state IN ('pending','failed') AND m.kind IN ('booking_updated','access_changed','profile_updated','payment_updated') AND NOT EXISTS(SELECT 1 FROM bts_private.profile_contacts c JOIN public.profiles p ON p.id=c.profile_id JOIN bts_private.profile_controls x ON x.profile_id=p.id WHERE c.profile_id=m.profile_id AND c.email=m.recipient AND c.active AND p.deleted_at IS NULL AND x.consent_state='active' AND NOT(x.kind='child' AND p.date_of_birth<=(current_date-interval '18 years')::date) AND ((c.user_id IS NULL AND c.confirmed_at IS NOT NULL) OR EXISTS(SELECT 1 FROM bts_private.profile_keys k JOIN auth.users u ON u.id=k.user_id WHERE k.profile_id=p.id AND k.user_id=c.user_id AND k.active AND lower(u.email)=c.email)));
 WITH selected AS (SELECT id FROM bts_private.family_mail WHERE (state IN ('pending','failed') OR (state='sending' AND lease_until<now())) AND attempts<3 ORDER BY CASE kind WHEN 'invitation' THEN 0 WHEN 'consent_receipt' THEN 1 WHEN 'production_template' THEN 2 ELSE 3 END,created_at LIMIT available FOR UPDATE SKIP LOCKED), claimed AS (UPDATE bts_private.family_mail m SET state='sending',attempts=attempts+1,lease_until=now()+interval '90 seconds',attempted_at=now(),payload=m.payload||jsonb_build_object('performer',coalesce(m.payload->>'performer',(SELECT p.credit_name FROM public.profiles p WHERE p.id=m.profile_id)),'preference_token',coalesce(m.payload->>'preference_token',(SELECT preference_token FROM bts_private.profile_contacts p WHERE p.profile_id=m.profile_id AND p.email=m.recipient))) WHERE id IN (SELECT id FROM selected) RETURNING m.*)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'to',c.recipient,'kind',c.kind,'profile_id',c.profile_id,'payload',c.payload,'performer',c.payload->>'performer')),'[]'::jsonb) INTO jobs FROM claimed c;
 RETURN jobs;
END $$;
CREATE FUNCTION public.bts_family_mail_finish(p_id uuid,p_success boolean,p_provider_id text DEFAULT NULL,p_error text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE job bts_private.family_mail%rowtype;
BEGIN
 UPDATE bts_private.family_mail SET state=CASE WHEN p_success THEN 'sent' ELSE 'failed' END,provider_id=p_provider_id,last_error=left(p_error,500),lease_until=NULL WHERE id=p_id AND state='sending' RETURNING * INTO job;
 IF p_success AND job.kind='production_template' AND job.payload->>'category'='registration_completed' AND NOT EXISTS(SELECT 1 FROM bts_private.family_mail WHERE payload->>'message_key'=job.payload->>'message_key' AND state NOT IN ('sent','cancelled')) THEN
  UPDATE public.audition_applications SET custom_answers=coalesce(custom_answers,'{}')||jsonb_build_object('__bts_registration_confirmation_sent_at',now(),'__bts_registration_confirmation_error','') WHERE id=public.try_uuid(job.payload->>'record_id');
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.bts_family_mail_claim(),public.bts_family_mail_finish(uuid,boolean,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_family_mail_claim(),public.bts_family_mail_finish(uuid,boolean,text,text) TO service_role;
CREATE FUNCTION bts_private.family_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE profile uuid; action_name text; v_contact record;
BEGIN
 profile:=(to_jsonb(NEW)->>'profile_id')::uuid;
 IF profile IS NULL THEN RETURN NEW;END IF;
 PERFORM public.bts_bind_profile_file(profile,to_jsonb(NEW)->>'headshot_url');PERFORM public.bts_bind_profile_file(profile,to_jsonb(NEW)->>'file_url');
 IF TG_OP='UPDATE' AND to_jsonb(NEW)-'custom_answers' IS NOT DISTINCT FROM to_jsonb(OLD)-'custom_answers' AND (coalesce(NEW.custom_answers,'{}')-ARRAY['__bts_registration_confirmation_sent_at','__bts_registration_confirmation_queued_at','__bts_registration_confirmation_error']) IS NOT DISTINCT FROM (coalesce(OLD.custom_answers,'{}')-ARRAY['__bts_registration_confirmation_sent_at','__bts_registration_confirmation_queued_at','__bts_registration_confirmation_error']) THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND to_jsonb(NEW)-ARRAY['updated_at','last_used_at'] IS NOT DISTINCT FROM to_jsonb(OLD)-ARRAY['updated_at','last_used_at'] THEN RETURN NEW;END IF;
 IF TG_OP='INSERT' THEN
  IF NOT EXISTS(SELECT 1 FROM bts_private.family_mail m WHERE m.profile_id=profile AND m.kind='render_booking' AND m.payload->>'production_id'=NEW.production_id::text AND m.created_at>now()-interval '5 minutes') THEN
   INSERT INTO bts_private.family_mail(actor_id,recipient,kind,profile_id,payload) VALUES(auth.uid(),'','render_booking',profile,jsonb_build_object('production_id',NEW.production_id,'record_id',NEW.id,'table',TG_TABLE_NAME,'category',CASE WHEN to_jsonb(NEW)->>'audition_method'='self_tape' THEN 'self_tape_booked' ELSE 'booking_confirmation' END));
  END IF;
  INSERT INTO bts_private.family_audit(profile_id,actor_id,action,details) VALUES(profile,auth.uid(),'booking_created',jsonb_build_object('table',TG_TABLE_NAME));
  RETURN NEW;
 END IF;
 action_name:=CASE WHEN TG_TABLE_NAME IN ('audition_applications','audition_bookings') THEN 'booking_updated' ELSE 'profile_updated' END;
 INSERT INTO bts_private.family_audit(profile_id,actor_id,action,details) VALUES(profile,auth.uid(),action_name,jsonb_build_object('table',TG_TABLE_NAME));
 FOR v_contact IN SELECT DISTINCT c.email FROM bts_private.profile_contacts c WHERE c.profile_id=profile AND c.active AND ((c.user_id IS NULL AND c.confirmed_at IS NOT NULL) OR EXISTS(SELECT 1 FROM bts_private.profile_keys k JOIN public.profiles f ON f.id=k.profile_id WHERE k.profile_id=c.profile_id AND k.user_id=c.user_id AND k.active AND c.email=(SELECT lower(u.email) FROM auth.users u WHERE u.id=k.user_id) AND (k.kind<>'guardian' OR f.date_of_birth>(current_date-interval '18 years')::date))) LOOP
  IF NOT EXISTS(SELECT 1 FROM bts_private.family_mail WHERE profile_id=profile AND recipient=v_contact.email AND kind=action_name AND created_at>now()-interval '5 minutes') THEN
   INSERT INTO bts_private.family_mail(actor_id,recipient,kind,profile_id,payload) VALUES(auth.uid(),v_contact.email,action_name,profile,jsonb_build_object('production_id',to_jsonb(NEW)->>'production_id'));
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER family_booking_events AFTER INSERT OR UPDATE ON public.audition_applications FOR EACH ROW EXECUTE FUNCTION bts_private.family_event();
CREATE TRIGGER family_booking_events AFTER INSERT OR UPDATE ON public.audition_bookings FOR EACH ROW EXECUTE FUNCTION bts_private.family_event();
CREATE FUNCTION public.bts_family_recipients(p_production_id uuid,p_applicant_id uuid) RETURNS TABLE(email text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH person AS (SELECT a.profile_id,a.user_id,a.email FROM public.audition_applications a WHERE a.id=p_applicant_id AND a.production_id=p_production_id UNION ALL SELECT a.profile_id,a.user_id,a.email FROM public.audition_bookings a WHERE a.id=p_applicant_id AND a.production_id=p_production_id)
 SELECT DISTINCT lower(trim(coalesce((SELECT u.email FROM auth.users u WHERE u.id=p.user_id),p.email))) FROM person p WHERE p.email IS NOT NULL AND (p.profile_id IS NULL OR NOT EXISTS(SELECT 1 FROM bts_private.profile_controls WHERE profile_id=p.profile_id))
 UNION SELECT DISTINCT c.email FROM bts_private.profile_contacts c JOIN person x ON x.profile_id=c.profile_id JOIN public.profiles p ON p.id=c.profile_id JOIN bts_private.profile_controls control ON control.profile_id=p.id
 WHERE c.active AND p.deleted_at IS NULL AND control.consent_state='active' AND NOT(control.kind='child' AND p.date_of_birth<=(current_date-interval '18 years')::date)
 AND ((c.user_id IS NULL AND c.confirmed_at IS NOT NULL) OR EXISTS(SELECT 1 FROM bts_private.profile_keys k JOIN auth.users u ON u.id=k.user_id WHERE k.profile_id=c.profile_id AND k.user_id=c.user_id AND k.active AND lower(u.email)=c.email AND (k.kind<>'guardian' OR p.date_of_birth>(current_date-interval '18 years')::date)));
$$;
REVOKE ALL ON FUNCTION public.bts_family_recipients(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_family_recipients(uuid,uuid) TO service_role;
CREATE FUNCTION public.bts_family_email_authorize(p_user_id uuid,p_production_id uuid,p_record_id uuid,p_category text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE profile uuid; creator uuid; hits integer; answers jsonb;
BEGIN
 IF p_category NOT IN ('booking_confirmation','self_tape_booked','registration_completed','callback_confirmed','callback_declined','cast_accepted','cast_response_notification') THEN RETURN false;END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users u JOIN bts_private.account_controls c ON c.user_id=u.id WHERE u.id=p_user_id AND c.status='active' AND c.birth_date<=(current_date-interval '18 years')::date AND c.privacy_version='2026-11-15' AND c.terms_version='2026-11-15' AND (u.banned_until IS NULL OR u.banned_until<now())) THEN RETURN false;END IF;
 SELECT a.profile_id,a.user_id,a.custom_answers INTO profile,creator,answers FROM public.audition_applications a WHERE a.id=p_record_id AND a.production_id=p_production_id;
 IF NOT FOUND THEN SELECT a.profile_id,a.user_id,a.custom_answers INTO profile,creator,answers FROM public.audition_bookings a WHERE a.id=p_record_id AND a.production_id=p_production_id;END IF;
 IF NOT FOUND THEN RETURN false;END IF;
 IF p_category='registration_completed' AND coalesce(answers->>'__bts_registration_complete','false')<>'true' THEN RETURN false;END IF;
 IF p_category='cast_accepted' AND NOT EXISTS(SELECT 1 FROM public.casting_assignments WHERE production_id=p_production_id AND applicant_id=p_record_id AND state='offer_accepted') THEN RETURN false;END IF;
 IF NOT ((creator=p_user_id AND (profile IS NULL OR NOT EXISTS(SELECT 1 FROM bts_private.profile_controls WHERE profile_id=profile))) OR EXISTS(SELECT 1 FROM bts_private.profile_keys k JOIN public.profiles p ON p.id=k.profile_id WHERE k.profile_id=profile AND k.user_id=p_user_id AND k.active AND (k.kind<>'guardian' OR p.date_of_birth>(current_date-interval '18 years')::date))) THEN RETURN false;END IF;
 INSERT INTO bts_private.email_rate_windows(user_id,kind,window_start,sent_requests) VALUES(p_user_id,'family_confirmation',date_trunc('hour',now()),1) ON CONFLICT(user_id,kind,window_start) DO UPDATE SET sent_requests=email_rate_windows.sent_requests+1 WHERE email_rate_windows.sent_requests<30 RETURNING sent_requests INTO hits;
 RETURN hits IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.bts_family_email_authorize(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_family_email_authorize(uuid,uuid,uuid,text) TO service_role;
CREATE FUNCTION public.bts_family_review_resolve(p_request_id uuid,p_approved boolean,p_reason text,p_verified_users uuid[] DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r bts_private.family_reviews%rowtype; target uuid; source uuid; source_owner uuid; target_owner uuid;
BEGIN
 IF length(trim(coalesce(p_reason,'')))<20 THEN RAISE EXCEPTION 'Record the reviewed evidence and decision.';END IF;
 SELECT * INTO r FROM bts_private.family_reviews WHERE id=p_request_id AND state='pending' FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Review not found or already resolved.';END IF;
 IF p_approved THEN
  IF NOT r.requester_id=ANY(p_verified_users) THEN RAISE EXCEPTION 'The requester must be verified outside this automated workflow.';END IF;
  IF r.kind='adult_activation' THEN
   IF NOT EXISTS(SELECT 1 FROM public.profiles p JOIN bts_private.profile_controls c ON c.profile_id=p.id WHERE p.id=r.profile_id AND c.kind='child' AND p.date_of_birth<=(current_date-interval '18 years')::date) THEN RAISE EXCEPTION 'Adult activation requires the performer to be 18 or older.';END IF;
   SELECT u.id INTO target FROM auth.users u JOIN bts_private.account_controls a ON a.user_id=u.id WHERE lower(u.email)=lower(r.payload->>'target_email') AND a.status='active' AND a.birth_date<=(current_date-interval '18 years')::date AND a.birth_date=(SELECT date_of_birth FROM public.profiles WHERE id=r.profile_id);
   IF target IS NULL OR NOT target=ANY(p_verified_users) THEN RAISE EXCEPTION 'Verify the adult performer and their receiving account.';END IF;
   UPDATE bts_private.profile_controls SET subject_id=target,manager_id=target,kind='self',consent_state='active' WHERE profile_id=r.profile_id;
   UPDATE bts_private.profile_keys SET active=false WHERE profile_id=r.profile_id AND kind='guardian';
   INSERT INTO bts_private.profile_keys(profile_id,user_id,kind) VALUES(r.profile_id,target,'self') ON CONFLICT(profile_id,user_id) DO UPDATE SET active=true,kind='self';
  ELSIF r.kind='birth_date' THEN
   IF (r.payload->>'date_of_birth')::date>current_date OR (r.payload->>'date_of_birth')::date<(current_date-interval '120 years')::date THEN RAISE EXCEPTION 'Enter a valid reviewed birth date.';END IF;
   UPDATE public.profiles SET date_of_birth=(r.payload->>'date_of_birth')::date WHERE id=r.profile_id;
  ELSIF r.kind='guardian_removal' THEN
   target:=public.try_uuid(r.payload->>'user_id');
   IF NOT EXISTS(SELECT 1 FROM bts_private.profile_controls WHERE profile_id=r.profile_id AND manager_id=r.requester_id) THEN RAISE EXCEPTION 'Only the primary manager can request removal.';END IF;
   IF target IS NULL OR NOT EXISTS(SELECT 1 FROM bts_private.profile_keys WHERE profile_id=r.profile_id AND user_id=target AND active AND kind='guardian') THEN RAISE EXCEPTION 'Choose an active added guardian key.';END IF;
   IF target=r.requester_id OR EXISTS(SELECT 1 FROM bts_private.profile_controls WHERE profile_id=r.profile_id AND creator_id=target) THEN RAISE EXCEPTION 'Use the reviewed controller handover process; an added guardian cannot remove the creator.';END IF;
   UPDATE bts_private.profile_keys SET active=false WHERE profile_id=r.profile_id AND user_id=target;
   UPDATE bts_private.profile_contacts SET active=false WHERE profile_id=r.profile_id AND user_id=target;
  ELSIF r.kind='controller_transfer' THEN
   target:=public.try_uuid(r.payload->>'user_id');IF NOT target=ANY(p_verified_users) OR NOT EXISTS(SELECT 1 FROM bts_private.profile_keys WHERE profile_id=r.profile_id AND user_id=target AND active) THEN RAISE EXCEPTION 'Verify the receiving authorised adult.';END IF;
   UPDATE bts_private.profile_controls SET manager_id=target WHERE profile_id=r.profile_id;
  ELSIF r.kind='record_link' THEN
   target:=public.try_uuid(r.payload->>'record_id');
   IF r.payload->>'table'='application' THEN UPDATE public.audition_applications SET profile_id=r.profile_id WHERE id=target AND profile_id IS NULL;
   ELSIF r.payload->>'table'='booking' THEN UPDATE public.audition_bookings SET profile_id=r.profile_id WHERE id=target AND profile_id IS NULL;ELSE RAISE EXCEPTION 'Unsupported record type.';END IF;
   IF NOT FOUND THEN RAISE EXCEPTION 'Record unavailable or already linked.';END IF;
  ELSIF r.kind='duplicate_profile' THEN
   source:=r.profile_id;target:=public.try_uuid(r.payload->>'target_profile_id');
   SELECT coalesce(c.manager_id,p.user_id) INTO source_owner FROM public.profiles p LEFT JOIN bts_private.profile_controls c ON c.profile_id=p.id WHERE p.id=source;
   SELECT coalesce(c.manager_id,p.user_id) INTO target_owner FROM public.profiles p LEFT JOIN bts_private.profile_controls c ON c.profile_id=p.id WHERE p.id=target;
   IF source=target OR target_owner IS NULL OR NOT source_owner=ANY(p_verified_users) OR NOT target_owner=ANY(p_verified_users) THEN RAISE EXCEPTION 'Verify both profile controllers and the actual identity; never merge by name alone.';END IF;
   IF EXISTS(SELECT 1 FROM bts_private.profile_keys k WHERE k.profile_id=source AND k.active AND NOT k.user_id=ANY(p_verified_users)) THEN RAISE EXCEPTION 'Verify every active source key holder before combining their records.';END IF;
   UPDATE public.audition_applications SET profile_id=target WHERE profile_id=source;UPDATE public.audition_bookings SET profile_id=target WHERE profile_id=source;
   INSERT INTO bts_private.household_profiles SELECT household_id,target FROM bts_private.household_profiles WHERE profile_id=source ON CONFLICT DO NOTHING;
   IF EXISTS(SELECT 1 FROM bts_private.profile_keys WHERE profile_id=source AND active AND kind='self') THEN RAISE EXCEPTION 'Activate the retained adult profile through an identity review before combining a self profile.';END IF;
   IF EXISTS(SELECT 1 FROM public.profiles s JOIN public.profiles t ON t.id=target WHERE s.id=source AND s.date_of_birth IS DISTINCT FROM t.date_of_birth) THEN RAISE EXCEPTION 'Resolve different birth dates before combining profiles.';END IF;
   INSERT INTO bts_private.profile_keys(profile_id,user_id,kind,declared_name,active,consented_at) SELECT target,user_id,kind,declared_name,active,consented_at FROM bts_private.profile_keys WHERE profile_id=source AND active ON CONFLICT(profile_id,user_id) DO UPDATE SET active=true;

   UPDATE bts_private.profile_file_keys SET profile_id=target WHERE profile_id=source;
   UPDATE bts_private.family_audit SET profile_id=target,details=details||jsonb_build_object('merged_from',source) WHERE profile_id=source;
   UPDATE bts_private.family_invites SET state='revoked' WHERE profile_id=source AND state='pending';
   INSERT INTO bts_private.profile_contacts(profile_id,email,user_id,active,confirmed_at,unsubscribe_hash,contact_source) SELECT target,email,user_id,active,confirmed_at,unsubscribe_hash,contact_source FROM bts_private.profile_contacts WHERE profile_id=source ON CONFLICT(profile_id,email) DO NOTHING;
   UPDATE bts_private.profile_keys SET active=false WHERE profile_id=source;UPDATE bts_private.profile_contacts SET active=false WHERE profile_id=source;
   UPDATE public.profiles SET deleted_at=now() WHERE id=source;
  ELSIF r.kind='duplicate_account' THEN
   -- Auth users are not deleted or merged: verify both logins, then deliberately grant a replacement key.
   target:=public.try_uuid(r.payload->>'user_id');IF NOT target=ANY(p_verified_users) THEN RAISE EXCEPTION 'Verify both adult logins before linking them.';END IF;
   IF NOT EXISTS(SELECT 1 FROM bts_private.account_controls WHERE user_id=target AND status='active' AND birth_date<=(current_date-interval '18 years')::date) THEN RAISE EXCEPTION 'The receiving login needs an active adult account.';END IF;
   IF EXISTS(SELECT 1 FROM bts_private.profile_controls c JOIN public.profiles p ON p.id=c.profile_id JOIN bts_private.account_controls a ON a.user_id=target WHERE c.profile_id=r.profile_id AND c.subject_id=r.requester_id AND p.date_of_birth IS DISTINCT FROM a.birth_date) THEN RAISE EXCEPTION 'Resolve different birth dates before linking adult logins.';END IF;
   INSERT INTO bts_private.profile_keys(profile_id,user_id,kind,declared_name) SELECT r.profile_id,target,kind,declared_name FROM bts_private.profile_keys WHERE profile_id=r.profile_id AND user_id=r.requester_id AND active ON CONFLICT(profile_id,user_id) DO UPDATE SET active=true;
   IF NOT FOUND THEN RAISE EXCEPTION 'The requesting login has no active key to link.';END IF;
   UPDATE bts_private.profile_controls SET subject_id=CASE WHEN subject_id=r.requester_id THEN target ELSE subject_id END,manager_id=CASE WHEN manager_id=r.requester_id THEN target ELSE manager_id END WHERE profile_id=r.profile_id;
   INSERT INTO bts_private.profile_contacts(profile_id,email,user_id,unsubscribe_hash,contact_source,confirmed_at) SELECT r.profile_id,lower(u.email),u.id,encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),'account',NULL FROM auth.users u WHERE u.id=target ON CONFLICT(profile_id,email) DO NOTHING;
  END IF;
 END IF;
 UPDATE bts_private.family_reviews SET state=CASE WHEN p_approved THEN 'approved' ELSE 'declined' END,reason=p_reason,resolved_at=now() WHERE id=p_request_id;
 INSERT INTO bts_private.family_audit(profile_id,actor_id,action,details) VALUES(r.profile_id,NULL,'review_resolved',jsonb_build_object('review_id',r.id,'approved',p_approved));
 INSERT INTO bts_private.family_mail(actor_id,recipient,kind,profile_id,payload) SELECT r.requester_id,u.email,'access_review',r.profile_id,jsonb_build_object('approved',p_approved) FROM auth.users u WHERE u.id=r.requester_id;
 RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.bts_family_review_resolve(uuid,boolean,text,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_family_review_resolve(uuid,boolean,text,uuid[]) TO service_role;

-- Financial eligibility follows the existing production tracker, without exposing volunteer identity.
CREATE FUNCTION bts_private.family_volunteer_earned(p_assignment uuid,p_settings jsonb) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH linked AS(SELECT v.portal_token FROM public.casting_assignments a JOIN public.volunteer_signups v ON v.id::text=ANY(a.volunteer_signup_ids) AND v.production_id=a.production_id WHERE a.id=p_assignment), approved AS(SELECT v.* FROM public.volunteer_signups v JOIN public.casting_assignments a ON a.id=p_assignment AND a.production_id=v.production_id WHERE v.portal_token IN(SELECT portal_token FROM linked) AND v.status IN('approved','checked_in','completed')), totals AS(SELECT coalesce(sum(CASE WHEN approved_hours>0 THEN approved_hours WHEN shift_start_time IS NOT NULL AND shift_end_time IS NOT NULL THEN mod(extract(epoch FROM shift_end_time-shift_start_time)::numeric+86400,86400)/3600 ELSE 0 END),0) AS hours FROM approved), required AS(SELECT coalesce(nullif(regexp_replace(coalesce(p_settings->>'volunteer_hours',''),'[^0-9.]','','g'),''),'0')::numeric AS hours)
 SELECT coalesce((SELECT volunteer_discount_approved FROM public.casting_assignments WHERE id=p_assignment),false) OR (EXISTS(SELECT 1 FROM linked) AND (SELECT CASE WHEN r.hours>0 THEN t.hours>=r.hours ELSE t.hours>0 OR EXISTS(SELECT 1 FROM approved) END FROM totals t CROSS JOIN required r));
$$;
REVOKE ALL ON FUNCTION bts_private.family_volunteer_earned(uuid,jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bts_family_tracker(p_profile_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE output jsonb:='[]';a record;hh jsonb;group_key text;seen text[]:='{}';ids uuid[];settings jsonb;bills jsonb;payments jsonb;legacy_payments jsonb;
BEGIN
 IF NOT public.bts_profile_access(p_profile_id) THEN RAISE EXCEPTION 'This performer is not available to your account.';END IF;
 FOR a IN SELECT c.id,c.applicant_id,c.production_id,p.title,p.registration_settings,p.registration_households FROM public.casting_assignments c JOIN public.productions p ON p.id=c.production_id WHERE c.state IN ('chosen','ensemble_manual','offer_accepted') AND (EXISTS(SELECT 1 FROM public.audition_applications x WHERE x.id=c.applicant_id AND x.profile_id=p_profile_id) OR EXISTS(SELECT 1 FROM public.audition_bookings x WHERE x.id=c.applicant_id AND x.profile_id=p_profile_id)) LOOP
  SELECT h INTO hh FROM jsonb_array_elements(coalesce(a.registration_households,'[]')) h WHERE coalesce(h->'member_ids','[]') ? a.id::text OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(h->'members','[]')) m WHERE m->>'assignment_id'=a.id::text OR m->>'applicant_id'=a.applicant_id::text) LIMIT 1;
  group_key:=a.production_id::text||':'||coalesce(hh->>'id',a.id::text);IF group_key=ANY(seen) THEN CONTINUE;END IF;seen:=array_append(seen,group_key);
  SELECT array_agg(DISTINCT x.id) INTO ids FROM public.casting_assignments x WHERE x.production_id=a.production_id AND x.state IN ('chosen','ensemble_manual','offer_accepted') AND (x.id=a.id OR (hh IS NOT NULL AND (coalesce(hh->'member_ids','[]') ? x.id::text OR coalesce(hh->'member_ids','[]') ? x.applicant_id::text OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(hh->'members','[]')) m WHERE m->>'assignment_id'=x.id::text OR m->>'applicant_id'=x.applicant_id::text))));
  settings:=coalesce(a.registration_settings->'payment_settings','{}');
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.id,'volunteer_discount_approved',x.volunteer_discount_approved,'volunteer_discount_earned',bts_private.family_volunteer_earned(x.id,settings),'volunteer_discount_per_child',x.volunteer_discount_per_child,'dropped_out',x.dropped_out,'volunteer_hours_completed',x.volunteer_hours_completed,'scholarship_amount',x.scholarship_amount,'scholarship_status',x.scholarship_status,'household_position',coalesce((SELECT n-1 FROM jsonb_array_elements_text(coalesce(hh->'member_ids','[]')) WITH ORDINALITY q(mid,n) WHERE mid=x.id::text LIMIT 1),0))),'[]') INTO bills FROM (SELECT DISTINCT ON (c.applicant_id) c.* FROM public.casting_assignments c WHERE c.id=ANY(ids) ORDER BY c.applicant_id,CASE WHEN EXISTS(SELECT 1 FROM public.registration_payment_records r WHERE r.casting_assignment_id=c.id) THEN 0 ELSE 1 END,c.created_at) x;
  SELECT coalesce(jsonb_agg(jsonb_build_object('casting_assignment_id',r.casting_assignment_id,'amount_cents',r.amount_cents,'paid_at',r.paid_at,'paid_by',r.paid_by,'installment_index',r.installment_index,'paid',r.paid)),'[]') INTO payments FROM public.registration_payment_records r WHERE r.production_id=a.production_id AND r.casting_assignment_id=ANY(ids);
  SELECT coalesce(jsonb_agg(jsonb_build_object('amount_cents',r.amount_cents,'paid_at',r.paid_at,'paid_by',r.paid_by)),'[]') INTO legacy_payments FROM public.household_payment_logs r WHERE hh IS NOT NULL AND r.production_id=a.production_id AND r.household_id=hh->>'id';
  output:=output||jsonb_build_array(jsonb_build_object('id',group_key,'production_id',a.production_id,'title',a.title,'shared_invoice',hh IS NOT NULL,'settings',settings,'bills',bills,'payments',payments,'legacy_payments',legacy_payments));
 END LOOP;
 RETURN output;
END $$;
REVOKE ALL ON FUNCTION public.bts_family_tracker(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_family_tracker(uuid) TO authenticated;

CREATE FUNCTION bts_private.bind_family_profile_media() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE url text;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW;END IF;
 PERFORM public.bts_bind_profile_file(NEW.id,NEW.headshot_url);
 FOREACH url IN ARRAY coalesce(NEW.headshot_urls,'{}') LOOP PERFORM public.bts_bind_profile_file(NEW.id,url);END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER family_profile_file_binding AFTER INSERT OR UPDATE OF headshot_url,headshot_urls ON public.profiles FOR EACH ROW EXECUTE FUNCTION bts_private.bind_family_profile_media();
CREATE FUNCTION public.bts_family_file_access(p_profile_id uuid,p_url text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.bts_profile_access(p_profile_id) AND EXISTS(SELECT 1 FROM bts_private.profile_file_keys f WHERE f.profile_id=p_profile_id AND split_part(p_url,'?',1)='https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/v1/object/public/'||f.bucket||'/'||f.name);
$$;
REVOKE ALL ON FUNCTION public.bts_family_file_access(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_family_file_access(uuid,text) TO authenticated;

CREATE FUNCTION public.bts_family_unlinked() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT a.id,a.name,p.title AS production,'application' AS type FROM public.audition_applications a JOIN public.productions p ON p.id=a.production_id WHERE a.user_id=auth.uid() AND a.profile_id IS NULL AND public.bts_account_is_active() UNION ALL SELECT a.id,a.name,p.title,'booking' FROM public.audition_bookings a JOIN public.productions p ON p.id=a.production_id WHERE a.user_id=auth.uid() AND a.profile_id IS NULL AND public.bts_account_is_active() LIMIT 100) x;
$$;
REVOKE ALL ON FUNCTION public.bts_family_unlinked() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_family_unlinked() TO authenticated;
CREATE FUNCTION bts_private.family_access_events() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE contact record;
BEGIN
 IF NEW.action NOT IN ('permission_confirmed','invitation_declined','profile_updated','review_resolved','withdraw_permission','activate_profile') OR NEW.profile_id IS NULL THEN RETURN NEW;END IF;
 FOR contact IN SELECT c.email FROM bts_private.profile_contacts c WHERE c.profile_id=NEW.profile_id AND c.active AND (c.user_id IS NULL OR EXISTS(SELECT 1 FROM bts_private.profile_keys k WHERE k.profile_id=c.profile_id AND k.user_id=c.user_id AND k.active)) LOOP
 IF NOT EXISTS(SELECT 1 FROM bts_private.family_mail WHERE profile_id=NEW.profile_id AND recipient=contact.email AND kind='access_changed' AND created_at>now()-interval '5 minutes') THEN
 INSERT INTO bts_private.family_mail(actor_id,recipient,kind,profile_id,payload) VALUES(NEW.actor_id,contact.email,'access_changed',NEW.profile_id,jsonb_build_object('action',NEW.action));
 END IF;
 END LOOP;RETURN NEW;
END $$;
CREATE TRIGGER family_access_notifications AFTER INSERT ON bts_private.family_audit FOR EACH ROW EXECUTE FUNCTION bts_private.family_access_events();
CREATE OR REPLACE FUNCTION public.bts_respond_cast_offer(p_production_id uuid,p_assignment_ids uuid[],p_state text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE changed integer;
BEGIN
 IF p_state NOT IN ('offer_accepted','offer_declined') OR NOT public.bts_account_is_active() OR coalesce(array_length(p_assignment_ids,1),0) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid offer response.'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_assignment_ids) i WHERE NOT EXISTS(SELECT 1 FROM public.casting_assignments a WHERE a.id=i AND a.production_id=p_production_id AND public.bts_owns_audition(a.production_id,a.applicant_id) AND a.state IN ('chosen','ensemble_manual','offer_accepted','offer_declined'))) THEN RAISE EXCEPTION 'This offer does not belong to your account.'; END IF;
 IF EXISTS(SELECT 1 FROM public.casting_assignments a LEFT JOIN public.audition_applications x ON x.id=a.applicant_id LEFT JOIN public.audition_bookings b ON b.id=a.applicant_id WHERE a.id=ANY(p_assignment_ids) AND coalesce(x.profile_id,b.profile_id) IS NOT NULL AND NOT public.bts_profile_can_declare(coalesce(x.profile_id,b.profile_id))) THEN RAISE EXCEPTION 'The adult performer must confirm their own offer; booking help does not authorise accepting personal agreements.';END IF;
 UPDATE public.casting_assignments SET state=p_state WHERE id=ANY(p_assignment_ids) AND production_id=p_production_id;
 GET DIAGNOSTICS changed=ROW_COUNT; RETURN changed;
END $$;

-- The job contains no provider secrets. The public pump accepts no recipients or content.
CREATE FUNCTION bts_private.family_mail_tick() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 -- Turning 18 closes guardian keys immediately through the access helper. This queues one notice.
 INSERT INTO bts_private.family_audit(profile_id,actor_id,action,details)
 SELECT p.id,NULL,'adult_access_ready','{}' FROM public.profiles p JOIN bts_private.profile_controls c ON c.profile_id=p.id
 WHERE c.kind='child' AND p.deleted_at IS NULL AND p.date_of_birth+interval '18 years'<=now() AND p.date_of_birth+interval '18 years'>c.created_at
 AND NOT EXISTS(SELECT 1 FROM bts_private.family_audit a WHERE a.profile_id=p.id AND a.action='adult_access_ready');
 INSERT INTO bts_private.family_mail(actor_id,recipient,kind,profile_id,payload)
 SELECT NULL,u.email,'access_removed',c.profile_id,'{}' FROM bts_private.profile_controls c JOIN bts_private.profile_keys k ON k.profile_id=c.profile_id JOIN auth.users u ON u.id=k.user_id
 WHERE k.kind='guardian' AND k.active AND EXISTS(SELECT 1 FROM bts_private.family_audit a WHERE a.profile_id=c.profile_id AND a.action='adult_access_ready')
 AND NOT EXISTS(SELECT 1 FROM bts_private.family_mail m WHERE m.profile_id=c.profile_id AND m.recipient=u.email AND m.kind='access_removed');
 IF EXISTS(SELECT 1 FROM bts_private.family_mail WHERE state IN ('pending','failed','sending') AND attempts<3) THEN
  PERFORM net.http_post(url:='https://tkmaiktxpwqfbgeojbnf.supabase.co/functions/v1/household-mail',headers:=jsonb_build_object('Content-Type','application/json','apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrbWFpa3R4cHdxZmJnZW9qYm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MzE4MTcsImV4cCI6MjA4OTMwNzgxN30.TkTZBNWUatk3Y6Vmfv1hIRR3DfVjgwauwa76Pf00J_8'),body:='{}'::jsonb);
 END IF;
END $$;
REVOKE ALL ON FUNCTION bts_private.family_mail_tick() FROM PUBLIC,anon,authenticated;
DO $schedule$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_available_extensions WHERE name='pg_cron') THEN
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog';
  IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='bts-household-mail') THEN
   PERFORM cron.schedule('bts-household-mail','* * * * *','SELECT bts_private.family_mail_tick();');
  END IF;
 END IF;
END $schedule$;

CREATE FUNCTION public.bts_family_volunteer_email(p_user_id uuid,p_production_id uuid,p_portal_token uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target text;context jsonb;hits integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM bts_private.account_controls c JOIN auth.users u ON u.id=c.user_id WHERE c.user_id=p_user_id AND c.status='active' AND c.birth_date<=(current_date-interval '18 years')::date AND (u.banned_until IS NULL OR u.banned_until<now())) THEN RETURN NULL;END IF;
 SELECT u.email INTO target FROM auth.users u WHERE u.id=p_user_id;
 SELECT jsonb_build_object('performer_email',target,'volunteer_email',target,'performer_name',min(v.name),'volunteer_role',string_agg(DISTINCT v.role_name,', '),'volunteer_shift_dates',string_agg(DISTINCT coalesce(v.shift_date::text,''),', '),'volunteer_passcode',min(v.volunteer_passcode),'volunteer_portal_url','https://buildtheshow.com/PUBLIC/volunteer-production-page?id='||p_production_id::text||'&view=portal') INTO context FROM public.volunteer_signups v WHERE v.user_id=p_user_id AND v.production_id=p_production_id AND v.portal_token=p_portal_token HAVING count(*)>0;
 IF context IS NULL THEN RETURN NULL;END IF;
 INSERT INTO bts_private.email_rate_windows(user_id,kind,window_start,sent_requests) VALUES(p_user_id,'family_volunteer',date_trunc('hour',now()),1) ON CONFLICT(user_id,kind,window_start) DO UPDATE SET sent_requests=email_rate_windows.sent_requests+1 WHERE email_rate_windows.sent_requests<20 RETURNING sent_requests INTO hits;
 RETURN CASE WHEN hits IS NOT NULL THEN context END;
END $$;
REVOKE ALL ON FUNCTION public.bts_family_volunteer_email(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_family_volunteer_email(uuid,uuid,uuid) TO service_role;

CREATE FUNCTION public.bts_family_queue_template(p_production_id uuid,p_record_id uuid,p_category text,p_subject text,p_html text,p_text text,p_from text,p_reply_to text,p_primary_email text DEFAULT NULL) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_recipient text;profile uuid;message_key text;queued integer:=0;
BEGIN
 IF length(coalesce(p_subject,''))>500 OR length(coalesce(p_html,''))>500000 OR length(coalesce(p_text,''))>500000 THEN RAISE EXCEPTION 'Email content is too large.';END IF;
 IF p_record_id IS NOT NULL THEN
  SELECT profile_id INTO profile FROM public.audition_applications WHERE id=p_record_id AND production_id=p_production_id;
  IF NOT FOUND THEN SELECT profile_id INTO profile FROM public.audition_bookings WHERE id=p_record_id AND production_id=p_production_id;END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Production email record not found.';END IF;
 END IF;
 message_key:=encode(sha256(convert_to(p_production_id::text||coalesce(profile::text,p_record_id::text,'')||p_category,'UTF8')),'hex');
 FOR v_recipient IN SELECT email FROM public.bts_family_recipients(p_production_id,p_record_id) UNION SELECT lower(p_primary_email) WHERE p_record_id IS NULL AND p_primary_email IS NOT NULL LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(message_key||v_recipient,0));
  IF NOT EXISTS(SELECT 1 FROM bts_private.family_mail WHERE kind='production_template' AND payload->>'message_key'=message_key AND family_mail.recipient=v_recipient AND created_at>now()-interval '10 minutes') THEN
   INSERT INTO bts_private.family_mail(recipient,kind,profile_id,payload) VALUES(v_recipient,'production_template',profile,jsonb_build_object('message_key',message_key,'production_id',p_production_id,'record_id',p_record_id,'category',p_category,'subject',p_subject,'html',p_html,'text',p_text,'from',p_from,'reply_to',p_reply_to));queued:=queued+1;
  END IF;
 END LOOP;
 RETURN queued;
END $$;
REVOKE ALL ON FUNCTION public.bts_family_queue_template(uuid,uuid,text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_family_queue_template(uuid,uuid,text,text,text,text,text,text,text) TO service_role;

-- This webhook points at a retired function; the durable family outbox now owns booking confirmation dispatch.
DROP TRIGGER IF EXISTS "on-audition-booked" ON public.audition_bookings;

CREATE FUNCTION bts_private.family_profile_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN INSERT INTO bts_private.family_audit(profile_id,actor_id,action) VALUES(NEW.id,auth.uid(),'profile_updated');END IF;RETURN NEW;
END $$;
CREATE TRIGGER family_profile_audit AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION bts_private.family_profile_audit();
CREATE FUNCTION bts_private.family_key_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.active AND NOT NEW.active THEN
  INSERT INTO bts_private.family_mail(actor_id,recipient,kind,profile_id,payload) SELECT auth.uid(),u.email,'access_removed',NEW.profile_id,jsonb_build_object('performer',p.credit_name) FROM auth.users u JOIN public.profiles p ON p.id=NEW.profile_id WHERE u.id=NEW.user_id;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER family_key_audit AFTER UPDATE ON bts_private.profile_keys FOR EACH ROW EXECUTE FUNCTION bts_private.family_key_audit();
INSERT INTO bts_private.profile_file_keys(bucket,name,profile_id,created_by)
SELECT 'profile-headshots',split_part(split_part(p.headshot_url,'/profile-headshots/',2),'?',1),p.id,p.user_id FROM public.profiles p WHERE p.user_id IS NOT NULL AND p.headshot_url LIKE 'https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/v1/object/public/profile-headshots/'||p.user_id::text||'/%' ON CONFLICT DO NOTHING;

-- Existing explicitly linked files are bound only to their stored creator folder.
INSERT INTO bts_private.profile_file_keys(bucket,name,profile_id,created_by)
SELECT 'profile-headshots',split_part(split_part(url,'/profile-headshots/',2),'?',1),p.id,p.user_id FROM public.profiles p CROSS JOIN LATERAL unnest(coalesce(p.headshot_urls,'{}')) url WHERE p.user_id IS NOT NULL AND url LIKE 'https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/v1/object/public/profile-headshots/'||p.user_id::text||'/%' ON CONFLICT DO NOTHING;
INSERT INTO bts_private.profile_file_keys(bucket,name,profile_id,created_by)
SELECT 'profile-headshots',split_part(split_part(url,'/profile-headshots/',2),'?',1),a.profile_id,a.user_id FROM (SELECT profile_id,user_id,headshot_url AS url FROM public.audition_applications UNION ALL SELECT profile_id,user_id,file_url FROM public.audition_applications UNION ALL SELECT profile_id,user_id,headshot_url FROM public.audition_bookings) a WHERE a.profile_id IS NOT NULL AND a.user_id IS NOT NULL AND url LIKE 'https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/v1/object/public/profile-headshots/'||a.user_id::text||'/%' ON CONFLICT DO NOTHING;
-- Payment history remains in the existing staff-controlled ledger.
CREATE FUNCTION bts_private.family_payment_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE row_data jsonb;v_profile uuid;contact record;
BEGIN
 row_data:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 SELECT coalesce(a.profile_id,b.profile_id) INTO v_profile FROM public.casting_assignments c LEFT JOIN public.audition_applications a ON a.id=c.applicant_id LEFT JOIN public.audition_bookings b ON b.id=c.applicant_id WHERE c.id=public.try_uuid(row_data->>'casting_assignment_id');
 IF v_profile IS NULL THEN RETURN NULL;END IF;
 INSERT INTO bts_private.family_audit(profile_id,actor_id,action,details) VALUES(v_profile,auth.uid(),'payment_updated',jsonb_build_object('operation',TG_OP,'payment_id',row_data->>'id'));
 FOR contact IN SELECT DISTINCT r.email FROM public.casting_assignments c CROSS JOIN LATERAL public.bts_family_recipients(c.production_id,c.applicant_id) r WHERE c.id=public.try_uuid(row_data->>'casting_assignment_id') LOOP
  IF NOT EXISTS(SELECT 1 FROM bts_private.family_mail WHERE profile_id=v_profile AND recipient=contact.email AND kind='payment_updated' AND created_at>now()-interval '5 minutes') THEN INSERT INTO bts_private.family_mail(actor_id,recipient,kind,profile_id) VALUES(auth.uid(),contact.email,'payment_updated',v_profile);END IF;
 END LOOP;RETURN NULL;
END $$;
CREATE TRIGGER family_payment_events AFTER INSERT OR UPDATE OR DELETE ON public.registration_payment_records FOR EACH ROW EXECUTE FUNCTION bts_private.family_payment_event();
CREATE INDEX family_keys_user ON bts_private.profile_keys(user_id,profile_id) WHERE active;
CREATE INDEX family_controls_manager ON bts_private.profile_controls(manager_id);
CREATE INDEX family_household_member_user ON bts_private.household_members(user_id);
CREATE INDEX family_audit_profile ON bts_private.family_audit(profile_id,created_at DESC);
CREATE INDEX family_invites_sender ON bts_private.family_invites(sender_id,created_at);
CREATE INDEX family_reviews_requester ON bts_private.family_reviews(requester_id,created_at);
CREATE INDEX family_app_profile ON public.audition_applications(profile_id,production_id) WHERE profile_id IS NOT NULL;
CREATE INDEX family_booking_profile ON public.audition_bookings(profile_id,production_id,session_id) WHERE profile_id IS NOT NULL;
-- Explicit grants avoid inherited hosted defaults broadening the browser surface.
REVOKE ALL ON FUNCTION public.bts_profile_access(uuid,boolean),public.bts_profile_manager(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_profile_access(uuid,boolean),public.bts_profile_manager(uuid) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
