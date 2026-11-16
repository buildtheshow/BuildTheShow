CREATE TEMP TABLE unified_test(child uuid,signup uuid,invite uuid,token text,team_token text);
INSERT INTO unified_test DEFAULT VALUES;
GRANT ALL ON unified_test TO authenticated,anon,service_role;
UPDATE public.productions SET page_status='live' WHERE id='fdb2ec7b-a107-41e6-b960-7e6b89e8ca96';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
UPDATE unified_test SET child=public.bts_save_profile('{"credit_name":"Synthetic child","date_of_birth":"2014-01-01","guardian_name":"Synthetic guardian A","relationship_kind":"child"}',NULL,true);
DO $$ DECLARE home jsonb;BEGIN
 home:=public.bts_my_home();IF jsonb_array_length(home->'profiles')<>1 OR jsonb_array_length(home->'management')<>0 THEN RAISE EXCEPTION 'TEST FAILED: one-account home leaks unaccepted staff memberships';END IF;
 BEGIN PERFORM public.bts_open_production('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96');RAISE EXCEPTION 'TEST FAILED: email match granted staff access';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
END $$;
SELECT public.bts_request_production_access('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96');
RESET ROLE;
UPDATE unified_test SET token=(SELECT payload->>'token' FROM bts_private.family_mail WHERE kind='team_invitation' LIMIT 1);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"3f6513e6-1dfc-48ae-991f-e889305bb4d6","role":"authenticated"}',true);
DO $$ BEGIN
 BEGIN PERFORM public.bts_production_invitation((SELECT token FROM unified_test),true);RAISE EXCEPTION 'TEST FAILED: copied staff invite accepted by wrong login';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
SELECT public.bts_production_invitation(token,true) FROM unified_test;
UPDATE unified_test SET team_token=(SELECT session_token FROM public.bts_open_production('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96'));
DO $$ DECLARE home jsonb;BEGIN
 home:=public.bts_my_home();IF jsonb_array_length(home->'management')<>1 THEN RAISE EXCEPTION 'TEST FAILED: accepted membership missing from unified home';END IF;
 IF NOT public.bts_production_page_permission('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','auditions.general',2) OR public.bts_production_page_permission('8efb6463-9c50-444f-9305-be2c83d12ce4','auditions.general',1) THEN RAISE EXCEPTION 'TEST FAILED: accepted staff scope';END IF;
END $$;
UPDATE unified_test SET signup=(public.bts_request_volunteer_shifts('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',jsonb_build_array(jsonb_build_object('profile_id',child,'role_name','Usher','shift_date','2026-12-01','shift_start_time','10:00','shift_end_time','12:00')))->'ids'->>0)::uuid;
UPDATE unified_test SET invite=(public.bts_family('invite',jsonb_build_object('profile_id',child,'kind','guardian','email','team-viewer@example.invalid'))->>'id')::uuid;
RESET ROLE;
UPDATE unified_test f SET token=m.payload->>'token' FROM bts_private.family_mail m WHERE m.payload->>'invite_id'=f.invite::text;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"3f6513e6-1dfc-48ae-991f-e889305bb4d6","role":"authenticated"}',true);
SELECT public.bts_family('accept',jsonb_build_object('token',token,'confirmed',true,'guardian_confirmed',true,'name','Synthetic guardian B')) FROM unified_test;
DO $$ DECLARE home jsonb;BEGIN
 home:=public.bts_my_home();IF jsonb_array_length(home->'volunteers')<>1 OR NOT EXISTS(SELECT 1 FROM public.bts_participant_volunteers WHERE id=(SELECT signup FROM unified_test)) THEN RAISE EXCEPTION 'TEST FAILED: separate guardian cannot see canonical child volunteer schedule';END IF;
 UPDATE public.bts_participant_volunteers SET notes='Synthetic guardian B update' WHERE id=(SELECT signup FROM unified_test);IF NOT FOUND THEN RAISE EXCEPTION 'TEST FAILED: shared volunteer update failed';END IF;
 BEGIN UPDATE public.bts_participant_volunteers SET approved_hours=999,status='approved' WHERE id=(SELECT signup FROM unified_test);RAISE EXCEPTION 'TEST FAILED: parent awarded own hours or approval';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 BEGIN PERFORM public.bts_request_volunteer_shifts('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',(SELECT jsonb_build_array(jsonb_build_object('profile_id',child,'role_name','Usher','shift_date','2026-12-01','shift_start_time','10:00')) FROM unified_test));RAISE EXCEPTION 'TEST FAILED: second login duplicated same child shift';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"131ad1e8-23b0-4756-81ce-bf59302e4b4f","role":"authenticated"}',true);
DO $$ BEGIN IF jsonb_array_length(public.bts_my_home()->'volunteers')<>0 OR public.bts_owns_volunteer((SELECT signup FROM unified_test)) THEN RAISE EXCEPTION 'TEST FAILED: unrelated account sees volunteer family';END IF;END $$;
RESET ROLE;
UPDATE bts_private.profile_keys SET active=false WHERE profile_id=(SELECT child FROM unified_test) AND user_id='3f6513e6-1dfc-48ae-991f-e889305bb4d6';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"3f6513e6-1dfc-48ae-991f-e889305bb4d6","role":"authenticated"}',true);
DO $$ BEGIN IF public.bts_owns_volunteer((SELECT signup FROM unified_test)) THEN RAISE EXCEPTION 'TEST FAILED: revoked guardian keeps volunteer access';END IF;END $$;
RESET ROLE;
UPDATE public.profiles SET date_of_birth=(current_date-interval '18 years')::date WHERE id=(SELECT child FROM unified_test);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
DO $$ BEGIN IF public.bts_owns_volunteer((SELECT signup FROM unified_test)) THEN RAISE EXCEPTION 'TEST FAILED: original creator keeps volunteer access at 18';END IF;END $$;
RESET ROLE;
RESET ROLE;
-- An accepted account remains the same adult when their email changes.
UPDATE public.production_team_members SET access_level='producer' WHERE id='e8f51d99-0106-4dc4-832d-251bb2f13b1f';
UPDATE auth.users SET email='changed-creative@example.invalid' WHERE id='4180925a-80f5-443d-aed7-9792e5e96172';
SET LOCAL ROLE service_role;
DO $$ BEGIN IF NOT (public.bts_authorize_email_send('4180925a-80f5-443d-aed7-9792e5e96172','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',false)->>'allowed')::boolean THEN RAISE EXCEPTION 'TEST FAILED: accepted staff authority incorrectly depends on old email';END IF;END $$;
RESET ROLE;
UPDATE auth.users SET email='team-creative@example.invalid' WHERE id='4180925a-80f5-443d-aed7-9792e5e96172';
UPDATE public.production_team_members SET access_level='creative' WHERE id='e8f51d99-0106-4dc4-832d-251bb2f13b1f';
-- Organisation invitation recipients come from the saved invitation, never caller-supplied content.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"1f7c169f-c707-48d2-97bb-749c5ca382a0","role":"authenticated"}',true);
WITH saved AS(INSERT INTO public.org_invitations(org_id,email,access_level,invited_by) VALUES('432b1ee2-515d-4637-9f8f-c733fd21f219','team-outsider@example.invalid','viewer',auth.uid()) RETURNING id) SELECT public.bts_email_org_invitation(id) FROM saved;
RESET ROLE;
-- A managed adult's audition permission does not silently grant volunteer permission.
ALTER TABLE unified_test ADD COLUMN adult uuid;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
UPDATE unified_test SET adult=public.bts_save_profile('{"credit_name":"Synthetic partner","date_of_birth":"1990-01-01","relationship_kind":"adult","permission_email":"team-viewer@example.invalid"}',NULL,false);
RESET ROLE;
UPDATE unified_test t SET token=m.payload->>'token' FROM bts_private.family_mail m WHERE m.profile_id=t.adult AND m.kind='invitation';
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
SELECT public.bts_family('accept',jsonb_build_object('token',token,'confirmed',true)) FROM unified_test;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
DO $$ BEGIN IF NOT public.bts_profile_access((SELECT adult FROM unified_test)) OR public.bts_volunteer_profile_access((SELECT adult FROM unified_test)) THEN RAISE EXCEPTION 'TEST FAILED: adult volunteer scope expanded without permission';END IF;END $$;
RESET ROLE;
UPDATE unified_test t SET token=m.payload->>'token' FROM bts_private.family_mail m WHERE m.profile_id=t.adult AND m.kind='consent_receipt';
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
SELECT public.bts_family('allow_volunteer_help',jsonb_build_object('token',token,'confirmed',true)) FROM unified_test;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
DO $$ BEGIN IF NOT public.bts_volunteer_profile_access((SELECT adult FROM unified_test)) THEN RAISE EXCEPTION 'TEST FAILED: explicit no-login adult volunteer permission unavailable';END IF;END $$;
SELECT public.bts_request_volunteer_shifts('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',jsonb_build_array(jsonb_build_object('profile_id',adult,'role_name','Usher','shift_date','2026-12-02'))) FROM unified_test;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
SELECT public.bts_family('withdraw_permission',jsonb_build_object('token',token,'confirmed',true)) FROM unified_test;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
DO $$ BEGIN IF public.bts_volunteer_profile_access((SELECT adult FROM unified_test)) OR EXISTS(SELECT 1 FROM public.bts_participant_volunteers WHERE profile_id=(SELECT adult FROM unified_test)) THEN RAISE EXCEPTION 'TEST FAILED: no-login permission withdrawal leaves volunteer access';END IF;END $$;
RESET ROLE;
-- Historical records need inbox proof plus an actual profile key. Names/emails alone grant nothing.
ALTER TABLE unified_test ADD COLUMN history_token text;
UPDATE public.profiles SET date_of_birth='2014-01-01' WHERE id=(SELECT child FROM unified_test);
INSERT INTO public.volunteer_signups(id,production_id,name,email,role_name,status) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','Synthetic child','team-creative@example.invalid','Older usher','approved'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','Someone else','team-creative@example.invalid','Older helper','approved'),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','Synthetic child','other@example.invalid','Unrelated record','approved');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
SELECT public.bts_request_volunteer_history();
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.bts_participant_volunteers WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') THEN RAISE EXCEPTION 'TEST FAILED: requesting email silently granted history';END IF;END $$;
RESET ROLE;
UPDATE unified_test t SET history_token=m.payload->>'token' FROM bts_private.family_mail m JOIN bts_private.family_invites i ON i.id::text=m.payload->>'invite_id' WHERE m.kind='volunteer_history' AND 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid=ANY(i.volunteer_signup_ids);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"131ad1e8-23b0-4756-81ce-bf59302e4b4f","role":"authenticated"}',true);
DO $$ BEGIN BEGIN PERFORM public.bts_confirm_volunteer_history((SELECT history_token FROM unified_test),(SELECT child FROM unified_test),true);RAISE EXCEPTION 'TEST FAILED: wrong adult claimed history';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;END $$;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
SELECT public.bts_confirm_volunteer_history(history_token,child,true) FROM unified_test;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.bts_participant_volunteers WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND profile_id=(SELECT child FROM unified_test)) THEN RAISE EXCEPTION 'TEST FAILED: confirmed history missing';END IF;
 IF EXISTS(SELECT 1 FROM public.bts_participant_volunteers WHERE id IN('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc')) THEN RAISE EXCEPTION 'TEST FAILED: history claim included other people';END IF;
 BEGIN PERFORM public.bts_confirm_volunteer_history((SELECT history_token FROM unified_test),(SELECT child FROM unified_test),true);RAISE EXCEPTION 'TEST FAILED: history token replayed';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
END $$;
RESET ROLE;
UPDATE public.production_team_members SET is_active=false WHERE id='e8f51d99-0106-4dc4-832d-251bb2f13b1f';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.bts_open_production('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96');RAISE EXCEPTION 'TEST FAILED: inactive staff reopens membership';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 IF public.bts_production_page_permission('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','auditions.general',1) THEN RAISE EXCEPTION 'TEST FAILED: removed staff session remains active';END IF;
END $$;
RESET ROLE;
SELECT 'PASS: unified home, recipient-confirmed staff membership without repeated codes, cross-production denial, profile-bound volunteering, separate guardians, no duplicate shifts, protected hours/approvals, unrelated-account denial, guardian revocation/adulthood and staff revocation.' AS result;
ROLLBACK;
