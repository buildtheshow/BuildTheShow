UPDATE public.productions SET page_status='live' WHERE id='fdb2ec7b-a107-41e6-b960-7e6b89e8ca96';
INSERT INTO public.volunteer_signups(id,production_id,name,email,volunteer_passcode) VALUES('2e87b5dc-7cea-4566-b3aa-27b17a729066','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','Unowned historical record','team-creative@example.invalid','123456');
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF has_table_privilege('anon','public.volunteer_signups','SELECT') OR has_table_privilege('anon','public.volunteer_signups','INSERT') OR has_table_privilege('anon','public.volunteer_signups','UPDATE') THEN RAISE EXCEPTION 'TEST FAILED: public base access';END IF;
 IF EXISTS(SELECT 1 FROM public.bts_participant_volunteers) THEN RAISE EXCEPTION 'TEST FAILED: anonymous view disclosure';END IF;
 IF has_function_privilege('anon','public.bts_request_volunteer_shifts(uuid,jsonb,text,boolean)','EXECUTE') THEN RAISE EXCEPTION 'TEST FAILED: anonymous requests';END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
DO $$ DECLARE result jsonb; record_id uuid; BEGIN
 BEGIN
  PERFORM public.bts_request_volunteer_shifts('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','[{"name":"Child","role_name":"Treasurer"}]','Synthetic child age 12',false);
  RAISE EXCEPTION 'TEST FAILED: guardian declaration missing';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF; END;
 result:=public.bts_request_volunteer_shifts('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','[{"name":"Synthetic child","role_name":"Treasurer","shift_date":"2026-12-01","required_dates":["2026-12-01","2026-12-02"],"approved_hours":999,"status":"approved","user_id":"131ad1e8-23b0-4756-81ce-bf59302e4b4f","email":"forged@example.invalid"}]','Synthetic child age 12',true);
 SELECT id INTO record_id FROM public.bts_participant_volunteers WHERE portal_token=(result->>'portal_token')::uuid;
 IF record_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.bts_participant_volunteers WHERE id=record_id AND user_id=auth.uid() AND status='pending' AND approved_hours IS NULL AND email='team-creative@example.invalid') THEN RAISE EXCEPTION 'TEST FAILED: forged ownership, status, email or hours';END IF;
 IF public.bts_production_page_permission('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','budget.dashboard',1) THEN RAISE EXCEPTION 'TEST FAILED: job title grants finance';END IF;
 IF EXISTS(SELECT 1 FROM public.bts_participant_volunteers WHERE id='2e87b5dc-7cea-4566-b3aa-27b17a729066') THEN RAISE EXCEPTION 'TEST FAILED: email matches unowned record';END IF;
 BEGIN
  UPDATE public.bts_participant_volunteers SET status='approved',approved_hours=999 WHERE id=record_id;
  RAISE EXCEPTION 'TEST FAILED: self approval';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 BEGIN
  UPDATE public.bts_participant_volunteers SET user_id='131ad1e8-23b0-4756-81ce-bf59302e4b4f' WHERE id=record_id;
  RAISE EXCEPTION 'TEST FAILED: ownership transfer';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 BEGIN
  PERFORM public.bts_request_volunteer_shifts('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','[{"name":"Must roll back","role_name":"Helper"},{"name":"Invalid"}]');
  RAISE EXCEPTION 'TEST FAILED: invalid batch succeeded';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 IF EXISTS(SELECT 1 FROM public.bts_participant_volunteers WHERE name='Must roll back') THEN RAISE EXCEPTION 'TEST FAILED: partial batch'; END IF;
 IF (SELECT count(*) FROM public.bts_public_volunteer_availability('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96') WHERE role_name='Treasurer' AND booked_count=1)<>2 THEN RAISE EXCEPTION 'TEST FAILED: aggregate dates incorrect';END IF;
 UPDATE public.bts_participant_volunteers SET notes='Contact change',status='cancelled' WHERE id=record_id;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"131ad1e8-23b0-4756-81ce-bf59302e4b4f","role":"authenticated"}',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.bts_participant_volunteers) THEN RAISE EXCEPTION 'TEST FAILED: other family can read';END IF;
 UPDATE public.bts_participant_volunteers SET status='approved';IF FOUND THEN RAISE EXCEPTION 'TEST FAILED: other family can change';END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.volunteer_signups WHERE name='Synthetic child' AND guardian_consent_at IS NOT NULL AND guardian_details='Synthetic child age 12') THEN RAISE EXCEPTION 'TEST FAILED: guardian audit absent';END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"1f7c169f-c707-48d2-97bb-749c5ca382a0","role":"authenticated"}',true);
DO $$ BEGIN
 UPDATE public.volunteer_signups SET status='approved',approved_hours=2 WHERE name='Synthetic child';
 IF NOT FOUND THEN RAISE EXCEPTION 'TEST FAILED: authorised owner cannot approve';END IF;
 BEGIN
 UPDATE public.volunteer_signups SET portal_token=(SELECT portal_token FROM public.volunteer_signups WHERE name='Synthetic child') WHERE id='2e87b5dc-7cea-4566-b3aa-27b17a729066';
 RAISE EXCEPTION 'TEST FAILED: cross-family merge';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
END $$;
RESET ROLE;
-- A current bound session and explicit production page grant are both required.
INSERT INTO public.production_permission_pages(page_key,label) VALUES('volunteers','Volunteers') ON CONFLICT DO NOTHING;
INSERT INTO public.production_team_member_sessions(production_id,team_member_id,session_token,expires_at,auth_user_id)
VALUES('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','df6bce8f-30a1-4e2d-a415-ea0663ddf006',repeat('c',64),now()+interval '1 hour','3f6513e6-1dfc-48ae-991f-e889305bb4d6');
INSERT INTO public.production_team_member_page_permissions(production_id,team_member_id,page_key,access_level)
VALUES('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','df6bce8f-30a1-4e2d-a415-ea0663ddf006','volunteers','view');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"3f6513e6-1dfc-48ae-991f-e889305bb4d6","role":"authenticated"}',true);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.volunteer_signups WHERE name='Synthetic child') THEN RAISE EXCEPTION 'TEST FAILED: assigned staff cannot read'; END IF;
 UPDATE public.volunteer_signups SET approved_hours=999 WHERE name='Synthetic child';
 IF FOUND THEN RAISE EXCEPTION 'TEST FAILED: view-only staff write';END IF;
 IF public.bts_production_page_permission('8efb6463-9c50-444f-9305-be2c83d12ce4','volunteers',1) THEN RAISE EXCEPTION 'TEST FAILED: cross-production permission'; END IF;
END $$;
RESET ROLE;
UPDATE public.production_team_member_page_permissions SET access_level='edit' WHERE team_member_id='df6bce8f-30a1-4e2d-a415-ea0663ddf006';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"3f6513e6-1dfc-48ae-991f-e889305bb4d6","role":"authenticated"}',true);
DO $$ BEGIN
 UPDATE public.volunteer_signups SET approved_hours=3 WHERE name='Synthetic child';
 IF NOT FOUND THEN RAISE EXCEPTION 'TEST FAILED: edit staff blocked';END IF;
END $$;
RESET ROLE;
UPDATE public.production_team_member_sessions SET revoked_at=now() WHERE team_member_id='df6bce8f-30a1-4e2d-a415-ea0663ddf006';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"3f6513e6-1dfc-48ae-991f-e889305bb4d6","role":"authenticated"}',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.volunteer_signups) THEN RAISE EXCEPTION 'TEST FAILED: revoked staff read'; END IF;END $$;
RESET ROLE;
SELECT 'PASS: volunteer account isolation, anonymous denial, guardian audit, no title-based finance, protected approvals/hours, atomic requests and safe counts. Fixtures rolled back.' AS result;
ROLLBACK;
