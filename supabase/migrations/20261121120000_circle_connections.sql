-- Circle membership, incoming notices and requests reuse existing profile keys and email delivery.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE bts_private.circle_access_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),circle_id uuid NOT NULL REFERENCES bts_private.households(id),
 requester_id uuid NOT NULL REFERENCES auth.users(id),recipient text NOT NULL,message text NOT NULL DEFAULT '',
 state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','approved','declined','cancelled')),
 invitation_ids uuid[] NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',resolved_by uuid REFERENCES auth.users(id)
);
REVOKE ALL ON bts_private.circle_access_requests FROM PUBLIC,anon,authenticated;
CREATE INDEX circle_requests_recipient ON bts_private.circle_access_requests(recipient,state);

ALTER FUNCTION public.bts_circle(text,jsonb) RENAME TO circle_before_connections;
ALTER FUNCTION public.circle_before_connections(text,jsonb) SET SCHEMA bts_private;
REVOKE ALL ON FUNCTION bts_private.circle_before_connections(text,jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bts_circle(p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE result jsonb; inv bts_private.family_invites%rowtype; req bts_private.circle_access_requests%rowtype;
 circle_id uuid:=public.try_uuid(p_data->>'circle_id'); object_id uuid:=public.try_uuid(p_data->>'id');
 email text; target text; token text; label text; circle_name text; sender text; ids uuid[]; profile_id uuid;
 invitation_id uuid; invitations uuid[]:='{}'; person record; manager_id uuid;
BEGIN
 SELECT lower(u.email),coalesce(nullif(trim(coalesce(u.raw_user_meta_data->>'first_name','')||' '||coalesce(u.raw_user_meta_data->>'last_name','')),''),nullif(u.raw_user_meta_data->>'full_name',''),'An adult member') INTO email,sender FROM auth.users u WHERE u.id=auth.uid();
 IF p_action IN('snapshot','request_access','respond_request','cancel_request','accept_notice','decline_notice','member_access','connect_profile','rename_circle') AND NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with your own adult account.';END IF;
 IF p_action='snapshot' THEN
  result:=bts_private.circle_before_connections('snapshot');
  RETURN result||jsonb_build_object(
   'circles',coalesce((SELECT jsonb_agg(h||jsonb_build_object('admins',(
    SELECT jsonb_agg(jsonb_build_object('is_me',m.user_id=auth.uid(),'name',coalesce(nullif(trim(coalesce(u.raw_user_meta_data->>'first_name','')||' '||coalesce(u.raw_user_meta_data->>'last_name','')),''),nullif(u.raw_user_meta_data->>'full_name',''),'Circle admin'),
     'role',CASE WHEN g.creator_id=m.user_id THEN 'Owner' ELSE 'Admin' END,
     'profile_ids',coalesce((SELECT jsonb_agg(hp.profile_id) FROM bts_private.household_profiles hp WHERE hp.household_id=g.id AND public.bts_profile_access(hp.profile_id,false) AND EXISTS(SELECT 1 FROM bts_private.profile_keys k WHERE k.profile_id=hp.profile_id AND k.user_id=m.user_id AND k.active)),'[]'::jsonb)) ORDER BY m.joined_at)
    FROM bts_private.household_members m JOIN bts_private.households g ON g.id=m.household_id JOIN auth.users u ON u.id=m.user_id WHERE g.id=(h->>'id')::uuid))) FROM jsonb_array_elements(result->'circles') h),'[]'::jsonb),
   'incoming',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'kind',i.kind,'circle',coalesce(h.name,rh.name),'inviter',coalesce(nullif(trim(coalesce(u.raw_user_meta_data->>'first_name','')||' '||coalesce(u.raw_user_meta_data->>'last_name','')),''),nullif(u.raw_user_meta_data->>'full_name',''),'An adult member'),
    'profiles',CASE WHEN i.kind='household' THEN coalesce((SELECT jsonb_agg(p.credit_name) FROM public.profiles p WHERE p.id=ANY(i.circle_profile_ids)),'[]'::jsonb) ELSE jsonb_build_array(p.credit_name) END,
    'has_children',i.kind='guardian' OR EXISTS(SELECT 1 FROM public.profiles cp JOIN bts_private.profile_controls c ON c.profile_id=cp.id WHERE cp.id=ANY(i.circle_profile_ids) AND c.kind='child'),
    'expires_at',i.expires_at)) FROM bts_private.family_invites i JOIN auth.users u ON u.id=i.sender_id LEFT JOIN bts_private.households h ON h.id=i.household_id LEFT JOIN public.profiles p ON p.id=i.profile_id
    LEFT JOIN bts_private.circle_access_requests r ON i.id=ANY(r.invitation_ids) LEFT JOIN bts_private.households rh ON rh.id=r.circle_id
    WHERE i.email=email AND i.state='pending' AND i.expires_at>now() AND i.kind IN('household','guardian','delegate_key','claim')),'[]'::jsonb),
   'access_requests',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'circle',h.name,'requester',coalesce(nullif(trim(coalesce(u.raw_user_meta_data->>'first_name','')||' '||coalesce(u.raw_user_meta_data->>'last_name','')),''),nullif(u.raw_user_meta_data->>'full_name',''),'An adult member'),'message',r.message,'state',r.state,'expires_at',r.expires_at)) FROM bts_private.circle_access_requests r JOIN bts_private.households h ON h.id=r.circle_id JOIN auth.users u ON u.id=r.requester_id WHERE r.recipient=email AND r.state='pending' AND r.expires_at>now()),'[]'::jsonb),
   'invites',coalesce((SELECT jsonb_agg(v||jsonb_build_object('circle_id',coalesce(i.household_id,r.circle_id))) FROM jsonb_array_elements(result->'invites') v JOIN bts_private.family_invites i ON i.id=(v->>'id')::uuid LEFT JOIN bts_private.circle_access_requests r ON i.id=ANY(r.invitation_ids)),'[]'::jsonb),
   'sent_requests',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'circle_id',r.circle_id,'email',r.recipient,'state',r.state,'expires_at',r.expires_at,'mail_state',(SELECT m.state FROM bts_private.family_mail m WHERE m.payload->>'request_id'=r.id::text ORDER BY m.created_at DESC LIMIT 1))) FROM bts_private.circle_access_requests r WHERE r.requester_id=auth.uid()),'[]'::jsonb));
 ELSIF p_action='member_access' THEN
  profile_id:=public.try_uuid(p_data->>'profile_id');
  IF NOT public.bts_profile_access(profile_id) THEN RAISE EXCEPTION 'This member is not available to your account.';END IF;
  -- Names and access roles only: no email addresses, private contacts, health information or other profiles.
  RETURN jsonb_build_object('keys',coalesce((SELECT jsonb_agg(jsonb_build_object('name',coalesce(nullif(k.declared_name,''),nullif(trim(coalesce(u.raw_user_meta_data->>'first_name','')||' '||coalesce(u.raw_user_meta_data->>'last_name','')),''),'Adult with access'),'is_me',k.user_id=auth.uid(),'kind',k.kind,'active',k.active)) FROM bts_private.profile_keys k JOIN auth.users u ON u.id=k.user_id WHERE k.profile_id=profile_id AND k.active),'[]'::jsonb));
 ELSIF p_action='connect_profile' THEN
  RETURN bts_private.circle_before_connections('add_to_household',jsonb_build_object('household_id',circle_id,'profile_id',p_data->>'profile_id'));
 ELSIF p_action='request_access' THEN
  SELECT h.name INTO circle_name FROM bts_private.households h WHERE h.id=circle_id AND h.creator_id=auth.uid() FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Choose a circle you own for this request.';END IF;
  target:=lower(trim(p_data->>'email'));
  IF target IS NULL OR target!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(target)>320 OR target=email THEN RAISE EXCEPTION 'Enter the other adult’s email address.';END IF;
  IF length(coalesce(p_data->>'message',''))>1000 THEN RAISE EXCEPTION 'Keep your message under 1,000 characters.';END IF;
  IF (SELECT count(*) FROM bts_private.circle_access_requests WHERE requester_id=auth.uid() AND created_at>now()-interval '1 hour')>=10 THEN RAISE EXCEPTION 'Request limit reached. Please try later.';END IF;
  IF EXISTS(SELECT 1 FROM bts_private.circle_access_requests WHERE requester_id=auth.uid() AND circle_access_requests.circle_id=circle_id AND recipient=target AND state='pending' AND expires_at>now()) THEN RAISE EXCEPTION 'A request to this email is already waiting for a response.';END IF;
  INSERT INTO bts_private.circle_access_requests(circle_id,requester_id,recipient,message) VALUES(circle_id,auth.uid(),target,trim(coalesce(p_data->>'message',''))) RETURNING * INTO req;
  INSERT INTO bts_private.family_mail(actor_id,recipient,kind,payload) VALUES(auth.uid(),target,'circle_access_request',jsonb_build_object('request_id',req.id,'circle',circle_name,'inviter',sender));
  RETURN jsonb_build_object('id',req.id);
 ELSIF p_action='respond_request' THEN
  SELECT * INTO req FROM bts_private.circle_access_requests r WHERE r.id=object_id AND r.recipient=email AND r.state='pending' AND r.expires_at>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This request expired, changed or belongs to another email address.';END IF;
  SELECT lower(u.email),h.name INTO target,circle_name FROM auth.users u JOIN bts_private.households h ON h.creator_id=u.id WHERE u.id=req.requester_id AND h.id=req.circle_id FOR SHARE OF h;
  IF NOT FOUND THEN RAISE EXCEPTION 'The circle owner changed. Ask for a new request.';END IF;
  IF coalesce((p_data->>'approve')::boolean,false) THEN
   IF jsonb_typeof(p_data->'profile_ids') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'profile_ids') NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Choose the members you agree to share.';END IF;
   SELECT array_agg(DISTINCT value::uuid) INTO ids FROM jsonb_array_elements_text(p_data->'profile_ids');
   FOREACH profile_id IN ARRAY ids LOOP
    SELECT p.id,c.kind,c.subject_id INTO person FROM public.profiles p JOIN bts_private.profile_controls c ON c.profile_id=p.id WHERE p.id=profile_id AND p.deleted_at IS NULL AND c.consent_state='active' AND public.bts_profile_manager(p.id);
    IF NOT FOUND OR (person.kind<>'child' AND person.subject_id IS DISTINCT FROM auth.uid()) THEN RAISE EXCEPTION 'You can only share a child whose access you manage, or your own adult profile.';END IF;
    invitation_id:=public.bts_family_invite_internal(profile_id,NULL,target,CASE WHEN person.kind='child' THEN 'guardian' ELSE 'delegate_key' END);
    invitations:=array_append(invitations,invitation_id);
    UPDATE bts_private.family_mail SET payload=payload||jsonb_build_object('circle',circle_name,'inviter',sender) WHERE payload->>'invite_id'=invitation_id::text;
   END LOOP;
   UPDATE bts_private.circle_access_requests SET state='approved',resolved_by=auth.uid(),invitation_ids=invitations WHERE id=req.id;
  ELSE UPDATE bts_private.circle_access_requests SET state='declined',resolved_by=auth.uid() WHERE id=req.id;END IF;
  INSERT INTO bts_private.family_audit(household_id,actor_id,action,details) VALUES(req.circle_id,auth.uid(),'circle_access_request_responded',jsonb_build_object('request_id',req.id,'approved',coalesce((p_data->>'approve')::boolean,false)));
  UPDATE bts_private.family_mail SET state='cancelled' WHERE payload->>'request_id'=req.id::text AND state IN('pending','failed');
  RETURN jsonb_build_object('ok',true);
 ELSIF p_action='cancel_request' THEN
  UPDATE bts_private.circle_access_requests SET state='cancelled' WHERE id=object_id AND requester_id=auth.uid() AND state='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'This request is no longer pending.';END IF;
  UPDATE bts_private.family_mail SET state='cancelled' WHERE payload->>'request_id'=object_id::text AND state IN('pending','failed');
  RETURN jsonb_build_object('ok',true);
 ELSIF p_action IN('accept_notice','decline_notice') THEN
  SELECT * INTO inv FROM bts_private.family_invites i WHERE i.id=object_id AND i.email=email AND i.state='pending' AND i.expires_at>now() AND i.kind IN('household','guardian','delegate_key','claim') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This invitation expired, changed or belongs to another email address.';END IF;
  -- No raw invitation token is exposed in account notifications.
  token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  UPDATE bts_private.family_invites SET token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') WHERE id=inv.id;
  result:=public.bts_circle(CASE WHEN p_action='accept_notice' THEN 'accept' ELSE 'decline' END,p_data||jsonb_build_object('token',token));
  RETURN result;
 END IF;

 IF p_action IN('preview','accept','decline') THEN
  SELECT * INTO inv FROM bts_private.family_invites i WHERE i.token_hash=encode(sha256(convert_to(coalesce(p_data->>'token',''),'UTF8')),'hex');
  IF inv.id IS NOT NULL THEN
   IF p_action='decline' AND inv.kind IN('household','guardian','delegate_key','claim') AND (NOT public.bts_account_is_active() OR inv.email IS DISTINCT FROM email) THEN RAISE EXCEPTION 'Sign in using the invited email address.';END IF;
   SELECT * INTO req FROM bts_private.circle_access_requests r WHERE inv.id=ANY(r.invitation_ids) AND r.state='approved';
   IF req.id IS NOT NULL AND p_action='accept' THEN
    IF req.requester_id IS DISTINCT FROM auth.uid() OR NOT EXISTS(SELECT 1 FROM bts_private.households h WHERE h.id=req.circle_id AND h.creator_id=auth.uid()) THEN RAISE EXCEPTION 'The circle or account changed. Ask for a new invitation.';END IF;
    IF NOT EXISTS(SELECT 1 FROM bts_private.profile_controls c JOIN public.profiles p ON p.id=c.profile_id WHERE c.profile_id=inv.profile_id AND c.consent_state='active' AND p.deleted_at IS NULL AND ((c.kind='child' AND c.manager_id=inv.sender_id AND p.date_of_birth>current_date-interval '18 years') OR (c.kind='self' AND c.subject_id=inv.sender_id))) THEN RAISE EXCEPTION 'This member’s permissions changed. Ask for a new invitation.';END IF;
   END IF;
  END IF;
 END IF;
 result:=bts_private.circle_before_connections(p_action,p_data);
 IF p_action='invite_admin' THEN
  UPDATE bts_private.family_mail SET payload=payload||jsonb_build_object('inviter',sender) WHERE payload->>'invite_id'=result->>'id';
 ELSIF p_action='preview' AND inv.id IS NOT NULL THEN
  SELECT coalesce(nullif(trim(coalesce(u.raw_user_meta_data->>'first_name','')||' '||coalesce(u.raw_user_meta_data->>'last_name','')),''),nullif(u.raw_user_meta_data->>'full_name',''),'An adult member') INTO label FROM auth.users u WHERE u.id=inv.sender_id;
  result:=result||jsonb_build_object('inviter',label);
  IF req.id IS NOT NULL THEN SELECT h.name INTO circle_name FROM bts_private.households h WHERE h.id=req.circle_id;result:=result||jsonb_build_object('circle',circle_name);END IF;
 ELSIF p_action='accept' AND req.id IS NOT NULL THEN
  PERFORM public.bts_family('add_to_household',jsonb_build_object('household_id',req.circle_id,'profile_id',inv.profile_id));
 END IF;
 IF p_action='accept' AND inv.id IS NOT NULL THEN result:=result||jsonb_build_object('circle_id',coalesce(inv.household_id,req.circle_id));END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.bts_circle(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bts_circle(text,jsonb) TO anon,authenticated;

-- A recipient-bound circle invitation also admits that specific email to beta signup.
CREATE OR REPLACE FUNCTION public.bts_check_beta_code(p_code text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF length(coalesce(p_code,'')) NOT BETWEEN 10 AND 100 THEN RETURN false;END IF;
 RETURN EXISTS(SELECT 1 FROM bts_private.beta_invitations WHERE code_hash=bts_private.beta_code_hash(p_code) AND revoked_at IS NULL AND expires_at>now() AND used_count<max_uses)
 OR EXISTS(SELECT 1 FROM bts_private.family_invites WHERE token_hash=encode(sha256(convert_to(p_code,'UTF8')),'hex') AND state='pending' AND expires_at>now() AND kind IN('household','guardian','delegate_key','claim'));
END $$;
CREATE OR REPLACE FUNCTION bts_private.require_beta_invitation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE invitation_id uuid; code text:=NEW.raw_user_meta_data->>'beta_code';
BEGIN
 IF EXISTS(SELECT 1 FROM bts_private.family_invites i WHERE i.token_hash=encode(sha256(convert_to(coalesce(code,''),'UTF8')),'hex') AND i.email=lower(NEW.email) AND i.state='pending' AND i.expires_at>now() AND i.kind IN('household','guardian','delegate_key','claim')) THEN
  NEW.raw_user_meta_data:=NEW.raw_user_meta_data-'beta_code';RETURN NEW;
 END IF;
 IF length(coalesce(code,'')) NOT BETWEEN 10 AND 100 THEN RAISE EXCEPTION 'A valid beta invitation code is required to sign up.';END IF;
 UPDATE bts_private.beta_invitations SET used_count=used_count+1 WHERE code_hash=bts_private.beta_code_hash(code) AND revoked_at IS NULL AND expires_at>now() AND used_count<max_uses RETURNING id INTO invitation_id;
 IF invitation_id IS NULL THEN RAISE EXCEPTION 'This invitation is invalid, expired or belongs to another email address.';END IF;
 UPDATE bts_private.account_controls SET beta_invitation_id=invitation_id WHERE user_id=NEW.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Adult account registration must run before beta admission.';END IF;
 NEW.raw_user_meta_data:=NEW.raw_user_meta_data-'beta_code';RETURN NEW;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
