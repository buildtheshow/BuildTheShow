UPDATE public.productions SET page_status='live' WHERE id='fdb2ec7b-a107-41e6-b960-7e6b89e8ca96';
INSERT INTO public.audition_sessions(id,production_id,name,enabled,show_to_applicants)
 VALUES('ef072543-8703-49a6-90d7-6f14ed5a2b41','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','Public synthetic session',true,true);
INSERT INTO public.audition_time_slots(id,session_id,slot_time) VALUES('03f1a8af-1b48-4a55-ab10-9ced63588dda','ef072543-8703-49a6-90d7-6f14ed5a2b41','10:00');
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF has_table_privilege('anon','public.audition_applications','INSERT') OR has_table_privilege('anon','public.audition_bookings','UPDATE') THEN RAISE EXCEPTION 'TEST FAILED: anonymous audition writes remain';END IF;
 IF has_table_privilege('anon','public.audition_applications','SELECT') OR has_table_privilege('anon','public.audition_bookings','SELECT') THEN RAISE EXCEPTION 'TEST FAILED: anonymous base-record read remains';END IF;
 IF EXISTS(SELECT 1 FROM public.bts_participant_applications) OR EXISTS(SELECT 1 FROM public.bts_participant_bookings) THEN RAISE EXCEPTION 'TEST FAILED: anonymous participant records disclosed';END IF;
 IF EXISTS(SELECT 1 FROM public.bts_public_audition_availability('8efb6463-9c50-444f-9305-be2c83d12ce4')) THEN RAISE EXCEPTION 'TEST FAILED: draft availability disclosed';END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated","user_metadata":{"role":"owner"}}',true);
DO $$ DECLARE record_id uuid; BEGIN
 IF EXISTS(SELECT 1 FROM public.audition_applications) THEN RAISE EXCEPTION 'TEST FAILED: ordinary account can bypass participant projection';END IF;
 IF EXISTS(SELECT 1 FROM public.bts_participant_applications WHERE user_id IS DISTINCT FROM auth.uid()) THEN RAISE EXCEPTION 'TEST FAILED: another family visible through projection';END IF;
 INSERT INTO public.bts_participant_bookings(production_id,session_id,slot_id,name,email,custom_answers)
 VALUES('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','ef072543-8703-49a6-90d7-6f14ed5a2b41','03f1a8af-1b48-4a55-ab10-9ced63588dda','Adult synthetic booking','team-creative@example.invalid','{"Date of Birth":"1990-01-01"}');
 BEGIN
  INSERT INTO public.bts_participant_applications(production_id,name,custom_answers) VALUES('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','Synthetic child','{"Date of Birth":"2015-01-01","Guardian Name":"Synthetic guardian"}');
  RAISE EXCEPTION 'TEST FAILED: child application accepted without guardian declaration';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF; END;
 INSERT INTO public.bts_participant_applications(production_id,name,user_id,custom_answers,slot_assignments)
 VALUES('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','Synthetic child','131ad1e8-23b0-4756-81ce-bf59302e4b4f',
 '{"Date of Birth":"2015-01-01","Guardian Name":"Synthetic guardian","__bts_guardian_confirmed":true}',
 '[{"session_id":"ef072543-8703-49a6-90d7-6f14ed5a2b41","slot_id":"03f1a8af-1b48-4a55-ab10-9ced63588dda"},{"session_id":"ef072543-8703-49a6-90d7-6f14ed5a2b41","slot_id":"03f1a8af-1b48-4a55-ab10-9ced63588dda"}]') RETURNING id INTO record_id;
 IF NOT EXISTS(SELECT 1 FROM public.bts_participant_applications WHERE id=record_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'TEST FAILED: account/guardian identity not fixed server-side'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bts_participant_applications' AND column_name IN ('org_notes','callback_notes','callback_rating','guardian_consent_at')) THEN RAISE EXCEPTION 'TEST FAILED: participant projection includes private staff/consent fields';END IF;
 IF (SELECT booked_count FROM public.bts_public_audition_availability('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96') WHERE slot_id='03f1a8af-1b48-4a55-ab10-9ced63588dda')<>1 THEN RAISE EXCEPTION 'TEST FAILED: duplicate assignment counted twice';END IF;
 BEGIN
  UPDATE public.bts_participant_applications SET user_id='131ad1e8-23b0-4756-81ce-bf59302e4b4f' WHERE id=record_id;
  RAISE EXCEPTION 'TEST FAILED: record reassigned';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 BEGIN
  UPDATE public.bts_participant_applications SET status='cast' WHERE id=record_id;
  RAISE EXCEPTION 'TEST FAILED: applicant changed casting decision';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 BEGIN
  UPDATE public.bts_participant_applications SET org_notes='Forged staff note' WHERE id=record_id;
  RAISE EXCEPTION 'TEST FAILED: applicant changed staff note';
 EXCEPTION WHEN undefined_column THEN NULL; WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 UPDATE public.bts_participant_applications SET status='cancelled' WHERE id=record_id;
 IF (SELECT booked_count FROM public.bts_public_audition_availability('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96') WHERE slot_id='03f1a8af-1b48-4a55-ab10-9ced63588dda')<>0 THEN RAISE EXCEPTION 'TEST FAILED: cancellation still occupies slot';END IF;
 UPDATE public.bts_participant_applications SET name='Not mine' WHERE id='956836bf-755b-4d1e-996d-741238b5cdda';
 IF FOUND THEN RAISE EXCEPTION 'TEST FAILED: unowned record was claimed';END IF;
END $$;
RESET ROLE;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.audition_applications WHERE name='Synthetic child' AND guardian_user_id='4180925a-80f5-443d-aed7-9792e5e96172' AND guardian_consent_at IS NOT NULL) THEN RAISE EXCEPTION 'TEST FAILED: guardian declaration not stored'; END IF; END $$;
UPDATE public.production_team_members SET access_level='check_in' WHERE id='df6bce8f-30a1-4e2d-a415-ea0663ddf006';
INSERT INTO public.production_team_member_sessions(production_id,team_member_id,session_token,expires_at,auth_user_id)
 VALUES('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','df6bce8f-30a1-4e2d-a415-ea0663ddf006',repeat('b',64),now()+interval '1 hour','3f6513e6-1dfc-48ae-991f-e889305bb4d6');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"3f6513e6-1dfc-48ae-991f-e889305bb4d6","role":"authenticated"}',true);
DO $$ BEGIN
 UPDATE public.audition_applications SET checked_in=true WHERE id='956836bf-755b-4d1e-996d-741238b5cdda';
 IF NOT FOUND THEN RAISE EXCEPTION 'TEST FAILED: authorised check-in staff cannot check in performer';END IF;
 BEGIN
  UPDATE public.audition_applications SET status='cast' WHERE id='956836bf-755b-4d1e-996d-741238b5cdda';
  RAISE EXCEPTION 'TEST FAILED: check-in staff changed casting decision';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 BEGIN
  UPDATE public.audition_applications SET org_notes='Not permitted' WHERE id='956836bf-755b-4d1e-996d-741238b5cdda';
  RAISE EXCEPTION 'TEST FAILED: check-in staff changed general assessment';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
END $$;
RESET ROLE;
SELECT 'PASS: adult-only audition writes, immutable account ownership, guardian declarations, protected casting/staff fields and identity-free availability counts. Fixtures rolled back.' AS result;
ROLLBACK;
