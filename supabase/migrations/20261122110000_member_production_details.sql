-- A member-facing production page, bound to one authorised profile at a time.
-- Existing participation, call lists, file permissions and organisation records remain canonical.
CREATE OR REPLACE FUNCTION public.bts_member_production_details(p_production_id uuid,p_profile_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE home jsonb; apps jsonb; shifts jsonb; team boolean; cast_member boolean; character_ids text[]; contact jsonb; contacts jsonb:='[]'; extra_contact jsonb; events jsonb; files jsonb; info jsonb;
BEGIN
 IF NOT public.bts_account_is_active() OR NOT public.bts_profile_access(p_profile_id,true) THEN RAISE EXCEPTION 'This profile is not available to your account.';END IF;
 home:=public.bts_my_home(p_production_id);
 SELECT coalesce(jsonb_agg(a),'[]') INTO apps FROM jsonb_array_elements(home->'activities') a WHERE a->>'profile_id'=p_profile_id::text AND coalesce(a->>'status','') !~* '(cancel|withdraw|declin|reject|archiv)';
 SELECT coalesce(jsonb_agg(v),'[]') INTO shifts FROM jsonb_array_elements(home->'volunteers') v WHERE v->>'profile_id'=p_profile_id::text AND coalesce(v->>'status','') !~* '(cancel|withdraw|declin|reject|archiv)';
 team:=EXISTS(SELECT 1 FROM jsonb_array_elements(home->'participations') t WHERE t->>'profile_id'=p_profile_id::text AND t->>'production_id'=p_production_id::text);
 IF jsonb_array_length(apps)=0 AND jsonb_array_length(shifts)=0 AND NOT team THEN RAISE EXCEPTION 'This production is not linked to this member.';END IF;
 SELECT coalesce(array_agg(DISTINCT c.character_id::text),'{}') INTO character_ids FROM public.casting_assignments c WHERE c.production_id=p_production_id AND NOT coalesce(c.dropped_out,false) AND EXISTS(SELECT 1 FROM jsonb_array_elements(apps) a WHERE c.applicant_id::text IN(a->>'id',a->>'booking_id') AND(c.state='offer_accepted' OR a->'custom_answers'->>'__bts_cast_offer_status'='accepted' OR a->'custom_answers'->>'__bts_registration_complete'='true'));
 cast_member:=cardinality(character_ids)>0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(apps) a WHERE a->'custom_answers'->>'__bts_cast_offer_status'='accepted' OR a->'custom_answers'->>'__bts_registration_complete'='true');
 -- Return only a production-facing contact, never the team directory or account credentials.
 SELECT jsonb_build_object('name',t.name,'role',t.role,'email',t.email,'phone',t.phone,'kind',CASE WHEN lower(t.role) ~ 'volunteer.*coord|coord.*volunteer' THEN 'volunteer' ELSE 'production' END) INTO contact
 FROM public.production_team_members t WHERE t.production_id=p_production_id AND t.is_active
 AND (lower(t.role) ~ '(^|[^a-z])producer([^a-z]|$)|production[ _-]*manager' OR (jsonb_array_length(shifts)>0 AND lower(t.role) ~ 'volunteer[ _-]*coord|coord.*volunteer'))
 ORDER BY CASE WHEN jsonb_array_length(shifts)>0 AND lower(t.role) ~ 'volunteer[ _-]*coord|coord.*volunteer' THEN 0 WHEN lower(t.role) ~ 'producer' THEN 1 ELSE 2 END,t.created_at,t.id LIMIT 1;
 IF contact IS NULL THEN SELECT jsonb_build_object('name',o.name,'role','Organisation contact','email',o.email,'phone',o.phone,'kind','organisation') INTO contact FROM public.productions p JOIN public.organizations o ON o.id=p.organization_id WHERE p.id=p_production_id AND o.show_contact AND (nullif(o.email,'') IS NOT NULL OR nullif(o.phone,'') IS NOT NULL);END IF;
 IF contact->>'kind'='volunteer' AND (jsonb_array_length(apps)>0 OR team) THEN
  SELECT jsonb_build_object('name',t.name,'role',t.role,'email',t.email,'phone',t.phone,'kind','production') INTO extra_contact FROM public.production_team_members t WHERE t.production_id=p_production_id AND t.is_active AND lower(t.role) ~ '(^|[^a-z])producer([^a-z]|$)|production[ _-]*manager' ORDER BY CASE WHEN lower(t.role) ~ 'producer' THEN 0 ELSE 1 END,t.created_at,t.id LIMIT 1;
  IF extra_contact IS NOT NULL THEN contacts:=jsonb_build_array(extra_contact);END IF;
 END IF;
 SELECT jsonb_build_object('id',p.id,'title',p.title,'description',p.description,'poster_url',p.poster_url,'start_date',p.start_date,'end_date',p.end_date,'venue',coalesce(v.name,p.venue),'address',v.address,'organisation',o.name) INTO info FROM public.productions p JOIN public.organizations o ON o.id=p.organization_id LEFT JOIN public.venues v ON v.org_id=p.organization_id AND(v.id::text=p.venue OR v.name=p.venue OR v.nickname=p.venue) WHERE p.id=p_production_id LIMIT 1;
 SELECT coalesce(jsonb_agg(row ORDER BY at),'[]') INTO events FROM(
  SELECT e.start_time AS at,jsonb_build_object('id',e.id,'title',e.title,'event_type',e.event_type,'start_time',e.start_time,'end_time',e.end_time,'all_day',e.all_day,'time_tbd',e.time_tbd,'venue',coalesce(v.name,e.venue),'address',v.address,'arrive_note',e.arrive_note,'bring_note',e.bring_note,'know_note',e.know_note,
   'call_status',CASE WHEN cast_member AND e.show_in_cast_schedule AND(e.called_cast->>'type'='all' OR((e.called_cast->>'type'='individuals' OR(e.called_cast IS NULL AND jsonb_array_length(coalesce(e.called_character_ids,'[]'))>0)) AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(e.called_cast->'character_ids',e.called_character_ids,'[]')) c WHERE c=ANY(character_ids)))) THEN 'called' WHEN cast_member AND e.show_in_cast_schedule AND coalesce(e.called_cast->>'type',CASE WHEN jsonb_array_length(coalesce(e.called_character_ids,'[]'))>0 THEN 'individuals' ELSE 'tbd' END)='tbd' THEN 'unconfirmed' ELSE 'information' END) AS row
  FROM public.production_events e JOIN public.productions p ON p.id=e.production_id LEFT JOIN LATERAL(SELECT name,address FROM public.venues v WHERE v.org_id=p.organization_id AND(v.id::text=e.venue OR v.name=e.venue OR v.nickname=e.venue) LIMIT 1)v ON true
  WHERE e.production_id=p_production_id AND e.start_time>=now()-interval '1 day'
  AND ((team AND public.bts_production_page_permission(p_production_id,'production_calendar',1)) OR e.is_public OR(cast_member AND e.show_in_cast_schedule AND(coalesce(e.called_cast->>'type',CASE WHEN jsonb_array_length(coalesce(e.called_character_ids,'[]'))>0 THEN 'individuals' ELSE 'tbd' END) IN('all','tbd') OR((e.called_cast->>'type'='individuals' OR(e.called_cast IS NULL AND jsonb_array_length(coalesce(e.called_character_ids,'[]'))>0)) AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(e.called_cast->'character_ids',e.called_character_ids,'[]')) c WHERE c=ANY(character_ids))))))
 ) scheduled;
 -- Keep working files behind their existing permission checks. No blanket cast/volunteer grant.
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'file_path',f.file_path,'file_url',f.file_url)),'[]') INTO files FROM public.production_files f WHERE f.production_id=p_production_id AND public.bts_file_permission('production-files',coalesce(f.file_path,''),1) AND((team AND public.bts_private_record_permission(p_production_id,'overview',1)) OR(EXISTS(SELECT 1 FROM public.audition_applications a WHERE a.production_id=p_production_id AND a.profile_id=p_profile_id AND coalesce(a.callback_status,'none')<>'none') AND EXISTS(SELECT 1 FROM public.bts_callback_files cf WHERE cf.id=f.id)));
 RETURN jsonb_build_object('profile_id',p_profile_id,'production',info,'contact',contact,'contacts',contacts,'events',events,'files',files,'is_cast',cast_member,'is_team',team);
END $$;
REVOKE ALL ON FUNCTION public.bts_member_production_details(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_member_production_details(uuid,uuid) TO authenticated;
