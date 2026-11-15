INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES
('1f7c169f-c707-48d2-97bb-749c5ca382a0','team-owner@example.invalid',now(),'{"date_of_birth":"1990-01-01","privacy_accepted":true,"terms_accepted":true}'),
('4180925a-80f5-443d-aed7-9792e5e96172','team-creative@example.invalid',now(),'{"date_of_birth":"1990-01-01","privacy_accepted":true,"terms_accepted":true}'),
('3f6513e6-1dfc-48ae-991f-e889305bb4d6','team-viewer@example.invalid',now(),'{"date_of_birth":"1990-01-01","privacy_accepted":true,"terms_accepted":true}'),
('131ad1e8-23b0-4756-81ce-bf59302e4b4f','team-outsider@example.invalid',now(),'{"date_of_birth":"1990-01-01","privacy_accepted":true,"terms_accepted":true}');
INSERT INTO public.organizations(id,name,admin_id,slug) VALUES('432b1ee2-515d-4637-9f8f-c733fd21f219','Synthetic team organisation','1f7c169f-c707-48d2-97bb-749c5ca382a0','bts-team-fixture');
INSERT INTO public.productions(id,organization_id,title) VALUES
('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','432b1ee2-515d-4637-9f8f-c733fd21f219','Synthetic team production'),
('8efb6463-9c50-444f-9305-be2c83d12ce4','432b1ee2-515d-4637-9f8f-c733fd21f219','Different synthetic production');
INSERT INTO public.audition_applications(id,production_id,name) VALUES
('956836bf-755b-4d1e-996d-741238b5cdda','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','Synthetic applicant'),
('026b55aa-ac34-4a41-b88e-555db487fe64','8efb6463-9c50-444f-9305-be2c83d12ce4','Different synthetic applicant');
INSERT INTO public.production_team_members(id,production_id,name,email,role,access_level,passcode,note_color) VALUES
('e8f51d99-0106-4dc4-832d-251bb2f13b1f','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','Creative fixture','team-creative@example.invalid','Producer','creative','123456','#572e88'),
('df6bce8f-30a1-4e2d-a415-ea0663ddf006','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','Viewer fixture','team-viewer@example.invalid','Owner','view_only','654321','#769e7b'),
('ed99688d-9559-42d3-8a15-042e7c4b06cf','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','Unverified staff identity','team-outsider@example.invalid','Producer','producer','112233','#476aaa');
UPDATE public.audition_applications SET headshot_url='https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/v1/object/public/profile-headshots/1f7c169f-c707-48d2-97bb-749c5ca382a0/child.jpg' WHERE id='956836bf-755b-4d1e-996d-741238b5cdda';
CREATE TEMP TABLE team_test_tokens(creative text,viewer text,note_id uuid);
INSERT INTO team_test_tokens DEFAULT VALUES;
GRANT ALL ON team_test_tokens TO authenticated;

DO $$ DECLARE f record; BEGIN
  IF to_regprocedure('public.team_member_login(uuid,text)') IS NOT NULL THEN RAISE EXCEPTION 'TEST FAILED: passcode-only login survives'; END IF;
  IF has_table_privilege('anon','public.production_audition_notes','SELECT') OR
    has_table_privilege('anon','public.production_audition_notes','INSERT') THEN RAISE EXCEPTION 'TEST FAILED: anonymous direct notes access survives'; END IF;
  IF has_schema_privilege('authenticated','bts_private','USAGE') THEN RAISE EXCEPTION 'TEST FAILED: browser can reach private legacy implementations'; END IF;
  FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'team\_%' ESCAPE '\' LOOP
    IF has_function_privilege('anon',f.oid,'EXECUTE') THEN RAISE EXCEPTION 'TEST FAILED: anonymous team RPC remains'; END IF;
  END LOOP;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
DO $$ DECLARE token text; new_note_id uuid; BEGIN
  BEGIN
    PERFORM public.team_member_start_session('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','team-viewer@example.invalid','654321');
    RAISE EXCEPTION 'TEST FAILED: account used someone else team email';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF; END;
  SELECT session_token INTO token FROM public.team_member_start_session('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','team-creative@example.invalid','123456');
  IF token IS NULL OR length(token)<>64 THEN RAISE EXCEPTION 'TEST FAILED: session not created'; END IF;
  UPDATE team_test_tokens SET creative=token;
  IF (SELECT count(*) FROM public.team_member_resume_session('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',token))<>1 THEN RAISE EXCEPTION 'TEST FAILED: own session cannot resume'; END IF;
  SELECT id INTO new_note_id FROM public.team_note_add_for_session('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',token,'956836bf-755b-4d1e-996d-741238b5cdda',p_body=>'Synthetic note');
  UPDATE team_test_tokens SET note_id=new_note_id;
  BEGIN
    PERFORM public.team_note_add_for_session('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',token,'026b55aa-ac34-4a41-b88e-555db487fe64',p_body=>'Wrong production');
    RAISE EXCEPTION 'TEST FAILED: cross-production note accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.team_member_manage_page_access_for_session('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',token,'e8f51d99-0106-4dc4-832d-251bb2f13b1f','[]',true);
    RAISE EXCEPTION 'TEST FAILED: job title grants access management';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.team_member_resume_session('8efb6463-9c50-444f-9305-be2c83d12ce4',token);
    RAISE EXCEPTION 'TEST FAILED: cross-production token accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"131ad1e8-23b0-4756-81ce-bf59302e4b4f","role":"authenticated"}',true);
DO $$ BEGIN
  IF public.bts_can_read_profile_file('1f7c169f-c707-48d2-97bb-749c5ca382a0/child.jpg') THEN
    RAISE EXCEPTION 'TEST FAILED: staff email match without bound session reads private media';
  END IF;
  BEGIN
    PERFORM public.team_member_resume_session('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',(SELECT creative FROM team_test_tokens));
    RAISE EXCEPTION 'TEST FAILED: copied token works in different account';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"3f6513e6-1dfc-48ae-991f-e889305bb4d6","role":"authenticated"}',true);
DO $$ DECLARE token text; attempt integer; BEGIN
  SELECT session_token INTO token FROM public.team_member_start_session('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','team-viewer@example.invalid','654321');
  UPDATE team_test_tokens SET viewer=token;
  IF (SELECT count(*) FROM public.team_authored_notes_for_production('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',token))<>1 THEN RAISE EXCEPTION 'TEST FAILED: viewer cannot read permitted notes'; END IF;
  IF EXISTS(SELECT 1 FROM public.production_audition_notes WHERE production_id='fdb2ec7b-a107-41e6-b960-7e6b89e8ca96') THEN
    RAISE EXCEPTION 'TEST FAILED: viewer can bypass checked RPC with direct table read';
  END IF;
  BEGIN
    INSERT INTO public.production_audition_notes(production_id,applicant_id,body,author_name)
      VALUES('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','956836bf-755b-4d1e-996d-741238b5cdda','Direct viewer write','Synthetic');
    RAISE EXCEPTION 'TEST FAILED: viewer bypassed RPC with direct note insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.team_note_add_for_session('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',token,'956836bf-755b-4d1e-996d-741238b5cdda',p_body=>'Viewer write');
    RAISE EXCEPTION 'TEST FAILED: viewer wrote a note';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF; END;
  FOR attempt IN 1..19 LOOP
    IF EXISTS(SELECT 1 FROM public.team_member_start_session('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','team-viewer@example.invalid','000000')) THEN
      RAISE EXCEPTION 'TEST FAILED: incorrect code created a session';
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.team_member_start_session('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','team-viewer@example.invalid','654321')) THEN
    RAISE EXCEPTION 'TEST FAILED: login attempt limit bypassed';
  END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$ DECLARE result jsonb; BEGIN
  result:=public.bts_authorize_email_send('131ad1e8-23b0-4756-81ce-bf59302e4b4f','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',true);
  IF (result->>'allowed')::boolean THEN RAISE EXCEPTION 'TEST FAILED: staff email match without bound session sends email'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"131ad1e8-23b0-4756-81ce-bf59302e4b4f","role":"authenticated"}',true);
DO $$ BEGIN
  PERFORM public.team_member_start_session('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','team-outsider@example.invalid','112233');
  IF NOT public.bts_can_read_profile_file('1f7c169f-c707-48d2-97bb-749c5ca382a0/child.jpg') THEN
    RAISE EXCEPTION 'TEST FAILED: bound producer cannot read submitted profile media';
  END IF;
  IF public.bts_can_read_profile_file('1f7c169f-c707-48d2-97bb-749c5ca382a0/sibling.jpg') THEN
    RAISE EXCEPTION 'TEST FAILED: staff access includes unsubmitted sibling media';
  END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$ DECLARE result jsonb; BEGIN
  result:=public.bts_authorize_email_send('131ad1e8-23b0-4756-81ce-bf59302e4b4f','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',true);
  IF NOT (result->>'allowed')::boolean THEN RAISE EXCEPTION 'TEST FAILED: bound producer cannot authorise email'; END IF;
END $$;
RESET ROLE;
-- Explicit denial overrides access-level defaults, immediately for active sessions.
INSERT INTO public.production_permission_pages(page_key,label) VALUES('auditions.general','General auditions') ON CONFLICT DO NOTHING;
INSERT INTO public.production_team_member_page_permissions(production_id,team_member_id,page_key,access_level)
VALUES('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','e8f51d99-0106-4dc4-832d-251bb2f13b1f','auditions.general','none');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
DO $$ BEGIN
  BEGIN
    PERFORM public.team_authored_notes_for_production('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',(SELECT creative FROM team_test_tokens));
    RAISE EXCEPTION 'TEST FAILED: explicit page denial ignored';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF; END;
  PERFORM public.team_member_revoke_session('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',(SELECT creative FROM team_test_tokens));
  BEGIN
    PERFORM public.team_member_resume_session('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',(SELECT creative FROM team_test_tokens));
    RAISE EXCEPTION 'TEST FAILED: revoked session still accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SELECT 'PASS: account-bound team sessions, cross-production references, viewer writes, job-title forgery, explicit page denial and revocation. All fixtures rolled back.' AS result;
ROLLBACK;
