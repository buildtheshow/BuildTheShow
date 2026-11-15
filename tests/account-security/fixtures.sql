-- Synthetic fixtures only. Everything, including the migration, is rolled back.
INSERT INTO auth.users (id,email,email_confirmed_at,raw_user_meta_data) VALUES
('87d387e0-d657-4e44-8a27-ae2b9d093b23','bts-owner@example.invalid',now(),'{"date_of_birth":"1990-01-01","privacy_accepted":true,"terms_accepted":true}'),
('4e248981-0aea-474e-a957-0f2e151ab2c3','bts-recipient@example.invalid',now(),'{"date_of_birth":"1990-01-01","privacy_accepted":true,"terms_accepted":true}'),
('5b1d9a8c-cd31-48e3-8438-c8727a31e153','bts-outsider@example.invalid',now(),'{"date_of_birth":"1990-01-01","privacy_accepted":true,"terms_accepted":true}');
INSERT INTO public.organizations (id,name,slug,admin_id) VALUES
('d42ed90a-1725-4f37-b992-5b761cc452c7','Synthetic security fixture','bts-security-d42ed90a','87d387e0-d657-4e44-8a27-ae2b9d093b23');
INSERT INTO public.org_invitations (id,org_id,email,access_level,title,token,invited_by)
VALUES ('5d238834-fa95-4da8-ae8f-4b1d4a93c56a','d42ed90a-1725-4f37-b992-5b761cc452c7','bts-recipient@example.invalid','viewer','Organisation owner','be26dac2-f9d7-4fa1-a83c-6e75f5fb08e4','87d387e0-d657-4e44-8a27-ae2b9d093b23');
CREATE TEMP TABLE bts_test_ids (profile_id uuid, invitation_token text, transfer_token text);
INSERT INTO public.profiles(id,name,date_of_birth) VALUES
('f86d0918-7104-4c14-b65d-6e4cbd952e8d','Unassigned synthetic profile','1990-01-01');
INSERT INTO bts_test_ids(invitation_token) SELECT token FROM public.org_invitations WHERE id='5d238834-fa95-4da8-ae8f-4b1d4a93c56a';
GRANT SELECT,UPDATE ON bts_test_ids TO authenticated;

DO $$ BEGIN
  BEGIN
    INSERT INTO auth.users (id,email,raw_user_meta_data) VALUES ('102182a9-d53e-4867-b15d-e7bf580d3526','bts-underage@example.invalid','{"date_of_birth":"2014-01-01","privacy_accepted":true,"terms_accepted":true}');
    RAISE EXCEPTION 'TEST FAILED: underage signup accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id='102182a9-d53e-4867-b15d-e7bf580d3526') THEN RAISE EXCEPTION 'TEST FAILED: underage account persisted'; END IF;
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"87d387e0-d657-4e44-8a27-ae2b9d093b23","role":"authenticated","email":"bts-owner@example.invalid"}',true);
DO $$ DECLARE profile uuid; r jsonb; BEGIN
  IF public.bts_organisation_role('d42ed90a-1725-4f37-b992-5b761cc452c7') <> 'owner' THEN RAISE EXCEPTION 'TEST FAILED: owner not recognised'; END IF;
  BEGIN
    PERFORM public.bts_save_profile('{"bio":"Claimed orphan"}','f86d0918-7104-4c14-b65d-6e4cbd952e8d',false);
    RAISE EXCEPTION 'TEST FAILED: profile without an owner was claimed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.bts_save_profile('{"legal_first_name":"Fixture","date_of_birth":"2015-01-01","guardian_name":"Fixture Guardian"}',NULL,NULL);
    RAISE EXCEPTION 'TEST FAILED: null guardian declaration accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.bts_save_profile('{"legal_first_name":"Fixture","legal_last_name":"Child","date_of_birth":"2015-01-01","guardian_name":"Fixture Guardian"}',NULL,false);
    RAISE EXCEPTION 'TEST FAILED: child created without guardian declaration';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF; END;
  profile := public.bts_save_profile('{"legal_first_name":"Fixture","legal_last_name":"Child","date_of_birth":"2015-01-01","guardian_name":"Fixture Guardian","guardian_email":"wrong@example.invalid"}',NULL,true);
  UPDATE bts_test_ids SET profile_id=profile;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=profile AND guardian_email='bts-owner@example.invalid' AND guardian_user_id='87d387e0-d657-4e44-8a27-ae2b9d093b23' AND guardian_consent_at IS NOT NULL) THEN
    RAISE EXCEPTION 'TEST FAILED: guardian identity not fixed to account'; END IF;
  BEGIN
    UPDATE public.profiles SET user_id='5b1d9a8c-cd31-48e3-8438-c8727a31e153' WHERE id=profile;
    RAISE EXCEPTION 'TEST FAILED: profile reassigned';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.bts_save_profile('{"user_id":"5b1d9a8c-cd31-48e3-8438-c8727a31e153"}',profile,false);
    RAISE EXCEPTION 'TEST FAILED: forbidden profile field accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF; END;
  r := public.bts_request_account_deletion(false);
  IF r->>'status' <> 'pending_review' OR r->>'request_id' IS NULL THEN RAISE EXCEPTION 'TEST FAILED: deletion request missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id='d42ed90a-1725-4f37-b992-5b761cc452c7') THEN RAISE EXCEPTION 'TEST FAILED: deletion request removed organisation'; END IF;
  BEGIN
    UPDATE public.organizations SET admin_id='5b1d9a8c-cd31-48e3-8438-c8727a31e153' WHERE id='d42ed90a-1725-4f37-b992-5b761cc452c7';
    RAISE EXCEPTION 'TEST FAILED: ownership changed by ordinary update';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF; END;
END $$;

SELECT set_config('request.jwt.claims','{"sub":"5b1d9a8c-cd31-48e3-8438-c8727a31e153","role":"authenticated","email":"bts-outsider@example.invalid","user_metadata":{"role":"owner","is_admin":true}}',true);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.profiles WHERE id=(SELECT profile_id FROM bts_test_ids)) THEN RAISE EXCEPTION 'TEST FAILED: another account read child profile'; END IF;
  IF public.bts_organisation_role('d42ed90a-1725-4f37-b992-5b761cc452c7') IS NOT NULL THEN RAISE EXCEPTION 'TEST FAILED: metadata granted organisation access'; END IF;
  BEGIN
    PERFORM public.bts_accept_org_invitation((SELECT invitation_token FROM bts_test_ids));
    RAISE EXCEPTION 'TEST FAILED: wrong-email invitation accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.bts_save_profile('{"bio":"Not mine"}',(SELECT profile_id FROM bts_test_ids),false);
    RAISE EXCEPTION 'TEST FAILED: another account edited profile';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF; END;
END $$;

SELECT set_config('request.jwt.claims','{"sub":"4e248981-0aea-474e-a957-0f2e151ab2c3","role":"authenticated","email":"bts-recipient@example.invalid"}',true);
DO $$ BEGIN
  PERFORM public.bts_accept_org_invitation((SELECT invitation_token FROM bts_test_ids));
  IF public.bts_organisation_role('d42ed90a-1725-4f37-b992-5b761cc452c7') IS DISTINCT FROM 'viewer' THEN RAISE EXCEPTION 'TEST FAILED: title changed permissions'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.org_members WHERE org_id='d42ed90a-1725-4f37-b992-5b761cc452c7' AND user_id='4e248981-0aea-474e-a957-0f2e151ab2c3' AND access_level='viewer') THEN RAISE EXCEPTION 'TEST FAILED: intended recipient not added'; END IF;
  IF EXISTS(SELECT 1 FROM public.org_invitations WHERE id='5d238834-fa95-4da8-ae8f-4b1d4a93c56a') THEN RAISE EXCEPTION 'TEST FAILED: recipient can list invitations'; END IF;
  BEGIN
    PERFORM public.bts_accept_org_invitation((SELECT invitation_token FROM bts_test_ids));
    RAISE EXCEPTION 'TEST FAILED: invitation replayed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.org_members SET access_level='admin' WHERE org_id='d42ed90a-1725-4f37-b992-5b761cc452c7' AND user_id='4e248981-0aea-474e-a957-0f2e151ab2c3';
    IF FOUND THEN RAISE EXCEPTION 'TEST FAILED: member promoted themselves'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
-- Ownership is not transferred by the first person's request alone.
SELECT set_config('request.jwt.claims','{"sub":"87d387e0-d657-4e44-8a27-ae2b9d093b23","role":"authenticated","email":"bts-owner@example.invalid"}',true);
DO $$ DECLARE request jsonb; BEGIN
  request := public.bts_start_ownership_transfer('d42ed90a-1725-4f37-b992-5b761cc452c7','4e248981-0aea-474e-a957-0f2e151ab2c3');
  UPDATE bts_test_ids SET transfer_token=request->>'token';
  IF public.bts_organisation_role('d42ed90a-1725-4f37-b992-5b761cc452c7') IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'TEST FAILED: request already changed owner'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"5b1d9a8c-cd31-48e3-8438-c8727a31e153","role":"authenticated","email":"bts-outsider@example.invalid"}',true);
DO $$ BEGIN
  IF public.bts_preview_ownership_transfer((SELECT transfer_token FROM bts_test_ids)) IS NOT NULL THEN RAISE EXCEPTION 'TEST FAILED: outsider read ownership invitation'; END IF;
  BEGIN
    PERFORM public.bts_accept_ownership_transfer((SELECT transfer_token FROM bts_test_ids));
    RAISE EXCEPTION 'TEST FAILED: wrong account accepted ownership';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.bts_start_ownership_transfer('d42ed90a-1725-4f37-b992-5b761cc452c7','5b1d9a8c-cd31-48e3-8438-c8727a31e153');
    RAISE EXCEPTION 'TEST FAILED: outsider initiated ownership transfer';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"4e248981-0aea-474e-a957-0f2e151ab2c3","role":"authenticated","email":"bts-recipient@example.invalid"}',true);
DO $$ BEGIN
  PERFORM public.bts_accept_ownership_transfer((SELECT transfer_token FROM bts_test_ids));
  IF public.bts_organisation_role('d42ed90a-1725-4f37-b992-5b761cc452c7') IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'TEST FAILED: intended recipient not made owner'; END IF;
  BEGIN
    PERFORM public.bts_accept_ownership_transfer((SELECT transfer_token FROM bts_test_ids));
    RAISE EXCEPTION 'TEST FAILED: ownership invitation replayed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"87d387e0-d657-4e44-8a27-ae2b9d093b23","role":"authenticated","email":"bts-owner@example.invalid"}',true);
DO $$ BEGIN
  IF public.bts_organisation_role('d42ed90a-1725-4f37-b992-5b761cc452c7') IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'TEST FAILED: previous owner role is wrong'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=(SELECT profile_id FROM bts_test_ids)) THEN RAISE EXCEPTION 'TEST FAILED: organisation transfer changed personal profiles'; END IF;
END $$;

RESET ROLE;
-- Only the trusted email service can request permission for a named user.
INSERT INTO public.productions(id,organization_id,title) VALUES
('11111111-1111-4111-8111-111111111111','d42ed90a-1725-4f37-b992-5b761cc452c7','Synthetic email fixture');
INSERT INTO public.org_members(org_id,user_id,access_level,title) VALUES
('d42ed90a-1725-4f37-b992-5b761cc452c7','5b1d9a8c-cd31-48e3-8438-c8727a31e153','viewer','Owner and producer');
DO $$ BEGIN
  IF has_function_privilege('authenticated','public.bts_authorize_email_send(uuid,uuid,boolean)','EXECUTE')
    OR has_function_privilege('anon','public.bts_authorize_email_send(uuid,uuid,boolean)','EXECUTE') THEN
    RAISE EXCEPTION 'TEST FAILED: browser can impersonate email sender';
  END IF;
  IF EXISTS(SELECT 1 FROM auth.users WHERE raw_user_meta_data ? 'date_of_birth') THEN
    RAISE EXCEPTION 'TEST FAILED: signup birth date remains in token metadata';
  END IF;
END $$;
SET LOCAL ROLE service_role;
DO $$ DECLARE decision jsonb; attempt integer; BEGIN
  decision := public.bts_authorize_email_send('5b1d9a8c-cd31-48e3-8438-c8727a31e153','11111111-1111-4111-8111-111111111111',true);
  IF (decision->>'allowed')::boolean THEN RAISE EXCEPTION 'TEST FAILED: viewer job title grants email access'; END IF;
  FOR attempt IN 1..5 LOOP
    decision := public.bts_authorize_email_send('4e248981-0aea-474e-a957-0f2e151ab2c3','11111111-1111-4111-8111-111111111111',true);
    IF NOT (decision->>'allowed')::boolean THEN RAISE EXCEPTION 'TEST FAILED: owner email request rejected'; END IF;
  END LOOP;
  decision := public.bts_authorize_email_send('4e248981-0aea-474e-a957-0f2e151ab2c3','11111111-1111-4111-8111-111111111111',true);
  IF decision->>'reason' IS DISTINCT FROM 'rate_limited' THEN RAISE EXCEPTION 'TEST FAILED: email rate limit bypassed'; END IF;
  decision := public.bts_authorize_email_send('4e248981-0aea-474e-a957-0f2e151ab2c3','11111111-1111-4111-8111-111111111111',false);
  IF NOT (decision->>'allowed')::boolean THEN RAISE EXCEPTION 'TEST FAILED: test and transactional counters mixed'; END IF;
END $$;
RESET ROLE;
SET CONSTRAINTS ALL IMMEDIATE;
DO $$ BEGIN
  IF (SELECT public FROM storage.buckets WHERE id='profile-headshots') IS DISTINCT FROM false THEN RAISE EXCEPTION 'TEST FAILED: profile bucket still public'; END IF;
  IF (SELECT count(*) FROM public.member_ids WHERE user_id='87d387e0-d657-4e44-8a27-ae2b9d093b23') <> 1 THEN RAISE EXCEPTION 'TEST FAILED: member ID not generated exactly once'; END IF;
END $$;
SELECT 'PASS: adult eligibility, child ownership and consent, recipient-bound invitations, metadata isolation, role boundaries, private media, recorded deletion requests and two-person ownership transfer' AS result;
ROLLBACK;
