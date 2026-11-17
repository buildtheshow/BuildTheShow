-- Circles reuse existing household groups. Profile access stays explicit and independently scoped.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE bts_private.family_invites ADD COLUMN circle_profile_ids uuid[] NOT NULL DEFAULT '{}';

CREATE FUNCTION public.bts_circle(p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; circle_id uuid:=public.try_uuid(p_data->>'circle_id'); v_profile_id uuid;
 selected_ids uuid[]; invitation uuid; inv bts_private.family_invites%rowtype; person record;
 circle_name text; names jsonb; child_names jsonb; contact_token text; own_profile uuid;
BEGIN
 IF p_action='snapshot' THEN
  result:=public.bts_family('snapshot');
  RETURN result || jsonb_build_object('circles',coalesce((SELECT jsonb_agg(h||jsonb_build_object(
   'role',CASE WHEN (h->>'creator')::boolean THEN 'Owner' ELSE 'Admin' END,
   'admins',(SELECT jsonb_agg(jsonb_build_object('is_me',m.user_id=auth.uid(),'role',CASE WHEN m.user_id=g.creator_id THEN 'Owner' ELSE 'Admin' END,'name',coalesce(nullif(trim(coalesce(u.raw_user_meta_data->>'first_name','')||' '||coalesce(u.raw_user_meta_data->>'last_name','')),''),nullif(u.raw_user_meta_data->>'full_name',''),'Circle admin')) ORDER BY m.joined_at) FROM bts_private.household_members m JOIN bts_private.households g ON g.id=m.household_id JOIN auth.users u ON u.id=m.user_id WHERE m.household_id=(h->>'id')::uuid)
  )) FROM jsonb_array_elements(result->'households') h),'[]'::jsonb));
 ELSIF p_action='create_circle' THEN
  result:=public.bts_family('create_household',jsonb_build_object('name',p_data->>'name'));
  circle_id:=(result->>'id')::uuid;
  SELECT profile_controls.profile_id INTO own_profile FROM bts_private.profile_controls WHERE subject_id=auth.uid() AND kind='self' AND consent_state='active';
  IF own_profile IS NOT NULL AND public.bts_profile_access(own_profile) THEN
   PERFORM public.bts_family('add_to_household',jsonb_build_object('household_id',circle_id,'profile_id',own_profile));
  END IF;
  RETURN result;
 ELSIF p_action='add_member' THEN
  IF circle_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM bts_private.households WHERE id=circle_id AND creator_id=auth.uid()) THEN RAISE EXCEPTION 'Only the circle owner can add a member to this circle.';END IF;
  v_profile_id:=public.bts_save_profile(p_data->'profile',NULL,coalesce((p_data->>'guardian_confirmed')::boolean,false));
  IF circle_id IS NOT NULL THEN PERFORM public.bts_family('add_to_household',jsonb_build_object('household_id',circle_id,'profile_id',v_profile_id));END IF;
  RETURN jsonb_build_object('id',v_profile_id);
 ELSIF p_action='invite_admin' THEN
  IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with your adult account.';END IF;
  SELECT name INTO circle_name FROM bts_private.households WHERE id=circle_id AND creator_id=auth.uid() FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only the circle owner can invite an admin.';END IF;
  IF lower(trim(p_data->>'email'))=(SELECT lower(email) FROM auth.users WHERE id=auth.uid()) THEN RAISE EXCEPTION 'You already own this circle.';END IF;
  IF jsonb_typeof(p_data->'profile_ids') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'profile_ids')>30 THEN RAISE EXCEPTION 'Choose the members to share.';END IF;
  SELECT coalesce(array_agg(DISTINCT value::uuid),'{}'::uuid[]) INTO selected_ids FROM jsonb_array_elements_text(p_data->'profile_ids');
  IF cardinality(selected_ids)=0 THEN RAISE EXCEPTION 'Choose at least one member for this admin to help manage.';END IF;
  FOREACH v_profile_id IN ARRAY selected_ids LOOP
   IF NOT EXISTS(SELECT 1 FROM bts_private.household_profiles hp JOIN bts_private.profile_controls c ON c.profile_id=hp.profile_id JOIN public.profiles p ON p.id=c.profile_id WHERE hp.household_id=circle_id AND hp.profile_id=v_profile_id AND p.deleted_at IS NULL AND c.consent_state='active' AND public.bts_profile_manager(p.id) AND ((c.kind='child' AND p.date_of_birth>(current_date-interval '18 years')::date) OR c.subject_id=auth.uid())) THEN
    RAISE EXCEPTION 'You can only share circle members whose access you control. Another adult must share their own profile.';
   END IF;
  END LOOP;
  invitation:=public.bts_family_invite_internal(NULL,circle_id,p_data->>'email','household');
  UPDATE bts_private.family_invites SET circle_profile_ids=selected_ids,volunteer_help=coalesce((p_data->>'volunteer_help')::boolean,false) WHERE id=invitation;
  SELECT jsonb_agg(credit_name ORDER BY credit_name) INTO names FROM public.profiles WHERE id=ANY(selected_ids);
  UPDATE bts_private.family_mail SET payload=payload||jsonb_build_object('circle',circle_name,'profiles',names) WHERE payload->>'invite_id'=invitation::text;
  RETURN jsonb_build_object('id',invitation);
 ELSIF p_action IN ('preview','accept') THEN
  -- The existing invitation implementation validates expiry, token, invited email and adult login.
  SELECT * INTO inv FROM bts_private.family_invites WHERE token_hash=encode(sha256(convert_to(coalesce(p_data->>'token',''),'UTF8')),'hex') FOR UPDATE;
  IF inv.kind IS DISTINCT FROM 'household' THEN RETURN public.bts_family(p_action,p_data);END IF;
  result:=public.bts_family('preview',p_data);
  SELECT name INTO circle_name FROM bts_private.households WHERE id=inv.household_id AND creator_id=inv.sender_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The circle owner changed. Ask for a new invitation.';END IF;
  names:='[]';child_names:='[]';
  FOREACH v_profile_id IN ARRAY inv.circle_profile_ids LOOP
   SELECT p.credit_name,p.date_of_birth,c.kind,c.subject_id,c.manager_id INTO person FROM public.profiles p JOIN bts_private.profile_controls c ON c.profile_id=p.id JOIN bts_private.household_profiles hp ON hp.profile_id=p.id WHERE p.id=v_profile_id AND hp.household_id=inv.household_id AND p.deleted_at IS NULL AND c.consent_state='active' AND ((c.kind='child' AND c.manager_id=inv.sender_id AND p.date_of_birth>(current_date-interval '18 years')::date) OR c.subject_id=inv.sender_id) FOR SHARE OF p,c,hp;
   IF NOT FOUND THEN RAISE EXCEPTION 'A member or their permissions changed. Ask the owner for a new invitation.';END IF;
   names:=names||jsonb_build_array(person.credit_name);
   IF person.kind='child' AND person.date_of_birth>(current_date-interval '18 years')::date THEN child_names:=child_names||jsonb_build_array(person.credit_name);END IF;
  END LOOP;
  IF p_action='preview' THEN RETURN result||jsonb_build_object('circle',circle_name,'profiles',names,'children',child_names,'role','Admin','volunteer_help',inv.volunteer_help);END IF;
  IF jsonb_array_length(child_names)>0 AND ((p_data->>'guardian_confirmed') IS DISTINCT FROM 'true' OR length(trim(coalesce(p_data->>'name','')))<2) THEN RAISE EXCEPTION 'Confirm your name and that you are a parent or legal guardian of the listed children.';END IF;
  result:=public.bts_family('accept',p_data);
  FOREACH v_profile_id IN ARRAY inv.circle_profile_ids LOOP
   INSERT INTO bts_private.profile_keys(profile_id,user_id,kind,declared_name) SELECT v_profile_id,auth.uid(),CASE WHEN c.kind='child' AND p.date_of_birth>(current_date-interval '18 years')::date THEN 'guardian' ELSE 'delegate' END,nullif(trim(p_data->>'name'),'') FROM bts_private.profile_controls c JOIN public.profiles p ON p.id=c.profile_id WHERE c.profile_id=v_profile_id
    ON CONFLICT(profile_id,user_id) DO UPDATE SET active=true,kind=CASE WHEN profile_keys.kind='self' THEN 'self' ELSE EXCLUDED.kind END,declared_name=coalesce(EXCLUDED.declared_name,profile_keys.declared_name),consented_at=now();
   contact_token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
   INSERT INTO bts_private.profile_contacts(profile_id,email,user_id,unsubscribe_hash,preference_token) VALUES(v_profile_id,inv.email,auth.uid(),encode(sha256(convert_to(contact_token,'UTF8')),'hex'),contact_token)
    ON CONFLICT(profile_id,email) DO UPDATE SET active=true,confirmed_at=now(),user_id=auth.uid();
   INSERT INTO bts_private.family_audit(profile_id,household_id,actor_id,action,details) VALUES(v_profile_id,inv.household_id,auth.uid(),'circle_admin_access_accepted',jsonb_build_object('invitation_id',inv.id));
  END LOOP;
  IF inv.volunteer_help THEN UPDATE bts_private.profile_keys SET volunteer_consent_at=now() WHERE profile_keys.profile_id=ANY(inv.circle_profile_ids) AND user_id=auth.uid() AND kind='delegate' AND active;END IF;
  RETURN result;
 ELSE RETURN public.bts_family(p_action,p_data);
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.bts_circle(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bts_circle(text,jsonb) TO anon,authenticated;
COMMIT;
