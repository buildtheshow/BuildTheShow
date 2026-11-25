BEGIN;
-- Existing rows remain the published snapshot. These new columns are private:
-- the existing, explicitly expanded bts_visible_audition_sessions view excludes them.
ALTER TABLE public.audition_sessions ADD COLUMN setup_draft jsonb;
ALTER TABLE public.audition_sessions ADD COLUMN setup_revision bigint NOT NULL DEFAULT 0;
ALTER TABLE public.audition_sessions ADD COLUMN setup_published_revision bigint NOT NULL DEFAULT 0;

CREATE FUNCTION bts_private.audition_setup_payload(p_value jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE result jsonb; BEGIN
 IF jsonb_typeof(p_value)<>'object' OR octet_length(p_value::text)>200000 THEN RAISE EXCEPTION 'This audition draft is too large.';END IF;
 SELECT coalesce(jsonb_object_agg(key,value),'{}') INTO result FROM jsonb_each(p_value)
 WHERE key=ANY(ARRAY['name','type','customName','audience','methods','mode','days','slot','gap','capacity','activities','prep','bring','access','finish','deadline','arrivalClose','registration']);
 IF coalesce(result->>'type','') NOT IN('audition','dance_call','callback','other') OR coalesce(result->>'mode','') NOT IN('appointment','arrival','group','walkin','assigned') THEN RAISE EXCEPTION 'Choose an audition type and booking arrangement.';END IF;
 IF jsonb_typeof(result->'days') IS DISTINCT FROM 'array' OR jsonb_array_length(result->'days') NOT BETWEEN 1 AND 31 OR jsonb_typeof(result->'methods') IS DISTINCT FROM 'array' OR jsonb_typeof(result->'activities') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Check the dates and ways to take part.';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(result->'methods') m WHERE m NOT IN('in_person','video_call','self_tape')) OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(result->'activities') a WHERE a NOT IN('singing','acting','movement','workshop','specialist')) THEN RAISE EXCEPTION 'Choose the available audition activities and ways to take part.';END IF;
 IF result->>'type'='callback' OR result->>'audience'='invited' THEN result:=jsonb_set(result,'{audience}','"invited"');ELSE result:=jsonb_set(result,'{audience}','"open"');END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION bts_private.audition_setup_payload(jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bts_audition_setup_load(p_production_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.bts_private_record_permission(p_production_id,'auditions.schedule',1) THEN RAISE EXCEPTION 'You do not have access to these audition drafts.';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
  'id',s.id,'draft',s.setup_draft,'revision',s.setup_revision,'published_revision',s.setup_published_revision,
  'published',jsonb_build_object('name',s.name,'type',s.type,'format',s.format,'date',s.date,'start_time',s.start_time,'end_time',s.end_time,'end_date',s.end_date,'location',s.location,'instructions',s.instructions,'prepare_text',s.prepare_text,'slot_length',s.slot_length,'buffer_time',s.buffer_time,'capacity_per_slot',s.capacity_per_slot,'booking_mode',s.booking_mode,'slot_blocks',s.slot_blocks,'is_visible',s.is_visible,'show_to_applicants',s.show_to_applicants)
 ) ORDER BY s.sort_order,s.created_at) FROM public.audition_sessions s WHERE s.production_id=p_production_id),'[]');
END $$;

CREATE FUNCTION public.bts_audition_setup_create(p_production_id uuid,p_session_id uuid,p_initial boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item public.audition_sessions%rowtype;BEGIN
 IF NOT public.bts_private_record_permission(p_production_id,'auditions.schedule',2) THEN RAISE EXCEPTION 'You do not have permission to edit auditions.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_production_id::text||':audition-setup',0));
 IF p_initial THEN SELECT * INTO item FROM public.audition_sessions WHERE production_id=p_production_id ORDER BY sort_order,created_at LIMIT 1;IF FOUND THEN RETURN jsonb_build_object('id',item.id,'draft',item.setup_draft,'revision',item.setup_revision,'published_revision',item.setup_published_revision);END IF;END IF;
 SELECT * INTO item FROM public.audition_sessions WHERE id=p_session_id;
 IF FOUND THEN IF item.production_id<>p_production_id THEN RAISE EXCEPTION 'Choose an audition for this production.';END IF;ELSE
 INSERT INTO public.audition_sessions(id,production_id,name,type,format,is_visible,enabled,show_to_applicants,sort_order)
 VALUES(p_session_id,p_production_id,'General audition','audition','in_person',false,false,false,(SELECT coalesce(max(sort_order),-1)+1 FROM public.audition_sessions WHERE production_id=p_production_id)) RETURNING * INTO item;
 END IF;
 RETURN jsonb_build_object('id',item.id,'draft',item.setup_draft,'revision',item.setup_revision,'published_revision',item.setup_published_revision);
END $$;

CREATE FUNCTION public.bts_audition_setup_save(p_session_id uuid,p_expected_revision bigint,p_draft jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item public.audition_sessions%rowtype;payload jsonb;BEGIN
 SELECT * INTO item FROM public.audition_sessions WHERE id=p_session_id;
 IF NOT FOUND OR NOT public.bts_private_record_permission(item.production_id,'auditions.schedule',2) THEN RAISE EXCEPTION 'You do not have permission to edit this audition.';END IF;
 SELECT * INTO item FROM public.audition_sessions WHERE id=p_session_id FOR UPDATE;
 IF item.setup_revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'This audition changed in another window. Reload before saving more changes.' USING ERRCODE='40001';END IF;
 payload:=bts_private.audition_setup_payload(p_draft);
 UPDATE public.audition_sessions SET setup_draft=payload,setup_revision=setup_revision+1 WHERE id=p_session_id RETURNING * INTO item;
 RETURN jsonb_build_object('id',item.id,'revision',item.setup_revision,'published_revision',item.setup_published_revision);
END $$;

CREATE FUNCTION public.bts_publish_audition_setup(p_production_id uuid,p_versions jsonb,p_open_bookings boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE item public.audition_sessions%rowtype;requested jsonb;d jsonb;day jsonb;first_day jsonb;blocks jsonb;block jsonb;metadata jsonb;wanted jsonb;entry jsonb;kept uuid[];slot_id uuid;clock time;ending time;cursor_at timestamp;end_at timestamp;minutes integer;gap integer;capacity integer;block_id text;live boolean;tape boolean;has_bookings boolean;old_signature jsonb;new_signature jsonb;venue text;slot_count integer:=0;published integer:=0;
BEGIN
 IF NOT public.bts_private_record_permission(p_production_id,'auditions.schedule',2) OR NOT public.bts_private_record_permission(p_production_id,'auditions.general',2) THEN RAISE EXCEPTION 'You do not have permission to publish auditions.';END IF;
 IF jsonb_typeof(p_versions) IS DISTINCT FROM 'array' OR jsonb_array_length(p_versions) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Choose the audition drafts to publish.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_production_id::text||':audition-setup',0));
 PERFORM 1 FROM public.audition_sessions WHERE production_id=p_production_id ORDER BY id FOR UPDATE;
 IF (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(p_versions))<>jsonb_array_length(p_versions) THEN RAISE EXCEPTION 'An audition is listed more than once.';END IF;
 FOR requested IN SELECT value FROM jsonb_array_elements(p_versions) LOOP
  SELECT * INTO item FROM public.audition_sessions WHERE id=(requested->>'id')::uuid AND production_id=p_production_id;
  IF NOT FOUND OR item.setup_revision IS DISTINCT FROM (requested->>'revision')::bigint OR item.setup_draft IS NULL THEN RAISE EXCEPTION 'An audition draft changed. Reload and review it again.' USING ERRCODE='40001';END IF;
  d:=bts_private.audition_setup_payload(item.setup_draft);tape:=(d->'methods'='["self_tape"]'::jsonb);
  IF nullif(trim(d->>'name'),'') IS NULL OR jsonb_array_length(d->'methods')=0 OR jsonb_array_length(d->'activities')=0 THEN RAISE EXCEPTION 'Add an audition name, a way to take part and an activity before publishing.';END IF;
  minutes:=coalesce(nullif(d->>'slot','')::integer,10);gap:=coalesce(nullif(d->>'gap','')::integer,0);capacity:=CASE WHEN d->>'mode'='appointment' THEN 1 ELSE coalesce(nullif(d->>'capacity','')::integer,1) END;
  IF minutes NOT BETWEEN 1 AND 240 OR gap NOT BETWEEN 0 AND 120 OR capacity NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Check the appointment length, break and number of places.';END IF;
  IF d->'methods' ? 'self_tape' AND nullif(d->>'deadline','') IS NULL THEN RAISE EXCEPTION 'Add a self-tape deadline.';END IF;
  IF d->'methods' ? 'self_tape' THEN PERFORM (d->>'deadline')::timestamp;END IF;
  blocks:='[]';wanted:='[]';kept:='{}';first_day:=NULL;
  IF NOT tape THEN
   IF (SELECT count(DISTINCT value->>'date') FROM jsonb_array_elements(d->'days'))<>jsonb_array_length(d->'days') THEN RAISE EXCEPTION 'Each audition day needs a different date.';END IF;
   FOR day IN SELECT value FROM jsonb_array_elements(d->'days') LOOP
    IF nullif(day->>'date','') IS NULL OR nullif(day->>'start','') IS NULL OR nullif(day->>'end','') IS NULL THEN RAISE EXCEPTION 'Add the date, start and finish for every day.';END IF;
    PERFORM (day->>'date')::date;clock:=(day->>'start')::time;ending:=(day->>'end')::time;
    IF ending<=clock OR (d->>'mode'='appointment' AND ending-clock<make_interval(mins=>minutes)) THEN RAISE EXCEPTION 'The finish must leave enough time for an audition after the start.';END IF;
    IF d->'methods' ? 'in_person' AND (nullif(trim(day->'venue'->>'name'),'') IS NULL OR nullif(trim(day->'venue'->>'address'),'') IS NULL) THEN RAISE EXCEPTION 'Choose a venue with its full address for every day.';END IF;
    IF first_day IS NULL THEN first_day:=day;END IF;
    block_id:=coalesce(nullif(day->>'id',''),'day-'||md5(item.id::text||(day->>'date')));
    venue:=concat_ws(', ',nullif(day->'venue'->>'name',''),nullif(day->'venue'->>'address',''));
    metadata:=d-'days';
    block:=jsonb_build_object('id',block_id,'date',day->>'date','start_time',day->>'start','end_time',day->>'end','slot_length',minutes,'buffer',gap,'capacity',capacity,'visibility',CASE WHEN d->>'audience'='invited' OR d->>'type'='callback' THEN 'invited' ELSE 'public' END,'breaks','[]'::jsonb,'location',venue,'venue',day->'venue','room',day->>'room','location_instructions',day->>'locationNotes','video_instructions',day->>'videoInstructions','audition_setup',metadata||jsonb_build_object('version',1));
    blocks:=blocks||jsonb_build_array(block);
    IF d->>'mode'='appointment' THEN
     cursor_at:=(day->>'date')::date+clock;end_at:=(day->>'date')::date+ending;
     WHILE cursor_at+make_interval(mins=>minutes)<=end_at LOOP
      wanted:=wanted||jsonb_build_array(jsonb_build_object('date',day->>'date','time',cursor_at::time,'block',block_id));cursor_at:=cursor_at+make_interval(mins=>minutes+gap);
      IF jsonb_array_length(wanted)>3000 THEN RAISE EXCEPTION 'This schedule has too many appointments. Split it into smaller auditions.';END IF;
     END LOOP;
    ELSIF d->>'mode' IN('group','arrival','walkin','assigned') THEN wanted:=wanted||jsonb_build_array(jsonb_build_object('date',day->>'date','time',clock,'block',block_id));END IF;
   END LOOP;
  ELSE
   blocks:=jsonb_build_array(jsonb_build_object('audition_setup',d||jsonb_build_object('version',1)));
  END IF;
  -- Existing booked schedules are never silently rebuilt by setup changes.
  SELECT EXISTS(SELECT 1 FROM public.audition_bookings WHERE session_id=item.id) OR EXISTS(SELECT 1 FROM public.audition_applications a WHERE a.session_id=item.id OR EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a.slot_assignments)='array' THEN a.slot_assignments ELSE '[]' END) x WHERE x->>'session_id'=item.id::text)) OR EXISTS(SELECT 1 FROM public.audition_time_slots WHERE session_id=item.id AND (booked_profile_id IS NOT NULL OR reserved_until>now() OR hold_expires_at>now())) INTO has_bookings;
  IF has_bookings THEN
   SELECT coalesce(jsonb_agg(jsonb_build_object('date',s.slot_date,'time',s.slot_time) ORDER BY s.slot_date,s.slot_time),'[]') INTO old_signature FROM public.audition_time_slots s WHERE s.session_id=item.id;
   SELECT coalesce(jsonb_agg(jsonb_build_object('date',(x->>'date')::date,'time',(x->>'time')::time) ORDER BY (x->>'date')::date,(x->>'time')::time),'[]') INTO new_signature FROM jsonb_array_elements(wanted) x;
   IF item.type<>d->>'type' OR item.location IS DISTINCT FROM nullif(concat_ws(', ',first_day->'venue'->>'name',first_day->'venue'->>'address'),'') OR old_signature<>new_signature OR item.slot_length<>minutes OR item.capacity_per_slot<>capacity OR coalesce(item.slot_blocks->0->'audition_setup'->>'mode',d->>'mode')<>d->>'mode' THEN RAISE EXCEPTION 'This audition already has bookings. Keep its booked times and group size, or reschedule those people before changing the schedule.';END IF;
  END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(wanted) LOOP
   SELECT id INTO slot_id FROM public.audition_time_slots WHERE session_id=item.id AND coalesce(slot_date,item.date)=(entry->>'date')::date AND slot_time=(entry->>'time')::time ORDER BY created_at,id LIMIT 1;
   IF slot_id IS NULL THEN INSERT INTO public.audition_time_slots(session_id,slot_date,slot_time,capacity,block_id,is_available,label) VALUES(item.id,(entry->>'date')::date,(entry->>'time')::time,capacity,entry->>'block',true,'Open') RETURNING id INTO slot_id;
   ELSE UPDATE public.audition_time_slots SET block_id=entry->>'block',capacity=capacity WHERE id=slot_id;END IF;
   kept:=array_append(kept,slot_id);slot_count:=slot_count+1;
  END LOOP;
  IF NOT has_bookings THEN DELETE FROM public.audition_time_slots WHERE session_id=item.id AND NOT(id=ANY(kept));END IF;
  live:=d->>'audience'='open' AND d->>'type'<>'callback';
  UPDATE public.audition_sessions SET name=trim(d->>'name'),type=d->>'type',format=CASE WHEN d->'methods' ? 'in_person' THEN CASE WHEN jsonb_array_length(d->'methods')>1 THEN 'hybrid' ELSE 'in_person' END ELSE 'virtual' END,date=nullif(first_day->>'date','')::date,end_date=nullif(first_day->>'date','')::date,start_time=nullif(first_day->>'start','')::time,end_time=nullif(first_day->>'end','')::time,location=nullif(concat_ws(', ',first_day->'venue'->>'name',first_day->'venue'->>'address'),''),instructions=nullif(d->>'access',''),prepare_text=nullif(d->>'prep',''),slot_length=minutes,buffer_time=gap,capacity_per_slot=capacity,booking_mode=CASE d->>'mode' WHEN 'group' THEN 'group_session' WHEN 'arrival' THEN 'open_call' WHEN 'walkin' THEN 'open_call' ELSE 'appointment' END,slot_blocks=blocks,is_visible=live,enabled=live,show_to_applicants=live,allow_self_booking=live AND d->>'mode'<>'assigned',setup_published_revision=setup_revision WHERE id=item.id;
  published:=published+1;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM public.audition_configs WHERE production_id=p_production_id) THEN INSERT INTO public.audition_configs(production_id,is_open) VALUES(p_production_id,p_open_bookings);ELSIF p_open_bookings THEN UPDATE public.audition_configs SET is_open=true WHERE production_id=p_production_id;END IF;
 RETURN jsonb_build_object('published',published,'slots',slot_count,'bookings_open',EXISTS(SELECT 1 FROM public.audition_configs WHERE production_id=p_production_id AND is_open));
END $$;

REVOKE ALL ON FUNCTION public.bts_audition_setup_load(uuid),public.bts_audition_setup_create(uuid,uuid,boolean),public.bts_audition_setup_save(uuid,bigint,jsonb),public.bts_publish_audition_setup(uuid,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bts_audition_setup_load(uuid),public.bts_audition_setup_create(uuid,uuid,boolean),public.bts_audition_setup_save(uuid,bigint,jsonb),public.bts_publish_audition_setup(uuid,jsonb,boolean) TO authenticated;
COMMIT;
