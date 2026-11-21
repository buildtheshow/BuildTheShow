BEGIN;
CREATE TEMP TABLE payment_test(own uuid,child uuid,sibling uuid,application uuid,invitation uuid,token text);
INSERT INTO payment_test DEFAULT VALUES;GRANT ALL ON payment_test TO authenticated,service_role;
UPDATE public.organizations SET abbreviation='BTSFIX',email='public-contact@example.invalid',etransfer_email='pay-org@example.invalid',payment_settings='{"currency":"GBP","manual_instructions":"Organisation instructions","square_access_token":"NEVER_EXPOSE"}' WHERE id='432b1ee2-515d-4637-9f8f-c733fd21f219';
UPDATE public.productions SET is_public=true,page_status='live',registration_settings='{"payment_settings":{"mode":"single","fee":270}}' WHERE id='fdb2ec7b-a107-41e6-b960-7e6b89e8ca96';
INSERT INTO bts_private.production_team_accounts(team_member_id,user_id,accepted_email) VALUES('e8f51d99-0106-4dc4-832d-251bb2f13b1f','4180925a-80f5-443d-aed7-9792e5e96172','team-creative@example.invalid');
SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
UPDATE payment_test SET own=public.bts_save_profile('{"credit_name":"Adult performer","date_of_birth":"1990-01-01","relationship_kind":"self"}',NULL,false),child=public.bts_save_profile('{"credit_name":"Shared child","date_of_birth":"2014-01-01","guardian_name":"Parent A","relationship_kind":"child"}',NULL,true),sibling=public.bts_save_profile('{"credit_name":"PRIVATE_SIBLING","date_of_birth":"2015-01-01","guardian_name":"Parent A","relationship_kind":"child"}',NULL,true);
WITH created AS(INSERT INTO public.bts_participant_applications(production_id,profile_id,name,email,custom_answers) SELECT 'fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',child,'Ignored','ignored@example.invalid','{}' FROM payment_test RETURNING id) UPDATE payment_test SET application=(SELECT id FROM created);
UPDATE payment_test SET invitation=(public.bts_family('invite',jsonb_build_object('profile_id',child,'email','team-viewer@example.invalid','kind','guardian'))->>'id')::uuid;
RESET ROLE;
UPDATE payment_test f SET token=m.payload->>'token' FROM bts_private.family_mail m WHERE m.payload->>'invite_id'=f.invitation::text;
INSERT INTO public.casting_assignments(id,production_id,applicant_id,state) SELECT 'a0ad0000-0000-4000-8000-000000000001','fdb2ec7b-a107-41e6-b960-7e6b89e8ca96',application,'offer_accepted' FROM payment_test;
INSERT INTO public.registration_payment_records(production_id,casting_assignment_id,paid,amount_cents,paid_by) VALUES('fdb2ec7b-a107-41e6-b960-7e6b89e8ca96','a0ad0000-0000-4000-8000-000000000001',true,9000,'Production team');
SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
DO $$ DECLARE bill jsonb; home jsonb; BEGIN
 bill:=public.bts_family_tracker((SELECT child FROM payment_test))->0;
 IF bill->'organisation'->>'name'<>'Synthetic team organisation' OR bill->'payment_instructions'->>'html'<>'Organisation instructions' OR bill->'payment_instructions'->>'etransfer_email'<>'pay-org@example.invalid' OR bill->'settings'->>'currency'<>'GBP' THEN RAISE EXCEPTION 'TEST FAILED: authoritative organisation defaults';END IF;
 IF bill::text LIKE '%NEVER_EXPOSE%' OR bill::text LIKE '%square_access_token%' THEN RAISE EXCEPTION 'TEST FAILED: organisation secret exposed';END IF;
 home:=public.bts_my_home();IF jsonb_array_length(home->'participations')<>1 OR home->'participations'->0->>'profile_id'<>(SELECT own::text FROM payment_test) OR home->'participations'->0->>'role'<>'Producer' THEN RAISE EXCEPTION 'TEST FAILED: accepted team role missing or wrong profile';END IF;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"3f6513e6-1dfc-48ae-991f-e889305bb4d6","role":"authenticated"}',true);
SELECT public.bts_family('accept',jsonb_build_object('token',token,'confirmed',true,'guardian_confirmed',true,'name','Parent B')) FROM payment_test;
DO $$ DECLARE info jsonb; BEGIN
 info:=public.bts_member_profile_access((SELECT child FROM payment_test));
 IF jsonb_array_length(info->'keys')<>2 OR info->>'can_invite'<>'false' THEN RAISE EXCEPTION 'TEST FAILED: shared guardian access summary';END IF;
 IF info::text LIKE '%team-creative@example.invalid%' OR info::text LIKE '%PRIVATE_SIBLING%' OR info::text LIKE '%"token"%' THEN RAISE EXCEPTION 'TEST FAILED: other adult contact, sibling or token exposed';END IF;
 IF jsonb_array_length(info->'my_contacts')<>1 THEN RAISE EXCEPTION 'TEST FAILED: own contacts only';END IF;
 IF jsonb_array_length(public.bts_family_tracker((SELECT child FROM payment_test)))<>1 THEN RAISE EXCEPTION 'TEST FAILED: shared guardian payment access';END IF;
 BEGIN PERFORM public.bts_family_tracker((SELECT sibling FROM payment_test));RAISE EXCEPTION 'TEST FAILED: private sibling tracker exposed';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
END $$;
RESET ROLE;UPDATE public.productions SET registration_settings='{"payment_settings":{"mode":"single","fee":270,"instructions":"<p>Production-specific instructions</p>","etransfer_email":"pay-production@example.invalid"}}' WHERE id='fdb2ec7b-a107-41e6-b960-7e6b89e8ca96';
SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claims','{"sub":"3f6513e6-1dfc-48ae-991f-e889305bb4d6","role":"authenticated"}',true);
DO $$ DECLARE info jsonb; BEGIN info:=public.bts_family_tracker((SELECT child FROM payment_test))->0;IF info->'payment_instructions'->>'source'<>'production' OR info->'payment_instructions'->>'etransfer_email'<>'pay-production@example.invalid' THEN RAISE EXCEPTION 'TEST FAILED: production override';END IF;END $$;
SELECT set_config('request.jwt.claims','{"sub":"131ad1e8-23b0-4756-81ce-bf59302e4b4f","role":"authenticated"}',true);
DO $$ BEGIN
 IF jsonb_array_length(public.bts_my_home()->'participations')<>0 THEN RAISE EXCEPTION 'TEST FAILED: unaccepted staff role claimed by email';END IF;
 BEGIN PERFORM public.bts_member_profile_access((SELECT child FROM payment_test));RAISE EXCEPTION 'TEST FAILED: outsider sees family access';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF has_function_privilege('authenticated','bts_private.tracker_before_production_payments(uuid)','EXECUTE') OR has_function_privilege('authenticated','bts_private.home_before_production_participation(uuid)','EXECUTE') OR has_function_privilege('anon','public.bts_member_profile_access(uuid)','EXECUTE') THEN RAISE EXCEPTION 'TEST FAILED: private helper grants';END IF;
END $$;
SELECT 'PASS: authoritative production/organisation instructions, scoped payments, accepted own-profile team roles, contact privacy, guardian/outsider boundaries and helper grants' AS result;
ROLLBACK;
