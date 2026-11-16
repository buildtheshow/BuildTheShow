DO $$ BEGIN
 IF has_table_privilege('authenticated','bts_private.profile_type_corrections','SELECT') OR has_function_privilege('authenticated','public.bts_resolve_profile_type_correction(uuid,boolean,text)','EXECUTE') OR has_function_privilege('anon','public.bts_correct_profile_type(text,uuid,jsonb,boolean)','EXECUTE') THEN RAISE EXCEPTION 'TEST FAILED: correction permissions';END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"4180925a-80f5-443d-aed7-9792e5e96172","role":"authenticated"}',true);
DO $$ DECLARE person uuid; child uuid; org uuid; result jsonb; restored jsonb; BEGIN
 person:=public.bts_save_profile('{"credit_name":"Synthetic adult","legal_first_name":"Synthetic","legal_last_name":"Adult","date_of_birth":"1990-01-01","relationship_kind":"self"}',NULL,false);
 child:=public.bts_save_profile('{"credit_name":"Synthetic child","legal_first_name":"Synthetic","legal_last_name":"Child","date_of_birth":"2015-01-01","relationship_kind":"child","guardian_name":"Synthetic Adult","guardian_email":"team-creative@example.invalid","guardian_phone":"5555550100"}',NULL,true);
 BEGIN PERFORM public.bts_correct_profile_type('member',person,'{}',false);RAISE EXCEPTION 'TEST FAILED: missing confirmation accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 BEGIN PERFORM public.bts_correct_profile_type('member',child,'{}',true);RAISE EXCEPTION 'TEST FAILED: child conversion accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 BEGIN PERFORM public.bts_correct_profile_type('organisation','432b1ee2-515d-4637-9f8f-c733fd21f219','{}',true);RAISE EXCEPTION 'TEST FAILED: stranger organisation accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 BEGIN PERFORM public.bts_correct_profile_type('member',person,'{"name":"Synthetic organisation","email":"synthetic@example.invalid","slug":"manage"}',true);RAISE EXCEPTION 'TEST FAILED: site route accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 BEGIN PERFORM public.bts_correct_profile_type('member',person,'{"organisation_id":"not-a-uuid","name":"Synthetic organisation","email":"synthetic@example.invalid","slug":"bts-correction-fixture"}',true);RAISE EXCEPTION 'TEST FAILED: malformed organisation accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 result:=public.bts_correct_profile_type('member',person,'{"name":"Synthetic organisation","email":"synthetic@example.invalid","slug":"bts-correction-fixture"}',true);
 IF result->>'state'<>'completed' THEN RAISE EXCEPTION 'TEST FAILED: unused member conversion %',result;END IF;
 org:=(result->>'target_id')::uuid;
 IF jsonb_array_length(public.bts_profile_type_options()->'members')<>0 THEN RAISE EXCEPTION 'TEST FAILED: archived member still active';END IF;
 restored:=public.bts_correct_profile_type('organisation',org,'{}',true);
 IF restored->>'state'<>'completed' OR (restored->>'target_id')::uuid<>person THEN RAISE EXCEPTION 'TEST FAILED: original member not restored %',restored;END IF;
 IF jsonb_array_length(public.bts_my_home()->'organisations')<>0 THEN RAISE EXCEPTION 'TEST FAILED: archived organisation still active';END IF;
 IF jsonb_array_length(public.bts_profile_type_options()->'members')<>1 THEN RAISE EXCEPTION 'TEST FAILED: original member not available';END IF;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"1f7c169f-c707-48d2-97bb-749c5ca382a0","role":"authenticated"}',true);
DO $$ DECLARE result jsonb; again jsonb; BEGIN
 result:=public.bts_correct_profile_type('organisation','432b1ee2-515d-4637-9f8f-c733fd21f219','{"person_name":"Synthetic Owner"}',true);
 again:=public.bts_correct_profile_type('organisation','432b1ee2-515d-4637-9f8f-c733fd21f219','{"person_name":"Synthetic Owner"}',true);
 IF result->>'state'<>'needs_review' OR result->>'id'<>again->>'id' THEN RAISE EXCEPTION 'TEST FAILED: linked records not protected or duplicated review';END IF;
END $$;
RESET ROLE;
DO $$ DECLARE result jsonb; pending uuid; BEGIN
 IF EXISTS(SELECT 1 FROM public.organizations WHERE slug='bts-correction-fixture' AND (profile_archived_at IS NULL OR profile_public)) THEN RAISE EXCEPTION 'TEST FAILED: corrected organisation not archived privately';END IF;
 IF (SELECT count(*) FROM public.productions WHERE organization_id='432b1ee2-515d-4637-9f8f-c733fd21f219')<>2 THEN RAISE EXCEPTION 'TEST FAILED: production history changed';END IF;
 SELECT id INTO pending FROM bts_private.profile_type_corrections WHERE state='needs_review';
 BEGIN PERFORM public.bts_resolve_profile_type_correction(pending,true,'Authority verified for synthetic owner, but linked records remain.');RAISE EXCEPTION 'TEST FAILED: review bypassed dependencies';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE;END IF;END;
 result:=public.bts_resolve_profile_type_correction(pending,false,'Synthetic review declined because this is an active organisation.');
 IF result->>'state'<>'declined' THEN RAISE EXCEPTION 'TEST FAILED: decision not recorded';END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"3f6513e6-1dfc-48ae-991f-e889305bb4d6","role":"authenticated"}',true);
INSERT INTO public.organizations(id,name,admin_id,slug,profile_public) VALUES('cfec17d0-c80d-4ff0-b416-1e29e8918eac','Synthetic mistaken organisation','3f6513e6-1dfc-48ae-991f-e889305bb4d6','bts-correction-no-person',false);
DO $$ DECLARE result jsonb; BEGIN
 result:=public.bts_correct_profile_type('organisation','cfec17d0-c80d-4ff0-b416-1e29e8918eac','{"person_name":"Synthetic Adult"}',true);
 IF result->>'state'<>'completed' OR jsonb_array_length(public.bts_profile_type_options()->'members')<>1 THEN RAISE EXCEPTION 'TEST FAILED: own member profile was not created';END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM bts_private.profile_type_corrections c JOIN public.organizations o ON o.id=c.target_id WHERE c.target_type='organisation' AND (o.admin_id<>c.actor_id OR o.profile_public)) THEN RAISE EXCEPTION 'TEST FAILED: wrong organisation owner or public personal data';END IF;
 IF EXISTS(SELECT 1 FROM bts_private.profile_type_corrections c JOIN public.profiles p ON p.id=c.target_id WHERE c.target_type='member' AND (p.date_of_birth<>'1990-01-01' OR p.deleted_at IS NOT NULL)) THEN RAISE EXCEPTION 'TEST FAILED: personal identity changed';END IF;
END $$;
-- A reviewer can complete a request only after its dependency is explicitly resolved.
CREATE TABLE bts_private.correction_test_link(organisation_id uuid REFERENCES public.organizations(id));
INSERT INTO public.organizations(id,name,admin_id,slug,profile_public) VALUES('e3f04a0d-ce32-444d-88c1-1540546bdb80','Synthetic reviewed organisation','131ad1e8-23b0-4756-81ce-bf59302e4b4f','bts-correction-reviewed',false);
INSERT INTO bts_private.correction_test_link VALUES('e3f04a0d-ce32-444d-88c1-1540546bdb80');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"131ad1e8-23b0-4756-81ce-bf59302e4b4f","role":"authenticated"}',true);
DO $$ DECLARE result jsonb; BEGIN
 result:=public.bts_correct_profile_type('organisation','e3f04a0d-ce32-444d-88c1-1540546bdb80','{"person_name":"Synthetic Reviewed Adult"}',true);
 IF result->>'state'<>'needs_review' THEN RAISE EXCEPTION 'TEST FAILED: dependency not detected';END IF;
 IF jsonb_array_length(public.bts_profile_type_options()->'members')<>0 OR jsonb_array_length(public.bts_profile_type_options()->'history')<>1 THEN RAISE EXCEPTION 'TEST FAILED: review changed a profile or exposed another account history';END IF;
END $$;
RESET ROLE;
DELETE FROM bts_private.correction_test_link;
DO $$ DECLARE request uuid; result jsonb; original_claims text:=current_setting('request.jwt.claims',true); BEGIN
 SELECT id INTO request FROM bts_private.profile_type_corrections WHERE source_id='e3f04a0d-ce32-444d-88c1-1540546bdb80';
 result:=public.bts_resolve_profile_type_correction(request,true,'Synthetic adult authority verified; linked test record was resolved.');
 IF result->>'state'<>'completed' THEN RAISE EXCEPTION 'TEST FAILED: resolved review could not complete';END IF;
 IF current_setting('request.jwt.claims',true) IS DISTINCT FROM original_claims THEN RAISE EXCEPTION 'TEST FAILED: reviewer identity leaked';END IF;
END $$;
SELECT 'PASS: own unused member and organisation corrections, private archival and restoration, child/stranger/confirmation/route protection, preserved productions, deduplicated review and operator-only resolution.' AS result;
ROLLBACK;
