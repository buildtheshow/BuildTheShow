-- Adult-owned volunteer requests; codes select records but never authorise access.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='45s';
CREATE FUNCTION public.bts_production_page_permission(p_production_id uuid,p_page text,p_rank integer)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT p_rank BETWEEN 1 AND 3 AND public.bts_account_is_active() AND (
    EXISTS(SELECT 1 FROM public.productions p WHERE p.id=p_production_id
      AND public.bts_organisation_role(p.organization_id) IN ('owner','admin'))
    OR EXISTS(SELECT 1 FROM public.production_team_member_sessions s
      JOIN public.production_team_members m ON m.id=s.team_member_id AND m.production_id=s.production_id
      WHERE s.production_id=p_production_id AND s.auth_user_id=auth.uid()
        AND s.revoked_at IS NULL AND s.expires_at>now() AND m.is_active AND
        CASE WHEN m.access_level IN ('producer','admin','administrator','owner') THEN 3
        WHEN EXISTS(SELECT 1 FROM public.production_team_member_page_permissions pp WHERE pp.production_id=p_production_id AND pp.team_member_id=m.id)
          THEN coalesce((SELECT CASE pp.access_level WHEN 'manage' THEN 3 WHEN 'edit' THEN 2 WHEN 'view' THEN 1 ELSE 0 END
            FROM public.production_team_member_page_permissions pp WHERE pp.production_id=p_production_id AND pp.team_member_id=m.id AND pp.page_key=p_page),0)
        WHEN m.access_level IN ('creative','room') AND p_page='auditions.general' THEN 2
        WHEN m.access_level='check_in' AND p_page='auditions.dashboard' THEN 2
        WHEN m.access_level='schedule' AND p_page='auditions.schedule' THEN 2
        WHEN m.access_level IN ('creative','room','check_in','schedule','view_only')
          AND p_page IN ('auditions.general','auditions.dashboard','auditions.schedule') THEN 1 ELSE 0 END >= p_rank)
  );
$$;
REVOKE ALL ON FUNCTION public.bts_production_page_permission(uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bts_production_page_permission(uuid,text,integer) TO authenticated;


GRANT EXECUTE ON FUNCTION public.bts_production_page_permission(uuid,text,integer) TO anon;
-- Keep existing audition callers on the same canonical permission implementation.
CREATE OR REPLACE FUNCTION public.bts_audition_record_permission(p_production_id uuid,p_page text,p_rank integer)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.bts_production_page_permission(p_production_id,p_page,p_rank);
$$;
ALTER TABLE public.volunteer_signups ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.volunteer_signups ADD COLUMN guardian_details text;
ALTER TABLE public.volunteer_signups ADD COLUMN guardian_consent_at timestamptz;
ALTER TABLE public.volunteer_signups ADD COLUMN guardian_consent_version text;
CREATE INDEX volunteer_signups_account_idx ON public.volunteer_signups(user_id,production_id);
-- Legacy records remain unowned until an operator reviews an ownership request.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='volunteer_signups' LOOP
  EXECUTE format('DROP POLICY %I ON public.volunteer_signups',p.policyname);
 END LOOP;
END $$;
ALTER TABLE public.volunteer_signups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.volunteer_signups FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.volunteer_signups TO authenticated;
CREATE POLICY volunteer_staff_read ON public.volunteer_signups FOR SELECT TO authenticated USING(public.bts_production_page_permission(production_id,'volunteers',1));
CREATE POLICY volunteer_staff_insert ON public.volunteer_signups FOR INSERT TO authenticated WITH CHECK(public.bts_production_page_permission(production_id,'volunteers',2));
CREATE POLICY volunteer_staff_update ON public.volunteer_signups FOR UPDATE TO authenticated USING(public.bts_production_page_permission(production_id,'volunteers',2)) WITH CHECK(public.bts_production_page_permission(production_id,'volunteers',2));
CREATE POLICY volunteer_staff_delete ON public.volunteer_signups FOR DELETE TO authenticated USING(public.bts_production_page_permission(production_id,'volunteers',3));
CREATE FUNCTION bts_private.guard_volunteer_account() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE k text;
BEGIN
 IF current_user NOT IN ('anon','authenticated') THEN RETURN NEW; END IF;
 IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'An active adult account is required.'; END IF;
 IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.production_id IS DISTINCT FROM OLD.production_id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
  RAISE EXCEPTION 'Volunteer ownership cannot be reassigned here.';
 END IF;
 IF public.bts_production_page_permission(NEW.production_id,'volunteers',2) THEN
  IF TG_OP='UPDATE' AND (NEW.guardian_details IS DISTINCT FROM OLD.guardian_details OR NEW.guardian_consent_at IS DISTINCT FROM OLD.guardian_consent_at OR NEW.guardian_consent_version IS DISTINCT FROM OLD.guardian_consent_version) THEN RAISE EXCEPTION 'Guardian declarations cannot be rewritten by staff.'; END IF;
  IF TG_OP='INSERT' AND (NEW.user_id IS NOT NULL OR NEW.guardian_consent_at IS NOT NULL OR NEW.guardian_details IS NOT NULL OR NEW.guardian_consent_version IS NOT NULL) THEN RAISE EXCEPTION 'Staff cannot impersonate an account or guardian.'; END IF;
  IF EXISTS(SELECT 1 FROM public.bts_participant_volunteers v WHERE v.portal_token=NEW.portal_token AND v.production_id=NEW.production_id AND v.user_id IS DISTINCT FROM NEW.user_id) THEN RAISE EXCEPTION 'Schedules belonging to different accounts cannot be merged.'; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP<>'UPDATE' OR OLD.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'This volunteer request belongs to another account.'; END IF;
 FOR k IN SELECT key FROM jsonb_each(to_jsonb(NEW)) LOOP
  IF to_jsonb(NEW)->k IS DISTINCT FROM to_jsonb(OLD)->k AND k NOT IN ('name','first_name','last_name','volunteer_name','phone','notes','message','discount_requested','discount_performer','status') THEN RAISE EXCEPTION 'Only staff can change volunteer assignments or confirmed hours.'; END IF;
 END LOOP;
 IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IS DISTINCT FROM 'cancelled' THEN RAISE EXCEPTION 'Only staff can approve volunteer requests.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_volunteer_account BEFORE INSERT OR UPDATE ON public.volunteer_signups FOR EACH ROW EXECUTE FUNCTION bts_private.guard_volunteer_account();
CREATE VIEW public.bts_participant_volunteers WITH (security_barrier=true) AS
SELECT id,production_id,user_id,portal_token,name,email,phone,notes,status,role_name,department,shift_date,shift_start_time,shift_end_time,approved_hours,discount_requested,discount_performer,created_at,check_in_with,first_name,last_name,volunteer_name,volunteer_email,message,required_dates,volunteer_passcode,portal_invite_sent_at,no_email
FROM public.volunteer_signups WHERE public.bts_account_is_active() AND (user_id=auth.uid() OR public.bts_production_page_permission(production_id,'volunteers',1)) WITH LOCAL CHECK OPTION;
REVOKE ALL ON public.bts_participant_volunteers FROM PUBLIC;
GRANT SELECT ON public.bts_participant_volunteers TO anon,authenticated;
GRANT UPDATE ON public.bts_participant_volunteers TO authenticated;
CREATE FUNCTION public.bts_request_volunteer_shifts(p_production_id uuid,p_rows jsonb,p_guardian_details text DEFAULT NULL,p_guardian_confirmed boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb; token uuid; code text; account_email text;
BEGIN
 IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'An active adult account is required.'; END IF;
 IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Choose between 1 and 50 shifts.'; END IF;
 -- Serialise each account's submissions to enforce the abuse limit and group reuse.
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 IF (SELECT count(*) FROM public.volunteer_signups WHERE user_id=auth.uid() AND created_at>now()-interval '1 hour')+jsonb_array_length(p_rows)>100 THEN RAISE EXCEPTION 'Too many requests. Please try again later.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.productions WHERE id=p_production_id AND is_public AND page_status IN ('live','hidden')) THEN RAISE EXCEPTION 'This production is not accepting public requests.'; END IF;
 IF length(coalesce(p_guardian_details,''))>2000 OR (nullif(trim(p_guardian_details),'') IS NOT NULL AND p_guardian_confirmed IS NOT TRUE) THEN RAISE EXCEPTION 'Confirm that you are the parent or legal guardian.'; END IF;
 SELECT email INTO account_email FROM auth.users WHERE id=auth.uid();
 SELECT portal_token,volunteer_passcode INTO token,code FROM public.volunteer_signups WHERE production_id=p_production_id AND user_id=auth.uid() ORDER BY created_at LIMIT 1;
 token:=coalesce(token,gen_random_uuid()); code:=coalesce(code,lpad(floor(random()*1000000)::integer::text,6,'0'));
 FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  IF nullif(trim(r->>'name'),'') IS NULL OR length(r::text)>10000 OR nullif(trim(r->>'role_name'),'') IS NULL THEN RAISE EXCEPTION 'A volunteer name and requested role are required.'; END IF;
  INSERT INTO public.volunteer_signups(production_id,user_id,portal_token,volunteer_passcode,status,name,email,phone,notes,role_name,department,check_in_with,shift_date,shift_start_time,shift_end_time,required_dates,discount_requested,discount_performer,approved_hours,guardian_details,guardian_consent_at,guardian_consent_version)
  VALUES(p_production_id,auth.uid(),token,code,'pending',trim(r->>'name'),account_email,r->>'phone',r->>'notes',r->>'role_name',r->>'department',r->>'check_in_with',nullif(r->>'shift_date','')::date,nullif(r->>'shift_start_time','')::time,nullif(r->>'shift_end_time','')::time,ARRAY(SELECT jsonb_array_elements_text(coalesce(r->'required_dates','[]'::jsonb))),coalesce((r->>'discount_requested')::boolean,false),r->>'discount_performer',NULL,nullif(trim(p_guardian_details),''),CASE WHEN nullif(trim(p_guardian_details),'') IS NOT NULL THEN now() END,CASE WHEN nullif(trim(p_guardian_details),'') IS NOT NULL THEN '2026-11-16' END);
 END LOOP;
 RETURN jsonb_build_object('portal_token',token,'volunteer_passcode',code,'email',account_email,'count',jsonb_array_length(p_rows));
END $$;
REVOKE ALL ON FUNCTION public.bts_request_volunteer_shifts(uuid,jsonb,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bts_request_volunteer_shifts(uuid,jsonb,text,boolean) TO authenticated;
CREATE FUNCTION public.bts_public_volunteer_availability(p_production_id uuid)
RETURNS TABLE(role_name text,shift_date text,booked_count bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT v.role_name,d.day,count(*) FROM public.volunteer_signups v
 JOIN public.productions p ON p.id=v.production_id AND p.is_public AND p.page_status IN ('live','hidden')
 CROSS JOIN LATERAL (SELECT DISTINCT unnest(array_prepend(coalesce(v.shift_date::text,''),coalesce(v.required_dates,'{}'::text[]))) AS day) d
 WHERE v.production_id=p_production_id AND v.status IN ('pending','approved','partially_filled') GROUP BY v.role_name,d.day;
$$;
REVOKE ALL ON FUNCTION public.bts_public_volunteer_availability(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bts_public_volunteer_availability(uuid) TO anon,authenticated;
COMMIT;
