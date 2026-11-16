UPDATE public.productions SET is_public=true,page_status='live',wizard_data='{"private":"DO NOT DISCLOSE"}',registration_households='[{"id":"mixed","name":"Another family name","member_ids":["7013266d-79d1-4d75-a12e-b6aacdd36601","7013266d-79d1-4d75-a12e-b6aacdd36602"]}]' WHERE id='fdb2ec7b-a107-41e6-b960-7e6b89e8ca96';
UPDATE public.organizations SET profile_public=true,show_contact=false,proposal_submission_token='DO NOT DISCLOSE',account_owner_name='Private owner' WHERE id='432b1ee2-515d-4637-9f8f-c733fd21f219';
UPDATE public.audition_applications SET user_id='4180925a-80f5-443d-aed7-9792e5e96172',callback_status='requested' WHERE id='956836bf-755b-4d1e-996d-741238b5cdda';
INSERT INTO public.audition_applications(id,production_id,user_id,name) VALUES('7013266d-79d1-4d75-a12e-b6aacdd36603','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','131ad1e8-23b0-4756-81ce-bf59302e4b4f','Another family child');
INSERT INTO public.casting_assignments(id,production_id,applicant_id,state,reg_payment_notes) VALUES
('7013266d-79d1-4d75-a12e-b6aacdd36601','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','956836bf-755b-4d1e-996d-741238b5cdda','chosen','Private staff payment note'),
('7013266d-79d1-4d75-a12e-b6aacdd36602','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','7013266d-79d1-4d75-a12e-b6aacdd36603','chosen','Other family private note');
INSERT INTO public.cast_members(production_id,applicant_id,name,role_key,internal_notes) VALUES('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','956836bf-755b-4d1e-996d-741238b5cdda','Synthetic child','fixture','Private assessment');
INSERT INTO public.registration_payment_records(production_id,casting_assignment_id,paid,amount_cents) VALUES('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','7013266d-79d1-4d75-a12e-b6aacdd36601',false,12000),('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','7013266d-79d1-4d75-a12e-b6aacdd36602',true,99000);
INSERT INTO public.household_payment_logs(production_id,household_id,amount_cents,paid_by) VALUES('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','mixed',99000,'Other adult');
INSERT INTO public.budget_receipts(production_id,description,submitted_by_email) VALUES('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','Private receipt','private@example.invalid');
INSERT INTO public.self_tape_submissions(production_id,applicant_id,video_url) VALUES('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','7013266d-79d1-4d75-a12e-b6aacdd36603','https://example.invalid/private-video');
INSERT INTO public.production_events(production_id,title,event_type,start_time,is_public,event_checkins) VALUES('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','Public performance','performance',now(),true,'{"child":"private"}');
INSERT INTO public.sponsor_businesses(id,production_id,name,user_id) VALUES('7013266d-79d1-4d75-a12e-b6aacdd36604','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','Other sponsor','131ad1e8-23b0-4756-81ce-bf59302e4b4f');
SET LOCAL ROLE anon;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['cast_members','casting_assignments','self_tape_submissions','registration_payment_records','household_payment_logs','budget_receipts','budget_categories','budget_settings','portal_permissions','production_proposals','org_files','production_files','sponsor_files','sponsor_businesses','production_events','productions','organizations'] LOOP
  IF has_table_privilege('anon','public.'||t,'SELECT') OR has_table_privilege('anon','public.'||t,'INSERT') OR has_table_privilege('anon','public.'||t,'UPDATE') THEN RAISE EXCEPTION 'TEST FAILED: anonymous private table access: %',t;END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.bts_visible_productions WHERE wizard_data::text LIKE '%DO NOT DISCLOSE%' OR registration_households::text LIKE '%Another family%') THEN RAISE EXCEPTION 'TEST FAILED: production private JSON disclosed';END IF;
 IF EXISTS(SELECT 1 FROM public.bts_visible_organizations WHERE proposal_submission_token IS NOT NULL OR account_owner_name IS NOT NULL) THEN RAISE EXCEPTION 'TEST FAILED: organisation credentials disclosed';END IF;
 IF has_table_privilege('anon','public.bts_visible_productions','UPDATE') OR has_table_privilege('authenticated','public.bts_participant_casting','DELETE') OR has_table_privilege('authenticated','public.bts_participant_volunteers','DELETE') OR has_table_privilege('anon','public.bts_participant_applications','INSERT') THEN RAISE EXCEPTION 'TEST FAILED: inherited view write grants survive';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.bts_visible_productions WHERE title='Synthetic team production') THEN RAISE EXCEPTION 'TEST FAILED: public show unavailable';END IF;
 IF public.bts_file_permission('production-files','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96/registrations/956836bf-755b-4d1e-996d-741238b5cdda.pdf',1) OR public.bts_file_permission('receipts','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96/receipt.pdf',1) THEN RAISE EXCEPTION 'TEST FAILED: private file publicly readable';END IF;
 IF has_function_privilege('anon','public.organisation_observation_delete(uuid,uuid)','EXECUTE') OR has_function_privilege('anon','public.lookup_email_by_bts_id(text)','EXECUTE') OR has_function_privilege('anon','public.finalize_sponsor_submission(uuid,uuid,text,text,text,text,jsonb,jsonb,text)','EXECUTE') THEN RAISE EXCEPTION 'TEST FAILED: anonymous privileged RPC';END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
DO $$ BEGIN
 INSERT INTO public.bts_participant_applications(production_id,name,custom_answers) VALUES('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','New adult submission','{"Date of Birth":"1990-01-01"}');
 IF (SELECT count(*) FROM public.bts_participant_casting)<>1 OR EXISTS(SELECT 1 FROM public.bts_participant_payment_records WHERE amount_cents=99000) OR EXISTS(SELECT 1 FROM public.self_tape_submissions) OR EXISTS(SELECT 1 FROM public.budget_receipts) THEN RAISE EXCEPTION 'TEST FAILED: other family or finance disclosed';END IF;
 IF EXISTS(SELECT 1 FROM public.bts_participant_household_payments) THEN RAISE EXCEPTION 'TEST FAILED: mixed household exposes other adult payment';END IF;
 UPDATE public.registration_payment_records SET paid=true;IF FOUND THEN RAISE EXCEPTION 'TEST FAILED: family forged payment';END IF;
 BEGIN
  UPDATE public.bts_participant_cast_members SET internal_notes='Forged';RAISE EXCEPTION 'TEST FAILED: family overwrote staff notes';
 EXCEPTION WHEN undefined_column THEN NULL; WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 UPDATE public.bts_participant_cast_members SET guardian_phone='555-0100';IF NOT FOUND THEN RAISE EXCEPTION 'TEST FAILED: family cannot update registration contact';END IF;
 PERFORM public.bts_respond_cast_offer('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',ARRAY['7013266d-79d1-4d75-a12e-b6aacdd36601']::uuid[],'offer_accepted');
 BEGIN
  PERFORM public.bts_respond_cast_offer('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',ARRAY['7013266d-79d1-4d75-a12e-b6aacdd36602']::uuid[],'offer_declined');RAISE EXCEPTION 'TEST FAILED: family answered another offer';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 INSERT INTO public.self_tape_submissions(production_id,applicant_id,video_url,scope) VALUES('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','956836bf-755b-4d1e-996d-741238b5cdda','https://example.invalid/own-video','callback');
 BEGIN
  INSERT INTO public.self_tape_submissions(production_id,applicant_id,video_url) VALUES('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','7013266d-79d1-4d75-a12e-b6aacdd36603','https://example.invalid/forged');RAISE EXCEPTION 'TEST FAILED: cross-family tape';
 EXCEPTION WHEN insufficient_privilege THEN NULL;WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 BEGIN
  PERFORM public.organisation_observation_delete('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','7013266d-79d1-4d75-a12e-b6aacdd36603');RAISE EXCEPTION 'TEST FAILED: bypass observation RPC';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 BEGIN
  PERFORM public.finalize_sponsor_submission('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','7013266d-79d1-4d75-a12e-b6aacdd36604','ad',NULL,NULL,NULL,'[]','{}','paid');RAISE EXCEPTION 'TEST FAILED: sponsor overwritten by other account';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 IF NOT public.bts_file_permission('production-files','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96/registrations/956836bf-755b-4d1e-996d-741238b5cdda.pdf',1) THEN RAISE EXCEPTION 'TEST FAILED: own registration PDF denied';END IF;
 IF public.bts_file_permission('profile-headshots','131ad1e8-23b0-4756-81ce-bf59302e4b4f/private.jpg',1) OR public.bts_file_permission('receipts','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96/private.pdf',1) THEN RAISE EXCEPTION 'TEST FAILED: copied private file path grants access'; END IF;
END $$;
RESET ROLE;
INSERT INTO public.production_permission_pages(page_key,label) VALUES('registration.payments','Payments'),('budget.receipts','Receipts') ON CONFLICT DO NOTHING;
INSERT INTO public.production_team_member_sessions(production_id,team_member_id,session_token,expires_at,auth_user_id) VALUES('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','df6bce8f-30a1-4e2d-a415-ea0663ddf006',repeat('d',64),now()+interval '1 hour','3f6513e6-1dfc-48ae-991f-e889305bb4d6');
INSERT INTO public.production_team_member_page_permissions(production_id,team_member_id,page_key,access_level) VALUES('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','df6bce8f-30a1-4e2d-a415-ea0663ddf006','registration.payments','view'),('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','df6bce8f-30a1-4e2d-a415-ea0663ddf006','budget.receipts','view');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"3f6513e6-1dfc-48ae-991f-e889305bb4d6","role":"authenticated"}',true);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.registration_payment_records) OR NOT EXISTS(SELECT 1 FROM public.budget_receipts) THEN RAISE EXCEPTION 'TEST FAILED: assigned finance viewer denied';END IF;
 UPDATE public.registration_payment_records SET paid=true;IF FOUND THEN RAISE EXCEPTION 'TEST FAILED: finance viewer wrote';END IF;
 IF NOT public.bts_file_permission('receipts','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96/receipt.pdf',1) OR public.bts_file_permission('profile-headshots','4180925a-80f5-443d-aed7-9792e5e96172/child.jpg',1) THEN RAISE EXCEPTION 'TEST FAILED: finance file permissions not scoped';END IF;
END $$;
RESET ROLE;
UPDATE public.production_team_member_page_permissions SET access_level='edit' WHERE team_member_id='df6bce8f-30a1-4e2d-a415-ea0663ddf006' AND page_key='registration.payments';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"3f6513e6-1dfc-48ae-991f-e889305bb4d6","role":"authenticated"}',true);
DO $$ BEGIN
 UPDATE public.registration_payment_records SET paid=true;IF NOT FOUND THEN RAISE EXCEPTION 'TEST FAILED: finance editor denied';END IF;
 UPDATE public.casting_assignments SET scholarship_amount=5 WHERE id='7013266d-79d1-4d75-a12e-b6aacdd36601';IF NOT FOUND THEN RAISE EXCEPTION 'TEST FAILED: finance benefits denied';END IF;
 BEGIN
 UPDATE public.casting_assignments SET state='chosen' WHERE id='7013266d-79d1-4d75-a12e-b6aacdd36601';RAISE EXCEPTION 'TEST FAILED: finance permission changed casting decision';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
END $$;
RESET ROLE;
UPDATE public.production_team_member_sessions SET revoked_at=now() WHERE team_member_id='df6bce8f-30a1-4e2d-a415-ea0663ddf006';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"3f6513e6-1dfc-48ae-991f-e889305bb4d6","role":"authenticated"}',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.registration_payment_records) THEN RAISE EXCEPTION 'TEST FAILED: revoked finance read';END IF;END $$;
SELECT set_config('request.jwt.claims','{"sub":"1f7c169f-c707-48d2-97bb-749c5ca382a0","role":"authenticated"}',true);
DO $$ BEGIN
 BEGIN
 INSERT INTO public.casting_assignments(production_id,applicant_id,state) VALUES('8efb6463-9c50-444f-9305-be2c83d12ce4','956836bf-755b-4d1e-996d-741238b5cdda','chosen'); RAISE EXCEPTION 'TEST FAILED: cross-production applicant copied into cast';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
END $$;
RESET ROLE;
SELECT 'PASS: all non-ticket route classes deny anonymous/cross-family bypass, protect finance and internal fields, check old RPCs, preserve own offers/registration/tapes and protect file paths. Synthetic changes rolled back.' AS result;
ROLLBACK;
