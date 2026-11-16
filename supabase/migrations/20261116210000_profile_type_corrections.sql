-- Correct mistaken entity setup without reclassifying productions or granting metadata-based access.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='90s';
-- The existing slug CHECK invokes a legacy SQL helper; pin its lookup path when called from a definer with an empty path.
ALTER FUNCTION public.is_blocked_organization_slug(text) SET search_path=pg_catalog,public,extensions,pg_temp;
ALTER TABLE public.organizations ADD COLUMN profile_archived_at timestamptz;
CREATE TABLE bts_private.profile_type_corrections(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid NOT NULL REFERENCES auth.users(id),
 source_type text NOT NULL CHECK(source_type IN('member','organisation')),source_id uuid NOT NULL,
 target_type text NOT NULL CHECK(target_type IN('member','organisation')),target_id uuid,
 details jsonb NOT NULL DEFAULT '{}',state text NOT NULL CHECK(state IN('completed','needs_review','declined')),
 reason text,created_at timestamptz NOT NULL DEFAULT now(),resolved_at timestamptz,
 CHECK(source_type<>target_type)
);
CREATE INDEX profile_type_correction_actor ON bts_private.profile_type_corrections(actor_id,created_at DESC);
REVOKE ALL ON bts_private.profile_type_corrections FROM PUBLIC,anon,authenticated;

CREATE FUNCTION bts_private.profile_type_dependencies(p_kind text,p_id uuid,p_actor uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE relation record; found_row boolean; target regclass;
BEGIN
 target:=CASE p_kind WHEN 'member' THEN 'public.profiles'::regclass ELSE 'public.organizations'::regclass END;
 -- Intrinsic identity/control records remain private history. All business relationships block automatic correction.
 FOR relation IN SELECT n.nspname,c.relname,a.attname FROM pg_constraint f JOIN pg_class c ON c.oid=f.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=f.conkey[1]
 WHERE f.contype='f' AND f.confrelid=target AND cardinality(f.conkey)=1 AND NOT(p_kind='member' AND n.nspname='bts_private' AND c.relname IN('profile_controls','profile_keys','profile_contacts','family_audit')) LOOP
  IF p_kind='organisation' AND relation.nspname='public' AND relation.relname='org_members' THEN
   EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I=$1 AND user_id IS DISTINCT FROM $2)',relation.nspname,relation.relname,relation.attname) INTO found_row USING p_id,p_actor;
  ELSE EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I=$1)',relation.nspname,relation.relname,relation.attname) INTO found_row USING p_id;END IF;
  IF found_row THEN RETURN true;END IF;
 END LOOP;
 -- Composite references require review rather than assuming they are safe to move.
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE contype='f' AND confrelid=target AND cardinality(conkey)>1) THEN RETURN true;END IF;
 IF p_kind='member' AND EXISTS(SELECT 1 FROM bts_private.profile_contacts WHERE profile_id=p_id AND active AND user_id IS DISTINCT FROM p_actor) THEN RETURN true;END IF;
 IF p_kind='member' AND EXISTS(SELECT 1 FROM bts_private.profile_keys WHERE profile_id=p_id AND user_id<>p_actor AND active) THEN RETURN true;END IF;
 RETURN false;
END $$;
REVOKE ALL ON FUNCTION bts_private.profile_type_dependencies(text,uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bts_profile_type_options() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE members jsonb; orgs jsonb; history jsonb; person_name text;
BEGIN
 IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with your adult account.';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',coalesce(p.credit_name,p.name))),'[]') INTO members FROM public.profiles p JOIN bts_private.profile_controls c ON c.profile_id=p.id WHERE c.subject_id=auth.uid() AND c.kind='self' AND c.consent_state='active' AND p.deleted_at IS NULL;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name)),'[]') INTO orgs FROM public.organizations o WHERE o.admin_id=auth.uid() AND o.profile_archived_at IS NULL;
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO history FROM(SELECT id,source_type,target_type,target_id,state,reason,created_at FROM bts_private.profile_type_corrections WHERE actor_id=auth.uid() ORDER BY created_at DESC LIMIT 10)x;
 SELECT trim(coalesce(raw_user_meta_data->>'first_name','')||' '||coalesce(raw_user_meta_data->>'last_name','')) INTO person_name FROM auth.users WHERE id=auth.uid();
 RETURN jsonb_build_object('members',members,'organisations',orgs,'history',history,'person_name',person_name);
END $$;
REVOKE ALL ON FUNCTION public.bts_profile_type_options() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_profile_type_options() TO authenticated;

CREATE FUNCTION bts_private.apply_profile_type_correction(p_actor uuid,p_kind text,p_source uuid,p_details jsonb,p_request uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE request_id uuid; target uuid; label text; mail text; handle text; person public.profiles%rowtype; control bts_private.profile_controls%rowtype; archived timestamptz;
BEGIN
 IF p_actor IS DISTINCT FROM auth.uid() OR NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Use your own active adult account.';END IF;
 IF p_kind IS NULL OR p_kind NOT IN('member','organisation') OR p_source IS NULL OR jsonb_typeof(p_details) IS DISTINCT FROM 'object' OR length(p_details::text)>5000 THEN RAISE EXCEPTION 'Choose the specific profile to correct.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text||':profile-type-correction',0));
 IF p_kind='member' THEN
  SELECT c.* INTO control FROM bts_private.profile_controls c JOIN public.profiles p ON p.id=c.profile_id WHERE c.profile_id=p_source AND c.subject_id=p_actor AND c.kind='self' AND c.consent_state='active' AND p.deleted_at IS NULL FOR UPDATE OF c,p;
  IF control.profile_id IS NULL THEN RAISE EXCEPTION 'Only your own adult member profile can be corrected. Child and delegated profiles cannot become organisations.';END IF;
  target:=public.try_uuid(p_details->>'organisation_id');
  IF coalesce(p_details->>'organisation_id','')<>'' AND target IS NULL THEN RAISE EXCEPTION 'Choose a valid organisation.';END IF;
  IF target IS NOT NULL THEN
   PERFORM 1 FROM public.organizations WHERE id=target AND admin_id=p_actor AND profile_archived_at IS NULL FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Choose an organisation you own.';END IF;
  ELSE
   label:=trim(coalesce(p_details->>'name',''));mail:=lower(trim(coalesce(p_details->>'email','')));handle:=lower(trim(coalesce(p_details->>'slug','')));
   IF length(label)<2 OR length(label)>150 OR length(mail)>320 OR mail!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Enter the organisation name and a valid contact email.';END IF;
   IF handle!~'^[a-z0-9]+(-[a-z0-9]+)*$' OR length(handle) NOT BETWEEN 3 AND 50 OR handle=ANY(ARRAY['activities','manage','org','member','members','find','pricing','opportunity','invite','audition','audition-info','forgot-password','reset-password','callback-sides','callbacksides','privacy','terms','copyright','accessibility','volunteers','volunteer','volunteer-quiz','functions','supabase']) OR NOT public.organization_slug_available(handle,NULL) THEN RAISE EXCEPTION 'Choose an available organisation address. Website routes cannot be used.';END IF;
  END IF;
 ELSE
  SELECT profile_archived_at INTO archived FROM public.organizations WHERE id=p_source AND admin_id=p_actor FOR UPDATE;
  IF NOT FOUND OR archived IS NOT NULL THEN RAISE EXCEPTION 'Only the current organisation owner can correct this profile.';END IF;
  SELECT p.* INTO person FROM public.profiles p JOIN bts_private.profile_controls c ON c.profile_id=p.id WHERE c.subject_id=p_actor AND c.kind='self' AND c.consent_state='active';
  label:=trim(coalesce(p_details->>'person_name',''));
  IF person.id IS NULL AND (length(label)<2 OR length(label)>150) THEN RAISE EXCEPTION 'Enter your own name for the member profile, not the organisation name.';END IF;
 END IF;
 IF bts_private.profile_type_dependencies(p_kind,p_source,p_actor) THEN
  SELECT id INTO request_id FROM bts_private.profile_type_corrections WHERE actor_id=p_actor AND source_type=p_kind AND source_id=p_source AND state='needs_review' ORDER BY created_at DESC LIMIT 1;
  IF request_id IS NULL THEN
   INSERT INTO bts_private.profile_type_corrections(actor_id,source_type,source_id,target_type,details,state,reason) VALUES(p_actor,p_kind,p_source,CASE p_kind WHEN 'member' THEN 'organisation' ELSE 'member' END,p_details,'needs_review','Existing records or other people are connected. Ownership and history must be resolved before correction.') RETURNING id INTO request_id;
  END IF;
  RETURN jsonb_build_object('id',request_id,'state','needs_review','message','Review requested. No profile type or access has changed; existing records need a protected review.');
 END IF;
 IF p_kind='member' THEN
  IF target IS NULL THEN
   INSERT INTO public.organizations(name,email,slug,custom_id,admin_id,profile_public,account_owner_type) VALUES(label,mail,handle,'ORG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,5)),p_actor,false,'personal') RETURNING id INTO target;
  END IF;
  UPDATE public.profiles SET deleted_at=now() WHERE id=p_source;
 ELSE
  IF person.id IS NOT NULL THEN
   IF person.deleted_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM bts_private.profile_type_corrections WHERE actor_id=p_actor AND source_type='member' AND source_id=person.id AND state='completed') THEN RAISE EXCEPTION 'Your archived personal profile needs a review before it can be restored.';END IF;
   UPDATE public.profiles SET deleted_at=NULL WHERE id=person.id;target:=person.id;
  ELSE
   target:=public.bts_save_profile(jsonb_build_object('credit_name',label,'legal_first_name',split_part(label,' ',1),'legal_last_name',trim(substr(label,length(split_part(label,' ',1))+1)),'date_of_birth',(SELECT birth_date FROM bts_private.account_controls WHERE user_id=p_actor),'relationship_kind','self'),NULL,false);
  END IF;
  UPDATE public.organizations SET profile_archived_at=now(),profile_public=false WHERE id=p_source;
 END IF;
 IF p_request IS NULL THEN
  INSERT INTO bts_private.profile_type_corrections(actor_id,source_type,source_id,target_type,target_id,details,state,resolved_at) VALUES(p_actor,p_kind,p_source,CASE p_kind WHEN 'member' THEN 'organisation' ELSE 'member' END,target,p_details,'completed',now()) RETURNING id INTO request_id;
 ELSE
  UPDATE bts_private.profile_type_corrections SET target_id=target,state='completed',resolved_at=now() WHERE id=p_request AND actor_id=p_actor AND state='needs_review' RETURNING id INTO request_id;
  IF request_id IS NULL THEN RAISE EXCEPTION 'Pending correction not found.';END IF;
 END IF;
 INSERT INTO bts_private.family_audit(actor_id,action,details) VALUES(p_actor,'profile_type_corrected',jsonb_build_object('request_id',request_id,'source_type',p_kind,'source_id',p_source,'target_id',target));
 RETURN jsonb_build_object('id',request_id,'state','completed','target_id',target,'target_type',CASE p_kind WHEN 'member' THEN 'organisation' ELSE 'member' END,'url',CASE p_kind WHEN 'member' THEN '/org/dashboard?id='||target::text ELSE '/member/profile?id='||target::text END,'message','Profile setup corrected. The original record is retained privately for history.');
END $$;
REVOKE ALL ON FUNCTION bts_private.apply_profile_type_correction(uuid,text,uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bts_correct_profile_type(p_source_type text,p_source_id uuid,p_details jsonb,p_confirmed boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.bts_account_is_active() OR p_confirmed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Confirm the profile correction using your adult account.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':profile-type-correction',0));
 IF (SELECT count(*) FROM bts_private.profile_type_corrections WHERE actor_id=auth.uid() AND created_at>now()-interval '1 day')>=10 THEN RAISE EXCEPTION 'Correction request limit reached. Contact support for help.';END IF;
 RETURN bts_private.apply_profile_type_correction(auth.uid(),p_source_type,p_source_id,p_details);
END $$;
REVOKE ALL ON FUNCTION public.bts_correct_profile_type(text,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_correct_profile_type(text,uuid,jsonb,boolean) TO authenticated;

CREATE FUNCTION public.bts_resolve_profile_type_correction(p_id uuid,p_approved boolean,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE request bts_private.profile_type_corrections%rowtype; original_claims text; result jsonb;
BEGIN
 IF p_approved IS NULL THEN RAISE EXCEPTION 'Choose approve or decline.';END IF;
 IF length(trim(coalesce(p_reason,'')))<20 THEN RAISE EXCEPTION 'Record the authority checked and correction decision.';END IF;
 SELECT * INTO request FROM bts_private.profile_type_corrections WHERE id=p_id AND state='needs_review' FOR UPDATE;
 IF request.id IS NULL THEN RAISE EXCEPTION 'Pending correction not found.';END IF;
 IF NOT p_approved THEN UPDATE bts_private.profile_type_corrections SET state='declined',reason=p_reason,resolved_at=now() WHERE id=request.id;RETURN jsonb_build_object('state','declined');END IF;
 original_claims:=current_setting('request.jwt.claims',true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',request.actor_id,'role','authenticated')::text,true);
 result:=bts_private.apply_profile_type_correction(request.actor_id,request.source_type,request.source_id,request.details,request.id);
 PERFORM set_config('request.jwt.claims',coalesce(original_claims,''),true);
 IF result->>'state'<>'completed' THEN RAISE EXCEPTION 'Resolve linked records or ownership first; review approval cannot bypass them.';END IF;
 UPDATE bts_private.profile_type_corrections SET reason=p_reason WHERE id=request.id;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.bts_resolve_profile_type_correction(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_resolve_profile_type_correction(uuid,boolean,text) TO service_role;

-- Archived mistaken organisations no longer appear as active workspaces. Roles remain historical evidence.
DO $home$ DECLARE definition text; marker text:='FROM public.organizations o WHERE public.bts_organisation_role(o.id) IS NOT NULL';BEGIN
 definition:=pg_get_functiondef('public.bts_my_home(uuid)'::regprocedure);
 IF position(marker IN definition)=0 THEN RAISE EXCEPTION 'Review My Home before applying the correction filter.';END IF;
 EXECUTE replace(definition,marker,marker||' AND o.profile_archived_at IS NULL');
END $home$;
NOTIFY pgrst,'reload schema';
COMMIT;
