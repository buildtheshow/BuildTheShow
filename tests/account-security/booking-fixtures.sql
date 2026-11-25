UPDATE public.productions SET page_status='live' WHERE id='fdb2ec7b-a107-41e6-b960-7e6b89e8ca96';
INSERT INTO public.audition_sessions(id,production_id,name,enabled,show_to_applicants) VALUES('ef072543-8703-49a6-90d7-6f14ed5a2b41','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','Booking fixture',true,true);
INSERT INTO public.audition_time_slots(id,session_id,slot_time,capacity) VALUES('03f1a8af-1b48-4a55-ab10-9ced63588dda','ef072543-8703-49a6-90d7-6f14ed5a2b41','10:00',1),('03f1a8af-1b48-4a55-ab10-9ced63588ddb','ef072543-8703-49a6-90d7-6f14ed5a2b41','10:15',1);
CREATE TEMP TABLE booking_test(profile uuid,hold uuid,result jsonb);
INSERT INTO booking_test DEFAULT VALUES;GRANT ALL ON booking_test TO authenticated,anon;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
UPDATE booking_test SET profile=public.bts_save_profile('{"credit_name":"Booking child","date_of_birth":"2015-01-01","relationship_kind":"child","guardian_name":"Booking guardian"}',NULL,true);
UPDATE booking_test SET hold=(public.bts_audition_hold('acquire','03f1a8af-1b48-4a55-ab10-9ced63588dda')->>'id')::uuid;
DO $$ BEGIN IF (SELECT held_count FROM public.bts_public_audition_capacity('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96') WHERE slot_id='03f1a8af-1b48-4a55-ab10-9ced63588dda')<>0 THEN RAISE EXCEPTION 'TEST FAILED: own hold blocks its adult';END IF;END $$;
SELECT set_config('request.jwt.claims','{"sub":"3f6513e6-1dfc-48ae-991f-e889305bb4d6","role":"authenticated"}',true);
DO $$ BEGIN
 IF (SELECT held_count FROM public.bts_public_audition_capacity('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96') WHERE slot_id='03f1a8af-1b48-4a55-ab10-9ced63588dda')<>1 THEN RAISE EXCEPTION 'TEST FAILED: other account hold omitted';END IF;
 IF (public.bts_audition_hold('release','03f1a8af-1b48-4a55-ab10-9ced63588dda',(SELECT hold FROM booking_test))->>'released')::boolean THEN RAISE EXCEPTION 'TEST FAILED: copied reservation released by wrong adult';END IF;
 BEGIN PERFORM public.bts_audition_hold('acquire','03f1a8af-1b48-4a55-ab10-9ced63588dda');RAISE EXCEPTION 'TEST FAILED: last held place oversold';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
DO $$ DECLARE payload jsonb;receipt jsonb;BEGIN
 payload:=jsonb_build_object('production_id','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','session_id','ef072543-8703-49a6-90d7-6f14ed5a2b41','slot_id','03f1a8af-1b48-4a55-ab10-9ced63588dda','profile_id',(SELECT profile FROM booking_test),'name','Booking child','email','ignored@example.invalid','custom_answers',jsonb_build_object('Date of Birth','2015-01-01','Guardian Name','Booking guardian','__bts_guardian_confirmed',true));
 BEGIN PERFORM public.bts_confirm_audition('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',payload,payload,'[{"session_id":"ffffffff-ffff-4fff-8fff-ffffffffffff","slot_id":"03f1a8af-1b48-4a55-ab10-9ced63588ddb"}]');RAISE EXCEPTION 'TEST FAILED: invalid extra session committed';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 IF EXISTS(SELECT 1 FROM public.bts_participant_bookings WHERE profile_id=(SELECT profile FROM booking_test)) THEN RAISE EXCEPTION 'TEST FAILED: failed batch left primary booking';END IF;
 receipt:=public.bts_confirm_audition('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',payload,payload);UPDATE booking_test SET result=receipt;
 IF (SELECT booked_count FROM public.bts_public_audition_availability('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96') WHERE slot_id='03f1a8af-1b48-4a55-ab10-9ced63588dda')<>1 THEN RAISE EXCEPTION 'TEST FAILED: application and receipt counted twice';END IF;
 IF NOT (public.bts_confirm_audition('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',payload,payload)->>'replayed')::boolean THEN RAISE EXCEPTION 'TEST FAILED: retry duplicated booking';END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM bts_private.audition_holds) THEN RAISE EXCEPTION 'TEST FAILED: successful commit retained reservation';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.audition_bookings WHERE profile_id=(SELECT profile FROM booking_test) AND guardian_user_id='4180925a-80f5-443d-aed7-9792e5e96172' AND guardian_consent_at IS NOT NULL) THEN RAISE EXCEPTION 'TEST FAILED: invoker RPC bypassed guardian guard';END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"3f6513e6-1dfc-48ae-991f-e889305bb4d6","role":"authenticated"}',true);
SELECT public.bts_audition_hold('acquire','03f1a8af-1b48-4a55-ab10-9ced63588ddb');
SELECT public.bts_audition_hold('extend','03f1a8af-1b48-4a55-ab10-9ced63588ddb',(public.bts_audition_hold('acquire','03f1a8af-1b48-4a55-ab10-9ced63588ddb')->>'id')::uuid);
DO $$ BEGIN
 BEGIN PERFORM public.bts_audition_hold('extend','03f1a8af-1b48-4a55-ab10-9ced63588ddb',(public.bts_audition_hold('acquire','03f1a8af-1b48-4a55-ab10-9ced63588ddb')->>'id')::uuid);RAISE EXCEPTION 'TEST FAILED: reservation extended twice';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 IF public.bts_audition_receipt('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') IS NOT NULL THEN RAISE EXCEPTION 'TEST FAILED: other adult read booking receipt';END IF;
END $$;
RESET ROLE;
UPDATE bts_private.audition_holds SET expires_at=now()-interval '1 second' WHERE slot_id='03f1a8af-1b48-4a55-ab10-9ced63588ddb';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
DO $$ BEGIN
 IF (SELECT held_count FROM public.bts_public_audition_capacity('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96') WHERE slot_id='03f1a8af-1b48-4a55-ab10-9ced63588ddb')<>0 THEN RAISE EXCEPTION 'TEST FAILED: abandoned expired hold blocked capacity';END IF;
 IF public.bts_audition_receipt('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->>'application_id' IS NULL THEN RAISE EXCEPTION 'TEST FAILED: lost-response receipt unavailable after hold release';END IF;
 UPDATE public.bts_participant_applications SET slot_id='03f1a8af-1b48-4a55-ab10-9ced63588ddb',slot_assignments='[{"session_id":"ef072543-8703-49a6-90d7-6f14ed5a2b41","slot_id":"03f1a8af-1b48-4a55-ab10-9ced63588ddb"}]' WHERE id=((SELECT result FROM booking_test)->>'application_id')::uuid;
 IF (SELECT slot_id FROM public.bts_participant_bookings WHERE id=((SELECT result FROM booking_test)->>'booking_id')::uuid)<>'03f1a8af-1b48-4a55-ab10-9ced63588ddb' THEN RAISE EXCEPTION 'TEST FAILED: reschedule left receipt at old time';END IF;
 IF (SELECT booked_count FROM public.bts_public_audition_availability('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96') WHERE slot_id='03f1a8af-1b48-4a55-ab10-9ced63588dda')<>0 THEN RAISE EXCEPTION 'TEST FAILED: reschedule retained old capacity';END IF;
 UPDATE public.bts_participant_applications SET status='cancelled' WHERE id=((SELECT result FROM booking_test)->>'application_id')::uuid;
 IF EXISTS(SELECT 1 FROM public.bts_public_audition_availability('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96') WHERE booked_count<>0) THEN RAISE EXCEPTION 'TEST FAILED: withdrawal retained receipt capacity';END IF;
END $$;
RESET ROLE;
INSERT INTO public.audition_sessions(id,production_id,name,enabled,show_to_applicants) VALUES('ef072543-8703-49a6-90d7-6f14ed5a2b42','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','Second booking fixture',true,true);
INSERT INTO public.audition_time_slots(id,session_id,slot_time) VALUES('03f1a8af-1b48-4a55-ab10-9ced63588ddc','ef072543-8703-49a6-90d7-6f14ed5a2b42','11:00');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
DO $$ DECLARE payload jsonb;receipt jsonb;BEGIN
 payload:=jsonb_build_object('production_id','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','session_id','ef072543-8703-49a6-90d7-6f14ed5a2b41','slot_id','03f1a8af-1b48-4a55-ab10-9ced63588dda','profile_id',(SELECT profile FROM booking_test),'name','Booking child','email','ignored@example.invalid','custom_answers',jsonb_build_object('Date of Birth','2015-01-01','Guardian Name','Booking guardian','__bts_guardian_confirmed',true));
 receipt:=public.bts_confirm_audition('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab',payload,payload,'[{"session_id":"ef072543-8703-49a6-90d7-6f14ed5a2b42","slot_id":"03f1a8af-1b48-4a55-ab10-9ced63588ddc"}]');
 IF jsonb_array_length(receipt->'booking_ids')<>2 THEN RAISE EXCEPTION 'TEST FAILED: multi-session batch incomplete';END IF;
 IF (SELECT jsonb_array_length(slot_assignments) FROM public.bts_participant_applications WHERE id=(receipt->>'application_id')::uuid)<>2 THEN RAISE EXCEPTION 'TEST FAILED: multi-session application assignments incomplete';END IF;
 IF public.bts_confirm_audition('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab',payload,payload,'[{"session_id":"ef072543-8703-49a6-90d7-6f14ed5a2b42","slot_id":"03f1a8af-1b48-4a55-ab10-9ced63588ddc"}]')->>'booking_id' IS DISTINCT FROM receipt->>'booking_id' THEN RAISE EXCEPTION 'TEST FAILED: replay changed primary receipt';END IF;
 BEGIN PERFORM public.bts_confirm_audition('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab',payload,payload,'[]');RAISE EXCEPTION 'TEST FAILED: replay accepted different session set';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF has_schema_privilege('authenticated','bts_private','USAGE') OR has_table_privilege('authenticated','bts_private.audition_holds','SELECT') OR has_function_privilege('anon','public.bts_confirm_audition(uuid,jsonb,jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'TEST FAILED: new reservation surface exposed';END IF;
END $$;
SELECT 'PASS: private account-bound holds, last-place protection, wrong-adult denial, atomic rollback, canonical occupancy, guardian guards, idempotent retries, lost-response recovery, bounded extension, expiry, rescheduling and withdrawal.' AS result;
ROLLBACK;
