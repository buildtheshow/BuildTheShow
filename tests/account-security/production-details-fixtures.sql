BEGIN;
CREATE TEMP TABLE detail_test(own uuid,child uuid,other uuid,app uuid);
UPDATE public.productions SET is_public=true,page_status='live' WHERE id='fdb2ec7b-a107-41e6-b960-7e6b89e8ca96';
INSERT INTO detail_test DEFAULT VALUES;GRANT ALL ON detail_test TO authenticated;
INSERT INTO bts_private.production_team_accounts(team_member_id,user_id,accepted_email) VALUES('e8f51d99-0106-4dc4-832d-251bb2f13b1f','4180925a-80f5-443d-aed7-9792e5e96172','team-creative@example.invalid');
INSERT INTO public.production_team_members(production_id,name,email,role,passcode,note_color) VALUES('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','Coordinator fixture','coordinator@example.invalid','Volunteer Coordinator','789123','#efab45');
SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
UPDATE detail_test SET own=public.bts_save_profile('{"credit_name":"Own adult","date_of_birth":"1990-01-01","relationship_kind":"self"}',NULL,false),child=public.bts_save_profile('{"credit_name":"Child performer","date_of_birth":"2014-01-01","guardian_name":"Parent","relationship_kind":"child"}',NULL,true),other=public.bts_save_profile('{"credit_name":"Other child","date_of_birth":"2015-01-01","guardian_name":"Parent","relationship_kind":"child"}',NULL,true);
WITH a AS(INSERT INTO public.bts_participant_applications(production_id,profile_id,name,email,custom_answers) SELECT 'fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',child,'Ignored','ignored@example.invalid','{"__bts_cast_offer_status":"accepted"}' FROM detail_test RETURNING id)UPDATE detail_test SET app=(SELECT id FROM a);
RESET ROLE;
INSERT INTO public.production_characters(id,production_id,name) VALUES('a0ad0000-0000-4000-8000-000000000002','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','Child role');
INSERT INTO public.casting_assignments(production_id,applicant_id,character_id,state)SELECT 'fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',app,'a0ad0000-0000-4000-8000-000000000002','offer_accepted' FROM detail_test;
INSERT INTO public.production_events(production_id,title,event_type,start_time,show_in_cast_schedule,called_cast,arrive_note,notes) VALUES
('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','Selected dress','dress',now()+interval '2 days',true,'{"type":"individuals","character_ids":["a0ad0000-0000-4000-8000-000000000002"]}','Stage door at 4 pm','PRIVATE_STAFF_NOTE'),
('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','OTHER_CAST_PRIVATE','rehearsal',now()+interval '3 days',true,'{"type":"individuals","character_ids":["a0ad0000-0000-4000-8000-000000000003"]}',NULL,'PRIVATE_STAFF_NOTE'),
('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','Call unconfirmed','rehearsal',now()+interval '4 days',true,NULL,NULL,NULL),
('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','STAFF_ONLY_EVENT','meeting',now()+interval '5 days',false,NULL,NULL,NULL);
INSERT INTO public.production_events(production_id,title,event_type,start_time,show_in_cast_schedule,called_character_ids) VALUES('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','OTHER_LEGACY_CAST','rehearsal',now()+interval '6 days',true,'["a0ad0000-0000-4000-8000-000000000003"]');
INSERT INTO public.production_files(production_id,name,file_url,file_path) VALUES('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','PRIVATE_WORKING_FILE','https://example.invalid/internal.pdf','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96/internal.pdf');
INSERT INTO public.production_events(production_id,title,event_type,start_time,is_public,show_in_cast_schedule,called_cast) VALUES('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','Public other-cast information','performance',now()+interval '7 days',true,true,'{"type":"individuals","character_ids":["a0ad0000-0000-4000-8000-000000000003"]}');
SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
DO $$ DECLARE result jsonb; BEGIN
 result:=public.bts_member_production_details('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',(SELECT child FROM detail_test));
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(result->'events') e WHERE e->>'title'='Public other-cast information' AND e->>'call_status'<>'information') THEN RAISE EXCEPTION 'TEST FAILED: public event incorrectly marked as own call';END IF;
 IF result->'contact'->>'role'<>'Producer' OR result::text NOT LIKE '%Selected dress%' OR result::text NOT LIKE '%unconfirmed%' OR result::text NOT LIKE '%Stage door at 4 pm%' THEN RAISE EXCEPTION 'TEST FAILED: cast contact, matched call, pending call or instructions';END IF;
 IF result::text LIKE '%OTHER_CAST_PRIVATE%' OR result::text LIKE '%STAFF_ONLY_EVENT%' OR result::text LIKE '%PRIVATE_STAFF_NOTE%' OR result::text LIKE '%OTHER_LEGACY_CAST%' OR result::text LIKE '%PRIVATE_WORKING_FILE%' OR result::text LIKE '%passcode%' OR result::text LIKE '%portal_token%' OR result->>'is_team'<>'false' THEN RAISE EXCEPTION 'TEST FAILED: staff/other cast details leaked into child view';END IF;
 BEGIN PERFORM public.bts_member_production_details('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',(SELECT other FROM detail_test));RAISE EXCEPTION 'TEST FAILED: unrelated child allowed';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 BEGIN PERFORM public.bts_member_production_details('8efb6463-9c50-444f-9305-be2c83d12ce4',(SELECT child FROM detail_test));RAISE EXCEPTION 'TEST FAILED: unrelated production allowed';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
END $$;
RESET ROLE;
INSERT INTO public.volunteer_signups(production_id,profile_id,user_id,name,email,role_name,status) SELECT 'fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',other,'4180925a-80f5-443d-aed7-9792e5e96172','Volunteer fixture','volunteer@example.invalid','Set build','approved' FROM detail_test;
SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
DO $$ DECLARE result jsonb; BEGIN result:=public.bts_member_production_details('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',(SELECT other FROM detail_test));IF result->'contact'->>'role'<>'Volunteer Coordinator' OR EXISTS(SELECT 1 FROM jsonb_array_elements(result->'events') e WHERE e->>'call_status'<>'information') OR jsonb_array_length(result->'files')<>0 THEN RAISE EXCEPTION 'TEST FAILED: volunteer contact or cast/files boundary';END IF;END $$;
RESET ROLE;
INSERT INTO public.volunteer_signups(production_id,profile_id,user_id,name,email,role_name,status) SELECT 'fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',child,'4180925a-80f5-443d-aed7-9792e5e96172','Mixed-role fixture','mixed@example.invalid','Set build','approved' FROM detail_test;
SET LOCAL ROLE authenticated;
DO $$ DECLARE result jsonb; BEGIN result:=public.bts_member_production_details('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',(SELECT child FROM detail_test));IF result->'contact'->>'kind'<>'volunteer' OR result->'contacts'->0->>'role'<>'Producer' THEN RAISE EXCEPTION 'TEST FAILED: mixed-role member needs both contacts';END IF;END $$;
SELECT set_config('request.jwt.claims','{"sub":"131ad1e8-23b0-4756-81ce-bf59302e4b4f","role":"authenticated"}',true);
DO $$ BEGIN BEGIN PERFORM public.bts_member_production_details('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',(SELECT child FROM detail_test));RAISE EXCEPTION 'TEST FAILED: outsider allowed';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;END $$;
RESET ROLE;
DO $$ BEGIN IF has_function_privilege('anon','public.bts_member_production_details(uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'TEST FAILED: anonymous details access';END IF;END $$;
SELECT 'PASS: role contacts, cast call list, legacy calls, pending call status, notes privacy, volunteer boundaries and outsider denial' AS result;
ROLLBACK;
