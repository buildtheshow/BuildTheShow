-- First audition cutover: safe availability plus account-bound writes.
-- Read-policy cutover is separate; this does not certify all participant portals.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='45s';
ALTER TABLE public.audition_bookings ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.audition_bookings ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['audition_applications','audition_bookings'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS guardian_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL',t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS guardian_consent_at timestamptz',t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS guardian_consent_version text',t);
    EXECUTE format('REVOKE INSERT,UPDATE,DELETE ON public.%I FROM anon',t);
  END LOOP;
END $$;

CREATE FUNCTION public.bts_audition_record_permission(p_production_id uuid,p_page text,p_rank integer)
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
REVOKE ALL ON FUNCTION public.bts_audition_record_permission(uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bts_audition_record_permission(uuid,text,integer) TO authenticated;

CREATE FUNCTION bts_private.guard_audition_account()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
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
    IF NOT staff AND NOT EXISTS(SELECT 1 FROM public.productions p WHERE p.id=NEW.production_id
      AND p.is_public AND p.page_status IN ('live','hidden')
      AND NOT EXISTS(SELECT 1 FROM public.audition_configs c WHERE c.production_id=p.id AND NOT c.is_open)) THEN
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
    IF NEW.session_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.audition_sessions s
      WHERE s.id=NEW.session_id AND s.production_id=NEW.production_id) THEN RAISE EXCEPTION 'Choose an audition session for this production.'; END IF;
    IF NEW.slot_id IS NOT NULL THEN
      IF TG_TABLE_NAME='audition_bookings' THEN
        IF NOT EXISTS(SELECT 1 FROM public.audition_time_slots ts JOIN public.audition_sessions s ON s.id=ts.session_id
          WHERE ts.id=NEW.slot_id AND s.id=NEW.session_id AND s.production_id=NEW.production_id) THEN
          RAISE EXCEPTION 'Choose an audition time for this production.';
        END IF;
      ELSIF EXISTS(SELECT 1 FROM public.audition_time_slots ts JOIN public.audition_sessions s ON s.id=ts.session_id
        WHERE ts.id=NEW.slot_id AND s.production_id=NEW.production_id) THEN
        -- Legacy clients put modern time-slot IDs in the legacy slot column.
        NEW.time_slot_id:=NEW.slot_id; NEW.slot_id:=NULL;
      ELSIF NOT EXISTS(SELECT 1 FROM public.audition_slots s WHERE s.id=NEW.slot_id AND s.production_id=NEW.production_id) THEN
        RAISE EXCEPTION 'Choose an audition time for this production.';
      END IF;
    END IF;
    FOR assignment IN SELECT value FROM jsonb_array_elements(
      CASE WHEN TG_TABLE_NAME='audition_applications' AND jsonb_typeof(after_row->'slot_assignments')='array' THEN after_row->'slot_assignments'
      ELSE '[]'::jsonb END) LOOP
      IF NOT EXISTS(SELECT 1 FROM public.audition_time_slots ts JOIN public.audition_sessions s ON s.id=ts.session_id
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
$$;
REVOKE ALL ON FUNCTION bts_private.guard_audition_account() FROM PUBLIC,anon,authenticated;
-- The private parser is called by the invoker trigger, so expose only a safe
-- parser wrapper rather than granting access to the private schema.
CREATE FUNCTION public.bts_parse_performer_birth_date(p_value text) RETURNS date
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path='' AS $$ SELECT bts_private.parse_birth_date(p_value); $$;
REVOKE ALL ON FUNCTION public.bts_parse_performer_birth_date(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bts_parse_performer_birth_date(text) TO authenticated;
CREATE TRIGGER bts_guard_audition_account BEFORE INSERT OR UPDATE ON public.audition_applications
FOR EACH ROW EXECUTE FUNCTION bts_private.guard_audition_account();
CREATE TRIGGER bts_guard_audition_account BEFORE INSERT OR UPDATE ON public.audition_bookings
FOR EACH ROW EXECUTE FUNCTION bts_private.guard_audition_account();

DO $$ DECLARE t text; edit_condition text; BEGIN
  edit_condition:='public.bts_audition_record_permission(production_id,''auditions.general'',2) OR public.bts_audition_record_permission(production_id,''auditions.schedule'',2) OR public.bts_audition_record_permission(production_id,''auditions.dashboard'',2) OR public.bts_audition_record_permission(production_id,''auditions.callback'',2) OR public.bts_audition_record_permission(production_id,''auditions.casting_board'',2) OR public.bts_audition_record_permission(production_id,''auditions.final_casting'',2)';
  FOREACH t IN ARRAY ARRAY['audition_applications','audition_bookings'] LOOP
    EXECUTE format('CREATE POLICY "Assigned staff or account owners may update audition records" ON public.%I FOR UPDATE TO authenticated USING(user_id=auth.uid() OR (%s)) WITH CHECK(user_id=auth.uid() OR (%s))',t,edit_condition,edit_condition);
    EXECUTE format('CREATE POLICY "Audition writes require account ownership or staff access" ON public.%I AS RESTRICTIVE FOR UPDATE TO public USING(public.bts_account_is_active() AND (user_id=auth.uid() OR (%s))) WITH CHECK(public.bts_account_is_active() AND (user_id=auth.uid() OR (%s)))',t,edit_condition,edit_condition);
    EXECUTE format('CREATE POLICY "Audition deletion requires production owner" ON public.%I AS RESTRICTIVE FOR DELETE TO public USING(public.bts_account_is_active() AND EXISTS(SELECT 1 FROM public.productions p WHERE p.id=%I.production_id AND public.bts_organisation_role(p.organization_id)=''owner''))',t,t);
  END LOOP;
END $$;

-- Public availability returns counts, never applicant identities or answers.
CREATE FUNCTION public.bts_public_audition_availability(p_production_id uuid)
RETURNS TABLE(slot_id uuid,session_id uuid,booked_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  WITH visible AS (
    SELECT p.id FROM public.productions p WHERE p.id=p_production_id AND p.is_public AND p.page_status IN ('live','hidden')
  ), assignments AS (
    SELECT a.id AS application_id,(x->>'slot_id')::uuid AS slot_id
    FROM public.audition_applications a
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(a.slot_assignments)='array' THEN a.slot_assignments ELSE '[]'::jsonb END) x
    WHERE a.production_id IN (SELECT id FROM visible) AND coalesce(a.status,'') !~* '(cancel|withdraw)'
      AND x->>'slot_id' ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    UNION SELECT a.id,coalesce(a.time_slot_id,a.slot_id) FROM public.audition_applications a
    WHERE a.production_id IN (SELECT id FROM visible) AND coalesce(a.status,'') !~* '(cancel|withdraw)'
  ), slots AS (
    SELECT s.id,s.session_id FROM public.audition_time_slots s JOIN public.audition_sessions a ON a.id=s.session_id
      WHERE a.production_id IN (SELECT id FROM visible) AND a.enabled AND a.show_to_applicants
    UNION SELECT s.id,NULL::uuid FROM public.audition_slots s WHERE s.production_id IN (SELECT id FROM visible)
  ) SELECT s.id,s.session_id,count(a.application_id) FROM slots s LEFT JOIN assignments a ON a.slot_id=s.id GROUP BY s.id,s.session_id;
$$;
REVOKE ALL ON FUNCTION public.bts_public_audition_availability(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bts_public_audition_availability(uuid) TO anon,authenticated;

-- Participant projections exclude staff assessments and server consent records.
GRANT EXECUTE ON FUNCTION public.bts_audition_record_permission(uuid,text,integer) TO anon;
REVOKE SELECT ON public.audition_applications FROM anon;
CREATE POLICY "Only assigned staff read base audition records" ON public.audition_applications AS RESTRICTIVE FOR SELECT TO public USING (public.bts_audition_record_permission(production_id,'auditions.general',1) OR public.bts_audition_record_permission(production_id,'auditions.dashboard',1) OR public.bts_audition_record_permission(production_id,'auditions.schedule',1) OR public.bts_audition_record_permission(production_id,'auditions.callback',1) OR public.bts_audition_record_permission(production_id,'auditions.dance_call',1) OR public.bts_audition_record_permission(production_id,'auditions.casting_board',1) OR public.bts_audition_record_permission(production_id,'auditions.final_casting',1));
CREATE POLICY "Assigned staff read audition records" ON public.audition_applications FOR SELECT TO authenticated USING (public.bts_audition_record_permission(production_id,'auditions.general',1) OR public.bts_audition_record_permission(production_id,'auditions.dashboard',1) OR public.bts_audition_record_permission(production_id,'auditions.schedule',1) OR public.bts_audition_record_permission(production_id,'auditions.callback',1) OR public.bts_audition_record_permission(production_id,'auditions.dance_call',1) OR public.bts_audition_record_permission(production_id,'auditions.casting_board',1) OR public.bts_audition_record_permission(production_id,'auditions.final_casting',1));
CREATE VIEW public.bts_participant_applications WITH (security_barrier=true) AS SELECT id,production_id,user_id,profile_id,name,email,phone,notes,headshot_url,role_interest,status,created_at,slot_id,experience,conflicts,skills,file_url,session_id,time_slot_id,experience_level,custom_answers,date_conflicts,slot_assignments,attendance_mode,audition_method,preferred_name,pronouns,booking_id,custom_answers->>'Date of Birth' AS date_of_birth,custom_answers->>'Date of Birth' AS dob,custom_answers->>'Performer Number' AS performer_number,custom_answers->>'__bts_portal_code' AS portal_code FROM public.audition_applications WHERE public.bts_account_is_active() AND (user_id=auth.uid() OR (public.bts_audition_record_permission(production_id,'auditions.general',1) OR public.bts_audition_record_permission(production_id,'auditions.dashboard',1) OR public.bts_audition_record_permission(production_id,'auditions.schedule',1) OR public.bts_audition_record_permission(production_id,'auditions.callback',1) OR public.bts_audition_record_permission(production_id,'auditions.dance_call',1) OR public.bts_audition_record_permission(production_id,'auditions.casting_board',1) OR public.bts_audition_record_permission(production_id,'auditions.final_casting',1))) WITH LOCAL CHECK OPTION;
REVOKE ALL ON public.bts_participant_applications FROM PUBLIC; GRANT SELECT ON public.bts_participant_applications TO anon; GRANT SELECT,INSERT,UPDATE ON public.bts_participant_applications TO authenticated;
REVOKE SELECT ON public.audition_bookings FROM anon;
CREATE POLICY "Only assigned staff read base audition records" ON public.audition_bookings AS RESTRICTIVE FOR SELECT TO public USING (public.bts_audition_record_permission(production_id,'auditions.general',1) OR public.bts_audition_record_permission(production_id,'auditions.dashboard',1) OR public.bts_audition_record_permission(production_id,'auditions.schedule',1) OR public.bts_audition_record_permission(production_id,'auditions.callback',1) OR public.bts_audition_record_permission(production_id,'auditions.dance_call',1) OR public.bts_audition_record_permission(production_id,'auditions.casting_board',1) OR public.bts_audition_record_permission(production_id,'auditions.final_casting',1));
CREATE POLICY "Assigned staff read audition records" ON public.audition_bookings FOR SELECT TO authenticated USING (public.bts_audition_record_permission(production_id,'auditions.general',1) OR public.bts_audition_record_permission(production_id,'auditions.dashboard',1) OR public.bts_audition_record_permission(production_id,'auditions.schedule',1) OR public.bts_audition_record_permission(production_id,'auditions.callback',1) OR public.bts_audition_record_permission(production_id,'auditions.dance_call',1) OR public.bts_audition_record_permission(production_id,'auditions.casting_board',1) OR public.bts_audition_record_permission(production_id,'auditions.final_casting',1));
CREATE VIEW public.bts_participant_bookings WITH (security_barrier=true) AS SELECT id,production_id,session_id,slot_id,user_id,profile_id,created_at,age,is_minor,custom_answers,name,email,phone,pronouns,contact_name,role_preference,gender_preference,roles_requested,guardian_name,guardian_email,headshot_url,status,attendance_mode,portal_code,custom_answers->>'Date of Birth' AS date_of_birth,custom_answers->>'Date of Birth' AS dob,custom_answers->>'Performer Number' AS performer_number FROM public.audition_bookings WHERE public.bts_account_is_active() AND (user_id=auth.uid() OR (public.bts_audition_record_permission(production_id,'auditions.general',1) OR public.bts_audition_record_permission(production_id,'auditions.dashboard',1) OR public.bts_audition_record_permission(production_id,'auditions.schedule',1) OR public.bts_audition_record_permission(production_id,'auditions.callback',1) OR public.bts_audition_record_permission(production_id,'auditions.dance_call',1) OR public.bts_audition_record_permission(production_id,'auditions.casting_board',1) OR public.bts_audition_record_permission(production_id,'auditions.final_casting',1))) WITH LOCAL CHECK OPTION;
REVOKE ALL ON public.bts_participant_bookings FROM PUBLIC; GRANT SELECT ON public.bts_participant_bookings TO anon; GRANT SELECT,INSERT,UPDATE ON public.bts_participant_bookings TO authenticated;
COMMIT;
