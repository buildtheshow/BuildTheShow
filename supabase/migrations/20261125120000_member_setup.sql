-- Member setup reuses profiles, explicit keys and circles. No new tables.
CREATE FUNCTION public.bts_ensure_own_profile() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE own_id uuid; birth date; metadata jsonb; first_name text; last_name text; matches integer;
BEGIN
 IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with your adult account.';END IF;
 PERFORM 1 FROM bts_private.account_controls WHERE user_id=auth.uid() FOR UPDATE;
 SELECT profile_id INTO own_id FROM bts_private.profile_controls WHERE subject_id=auth.uid() AND consent_state='active';
 IF own_id IS NOT NULL THEN RETURN own_id;END IF;
 -- A recipient must accept an existing profile before a new personal profile is made.
 IF EXISTS(SELECT 1 FROM bts_private.family_invites i JOIN auth.users u ON lower(u.email)=i.email WHERE u.id=auth.uid() AND i.kind='claim' AND i.state='pending' AND i.expires_at>now()) THEN RETURN NULL;END IF;
 SELECT birth_date INTO birth FROM bts_private.account_controls WHERE user_id=auth.uid();
 SELECT raw_user_meta_data INTO metadata FROM auth.users WHERE id=auth.uid();
 SELECT count(*),(array_agg(p.id))[1] INTO matches,own_id FROM public.profiles p WHERE p.deleted_at IS NULL AND p.date_of_birth=birth AND coalesce(p.user_id,p.account_id)=auth.uid() AND(p.user_id IS NULL OR p.account_id IS NULL OR p.user_id=p.account_id) AND NOT EXISTS(SELECT 1 FROM bts_private.profile_controls c WHERE c.profile_id=p.id);
 IF matches>1 THEN RAISE EXCEPTION 'More than one existing profile matches your account. Review which profile is yours before continuing.';END IF;
 IF matches=1 THEN
  PERFORM public.bts_family('adopt_legacy',jsonb_build_object('profile_id',own_id,'kind','self'));
  RETURN own_id;
 END IF;
 first_name:=coalesce(nullif(trim(metadata->>'first_name'),''),nullif(split_part(metadata->>'full_name',' ',1),''));
 last_name:=coalesce(nullif(trim(metadata->>'last_name'),''),CASE WHEN position(' ' in metadata->>'full_name')>0 THEN nullif(trim(substring(metadata->>'full_name' from position(' ' in metadata->>'full_name')+1)),'') END,'');
 IF first_name IS NULL THEN RAISE EXCEPTION 'Add your own name to your adult account before creating a circle.';END IF;
 RETURN public.bts_save_profile(jsonb_build_object('relationship_kind','self','legal_first_name',first_name,'legal_last_name',last_name,'credit_name',trim(first_name||' '||last_name),'date_of_birth',birth),NULL,false);
END $$;
REVOKE ALL ON FUNCTION public.bts_ensure_own_profile() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_ensure_own_profile() TO authenticated;

CREATE FUNCTION public.bts_create_circle_profile(p_circle_id uuid,p_profile jsonb,p_guardian_confirmed boolean,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE own_id uuid; v_profile_id uuid; birth date; first_name text; last_name text; photo text; data jsonb; parent_name text; adult boolean;
BEGIN
 IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with your adult account.';END IF;
 IF p_request_id IS NULL THEN RAISE EXCEPTION 'Reload the profile form and try again.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_id::text,0));
 SELECT a.profile_id INTO v_profile_id FROM bts_private.family_audit a WHERE a.actor_id=auth.uid() AND a.action='circle_basic_profile_created' AND a.details->>'request_id'=p_request_id::text;
 IF v_profile_id IS NOT NULL THEN RETURN jsonb_build_object('id',v_profile_id,'pending_adult',(SELECT consent_state='pending' FROM bts_private.profile_controls WHERE profile_controls.profile_id=v_profile_id));END IF;
 IF NOT EXISTS(SELECT 1 FROM bts_private.households WHERE id=p_circle_id AND creator_id=auth.uid()) THEN RAISE EXCEPTION 'Create your circle first, or choose a circle you own.';END IF;
 own_id:=public.bts_ensure_own_profile();
 IF own_id IS NULL THEN RAISE EXCEPTION 'Accept your profile invitation before adding another person.';END IF;
 IF jsonb_typeof(p_profile) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_profile) k WHERE k<>ALL(ARRAY['legal_first_name','legal_last_name','date_of_birth','headshot_url'])) THEN RAISE EXCEPTION 'Use the name, date of birth and photo fields.';END IF;
 birth:=(p_profile->>'date_of_birth')::date;first_name:=trim(p_profile->>'legal_first_name');last_name:=coalesce(trim(p_profile->>'legal_last_name'),'');photo:=p_profile->>'headshot_url';
 IF coalesce(length(first_name),0)=0 OR length(first_name)>120 OR length(last_name)>120 THEN RAISE EXCEPTION 'Enter the person’s first and last name.';END IF;
 IF birth IS NULL OR birth>current_date OR birth<(current_date-interval '120 years')::date THEN RAISE EXCEPTION 'Enter a valid date of birth.';END IF;
 IF photo IS NULL OR photo NOT LIKE 'https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/v1/object/public/profile-headshots/'||auth.uid()::text||'/%' THEN RAISE EXCEPTION 'Upload a headshot or profile photo using your account.';END IF;
 SELECT credit_name INTO parent_name FROM public.profiles WHERE id=own_id;
 adult:=birth<=(current_date-interval '18 years')::date;
 data:=jsonb_build_object('legal_first_name',first_name,'legal_last_name',last_name,'credit_name',trim(first_name||' '||last_name),'date_of_birth',birth,'headshot_url',photo,'headshot_urls',jsonb_build_array(photo));
 IF NOT adult THEN
  v_profile_id:=public.bts_save_profile(data||jsonb_build_object('relationship_kind','child','guardian_name',parent_name),NULL,p_guardian_confirmed);
 ELSE
  -- An adult's details stay pending until they grant permission through their own login.
  v_profile_id:=bts_private.save_profile_before_households(data,NULL,false);
  INSERT INTO bts_private.profile_controls(profile_id,creator_id,manager_id,kind,consent_state) VALUES(v_profile_id,auth.uid(),auth.uid(),'adult','pending');
  INSERT INTO bts_private.profile_keys(profile_id,user_id,kind,active) VALUES(v_profile_id,auth.uid(),'delegate',false);
 END IF;
 PERFORM public.bts_family('add_to_household',jsonb_build_object('household_id',p_circle_id,'profile_id',own_id));
 IF adult THEN INSERT INTO bts_private.household_profiles(household_id,profile_id) VALUES(p_circle_id,v_profile_id);
 ELSE PERFORM public.bts_family('add_to_household',jsonb_build_object('household_id',p_circle_id,'profile_id',v_profile_id));END IF;
 PERFORM public.bts_bind_profile_file(v_profile_id,photo);
 INSERT INTO bts_private.family_audit(profile_id,household_id,actor_id,action,details) VALUES(v_profile_id,p_circle_id,auth.uid(),'circle_basic_profile_created',jsonb_build_object('request_id',p_request_id));
 RETURN jsonb_build_object('id',v_profile_id,'pending_adult',adult);
END $$;
REVOKE ALL ON FUNCTION public.bts_create_circle_profile(uuid,jsonb,boolean,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_create_circle_profile(uuid,jsonb,boolean,uuid) TO authenticated;

-- Transfers reuse the existing recipient-bound, single-use activation invitations.
CREATE FUNCTION public.bts_profile_transfer(p_action text,p_profile_id uuid,p_email text DEFAULT NULL,p_keep_circle boolean DEFAULT true) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c bts_private.profile_controls%rowtype;p public.profiles%rowtype;i uuid;token text;target_email text:=lower(trim(p_email));eligible boolean;
BEGIN
 IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with your adult account.';END IF;
 SELECT * INTO c FROM bts_private.profile_controls WHERE profile_id=p_profile_id AND manager_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Only this profile’s primary manager can arrange a transfer.';END IF;
 SELECT * INTO p FROM public.profiles WHERE id=p_profile_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This profile is not available.';END IF;
 eligible:=c.consent_state IN('pending','active') AND c.subject_id IS NULL AND p.date_of_birth<=(current_date-interval '18 years')::date;
 IF p_action='status' THEN RETURN jsonb_build_object('eligible',eligible,'name',p.credit_name,'message',CASE WHEN c.subject_id IS NOT NULL THEN 'This profile already has its own login. Change its login email in Account settings.' WHEN NOT eligible THEN 'This person can take over their profile when they are 18 or over. Until then, an adult manages it.' ELSE 'Send an invitation to the person taking over this profile. Their adult account must have the same date of birth.' END);END IF;
 IF p_action<>'request' OR NOT eligible THEN RAISE EXCEPTION 'This profile cannot be transferred to its own login yet.';END IF;
 IF target_email IS NULL OR target_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(target_email)>320 OR target_email=(SELECT lower(u.email) FROM auth.users u WHERE u.id=auth.uid()) THEN RAISE EXCEPTION 'Enter the new account holder’s email address.';END IF;
 IF(SELECT count(*) FROM bts_private.family_invites WHERE sender_id=auth.uid() AND created_at>now()-interval '1 hour')>=20 THEN RAISE EXCEPTION 'Invitation limit reached. Please try later.';END IF;
 IF EXISTS(SELECT 1 FROM bts_private.profile_controls pc JOIN auth.users u ON u.id=pc.subject_id WHERE lower(u.email)=target_email AND pc.profile_id<>p_profile_id) THEN RAISE EXCEPTION 'That account already has a personal profile. Request a review so neither profile’s history is lost.';END IF;
 IF EXISTS(SELECT 1 FROM bts_private.family_invites f WHERE f.profile_id=p_profile_id AND f.kind='delegate' AND f.state='accepted') AND NOT EXISTS(SELECT 1 FROM bts_private.family_invites f WHERE f.profile_id=p_profile_id AND f.kind='delegate' AND f.state='accepted' AND f.email=target_email) THEN RAISE EXCEPTION 'Send the transfer to the adult who confirmed permission, or request a review.';END IF;
 UPDATE bts_private.family_invites SET state='revoked' WHERE profile_id=p_profile_id AND kind='claim' AND state='pending';
 token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 INSERT INTO bts_private.family_invites(sender_id,profile_id,email,kind,token_hash) VALUES(auth.uid(),p_profile_id,target_email,'claim',encode(sha256(convert_to(token,'UTF8')),'hex')) RETURNING id INTO i;
 INSERT INTO bts_private.family_audit(profile_id,actor_id,action,details) VALUES(p_profile_id,auth.uid(),'profile_transfer_requested',jsonb_build_object('invitation_id',i,'keep_circle',p_keep_circle));
 INSERT INTO bts_private.family_mail(actor_id,recipient,kind,profile_id,payload) VALUES(auth.uid(),target_email,'invitation',p_profile_id,jsonb_build_object('invite_id',i,'token',token,'permission','claim','inviter',coalesce((SELECT owner_profile.credit_name FROM public.profiles owner_profile JOIN bts_private.profile_controls owner_control ON owner_control.profile_id=owner_profile.id WHERE owner_control.subject_id=auth.uid()),'The profile manager'),'transfer',true,'keep_circle',p_keep_circle));
 RETURN jsonb_build_object('id',i);
END $$;
REVOKE ALL ON FUNCTION public.bts_profile_transfer(text,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_profile_transfer(text,uuid,text,boolean) TO authenticated;

ALTER FUNCTION public.bts_family(text,jsonb) SET SCHEMA bts_private;
ALTER FUNCTION bts_private.bts_family(text,jsonb) RENAME TO family_before_profile_transfers;
REVOKE ALL ON FUNCTION bts_private.family_before_profile_transfers(text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bts_family(p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE i bts_private.family_invites%rowtype;request jsonb;result jsonb;keep_circle boolean;
BEGIN
 IF p_action IN('preview','accept') THEN
  SELECT * INTO i FROM bts_private.family_invites WHERE token_hash=encode(sha256(convert_to(coalesce(p_data->>'token',''),'UTF8')),'hex') AND kind='claim' FOR UPDATE;
  SELECT a.details INTO request FROM bts_private.family_audit a WHERE a.action='profile_transfer_requested' AND a.details->>'invitation_id'=i.id::text;
  IF request IS NOT NULL THEN
   IF p_action='accept' THEN
    PERFORM 1 FROM bts_private.account_controls WHERE user_id=auth.uid() FOR UPDATE;
    IF EXISTS(SELECT 1 FROM bts_private.profile_controls WHERE subject_id=auth.uid() AND profile_id<>i.profile_id) THEN RAISE EXCEPTION 'Your account already has a personal profile. Request a review before transferring another one.';END IF;
   END IF;
   result:=bts_private.family_before_profile_transfers(p_action,p_data);
   keep_circle:=coalesce((p_data->>'keep_circle')::boolean,(request->>'keep_circle')::boolean,true);
   IF p_action='preview' THEN RETURN (result-'date_of_birth')||jsonb_build_object('transfer',true,'keep_circle',keep_circle);END IF;
   UPDATE bts_private.profile_keys SET active=false WHERE profile_id=i.profile_id AND user_id<>auth.uid();
   UPDATE bts_private.profile_contacts SET active=false WHERE profile_id=i.profile_id AND user_id IS DISTINCT FROM auth.uid();
   UPDATE bts_private.profile_controls SET manager_id=auth.uid(),subject_id=auth.uid(),kind='self',consent_state='active' WHERE profile_id=i.profile_id;
   UPDATE public.profiles SET user_id=auth.uid(),account_id=auth.uid(),email=(SELECT email FROM auth.users WHERE id=auth.uid()) WHERE id=i.profile_id;
   IF NOT keep_circle THEN DELETE FROM bts_private.household_profiles WHERE profile_id=i.profile_id;
   ELSE INSERT INTO bts_private.household_members(household_id,user_id) SELECT household_id,auth.uid() FROM bts_private.household_profiles WHERE profile_id=i.profile_id ON CONFLICT DO NOTHING;END IF;
   UPDATE bts_private.family_invites SET state='revoked' WHERE profile_id=i.profile_id AND state='pending';
   INSERT INTO bts_private.family_audit(profile_id,actor_id,action,details) VALUES(i.profile_id,auth.uid(),'profile_transfer_accepted',jsonb_build_object('invitation_id',i.id,'previous_manager',i.sender_id,'keep_circle',keep_circle));
   RETURN result||jsonb_build_object('transferred',true);
  END IF;
 END IF;
 RETURN bts_private.family_before_profile_transfers(p_action,p_data);
END $$;
REVOKE ALL ON FUNCTION public.bts_family(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bts_family(text,jsonb) TO anon,authenticated;
