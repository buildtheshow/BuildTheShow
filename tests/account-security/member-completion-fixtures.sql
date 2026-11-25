RESET ROLE;
UPDATE public.production_events SET end_time=start_time+interval '2 hours' WHERE title='Selected dress';
CREATE TEMP TABLE completion_events AS SELECT * FROM public.production_events WHERE title IN('Selected dress','Public other-cast information');
GRANT SELECT ON completion_events TO authenticated;
INSERT INTO bts_private.profile_keys(profile_id,user_id,kind,declared_name,active,consented_at) SELECT child,'131ad1e8-23b0-4756-81ce-bf59302e4b4f','guardian','Other parent',true,now() FROM detail_test;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.bts_member_contacts((SELECT child FROM detail_test),'save','{"version":0,"details":{"contact_name":"Private Parent","email":"parent@example.invalid","phone":"555-0001","emergency_name":"PRIVATE_EMERGENCY","emergency_phone":"555-0002"}}');
 IF r->>'version'<>'1' OR r->'details'->>'emergency_name'<>'PRIVATE_EMERGENCY' THEN RAISE EXCEPTION 'TEST FAILED: private contacts save/read';END IF;
 BEGIN PERFORM public.bts_member_contacts((SELECT child FROM detail_test),'save','{"version":0,"details":{}}');RAISE EXCEPTION 'TEST FAILED: stale contact overwrite';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 PERFORM public.bts_member_contacts((SELECT child FROM detail_test),'share','{"production_id":"fdb2ec7b-a107-41e6-b960-7e6b89e8ca96","version":1,"contact":true,"emergency":false}');
 BEGIN PERFORM public.bts_member_contacts((SELECT child FROM detail_test),'share','{"production_id":"8efb6463-9c50-444f-9305-be2c83d12ce4","version":1,"contact":true}');RAISE EXCEPTION 'TEST FAILED: unrelated production contacts';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"131ad1e8-23b0-4756-81ce-bf59302e4b4f","role":"authenticated"}',true);
DO $$ DECLARE r jsonb; BEGIN
 IF NOT public.bts_profile_access((SELECT child FROM detail_test),true) THEN RAISE EXCEPTION 'TEST FAILED: second guardian fixture lacks general profile access';END IF;
 r:=public.bts_member_contacts((SELECT child FROM detail_test));
 IF r->>'can_edit'<>'false' OR r ? 'details' THEN RAISE EXCEPTION 'TEST FAILED: private contacts leaked to other parent';END IF;
 BEGIN PERFORM public.bts_member_contacts((SELECT child FROM detail_test),'save','{"version":1,"details":{}}');RAISE EXCEPTION 'TEST FAILED: second parent sabotage';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 BEGIN PERFORM 1 FROM bts_private.member_contact_details;RAISE EXCEPTION 'TEST FAILED: direct private table read';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.bts_production_member_contacts('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',(SELECT child FROM detail_test));RAISE EXCEPTION 'TEST FAILED: unverified producer title granted contacts';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"1f7c169f-c707-48d2-97bb-749c5ca382a0","role":"authenticated"}',true);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.bts_production_member_contacts('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',(SELECT child FROM detail_test));
 IF r->>'contact_name'<>'Private Parent' OR r ? 'emergency_name' THEN RAISE EXCEPTION 'TEST FAILED: explicit contact sharing boundary';END IF;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
DO $$ DECLARE e public.production_events%rowtype; r jsonb; d jsonb; BEGIN
 SELECT * INTO e FROM completion_events WHERE title='Selected dress';
 d:=jsonb_build_object('profile_id',(SELECT child FROM detail_test),'production_id',e.production_id,'event_key','event:'||e.id,'event_date',e.start_time::date,'absence_type','late','change_time',e.start_time+interval '30 minutes','note','A prior appointment','version',0);
 r:=public.bts_member_absence('report',d);
 IF r->>'state'<>'reported' OR r->>'email_queued'<>'true' THEN RAISE EXCEPTION 'TEST FAILED: absence report/notification';END IF;
 BEGIN PERFORM public.bts_member_absence('report',d);RAISE EXCEPTION 'TEST FAILED: stale absence overwrite';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 BEGIN PERFORM public.bts_member_absence('report',(d||jsonb_build_object('version',1,'change_time',e.end_time+interval '1 hour')));RAISE EXCEPTION 'TEST FAILED: invalid arrival time';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 BEGIN PERFORM public.bts_member_absence('report',(d||jsonb_build_object('event_key','event:00000000-0000-4000-8000-000000000001','version',0)));RAISE EXCEPTION 'TEST FAILED: invented event';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 SELECT * INTO e FROM completion_events WHERE title='Public other-cast information';
 BEGIN PERFORM public.bts_member_absence('report',d||jsonb_build_object('event_key','event:'||e.id,'event_date',e.start_time::date,'version',0));RAISE EXCEPTION 'TEST FAILED: information-only absence';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"1f7c169f-c707-48d2-97bb-749c5ca382a0","role":"authenticated"}',true);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.bts_member_absence('production','{"production_id":"fdb2ec7b-a107-41e6-b960-7e6b89e8ca96"}');
 IF jsonb_array_length(r)<>1 THEN RAISE EXCEPTION 'TEST FAILED: staff report list';END IF;
 r:=public.bts_member_absence('acknowledge',jsonb_build_object('id',r->0->>'id'));
 IF r->>'state'<>'acknowledged' THEN RAISE EXCEPTION 'TEST FAILED: acknowledgement';END IF;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
DO $$ DECLARE e public.production_events%rowtype; r jsonb; BEGIN
 SELECT * INTO e FROM completion_events WHERE title='Selected dress';
 r:=public.bts_member_absence('withdraw',jsonb_build_object('profile_id',(SELECT child FROM detail_test),'event_key','event:'||e.id,'version',2));
 IF r->>'state'<>'withdrawn' THEN RAISE EXCEPTION 'TEST FAILED: withdrawal';END IF;
 PERFORM public.bts_member_contacts((SELECT child FROM detail_test),'unshare','{"production_id":"fdb2ec7b-a107-41e6-b960-7e6b89e8ca96"}');
END $$;
SELECT set_config('request.jwt.claims','{"sub":"1f7c169f-c707-48d2-97bb-749c5ca382a0","role":"authenticated"}',true);
DO $$ BEGIN IF public.bts_production_member_contacts('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',(SELECT child FROM detail_test))<>'{}' THEN RAISE EXCEPTION 'TEST FAILED: sharing revocation';END IF;END $$;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.production_events WHERE title='Selected dress' AND start_time IS NULL) OR NOT EXISTS(SELECT 1 FROM bts_private.family_mail WHERE kind='absence_report') THEN RAISE EXCEPTION 'TEST FAILED: scheduled event/queued email';END IF;
 IF has_function_privilege('anon','public.bts_member_contacts(uuid,text,jsonb)','EXECUTE') OR has_function_privilege('anon','public.bts_member_absence(text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'TEST FAILED: anonymous private access';END IF;
END $$;
INSERT INTO bts_private.profile_file_keys(profile_id,bucket,name,created_by) SELECT child,'profile-headshots','completion/selected.pdf','4180925a-80f5-443d-aed7-9792e5e96172' FROM detail_test;
INSERT INTO bts_private.profile_file_keys(profile_id,bucket,name,created_by) SELECT child,'profile-headshots','completion/unselected.pdf','4180925a-80f5-443d-aed7-9792e5e96172' FROM detail_test;
UPDATE public.audition_applications SET file_url='https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/v1/object/public/profile-headshots/completion/selected.pdf' WHERE id=(SELECT app FROM detail_test);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"1f7c169f-c707-48d2-97bb-749c5ca382a0","role":"authenticated"}',true);
DO $$ BEGIN
 IF NOT public.bts_file_permission('profile-headshots','completion/selected.pdf',1) THEN RAISE EXCEPTION 'TEST FAILED: submitted CV unavailable to staff';END IF;
 IF public.bts_file_permission('profile-headshots','completion/unselected.pdf',1) THEN RAISE EXCEPTION 'TEST FAILED: unselected saved file leaked to staff';END IF;
END $$;
RESET ROLE;
SELECT 'PASS: private contacts, parent isolation, production consent/revocation, guarded absence reports, queued notifications and staff acknowledgement' AS result;
ROLLBACK;
