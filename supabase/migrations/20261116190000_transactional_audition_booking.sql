-- Capacity and reservations are database decisions; all wizard writes commit together.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='90s';
CREATE TABLE bts_private.audition_holds(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 slot_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,
 extended boolean NOT NULL DEFAULT false,UNIQUE(user_id,slot_id)
);
CREATE INDEX audition_holds_active_slot ON bts_private.audition_holds(slot_id,expires_at);
REVOKE ALL ON bts_private.audition_holds FROM PUBLIC,anon,authenticated;
ALTER TABLE bts_private.email_rate_windows DROP CONSTRAINT email_rate_windows_kind_check;
ALTER TABLE bts_private.email_rate_windows ADD CONSTRAINT email_rate_windows_kind_check CHECK(kind IN('test','transactional','family_confirmation','family_volunteer','audition_hold'));

-- Reuse application assignments, with booking rows covering saves not represented by an application.
-- Matching profile IDs or explicit booking references deduplicate; names/emails never identify a person.
CREATE FUNCTION bts_private.audition_allocations(p_production uuid) RETURNS TABLE(slot_id uuid,person text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH applications AS(SELECT * FROM public.audition_applications WHERE production_id=p_production), assignments AS(
 SELECT a.id,public.try_uuid(x->>'slot_id') AS slot_id FROM applications a CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(a.slot_assignments)='array' THEN a.slot_assignments ELSE '[]'::jsonb END)x
 UNION SELECT id,coalesce(time_slot_id,slot_id) FROM applications
 UNION SELECT a.id,public.try_uuid(to_jsonb(a)->>('audition_slot_'||n)) FROM applications a CROSS JOIN generate_series(1,10)n
 ) SELECT DISTINCT s.slot_id,coalesce(a.profile_id::text,'application:'||a.id::text) FROM applications a JOIN assignments s ON s.id=a.id WHERE s.slot_id IS NOT NULL AND coalesce(a.status,'')!~*'(cancel|withdraw)'
 UNION SELECT b.slot_id,coalesce(b.profile_id::text,(SELECT 'application:'||a.id::text FROM applications a WHERE a.booking_id=b.id LIMIT 1),'booking:'||b.id::text) FROM public.audition_bookings b WHERE b.production_id=p_production AND b.slot_id IS NOT NULL AND coalesce(b.status,'')!~*'(cancel|withdraw)';
$$;
REVOKE ALL ON FUNCTION bts_private.audition_allocations(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION bts_private.audition_slot(p_slot uuid) RETURNS TABLE(production_id uuid,session_id uuid,capacity integer,bookable boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT s.production_id,t.session_id,greatest(coalesce(nullif(t.capacity,0),s.capacity_per_slot,1),1),
 p.is_public AND p.page_status IN('live','hidden') AND s.enabled AND s.show_to_applicants AND coalesce(s.allow_self_booking,true) AND lower(trim(coalesce(t.label,''))) IN('','open') AND NOT EXISTS(SELECT 1 FROM public.audition_configs c WHERE c.production_id=p.id AND NOT c.is_open)
 FROM public.audition_time_slots t JOIN public.audition_sessions s ON s.id=t.session_id JOIN public.productions p ON p.id=s.production_id WHERE t.id=p_slot
 UNION ALL SELECT t.production_id,NULL::uuid,greatest(t.capacity,1),p.is_public AND p.page_status IN('live','hidden') AND NOT EXISTS(SELECT 1 FROM public.audition_configs c WHERE c.production_id=p.id AND NOT c.is_open)
 FROM public.audition_slots t JOIN public.productions p ON p.id=t.production_id WHERE t.id=p_slot;
$$;
REVOKE ALL ON FUNCTION bts_private.audition_slot(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bts_lock_audition_slots(p_slots uuid[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_slot uuid; info record; production uuid; production_count integer; slot_count integer;
BEGIN
 IF NOT public.bts_account_is_active() OR cardinality(p_slots)>20 THEN RAISE EXCEPTION 'Choose valid audition times using your adult account.';END IF;
 IF coalesce(cardinality(p_slots),0)=0 THEN RETURN;END IF;
 SELECT count(DISTINCT x.production_id),min(x.production_id::text)::uuid,count(*) INTO production_count,production,slot_count FROM (SELECT DISTINCT unnest(p_slots) AS id)requested CROSS JOIN LATERAL bts_private.audition_slot(requested.id)x;
 IF production_count<>1 OR slot_count<>(SELECT count(DISTINCT id) FROM unnest(p_slots)id) THEN RAISE EXCEPTION 'Choose audition times from one production.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(production::text||':audition-capacity',0));
 FOR v_slot IN SELECT DISTINCT unnest(p_slots) ORDER BY 1 LOOP
  PERFORM 1 FROM public.audition_time_slots WHERE audition_time_slots.id=v_slot FOR UPDATE;
  IF NOT FOUND THEN PERFORM 1 FROM public.audition_slots WHERE audition_slots.id=v_slot FOR UPDATE;END IF;
  SELECT * INTO info FROM bts_private.audition_slot(v_slot);
  IF info.production_id IS NULL OR NOT(info.bookable OR public.bts_production_page_permission(info.production_id,'auditions.schedule',2)) THEN RAISE EXCEPTION 'This audition time is not accepting bookings.';END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.bts_lock_audition_slots(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_lock_audition_slots(uuid[]) TO authenticated;

CREATE FUNCTION public.bts_audition_hold(p_action text,p_slot_id uuid,p_hold_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE h bts_private.audition_holds%rowtype; info record; occupied integer; hits integer;
BEGIN
 IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with your adult account.';END IF;
 IF p_slot_id IS NULL THEN RAISE EXCEPTION 'Choose an audition time.';END IF;
 IF p_action NOT IN('acquire','extend','release','check') THEN RAISE EXCEPTION 'Unknown reservation action.';END IF;
 -- The per-account lock precedes slot locks consistently, bounding active holds and request rates.
 IF p_action='acquire' THEN DELETE FROM bts_private.audition_holds WHERE user_id=auth.uid() AND expires_at<now()-interval '2 days';PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':audition-holds',0));END IF;
 IF p_action='release' THEN DELETE FROM bts_private.audition_holds WHERE slot_id=p_slot_id AND user_id=auth.uid() AND (p_hold_id IS NULL OR id=p_hold_id);RETURN jsonb_build_object('released',FOUND);END IF;
 PERFORM public.bts_lock_audition_slots(ARRAY[p_slot_id]);
 SELECT * INTO info FROM bts_private.audition_slot(p_slot_id);
 IF NOT info.bookable THEN RAISE EXCEPTION 'This audition time is not accepting public bookings.';END IF;
 SELECT * INTO h FROM bts_private.audition_holds WHERE slot_id=p_slot_id AND user_id=auth.uid();
 IF p_action IN('extend','check') THEN
  IF h.id IS NULL OR h.id IS DISTINCT FROM p_hold_id OR h.expires_at<=now() THEN RAISE EXCEPTION 'Your reservation expired. Choose an available time again.';END IF;
  IF p_action='extend' THEN
   IF h.extended THEN RAISE EXCEPTION 'This reservation has already been extended.';END IF;
   UPDATE bts_private.audition_holds SET expires_at=greatest(expires_at,now())+interval '5 minutes',extended=true WHERE id=h.id RETURNING * INTO h;
  END IF;
 ELSIF h.id IS NULL OR h.expires_at<=now() THEN
  SELECT count(DISTINCT person) INTO occupied FROM bts_private.audition_allocations(info.production_id) WHERE slot_id=p_slot_id;
  occupied:=occupied+(SELECT count(*) FROM bts_private.audition_holds WHERE slot_id=p_slot_id AND expires_at>now() AND user_id<>auth.uid());
  IF occupied>=info.capacity THEN RAISE EXCEPTION 'This time was just filled or reserved. Please choose another time.';END IF;
  IF (SELECT count(*) FROM bts_private.audition_holds WHERE user_id=auth.uid() AND expires_at>now())>=20 THEN RAISE EXCEPTION 'Finish or release your existing reservations first.';END IF;
  INSERT INTO bts_private.email_rate_windows(user_id,kind,window_start,sent_requests) VALUES(auth.uid(),'audition_hold',date_trunc('hour',now()),1)
  ON CONFLICT(user_id,kind,window_start) DO UPDATE SET sent_requests=email_rate_windows.sent_requests+1 WHERE email_rate_windows.sent_requests<100 RETURNING sent_requests INTO hits;
  IF hits IS NULL THEN RAISE EXCEPTION 'Reservation request limit reached. Try again later.';END IF;
  INSERT INTO bts_private.audition_holds(user_id,slot_id,expires_at) VALUES(auth.uid(),p_slot_id,now()+interval '15 minutes') ON CONFLICT(user_id,slot_id) DO UPDATE SET id=gen_random_uuid(),created_at=now(),expires_at=excluded.expires_at,extended=false RETURNING * INTO h;
 END IF;
 RETURN jsonb_build_object('id',h.id,'slot_id',h.slot_id,'expires_at',h.expires_at,'extended',h.extended);
END $$;
REVOKE ALL ON FUNCTION public.bts_audition_hold(text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_audition_hold(text,uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.bts_public_audition_availability(p_production_id uuid) RETURNS TABLE(slot_id uuid,session_id uuid,booked_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH slots AS(SELECT t.id,t.session_id FROM public.audition_time_slots t JOIN public.audition_sessions s ON s.id=t.session_id JOIN public.productions p ON p.id=s.production_id WHERE p.id=p_production_id AND p.is_public AND p.page_status IN('live','hidden') AND s.enabled AND s.show_to_applicants UNION SELECT t.id,NULL::uuid FROM public.audition_slots t JOIN public.productions p ON p.id=t.production_id WHERE p.id=p_production_id AND p.is_public AND p.page_status IN('live','hidden'))
 SELECT s.id,s.session_id,count(DISTINCT a.person) FROM slots s LEFT JOIN bts_private.audition_allocations(p_production_id)a ON a.slot_id=s.id GROUP BY s.id,s.session_id;
$$;
CREATE FUNCTION public.bts_public_audition_capacity(p_production_id uuid) RETURNS TABLE(slot_id uuid,session_id uuid,booked_count bigint,held_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a.slot_id,a.session_id,a.booked_count,(SELECT count(*) FROM bts_private.audition_holds h WHERE h.slot_id=a.slot_id AND h.expires_at>now() AND h.user_id IS DISTINCT FROM auth.uid()) FROM public.bts_public_audition_availability(p_production_id)a;
$$;
REVOKE ALL ON FUNCTION public.bts_public_audition_capacity(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_public_audition_capacity(uuid) TO anon,authenticated;

-- Lock before existing profile guards, so all entrances share the same lock order.
CREATE FUNCTION bts_private.lock_audition_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.production_id::text||':audition-capacity',0));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bts_private.lock_audition_write() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bts_a00_lock_application BEFORE INSERT OR UPDATE ON public.audition_applications FOR EACH ROW EXECUTE FUNCTION bts_private.lock_audition_write();
CREATE TRIGGER bts_a00_lock_booking BEFORE INSERT OR UPDATE ON public.audition_bookings FOR EACH ROW EXECUTE FUNCTION bts_private.lock_audition_write();

-- The final capacity check protects every entrance, including direct participant-view writes.
CREATE FUNCTION bts_private.guard_audition_capacity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_slot uuid; ids uuid[]; info record; occupied integer; identity text;
BEGIN
 IF TG_OP='UPDATE' AND TG_TABLE_NAME='audition_bookings' AND NEW.custom_answers->>'__bts_booking_request_id' IS DISTINCT FROM OLD.custom_answers->>'__bts_booking_request_id' THEN RAISE EXCEPTION 'The booking request reference cannot be changed.';END IF;
 IF coalesce(NEW.status,'')~*'(cancel|withdraw)' THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND coalesce(OLD.status,'')!~*'(cancel|withdraw)' AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['slot_id','time_slot_id','session_id','slot_assignments','audition_slot_1','audition_slot_2','audition_slot_3','audition_slot_4','audition_slot_5','audition_slot_6','audition_slot_7','audition_slot_8','audition_slot_9','audition_slot_10'])k WHERE to_jsonb(NEW)->k IS DISTINCT FROM to_jsonb(OLD)->k) THEN RETURN NEW;END IF;
 SELECT array_agg(DISTINCT value) INTO ids FROM(
 SELECT NEW.slot_id AS value UNION SELECT public.try_uuid(to_jsonb(NEW)->>'time_slot_id')
 UNION SELECT public.try_uuid(x->>'slot_id') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(to_jsonb(NEW)->'slot_assignments')='array' THEN to_jsonb(NEW)->'slot_assignments' ELSE '[]'::jsonb END)x
 UNION SELECT public.try_uuid(to_jsonb(NEW)->>('audition_slot_'||n)) FROM generate_series(1,10)n
 )x WHERE value IS NOT NULL;
 IF ids IS NULL THEN RETURN NEW;END IF;
 identity:=coalesce(NEW.profile_id::text,CASE WHEN TG_TABLE_NAME='audition_applications' THEN 'application:' ELSE 'booking:' END||NEW.id::text);
 FOR v_slot IN SELECT unnest(ids) ORDER BY 1 LOOP
  PERFORM 1 FROM public.audition_time_slots WHERE audition_time_slots.id=v_slot FOR UPDATE;
  IF NOT FOUND THEN PERFORM 1 FROM public.audition_slots WHERE audition_slots.id=v_slot FOR UPDATE;END IF;
  SELECT * INTO info FROM bts_private.audition_slot(v_slot);
  IF info.production_id IS DISTINCT FROM NEW.production_id THEN RAISE EXCEPTION 'Choose an audition time from this production.';END IF;
  IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM bts_private.audition_allocations(NEW.production_id)a WHERE a.slot_id=v_slot AND a.person=identity) THEN CONTINUE;END IF;
  IF NOT info.bookable AND NOT public.bts_production_page_permission(NEW.production_id,'auditions.schedule',2) THEN RAISE EXCEPTION 'This audition time is not accepting bookings.';END IF;
  SELECT count(DISTINCT person) INTO occupied FROM bts_private.audition_allocations(NEW.production_id)a WHERE a.slot_id=v_slot AND a.person<>identity;
  occupied:=occupied+(SELECT count(*) FROM bts_private.audition_holds h WHERE h.slot_id=v_slot AND h.expires_at>now() AND h.user_id IS DISTINCT FROM auth.uid());
  IF occupied>=info.capacity THEN RAISE EXCEPTION 'This audition time is full or reserved. Choose another available time.';END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bts_private.guard_audition_capacity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bts_zz_audition_capacity BEFORE INSERT OR UPDATE ON public.audition_applications FOR EACH ROW EXECUTE FUNCTION bts_private.guard_audition_capacity();
CREATE TRIGGER bts_zz_booking_capacity BEFORE INSERT OR UPDATE ON public.audition_bookings FOR EACH ROW EXECUTE FUNCTION bts_private.guard_audition_capacity();
CREATE UNIQUE INDEX audition_booking_request_session ON public.audition_bookings(user_id,(custom_answers->>'__bts_booking_request_id'),coalesce(session_id,'00000000-0000-0000-0000-000000000000'::uuid)) WHERE custom_answers->>'__bts_booking_request_id' IS NOT NULL;

-- A lost HTTP response can be retried even after its successful save released the hold.
CREATE FUNCTION public.bts_audition_receipt(p_request_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH saved AS(SELECT * FROM public.bts_participant_bookings WHERE user_id=auth.uid() AND custom_answers->>'__bts_booking_request_id'=p_request_id::text), primary_booking AS(SELECT * FROM saved ORDER BY (custom_answers->>'__bts_booking_primary')::boolean DESC NULLS LAST,created_at,id LIMIT 1)
 SELECT jsonb_build_object('booking_id',b.id,'profile_id',b.profile_id,'headshot_url',b.headshot_url,'booking_ids',(SELECT jsonb_agg(id ORDER BY created_at,id) FROM saved),'application_id',(SELECT a.id FROM public.bts_participant_applications a WHERE a.booking_id=b.id OR(a.profile_id=b.profile_id AND a.production_id=b.production_id) ORDER BY a.created_at LIMIT 1)) FROM primary_booking b WHERE public.bts_account_is_active();
$$;
REVOKE ALL ON FUNCTION public.bts_audition_receipt(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_audition_receipt(uuid) TO authenticated;

-- Invoker rights deliberately retain the existing profile/guardian guards and view RLS.
CREATE FUNCTION public.bts_confirm_audition(p_request_id uuid,p_booking jsonb,p_application jsonb,p_extra_sessions jsonb DEFAULT '[]') RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE booking public.bts_participant_bookings%rowtype; application public.bts_participant_applications%rowtype; extra jsonb; saved public.bts_participant_bookings%rowtype; app_id uuid; assignments jsonb; ids uuid[]:='{}'; profile uuid; old_app record; slot_ids uuid[];
BEGIN
 IF NOT public.bts_account_is_active() OR p_request_id IS NULL THEN RAISE EXCEPTION 'Sign in with your adult account.';END IF;
 IF jsonb_typeof(p_booking) IS DISTINCT FROM 'object' OR jsonb_typeof(p_application) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Provide the booking and application details.';END IF;
 IF jsonb_typeof(p_extra_sessions) IS DISTINCT FROM 'array' OR jsonb_array_length(p_extra_sessions)>19 OR length(p_booking::text)>100000 OR length(p_application::text)>100000 THEN RAISE EXCEPTION 'Choose valid audition sessions.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_id::text,0));
 SELECT array_agg(id ORDER BY (custom_answers->>'__bts_booking_primary')::boolean DESC NULLS LAST,created_at,id) INTO ids FROM public.bts_participant_bookings WHERE user_id=auth.uid() AND custom_answers->>'__bts_booking_request_id'=p_request_id::text;
 IF cardinality(ids)>0 THEN SELECT * INTO saved FROM public.bts_participant_bookings WHERE id=ids[1];IF saved.production_id IS DISTINCT FROM (p_booking->>'production_id')::uuid OR saved.session_id IS DISTINCT FROM public.try_uuid(p_booking->>'session_id') OR saved.slot_id IS DISTINCT FROM public.try_uuid(p_booking->>'slot_id') OR(public.try_uuid(p_booking->>'profile_id') IS NOT NULL AND saved.profile_id IS DISTINCT FROM public.try_uuid(p_booking->>'profile_id')) THEN RAISE EXCEPTION 'This request already saved different times. Open My Activities to review the saved booking.';END IF;IF (SELECT jsonb_agg(jsonb_build_object('session_id',session_id,'slot_id',slot_id) ORDER BY session_id) FROM public.bts_participant_bookings WHERE id=ANY(ids)) IS DISTINCT FROM (SELECT jsonb_agg(jsonb_build_object('session_id',public.try_uuid(x->>'session_id'),'slot_id',public.try_uuid(x->>'slot_id')) ORDER BY public.try_uuid(x->>'session_id')) FROM jsonb_array_elements(p_extra_sessions||jsonb_build_array(jsonb_build_object('session_id',p_booking->>'session_id','slot_id',p_booking->>'slot_id')))x) THEN RAISE EXCEPTION 'This request already saved different sessions. Open My Activities to review the saved booking.';END IF;SELECT id INTO app_id FROM public.bts_participant_applications WHERE booking_id=ids[1] OR (profile_id=(SELECT profile_id FROM public.bts_participant_bookings WHERE id=ids[1]) AND production_id=(p_booking->>'production_id')::uuid) ORDER BY created_at LIMIT 1;RETURN jsonb_build_object('booking_id',ids[1],'booking_ids',ids,'application_id',app_id,'replayed',true);END IF;
 ids:='{}';booking:=jsonb_populate_record(NULL::public.bts_participant_bookings,p_booking);application:=jsonb_populate_record(NULL::public.bts_participant_applications,p_application);
 IF booking.session_id IS NULL THEN RAISE EXCEPTION 'Choose an audition session.';END IF;
 IF booking.production_id IS NULL OR application.production_id IS DISTINCT FROM booking.production_id OR application.profile_id IS DISTINCT FROM booking.profile_id THEN RAISE EXCEPTION 'Use the same production and authorised performer for this booking.';END IF;
 SELECT array_agg(public.try_uuid(x->>'slot_id')) INTO slot_ids FROM jsonb_array_elements(p_extra_sessions||jsonb_build_array(jsonb_build_object('slot_id',booking.slot_id)))x WHERE public.try_uuid(x->>'slot_id') IS NOT NULL;
 PERFORM public.bts_lock_audition_slots(slot_ids);
 -- The client submits a primary receipt plus each extra session. A repeated session is rejected atomically.
 assignments:='[]';
 FOR extra IN SELECT value FROM jsonb_array_elements(jsonb_build_array(jsonb_build_object('session_id',booking.session_id,'slot_id',booking.slot_id))||p_extra_sessions) LOOP
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(assignments)x WHERE x->>'session_id'=extra->>'session_id') THEN RAISE EXCEPTION 'Choose each audition session only once.';END IF;
  INSERT INTO public.bts_participant_bookings(production_id,session_id,slot_id,user_id,profile_id,name,email,phone,age,is_minor,custom_answers,pronouns,contact_name,role_preference,gender_preference,roles_requested,guardian_name,guardian_email,headshot_url,status,attendance_mode,portal_code)
  VALUES(booking.production_id,public.try_uuid(extra->>'session_id'),public.try_uuid(extra->>'slot_id'),auth.uid(),coalesce(profile,booking.profile_id),booking.name,booking.email,booking.phone,booking.age,booking.is_minor,coalesce(booking.custom_answers,'{}')||jsonb_build_object('__bts_booking_request_id',p_request_id,'__bts_booking_primary',cardinality(ids)=0),booking.pronouns,booking.contact_name,booking.role_preference,booking.gender_preference,booking.roles_requested,booking.guardian_name,booking.guardian_email,booking.headshot_url,'pending',booking.attendance_mode,booking.portal_code) RETURNING * INTO saved;
  profile:=saved.profile_id;ids:=array_append(ids,saved.id);assignments:=assignments||jsonb_build_array(extra);
 END LOOP;
 PERFORM pg_advisory_xact_lock(hashtextextended(profile::text||booking.production_id::text||'audition_applications',0));
 SELECT * INTO old_app FROM public.bts_participant_applications WHERE profile_id=profile AND production_id=booking.production_id AND coalesce(status,'')!~*'(cancel|withdraw)' ORDER BY created_at LIMIT 1;
 IF old_app.id IS NOT NULL THEN
  assignments:=coalesce(old_app.slot_assignments,'[]')||assignments;
  UPDATE public.bts_participant_applications SET slot_assignments=assignments WHERE id=old_app.id RETURNING id INTO app_id;
 ELSE
  INSERT INTO public.bts_participant_applications(production_id,user_id,profile_id,name,email,phone,notes,headshot_url,role_interest,status,slot_id,experience,conflicts,skills,file_url,session_id,time_slot_id,experience_level,custom_answers,date_conflicts,slot_assignments,attendance_mode,audition_method,preferred_name,pronouns,booking_id)
  VALUES(booking.production_id,auth.uid(),profile,application.name,application.email,application.phone,application.notes,application.headshot_url,application.role_interest,'pending',booking.slot_id,application.experience,application.conflicts,application.skills,application.file_url,booking.session_id,NULL,application.experience_level,application.custom_answers,application.date_conflicts,assignments,application.attendance_mode,coalesce(application.audition_method,'in_person'),application.preferred_name,application.pronouns,ids[1]) RETURNING id INTO app_id;
 END IF;
 -- Holds expire independently if a browser disappears; successful commits release this adult's reservations.
 FOREACH profile IN ARRAY coalesce(slot_ids,'{}') LOOP PERFORM public.bts_audition_hold('release',profile,NULL);END LOOP;
 RETURN jsonb_build_object('booking_id',ids[1],'booking_ids',ids,'application_id',app_id,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.bts_confirm_audition(uuid,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_confirm_audition(uuid,jsonb,jsonb,jsonb) TO authenticated;
-- Keep linked receipts aligned when a participant withdraws or staff move an application.
CREATE FUNCTION bts_private.sync_audition_receipts() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b record; target uuid; assignments jsonb;
BEGIN
 IF pg_trigger_depth()>1 OR NEW.profile_id IS NULL THEN RETURN NEW;END IF;
 IF TG_TABLE_NAME='audition_applications' THEN
  IF coalesce(NEW.status,'')~*'(cancel|withdraw)' AND NEW.status IS DISTINCT FROM OLD.status THEN
   UPDATE public.audition_bookings SET status='cancelled' WHERE production_id=NEW.production_id AND profile_id=NEW.profile_id AND coalesce(status,'')!~*'(cancel|withdraw)';
  ELSIF NEW.slot_assignments IS DISTINCT FROM OLD.slot_assignments OR NEW.slot_id IS DISTINCT FROM OLD.slot_id THEN
   FOR b IN SELECT * FROM public.audition_bookings WHERE production_id=NEW.production_id AND profile_id=NEW.profile_id AND coalesce(status,'')!~*'(cancel|withdraw)' LOOP
    SELECT public.try_uuid(x->>'slot_id') INTO target FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.slot_assignments)='array' THEN NEW.slot_assignments ELSE '[]'::jsonb END)x WHERE public.try_uuid(x->>'session_id')=b.session_id LIMIT 1;
    IF target IS NULL AND b.session_id=NEW.session_id THEN target:=NEW.slot_id;END IF;
    IF target IS NOT NULL AND target IS DISTINCT FROM b.slot_id THEN UPDATE public.audition_bookings SET slot_id=target WHERE id=b.id;END IF;
   END LOOP;
  END IF;
 ELSIF coalesce(NEW.status,'')~*'(cancel|withdraw)' AND NEW.status IS DISTINCT FROM OLD.status THEN
  FOR b IN SELECT * FROM public.audition_applications WHERE production_id=NEW.production_id AND profile_id=NEW.profile_id AND coalesce(status,'')!~*'(cancel|withdraw)' LOOP
   SELECT coalesce(jsonb_agg(x),'[]') INTO assignments FROM jsonb_array_elements(CASE WHEN jsonb_typeof(b.slot_assignments)='array' THEN b.slot_assignments ELSE '[]'::jsonb END)x WHERE public.try_uuid(x->>'slot_id') IS DISTINCT FROM NEW.slot_id;
   UPDATE public.audition_applications SET slot_assignments=assignments,slot_id=CASE WHEN slot_id=NEW.slot_id THEN NULL ELSE slot_id END,time_slot_id=CASE WHEN time_slot_id=NEW.slot_id THEN NULL ELSE time_slot_id END WHERE id=b.id;
  END LOOP;
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bts_private.sync_audition_receipts() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sync_application_receipts AFTER UPDATE ON public.audition_applications FOR EACH ROW EXECUTE FUNCTION bts_private.sync_audition_receipts();
CREATE TRIGGER sync_booking_receipts AFTER UPDATE ON public.audition_bookings FOR EACH ROW EXECUTE FUNCTION bts_private.sync_audition_receipts();
NOTIFY pgrst,'reload schema';
COMMIT;
