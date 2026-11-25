UPDATE public.productions SET is_public=true,page_status='live' WHERE id='fdb2ec7b-a107-41e6-b960-7e6b89e8ca96';
CREATE TEMP TABLE setup_test_state(draft jsonb);GRANT ALL ON setup_test_state TO authenticated;
INSERT INTO setup_test_state VALUES('{"name":"Synthetic General audition","type":"audition","audience":"open","methods":["in_person"],"mode":"appointment","slot":"10","gap":"2","capacity":"1","activities":["acting"],"prep":"Bring a short scene.","bring":"Water","access":"Check in at reception.","finish":"After their appointment","days":[{"id":"day-one","date":"2030-11-27","start":"10:00","end":"11:00","venue":{"name":"Synthetic venue","address":"24 Example Road, TEST"}},{"id":"day-two","date":"2030-11-29","start":"14:00","end":"15:00","venue":{"name":"Synthetic second venue","address":"26 Example Road, TEST"}}]}');
SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claims','{"sub":"1f7c169f-c707-48d2-97bb-749c5ca382a0","role":"authenticated"}',true);
SELECT public.bts_audition_setup_create('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','a0ad0000-0000-4000-8000-000000000070',false);
SELECT public.bts_audition_setup_save('a0ad0000-0000-4000-8000-000000000070',0,(SELECT draft FROM setup_test_state));
DO $$ BEGIN
 IF (SELECT name FROM public.audition_sessions WHERE id='a0ad0000-0000-4000-8000-000000000070')<>'General audition' THEN RAISE EXCEPTION 'Draft changed the published record';END IF;
 BEGIN PERFORM public.bts_audition_setup_save('a0ad0000-0000-4000-8000-000000000070',0,'{}');RAISE EXCEPTION 'TEST FAILED: stale write accepted';EXCEPTION WHEN serialization_failure THEN NULL;END;
 BEGIN PERFORM public.bts_audition_setup_save('a0ad0000-0000-4000-8000-000000000070',NULL,'{}');RAISE EXCEPTION 'TEST FAILED: null revision accepted';EXCEPTION WHEN serialization_failure THEN NULL;END;
END $$;
RESET ROLE;SET LOCAL ROLE anon;SELECT set_config('request.jwt.claims','{}',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.bts_visible_audition_sessions WHERE id='a0ad0000-0000-4000-8000-000000000070') THEN RAISE EXCEPTION 'Draft session is public';END IF;
 IF has_function_privilege('anon','public.bts_audition_setup_load(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous draft RPC privilege';END IF;
END $$;
RESET ROLE;SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claims','{"sub":"131ad1e8-23b0-4756-81ce-bf59302e4b4f","role":"authenticated"}',true);
DO $$ BEGIN
 BEGIN PERFORM public.bts_audition_setup_load('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96');RAISE EXCEPTION 'TEST FAILED: outsider reads draft';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 BEGIN PERFORM public.bts_audition_setup_save('a0ad0000-0000-4000-8000-000000000070',1,(SELECT draft FROM setup_test_state));RAISE EXCEPTION 'TEST FAILED: outsider writes draft';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"1f7c169f-c707-48d2-97bb-749c5ca382a0","role":"authenticated"}',true);
SELECT public.bts_publish_audition_setup('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','[{"id":"a0ad0000-0000-4000-8000-000000000070","revision":1}]',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.audition_time_slots WHERE session_id='a0ad0000-0000-4000-8000-000000000070')<>10 THEN RAISE EXCEPTION 'Expected ten appointments across two dates';END IF;
 IF (SELECT count(DISTINCT slot_date) FROM public.audition_time_slots WHERE session_id='a0ad0000-0000-4000-8000-000000000070')<>2 THEN RAISE EXCEPTION 'Multiple dates not generated';END IF;
END $$;
RESET ROLE;SET LOCAL ROLE anon;SELECT set_config('request.jwt.claims','{}',true);
DO $$ BEGIN
 IF (SELECT name FROM public.bts_visible_audition_sessions WHERE id='a0ad0000-0000-4000-8000-000000000070')<>'Synthetic General audition' THEN RAISE EXCEPTION 'Published session absent';END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bts_visible_audition_sessions' AND column_name LIKE 'setup_%') THEN RAISE EXCEPTION 'Draft columns leaked into public view';END IF;
END $$;
RESET ROLE;
INSERT INTO public.audition_bookings(production_id,session_id,slot_id,name,email,user_id) SELECT 'fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',session_id,id,'Synthetic booked person','synthetic@example.invalid','4180925a-80f5-443d-aed7-9792e5e96172' FROM public.audition_time_slots WHERE session_id='a0ad0000-0000-4000-8000-000000000070' ORDER BY slot_date,slot_time LIMIT 1;
SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claims','{"sub":"1f7c169f-c707-48d2-97bb-749c5ca382a0","role":"authenticated"}',true);
SELECT public.bts_audition_setup_save('a0ad0000-0000-4000-8000-000000000070',1,jsonb_set((SELECT draft FROM setup_test_state),'{name}','"Updated draft only"'));
DO $$ BEGIN
 IF (SELECT name FROM public.bts_visible_audition_sessions WHERE id='a0ad0000-0000-4000-8000-000000000070')<>'Synthetic General audition' THEN RAISE EXCEPTION 'Draft overwrote live name';END IF;
END $$;
SELECT public.bts_publish_audition_setup('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','[{"id":"a0ad0000-0000-4000-8000-000000000070","revision":2}]',false);
SELECT public.bts_audition_setup_save('a0ad0000-0000-4000-8000-000000000070',2,jsonb_set((SELECT draft FROM setup_test_state),'{days,0,start}','"10:30"'));
DO $$ BEGIN
 BEGIN PERFORM public.bts_publish_audition_setup('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','[{"id":"a0ad0000-0000-4000-8000-000000000070","revision":3}]',false);RAISE EXCEPTION 'TEST FAILED: booked schedule rebuilt';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 IF (SELECT count(*) FROM public.audition_time_slots WHERE session_id='a0ad0000-0000-4000-8000-000000000070')<>10 THEN RAISE EXCEPTION 'Failed publish changed slots';END IF;
END $$;
SELECT public.bts_audition_setup_create('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','a0ad0000-0000-4000-8000-000000000071',false);
SELECT public.bts_audition_setup_save('a0ad0000-0000-4000-8000-000000000071',0,(SELECT draft||'{"type":"callback","audience":"open","mode":"group","capacity":"12"}' FROM setup_test_state));
SELECT public.bts_publish_audition_setup('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','[{"id":"a0ad0000-0000-4000-8000-000000000071","revision":1}]',false);
RESET ROLE;SET LOCAL ROLE anon;SELECT set_config('request.jwt.claims','{}',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.bts_visible_audition_sessions WHERE id='a0ad0000-0000-4000-8000-000000000071') THEN RAISE EXCEPTION 'Callback published to everyone';END IF;END $$;
RESET ROLE;
