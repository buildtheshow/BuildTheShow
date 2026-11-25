BEGIN;
UPDATE auth.users SET raw_user_meta_data=raw_user_meta_data||'{"first_name":"Synthetic","last_name":"Parent","additional_profile_draft":{"first_name":"Friedrich","date_of_birth":"2014-01-01"}}' WHERE id='4180925a-80f5-443d-aed7-9792e5e96172';
INSERT INTO public.profiles(id,user_id,account_id,credit_name,date_of_birth) VALUES('b1ad0000-0000-4000-8000-000000000010','4180925a-80f5-443d-aed7-9792e5e96172','4180925a-80f5-443d-aed7-9792e5e96172','Existing Parent','1990-01-01');
CREATE TEMP TABLE setup_test(own uuid,circle uuid,child uuid,adult uuid,invitation uuid,token text);
INSERT INTO setup_test DEFAULT VALUES;GRANT ALL ON setup_test TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
UPDATE setup_test SET own=public.bts_ensure_own_profile();
DO $$ BEGIN IF(SELECT own FROM setup_test)<>'b1ad0000-0000-4000-8000-000000000010'::uuid THEN RAISE EXCEPTION 'TEST FAILED: legacy own profile duplicated';END IF;IF public.bts_ensure_own_profile() IS DISTINCT FROM(SELECT own FROM setup_test) THEN RAISE EXCEPTION 'TEST FAILED: duplicate own profile';END IF;END $$;
UPDATE setup_test SET circle=(public.bts_circle('create_circle','{"name":"The Von Trapp Circle"}')->>'id')::uuid;
DO $$ BEGIN
 BEGIN PERFORM public.bts_create_circle_profile(gen_random_uuid(),'{"legal_first_name":"Unscoped","legal_last_name":"Person","date_of_birth":"2014-01-01","headshot_url":"https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/v1/object/public/profile-headshots/4180925a-80f5-443d-aed7-9792e5e96172/test.jpg"}',true,gen_random_uuid());RAISE EXCEPTION 'TEST FAILED: missing circle allowed';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 BEGIN PERFORM public.bts_create_circle_profile((SELECT circle FROM setup_test),'{"legal_first_name":"No","legal_last_name":"Consent","date_of_birth":"2014-01-01","headshot_url":"https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/v1/object/public/profile-headshots/4180925a-80f5-443d-aed7-9792e5e96172/test.jpg"}',false,gen_random_uuid());RAISE EXCEPTION 'TEST FAILED: guardian consent omitted';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
END $$;
UPDATE setup_test SET child=(public.bts_create_circle_profile(circle,'{"legal_first_name":"Friedrich","legal_last_name":"Von Trapp","date_of_birth":"2014-01-01","headshot_url":"https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/v1/object/public/profile-headshots/4180925a-80f5-443d-aed7-9792e5e96172/child.jpg"}',true,'b1ad0000-0000-4000-8000-000000000001')->>'id')::uuid;
DO $$ BEGIN
 IF(public.bts_create_circle_profile((SELECT circle FROM setup_test),'{}',false,'b1ad0000-0000-4000-8000-000000000001')->>'id')::uuid IS DISTINCT FROM(SELECT child FROM setup_test) THEN RAISE EXCEPTION 'TEST FAILED: duplicate retry';END IF;
 IF NOT public.bts_profile_access((SELECT child FROM setup_test)) THEN RAISE EXCEPTION 'TEST FAILED: parent cannot manage';END IF;
 IF(public.bts_profile_transfer('status',(SELECT child FROM setup_test))->>'eligible')::boolean THEN RAISE EXCEPTION 'TEST FAILED: minor can take own login';END IF;
END $$;
UPDATE setup_test SET adult=(public.bts_create_circle_profile(circle,'{"legal_first_name":"Adult","legal_last_name":"Member","date_of_birth":"1990-01-01","headshot_url":"https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/v1/object/public/profile-headshots/4180925a-80f5-443d-aed7-9792e5e96172/adult.jpg"}',false,'b1ad0000-0000-4000-8000-000000000002')->>'id')::uuid;
DO $$ BEGIN IF public.bts_profile_access((SELECT adult FROM setup_test)) THEN RAISE EXCEPTION 'TEST FAILED: unconsented adult access';END IF;END $$;
UPDATE setup_test SET invitation=(public.bts_profile_transfer('request',adult,'team-outsider@example.invalid',true)->>'id')::uuid;
RESET ROLE;
UPDATE setup_test SET token=(SELECT payload->>'token' FROM bts_private.family_mail WHERE payload->>'invite_id'=(SELECT invitation::text FROM setup_test));
DO $$ BEGIN
 IF(SELECT count(*) FROM bts_private.household_profiles WHERE household_id=(SELECT circle FROM setup_test))<>3 THEN RAISE EXCEPTION 'TEST FAILED: circle membership';END IF;
 IF EXISTS(SELECT 1 FROM auth.users WHERE id='4180925a-80f5-443d-aed7-9792e5e96172' AND raw_user_meta_data ? 'additional_profile_draft') THEN RAISE EXCEPTION 'TEST FAILED: setup draft retained after profile creation';END IF;
 IF NOT EXISTS(SELECT 1 FROM bts_private.profile_keys WHERE profile_id=(SELECT child FROM setup_test) AND user_id='4180925a-80f5-443d-aed7-9792e5e96172' AND kind='guardian' AND active) THEN RAISE EXCEPTION 'TEST FAILED: guardian key';END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"3f6513e6-1dfc-48ae-991f-e889305bb4d6","role":"authenticated"}',true);
DO $$ BEGIN BEGIN PERFORM public.bts_family('accept',jsonb_build_object('token',(SELECT token FROM setup_test),'confirmed',true));RAISE EXCEPTION 'TEST FAILED: wrong email transfer acceptance';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;END $$;
SELECT set_config('request.jwt.claims','{"sub":"131ad1e8-23b0-4756-81ce-bf59302e4b4f","role":"authenticated"}',true);
DO $$ BEGIN IF public.bts_ensure_own_profile() IS NOT NULL THEN RAISE EXCEPTION 'TEST FAILED: invitation recipient got duplicate profile';END IF;END $$;
SELECT public.bts_family('accept',jsonb_build_object('token',(SELECT token FROM setup_test),'confirmed',true,'keep_circle',false));
DO $$ BEGIN
 IF NOT public.bts_profile_access((SELECT adult FROM setup_test)) THEN RAISE EXCEPTION 'TEST FAILED: recipient profile access';END IF;
 BEGIN PERFORM public.bts_family('accept',jsonb_build_object('token',(SELECT token FROM setup_test),'confirmed',true));RAISE EXCEPTION 'TEST FAILED: transfer replay';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
DO $$ BEGIN
 IF public.bts_profile_access((SELECT adult FROM setup_test)) THEN RAISE EXCEPTION 'TEST FAILED: previous account retains access';END IF;
 IF public.bts_file_permission('profile-headshots','4180925a-80f5-443d-aed7-9792e5e96172/adult.jpg',1) THEN RAISE EXCEPTION 'TEST FAILED: previous uploader retains photo access';END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM bts_private.household_profiles WHERE profile_id=(SELECT adult FROM setup_test)) THEN RAISE EXCEPTION 'TEST FAILED: remove-circle choice ignored';END IF;
 IF has_function_privilege('anon','public.bts_ensure_own_profile()','EXECUTE') OR has_function_privilege('anon','public.bts_create_circle_profile(uuid,jsonb,boolean,uuid)','EXECUTE') THEN RAISE EXCEPTION 'TEST FAILED: anonymous setup';END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
UPDATE setup_test SET adult=(public.bts_create_circle_profile(circle,'{"legal_first_name":"Second","legal_last_name":"Adult","date_of_birth":"1990-01-01","headshot_url":"https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/v1/object/public/profile-headshots/4180925a-80f5-443d-aed7-9792e5e96172/second-adult.jpg"}',false,'b1ad0000-0000-4000-8000-000000000003')->>'id')::uuid;
UPDATE setup_test SET invitation=(public.bts_profile_transfer('request',adult,'team-owner@example.invalid',true)->>'id')::uuid;
RESET ROLE;
UPDATE setup_test SET token=(SELECT payload->>'token' FROM bts_private.family_mail WHERE payload->>'invite_id'=(SELECT invitation::text FROM setup_test));
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"1f7c169f-c707-48d2-97bb-749c5ca382a0","role":"authenticated"}',true);
SELECT public.bts_family('accept',jsonb_build_object('token',(SELECT token FROM setup_test),'confirmed',true,'keep_circle',true));
DO $$ BEGIN
 IF public.bts_profile_access((SELECT child FROM setup_test)) THEN RAISE EXCEPTION 'TEST FAILED: transfer grants access to other circle profiles';END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM bts_private.household_profiles WHERE household_id=(SELECT circle FROM setup_test) AND profile_id=(SELECT adult FROM setup_test)) OR NOT EXISTS(SELECT 1 FROM bts_private.household_members WHERE household_id=(SELECT circle FROM setup_test) AND user_id='1f7c169f-c707-48d2-97bb-749c5ca382a0') THEN RAISE EXCEPTION 'TEST FAILED: keep-circle choice ignored';END IF;
END $$;
SELECT 'PASS: own profile, circle-first creation, consent, idempotent retry, adult permission, transfer recipient, replay, prior manager and photo denial' AS result;
ROLLBACK;
