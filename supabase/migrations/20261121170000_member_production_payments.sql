BEGIN;
-- Reuse the existing permission/financial calculations. New projections add
-- organisation instructions and named access summaries, never another ledger.
ALTER FUNCTION public.bts_family_tracker(uuid) RENAME TO tracker_before_production_payments;
ALTER FUNCTION public.tracker_before_production_payments(uuid) SET SCHEMA bts_private;
REVOKE ALL ON FUNCTION bts_private.tracker_before_production_payments(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bts_family_tracker(p_profile_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb:='[]'; invoice jsonb; info record; settings jsonb;
BEGIN
 FOR invoice IN SELECT value FROM jsonb_array_elements(bts_private.tracker_before_production_payments(p_profile_id)) LOOP
  SELECT o.id,o.name,o.slug,o.abbreviation,o.email,o.etransfer_email,o.payment_settings,p.title,
   nullif(trim(regexp_replace(coalesce(p.registration_settings->'payment_settings'->>'instructions',''),'<[^>]*>','','g')),'') AS production_instructions,
   p.registration_settings->'payment_settings'->>'instructions' AS raw_instructions,
   p.registration_settings->'payment_settings'->>'etransfer_email' AS production_etransfer
   INTO info FROM public.productions p JOIN public.organizations o ON o.id=p.organization_id WHERE p.id=(invoice->>'production_id')::uuid;
  IF NOT FOUND THEN CONTINUE;END IF;
  settings:=invoice->'settings';
  IF nullif(settings->>'currency','') IS NULL AND nullif(info.payment_settings->>'currency','') IS NOT NULL THEN settings:=settings||jsonb_build_object('currency',info.payment_settings->>'currency');END IF;
  result:=result||jsonb_build_array(invoice||jsonb_build_object('settings',settings,'organisation',jsonb_build_object('id',info.id,'name',info.name,'slug',coalesce(nullif(info.abbreviation,''),info.slug),'contact_email',info.email),
    'payment_instructions',jsonb_build_object('html',CASE WHEN info.production_instructions IS NOT NULL THEN info.raw_instructions ELSE coalesce(info.payment_settings->>'manual_instructions','') END,
    'etransfer_email',CASE WHEN coalesce((info.payment_settings->>'etransfer_enabled')::boolean,true) OR nullif(info.production_etransfer,'') IS NOT NULL THEN coalesce(nullif(info.production_etransfer,''),info.etransfer_email) END,
    'source',CASE WHEN info.production_instructions IS NOT NULL THEN 'production' ELSE 'organisation' END)));
 END LOOP;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.bts_family_tracker(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_family_tracker(uuid) TO authenticated;

-- Display only accepted account-bound team participation on the person's own
-- profile. Owning an organisation alone does not put every production in a circle.
ALTER FUNCTION public.bts_my_home(uuid) RENAME TO home_before_production_participation;
ALTER FUNCTION public.home_before_production_participation(uuid) SET SCHEMA bts_private;
REVOKE ALL ON FUNCTION bts_private.home_before_production_participation(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bts_my_home(p_production_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; own_profile uuid; member jsonb; participation jsonb:='[]'; productions jsonb; events jsonb;
BEGIN
 result:=bts_private.home_before_production_participation(p_production_id);
 SELECT c.profile_id INTO own_profile FROM bts_private.profile_controls c WHERE c.subject_id=auth.uid() AND public.bts_profile_access(c.profile_id) LIMIT 1;
 productions:=coalesce(result->'productions','[]');
 IF own_profile IS NOT NULL THEN
  FOR member IN SELECT value FROM jsonb_array_elements(coalesce(result->'management','[]')) WHERE nullif(value->>'team_member_id','') IS NOT NULL LOOP
   participation:=participation||jsonb_build_array(jsonb_build_object('production_id',member->>'id','profile_id',own_profile,'role',member->>'position','status','accepted'));
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(productions) p WHERE p->>'id'=member->>'id') THEN
    productions:=productions||jsonb_build_array(jsonb_build_object('id',member->>'id','title',member->>'title','slug',member->>'slug','organisation_slug',member->>'organisation_slug'));
   END IF;
  END LOOP;
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'production_id',e.production_id,'title',e.title,'event_type',e.event_type,'start_time',e.start_time,'end_time',e.end_time,'venue',e.venue)),'[]') INTO events FROM public.bts_visible_production_events e WHERE e.production_id IN(SELECT (p->>'id')::uuid FROM jsonb_array_elements(productions) p) AND e.start_time>=now()-interval '1 day' AND e.start_time<now()+interval '90 days';
 RETURN result||jsonb_build_object('participations',participation,'productions',productions,'events',events);
END $$;
REVOKE ALL ON FUNCTION public.bts_my_home(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_my_home(uuid) TO authenticated;

CREATE FUNCTION public.bts_member_profile_access(p_profile_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE control bts_private.profile_controls%rowtype;
BEGIN
 IF NOT public.bts_profile_access(p_profile_id,true) THEN RAISE EXCEPTION 'This profile is not available to your account.';END IF;
 SELECT * INTO control FROM bts_private.profile_controls WHERE profile_id=p_profile_id;
 RETURN jsonb_build_object('profile_id',p_profile_id,'name',(SELECT credit_name FROM public.profiles WHERE id=p_profile_id),'kind',control.kind,'is_subject',control.subject_id=auth.uid(),'can_invite',public.bts_profile_manager(p_profile_id),
 'keys',coalesce((SELECT jsonb_agg(jsonb_build_object('id',k.user_id,'name',coalesce(nullif(k.declared_name,''),nullif(trim(coalesce(u.raw_user_meta_data->>'first_name','')||' '||coalesce(u.raw_user_meta_data->>'last_name','')),''),'Adult with access'),'kind',k.kind,'is_me',k.user_id=auth.uid(),'is_manager',k.user_id=control.manager_id,'receives_updates',EXISTS(SELECT 1 FROM bts_private.profile_contacts c WHERE c.profile_id=k.profile_id AND c.user_id=k.user_id AND c.active AND lower(c.email)=lower(u.email)))) FROM bts_private.profile_keys k JOIN auth.users u ON u.id=k.user_id WHERE k.profile_id=p_profile_id AND k.active),'[]'),
 'my_contacts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'email',c.email,'active',c.active)) FROM bts_private.profile_contacts c WHERE c.profile_id=p_profile_id AND c.user_id=auth.uid()),'[]'),
 'sent_invitations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'kind',i.kind,'state',CASE WHEN i.state='pending' AND i.expires_at<now() THEN 'expired' ELSE i.state END,'delivery',(SELECT m.state FROM bts_private.family_mail m WHERE m.payload->>'invite_id'=i.id::text ORDER BY m.created_at DESC LIMIT 1))) FROM bts_private.family_invites i WHERE i.profile_id=p_profile_id AND i.sender_id=auth.uid()),'[]'),
 'history',coalesce((SELECT jsonb_agg(jsonb_build_object('action',a.action,'at',a.created_at,'is_me',a.actor_id=auth.uid())) FROM(SELECT action,created_at,actor_id FROM bts_private.family_audit WHERE profile_id=p_profile_id ORDER BY created_at DESC LIMIT 15)a),'[]'));
END $$;
REVOKE ALL ON FUNCTION public.bts_member_profile_access(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_member_profile_access(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
