-- Complete the non-ticket private-record route cutover. Public data is projected explicitly.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='90s';
CREATE FUNCTION public.bts_owns_audition(p_production_id uuid,p_applicant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.bts_account_is_active() AND (
 EXISTS(SELECT 1 FROM public.audition_applications WHERE id=p_applicant_id AND production_id=p_production_id AND user_id=auth.uid()) OR
 EXISTS(SELECT 1 FROM public.audition_bookings WHERE id=p_applicant_id AND production_id=p_production_id AND user_id=auth.uid()));
$$;
CREATE FUNCTION public.bts_is_production_participant(p_production_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.bts_account_is_active() AND (
 EXISTS(SELECT 1 FROM public.audition_applications WHERE production_id=p_production_id AND user_id=auth.uid()) OR
 EXISTS(SELECT 1 FROM public.audition_bookings WHERE production_id=p_production_id AND user_id=auth.uid()) OR
 EXISTS(SELECT 1 FROM public.volunteer_signups WHERE production_id=p_production_id AND user_id=auth.uid()));
$$;
CREATE FUNCTION public.bts_production_staff(p_production_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.bts_account_is_active() AND (
 EXISTS(SELECT 1 FROM public.productions WHERE id=p_production_id AND public.bts_organisation_role(organization_id) IN ('owner','admin')) OR
 EXISTS(SELECT 1 FROM public.production_team_member_sessions s JOIN public.production_team_members m ON m.id=s.team_member_id AND m.production_id=s.production_id WHERE s.production_id=p_production_id AND s.auth_user_id=auth.uid() AND s.revoked_at IS NULL AND s.expires_at>now() AND m.is_active));
$$;
CREATE FUNCTION public.bts_private_record_permission(p_production_id uuid,p_page text,p_rank integer)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.bts_production_page_permission(p_production_id,p_page,p_rank)
 OR (p_page='cast_list' AND public.bts_production_page_permission(p_production_id,'registration.dashboard',p_rank))
 OR (p_page='auditions.casting_board' AND (public.bts_production_page_permission(p_production_id,'auditions.final_casting',p_rank) OR (p_rank=1 AND public.bts_production_page_permission(p_production_id,'registration.payments',1))))
 OR (p_page='budget.breakdown' AND p_rank=1 AND public.bts_production_page_permission(p_production_id,'budget.receipts',1));
$$;
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='budget_categories' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'budget_categories');END LOOP;END $policy$;
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.budget_categories FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.budget_categories TO authenticated;
CREATE POLICY scoped_read ON public.budget_categories FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'budget.breakdown',1));
CREATE POLICY scoped_insert ON public.budget_categories FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'budget.breakdown',2));
CREATE POLICY scoped_update ON public.budget_categories FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'budget.breakdown',2)) WITH CHECK(public.bts_private_record_permission(production_id,'budget.breakdown',2));
CREATE POLICY scoped_delete ON public.budget_categories FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'budget.breakdown',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='budget_items' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'budget_items');END LOOP;END $policy$;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.budget_items FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.budget_items TO authenticated;
CREATE POLICY scoped_read ON public.budget_items FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'budget.breakdown',1));
CREATE POLICY scoped_insert ON public.budget_items FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'budget.breakdown',2));
CREATE POLICY scoped_update ON public.budget_items FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'budget.breakdown',2)) WITH CHECK(public.bts_private_record_permission(production_id,'budget.breakdown',2));
CREATE POLICY scoped_delete ON public.budget_items FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'budget.breakdown',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='budget_receipts' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'budget_receipts');END LOOP;END $policy$;
ALTER TABLE public.budget_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.budget_receipts FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.budget_receipts TO authenticated;
CREATE POLICY scoped_read ON public.budget_receipts FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'budget.receipts',1));
CREATE POLICY scoped_insert ON public.budget_receipts FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'budget.receipts',2));
CREATE POLICY scoped_update ON public.budget_receipts FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'budget.receipts',2)) WITH CHECK(public.bts_private_record_permission(production_id,'budget.receipts',2));
CREATE POLICY scoped_delete ON public.budget_receipts FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'budget.receipts',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='budget_settings' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'budget_settings');END LOOP;END $policy$;
ALTER TABLE public.budget_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.budget_settings FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.budget_settings TO authenticated;
CREATE POLICY scoped_read ON public.budget_settings FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'budget.collect',1));
CREATE POLICY scoped_insert ON public.budget_settings FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'budget.collect',2));
CREATE POLICY scoped_update ON public.budget_settings FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'budget.collect',2)) WITH CHECK(public.bts_private_record_permission(production_id,'budget.collect',2));
CREATE POLICY scoped_delete ON public.budget_settings FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'budget.collect',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='cast_members' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'cast_members');END LOOP;END $policy$;
ALTER TABLE public.cast_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cast_members FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cast_members TO authenticated;
CREATE POLICY scoped_read ON public.cast_members FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'cast_list',1));
CREATE POLICY scoped_insert ON public.cast_members FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'cast_list',2));
CREATE POLICY scoped_update ON public.cast_members FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'cast_list',2)) WITH CHECK(public.bts_private_record_permission(production_id,'cast_list',2));
CREATE POLICY scoped_delete ON public.cast_members FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'cast_list',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='casting_assignments' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'casting_assignments');END LOOP;END $policy$;
ALTER TABLE public.casting_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.casting_assignments FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.casting_assignments TO authenticated;
CREATE POLICY scoped_read ON public.casting_assignments FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'auditions.casting_board',1));
CREATE POLICY scoped_insert ON public.casting_assignments FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'auditions.casting_board',2));
CREATE POLICY scoped_update ON public.casting_assignments FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'auditions.casting_board',2)) WITH CHECK(public.bts_private_record_permission(production_id,'auditions.casting_board',2));
CREATE POLICY scoped_delete ON public.casting_assignments FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'auditions.casting_board',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='self_tape_submissions' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'self_tape_submissions');END LOOP;END $policy$;
ALTER TABLE public.self_tape_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.self_tape_submissions FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.self_tape_submissions TO authenticated;
CREATE POLICY scoped_read ON public.self_tape_submissions FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'auditions.general',1));
CREATE POLICY scoped_insert ON public.self_tape_submissions FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'auditions.general',2));
CREATE POLICY scoped_update ON public.self_tape_submissions FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'auditions.general',2)) WITH CHECK(public.bts_private_record_permission(production_id,'auditions.general',2));
CREATE POLICY scoped_delete ON public.self_tape_submissions FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'auditions.general',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='registration_payment_records' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'registration_payment_records');END LOOP;END $policy$;
ALTER TABLE public.registration_payment_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.registration_payment_records FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.registration_payment_records TO authenticated;
CREATE POLICY scoped_read ON public.registration_payment_records FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'registration.payments',1));
CREATE POLICY scoped_insert ON public.registration_payment_records FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'registration.payments',2));
CREATE POLICY scoped_update ON public.registration_payment_records FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'registration.payments',2)) WITH CHECK(public.bts_private_record_permission(production_id,'registration.payments',2));
CREATE POLICY scoped_delete ON public.registration_payment_records FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'registration.payments',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='household_payment_logs' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'household_payment_logs');END LOOP;END $policy$;
ALTER TABLE public.household_payment_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.household_payment_logs FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.household_payment_logs TO authenticated;
CREATE POLICY scoped_read ON public.household_payment_logs FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'registration.payments',1));
CREATE POLICY scoped_insert ON public.household_payment_logs FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'registration.payments',2));
CREATE POLICY scoped_update ON public.household_payment_logs FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'registration.payments',2)) WITH CHECK(public.bts_private_record_permission(production_id,'registration.payments',2));
CREATE POLICY scoped_delete ON public.household_payment_logs FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'registration.payments',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='callback_groups' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'callback_groups');END LOOP;END $policy$;
ALTER TABLE public.callback_groups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.callback_groups FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.callback_groups TO authenticated;
CREATE POLICY scoped_read ON public.callback_groups FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'auditions.callback',1));
CREATE POLICY scoped_insert ON public.callback_groups FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'auditions.callback',2));
CREATE POLICY scoped_update ON public.callback_groups FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'auditions.callback',2)) WITH CHECK(public.bts_private_record_permission(production_id,'auditions.callback',2));
CREATE POLICY scoped_delete ON public.callback_groups FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'auditions.callback',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='costume_assignments' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'costume_assignments');END LOOP;END $policy$;
ALTER TABLE public.costume_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.costume_assignments FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.costume_assignments TO authenticated;
CREATE POLICY scoped_read ON public.costume_assignments FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'cast_list',1));
CREATE POLICY scoped_insert ON public.costume_assignments FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'cast_list',2));
CREATE POLICY scoped_update ON public.costume_assignments FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'cast_list',2)) WITH CHECK(public.bts_private_record_permission(production_id,'cast_list',2));
CREATE POLICY scoped_delete ON public.costume_assignments FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'cast_list',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='costume_groups' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'costume_groups');END LOOP;END $policy$;
ALTER TABLE public.costume_groups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.costume_groups FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.costume_groups TO authenticated;
CREATE POLICY scoped_read ON public.costume_groups FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'cast_list',1));
CREATE POLICY scoped_insert ON public.costume_groups FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'cast_list',2));
CREATE POLICY scoped_update ON public.costume_groups FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'cast_list',2)) WITH CHECK(public.bts_private_record_permission(production_id,'cast_list',2));
CREATE POLICY scoped_delete ON public.costume_groups FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'cast_list',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='daily_checkins' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'daily_checkins');END LOOP;END $policy$;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.daily_checkins FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.daily_checkins TO authenticated;
CREATE POLICY scoped_read ON public.daily_checkins FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'cast_list',1));
CREATE POLICY scoped_insert ON public.daily_checkins FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'cast_list',2));
CREATE POLICY scoped_update ON public.daily_checkins FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'cast_list',2)) WITH CHECK(public.bts_private_record_permission(production_id,'cast_list',2));
CREATE POLICY scoped_delete ON public.daily_checkins FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'cast_list',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='checklist_items' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'checklist_items');END LOOP;END $policy$;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checklist_items FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.checklist_items TO authenticated;
CREATE POLICY scoped_read ON public.checklist_items FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'overview',1));
CREATE POLICY scoped_insert ON public.checklist_items FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'overview',2));
CREATE POLICY scoped_update ON public.checklist_items FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'overview',2)) WITH CHECK(public.bts_private_record_permission(production_id,'overview',2));
CREATE POLICY scoped_delete ON public.checklist_items FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'overview',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='producer_tasks' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'producer_tasks');END LOOP;END $policy$;
ALTER TABLE public.producer_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.producer_tasks FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.producer_tasks TO authenticated;
CREATE POLICY scoped_read ON public.producer_tasks FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'overview',1));
CREATE POLICY scoped_insert ON public.producer_tasks FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'overview',2));
CREATE POLICY scoped_update ON public.producer_tasks FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'overview',2)) WITH CHECK(public.bts_private_record_permission(production_id,'overview',2));
CREATE POLICY scoped_delete ON public.producer_tasks FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'overview',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='email_templates' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'email_templates');END LOOP;END $policy$;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_templates FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.email_templates TO authenticated;
CREATE POLICY scoped_read ON public.email_templates FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'email_templates',1));
CREATE POLICY scoped_insert ON public.email_templates FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'email_templates',2));
CREATE POLICY scoped_update ON public.email_templates FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'email_templates',2)) WITH CHECK(public.bts_private_record_permission(production_id,'email_templates',2));
CREATE POLICY scoped_delete ON public.email_templates FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'email_templates',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='portal_permissions' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'portal_permissions');END LOOP;END $policy$;
ALTER TABLE public.portal_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portal_permissions FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.portal_permissions TO authenticated;
CREATE POLICY scoped_read ON public.portal_permissions FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'production_team',1));
CREATE POLICY scoped_insert ON public.portal_permissions FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'production_team',2));
CREATE POLICY scoped_update ON public.portal_permissions FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'production_team',2)) WITH CHECK(public.bts_private_record_permission(production_id,'production_team',2));
CREATE POLICY scoped_delete ON public.portal_permissions FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'production_team',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='production_access_audit_log' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'production_access_audit_log');END LOOP;END $policy$;
ALTER TABLE public.production_access_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.production_access_audit_log FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.production_access_audit_log TO authenticated;
CREATE POLICY scoped_read ON public.production_access_audit_log FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'production_team',1));
CREATE POLICY scoped_insert ON public.production_access_audit_log FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'production_team',2));
CREATE POLICY scoped_update ON public.production_access_audit_log FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'production_team',2)) WITH CHECK(public.bts_private_record_permission(production_id,'production_team',2));
CREATE POLICY scoped_delete ON public.production_access_audit_log FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'production_team',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='production_acts' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'production_acts');END LOOP;END $policy$;
ALTER TABLE public.production_acts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.production_acts FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.production_acts TO authenticated;
CREATE POLICY scoped_read ON public.production_acts FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'script_breakdown',1));
CREATE POLICY scoped_insert ON public.production_acts FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'script_breakdown',2));
CREATE POLICY scoped_update ON public.production_acts FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'script_breakdown',2)) WITH CHECK(public.bts_private_record_permission(production_id,'script_breakdown',2));
CREATE POLICY scoped_delete ON public.production_acts FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'script_breakdown',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='production_scenes' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'production_scenes');END LOOP;END $policy$;
ALTER TABLE public.production_scenes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.production_scenes FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.production_scenes TO authenticated;
CREATE POLICY scoped_read ON public.production_scenes FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'script_breakdown',1));
CREATE POLICY scoped_insert ON public.production_scenes FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'script_breakdown',2));
CREATE POLICY scoped_update ON public.production_scenes FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'script_breakdown',2)) WITH CHECK(public.bts_private_record_permission(production_id,'script_breakdown',2));
CREATE POLICY scoped_delete ON public.production_scenes FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'script_breakdown',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='scene_characters' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'scene_characters');END LOOP;END $policy$;
ALTER TABLE public.scene_characters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scene_characters FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.scene_characters TO authenticated;
CREATE POLICY scoped_read ON public.scene_characters FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'script_breakdown',1));
CREATE POLICY scoped_insert ON public.scene_characters FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'script_breakdown',2));
CREATE POLICY scoped_update ON public.scene_characters FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'script_breakdown',2)) WITH CHECK(public.bts_private_record_permission(production_id,'script_breakdown',2));
CREATE POLICY scoped_delete ON public.scene_characters FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'script_breakdown',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='scene_groups' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'scene_groups');END LOOP;END $policy$;
ALTER TABLE public.scene_groups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scene_groups FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.scene_groups TO authenticated;
CREATE POLICY scoped_read ON public.scene_groups FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'script_breakdown',1));
CREATE POLICY scoped_insert ON public.scene_groups FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'script_breakdown',2));
CREATE POLICY scoped_update ON public.scene_groups FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'script_breakdown',2)) WITH CHECK(public.bts_private_record_permission(production_id,'script_breakdown',2));
CREATE POLICY scoped_delete ON public.scene_groups FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'script_breakdown',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='scene_notes' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'scene_notes');END LOOP;END $policy$;
ALTER TABLE public.scene_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scene_notes FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.scene_notes TO authenticated;
CREATE POLICY scoped_read ON public.scene_notes FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'script_breakdown',1));
CREATE POLICY scoped_insert ON public.scene_notes FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'script_breakdown',2));
CREATE POLICY scoped_update ON public.scene_notes FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'script_breakdown',2)) WITH CHECK(public.bts_private_record_permission(production_id,'script_breakdown',2));
CREATE POLICY scoped_delete ON public.scene_notes FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'script_breakdown',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='production_script_import_items' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'production_script_import_items');END LOOP;END $policy$;
ALTER TABLE public.production_script_import_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.production_script_import_items FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.production_script_import_items TO authenticated;
CREATE POLICY scoped_read ON public.production_script_import_items FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'script_breakdown',1));
CREATE POLICY scoped_insert ON public.production_script_import_items FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'script_breakdown',2));
CREATE POLICY scoped_update ON public.production_script_import_items FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'script_breakdown',2)) WITH CHECK(public.bts_private_record_permission(production_id,'script_breakdown',2));
CREATE POLICY scoped_delete ON public.production_script_import_items FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'script_breakdown',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='production_crew' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'production_crew');END LOOP;END $policy$;
ALTER TABLE public.production_crew ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.production_crew FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.production_crew TO authenticated;
CREATE POLICY scoped_read ON public.production_crew FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'production_team',1));
CREATE POLICY scoped_insert ON public.production_crew FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'production_team',2));
CREATE POLICY scoped_update ON public.production_crew FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'production_team',2)) WITH CHECK(public.bts_private_record_permission(production_id,'production_team',2));
CREATE POLICY scoped_delete ON public.production_crew FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'production_team',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='production_props' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'production_props');END LOOP;END $policy$;
ALTER TABLE public.production_props ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.production_props FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.production_props TO authenticated;
CREATE POLICY scoped_read ON public.production_props FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'overview',1));
CREATE POLICY scoped_insert ON public.production_props FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'overview',2));
CREATE POLICY scoped_update ON public.production_props FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'overview',2)) WITH CHECK(public.bts_private_record_permission(production_id,'overview',2));
CREATE POLICY scoped_delete ON public.production_props FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'overview',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='production_roles' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'production_roles');END LOOP;END $policy$;
ALTER TABLE public.production_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.production_roles FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.production_roles TO authenticated;
CREATE POLICY scoped_read ON public.production_roles FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'cast_list',1));
CREATE POLICY scoped_insert ON public.production_roles FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'cast_list',2));
CREATE POLICY scoped_update ON public.production_roles FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'cast_list',2)) WITH CHECK(public.bts_private_record_permission(production_id,'cast_list',2));
CREATE POLICY scoped_delete ON public.production_roles FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'cast_list',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='production_files' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'production_files');END LOOP;END $policy$;
ALTER TABLE public.production_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.production_files FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.production_files TO authenticated;
CREATE POLICY scoped_read ON public.production_files FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'overview',1));
CREATE POLICY scoped_insert ON public.production_files FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'overview',2));
CREATE POLICY scoped_update ON public.production_files FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'overview',2)) WITH CHECK(public.bts_private_record_permission(production_id,'overview',2));
CREATE POLICY scoped_delete ON public.production_files FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'overview',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='production_folders' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'production_folders');END LOOP;END $policy$;
ALTER TABLE public.production_folders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.production_folders FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.production_folders TO authenticated;
CREATE POLICY scoped_read ON public.production_folders FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'overview',1));
CREATE POLICY scoped_insert ON public.production_folders FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'overview',2));
CREATE POLICY scoped_update ON public.production_folders FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'overview',2)) WITH CHECK(public.bts_private_record_permission(production_id,'overview',2));
CREATE POLICY scoped_delete ON public.production_folders FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'overview',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='production_events' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'production_events');END LOOP;END $policy$;
ALTER TABLE public.production_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.production_events FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.production_events TO authenticated;
CREATE POLICY scoped_read ON public.production_events FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'production_calendar',1));
CREATE POLICY scoped_insert ON public.production_events FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'production_calendar',2));
CREATE POLICY scoped_update ON public.production_events FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'production_calendar',2)) WITH CHECK(public.bts_private_record_permission(production_id,'production_calendar',2));
CREATE POLICY scoped_delete ON public.production_events FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'production_calendar',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='production_characters' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'production_characters');END LOOP;END $policy$;
ALTER TABLE public.production_characters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.production_characters FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.production_characters TO authenticated;
CREATE POLICY scoped_read ON public.production_characters FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'auditions.general',1));
CREATE POLICY scoped_insert ON public.production_characters FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'auditions.general',2));
CREATE POLICY scoped_update ON public.production_characters FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'auditions.general',2)) WITH CHECK(public.bts_private_record_permission(production_id,'auditions.general',2));
CREATE POLICY scoped_delete ON public.production_characters FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'auditions.general',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='audition_configs' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'audition_configs');END LOOP;END $policy$;
ALTER TABLE public.audition_configs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audition_configs FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.audition_configs TO authenticated;
CREATE POLICY scoped_read ON public.audition_configs FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'auditions.general',1));
CREATE POLICY scoped_insert ON public.audition_configs FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'auditions.general',2));
CREATE POLICY scoped_update ON public.audition_configs FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'auditions.general',2)) WITH CHECK(public.bts_private_record_permission(production_id,'auditions.general',2));
CREATE POLICY scoped_delete ON public.audition_configs FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'auditions.general',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='audition_custom_questions' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'audition_custom_questions');END LOOP;END $policy$;
ALTER TABLE public.audition_custom_questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audition_custom_questions FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.audition_custom_questions TO authenticated;
CREATE POLICY scoped_read ON public.audition_custom_questions FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'auditions.general',1));
CREATE POLICY scoped_insert ON public.audition_custom_questions FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'auditions.general',2));
CREATE POLICY scoped_update ON public.audition_custom_questions FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'auditions.general',2)) WITH CHECK(public.bts_private_record_permission(production_id,'auditions.general',2));
CREATE POLICY scoped_delete ON public.audition_custom_questions FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'auditions.general',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='audition_sessions' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'audition_sessions');END LOOP;END $policy$;
ALTER TABLE public.audition_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audition_sessions FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.audition_sessions TO authenticated;
CREATE POLICY scoped_read ON public.audition_sessions FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'auditions.schedule',1));
CREATE POLICY scoped_insert ON public.audition_sessions FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'auditions.schedule',2));
CREATE POLICY scoped_update ON public.audition_sessions FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'auditions.schedule',2)) WITH CHECK(public.bts_private_record_permission(production_id,'auditions.schedule',2));
CREATE POLICY scoped_delete ON public.audition_sessions FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'auditions.schedule',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='audition_slots' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'audition_slots');END LOOP;END $policy$;
ALTER TABLE public.audition_slots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audition_slots FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.audition_slots TO authenticated;
CREATE POLICY scoped_read ON public.audition_slots FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'auditions.schedule',1));
CREATE POLICY scoped_insert ON public.audition_slots FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'auditions.schedule',2));
CREATE POLICY scoped_update ON public.audition_slots FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'auditions.schedule',2)) WITH CHECK(public.bts_private_record_permission(production_id,'auditions.schedule',2));
CREATE POLICY scoped_delete ON public.audition_slots FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'auditions.schedule',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='sponsor_businesses' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'sponsor_businesses');END LOOP;END $policy$;
ALTER TABLE public.sponsor_businesses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sponsor_businesses FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.sponsor_businesses TO authenticated;
CREATE POLICY scoped_read ON public.sponsor_businesses FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'marketing.sponsors',1));
CREATE POLICY scoped_insert ON public.sponsor_businesses FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'marketing.sponsors',2));
CREATE POLICY scoped_update ON public.sponsor_businesses FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'marketing.sponsors',2)) WITH CHECK(public.bts_private_record_permission(production_id,'marketing.sponsors',2));
CREATE POLICY scoped_delete ON public.sponsor_businesses FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'marketing.sponsors',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='sponsor_packages' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'sponsor_packages');END LOOP;END $policy$;
ALTER TABLE public.sponsor_packages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sponsor_packages FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.sponsor_packages TO authenticated;
CREATE POLICY scoped_read ON public.sponsor_packages FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'marketing.sponsors',1));
CREATE POLICY scoped_insert ON public.sponsor_packages FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'marketing.sponsors',2));
CREATE POLICY scoped_update ON public.sponsor_packages FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'marketing.sponsors',2)) WITH CHECK(public.bts_private_record_permission(production_id,'marketing.sponsors',2));
CREATE POLICY scoped_delete ON public.sponsor_packages FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'marketing.sponsors',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='sponsor_files' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'sponsor_files');END LOOP;END $policy$;
ALTER TABLE public.sponsor_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sponsor_files FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.sponsor_files TO authenticated;
CREATE POLICY scoped_read ON public.sponsor_files FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'marketing.sponsors',1));
CREATE POLICY scoped_insert ON public.sponsor_files FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'marketing.sponsors',2));
CREATE POLICY scoped_update ON public.sponsor_files FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'marketing.sponsors',2)) WITH CHECK(public.bts_private_record_permission(production_id,'marketing.sponsors',2));
CREATE POLICY scoped_delete ON public.sponsor_files FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'marketing.sponsors',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='sponsor_deliverables' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'sponsor_deliverables');END LOOP;END $policy$;
ALTER TABLE public.sponsor_deliverables ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sponsor_deliverables FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.sponsor_deliverables TO authenticated;
CREATE POLICY scoped_read ON public.sponsor_deliverables FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'marketing.sponsors',1));
CREATE POLICY scoped_insert ON public.sponsor_deliverables FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'marketing.sponsors',2));
CREATE POLICY scoped_update ON public.sponsor_deliverables FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'marketing.sponsors',2)) WITH CHECK(public.bts_private_record_permission(production_id,'marketing.sponsors',2));
CREATE POLICY scoped_delete ON public.sponsor_deliverables FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'marketing.sponsors',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='sponsor_settings' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'sponsor_settings');END LOOP;END $policy$;
ALTER TABLE public.sponsor_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sponsor_settings FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.sponsor_settings TO authenticated;
CREATE POLICY scoped_read ON public.sponsor_settings FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'marketing.sponsors',1));
CREATE POLICY scoped_insert ON public.sponsor_settings FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'marketing.sponsors',2));
CREATE POLICY scoped_update ON public.sponsor_settings FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'marketing.sponsors',2)) WITH CHECK(public.bts_private_record_permission(production_id,'marketing.sponsors',2));
CREATE POLICY scoped_delete ON public.sponsor_settings FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'marketing.sponsors',3));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='programme_ads' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'programme_ads');END LOOP;END $policy$;
ALTER TABLE public.programme_ads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.programme_ads FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.programme_ads TO authenticated;
CREATE POLICY scoped_read ON public.programme_ads FOR SELECT TO authenticated USING(public.bts_private_record_permission(production_id,'marketing.programme',1));
CREATE POLICY scoped_insert ON public.programme_ads FOR INSERT TO authenticated WITH CHECK(public.bts_private_record_permission(production_id,'marketing.programme',2));
CREATE POLICY scoped_update ON public.programme_ads FOR UPDATE TO authenticated USING(public.bts_private_record_permission(production_id,'marketing.programme',2)) WITH CHECK(public.bts_private_record_permission(production_id,'marketing.programme',2));
CREATE POLICY scoped_delete ON public.programme_ads FOR DELETE TO authenticated USING(public.bts_private_record_permission(production_id,'marketing.programme',3));
CREATE OR REPLACE FUNCTION public.can_manage_sponsor_production(p_production_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT public.bts_private_record_permission(p_production_id,'marketing.sponsors',2); $$;
CREATE OR REPLACE FUNCTION public.bts_can_access_production(target_production_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT public.bts_private_record_permission(target_production_id,'overview',2); $$;
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='org_files' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'org_files');END LOOP;END $policy$;
ALTER TABLE public.org_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.org_files FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.org_files TO authenticated;
CREATE POLICY org_private_read ON public.org_files FOR SELECT TO authenticated USING(public.bts_organisation_role(organization_id) IN ('owner','admin','editor','viewer'));
CREATE POLICY org_private_insert ON public.org_files FOR INSERT TO authenticated WITH CHECK(public.bts_organisation_role(organization_id) IN ('owner','admin','editor'));
CREATE POLICY org_private_update ON public.org_files FOR UPDATE TO authenticated USING(public.bts_organisation_role(organization_id) IN ('owner','admin','editor')) WITH CHECK(public.bts_organisation_role(organization_id) IN ('owner','admin','editor'));
CREATE POLICY org_private_delete ON public.org_files FOR DELETE TO authenticated USING(public.bts_organisation_role(organization_id) IN ('owner','admin'));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='org_folders' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'org_folders');END LOOP;END $policy$;
ALTER TABLE public.org_folders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.org_folders FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.org_folders TO authenticated;
CREATE POLICY org_private_read ON public.org_folders FOR SELECT TO authenticated USING(public.bts_organisation_role(organization_id) IN ('owner','admin','editor','viewer'));
CREATE POLICY org_private_insert ON public.org_folders FOR INSERT TO authenticated WITH CHECK(public.bts_organisation_role(organization_id) IN ('owner','admin','editor'));
CREATE POLICY org_private_update ON public.org_folders FOR UPDATE TO authenticated USING(public.bts_organisation_role(organization_id) IN ('owner','admin','editor')) WITH CHECK(public.bts_organisation_role(organization_id) IN ('owner','admin','editor'));
CREATE POLICY org_private_delete ON public.org_folders FOR DELETE TO authenticated USING(public.bts_organisation_role(organization_id) IN ('owner','admin'));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='org_team_templates' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'org_team_templates');END LOOP;END $policy$;
ALTER TABLE public.org_team_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.org_team_templates FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.org_team_templates TO authenticated;
CREATE POLICY org_private_read ON public.org_team_templates FOR SELECT TO authenticated USING(public.bts_organisation_role(org_id) IN ('owner','admin','editor','viewer'));
CREATE POLICY org_private_insert ON public.org_team_templates FOR INSERT TO authenticated WITH CHECK(public.bts_organisation_role(org_id) IN ('owner','admin','editor'));
CREATE POLICY org_private_update ON public.org_team_templates FOR UPDATE TO authenticated USING(public.bts_organisation_role(org_id) IN ('owner','admin','editor')) WITH CHECK(public.bts_organisation_role(org_id) IN ('owner','admin','editor'));
CREATE POLICY org_private_delete ON public.org_team_templates FOR DELETE TO authenticated USING(public.bts_organisation_role(org_id) IN ('owner','admin'));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='organization_planning_events' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'organization_planning_events');END LOOP;END $policy$;
ALTER TABLE public.organization_planning_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organization_planning_events FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.organization_planning_events TO authenticated;
CREATE POLICY org_private_read ON public.organization_planning_events FOR SELECT TO authenticated USING(public.bts_organisation_role(organization_id) IN ('owner','admin','editor','viewer'));
CREATE POLICY org_private_insert ON public.organization_planning_events FOR INSERT TO authenticated WITH CHECK(public.bts_organisation_role(organization_id) IN ('owner','admin','editor'));
CREATE POLICY org_private_update ON public.organization_planning_events FOR UPDATE TO authenticated USING(public.bts_organisation_role(organization_id) IN ('owner','admin','editor')) WITH CHECK(public.bts_organisation_role(organization_id) IN ('owner','admin','editor'));
CREATE POLICY org_private_delete ON public.organization_planning_events FOR DELETE TO authenticated USING(public.bts_organisation_role(organization_id) IN ('owner','admin'));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='production_proposal_intakes' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'production_proposal_intakes');END LOOP;END $policy$;
ALTER TABLE public.production_proposal_intakes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.production_proposal_intakes FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.production_proposal_intakes TO authenticated;
CREATE POLICY org_private_read ON public.production_proposal_intakes FOR SELECT TO authenticated USING(public.bts_organisation_role(organization_id) IN ('owner','admin','editor','viewer'));
CREATE POLICY org_private_insert ON public.production_proposal_intakes FOR INSERT TO authenticated WITH CHECK(public.bts_organisation_role(organization_id) IN ('owner','admin','editor'));
CREATE POLICY org_private_update ON public.production_proposal_intakes FOR UPDATE TO authenticated USING(public.bts_organisation_role(organization_id) IN ('owner','admin','editor')) WITH CHECK(public.bts_organisation_role(organization_id) IN ('owner','admin','editor'));
CREATE POLICY org_private_delete ON public.production_proposal_intakes FOR DELETE TO authenticated USING(public.bts_organisation_role(organization_id) IN ('owner','admin'));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='production_proposals' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'production_proposals');END LOOP;END $policy$;
ALTER TABLE public.production_proposals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.production_proposals FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.production_proposals TO authenticated;
CREATE POLICY org_private_read ON public.production_proposals FOR SELECT TO authenticated USING(public.bts_organisation_role(organization_id) IN ('owner','admin','editor','viewer'));
CREATE POLICY org_private_insert ON public.production_proposals FOR INSERT TO authenticated WITH CHECK(public.bts_organisation_role(organization_id) IN ('owner','admin','editor'));
CREATE POLICY org_private_update ON public.production_proposals FOR UPDATE TO authenticated USING(public.bts_organisation_role(organization_id) IN ('owner','admin','editor')) WITH CHECK(public.bts_organisation_role(organization_id) IN ('owner','admin','editor'));
CREATE POLICY org_private_delete ON public.production_proposals FOR DELETE TO authenticated USING(public.bts_organisation_role(organization_id) IN ('owner','admin'));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='past_shows' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'past_shows');END LOOP;END $policy$;
ALTER TABLE public.past_shows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.past_shows FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.past_shows TO authenticated;
CREATE POLICY org_private_read ON public.past_shows FOR SELECT TO authenticated USING(public.bts_organisation_role(organization_id) IN ('owner','admin','editor','viewer'));
CREATE POLICY org_private_insert ON public.past_shows FOR INSERT TO authenticated WITH CHECK(public.bts_organisation_role(organization_id) IN ('owner','admin','editor'));
CREATE POLICY org_private_update ON public.past_shows FOR UPDATE TO authenticated USING(public.bts_organisation_role(organization_id) IN ('owner','admin','editor')) WITH CHECK(public.bts_organisation_role(organization_id) IN ('owner','admin','editor'));
CREATE POLICY org_private_delete ON public.past_shows FOR DELETE TO authenticated USING(public.bts_organisation_role(organization_id) IN ('owner','admin'));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='venues' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'venues');END LOOP;END $policy$;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.venues FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.venues TO authenticated;
CREATE POLICY org_private_read ON public.venues FOR SELECT TO authenticated USING(public.bts_organisation_role(org_id) IN ('owner','admin','editor','viewer'));
CREATE POLICY org_private_insert ON public.venues FOR INSERT TO authenticated WITH CHECK(public.bts_organisation_role(org_id) IN ('owner','admin','editor'));
CREATE POLICY org_private_update ON public.venues FOR UPDATE TO authenticated USING(public.bts_organisation_role(org_id) IN ('owner','admin','editor')) WITH CHECK(public.bts_organisation_role(org_id) IN ('owner','admin','editor'));
CREATE POLICY org_private_delete ON public.venues FOR DELETE TO authenticated USING(public.bts_organisation_role(org_id) IN ('owner','admin'));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='productions' AND cmd='SELECT' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'productions');END LOOP;END $policy$;
REVOKE ALL ON public.productions FROM PUBLIC,anon;
CREATE POLICY private_base_read ON public.productions AS RESTRICTIVE FOR SELECT TO public USING(public.bts_organisation_role(organization_id) IN ('owner','admin'));
CREATE POLICY private_base_read_allow ON public.productions FOR SELECT TO authenticated USING(public.bts_organisation_role(organization_id) IN ('owner','admin'));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='organizations' AND cmd='SELECT' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'organizations');END LOOP;END $policy$;
REVOKE ALL ON public.organizations FROM PUBLIC,anon;
CREATE POLICY private_base_read ON public.organizations AS RESTRICTIVE FOR SELECT TO public USING(public.bts_organisation_role(id) IN ('owner','admin'));
CREATE POLICY private_base_read_allow ON public.organizations FOR SELECT TO authenticated USING(public.bts_organisation_role(id) IN ('owner','admin'));
CREATE FUNCTION public.bts_owned_households(p_production_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',h->>'id','name','Your household','member_ids',own.ids,'members',own.members)),'[]'::jsonb)
 FROM public.productions p CROSS JOIN LATERAL jsonb_array_elements(coalesce(p.registration_households,'[]'::jsonb)) h
 CROSS JOIN LATERAL (
 SELECT jsonb_agg(a.id) AS ids,jsonb_agg(jsonb_build_object('assignment_id',a.id,'applicant_id',a.applicant_id)) AS members
 FROM public.casting_assignments a WHERE a.production_id=p.id AND public.bts_owns_audition(a.production_id,a.applicant_id)
 AND (coalesce(h->'member_ids','[]'::jsonb) ? a.id::text OR coalesce(h->'member_ids','[]'::jsonb) ? a.applicant_id::text OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(h->'members','[]'::jsonb)) m WHERE m->>'assignment_id'=a.id::text))
 ) own WHERE p.id=p_production_id AND own.ids IS NOT NULL AND public.bts_account_is_active()
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(h->'member_ids','[]'::jsonb)) mid WHERE NOT EXISTS(SELECT 1 FROM public.casting_assignments a WHERE a.production_id=p.id AND (a.id::text=mid OR a.applicant_id::text=mid) AND public.bts_owns_audition(a.production_id,a.applicant_id)))
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(h->'members','[]'::jsonb)) m WHERE NOT EXISTS(SELECT 1 FROM public.casting_assignments a WHERE a.production_id=p.id AND a.id::text=m->>'assignment_id' AND public.bts_owns_audition(a.production_id,a.applicant_id)));
$$;
CREATE VIEW public.bts_participant_casting WITH(security_barrier=true) AS
SELECT id,production_id,character_id,applicant_id,created_at,state,dropped_out,volunteer_discount_approved,volunteer_hours_completed,scholarship_amount,volunteer_discount_per_child,scholarship_status
FROM public.casting_assignments WHERE public.bts_owns_audition(production_id,applicant_id) OR public.bts_private_record_permission(production_id,'auditions.casting_board',1)
WITH LOCAL CHECK OPTION;
GRANT SELECT ON public.bts_participant_casting TO authenticated;
CREATE POLICY own_cast_registration_read ON public.cast_members FOR SELECT TO authenticated USING(public.bts_owns_audition(production_id,applicant_id));
CREATE POLICY own_cast_registration_update ON public.cast_members FOR UPDATE TO authenticated USING(public.bts_owns_audition(production_id,applicant_id)) WITH CHECK(public.bts_owns_audition(production_id,applicant_id));
CREATE POLICY own_tape_read ON public.self_tape_submissions FOR SELECT TO authenticated USING(public.bts_owns_audition(production_id,applicant_id));
CREATE POLICY own_tape_insert ON public.self_tape_submissions FOR INSERT TO authenticated WITH CHECK(public.bts_owns_audition(production_id,applicant_id));
CREATE POLICY own_tape_delete ON public.self_tape_submissions FOR DELETE TO authenticated USING(public.bts_owns_audition(production_id,applicant_id));
CREATE POLICY own_registration_payments_read ON public.registration_payment_records FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.bts_participant_casting a WHERE a.id=casting_assignment_id AND a.production_id=registration_payment_records.production_id AND public.bts_owns_audition(a.production_id,a.applicant_id)));
CREATE POLICY own_household_payments_read ON public.household_payment_logs FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM jsonb_array_elements(public.bts_owned_households(production_id)) h WHERE h->>'id'=household_id));

-- A shared household label never grants access to another adult's children or payments.
CREATE FUNCTION public.bts_respond_cast_offer(p_production_id uuid,p_assignment_ids uuid[],p_state text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE changed integer;
BEGIN
 IF p_state NOT IN ('offer_accepted','offer_declined') OR NOT public.bts_account_is_active() OR coalesce(array_length(p_assignment_ids,1),0) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid offer response.'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_assignment_ids) i WHERE NOT EXISTS(SELECT 1 FROM public.casting_assignments a WHERE a.id=i AND a.production_id=p_production_id AND public.bts_owns_audition(a.production_id,a.applicant_id) AND a.state IN ('chosen','ensemble_manual','offer_accepted','offer_declined'))) THEN RAISE EXCEPTION 'This offer does not belong to your account.'; END IF;
 UPDATE public.casting_assignments SET state=p_state WHERE id=ANY(p_assignment_ids) AND production_id=p_production_id;
 GET DIAGNOSTICS changed=ROW_COUNT; RETURN changed;
END $$;
CREATE POLICY finance_cast_benefits_update ON public.casting_assignments FOR UPDATE TO authenticated USING(public.bts_production_page_permission(production_id,'registration.payments',2)) WITH CHECK(public.bts_production_page_permission(production_id,'registration.payments',2));
CREATE FUNCTION public.bts_link_matches_production(p_kind text,p_id uuid,p_production_id uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.bts_account_is_active() THEN RETURN false;END IF;
 IF NOT public.bts_production_staff(p_production_id) THEN
  RETURN p_kind IN ('applicant_id','application_id') AND public.bts_owns_audition(p_production_id,p_id);
 END IF;
 RETURN CASE p_kind
 WHEN 'applicant_id' THEN EXISTS(SELECT 1 FROM public.audition_applications WHERE id=p_id AND production_id=p_production_id) OR EXISTS(SELECT 1 FROM public.audition_bookings WHERE id=p_id AND production_id=p_production_id)
 WHEN 'application_id' THEN EXISTS(SELECT 1 FROM public.audition_applications WHERE id=p_id AND production_id=p_production_id) OR EXISTS(SELECT 1 FROM public.audition_bookings WHERE id=p_id AND production_id=p_production_id) OR EXISTS(SELECT 1 FROM public.applications a JOIN public.auditions d ON d.id=a.audition_id WHERE a.id=p_id AND d.production_id=p_production_id)
 WHEN 'character_id' THEN EXISTS(SELECT 1 FROM public.production_characters WHERE id=p_id AND production_id=p_production_id)
 WHEN 'session_id' THEN EXISTS(SELECT 1 FROM public.audition_sessions WHERE id=p_id AND production_id=p_production_id)
 WHEN 'casting_assignment_id' THEN EXISTS(SELECT 1 FROM public.casting_assignments WHERE id=p_id AND production_id=p_production_id)
 WHEN 'business_id' THEN EXISTS(SELECT 1 FROM public.sponsor_businesses WHERE id=p_id AND production_id=p_production_id)
 WHEN 'category_id' THEN EXISTS(SELECT 1 FROM public.budget_categories WHERE id=p_id AND production_id=p_production_id)
 WHEN 'scene_id' THEN EXISTS(SELECT 1 FROM public.production_scenes WHERE id=p_id AND production_id=p_production_id)
 WHEN 'act_id' THEN EXISTS(SELECT 1 FROM public.production_acts WHERE id=p_id AND production_id=p_production_id)
 WHEN 'folder_id' THEN EXISTS(SELECT 1 FROM public.production_folders WHERE id=p_id AND production_id=p_production_id)
 ELSE false END;
END $$;
REVOKE ALL ON FUNCTION public.bts_link_matches_production(text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bts_link_matches_production(text,uuid,uuid) TO authenticated;
CREATE FUNCTION bts_private.guard_private_links() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE before_row jsonb; after_row jsonb:=to_jsonb(NEW); k text; ref_production uuid; app_id uuid;
BEGIN
 IF current_user NOT IN ('anon','authenticated') THEN RETURN NEW; END IF;
 IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'An active adult account is required.';END IF;
 IF TG_OP='UPDATE' THEN
  before_row:=to_jsonb(OLD);
  FOREACH k IN ARRAY ARRAY['id','production_id','organization_id','org_id','user_id','created_at','applicant_id','application_id','casting_assignment_id','profile_id','household_id','business_id','pitch_submitted_by_user_id'] LOOP
   IF after_row->k IS DISTINCT FROM before_row->k THEN RAISE EXCEPTION 'Record identity and ownership cannot be reassigned here.'; END IF;
  END LOOP;
 END IF;
 IF TG_TABLE_NAME='casting_assignments' AND NOT (public.bts_production_page_permission(NEW.production_id,'auditions.casting_board',2) OR public.bts_production_page_permission(NEW.production_id,'auditions.final_casting',2)) THEN
  IF TG_OP<>'UPDATE' OR NOT public.bts_production_page_permission(NEW.production_id,'registration.payments',2) THEN RAISE EXCEPTION 'Casting permission is required.';END IF;
  FOR k IN SELECT key FROM jsonb_each(after_row) LOOP
   IF after_row->k IS DISTINCT FROM before_row->k AND k NOT IN ('scholarship_amount','scholarship_status','reg_payment_notes','volunteer_discount_approved','volunteer_hours_completed','volunteer_discount_per_child','volunteer_signup_ids','volunteer_signup_name','volunteer_role_notes') THEN RAISE EXCEPTION 'Finance permission does not grant casting decisions.'; END IF;
  END LOOP;
 END IF;
 IF TG_TABLE_NAME='cast_members' AND NOT public.bts_private_record_permission(NEW.production_id,'cast_list',2) THEN
  IF TG_OP<>'UPDATE' OR NOT public.bts_owns_audition(NEW.production_id,NEW.applicant_id) THEN RAISE EXCEPTION 'This registration belongs to another account.'; END IF;
  FOR k IN SELECT key FROM jsonb_each(after_row) LOOP
   IF after_row->k IS DISTINCT FROM before_row->k AND k NOT IN ('registration_answers','phone','guardian_name','guardian_email','guardian_phone','updated_at') THEN RAISE EXCEPTION 'Only staff can change cast decisions or private notes.';END IF;
  END LOOP;
 END IF;
 IF TG_TABLE_NAME='self_tape_submissions' THEN
  IF NOT EXISTS(SELECT 1 FROM public.bts_participant_applications a WHERE a.id=NEW.applicant_id AND a.production_id=NEW.production_id) AND NOT EXISTS(SELECT 1 FROM public.bts_participant_bookings b WHERE b.id=NEW.applicant_id AND b.production_id=NEW.production_id) THEN RAISE EXCEPTION 'The performer must belong to this production and your account or authorised staff scope.';END IF;
  IF NEW.video_url !~ '^https://' OR length(NEW.video_url)>2048 OR coalesce(NEW.scope,'general_audition') NOT IN ('general_audition','callback') THEN RAISE EXCEPTION 'Use a valid HTTPS video link and submission type.'; END IF;
 END IF;
 IF after_row->>'production_id' IS NOT NULL THEN
  -- Reject cross-production foreign references even when the caller can edit both productions.
  FOREACH k IN ARRAY ARRAY['applicant_id','application_id','character_id','session_id','casting_assignment_id','business_id','category_id','scene_id','act_id','folder_id'] LOOP
   IF nullif(after_row->>k,'') IS NOT NULL AND (TG_OP='INSERT' OR after_row->k IS DISTINCT FROM before_row->k) THEN
    IF NOT public.bts_link_matches_production(k,(after_row->>k)::uuid,(after_row->>'production_id')::uuid) THEN RAISE EXCEPTION 'Linked records must belong to the same production.';END IF;
   END IF;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.budget_categories FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.budget_items FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.budget_receipts FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.budget_settings FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.cast_members FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.casting_assignments FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.self_tape_submissions FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.registration_payment_records FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.household_payment_logs FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.callback_groups FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.costume_assignments FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.costume_groups FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.daily_checkins FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.checklist_items FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.producer_tasks FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.portal_permissions FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.production_access_audit_log FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.production_acts FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.production_scenes FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.scene_characters FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.scene_groups FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.scene_notes FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.production_script_import_items FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.production_crew FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.production_props FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.production_roles FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.production_files FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.production_folders FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.production_events FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.production_characters FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.audition_configs FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.audition_custom_questions FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.audition_sessions FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.audition_slots FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.sponsor_businesses FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.sponsor_packages FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.sponsor_files FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.sponsor_deliverables FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.sponsor_settings FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE TRIGGER guard_private_links BEFORE INSERT OR UPDATE ON public.programme_ads FOR EACH ROW EXECUTE FUNCTION bts_private.guard_private_links();
CREATE VIEW public.bts_visible_productions WITH(security_barrier=true) AS SELECT p.id,p.organization_id,p.title,p.description,p.status,p.custom_id,p.subtitle,p.season_year,p.venue,p.image_url,p.production_type,p.poster_url,p.page_status,p.slug,p.start_date,p.end_date,p.is_public,p.age_min,p.age_max,p.audition_location,p.rehearsal_location,p.performance_location,p.audition_locations,p.rehearsal_locations,p.performance_locations,p.volunteer_staffing_plan,p.enabled_modules,p.created_at,p.holiday_country,p.holiday_region,CASE WHEN public.bts_production_page_permission(p.id,'registration.settings',1) OR public.bts_is_production_participant(p.id) THEN p.registration_settings ELSE CASE WHEN p.registration_settings->'ticketing_published'='true'::jsonb THEN jsonb_build_object('ticketing_published',true,'ticketing',p.registration_settings->'ticketing') ELSE '{}'::jsonb END END AS registration_settings,CASE WHEN public.bts_production_page_permission(p.id,'registration.payments',1) THEN p.registration_households ELSE public.bts_owned_households(p.id) END AS registration_households,CASE WHEN EXISTS(SELECT 1 FROM public.productions fullp WHERE fullp.id=p.id AND public.bts_organisation_role(fullp.organization_id) IN ('owner','admin')) THEN p.wizard_data ELSE jsonb_build_object('materials_enabled',p.wizard_data->'materials_enabled','ensemble_override',p.wizard_data->'ensemble_override','self_tape_enabled',p.wizard_data->'self_tape_enabled','self_tape_deadline',p.wizard_data->'self_tape_deadline') END AS wizard_data,CASE WHEN EXISTS(SELECT 1 FROM public.productions fullp WHERE fullp.id=p.id AND public.bts_organisation_role(fullp.organization_id) IN ('owner','admin')) THEN p.ticketing_setup ELSE '{}'::jsonb END AS ticketing_setup,CASE WHEN EXISTS(SELECT 1 FROM public.productions fullp WHERE fullp.id=p.id AND public.bts_organisation_role(fullp.organization_id) IN ('owner','admin')) THEN p.budget_revenue_drivers ELSE '{}'::jsonb END AS budget_revenue_drivers,CASE WHEN EXISTS(SELECT 1 FROM public.productions fullp WHERE fullp.id=p.id AND public.bts_organisation_role(fullp.organization_id) IN ('owner','admin')) THEN p.production_support_list ELSE '[]'::jsonb END AS production_support_list,CASE WHEN EXISTS(SELECT 1 FROM public.productions fullp WHERE fullp.id=p.id AND public.bts_organisation_role(fullp.organization_id) IN ('owner','admin')) THEN p.dismissed_team_roles ELSE '{}'::text[] END AS dismissed_team_roles,CASE WHEN EXISTS(SELECT 1 FROM public.productions fullp WHERE fullp.id=p.id AND public.bts_organisation_role(fullp.organization_id) IN ('owner','admin')) THEN p.production_support_ordered ELSE false END AS production_support_ordered FROM public.productions p WHERE (p.is_public AND p.page_status IN ('live','hidden')) OR public.bts_production_staff(p.id) OR public.bts_is_production_participant(p.id);
GRANT SELECT ON public.bts_visible_productions TO anon,authenticated;
CREATE VIEW public.bts_visible_organizations WITH(security_barrier=true) AS SELECT o.id,o.name,o.slug,o.abbreviation,o.location,o.description,o.bio,o.mission,o.story,o.logo_url,o.logo_white_url,o.logo_black_url,o.logo_alternative_url,o.banner_url,o.website,o.profile_public,o.show_contact,o.established_year,o.total_productions_override,o.created_at,o.org_type,o.legal_structure,o.primary_venue_id,o.location_lat,o.location_lng,o.custom_id,CASE WHEN o.show_contact OR public.bts_organisation_role(o.id) IS NOT NULL THEN o.email END AS email,CASE WHEN o.show_contact OR public.bts_organisation_role(o.id) IS NOT NULL THEN o.phone END AS phone,CASE WHEN public.bts_organisation_role(o.id) IN ('owner','admin') THEN o.account_owner_type END AS account_owner_type,CASE WHEN public.bts_organisation_role(o.id) IN ('owner','admin') THEN o.account_owner_name END AS account_owner_name,CASE WHEN public.bts_organisation_role(o.id) IN ('owner','admin') THEN o.account_owner_role END AS account_owner_role,CASE WHEN public.bts_organisation_role(o.id) IN ('owner','admin') THEN o.board_structure END AS board_structure,CASE WHEN public.bts_organisation_role(o.id) IN ('owner','admin') THEN o.org_roles END AS org_roles,CASE WHEN public.bts_organisation_role(o.id) IN ('owner','admin') THEN o.planning_calendar END AS planning_calendar,CASE WHEN public.bts_organisation_role(o.id) IN ('owner','admin') THEN o.etransfer_email END AS etransfer_email,CASE WHEN public.bts_organisation_role(o.id) IN ('owner','admin') THEN o.payment_settings END AS payment_settings,CASE WHEN public.bts_organisation_role(o.id) IN ('owner','admin') THEN o.proposal_submission_token END AS proposal_submission_token,CASE WHEN public.bts_organisation_role(o.id) IN ('owner','admin') THEN o.slug_changed_at END AS slug_changed_at FROM public.organizations o WHERE o.profile_public OR public.bts_organisation_role(o.id) IS NOT NULL OR EXISTS(SELECT 1 FROM public.productions p WHERE p.organization_id=o.id AND p.is_public AND p.page_status IN ('live','hidden'));
GRANT SELECT ON public.bts_visible_organizations TO anon,authenticated;
CREATE VIEW public.bts_visible_production_events WITH(security_barrier=true) AS SELECT e.id,e.production_id,e.title,e.event_type,e.start_time,e.end_time,e.all_day,e.is_public,e.is_deadline,e.show_in_cast_schedule,e.venue,e.time_tbd,e.mandatory,e.arrive_note,e.bring_note,e.know_note,e.created_at,e.updated_at,CASE WHEN public.bts_production_page_permission(e.production_id,'production_calendar',1) THEN e.notes END AS notes FROM public.production_events e WHERE public.bts_production_page_permission(e.production_id,'production_calendar',1) OR (public.bts_is_production_participant(e.production_id) AND e.show_in_cast_schedule) OR (e.is_public AND EXISTS(SELECT 1 FROM public.productions p WHERE p.id=e.production_id AND p.is_public AND p.page_status IN ('live','hidden')));
GRANT SELECT ON public.bts_visible_production_events TO anon,authenticated;
CREATE FUNCTION public.bts_callback_access(p_production_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.bts_production_page_permission(p_production_id,'auditions.callback',1) OR (public.bts_account_is_active() AND EXISTS(SELECT 1 FROM public.audition_applications WHERE production_id=p_production_id AND user_id=auth.uid() AND coalesce(callback_status,'none')<>'none'));
$$;
GRANT EXECUTE ON FUNCTION public.bts_callback_access(uuid) TO anon,authenticated;
CREATE VIEW public.bts_visible_characters WITH(security_barrier=true) AS SELECT c.id,c.production_id,c.name,c.performer_count,c.sort_order,c.show_on_form,c.show_on_public_page,c.vocal_type,c.vocal_range,c.vocal_usage,c.role_type,c.gender,c.age_range,c.description,c.singing_strength,c.dancing_strength,c.beginner_friendly,c.audition_material,c.created_at,c.audition_file_url,c.audition_file_path,c.audition_file_name,c.audition_side_url,c.audition_side_path,c.audition_side_name,c.audition_songcut_url,c.audition_songcut_path,c.audition_songcut_name,c.audition_other_url,c.audition_other_path,c.audition_other_name,c.audition_side_notes,c.audition_songcut_notes,c.audition_other_notes,c.audition_material_types,c.dance_call_file_url,c.other_file_url,c.dance_call_file_path,c.other_file_path,c.dance_call_file_name,c.other_file_name,c.dance_call_material_types,c.other_material_types,c.dance_call_side_url,c.dance_call_side_path,c.dance_call_side_name,c.dance_call_songcut_url,c.dance_call_songcut_path,c.dance_call_songcut_name,c.dance_call_other_url,c.dance_call_other_path,c.dance_call_other_name,c.other_side_url,c.other_side_path,c.other_side_name,c.other_songcut_url,c.other_songcut_path,c.other_songcut_name,c.other_other_url,c.other_other_path,c.other_other_name,c.dance_call_side_notes,c.dance_call_songcut_notes,c.dance_call_other_notes,c.other_side_notes,c.other_songcut_notes,c.other_other_notes,CASE WHEN public.bts_callback_access(c.production_id) THEN c.callback_material END AS callback_material,CASE WHEN public.bts_callback_access(c.production_id) THEN c.callback_file_url END AS callback_file_url,CASE WHEN public.bts_callback_access(c.production_id) THEN c.callback_file_path END AS callback_file_path,CASE WHEN public.bts_callback_access(c.production_id) THEN c.callback_file_name END AS callback_file_name,CASE WHEN public.bts_callback_access(c.production_id) THEN c.callback_side_url END AS callback_side_url,CASE WHEN public.bts_callback_access(c.production_id) THEN c.callback_side_path END AS callback_side_path,CASE WHEN public.bts_callback_access(c.production_id) THEN c.callback_side_name END AS callback_side_name,CASE WHEN public.bts_callback_access(c.production_id) THEN c.callback_songcut_url END AS callback_songcut_url,CASE WHEN public.bts_callback_access(c.production_id) THEN c.callback_songcut_path END AS callback_songcut_path,CASE WHEN public.bts_callback_access(c.production_id) THEN c.callback_songcut_name END AS callback_songcut_name,CASE WHEN public.bts_callback_access(c.production_id) THEN c.callback_other_url END AS callback_other_url,CASE WHEN public.bts_callback_access(c.production_id) THEN c.callback_other_path END AS callback_other_path,CASE WHEN public.bts_callback_access(c.production_id) THEN c.callback_other_name END AS callback_other_name,CASE WHEN public.bts_callback_access(c.production_id) THEN c.callback_side_notes END AS callback_side_notes,CASE WHEN public.bts_callback_access(c.production_id) THEN c.callback_songcut_notes END AS callback_songcut_notes,CASE WHEN public.bts_callback_access(c.production_id) THEN c.callback_other_notes END AS callback_other_notes,CASE WHEN public.bts_callback_access(c.production_id) THEN c.callback_material_types END AS callback_material_types FROM public.production_characters c WHERE public.bts_production_page_permission(c.production_id,'auditions.general',1) OR public.bts_is_production_participant(c.production_id) OR (c.show_on_public_page AND EXISTS(SELECT 1 FROM public.productions p WHERE p.id=c.production_id AND p.is_public AND p.page_status IN ('live','hidden')));
GRANT SELECT ON public.bts_visible_characters TO anon,authenticated;
CREATE VIEW public.bts_visible_venues WITH(security_barrier=true) AS SELECT id,org_id,name,nickname,address,map_url,capacity,type,lat,lng,photo_url,website FROM public.venues v WHERE public.bts_organisation_role(v.org_id) IS NOT NULL OR EXISTS(SELECT 1 FROM public.productions p WHERE p.organization_id=v.org_id AND p.is_public AND p.page_status IN ('live','hidden') AND (p.venue IN (v.id::text,v.name,v.nickname) OR EXISTS(SELECT 1 FROM public.production_events e WHERE e.production_id=p.id AND e.is_public AND e.venue IN (v.id::text,v.name,v.nickname)) OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(p.audition_locations,'[]'::jsonb)||coalesce(p.performance_locations,'[]'::jsonb)) loc WHERE loc->>'id'=v.id::text OR loc->>'venue_id'=v.id::text OR loc#>>'{}'=v.id::text)));
GRANT SELECT ON public.bts_visible_venues TO anon,authenticated;
CREATE VIEW public.bts_visible_audition_sessions WITH(security_barrier=true) AS SELECT t.* FROM public.audition_sessions t WHERE public.bts_production_staff(t.production_id) OR (EXISTS(SELECT 1 FROM public.productions p WHERE p.id=t.production_id AND p.is_public AND p.page_status IN ('live','hidden')) AND t.enabled AND t.show_to_applicants);
GRANT SELECT ON public.bts_visible_audition_sessions TO anon,authenticated;
CREATE VIEW public.bts_visible_audition_configs WITH(security_barrier=true) AS SELECT t.* FROM public.audition_configs t WHERE public.bts_production_staff(t.production_id) OR (EXISTS(SELECT 1 FROM public.productions p WHERE p.id=t.production_id AND p.is_public AND p.page_status IN ('live','hidden')) AND t.is_open);
GRANT SELECT ON public.bts_visible_audition_configs TO anon,authenticated;
CREATE VIEW public.bts_visible_audition_custom_questions WITH(security_barrier=true) AS SELECT t.* FROM public.audition_custom_questions t WHERE public.bts_production_staff(t.production_id) OR (EXISTS(SELECT 1 FROM public.productions p WHERE p.id=t.production_id AND p.is_public AND p.page_status IN ('live','hidden')));
GRANT SELECT ON public.bts_visible_audition_custom_questions TO anon,authenticated;
CREATE VIEW public.bts_visible_audition_slots WITH(security_barrier=true) AS SELECT t.* FROM public.audition_slots t WHERE public.bts_production_staff(t.production_id) OR (EXISTS(SELECT 1 FROM public.productions p WHERE p.id=t.production_id AND p.is_public AND p.page_status IN ('live','hidden')));
GRANT SELECT ON public.bts_visible_audition_slots TO anon,authenticated;
CREATE VIEW public.bts_callback_files WITH(security_barrier=true) AS SELECT f.* FROM public.production_files f WHERE public.bts_callback_access(f.production_id) AND (f.document_type IN ('callback','callback_material','callback_sides') OR f.tags @> ARRAY['callback material']::text[]) AND (f.document_type IN ('callback','callback_material','callback_sides') OR EXISTS(SELECT 1 FROM public.production_characters c WHERE c.production_id=f.production_id AND EXISTS(SELECT 1 FROM jsonb_each_text(to_jsonb(c)) kv WHERE kv.key LIKE 'callback_%' AND (kv.value=f.file_path OR kv.value=f.file_url))));
GRANT SELECT ON public.bts_callback_files TO authenticated;
-- Hold identifiers and booked profile IDs must not be public API fields.
REVOKE ALL ON public.audition_time_slots FROM PUBLIC,anon;
CREATE POLICY scoped_slots_read ON public.audition_time_slots AS RESTRICTIVE FOR SELECT TO public USING(EXISTS(SELECT 1 FROM public.audition_sessions s WHERE s.id=session_id AND public.bts_production_page_permission(s.production_id,'auditions.schedule',1)));
DO $slot$ DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='audition_time_slots' AND cmd IN ('UPDATE','INSERT','DELETE','ALL') LOOP EXECUTE format('DROP POLICY %I ON public.audition_time_slots',p.policyname);END LOOP;END $slot$;
CREATE POLICY staff_slots_write ON public.audition_time_slots FOR UPDATE TO authenticated USING(EXISTS(SELECT 1 FROM public.audition_sessions s WHERE s.id=session_id AND public.bts_production_page_permission(s.production_id,'auditions.schedule',2))) WITH CHECK(EXISTS(SELECT 1 FROM public.audition_sessions s WHERE s.id=session_id AND public.bts_production_page_permission(s.production_id,'auditions.schedule',2)));
CREATE POLICY staff_slots_select ON public.audition_time_slots FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.audition_sessions s WHERE s.id=session_id AND public.bts_production_page_permission(s.production_id,'auditions.schedule',1)));
CREATE VIEW public.bts_visible_audition_time_slots WITH(security_barrier=true) AS
SELECT t.id,t.session_id,t.slot_time,t.slot_date,t.label,t.block_id,t.capacity,t.is_available,NULL::uuid AS booked_profile_id,NULL::text AS reserved_token,NULL::timestamptz AS reserved_until,NULL::text AS hold_session_id,NULL::timestamptz AS hold_expires_at
FROM public.audition_time_slots t WHERE EXISTS(SELECT 1 FROM public.bts_visible_audition_sessions s WHERE s.id=t.session_id);
GRANT SELECT ON public.bts_visible_audition_time_slots TO anon,authenticated;
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='opportunities' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'opportunities');END LOOP;END $policy$;
REVOKE ALL ON public.opportunities FROM PUBLIC,anon;
CREATE POLICY scoped_access ON public.opportunities TO authenticated USING(public.bts_organisation_role(organization_id) IN ('owner','admin','editor')) WITH CHECK(public.bts_organisation_role(organization_id) IN ('owner','admin','editor'));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='auditions' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'auditions');END LOOP;END $policy$;
REVOKE ALL ON public.auditions FROM PUBLIC,anon;
CREATE POLICY scoped_access ON public.auditions TO authenticated USING(public.bts_production_page_permission(production_id,'auditions.general',2)) WITH CHECK(public.bts_production_page_permission(production_id,'auditions.general',2));
DO $policy$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='roles' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'roles');END LOOP;END $policy$;
REVOKE ALL ON public.roles FROM PUBLIC,anon;
CREATE POLICY scoped_access ON public.roles TO authenticated USING(public.bts_production_page_permission(production_id,'cast_list',2)) WITH CHECK(public.bts_production_page_permission(production_id,'cast_list',2));
CREATE VIEW public.bts_visible_opportunities WITH(security_barrier=true) AS SELECT o.* FROM public.opportunities o WHERE o.status='published' OR public.bts_organisation_role(o.organization_id) IN ('owner','admin','editor');
GRANT SELECT ON public.bts_visible_opportunities TO anon,authenticated;
REVOKE ALL ON public.castings FROM PUBLIC,anon;
DO $legacy$ DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='castings' LOOP EXECUTE format('DROP POLICY %I ON public.castings',p.policyname);END LOOP;END $legacy$;
CREATE POLICY scoped_legacy_casting ON public.castings TO authenticated USING(EXISTS(SELECT 1 FROM public.roles r WHERE r.id=role_id AND public.bts_production_page_permission(r.production_id,'cast_list',2))) WITH CHECK(EXISTS(SELECT 1 FROM public.roles r WHERE r.id=role_id AND public.bts_production_page_permission(r.production_id,'cast_list',2)));
REVOKE ALL ON public.applications FROM PUBLIC,anon;
CREATE POLICY active_legacy_application ON public.applications AS RESTRICTIVE TO public USING(public.bts_account_is_active()) WITH CHECK(public.bts_account_is_active() AND status='pending');

ALTER TABLE public.sponsor_businesses ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX sponsor_businesses_account_idx ON public.sponsor_businesses(user_id);
CREATE POLICY own_sponsor_read ON public.sponsor_businesses FOR SELECT TO authenticated USING(public.bts_account_is_active() AND user_id=auth.uid());
CREATE POLICY own_sponsor_files_read ON public.sponsor_files FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.sponsor_businesses b WHERE b.id=business_id AND b.user_id=auth.uid() AND public.bts_account_is_active()));
ALTER FUNCTION public.organisation_observation_delete(uuid,uuid) SET SCHEMA bts_private;
REVOKE ALL ON FUNCTION bts_private.organisation_observation_delete(uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.organisation_observation_delete(p_production_id uuid, p_observation_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $wrapper$
DECLARE result boolean; BEGIN IF NOT public.bts_production_page_permission(p_production_id,'auditions.general',2) THEN RAISE EXCEPTION 'Staff permission is required.';END IF; result:=bts_private.organisation_observation_delete(p_production_id,p_observation_id);  RETURN result;END;
$wrapper$;
REVOKE ALL ON FUNCTION public.organisation_observation_delete(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.organisation_observation_delete(uuid,uuid) TO authenticated;
ALTER FUNCTION public.organisation_observation_upsert(uuid,uuid,uuid,uuid,text,text,text,text,text,jsonb,text,text,text) SET SCHEMA bts_private;
REVOKE ALL ON FUNCTION bts_private.organisation_observation_upsert(uuid,uuid,uuid,uuid,text,text,text,text,text,jsonb,text,text,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.organisation_observation_upsert(p_production_id uuid, p_applicant_id uuid, p_session_id uuid DEFAULT NULL::uuid, p_character_id uuid DEFAULT NULL::uuid, p_observation_area text DEFAULT 'in_room'::text, p_observation_type text DEFAULT 'general'::text, p_observation_key text DEFAULT 'general'::text, p_value text DEFAULT NULL::text, p_body text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb, p_author_name text DEFAULT NULL::text, p_author_role text DEFAULT NULL::text, p_author_color text DEFAULT '#b8b4c0'::text) RETURNS SETOF production_audition_observations LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $wrapper$
BEGIN IF NOT public.bts_production_page_permission(p_production_id,'auditions.general',2) THEN RAISE EXCEPTION 'Staff permission is required.';END IF;IF NOT EXISTS(SELECT 1 FROM public.audition_applications WHERE id=p_applicant_id AND production_id=p_production_id) AND NOT EXISTS(SELECT 1 FROM public.audition_bookings WHERE id=p_applicant_id AND production_id=p_production_id) THEN RAISE EXCEPTION 'Performer belongs to a different production.';END IF;IF p_session_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.audition_sessions WHERE id=p_session_id AND production_id=p_production_id) THEN RAISE EXCEPTION 'Session belongs to a different production.';END IF; IF p_character_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.production_characters WHERE id=p_character_id AND production_id=p_production_id) THEN RAISE EXCEPTION 'Character belongs to a different production.';END IF; RETURN QUERY SELECT * FROM bts_private.organisation_observation_upsert(p_production_id,p_applicant_id,p_session_id,p_character_id,p_observation_area,p_observation_type,p_observation_key,p_value,p_body,p_metadata,p_author_name,p_author_role,p_author_color);END;
$wrapper$;
REVOKE ALL ON FUNCTION public.organisation_observation_upsert(uuid,uuid,uuid,uuid,text,text,text,text,text,jsonb,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.organisation_observation_upsert(uuid,uuid,uuid,uuid,text,text,text,text,text,jsonb,text,text,text) TO authenticated;
ALTER FUNCTION public.remove_production_team_member(uuid,uuid) SET SCHEMA bts_private;
REVOKE ALL ON FUNCTION bts_private.remove_production_team_member(uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.remove_production_team_member(p_production_id uuid, p_team_member_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $wrapper$
DECLARE result jsonb; BEGIN IF NOT public.bts_production_page_permission(p_production_id,'production_team',3) THEN RAISE EXCEPTION 'Manage team permission is required.';END IF; result:=bts_private.remove_production_team_member(p_production_id,p_team_member_id);  RETURN result;END;
$wrapper$;
REVOKE ALL ON FUNCTION public.remove_production_team_member(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.remove_production_team_member(uuid,uuid) TO authenticated;
ALTER FUNCTION public.submit_public_production_proposal(text,text,jsonb) SET SCHEMA bts_private;
REVOKE ALL ON FUNCTION bts_private.submit_public_production_proposal(text,text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.submit_public_production_proposal(p_org_key text, p_token text, p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $wrapper$
DECLARE result jsonb; BEGIN IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with an adult account before submitting.';END IF; result:=bts_private.submit_public_production_proposal(p_org_key,p_token,p_payload); UPDATE public.production_proposals SET pitch_submitted_by_user_id=auth.uid() WHERE id=(result->>'proposal_id')::uuid; RETURN result;END;
$wrapper$;
REVOKE ALL ON FUNCTION public.submit_public_production_proposal(text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_public_production_proposal(text,text,jsonb) TO authenticated;
ALTER FUNCTION public.submit_public_production_proposal(text,text,text,jsonb) SET SCHEMA bts_private;
REVOKE ALL ON FUNCTION bts_private.submit_public_production_proposal(text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.submit_public_production_proposal(p_intake_key text, p_token text, p_access_code text, p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $wrapper$
DECLARE result jsonb; BEGIN IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with an adult account before submitting.';END IF; result:=bts_private.submit_public_production_proposal(p_intake_key,p_token,p_access_code,p_payload); UPDATE public.production_proposals SET pitch_submitted_by_user_id=auth.uid() WHERE id=(result->>'proposal_id')::uuid; RETURN result;END;
$wrapper$;
REVOKE ALL ON FUNCTION public.submit_public_production_proposal(text,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_public_production_proposal(text,text,text,jsonb) TO authenticated;
ALTER FUNCTION public.submit_sponsor_interest(uuid,text,text,text,text,text,text,text,text,integer,text) SET SCHEMA bts_private;
REVOKE ALL ON FUNCTION bts_private.submit_sponsor_interest(uuid,text,text,text,text,text,text,text,text,integer,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.submit_sponsor_interest(p_production_id uuid, p_kind text, p_business_name text, p_contact_name text, p_contact_email text, p_contact_phone text DEFAULT NULL::text, p_option_id text DEFAULT NULL::text, p_option_label text DEFAULT NULL::text, p_format text DEFAULT NULL::text, p_amount_cents integer DEFAULT 0, p_notes text DEFAULT NULL::text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $wrapper$
DECLARE result jsonb; BEGIN IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with an adult account before submitting.';END IF; result:=bts_private.submit_sponsor_interest(p_production_id,p_kind,p_business_name,p_contact_name,p_contact_email,p_contact_phone,p_option_id,p_option_label,p_format,p_amount_cents,p_notes); UPDATE public.sponsor_businesses SET user_id=auth.uid() WHERE id=(result->>'business_id')::uuid; RETURN result;END;
$wrapper$;
REVOKE ALL ON FUNCTION public.submit_sponsor_interest(uuid,text,text,text,text,text,text,text,text,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_sponsor_interest(uuid,text,text,text,text,text,text,text,text,integer,text) TO authenticated;
ALTER FUNCTION public.finalize_sponsor_submission(uuid,uuid,text,text,text,text,jsonb) SET SCHEMA bts_private;
REVOKE ALL ON FUNCTION bts_private.finalize_sponsor_submission(uuid,uuid,text,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.finalize_sponsor_submission(p_production_id uuid, p_business_id uuid, p_kind text, p_website text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_artwork_status text DEFAULT NULL::text, p_files jsonb DEFAULT '[]'::jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $wrapper$
DECLARE result jsonb; BEGIN IF NOT public.bts_account_is_active() OR NOT (EXISTS(SELECT 1 FROM public.sponsor_businesses WHERE id=p_business_id AND production_id=p_production_id AND user_id=auth.uid()) OR public.bts_private_record_permission(p_production_id,'marketing.sponsors',2)) THEN RAISE EXCEPTION 'This submission belongs to another account.';END IF; result:=bts_private.finalize_sponsor_submission(p_production_id,p_business_id,p_kind,p_website,p_notes,p_artwork_status,p_files);  RETURN result;END;
$wrapper$;
REVOKE ALL ON FUNCTION public.finalize_sponsor_submission(uuid,uuid,text,text,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finalize_sponsor_submission(uuid,uuid,text,text,text,text,jsonb) TO authenticated;
ALTER FUNCTION public.finalize_sponsor_submission(uuid,uuid,text,text,text,text,jsonb,jsonb,text) SET SCHEMA bts_private;
REVOKE ALL ON FUNCTION bts_private.finalize_sponsor_submission(uuid,uuid,text,text,text,text,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.finalize_sponsor_submission(p_production_id uuid, p_business_id uuid, p_kind text, p_website text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_artwork_status text DEFAULT NULL::text, p_files jsonb DEFAULT '[]'::jsonb, p_artwork_data jsonb DEFAULT '{}'::jsonb, p_payment_status text DEFAULT NULL::text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $wrapper$
DECLARE result jsonb; BEGIN IF NOT public.bts_account_is_active() OR NOT (EXISTS(SELECT 1 FROM public.sponsor_businesses WHERE id=p_business_id AND production_id=p_production_id AND user_id=auth.uid()) OR public.bts_private_record_permission(p_production_id,'marketing.sponsors',2)) THEN RAISE EXCEPTION 'This submission belongs to another account.';END IF;IF NOT public.bts_private_record_permission(p_production_id,'marketing.sponsors',2) THEN p_payment_status:=NULL;END IF; result:=bts_private.finalize_sponsor_submission(p_production_id,p_business_id,p_kind,p_website,p_notes,p_artwork_status,p_files,p_artwork_data,p_payment_status);  RETURN result;END;
$wrapper$;
REVOKE ALL ON FUNCTION public.finalize_sponsor_submission(uuid,uuid,text,text,text,text,jsonb,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finalize_sponsor_submission(uuid,uuid,text,text,text,text,jsonb,jsonb,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.lookup_email_by_bts_id(bts_id text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT u.email FROM public.member_ids m JOIN auth.users u ON u.id=m.user_id WHERE m.display_id=bts_id AND m.user_id=auth.uid() AND public.bts_account_is_active(); $$;
REVOKE ALL ON FUNCTION public.lookup_email_by_bts_id(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.lookup_email_by_bts_id(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_slot_booked_counts(p_production_id uuid) RETURNS TABLE(slot_id uuid,total_booked bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT slot_id,booked_count FROM public.bts_public_audition_availability(p_production_id); $$;
CREATE OR REPLACE FUNCTION public.public_production_contact(p_production_id uuid) RETURNS TABLE(name text,role text,email text,phone text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT o.name,'Production contact'::text,o.email,o.phone FROM public.productions p JOIN public.organizations o ON o.id=p.organization_id WHERE p.id=p_production_id AND p.is_public AND p.page_status IN ('live','hidden') AND o.show_contact; $$;
CREATE OR REPLACE FUNCTION public.get_public_proposal_page(p_intake_key text, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_intake public.production_proposal_intakes%rowtype;
  v_org public.organizations%rowtype;
begin
  select *
  into v_intake
  from public.production_proposal_intakes
  where id::text = p_intake_key
    and access_token = p_token
  limit 1;

  if v_intake.id is null then
    raise exception 'Proposal intake not found'
      using errcode = 'P0001';
  end if;

  select *
  into v_org
  from public.organizations
  where id = v_intake.organization_id
  limit 1;

  if v_org.id is null then
    raise exception 'Organization not found'
      using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'organization', jsonb_build_object(
      'id', v_org.id,
      'name', v_org.name,
      'slug', v_org.slug,
      'abbreviation', v_org.abbreviation,
      'logo_url', v_org.logo_url,
      'logo_white_url', v_org.logo_white_url,
      'payment_settings', '{}'::jsonb
    ),
    'intake', jsonb_build_object(
      'id', v_intake.id,
      'title', v_intake.title,
      'season_label', v_intake.season_label,
      'description', v_intake.description,
      'is_open', v_intake.is_open,
      'closes_at', v_intake.closes_at,
      'projects', coalesce(v_intake.projects, '[]'::jsonb),
      'form_config', v_intake.form_config
    )
  );
end;
$function$
;
REVOKE ALL ON FUNCTION public.lock_organization_slug() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.set_production_audition_observations_updated_at() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.production_proposals_set_updated_at() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.production_proposal_intakes_set_updated_at() FROM PUBLIC,anon,authenticated;

-- Participant read models omit staff notes, payer references and internal assessments.
DROP POLICY own_cast_registration_read ON public.cast_members;
DROP POLICY own_registration_payments_read ON public.registration_payment_records;
DROP POLICY own_household_payments_read ON public.household_payment_logs;
CREATE VIEW public.bts_participant_cast_members WITH(security_barrier=true) AS SELECT id,production_id,applicant_id,character_id,date_of_birth,registration_answers,created_at,updated_at,casting_assignment_id,accepted_at,character_name,state,name,preferred_name,pronouns,email,phone,guardian_name,guardian_email,guardian_phone,headshot_url,role_key,role_type,source_table FROM public.cast_members WHERE public.bts_owns_audition(production_id,applicant_id) OR public.bts_private_record_permission(production_id,'cast_list',1) WITH LOCAL CHECK OPTION;
GRANT SELECT,UPDATE ON public.bts_participant_cast_members TO authenticated;
CREATE VIEW public.bts_participant_payment_records WITH(security_barrier=true) AS SELECT r.id,r.production_id,r.casting_assignment_id,r.installment_index,r.paid,r.paid_at,r.updated_at,r.amount_cents,r.payment_method FROM public.registration_payment_records r WHERE public.bts_private_record_permission(r.production_id,'registration.payments',1) OR EXISTS(SELECT 1 FROM public.casting_assignments a WHERE a.id=r.casting_assignment_id AND a.production_id=r.production_id AND public.bts_owns_audition(a.production_id,a.applicant_id));
GRANT SELECT ON public.bts_participant_payment_records TO authenticated;
CREATE VIEW public.bts_participant_household_payments WITH(security_barrier=true) AS SELECT r.id,r.production_id,r.amount_cents,r.paid_at,r.installment_index,r.created_at,r.updated_at,r.household_id,r.payment_method FROM public.household_payment_logs r WHERE public.bts_private_record_permission(r.production_id,'registration.payments',1) OR EXISTS(SELECT 1 FROM jsonb_array_elements(public.bts_owned_households(r.production_id)) h WHERE h->>'id'=r.household_id);
GRANT SELECT ON public.bts_participant_household_payments TO authenticated;

-- These buckets contain personal records or unpublished working files. Public URLs cease to authorise reads.
UPDATE storage.buckets SET public=false WHERE id IN ('org-files','production-files','audition-headshots','receipts','proposal-attachments','profile-headshots','programme-ads');
CREATE FUNCTION public.bts_file_permission(p_bucket text,p_name text,p_rank integer)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE first_id uuid:=public.try_uuid(split_part(p_name,'/',1)); prod_id uuid; org_id uuid; app_id uuid;
BEGIN
 IF p_rank NOT BETWEEN 1 AND 3 THEN RETURN false;END IF;
 IF p_bucket IN ('org-logos','org-banners','production-posters','past-posters') AND p_rank=1 THEN RETURN true; END IF;
 -- Published audition materials are the only anonymously readable files in the working-files bucket.
 IF p_bucket='production-files' AND p_rank=1 AND EXISTS(
 SELECT 1 FROM public.production_characters c JOIN public.productions p ON p.id=c.production_id
 WHERE p.id=first_id AND p.is_public AND p.page_status IN ('live','hidden') AND c.show_on_public_page AND EXISTS(SELECT 1 FROM public.production_files f WHERE f.production_id=p.id AND f.file_path=p_name AND (f.tags @> ARRAY['audition material']::text[] OR f.document_type='audition'))
 AND EXISTS(SELECT 1 FROM jsonb_each_text(to_jsonb(c)) kv WHERE kv.key LIKE 'audition_%' AND (kv.value=p_name OR kv.value LIKE '%/storage/v1/object/public/production-files/'||p_name))) THEN RETURN true;END IF;
 IF p_bucket='programme-ads' AND p_rank=1 AND EXISTS(SELECT 1 FROM public.programme_ads a WHERE a.production_id=first_id AND a.approval_status='approved' AND a.artwork_url LIKE '%/storage/v1/object/public/programme-ads/'||p_name) THEN RETURN true;END IF;
 IF NOT public.bts_account_is_active() THEN RETURN false;END IF;
 IF p_bucket='profile-headshots' THEN
  IF first_id=auth.uid() THEN RETURN true;END IF;
  RETURN p_rank=1 AND EXISTS(SELECT 1 FROM public.audition_applications a WHERE a.user_id=first_id AND (a.headshot_url LIKE '%/storage/v1/object/public/profile-headshots/'||p_name OR a.file_url LIKE '%/storage/v1/object/public/profile-headshots/'||p_name) AND public.bts_private_record_permission(a.production_id,'auditions.general',1));
 ELSIF p_bucket='production-files' THEN
  IF public.bts_private_record_permission(first_id,'overview',p_rank) THEN RETURN true;END IF;
  IF p_rank=1 AND public.bts_private_record_permission(first_id,'auditions.general',1) AND EXISTS(SELECT 1 FROM public.production_files WHERE production_id=first_id AND file_path=p_name AND document_type IN ('audition','callback')) THEN RETURN true;END IF;
  IF p_rank=1 AND public.bts_callback_access(first_id) AND EXISTS(SELECT 1 FROM public.bts_callback_files WHERE production_id=first_id AND file_path=p_name) THEN RETURN true;END IF;
  IF split_part(p_name,'/',2)='registrations' THEN
   app_id:=public.try_uuid(split_part(split_part(p_name,'/',3),'.',1));
   RETURN public.bts_owns_audition(first_id,app_id);
  END IF;
  RETURN false;
 ELSIF p_bucket='receipts' THEN RETURN public.bts_private_record_permission(first_id,'budget.receipts',p_rank);
 ELSIF p_bucket='org-files' OR p_bucket='venue-photos' OR p_bucket='org-logos' OR p_bucket='org-banners' THEN
  RETURN public.bts_organisation_role(first_id) IN ('owner','admin') OR (p_rank<3 AND public.bts_organisation_role(first_id)='editor') OR (p_rank=1 AND public.bts_organisation_role(first_id)='viewer') OR first_id=auth.uid();
 ELSIF p_bucket='production-posters' THEN RETURN public.bts_production_page_permission(first_id,'settings.details',greatest(p_rank,2)) OR first_id=auth.uid();
 ELSIF p_bucket='past-posters' THEN RETURN public.bts_organisation_role(first_id) IN ('owner','admin','editor');
 ELSIF p_bucket='audition-headshots' THEN RETURN first_id=auth.uid() OR public.bts_private_record_permission(first_id,'auditions.general',p_rank);
 ELSIF p_bucket='proposal-attachments' THEN
  IF first_id=auth.uid() THEN RETURN true;END IF;
  IF split_part(p_name,'/',2)='proposals' THEN SELECT organization_id INTO org_id FROM public.production_proposal_intakes WHERE id=public.try_uuid(split_part(p_name,'/',3)); RETURN public.bts_organisation_role(org_id) IN ('owner','admin','editor');END IF;
  IF split_part(p_name,'/',1)='proposals' THEN
   SELECT organization_id INTO org_id FROM public.production_proposal_intakes WHERE id=public.try_uuid(split_part(p_name,'/',2));
   RETURN public.bts_organisation_role(org_id) IN ('owner','admin','editor');
  END IF;RETURN false;
 ELSIF p_bucket='programme-ads' THEN
  RETURN public.bts_private_record_permission(first_id,'marketing.sponsors',p_rank) OR EXISTS(SELECT 1 FROM public.sponsor_businesses b WHERE b.id=public.try_uuid(split_part(p_name,'/',2)) AND b.production_id=first_id AND b.user_id=auth.uid());
 END IF;
 RETURN false;
END $$;
-- Restrictive policies apply even if a historical permissive policy remains.
CREATE POLICY private_file_read_boundary ON storage.objects AS RESTRICTIVE FOR SELECT TO public USING(public.bts_file_permission(bucket_id,name,1));
CREATE POLICY private_file_insert_boundary ON storage.objects AS RESTRICTIVE FOR INSERT TO public WITH CHECK(public.bts_file_permission(bucket_id,name,2));
CREATE POLICY private_file_update_boundary ON storage.objects AS RESTRICTIVE FOR UPDATE TO public USING(public.bts_file_permission(bucket_id,name,2)) WITH CHECK(public.bts_file_permission(bucket_id,name,2));
CREATE POLICY private_file_delete_boundary ON storage.objects AS RESTRICTIVE FOR DELETE TO public USING(public.bts_file_permission(bucket_id,name,3));
CREATE POLICY scoped_file_read ON storage.objects FOR SELECT TO public USING(public.bts_file_permission(bucket_id,name,1));
CREATE POLICY scoped_file_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(public.bts_file_permission(bucket_id,name,2));
CREATE POLICY scoped_file_update ON storage.objects FOR UPDATE TO authenticated USING(public.bts_file_permission(bucket_id,name,2)) WITH CHECK(public.bts_file_permission(bucket_id,name,2));
CREATE POLICY scoped_file_delete ON storage.objects FOR DELETE TO authenticated USING(public.bts_file_permission(bucket_id,name,3));
CREATE OR REPLACE FUNCTION public.bts_can_read_profile_file(p_name text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT public.bts_file_permission('profile-headshots',p_name,1); $$;
REVOKE ALL ON FUNCTION public.bts_file_permission(text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bts_file_permission(text,text,integer) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_owns_audition(uuid,uuid),public.bts_is_production_participant(uuid),public.bts_production_staff(uuid),public.bts_owned_households(uuid),public.bts_private_record_permission(uuid,text,integer),public.bts_organisation_role(uuid) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.bts_respond_cast_offer(uuid,uuid[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bts_respond_cast_offer(uuid,uuid[],text) TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.production_access_audit_log FROM authenticated;
CREATE VIEW public.bts_visible_past_shows WITH(security_barrier=true) AS SELECT t.* FROM public.past_shows t WHERE EXISTS(SELECT 1 FROM public.bts_visible_organizations o WHERE o.id=t.organization_id);
GRANT SELECT ON public.bts_visible_past_shows TO anon,authenticated;
REVOKE ALL ON FUNCTION public.bts_refresh_cast_members_from_booking() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bts_refresh_cast_members_from_character() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bts_script_breakdown_touch_updated_at() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bts_cast_member_touch_updated_at() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bts_upsert_cast_member_from_assignment(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bts_sync_cast_member_assignment_trigger() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bts_refresh_cast_members_from_application() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bts_audition_accepts_public(p_production_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.productions p WHERE p.id=p_production_id AND p.is_public AND p.page_status IN ('live','hidden') AND NOT EXISTS(SELECT 1 FROM public.audition_configs c WHERE c.production_id=p.id AND NOT c.is_open));
$$;
GRANT EXECUTE ON FUNCTION public.bts_audition_accepts_public(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION bts_private.guard_audition_account()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE staff boolean; dob date; before_row jsonb; after_row jsonb; changed text; assignment jsonb; file_value text;
BEGIN
  -- Trusted database/service operations remain available; browser roles cannot
  -- opt into this branch using a form field or editable user metadata.
  IF current_user NOT IN ('anon','authenticated') THEN RETURN NEW; END IF;
  IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with your adult account before submitting audition information.'; END IF;
  staff:=public.bts_audition_record_permission(NEW.production_id,'auditions.general',2);
  IF TG_OP='UPDATE' THEN
    staff:=staff OR public.bts_audition_record_permission(NEW.production_id,'auditions.schedule',2)
      OR public.bts_audition_record_permission(NEW.production_id,'auditions.dashboard',2)
      OR public.bts_audition_record_permission(NEW.production_id,'auditions.callback',2)
      OR public.bts_audition_record_permission(NEW.production_id,'auditions.casting_board',2)
      OR public.bts_audition_record_permission(NEW.production_id,'auditions.final_casting',2);
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.production_id IS DISTINCT FROM OLD.production_id
      OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
      OR NEW.guardian_user_id IS DISTINCT FROM OLD.guardian_user_id
      OR NEW.guardian_consent_at IS DISTINCT FROM OLD.guardian_consent_at
      OR NEW.guardian_consent_version IS DISTINCT FROM OLD.guardian_consent_version THEN
      RAISE EXCEPTION 'Account ownership and guardian records cannot be reassigned from a form.';
    END IF;
    IF NOT staff AND OLD.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'This audition record does not belong to your account.'; END IF;
    before_row:=to_jsonb(OLD); after_row:=to_jsonb(NEW);
    FOR changed IN SELECT key FROM jsonb_each(after_row) WHERE value IS DISTINCT FROM before_row->key LOOP
      IF changed IN ('status','character_id') AND NOT public.bts_audition_record_permission(NEW.production_id,'auditions.casting_board',2)
        AND NOT public.bts_audition_record_permission(NEW.production_id,'auditions.final_casting',2)
        AND NOT (OLD.user_id=auth.uid() AND changed='status' AND NEW.status IN ('cancelled','withdrawn')) THEN
        RAISE EXCEPTION 'Only authorised casting staff can change casting decisions.';
      END IF;
      IF changed IN ('org_notes','checked_in','checked_in_at','session_checkins','callback_status','callback_notes','callback_rating','callback_group_id') THEN
        IF NOT public.bts_audition_record_permission(NEW.production_id,
          CASE WHEN changed LIKE 'callback%' THEN 'auditions.callback' WHEN changed IN ('checked_in','checked_in_at','session_checkins') THEN 'auditions.dashboard' ELSE 'auditions.general' END,2) THEN
          RAISE EXCEPTION 'That field can only be changed by authorised production staff.';
        END IF;
      END IF;
      IF staff AND changed IN ('slot_id','time_slot_id','session_id','slot_assignments')
        AND NOT public.bts_audition_record_permission(NEW.production_id,'auditions.schedule',2) THEN
        RAISE EXCEPTION 'Schedule changes require schedule access.';
      END IF;
      IF OLD.user_id IS DISTINCT FROM auth.uid()
        AND changed <> ALL(ARRAY['status','character_id','org_notes','checked_in','checked_in_at','session_checkins','callback_status','callback_notes','callback_rating','callback_group_id','slot_id','time_slot_id','session_id','slot_assignments'])
        AND NOT public.bts_audition_record_permission(NEW.production_id,'auditions.general',2) THEN
        RAISE EXCEPTION 'Performer detail changes require edit access to general auditions.';
      END IF;
    END LOOP;
  ELSE
    IF NOT staff THEN NEW.user_id:=auth.uid();
    ELSIF NEW.user_id IS NOT NULL AND NEW.user_id<>auth.uid() THEN
      RAISE EXCEPTION 'Use the reviewed account-linking process for another person.';
    END IF;
    IF NEW.status IS DISTINCT FROM 'pending' THEN RAISE EXCEPTION 'New public applications start as pending.'; END IF;
    IF NOT staff AND NOT public.bts_audition_accepts_public(NEW.production_id) THEN
      RAISE EXCEPTION 'This production is not accepting public applications.';
    END IF;
    IF TG_TABLE_NAME='audition_applications' THEN
      after_row:=to_jsonb(NEW);
      IF coalesce((after_row->>'checked_in')::boolean,false) OR after_row->>'org_notes' IS NOT NULL
        OR after_row->>'character_id' IS NOT NULL OR coalesce(after_row->>'callback_status','none')<>'none'
        OR after_row->>'callback_notes' IS NOT NULL OR coalesce(after_row->'callback_rating','{}'::jsonb)<>'{}'::jsonb THEN
        RAISE EXCEPTION 'Staff assessment fields cannot be supplied on an application.';
      END IF;
    END IF;
  END IF;
  IF NEW.user_id=auth.uid() AND (TG_OP='INSERT' OR NEW.custom_answers IS DISTINCT FROM OLD.custom_answers) THEN
    dob:=public.bts_parse_performer_birth_date(NEW.custom_answers->>'Date of Birth');
    IF dob IS NULL OR dob>current_date OR dob<(current_date-interval '120 years')::date THEN RAISE EXCEPTION 'Enter a valid performer birth date.'; END IF;
    IF dob>(current_date-interval '18 years')::date THEN
      IF TG_OP='INSERT' OR OLD.guardian_user_id IS DISTINCT FROM auth.uid() OR OLD.guardian_consent_at IS NULL THEN
        IF NEW.custom_answers->>'__bts_guardian_confirmed' IS DISTINCT FROM 'true'
          OR nullif(trim(NEW.custom_answers->>'Guardian Name'),'') IS NULL THEN
          RAISE EXCEPTION 'The adult account holder must confirm they are the child''s parent or legal guardian.';
        END IF;
        NEW.guardian_user_id:=auth.uid(); NEW.guardian_consent_at:=now(); NEW.guardian_consent_version:='2026-11-15-auditions';
      END IF;
    ELSIF TG_OP='INSERT' THEN NEW.guardian_user_id:=NULL; NEW.guardian_consent_at:=NULL; NEW.guardian_consent_version:=NULL;
    END IF;
  ELSIF TG_OP='INSERT' THEN NEW.guardian_user_id:=NULL; NEW.guardian_consent_at:=NULL; NEW.guardian_consent_version:=NULL;
  END IF;
  IF NOT staff THEN
    after_row:=to_jsonb(NEW);
    IF NEW.session_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.bts_visible_audition_sessions s
      WHERE s.id=NEW.session_id AND s.production_id=NEW.production_id) THEN RAISE EXCEPTION 'Choose an audition session for this production.'; END IF;
    IF NEW.slot_id IS NOT NULL THEN
      IF TG_TABLE_NAME='audition_bookings' THEN
        IF NOT EXISTS(SELECT 1 FROM public.bts_visible_audition_time_slots ts JOIN public.bts_visible_audition_sessions s ON s.id=ts.session_id
          WHERE ts.id=NEW.slot_id AND s.id=NEW.session_id AND s.production_id=NEW.production_id) THEN
          RAISE EXCEPTION 'Choose an audition time for this production.';
        END IF;
      ELSIF EXISTS(SELECT 1 FROM public.bts_visible_audition_time_slots ts JOIN public.bts_visible_audition_sessions s ON s.id=ts.session_id
        WHERE ts.id=NEW.slot_id AND s.production_id=NEW.production_id) THEN
        -- Legacy clients put modern time-slot IDs in the legacy slot column.
        NEW.time_slot_id:=NEW.slot_id; NEW.slot_id:=NULL;
      ELSIF NOT EXISTS(SELECT 1 FROM public.bts_visible_audition_slots s WHERE s.id=NEW.slot_id AND s.production_id=NEW.production_id) THEN
        RAISE EXCEPTION 'Choose an audition time for this production.';
      END IF;
    END IF;
    FOR assignment IN SELECT value FROM jsonb_array_elements(
      CASE WHEN TG_TABLE_NAME='audition_applications' AND jsonb_typeof(after_row->'slot_assignments')='array' THEN after_row->'slot_assignments'
      ELSE '[]'::jsonb END) LOOP
      IF NOT EXISTS(SELECT 1 FROM public.bts_visible_audition_time_slots ts JOIN public.bts_visible_audition_sessions s ON s.id=ts.session_id
        WHERE ts.id=(assignment->>'slot_id')::uuid AND s.id=(assignment->>'session_id')::uuid AND s.production_id=NEW.production_id) THEN
        RAISE EXCEPTION 'Choose an audition time for this production.';
      END IF;
    END LOOP;
    FOREACH changed IN ARRAY ARRAY['headshot_url','file_url'] LOOP
      file_value:=after_row->>changed;
      IF file_value LIKE 'https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/%'
        AND file_value NOT LIKE 'https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/v1/object/public/profile-headshots/'||auth.uid()::text||'/%'
        AND (TG_OP='INSERT' OR file_value IS DISTINCT FROM to_jsonb(OLD)->>changed) THEN
        RAISE EXCEPTION 'Upload files through your own adult account.';
      END IF;
    END LOOP;
  END IF;
  IF NEW.profile_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=NEW.profile_id
    AND p.user_id=auth.uid() AND (p.account_id IS NULL OR p.account_id=auth.uid())) THEN
    RAISE EXCEPTION 'Choose a performer profile managed by your own account.';
  END IF;
  RETURN NEW;
END;
$function$
;

-- Clear inherited default grants explicitly; projections must not acquire DELETE/INSERT accidentally.
REVOKE ALL ON public.bts_participant_casting FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bts_participant_casting TO authenticated;
REVOKE ALL ON public.bts_visible_productions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bts_visible_productions TO anon,authenticated;
REVOKE ALL ON public.bts_visible_organizations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bts_visible_organizations TO anon,authenticated;
REVOKE ALL ON public.bts_visible_production_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bts_visible_production_events TO anon,authenticated;
REVOKE ALL ON public.bts_visible_characters FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bts_visible_characters TO anon,authenticated;
REVOKE ALL ON public.bts_visible_venues FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bts_visible_venues TO anon,authenticated;
REVOKE ALL ON public.bts_visible_audition_sessions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bts_visible_audition_sessions TO anon,authenticated;
REVOKE ALL ON public.bts_visible_audition_configs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bts_visible_audition_configs TO anon,authenticated;
REVOKE ALL ON public.bts_visible_audition_custom_questions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bts_visible_audition_custom_questions TO anon,authenticated;
REVOKE ALL ON public.bts_visible_audition_slots FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bts_visible_audition_slots TO anon,authenticated;
REVOKE ALL ON public.bts_callback_files FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bts_callback_files TO authenticated;
REVOKE ALL ON public.bts_visible_audition_time_slots FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bts_visible_audition_time_slots TO anon,authenticated;
REVOKE ALL ON public.bts_visible_opportunities FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bts_visible_opportunities TO anon,authenticated;
REVOKE ALL ON public.bts_participant_cast_members FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bts_participant_cast_members TO authenticated;
GRANT UPDATE ON public.bts_participant_cast_members TO authenticated;
REVOKE ALL ON public.bts_participant_payment_records FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bts_participant_payment_records TO authenticated;
REVOKE ALL ON public.bts_participant_household_payments FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bts_participant_household_payments TO authenticated;
REVOKE ALL ON public.bts_visible_past_shows FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bts_visible_past_shows TO anon,authenticated;
REVOKE ALL ON public.bts_participant_applications FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bts_participant_applications TO anon,authenticated;
GRANT INSERT,UPDATE ON public.bts_participant_applications TO authenticated;
REVOKE ALL ON public.bts_participant_bookings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bts_participant_bookings TO anon,authenticated;
GRANT INSERT,UPDATE ON public.bts_participant_bookings TO authenticated;
REVOKE ALL ON public.bts_participant_volunteers FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bts_participant_volunteers TO anon,authenticated;
GRANT UPDATE ON public.bts_participant_volunteers TO authenticated;
REVOKE ALL ON public.profiles FROM PUBLIC,anon;
REVOKE ALL ON public.org_members FROM PUBLIC,anon;
REVOKE ALL ON public.org_invitations FROM PUBLIC,anon;
REVOKE ALL ON public.member_ids FROM PUBLIC,anon;
REVOKE ALL ON public.audition_applications FROM PUBLIC,anon;
REVOKE ALL ON public.audition_bookings FROM PUBLIC,anon;
REVOKE ALL ON public.production_team_members FROM PUBLIC,anon;
REVOKE ALL ON public.production_team_member_sessions FROM PUBLIC,anon;
REVOKE ALL ON public.production_team_member_page_permissions FROM PUBLIC,anon;
REVOKE ALL ON public.production_team_member_special_permissions FROM PUBLIC,anon;
REVOKE ALL ON public.production_audition_notes FROM PUBLIC,anon;
REVOKE ALL ON public.production_audition_observations FROM PUBLIC,anon;
REVOKE ALL ON public.production_audition_live_events FROM PUBLIC,anon;
REVOKE ALL ON public.production_audition_live_state FROM PUBLIC,anon;
REVOKE ALL ON public.production_audition_room_states FROM PUBLIC,anon;
REVOKE ALL ON public.production_room_next_signals FROM PUBLIC,anon;
REVOKE ALL ON public.team_notes FROM PUBLIC,anon;
REVOKE ALL ON public.volunteer_signups FROM PUBLIC,anon;
DO $browser_grants$ DECLARE t record; BEGIN
 FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname<>ALL(ARRAY['ticket_types','ticket_orders','venue_layouts','venue_sections','venue_rows','venue_seats','performance_seat_inventory','seat_holds','tickets','scan_events']) LOOP
 EXECUTE format('REVOKE TRUNCATE,REFERENCES,TRIGGER ON public.%I FROM PUBLIC,anon,authenticated',t.relname);
 END LOOP;
END $browser_grants$;

-- Historical profile-linked applications have the same family boundary as modern submissions.
DO $legacy_app$ DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='applications' LOOP EXECUTE format('DROP POLICY %I ON public.applications',p.policyname);END LOOP;END $legacy_app$;
CREATE FUNCTION public.bts_legacy_application_access(p_profile_id uuid,p_audition_id uuid,p_rank integer) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.bts_account_is_active() AND (EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_profile_id AND p.user_id=auth.uid() AND p.deleted_at IS NULL) OR EXISTS(SELECT 1 FROM public.auditions a WHERE a.id=p_audition_id AND public.bts_production_page_permission(a.production_id,'auditions.general',p_rank)));
$$;
REVOKE ALL ON FUNCTION public.bts_legacy_application_access(uuid,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bts_legacy_application_access(uuid,uuid,integer) TO authenticated;
CREATE POLICY legacy_app_read ON public.applications FOR SELECT TO authenticated USING(public.bts_legacy_application_access(profile_id,audition_id,1));
CREATE POLICY legacy_app_insert ON public.applications FOR INSERT TO authenticated WITH CHECK(public.bts_legacy_application_access(profile_id,audition_id,2) AND status='pending');
CREATE POLICY legacy_app_update ON public.applications FOR UPDATE TO authenticated USING(public.bts_legacy_application_access(profile_id,audition_id,2)) WITH CHECK(public.bts_legacy_application_access(profile_id,audition_id,2));
CREATE POLICY legacy_app_delete ON public.applications FOR DELETE TO authenticated USING(public.bts_legacy_application_access(profile_id,audition_id,3) AND status='pending');
CREATE FUNCTION bts_private.guard_legacy_application() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF current_user NOT IN ('anon','authenticated') THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.profile_id IS DISTINCT FROM OLD.profile_id OR NEW.audition_id IS DISTINCT FROM OLD.audition_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'Application ownership cannot be reassigned.';END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.auditions a WHERE a.id=NEW.audition_id AND public.bts_production_page_permission(a.production_id,'auditions.general',2)) AND NEW.status IS DISTINCT FROM 'pending' THEN RAISE EXCEPTION 'Only staff can change application decisions.';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER legacy_application_boundary BEFORE INSERT OR UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION bts_private.guard_legacy_application();
COMMIT;
