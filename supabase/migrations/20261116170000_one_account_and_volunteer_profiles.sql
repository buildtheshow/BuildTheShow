-- One adult identity, explicit accepted memberships, and profile-owned volunteer activity.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='90s';

CREATE TABLE bts_private.production_team_accounts (
 team_member_id uuid PRIMARY KEY REFERENCES public.production_team_members(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id),
 accepted_email text NOT NULL,
 accepted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX production_team_accounts_user ON bts_private.production_team_accounts(user_id);
CREATE TABLE bts_private.production_team_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 team_member_id uuid NOT NULL REFERENCES public.production_team_members(id) ON DELETE CASCADE,
 sender_id uuid NOT NULL REFERENCES auth.users(id),
 email text NOT NULL,
 token_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 accepted_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON bts_private.production_team_accounts,bts_private.production_team_invitations FROM PUBLIC,anon,authenticated;
-- Preserve only an already demonstrated account/session binding; email alone grants nothing.
INSERT INTO bts_private.production_team_accounts(team_member_id,user_id,accepted_email)
SELECT m.id,min(s.auth_user_id::text)::uuid,lower(trim(m.email))
FROM public.production_team_members m JOIN public.production_team_member_sessions s ON s.team_member_id=m.id AND s.production_id=m.production_id
JOIN auth.users u ON u.id=s.auth_user_id AND lower(trim(u.email))=lower(trim(m.email))
WHERE m.is_active AND s.revoked_at IS NULL AND s.auth_user_id IS NOT NULL
GROUP BY m.id HAVING count(DISTINCT s.auth_user_id)=1;

CREATE FUNCTION public.bts_invite_production_member(p_member_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.production_team_members%rowtype; v_token text:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''); v_id uuid;
BEGIN
 IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with your adult account.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':team-invitations',0));
 SELECT * INTO m FROM public.production_team_members WHERE id=p_member_id AND is_active;
 IF m.id IS NULL OR NOT (public.bts_production_page_permission(m.production_id,'production_team',2) OR lower(trim(m.email))=public.bts_current_account_email()) THEN RAISE EXCEPTION 'Production team management permission is required.';END IF;
 IF m.email IS NULL OR m.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Enter the invited adult email first.';END IF;
 IF (SELECT count(*) FROM bts_private.production_team_invitations WHERE sender_id=auth.uid() AND created_at>now()-interval '1 hour')>=20 THEN RAISE EXCEPTION 'Invitation limit reached. Try again later.';END IF;
 UPDATE bts_private.production_team_invitations SET revoked_at=now() WHERE team_member_id=m.id AND accepted_at IS NULL AND revoked_at IS NULL;
 INSERT INTO bts_private.production_team_invitations(team_member_id,sender_id,email,token_hash) VALUES(m.id,auth.uid(),lower(trim(m.email)),encode(sha256(convert_to(v_token,'UTF8')),'hex')) RETURNING id INTO v_id;
 INSERT INTO bts_private.family_mail(actor_id,recipient,kind,payload) VALUES(auth.uid(),lower(trim(m.email)),'team_invitation',jsonb_build_object('invite_id',v_id,'token',v_token,'production_id',m.production_id,'production',(SELECT title FROM public.productions WHERE id=m.production_id)));
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.bts_invite_production_member(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_invite_production_member(uuid) TO authenticated;

CREATE FUNCTION public.bts_production_invitation(p_token text,p_accept boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE invitation bts_private.production_team_invitations%rowtype; m public.production_team_members%rowtype;
BEGIN
 IF p_token !~ '^[0-9a-f]{64}$' OR p_token IS NULL THEN RAISE EXCEPTION 'Invitation unavailable.';END IF;
 SELECT * INTO invitation FROM bts_private.production_team_invitations WHERE token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') FOR UPDATE;
 IF invitation.id IS NULL OR invitation.revoked_at IS NOT NULL OR invitation.accepted_at IS NOT NULL OR invitation.expires_at<=now() THEN RAISE EXCEPTION 'This invitation expired or was already used. Ask for a new invitation.';END IF;
 SELECT * INTO m FROM public.production_team_members WHERE id=invitation.team_member_id AND is_active AND lower(trim(email))=invitation.email;
 IF m.id IS NULL THEN RAISE EXCEPTION 'The invited position changed. Ask for a new invitation.';END IF;
 IF p_accept THEN
  IF NOT public.bts_account_is_active() OR invitation.email IS DISTINCT FROM public.bts_current_account_email() THEN RAISE EXCEPTION 'Sign in with the invited email and an active adult account.';END IF;
  IF EXISTS(SELECT 1 FROM bts_private.production_team_accounts WHERE team_member_id=m.id AND user_id<>auth.uid()) THEN RAISE EXCEPTION 'This membership belongs to another account. Request an operator review.';END IF;
  INSERT INTO bts_private.production_team_accounts VALUES(m.id,auth.uid(),invitation.email,now()) ON CONFLICT(team_member_id) DO UPDATE SET accepted_at=now(),accepted_email=excluded.accepted_email;
  UPDATE bts_private.production_team_invitations SET accepted_at=now() WHERE id=invitation.id;
  INSERT INTO bts_private.family_audit(actor_id,action,details) VALUES(auth.uid(),'production_membership_accepted',jsonb_build_object('team_member_id',m.id,'production_id',m.production_id));
 END IF;
 RETURN jsonb_build_object('production_id',m.production_id,'production',(SELECT title FROM public.productions WHERE id=m.production_id),'position',m.role,'email',invitation.email,'accepted',p_accept);
END $$;
REVOKE ALL ON FUNCTION public.bts_production_invitation(text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_production_invitation(text,boolean) TO anon,authenticated;

CREATE FUNCTION public.bts_open_production(p_production_id uuid,p_member_id uuid DEFAULT NULL)
RETURNS TABLE(session_token text,expires_at timestamptz,team_member public.production_team_members)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.production_team_members%rowtype; secret text; expiry timestamptz;
BEGIN
 IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with your adult account.';END IF;
 SELECT t.* INTO m FROM public.production_team_members t JOIN bts_private.production_team_accounts a ON a.team_member_id=t.id
 WHERE t.production_id=p_production_id AND t.is_active AND a.user_id=auth.uid() AND lower(trim(t.email))=a.accepted_email
 AND (p_member_id IS NULL OR t.id=p_member_id) ORDER BY a.accepted_at,t.id LIMIT 1;
 IF m.id IS NULL THEN RAISE EXCEPTION 'No accepted team membership is available. Accept your email invitation or ask the production owner for access.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||m.id::text,0));
 SELECT s.session_token,s.expires_at INTO secret,expiry FROM public.production_team_member_sessions s WHERE s.production_id=p_production_id AND s.team_member_id=m.id AND s.auth_user_id=auth.uid() AND s.revoked_at IS NULL AND s.expires_at>now()+interval '5 minutes' ORDER BY s.expires_at DESC LIMIT 1;
 IF secret IS NULL THEN
  secret:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');expiry:=now()+interval '8 hours';
  INSERT INTO public.production_team_member_sessions(production_id,team_member_id,session_token,expires_at,auth_user_id) VALUES(p_production_id,m.id,secret,expiry,auth.uid());
 END IF;
 RETURN QUERY SELECT secret,expiry,m;
END $$;
REVOKE ALL ON FUNCTION public.bts_open_production(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_open_production(uuid,uuid) TO authenticated;
-- The column remains solely for historical row/RPC compatibility; new entries need no code.
ALTER TABLE public.production_team_members ALTER COLUMN passcode DROP NOT NULL;
-- Retain a callable compatibility signature without retaining code-based authentication.
CREATE OR REPLACE FUNCTION public.team_member_start_session(p_production_id uuid,p_email text,p_passcode text,p_user_agent text DEFAULT NULL)
RETURNS TABLE(session_token text,expires_at timestamptz,team_member public.production_team_members)
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT * FROM public.bts_open_production(p_production_id);$$;

ALTER TABLE public.volunteer_signups ADD COLUMN profile_id uuid REFERENCES public.profiles(id);
ALTER TABLE public.volunteer_signups ADD COLUMN discount_profile_id uuid REFERENCES public.profiles(id);
CREATE INDEX volunteer_profile_production ON public.volunteer_signups(profile_id,production_id);
ALTER TABLE bts_private.profile_keys ADD COLUMN volunteer_consent_at timestamptz;
ALTER TABLE bts_private.family_invites ADD COLUMN volunteer_help boolean NOT NULL DEFAULT false;
CREATE FUNCTION public.bts_volunteer_profile_access(p_profile_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.bts_profile_access(p_profile_id) AND EXISTS(SELECT 1 FROM bts_private.profile_keys k WHERE k.profile_id=p_profile_id AND k.user_id=auth.uid() AND k.active AND (k.kind IN('self','guardian') OR k.volunteer_consent_at IS NOT NULL));
$$;
REVOKE ALL ON FUNCTION public.bts_volunteer_profile_access(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_volunteer_profile_access(uuid) TO authenticated;
CREATE FUNCTION public.bts_owns_volunteer(p_signup_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.bts_account_is_active() AND EXISTS(SELECT 1 FROM public.volunteer_signups v WHERE v.id=p_signup_id AND ((v.profile_id IS NULL AND v.user_id=auth.uid()) OR public.bts_volunteer_profile_access(v.profile_id)));
$$;
REVOKE ALL ON FUNCTION public.bts_owns_volunteer(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_owns_volunteer(uuid) TO authenticated;

CREATE OR REPLACE VIEW public.bts_participant_volunteers WITH(security_barrier=true) AS
SELECT id,production_id,user_id,portal_token,name,email,phone,notes,status,role_name,department,shift_date,shift_start_time,shift_end_time,approved_hours,discount_requested,discount_performer,created_at,check_in_with,first_name,last_name,volunteer_name,volunteer_email,message,required_dates,volunteer_passcode,portal_invite_sent_at,no_email,profile_id,discount_profile_id
FROM public.volunteer_signups WHERE public.bts_account_is_active() AND (public.bts_owns_volunteer(id) OR public.bts_production_page_permission(production_id,'volunteers',1)) WITH LOCAL CHECK OPTION;
REVOKE ALL ON public.bts_participant_volunteers FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON public.bts_participant_volunteers TO authenticated;

CREATE OR REPLACE FUNCTION bts_private.guard_volunteer_account() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE k text;
BEGIN
 IF current_user NOT IN('anon','authenticated') THEN RETURN NEW;END IF;
 IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'An active adult account is required.';END IF;
 IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.production_id IS DISTINCT FROM OLD.production_id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.portal_token IS DISTINCT FROM OLD.portal_token OR NEW.profile_id IS DISTINCT FROM OLD.profile_id OR NEW.discount_profile_id IS DISTINCT FROM OLD.discount_profile_id) THEN RAISE EXCEPTION 'Use the reviewed linking process to change volunteer ownership or discount connections.';END IF;
 IF public.bts_production_page_permission(NEW.production_id,'volunteers',2) THEN
  IF TG_OP='UPDATE' AND (NEW.guardian_details IS DISTINCT FROM OLD.guardian_details OR NEW.guardian_consent_at IS DISTINCT FROM OLD.guardian_consent_at OR NEW.guardian_consent_version IS DISTINCT FROM OLD.guardian_consent_version) THEN RAISE EXCEPTION 'Guardian declarations cannot be rewritten by staff.';END IF;
  IF TG_OP='INSERT' AND (NEW.user_id IS NOT NULL OR NEW.profile_id IS NOT NULL OR NEW.guardian_consent_at IS NOT NULL) THEN RAISE EXCEPTION 'Use an accepted profile permission; staff cannot impersonate another adult.';END IF;
  RETURN NEW;
 END IF;
 IF TG_OP<>'UPDATE' OR NOT public.bts_owns_volunteer(OLD.id) THEN RAISE EXCEPTION 'This volunteer request is not available to your account.';END IF;
 FOR k IN SELECT key FROM jsonb_each(to_jsonb(NEW)) LOOP
  IF to_jsonb(NEW)->k IS DISTINCT FROM to_jsonb(OLD)->k AND k NOT IN('phone','notes','message','status') THEN RAISE EXCEPTION 'Only production staff can change assignments or confirmed hours. Identity changes use the profile.';END IF;
 END LOOP;
 IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status<>'cancelled' THEN RAISE EXCEPTION 'Only production staff can approve volunteer requests.';END IF;
 RETURN NEW;
END $$;

-- Extend the existing capability gateway; no additional adult account type is introduced.
ALTER FUNCTION public.bts_family(text,jsonb) SET SCHEMA bts_private;
ALTER FUNCTION bts_private.bts_family(text,jsonb) RENAME TO family_before_unified_accounts;
REVOKE ALL ON FUNCTION bts_private.family_before_unified_accounts(text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bts_family(p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; v_profile uuid; v_id uuid;
BEGIN
 IF p_action IN('preview','accept','decline') AND EXISTS(SELECT 1 FROM bts_private.family_invites WHERE token_hash=encode(sha256(convert_to(p_data->>'token','UTF8')),'hex') AND kind='volunteer_claim') THEN RAISE EXCEPTION 'Open this volunteer confirmation through My Home.';END IF;
 IF p_action='allow_volunteer_help' THEN
  IF p_data->>'confirmed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Confirm volunteer signup permission.';END IF;
  SELECT c.profile_id INTO v_profile FROM bts_private.profile_contacts c JOIN bts_private.profile_controls x ON x.profile_id=c.profile_id WHERE c.unsubscribe_hash=encode(sha256(convert_to(p_data->>'token','UTF8')),'hex') AND x.kind='adult' AND x.consent_state='active' AND EXISTS(SELECT 1 FROM bts_private.family_invites i WHERE i.profile_id=c.profile_id AND i.kind='delegate' AND i.state='accepted' AND i.email=c.email);
  IF v_profile IS NULL THEN RAISE EXCEPTION 'Use the adult performer permission receipt.';END IF;
  UPDATE bts_private.profile_keys SET volunteer_consent_at=now() WHERE profile_id=v_profile AND kind='delegate' AND active;
  INSERT INTO bts_private.family_audit(profile_id,actor_id,action) VALUES(v_profile,auth.uid(),'volunteer_help_confirmed');RETURN jsonb_build_object('ok',true);
 END IF;
 IF p_action='review' AND p_data->>'kind'='volunteer_link' THEN
  v_profile:=public.try_uuid(p_data->>'profile_id');
  IF NOT public.bts_volunteer_profile_access(v_profile) OR length(coalesce(p_data->>'explanation',''))<10 THEN RAISE EXCEPTION 'Choose an authorised volunteer profile and explain the historical link.';END IF;
  INSERT INTO bts_private.family_reviews(requester_id,kind,profile_id,payload) VALUES(auth.uid(),'volunteer_link',v_profile,p_data) RETURNING id INTO v_id;RETURN jsonb_build_object('id',v_id);
 END IF;
 result:=bts_private.family_before_unified_accounts(p_action,p_data);
 IF p_action='invite' AND p_data->>'kind'='delegate_key' THEN UPDATE bts_private.family_invites SET volunteer_help=coalesce((p_data->>'volunteer_help')::boolean,false) WHERE id=(result->>'id')::uuid AND sender_id=auth.uid();END IF;
 IF p_action='accept' THEN
  SELECT i.profile_id INTO v_profile FROM bts_private.family_invites i WHERE i.token_hash=encode(sha256(convert_to(p_data->>'token','UTF8')),'hex') AND i.kind='delegate_key' AND i.state='accepted' AND i.volunteer_help;
  UPDATE bts_private.profile_keys SET volunteer_consent_at=now() WHERE profile_id=v_profile AND user_id=auth.uid() AND kind='delegate' AND active;
 END IF;
 IF p_action='accept' AND p_data->>'volunteer_help'='true' THEN
  SELECT i.profile_id INTO v_profile FROM bts_private.family_invites i WHERE i.token_hash=encode(sha256(convert_to(p_data->>'token','UTF8')),'hex') AND i.kind='delegate' AND i.state='accepted';
  UPDATE bts_private.profile_keys SET volunteer_consent_at=now() WHERE profile_id=v_profile AND kind='delegate' AND active;
 ELSIF p_action='withdraw_permission' THEN
  SELECT c.profile_id INTO v_profile FROM bts_private.profile_contacts c WHERE c.unsubscribe_hash=encode(sha256(convert_to(p_data->>'token','UTF8')),'hex');
  UPDATE bts_private.profile_keys SET volunteer_consent_at=NULL WHERE profile_id=v_profile AND kind='delegate';
 END IF;
 IF p_action='snapshot' THEN
  result:=jsonb_set(result,'{profiles}',coalesce((SELECT jsonb_agg(p||jsonb_build_object('can_volunteer',public.bts_volunteer_profile_access((p->>'id')::uuid))) FROM jsonb_array_elements(result->'profiles') p),'[]'));
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.bts_family(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_family(text,jsonb) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.bts_request_volunteer_shifts(p_production_id uuid,p_rows jsonb,p_guardian_details text DEFAULT NULL,p_guardian_confirmed boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb; person public.profiles%rowtype; v_profile uuid; v_discount uuid; v_token uuid; v_ids uuid[]:='{}'; v_id uuid; v_group uuid; v_guardian text;
BEGIN
 IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with your adult account.';END IF;
 IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Choose between 1 and 50 shifts.';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.productions WHERE id=p_production_id AND is_public AND page_status IN('live','hidden')) THEN RAISE EXCEPTION 'This production is not accepting volunteer requests.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_production_id::text,0));
 IF (SELECT count(*) FROM public.volunteer_signups WHERE user_id=auth.uid() AND created_at>now()-interval '1 hour')+jsonb_array_length(p_rows)>100 THEN RAISE EXCEPTION 'Request limit reached. Try again later.';END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  v_profile:=public.try_uuid(r->>'profile_id');v_discount:=public.try_uuid(r->>'discount_profile_id');
  IF NOT public.bts_volunteer_profile_access(v_profile) THEN RAISE EXCEPTION 'Choose an authorised volunteer profile. An adult helper needs explicit volunteer permission.';END IF;
  IF length(r::text)>10000 OR nullif(trim(r->>'role_name'),'') IS NULL THEN RAISE EXCEPTION 'Choose a volunteer role.';END IF;
  SELECT * INTO person FROM public.profiles WHERE id=v_profile;
  IF v_discount IS NOT NULL AND (NOT public.bts_profile_access(v_discount) OR NOT EXISTS(SELECT 1 FROM public.audition_applications a WHERE a.production_id=p_production_id AND a.profile_id=v_discount UNION ALL SELECT 1 FROM public.audition_bookings a WHERE a.production_id=p_production_id AND a.profile_id=v_discount)) THEN RAISE EXCEPTION 'Choose a registration already connected to an authorised profile in this production.';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_profile::text||p_production_id::text||coalesce(r->>'role_name',''),0));
  IF EXISTS(SELECT 1 FROM public.volunteer_signups v WHERE v.profile_id=v_profile AND v.production_id=p_production_id AND v.role_name=r->>'role_name' AND v.shift_date IS NOT DISTINCT FROM nullif(r->>'shift_date','')::date AND v.shift_start_time IS NOT DISTINCT FROM nullif(r->>'shift_start_time','')::time AND v.status<>'cancelled') THEN RAISE EXCEPTION 'This person already requested this shift. Open My Shifts to review it.';END IF;
  SELECT portal_token INTO v_group FROM public.volunteer_signups WHERE profile_id=v_profile AND production_id=p_production_id ORDER BY created_at LIMIT 1;
  v_group:=coalesce(v_group,gen_random_uuid());v_token:=coalesce(v_token,v_group);
  v_guardian:=CASE WHEN person.date_of_birth>(current_date-interval '18 years')::date THEN public.bts_current_guardian_name(v_profile) END;
  INSERT INTO public.volunteer_signups(production_id,user_id,profile_id,discount_profile_id,portal_token,volunteer_passcode,status,name,email,phone,notes,role_name,department,check_in_with,shift_date,shift_start_time,shift_end_time,required_dates,discount_requested,discount_performer,approved_hours,guardian_details,guardian_consent_at,guardian_consent_version)
  VALUES(p_production_id,auth.uid(),v_profile,v_discount,v_group,NULL,'pending',coalesce(person.credit_name,person.name),public.bts_current_account_email(),r->>'phone',r->>'notes',r->>'role_name',r->>'department',r->>'check_in_with',nullif(r->>'shift_date','')::date,nullif(r->>'shift_start_time','')::time,nullif(r->>'shift_end_time','')::time,ARRAY(SELECT jsonb_array_elements_text(coalesce(r->'required_dates','[]'))),v_discount IS NOT NULL,CASE WHEN v_discount IS NOT NULL THEN (SELECT credit_name FROM public.profiles WHERE id=v_discount) END,NULL,v_guardian,CASE WHEN v_guardian IS NOT NULL THEN now() END,CASE WHEN v_guardian IS NOT NULL THEN '2026-11-16' END) RETURNING id INTO v_id;
  v_ids:=array_append(v_ids,v_id);
 END LOOP;
 RETURN jsonb_build_object('ids',v_ids,'portal_token',v_token,'email',public.bts_current_account_email(),'count',cardinality(v_ids));
END $$;

CREATE FUNCTION public.bts_my_home(p_production_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE profiles jsonb; activities jsonb; volunteers jsonb; organisations jsonb; management jsonb; events jsonb; shows jsonb;
BEGIN
 IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with your adult account.';END IF;
 profiles:=public.bts_family('snapshot')->'profiles';
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO volunteers FROM(
  SELECT v.id,v.production_id,v.profile_id,v.discount_profile_id,v.name,v.role_name,v.department,v.shift_date,v.shift_start_time,v.shift_end_time,v.required_dates,v.status,v.approved_hours,v.portal_token,v.phone,v.notes,v.created_at,p.title,p.slug AS production_slug,o.slug AS organisation_slug
  FROM public.volunteer_signups v JOIN public.productions p ON p.id=v.production_id JOIN public.organizations o ON o.id=p.organization_id
  WHERE public.bts_owns_volunteer(v.id) AND (p_production_id IS NULL OR v.production_id=p_production_id) ORDER BY v.shift_date NULLS LAST,v.created_at DESC
 )x;
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO activities FROM(
  SELECT 'application' AS type,a.id,a.production_id,a.profile_id,a.name,a.status,a.session_id,a.time_slot_id AS slot_id,a.custom_answers,a.booking_id FROM public.bts_participant_applications a WHERE public.bts_owns_audition(a.production_id,a.id) AND (p_production_id IS NULL OR a.production_id=p_production_id)
  UNION ALL SELECT 'booking',a.id,a.production_id,a.profile_id,a.name,a.status,a.session_id,a.slot_id,a.custom_answers,NULL::uuid FROM public.bts_participant_bookings a WHERE public.bts_owns_audition(a.production_id,a.id) AND (p_production_id IS NULL OR a.production_id=p_production_id)
 )x;
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO shows FROM(
  SELECT p.id,p.title,p.slug,o.slug AS organisation_slug,p.start_date,p.end_date FROM public.productions p JOIN public.organizations o ON o.id=p.organization_id WHERE p.id IN(SELECT (a->>'production_id')::uuid FROM jsonb_array_elements(activities) a UNION SELECT (v->>'production_id')::uuid FROM jsonb_array_elements(volunteers) v)
 )x;
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO organisations FROM(
  SELECT o.id,o.name,o.slug,public.bts_organisation_role(o.id) AS access FROM public.organizations o WHERE public.bts_organisation_role(o.id) IS NOT NULL
 )x;
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO management FROM(
  SELECT p.id,p.title,p.slug,p.organization_id,o.slug AS organisation_slug,public.bts_organisation_role(o.id) AS organisation_access,t.id AS team_member_id,t.role AS position
  FROM public.productions p JOIN public.organizations o ON o.id=p.organization_id
  LEFT JOIN public.production_team_members t ON t.production_id=p.id AND t.is_active AND EXISTS(SELECT 1 FROM bts_private.production_team_accounts a WHERE a.team_member_id=t.id AND a.user_id=auth.uid() AND a.accepted_email=lower(trim(t.email)))
  WHERE (public.bts_organisation_role(o.id) IS NOT NULL OR t.id IS NOT NULL) AND (p_production_id IS NULL OR p.id=p_production_id)
 )x;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'production_id',e.production_id,'title',e.title,'event_type',e.event_type,'start_time',e.start_time,'end_time',e.end_time,'venue',e.venue)),'[]') INTO events FROM public.bts_visible_production_events e WHERE e.production_id IN(SELECT (p->>'id')::uuid FROM jsonb_array_elements(shows) p) AND e.start_time>=now()-interval '1 day' AND e.start_time<now()+interval '90 days';
 RETURN jsonb_build_object('profiles',profiles,'volunteers',volunteers,'activities',activities,'productions',shows,'organisations',organisations,'management',management,'events',events);
END $$;
REVOKE ALL ON FUNCTION public.bts_my_home(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_my_home(uuid) TO authenticated;

-- Child keys, withdrawal and deleted profiles also govern volunteer confirmations.
CREATE OR REPLACE FUNCTION public.bts_family_volunteer_email(p_user_id uuid,p_production_id uuid,p_portal_token uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email text; result jsonb; hits integer;
BEGIN
 SELECT lower(u.email) INTO v_email FROM auth.users u JOIN bts_private.account_controls c ON c.user_id=u.id WHERE u.id=p_user_id AND c.status='active' AND c.birth_date<=(current_date-interval '18 years')::date;
 IF v_email IS NULL THEN RETURN NULL;END IF;
 SELECT jsonb_build_object('performer_email',v_email,'volunteer_email',v_email,'performer_name',min(v.name),'volunteer_role',string_agg(DISTINCT v.role_name,', '),'volunteer_shift_dates',string_agg(DISTINCT coalesce(v.shift_date::text,''),', '),'volunteer_portal_url','https://buildtheshow.com/activities?production='||p_production_id::text) INTO result FROM public.volunteer_signups v WHERE v.user_id=p_user_id AND v.production_id=p_production_id AND v.portal_token=p_portal_token AND (v.profile_id IS NULL OR EXISTS(SELECT 1 FROM bts_private.profile_keys k JOIN bts_private.profile_controls c ON c.profile_id=k.profile_id JOIN public.profiles p ON p.id=k.profile_id WHERE k.profile_id=v.profile_id AND k.user_id=p_user_id AND k.active AND c.consent_state='active' AND p.deleted_at IS NULL AND (k.kind<>'guardian' OR p.date_of_birth>(current_date-interval '18 years')::date) AND (k.kind<>'delegate' OR k.volunteer_consent_at IS NOT NULL))) HAVING count(*)>0;
 IF result IS NULL THEN RETURN NULL;END IF;
 INSERT INTO bts_private.email_rate_windows(user_id,kind,window_start,sent_requests) VALUES(p_user_id,'family_volunteer',date_trunc('hour',now()),1) ON CONFLICT(user_id,kind,window_start) DO UPDATE SET sent_requests=email_rate_windows.sent_requests+1 WHERE email_rate_windows.sent_requests<20 RETURNING sent_requests INTO hits;
 RETURN CASE WHEN hits IS NULL THEN NULL ELSE result END;
END $$;

-- Confirmed staff-entered hours are the hour source. Scheduled duration never proves attendance.
CREATE OR REPLACE FUNCTION bts_private.family_volunteer_earned(p_assignment uuid,p_settings jsonb) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH linked AS(SELECT v.portal_token,v.profile_id FROM public.casting_assignments a JOIN public.volunteer_signups v ON v.id::text=ANY(a.volunteer_signup_ids) AND v.production_id=a.production_id WHERE a.id=p_assignment), totals AS(SELECT coalesce(sum(greatest(v.approved_hours,0)),0) AS hours FROM public.volunteer_signups v JOIN public.casting_assignments a ON a.id=p_assignment AND a.production_id=v.production_id WHERE ((v.profile_id IS NOT NULL AND v.profile_id IN(SELECT profile_id FROM linked)) OR (v.profile_id IS NULL AND v.id::text=ANY(a.volunteer_signup_ids))) AND v.status IN('approved','checked_in','completed')), required AS(SELECT coalesce(nullif(regexp_replace(coalesce(p_settings->>'volunteer_hours',''),'[^0-9.]','','g'),''),'0')::numeric AS hours)
 SELECT coalesce((SELECT volunteer_discount_approved FROM public.casting_assignments WHERE id=p_assignment),false) OR (SELECT CASE WHEN r.hours>0 THEN t.hours>=r.hours ELSE t.hours>0 END FROM totals t CROSS JOIN required r);
$$;

-- Confirmed notification contacts receive updates without needing a login or a management key.
CREATE FUNCTION bts_private.volunteer_contact_eligible(p_profile uuid,p_email text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM bts_private.profile_contacts c JOIN bts_private.profile_controls x ON x.profile_id=c.profile_id JOIN public.profiles p ON p.id=c.profile_id
 WHERE c.profile_id=p_profile AND c.email=p_email AND c.active AND c.confirmed_at IS NOT NULL AND x.consent_state='active' AND p.deleted_at IS NULL AND (
 EXISTS(SELECT 1 FROM bts_private.profile_keys k WHERE k.profile_id=c.profile_id AND k.user_id=c.user_id AND k.active AND (k.kind<>'guardian' OR p.date_of_birth>(current_date-interval '18 years')::date) AND (k.kind<>'delegate' OR k.volunteer_consent_at IS NOT NULL))
 OR EXISTS(SELECT 1 FROM bts_private.family_invites i WHERE i.profile_id=c.profile_id AND i.email=c.email AND i.kind='contact' AND i.state='accepted')
 OR (c.user_id IS NULL AND EXISTS(SELECT 1 FROM bts_private.profile_keys k WHERE k.profile_id=c.profile_id AND k.active AND k.kind='delegate' AND k.volunteer_consent_at IS NOT NULL) AND EXISTS(SELECT 1 FROM bts_private.family_invites i WHERE i.profile_id=c.profile_id AND i.email=c.email AND i.kind='delegate' AND i.state='accepted'))));
$$;
REVOKE ALL ON FUNCTION bts_private.volunteer_contact_eligible(uuid,text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION bts_private.volunteer_activity_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_profile uuid; contact record;
BEGIN
 v_profile:=NEW.profile_id;IF v_profile IS NULL OR (TG_OP='UPDATE' AND to_jsonb(NEW) IS NOT DISTINCT FROM to_jsonb(OLD)) THEN RETURN NEW;END IF;
 INSERT INTO bts_private.family_audit(profile_id,actor_id,action,details) VALUES(v_profile,auth.uid(),'volunteer_updated',jsonb_build_object('signup_id',NEW.id,'production_id',NEW.production_id,'operation',TG_OP));
 FOR contact IN SELECT DISTINCT c.email FROM bts_private.profile_contacts c WHERE c.profile_id=v_profile AND bts_private.volunteer_contact_eligible(c.profile_id,c.email) LOOP
  IF NOT EXISTS(SELECT 1 FROM bts_private.family_mail m WHERE m.profile_id=v_profile AND m.recipient=contact.email AND m.kind='volunteer_updated' AND m.created_at>now()-interval '5 minutes') THEN INSERT INTO bts_private.family_mail(actor_id,recipient,kind,profile_id,payload) VALUES(auth.uid(),contact.email,'volunteer_updated',v_profile,jsonb_build_object('production_id',NEW.production_id));END IF;
 END LOOP;RETURN NEW;
END $$;
CREATE TRIGGER volunteer_activity_events AFTER INSERT OR UPDATE ON public.volunteer_signups FOR EACH ROW EXECUTE FUNCTION bts_private.volunteer_activity_event();

-- Existing membership claims remain revocable when a team identity changes or is removed.
CREATE FUNCTION bts_private.invalidate_changed_team_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.email IS DISTINCT FROM OLD.email OR NOT NEW.is_active THEN
  DELETE FROM bts_private.production_team_accounts WHERE team_member_id=NEW.id;
  UPDATE bts_private.production_team_invitations SET revoked_at=now() WHERE team_member_id=NEW.id AND accepted_at IS NULL;
  UPDATE public.production_team_member_sessions SET revoked_at=now() WHERE team_member_id=NEW.id AND revoked_at IS NULL;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER invalidate_changed_team_identity AFTER UPDATE OF email,is_active ON public.production_team_members FOR EACH ROW EXECUTE FUNCTION bts_private.invalidate_changed_team_identity();


CREATE OR REPLACE FUNCTION public.bts_is_production_participant(p_production_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.bts_account_is_active() AND (EXISTS(SELECT 1 FROM public.audition_applications a WHERE a.production_id=p_production_id AND public.bts_owns_audition(a.production_id,a.id)) OR EXISTS(SELECT 1 FROM public.audition_bookings a WHERE a.production_id=p_production_id AND public.bts_owns_audition(a.production_id,a.id)) OR EXISTS(SELECT 1 FROM public.volunteer_signups v WHERE v.production_id=p_production_id AND public.bts_owns_volunteer(v.id)));
$$;

CREATE FUNCTION public.bts_request_production_access(p_production_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m record;
BEGIN
 IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with your adult account.';END IF;
 FOR m IN SELECT id FROM public.production_team_members WHERE production_id=p_production_id AND is_active AND lower(trim(email))=public.bts_current_account_email() LOOP
  PERFORM public.bts_invite_production_member(m.id);
 END LOOP;
 RETURN jsonb_build_object('ok',true,'message','If your account email has an assigned position, an access invitation is queued for that inbox.');
END $$;
REVOKE ALL ON FUNCTION public.bts_request_production_access(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_request_production_access(uuid) TO authenticated;

CREATE FUNCTION public.bts_email_org_invitation(p_invitation_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE i public.org_invitations%rowtype; label text;
BEGIN
 SELECT * INTO i FROM public.org_invitations WHERE id=p_invitation_id AND used_at IS NULL AND expires_at>now();
 IF i.id IS NULL OR public.bts_organisation_role(i.org_id) NOT IN('owner','admin') OR public.bts_organisation_role(i.org_id) IS NULL THEN RAISE EXCEPTION 'An active organisation invitation and administrator permission are required.';END IF;
 IF (SELECT count(*) FROM bts_private.family_mail WHERE actor_id=auth.uid() AND kind='org_invitation' AND created_at>now()-interval '1 hour')>=20 THEN RAISE EXCEPTION 'Invitation limit reached. Try again later.';END IF;
 SELECT name INTO label FROM public.organizations WHERE id=i.org_id;
 INSERT INTO bts_private.family_mail(actor_id,recipient,kind,payload) VALUES(auth.uid(),lower(trim(i.email)),'org_invitation',jsonb_build_object('invite_id',i.id,'token',i.token,'organisation',label));
 RETURN jsonb_build_object('ok',true,'queued',true);
END $$;
REVOKE ALL ON FUNCTION public.bts_email_org_invitation(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_email_org_invitation(uuid) TO authenticated;

-- Check invitation validity again at delivery time, in addition to acceptance time.
ALTER FUNCTION public.bts_family_mail_claim() SET SCHEMA bts_private;
ALTER FUNCTION bts_private.bts_family_mail_claim() RENAME TO mail_claim_before_unified_accounts;
REVOKE ALL ON FUNCTION bts_private.mail_claim_before_unified_accounts() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bts_family_mail_claim() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE bts_private.family_mail m SET state='cancelled' WHERE m.state IN('pending','failed') AND m.kind='volunteer_history' AND NOT EXISTS(SELECT 1 FROM bts_private.family_invites i WHERE i.id::text=m.payload->>'invite_id' AND i.kind='volunteer_claim' AND i.state='pending' AND i.expires_at>now());
 UPDATE bts_private.family_mail m SET state='cancelled' WHERE m.state IN('pending','failed') AND m.kind='team_invitation' AND NOT EXISTS(SELECT 1 FROM bts_private.production_team_invitations i JOIN public.production_team_members t ON t.id=i.team_member_id WHERE i.id::text=m.payload->>'invite_id' AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now() AND t.is_active AND lower(trim(t.email))=i.email);
 UPDATE bts_private.family_mail m SET state='cancelled' WHERE m.state IN('pending','failed') AND m.kind='org_invitation' AND NOT EXISTS(SELECT 1 FROM public.org_invitations i WHERE i.id::text=m.payload->>'invite_id' AND i.used_at IS NULL AND i.expires_at>now());
 UPDATE bts_private.family_mail m SET state='cancelled' WHERE m.state IN('pending','failed') AND m.kind='volunteer_updated' AND NOT bts_private.volunteer_contact_eligible(m.profile_id,m.recipient);
 RETURN bts_private.mail_claim_before_unified_accounts();
END $$;
REVOKE ALL ON FUNCTION public.bts_family_mail_claim() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_family_mail_claim() TO service_role;

CREATE FUNCTION public.bts_production_from_link(p_org text,p_show text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.id FROM public.productions p JOIN public.organizations o ON o.id=p.organization_id WHERE lower(p.slug)=lower(p_show) AND (lower(o.slug)=lower(p_org) OR lower(o.abbreviation)=lower(p_org)) AND public.bts_account_is_active() AND ((p.is_public AND p.page_status IN('live','hidden')) OR public.bts_is_production_participant(p.id) OR public.bts_organisation_role(o.id) IS NOT NULL OR EXISTS(SELECT 1 FROM public.production_team_members t WHERE t.production_id=p.id AND t.is_active AND lower(trim(t.email))=public.bts_current_account_email())) ORDER BY p.id LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.bts_production_from_link(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_production_from_link(text,text) TO authenticated;

CREATE FUNCTION public.bts_link_my_volunteer(p_signup_id uuid,p_profile_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.volunteer_signups%rowtype; p public.profiles%rowtype;
BEGIN
 SELECT * INTO v FROM public.volunteer_signups WHERE id=p_signup_id AND user_id=auth.uid() AND profile_id IS NULL FOR UPDATE;
 SELECT * INTO p FROM public.profiles WHERE id=p_profile_id;
 IF NOT public.bts_account_is_active() OR v.id IS NULL OR NOT public.bts_volunteer_profile_access(p_profile_id) THEN RAISE EXCEPTION 'Choose your own older record and an authorised volunteer profile.';END IF;
 IF lower(trim(v.name)) IS DISTINCT FROM lower(trim(coalesce(p.credit_name,p.name))) THEN RAISE EXCEPTION 'The names differ. Ask the operator to review this historical connection.';END IF;
 UPDATE public.volunteer_signups SET profile_id=p_profile_id WHERE id=v.id;
 INSERT INTO bts_private.family_audit(profile_id,actor_id,action,details) VALUES(p_profile_id,auth.uid(),'volunteer_record_linked',jsonb_build_object('signup_id',v.id));
END $$;
REVOKE ALL ON FUNCTION public.bts_link_my_volunteer(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_link_my_volunteer(uuid,uuid) TO authenticated;

ALTER TABLE bts_private.family_reviews DROP CONSTRAINT family_reviews_kind_check;
ALTER TABLE bts_private.family_reviews ADD CONSTRAINT family_reviews_kind_check CHECK(kind IN('guardian_removal','record_link','duplicate_profile','duplicate_account','controller_transfer','birth_date','adult_activation','volunteer_link'));
ALTER FUNCTION public.bts_family_review_resolve(uuid,boolean,text,uuid[]) SET SCHEMA bts_private;
ALTER FUNCTION bts_private.bts_family_review_resolve(uuid,boolean,text,uuid[]) RENAME TO review_before_unified_accounts;
REVOKE ALL ON FUNCTION bts_private.review_before_unified_accounts(uuid,boolean,text,uuid[]) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bts_family_review_resolve(p_request_id uuid,p_approved boolean,p_reason text,p_verified_users uuid[] DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r bts_private.family_reviews%rowtype; v public.volunteer_signups%rowtype;
BEGIN
 SELECT * INTO r FROM bts_private.family_reviews WHERE id=p_request_id AND state='pending' FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Pending review not found.';END IF;
 IF r.kind<>'volunteer_link' THEN RETURN bts_private.review_before_unified_accounts(p_request_id,p_approved,p_reason,p_verified_users);END IF;
 IF length(trim(coalesce(p_reason,'')))<20 THEN RAISE EXCEPTION 'Record the authority checked and decision.';END IF;
 IF p_approved THEN
  SELECT * INTO v FROM public.volunteer_signups WHERE id=public.try_uuid(r.payload->>'record_id') AND profile_id IS NULL FOR UPDATE;
  IF v.id IS NULL OR NOT r.requester_id=ANY(p_verified_users) OR (v.user_id IS NOT NULL AND NOT v.user_id=ANY(p_verified_users)) THEN RAISE EXCEPTION 'Verify the requester, volunteer identity and any existing account controller before linking.';END IF;
  UPDATE public.volunteer_signups SET profile_id=r.profile_id WHERE id=v.id;
 END IF;
 UPDATE bts_private.family_reviews SET state=CASE WHEN p_approved THEN 'approved' ELSE 'declined' END,reason=p_reason,resolved_at=now() WHERE id=r.id;
 INSERT INTO bts_private.family_audit(profile_id,action,details) VALUES(r.profile_id,'review_resolved',jsonb_build_object('review_id',r.id,'approved',p_approved));
 RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.bts_family_review_resolve(uuid,boolean,text,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_family_review_resolve(uuid,boolean,text,uuid[]) TO service_role;

-- Once accepted, the Auth user ID is authoritative even if the adult changes email.
DO $binding$ DECLARE signature text; source text; expected text:='lower(trim(tm.email))=lower(trim(u.email))'; BEGIN
 FOREACH signature IN ARRAY ARRAY['public.bts_authorize_email_send(uuid,uuid,boolean)'] LOOP
  source:=pg_get_functiondef(signature::regprocedure);
  IF position(expected IN source)=0 THEN RAISE EXCEPTION 'Review the current staff helper before replacing its email comparison: %',signature;END IF;
  source:=replace(source,expected,'EXISTS(SELECT 1 FROM bts_private.production_team_accounts accepted WHERE accepted.team_member_id=tm.id AND accepted.user_id=u.id AND accepted.accepted_email=lower(trim(tm.email)))');
  EXECUTE source;
 END LOOP;
END $binding$;

CREATE FUNCTION public.bts_production_access_directory(p_production_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.bts_production_page_permission(p_production_id,'production_team',1) THEN RAISE EXCEPTION 'Production people-access permission is required.';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.id,'account_connected',EXISTS(SELECT 1 FROM bts_private.production_team_accounts a WHERE a.team_member_id=m.id AND a.accepted_email=lower(trim(m.email))),'invitation_delivery',(SELECT mail.state FROM bts_private.family_mail mail WHERE mail.kind='team_invitation' AND mail.payload->>'invite_id' IN(SELECT i.id::text FROM bts_private.production_team_invitations i WHERE i.team_member_id=m.id) ORDER BY mail.created_at DESC LIMIT 1))) FROM public.production_team_members m WHERE m.production_id=p_production_id),'[]');
END $$;
REVOKE ALL ON FUNCTION public.bts_production_access_directory(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_production_access_directory(uuid) TO authenticated;

ALTER FUNCTION public.bts_family_mail_finish(uuid,boolean,text,text) SET SCHEMA bts_private;
ALTER FUNCTION bts_private.bts_family_mail_finish(uuid,boolean,text,text) RENAME TO mail_finish_before_unified_accounts;
REVOKE ALL ON FUNCTION bts_private.mail_finish_before_unified_accounts(uuid,boolean,text,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bts_family_mail_finish(p_id uuid,p_success boolean,p_provider_id text DEFAULT NULL,p_error text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM bts_private.mail_finish_before_unified_accounts(p_id,p_success,p_provider_id,p_error);
 IF p_success THEN
  UPDATE public.production_team_members m SET invite_sent_at=now() FROM bts_private.production_team_invitations i,bts_private.family_mail job
  WHERE job.id=p_id AND job.state='sent' AND job.kind='team_invitation' AND i.id::text=job.payload->>'invite_id' AND m.id=i.team_member_id AND lower(trim(m.email))=i.email;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.bts_family_mail_finish(uuid,boolean,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_family_mail_finish(uuid,boolean,text,text) TO service_role;

ALTER TABLE bts_private.family_invites DROP CONSTRAINT family_invites_kind_check;
ALTER TABLE bts_private.family_invites ADD CONSTRAINT family_invites_kind_check CHECK(kind IN('guardian','delegate','delegate_key','contact','household','claim','volunteer_claim'));
ALTER TABLE bts_private.family_invites ADD COLUMN volunteer_signup_ids uuid[];

CREATE FUNCTION public.bts_request_volunteer_history(p_production_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE group_rows record; v_email text; v_token text; v_invite uuid; v_count integer:=0;
BEGIN
 IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with your adult account.';END IF;
 v_email:=lower(trim(public.bts_current_account_email()));
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':volunteer-history',0));
 IF (SELECT count(*) FROM bts_private.family_invites WHERE sender_id=auth.uid() AND kind='volunteer_claim' AND created_at>now()-interval '1 hour')>=20 THEN RAISE EXCEPTION 'Confirmation request limit reached. Try again later.';END IF;
 FOR group_rows IN SELECT v.production_id,array_agg(v.id ORDER BY v.created_at,v.id) AS ids,min(v.name) AS person
  FROM public.volunteer_signups v WHERE v.profile_id IS NULL AND v.user_id IS NULL AND lower(trim(coalesce(nullif(v.email,''),v.volunteer_email)))=v_email AND (p_production_id IS NULL OR v.production_id=p_production_id)
  GROUP BY v.production_id,v.portal_token,lower(trim(v.name)) ORDER BY v.production_id LIMIT 20 LOOP
  IF (SELECT count(*) FROM bts_private.family_invites WHERE sender_id=auth.uid() AND kind='volunteer_claim' AND created_at>now()-interval '1 hour')>=20 THEN EXIT;END IF;
  IF EXISTS(SELECT 1 FROM bts_private.family_invites WHERE sender_id=auth.uid() AND kind='volunteer_claim' AND state='pending' AND expires_at>now() AND volunteer_signup_ids&&group_rows.ids) THEN CONTINUE;END IF;
  v_token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  INSERT INTO bts_private.family_invites(sender_id,email,kind,token_hash,volunteer_signup_ids) VALUES(auth.uid(),v_email,'volunteer_claim',encode(sha256(convert_to(v_token,'UTF8')),'hex'),group_rows.ids) RETURNING id INTO v_invite;
  INSERT INTO bts_private.family_mail(actor_id,recipient,kind,payload) VALUES(auth.uid(),v_email,'volunteer_history',jsonb_build_object('invite_id',v_invite,'token',v_token,'production_id',group_rows.production_id,'performer',group_rows.person));v_count:=v_count+1;
 END LOOP;
 RETURN jsonb_build_object('ok',true,'message','If older volunteer records use your account email, confirmation links are queued for that inbox. Check email before requesting again.');
END $$;
REVOKE ALL ON FUNCTION public.bts_request_volunteer_history(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_request_volunteer_history(uuid) TO authenticated;

CREATE FUNCTION public.bts_confirm_volunteer_history(p_token text,p_profile_id uuid DEFAULT NULL,p_accept boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE i bts_private.family_invites%rowtype; v public.volunteer_signups%rowtype; p public.profiles%rowtype; changed integer;
BEGIN
 IF p_token IS NULL OR p_token!~'^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Confirmation link unavailable.';END IF;
 SELECT * INTO i FROM bts_private.family_invites WHERE token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') AND kind='volunteer_claim' FOR UPDATE;
 IF i.id IS NULL OR i.state<>'pending' OR i.expires_at<=now() THEN RAISE EXCEPTION 'This confirmation expired or was already used.';END IF;
 SELECT * INTO v FROM public.volunteer_signups WHERE id=i.volunteer_signup_ids[1] AND profile_id IS NULL AND user_id IS NULL;
 IF v.id IS NULL THEN RAISE EXCEPTION 'The historical records changed. Request a fresh confirmation or operator review.';END IF;
 IF p_accept THEN
  IF NOT public.bts_account_is_active() OR lower(trim(public.bts_current_account_email())) IS DISTINCT FROM i.email OR NOT public.bts_volunteer_profile_access(p_profile_id) THEN RAISE EXCEPTION 'Use the receiving adult account and an authorised volunteer profile.';END IF;
  SELECT * INTO p FROM public.profiles WHERE id=p_profile_id;
  IF lower(trim(coalesce(p.credit_name,p.name))) IS DISTINCT FROM lower(trim(v.name)) THEN RAISE EXCEPTION 'The names differ. Request an operator review with the record reference shown here.';END IF;
  UPDATE public.volunteer_signups old SET profile_id=p.id,user_id=auth.uid(),guardian_details=CASE WHEN p.date_of_birth>(current_date-interval '18 years')::date THEN public.bts_current_guardian_name(p.id) ELSE old.guardian_details END,guardian_consent_at=CASE WHEN p.date_of_birth>(current_date-interval '18 years')::date THEN now() ELSE old.guardian_consent_at END,guardian_consent_version=CASE WHEN p.date_of_birth>(current_date-interval '18 years')::date THEN '2026-11-16' ELSE old.guardian_consent_version END
  WHERE old.id=ANY(i.volunteer_signup_ids) AND old.profile_id IS NULL AND old.user_id IS NULL AND lower(trim(coalesce(nullif(old.email,''),old.volunteer_email)))=i.email AND lower(trim(old.name))=lower(trim(v.name));
  GET DIAGNOSTICS changed=ROW_COUNT;IF changed<>cardinality(i.volunteer_signup_ids) THEN RAISE EXCEPTION 'The records changed. Request a fresh confirmation.';END IF;
  UPDATE bts_private.family_invites SET state='accepted',accepted_by=auth.uid() WHERE id=i.id;
  INSERT INTO bts_private.family_audit(profile_id,actor_id,action,details) VALUES(p.id,auth.uid(),'volunteer_history_confirmed',jsonb_build_object('invitation_id',i.id,'records',changed));
 END IF;
 RETURN jsonb_build_object('person',v.name,'production',(SELECT title FROM public.productions WHERE id=v.production_id),'record_reference',v.id,'count',cardinality(i.volunteer_signup_ids),'email',i.email,'accepted',p_accept);
END $$;
REVOKE ALL ON FUNCTION public.bts_confirm_volunteer_history(text,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_confirm_volunteer_history(text,uuid,boolean) TO anon,authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
