-- Range-bound member calendars. Existing records and call lists remain canonical.
CREATE FUNCTION public.bts_member_calendar(p_profile_ids uuid[],p_start date,p_end date,p_production_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE home jsonb; profile uuid; prod uuid; apps jsonb; shifts jsonb; team boolean; cast_member boolean; characters text[];
 result jsonb:='[]'; rows jsonb; item jsonb; session public.audition_sessions%rowtype; timed public.audition_time_slots%rowtype; legacy public.audition_slots%rowtype; day date; begins timestamp; finishes timestamp; clock time; event_type text; production_name text;
BEGIN
 IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with your adult account.';END IF;
 IF p_start IS NULL OR p_end IS NULL OR p_end<=p_start OR p_end-p_start>93 OR p_profile_ids IS NULL OR cardinality(p_profile_ids)>100 THEN RAISE EXCEPTION 'Choose a calendar range of up to 93 days.';END IF;
 FOREACH profile IN ARRAY p_profile_ids LOOP
  IF profile IS NULL OR NOT public.bts_profile_access(profile,true) THEN RAISE EXCEPTION 'This profile is not available to your account.';END IF;
 END LOOP;
 IF cardinality(p_profile_ids)=0 THEN RETURN '[]';END IF;
 home:=public.bts_my_home(p_production_id);
 FOR profile IN SELECT DISTINCT unnest(p_profile_ids) LOOP
  SELECT coalesce(jsonb_agg(a),'[]') INTO apps FROM jsonb_array_elements(home->'activities') a WHERE a->>'profile_id'=profile::text AND coalesce(a->>'status','') !~* '(cancel|withdraw|declin|reject|archiv)';
  SELECT coalesce(jsonb_agg(v),'[]') INTO shifts FROM jsonb_array_elements(home->'volunteers') v WHERE v->>'profile_id'=profile::text AND coalesce(v->>'status','') !~* '(cancel|withdraw|declin|reject|archiv)';
  FOR prod IN SELECT DISTINCT (x->>'production_id')::uuid FROM(SELECT value x FROM jsonb_array_elements(apps) UNION ALL SELECT value FROM jsonb_array_elements(shifts) UNION ALL SELECT value FROM jsonb_array_elements(home->'participations') WHERE value->>'profile_id'=profile::text) all_rows LOOP
   IF p_production_id IS NOT NULL AND prod<>p_production_id THEN CONTINUE;END IF;
   SELECT title INTO production_name FROM public.productions WHERE id=prod;
   team:=EXISTS(SELECT 1 FROM jsonb_array_elements(home->'participations') t WHERE t->>'profile_id'=profile::text AND t->>'production_id'=prod::text);
   SELECT coalesce(array_agg(DISTINCT c.character_id::text),'{}') INTO characters FROM public.casting_assignments c WHERE c.production_id=prod AND NOT coalesce(c.dropped_out,false) AND EXISTS(SELECT 1 FROM jsonb_array_elements(apps) a WHERE a->>'production_id'=prod::text AND c.applicant_id::text IN(a->>'id',a->>'booking_id') AND(c.state='offer_accepted' OR a->'custom_answers'->>'__bts_cast_offer_status'='accepted' OR a->'custom_answers'->>'__bts_registration_complete'='true'));
   cast_member:=cardinality(characters)>0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(apps) a WHERE a->>'production_id'=prod::text AND(a->'custom_answers'->>'__bts_cast_offer_status'='accepted' OR a->'custom_answers'->>'__bts_registration_complete'='true'));
   SELECT coalesce(jsonb_agg(row ORDER BY at),'[]') INTO rows FROM(
    SELECT e.start_time AS at,jsonb_build_object('id','event:'||e.id,'profile_id',profile,'production_id',prod,'production',production_name,'title',e.title,'event_type',e.event_type,'start_time',e.start_time,'end_time',e.end_time,'all_day',e.all_day,'time_tbd',e.time_tbd,'venue',coalesce(v.name,e.venue),'address',v.address,'arrive_note',e.arrive_note,'bring_note',e.bring_note,'know_note',e.know_note,
    'call_status',CASE WHEN cast_member AND e.show_in_cast_schedule AND(e.called_cast->>'type'='all' OR((e.called_cast->>'type'='individuals' OR(e.called_cast IS NULL AND jsonb_array_length(coalesce(e.called_character_ids,'[]'))>0)) AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(e.called_cast->'character_ids',e.called_character_ids,'[]')) c WHERE c=ANY(characters)))) THEN 'called' WHEN cast_member AND e.show_in_cast_schedule AND coalesce(e.called_cast->>'type',CASE WHEN jsonb_array_length(coalesce(e.called_character_ids,'[]'))>0 THEN 'individuals' ELSE 'tbd' END)='tbd' THEN 'unconfirmed' ELSE 'information' END) AS row
    FROM public.production_events e JOIN public.productions p ON p.id=e.production_id LEFT JOIN LATERAL(SELECT name,address FROM public.venues v WHERE v.org_id=p.organization_id AND(v.id::text=e.venue OR v.name=e.venue OR v.nickname=e.venue) LIMIT 1)v ON true
    WHERE e.production_id=prod AND coalesce(e.end_time,e.start_time)>=(p_start-1)::timestamp AT TIME ZONE 'UTC' AND e.start_time<(p_end+1)::timestamp AT TIME ZONE 'UTC'
    AND((team AND public.bts_production_page_permission(prod,'production_calendar',1)) OR e.is_public OR(cast_member AND e.show_in_cast_schedule AND(coalesce(e.called_cast->>'type',CASE WHEN jsonb_array_length(coalesce(e.called_character_ids,'[]'))>0 THEN 'individuals' ELSE 'tbd' END) IN('all','tbd') OR((e.called_cast->>'type'='individuals' OR(e.called_cast IS NULL AND jsonb_array_length(coalesce(e.called_character_ids,'[]'))>0)) AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(e.called_cast->'character_ids',e.called_character_ids,'[]')) c WHERE c=ANY(characters))))))
   ) scoped;
   result:=result||rows;
  END LOOP;
  -- Audition dates and times belong to the member's actual booked slot.
  FOR item IN SELECT value FROM jsonb_array_elements(apps) WHERE value->>'type'='booking' OR nullif(value->>'slot_id','') IS NOT NULL OR nullif(value->>'booking_id','') IS NOT NULL LOOP
   SELECT * INTO session FROM public.audition_sessions WHERE id=public.try_uuid(item->>'session_id') AND production_id=(item->>'production_id')::uuid;
   SELECT * INTO timed FROM public.audition_time_slots WHERE id=public.try_uuid(item->>'slot_id') AND session_id=session.id;
   SELECT * INTO legacy FROM public.audition_slots WHERE id=public.try_uuid(item->>'slot_id') AND production_id=(item->>'production_id')::uuid;
   day:=coalesce(timed.slot_date,legacy.date,CASE WHEN session.end_date IS NULL OR session.end_date=session.date THEN session.date END);
   IF day IS NULL OR day<p_start OR day>=p_end THEN CONTINUE;END IF;
   clock:=coalesce(timed.slot_time,legacy.start_time,CASE WHEN session.booking_mode='group' THEN session.start_time END);
   begins:=day+coalesce(clock,'00:00'::time);finishes:=NULL;
   IF legacy.end_time IS NOT NULL THEN finishes:=day+legacy.end_time+CASE WHEN legacy.end_time<clock THEN interval '1 day' ELSE interval '0' END;
   ELSIF timed.slot_time IS NOT NULL AND session.slot_length BETWEEN 1 AND 480 THEN finishes:=begins+make_interval(mins=>session.slot_length);
   ELSIF session.booking_mode='group' AND session.end_time IS NOT NULL THEN finishes:=day+session.end_time+CASE WHEN session.end_time<clock THEN interval '1 day' ELSE interval '0' END;END IF;
   event_type:=CASE WHEN session.type IN('callback','dance_call','other_audition') THEN session.type ELSE 'audition' END;
   SELECT title INTO production_name FROM public.productions WHERE id=(item->>'production_id')::uuid;
   result:=result||jsonb_build_array(jsonb_build_object('id','audition:'||profile||':'||coalesce(item->>'session_id','')||':'||coalesce(item->>'slot_id',item->>'booking_id',item->>'id'),'profile_id',profile,'production_id',item->>'production_id','production',production_name,'title',CASE event_type WHEN 'callback' THEN 'Callback' WHEN 'dance_call' THEN 'Dance call' ELSE 'Audition' END,'event_type',event_type,'start_time',begins,'end_time',finishes,'time_tbd',clock IS NULL,'venue',session.location,'know_note',session.prepare_text,'call_status','booked'));
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(shifts) LOOP
   SELECT title INTO production_name FROM public.productions WHERE id=(item->>'production_id')::uuid;
   FOR day IN SELECT DISTINCT value::date FROM jsonb_array_elements_text(coalesce(item->'required_dates','[]')||CASE WHEN nullif(item->>'shift_date','') IS NOT NULL THEN jsonb_build_array(item->>'shift_date') ELSE '[]'::jsonb END) WHERE value ~ '^\d{4}-\d{2}-\d{2}$' LOOP
    IF day<p_start OR day>=p_end THEN CONTINUE;END IF;
    clock:=nullif(item->>'shift_start_time','')::time;begins:=day+coalesce(clock,'00:00'::time);finishes:=NULL;
    IF nullif(item->>'shift_end_time','') IS NOT NULL THEN finishes:=day+(item->>'shift_end_time')::time+CASE WHEN(item->>'shift_end_time')::time<clock THEN interval '1 day' ELSE interval '0' END;END IF;
    result:=result||jsonb_build_array(jsonb_build_object('id','shift:'||(item->>'id')||':'||day,'profile_id',profile,'production_id',item->>'production_id','production',production_name,'title',coalesce(nullif(item->>'role_name',''),'Volunteer shift'),'event_type','crew','start_time',begins,'end_time',finishes,'time_tbd',clock IS NULL,'call_status',CASE WHEN item->>'status'='pending' THEN 'requested' ELSE 'shift' END));
   END LOOP;
  END LOOP;
 END LOOP;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.bts_member_calendar(uuid[],date,date,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_member_calendar(uuid[],date,date,uuid) TO authenticated;
