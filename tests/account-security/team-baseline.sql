-- Schema-only team tables and RPCs captured from production on 2026-11-15. No user rows.
CREATE TABLE public."production_team_member_special_permissions"("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid NOT NULL,"team_member_id" uuid NOT NULL,"permission_key" text NOT NULL,"granted_by" uuid,"updated_at" timestamptz DEFAULT now() NOT NULL);
ALTER TABLE public."production_team_member_special_permissions" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."production_team_member_special_permissions" TO anon,authenticated;
CREATE TABLE public."production_team_member_sessions"("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid NOT NULL,"team_member_id" uuid NOT NULL,"session_token" text NOT NULL,"user_agent" text,"created_at" timestamptz DEFAULT now() NOT NULL,"last_used_at" timestamptz DEFAULT now() NOT NULL,"expires_at" timestamptz DEFAULT (now() + '30 days'::interval) NOT NULL,"revoked_at" timestamptz);
ALTER TABLE public."production_team_member_sessions" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."production_team_member_sessions" TO anon,authenticated;
CREATE TABLE public."production_audition_live_state"("id" uuid DEFAULT gen_random_uuid() NOT NULL,"organization_id" uuid,"production_id" uuid NOT NULL,"session_id" uuid,"application_id" uuid,"room_key" text,"state_key" text NOT NULL,"state_type" text NOT NULL,"event_type" text,"status" text,"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,"updated_by" text,"updated_by_team_member_id" uuid,"created_at" timestamptz DEFAULT now() NOT NULL,"updated_at" timestamptz DEFAULT now() NOT NULL);
ALTER TABLE public."production_audition_live_state" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."production_audition_live_state" TO anon,authenticated;
CREATE TABLE public."production_characters"("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"name" text NOT NULL,"performer_count" int4 DEFAULT 1,"sort_order" int4 DEFAULT 0,"show_on_form" bool DEFAULT true,"show_on_public_page" bool DEFAULT true,"vocal_type" text,"vocal_range" text,"vocal_usage" text,"role_type" text,"gender" text,"age_range" text,"description" text,"singing_strength" text,"dancing_strength" text,"beginner_friendly" bool DEFAULT false,"audition_material" text,"callback_material" text,"created_at" timestamptz DEFAULT now(),"audition_file_url" text,"callback_file_url" text,"audition_file_path" text,"callback_file_path" text,"audition_file_name" text,"callback_file_name" text,"audition_side_url" text,"audition_side_path" text,"audition_side_name" text,"audition_songcut_url" text,"audition_songcut_path" text,"audition_songcut_name" text,"audition_other_url" text,"audition_other_path" text,"audition_other_name" text,"callback_side_url" text,"callback_side_path" text,"callback_side_name" text,"callback_songcut_url" text,"callback_songcut_path" text,"callback_songcut_name" text,"callback_other_url" text,"callback_other_path" text,"callback_other_name" text,"audition_side_notes" text,"audition_songcut_notes" text,"audition_other_notes" text,"callback_side_notes" text,"callback_songcut_notes" text,"callback_other_notes" text,"audition_material_types" jsonb DEFAULT '[]'::jsonb,"callback_material_types" jsonb DEFAULT '[]'::jsonb,"dance_call_file_url" text,"other_file_url" text,"dance_call_file_path" text,"other_file_path" text,"dance_call_file_name" text,"other_file_name" text,"dance_call_material_types" text[] DEFAULT '{}'::text[],"other_material_types" text[] DEFAULT '{}'::text[],"dance_call_side_url" text,"dance_call_side_path" text,"dance_call_side_name" text,"dance_call_songcut_url" text,"dance_call_songcut_path" text,"dance_call_songcut_name" text,"dance_call_other_url" text,"dance_call_other_path" text,"dance_call_other_name" text,"other_side_url" text,"other_side_path" text,"other_side_name" text,"other_songcut_url" text,"other_songcut_path" text,"other_songcut_name" text,"other_other_url" text,"other_other_path" text,"other_other_name" text,"dance_call_side_notes" text,"dance_call_songcut_notes" text,"dance_call_other_notes" text,"other_side_notes" text,"other_songcut_notes" text,"other_other_notes" text);
ALTER TABLE public."production_characters" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."production_characters" TO anon,authenticated;
CREATE TABLE public."production_audition_observations"("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid NOT NULL,"applicant_id" uuid NOT NULL,"session_id" uuid,"character_id" uuid,"team_member_id" uuid,"source_type" text DEFAULT 'organisation'::text NOT NULL,"author_name" text DEFAULT 'Organisation'::text NOT NULL,"author_email" text,"author_role" text DEFAULT 'Organisation'::text NOT NULL,"author_color" text DEFAULT '#b8b4c0'::text NOT NULL,"observation_area" text NOT NULL,"observation_type" text NOT NULL,"observation_key" text NOT NULL,"value" text,"body" text,"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,"created_at" timestamptz DEFAULT now() NOT NULL,"updated_at" timestamptz DEFAULT now() NOT NULL);
ALTER TABLE public."production_audition_observations" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."production_audition_observations" TO anon,authenticated;
CREATE TABLE public."production_audition_notes"("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid NOT NULL,"applicant_id" uuid,"session_id" uuid,"character_id" uuid,"note_area" text DEFAULT 'in_room'::text NOT NULL,"body" text NOT NULL,"author_name" text NOT NULL,"author_email" text,"author_role" text NOT NULL,"team_member_id" uuid,"created_at" timestamptz DEFAULT now() NOT NULL,"updated_at" timestamptz DEFAULT now() NOT NULL,"author_color" text DEFAULT '#572e88'::text NOT NULL,"note_type" text DEFAULT 'general'::text NOT NULL,"note_rating" int4);
ALTER TABLE public."production_audition_notes" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."production_audition_notes" TO anon,authenticated;
CREATE TABLE public."audition_sessions"("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"name" text DEFAULT 'Untitled Session'::text NOT NULL,"type" text DEFAULT 'audition'::text NOT NULL,"format" text DEFAULT 'in_person'::text NOT NULL,"date" date,"location" text,"instructions" text,"is_visible" bool DEFAULT true,"sort_order" int4 DEFAULT 0,"created_at" timestamptz DEFAULT now(),"enabled" bool DEFAULT false,"show_to_applicants" bool DEFAULT false,"start_time" time,"end_time" time,"slot_length" int4 DEFAULT 10,"buffer_time" int4 DEFAULT 0,"capacity_per_slot" int4 DEFAULT 1,"booking_mode" text DEFAULT 'individual'::text,"linked_event_id" uuid,"slot_blocks" jsonb DEFAULT '[]'::jsonb,"prepare_text" text,"allow_self_booking" bool DEFAULT true,"end_date" date);
ALTER TABLE public."audition_sessions" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."audition_sessions" TO anon,authenticated;
CREATE TABLE public."production_access_audit_log"("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid NOT NULL,"changed_user_id" uuid,"changed_by_user_id" uuid,"permission_key" text,"page_key" text,"previous_access_level" text,"new_access_level" text,"created_at" timestamptz DEFAULT now() NOT NULL);
ALTER TABLE public."production_access_audit_log" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."production_access_audit_log" TO anon,authenticated;
CREATE TABLE public."audition_bookings"("id" uuid DEFAULT gen_random_uuid() NOT NULL,"session_id" uuid,"production_id" uuid,"slot_id" uuid,"name" text NOT NULL,"email" text NOT NULL,"phone" text,"created_at" timestamptz DEFAULT now(),"age" int4,"pronouns" text,"contact_name" text,"role_preference" text,"gender_preference" text,"roles_requested" text[],"is_minor" bool DEFAULT false,"guardian_name" text,"guardian_email" text,"headshot_url" text,"custom_answers" jsonb DEFAULT '{}'::jsonb,"status" text DEFAULT 'pending'::text,"attendance_mode" text,"portal_code" text);
ALTER TABLE public."audition_bookings" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."audition_bookings" TO anon,authenticated;
CREATE TABLE public."production_audition_live_events"("id" uuid DEFAULT gen_random_uuid() NOT NULL,"organization_id" uuid,"production_id" uuid NOT NULL,"session_id" uuid,"application_id" uuid,"room_key" text,"event_type" text NOT NULL,"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,"created_by" text,"created_by_team_member_id" uuid,"created_at" timestamptz DEFAULT now() NOT NULL);
ALTER TABLE public."production_audition_live_events" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."production_audition_live_events" TO anon,authenticated;
CREATE TABLE public."production_audition_room_states"("id" uuid DEFAULT gen_random_uuid() NOT NULL,"organization_id" uuid,"production_id" uuid NOT NULL,"session_id" uuid,"audition_type" text,"room_id" text DEFAULT 'main'::text NOT NULL,"room_key" text NOT NULL,"room_name" text,"status" text DEFAULT 'idle'::text NOT NULL,"current_applicant_id" uuid,"current_group_key" text,"current_group_label" text,"current_group_member_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,"next_applicant_id" uuid,"next_group_key" text,"next_group_label" text,"next_group_member_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,"requested_by" text,"requested_by_team_member_id" uuid,"requested_at" timestamptz,"sent_at" timestamptz,"entered_at" timestamptz,"created_at" timestamptz DEFAULT now() NOT NULL,"updated_at" timestamptz DEFAULT now() NOT NULL);
ALTER TABLE public."production_audition_room_states" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."production_audition_room_states" TO anon,authenticated;
CREATE TABLE public."team_notes"("id" uuid DEFAULT gen_random_uuid() NOT NULL,"production_id" uuid,"team_member_id" uuid,"applicant_id" uuid,"session_id" uuid,"character_id" uuid,"note_area" text DEFAULT 'in_room'::text NOT NULL,"body" text NOT NULL,"created_at" timestamptz DEFAULT now(),"note_type" text DEFAULT 'general'::text,"note_rating" int4);
ALTER TABLE public."team_notes" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."team_notes" TO anon,authenticated;
CREATE TABLE public."production_room_next_signals"("id" uuid DEFAULT gen_random_uuid() NOT NULL,"organization_id" uuid,"production_id" uuid NOT NULL,"session_id" uuid,"audition_type" text,"room_id" text DEFAULT 'main'::text NOT NULL,"room_key" text NOT NULL,"room_name" text,"status" text DEFAULT 'ready'::text NOT NULL,"current_applicant_id" uuid,"current_group_key" text,"current_group_label" text,"current_group_member_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,"next_applicant_id" uuid,"next_group_key" text,"next_group_label" text,"next_group_member_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,"next_label" text,"requested_by" text,"requested_by_team_member_id" uuid,"requested_at" timestamptz DEFAULT now() NOT NULL,"sent_at" timestamptz,"dismissed_at" timestamptz,"created_at" timestamptz DEFAULT now() NOT NULL,"updated_at" timestamptz DEFAULT now() NOT NULL);
ALTER TABLE public."production_room_next_signals" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."production_room_next_signals" TO anon,authenticated;
ALTER TABLE public."audition_sessions" ADD CONSTRAINT "audition_sessions_pkey" PRIMARY KEY (id);
ALTER TABLE public."audition_bookings" ADD CONSTRAINT "audition_bookings_pkey" PRIMARY KEY (id);
ALTER TABLE public."production_audition_notes" ADD CONSTRAINT "production_audition_notes_pkey" PRIMARY KEY (id);
ALTER TABLE public."production_audition_observations" ADD CONSTRAINT "production_audition_observations_pkey" PRIMARY KEY (id);
ALTER TABLE public."production_audition_room_states" ADD CONSTRAINT "production_audition_room_states_pkey" PRIMARY KEY (id);
ALTER TABLE public."production_characters" ADD CONSTRAINT "production_characters_pkey" PRIMARY KEY (id);
ALTER TABLE public."production_room_next_signals" ADD CONSTRAINT "production_room_next_signals_pkey" PRIMARY KEY (id);
ALTER TABLE public."production_team_member_sessions" ADD CONSTRAINT "production_team_member_sessions_pkey" PRIMARY KEY (id);
ALTER TABLE public."production_team_member_sessions" ADD CONSTRAINT "production_team_member_sessions_session_token_key" UNIQUE (session_token);
ALTER TABLE public."team_notes" ADD CONSTRAINT "team_notes_pkey" PRIMARY KEY (id);
ALTER TABLE public."production_audition_live_events" ADD CONSTRAINT "production_audition_live_events_pkey" PRIMARY KEY (id);
ALTER TABLE public."production_audition_live_state" ADD CONSTRAINT "production_audition_live_state_pkey" PRIMARY KEY (id);
ALTER TABLE public."production_team_member_special_permissions" ADD CONSTRAINT "production_team_member_special_permissions_pkey" PRIMARY KEY (id);
ALTER TABLE public."production_team_member_special_permissions" ADD CONSTRAINT "production_team_member_specia_production_id_team_member_id__key" UNIQUE (production_id, team_member_id, permission_key);
ALTER TABLE public."production_access_audit_log" ADD CONSTRAINT "production_access_audit_log_pkey" PRIMARY KEY (id);
ALTER TABLE public.production_team_member_page_permissions ADD CONSTRAINT model_team_page_unique UNIQUE(production_id,team_member_id,page_key);
CREATE OR REPLACE FUNCTION public.team_member_colour_list(p_production_id uuid, p_email text, p_passcode text)
 RETURNS TABLE(team_member_id uuid, note_color text, name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH authed AS (
    SELECT id
    FROM production_team_members
    WHERE production_id = p_production_id
      AND lower(trim(email)) = lower(trim(p_email))
      AND passcode = regexp_replace(trim(p_passcode), '\D+', '', 'g')
      AND is_active = true
    LIMIT 1
  )
  SELECT m.id, m.note_color, m.name
  FROM production_team_members m
  WHERE EXISTS (SELECT 1 FROM authed)
    AND m.production_id = p_production_id
    AND m.is_active = true
  ORDER BY m.name;
$function$;

CREATE OR REPLACE FUNCTION public.team_member_start_session(p_production_id uuid, p_email text, p_passcode text, p_user_agent text DEFAULT NULL::text)
 RETURNS TABLE(session_token text, expires_at timestamp with time zone, team_member production_team_members)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member production_team_members%ROWTYPE;
  v_token text;
  v_expires_at timestamptz;
BEGIN
  SELECT *
  INTO v_member
  FROM production_team_members
  WHERE production_id = p_production_id
    AND lower(trim(email)) = lower(trim(p_email))
    AND passcode = regexp_replace(trim(p_passcode), '\D+', '', 'g')
    AND is_active = true
  LIMIT 1;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'Team access not found';
  END IF;

  v_token := md5(random()::text || clock_timestamp()::text || v_member.id::text)
          || md5(random()::text || clock_timestamp()::text || p_production_id::text);
  v_expires_at := now() + interval '30 days';

  INSERT INTO production_team_member_sessions (
    production_id, team_member_id, session_token, user_agent, expires_at
  )
  VALUES (
    p_production_id, v_member.id, v_token, p_user_agent, v_expires_at
  );

  RETURN QUERY SELECT v_token, v_expires_at, v_member;
END;
$function$;

CREATE OR REPLACE FUNCTION public.team_member_colour_list_for_session(p_production_id uuid, p_session_token text)
 RETURNS TABLE(team_member_id uuid, note_color text, name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH authed AS (
    SELECT s.team_member_id
    FROM production_team_member_sessions s
    JOIN production_team_members m ON m.id = s.team_member_id
    WHERE s.production_id = p_production_id
      AND s.session_token = trim(p_session_token)
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND m.is_active = true
    LIMIT 1
  )
  SELECT m.id, m.note_color, m.name
  FROM production_team_members m
  WHERE EXISTS (SELECT 1 FROM authed)
    AND m.production_id = p_production_id
    AND m.is_active = true
  ORDER BY m.name;
$function$;

CREATE OR REPLACE FUNCTION public.team_member_login(p_production_id uuid, p_passcode text)
 RETURNS TABLE(id uuid, production_id uuid, name text, email text, role text, note_color text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select tm.id, tm.production_id, tm.name, tm.email, tm.role, tm.note_color
  from production_team_members tm
  where tm.production_id = p_production_id
    and tm.is_active = true
    and lower(tm.passcode) = lower(trim(p_passcode))
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.team_member_resume_session(p_production_id uuid, p_session_token text)
 RETURNS SETOF production_team_members
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_session production_team_member_sessions%ROWTYPE;
BEGIN
  SELECT *
  INTO v_session
  FROM production_team_member_sessions
  WHERE production_id = p_production_id
    AND session_token = trim(p_session_token)
    AND revoked_at IS NULL
    AND expires_at > now()
  LIMIT 1;

  IF v_session.id IS NULL THEN
    RETURN;
  END IF;

  UPDATE production_team_member_sessions
  SET last_used_at = now()
  WHERE id = v_session.id;

  RETURN QUERY
  SELECT m.*
  FROM production_team_members m
  WHERE m.id = v_session.team_member_id
    AND m.production_id = p_production_id
    AND m.is_active = true
  LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.team_member_revoke_session(p_production_id uuid, p_session_token text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE production_team_member_sessions
  SET revoked_at = now()
  WHERE production_id = p_production_id
    AND session_token = trim(p_session_token)
    AND revoked_at IS NULL;

  SELECT true;
$function$;

CREATE OR REPLACE FUNCTION public.team_member_start_session_for_portal(p_org_abbrev text, p_show_slug text, p_email text, p_passcode text, p_user_agent text DEFAULT NULL::text)
 RETURNS TABLE(production_id uuid, session_token text, expires_at timestamp with time zone, team_member production_team_members)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member production_team_members%ROWTYPE;
  v_token text;
  v_expires_at timestamptz;
BEGIN
  SELECT m.*
  INTO v_member
  FROM production_team_members m
  JOIN productions p ON p.id = m.production_id
  JOIN organizations o ON o.id = p.organization_id
  CROSS JOIN LATERAL (
    SELECT
      lower(regexp_replace(COALESCE(p.slug, ''), '[^a-zA-Z0-9]', '', 'g')) AS production_slug_key,
      lower(regexp_replace(COALESCE(p.title, ''), '[^a-zA-Z0-9]', '', 'g')) AS title_key,
      lower(regexp_replace(regexp_replace(COALESCE(p.title, ''), '^(test|demo)[^a-zA-Z0-9]+', '', 'i'), '[^a-zA-Z0-9]', '', 'g')) AS clean_title_key,
      lower(regexp_replace(COALESCE(p_show_slug, ''), '[^a-zA-Z0-9]', '', 'g')) AS requested_key
  ) keys
  WHERE lower(regexp_replace(COALESCE(o.slug, o.abbreviation, o.name), '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(p_org_abbrev, '[^a-zA-Z0-9]', '', 'g'))
    AND lower(trim(m.email)) = lower(trim(p_email))
    AND m.passcode = regexp_replace(trim(p_passcode), '\D+', '', 'g')
    AND m.is_active = true
    AND (
      keys.production_slug_key = keys.requested_key
      OR keys.title_key = keys.requested_key
      OR keys.clean_title_key = keys.requested_key
      OR keys.requested_key LIKE keys.production_slug_key || '%'
      OR keys.requested_key LIKE keys.clean_title_key || '%'
    )
  ORDER BY
    CASE
      WHEN keys.production_slug_key = keys.requested_key THEN 0
      WHEN keys.clean_title_key = keys.requested_key THEN 1
      ELSE 3
    END,
    p.id
  LIMIT 1;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'Team access not found';
  END IF;

  v_token := md5(random()::text || clock_timestamp()::text || v_member.id::text)
          || md5(random()::text || clock_timestamp()::text || v_member.production_id::text);
  v_expires_at := now() + interval '30 days';

  INSERT INTO production_team_member_sessions (
    production_id, team_member_id, session_token, user_agent, expires_at
  )
  VALUES (
    v_member.production_id, v_member.id, v_token, p_user_agent, v_expires_at
  );

  RETURN QUERY SELECT v_member.production_id, v_token, v_expires_at, v_member;
END;
$function$;

CREATE OR REPLACE FUNCTION public.team_member_update_profile(p_production_id uuid, p_email text, p_passcode text, p_note_color text, p_new_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_bio text DEFAULT NULL::text, p_headshot_url text DEFAULT NULL::text, p_headshot_path text DEFAULT NULL::text)
 RETURNS SETOF production_team_members
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member production_team_members%ROWTYPE;
BEGIN
  SELECT *
  INTO v_member
  FROM production_team_members
  WHERE production_id = p_production_id
    AND lower(trim(email)) = lower(trim(p_email))
    AND passcode = regexp_replace(trim(p_passcode), '\D+', '', 'g')
    AND is_active = true
  LIMIT 1;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'Team access not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM production_team_members
    WHERE production_id = p_production_id
      AND id <> v_member.id
      AND is_active = true
      AND lower(note_color) = lower(p_note_color)
  ) THEN
    RAISE EXCEPTION 'That note colour is already taken';
  END IF;

  IF COALESCE(NULLIF(trim(p_new_email), ''), '') = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM production_team_members
    WHERE production_id = p_production_id
      AND id <> v_member.id
      AND is_active = true
      AND lower(trim(email)) = lower(trim(p_new_email))
  ) THEN
    RAISE EXCEPTION 'That email is already used by another team member';
  END IF;

  UPDATE production_team_members
  SET note_color = COALESCE(NULLIF(p_note_color, ''), note_color),
      email = lower(trim(p_new_email)),
      phone = NULLIF(trim(COALESCE(p_phone, '')), ''),
      bio = p_bio,
      headshot_url = p_headshot_url,
      headshot_path = p_headshot_path,
      updated_at = now()
  WHERE id = v_member.id;

  RETURN QUERY SELECT * FROM production_team_members WHERE id = v_member.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.team_member_update_profile_for_session(p_production_id uuid, p_session_token text, p_note_color text, p_name text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_bio text DEFAULT NULL::text, p_headshot_url text DEFAULT NULL::text, p_headshot_path text DEFAULT NULL::text)
 RETURNS SETOF production_team_members
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member production_team_members%ROWTYPE;
BEGIN
  SELECT m.*
  INTO v_member
  FROM production_team_member_sessions s
  JOIN production_team_members m ON m.id = s.team_member_id
  WHERE s.production_id = p_production_id
    AND s.session_token = trim(p_session_token)
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND m.is_active = true
  LIMIT 1;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'Team access not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM production_team_members
    WHERE production_id = p_production_id
      AND id <> v_member.id
      AND is_active = true
      AND lower(note_color) = lower(p_note_color)
  ) THEN
    RAISE EXCEPTION 'That note colour is already taken';
  END IF;

  IF COALESCE(NULLIF(trim(p_email), ''), '') = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM production_team_members
    WHERE production_id = p_production_id
      AND id <> v_member.id
      AND is_active = true
      AND lower(trim(email)) = lower(trim(p_email))
  ) THEN
    RAISE EXCEPTION 'That email is already used by another team member';
  END IF;

  UPDATE production_team_members
  SET name = COALESCE(NULLIF(trim(p_name), ''), name),
      note_color = COALESCE(NULLIF(p_note_color, ''), note_color),
      email = lower(trim(p_email)),
      phone = NULLIF(trim(COALESCE(p_phone, '')), ''),
      bio = p_bio,
      headshot_url = p_headshot_url,
      headshot_path = p_headshot_path,
      updated_at = now()
  WHERE id = v_member.id;

  UPDATE production_team_member_sessions
  SET last_used_at = now()
  WHERE production_id = p_production_id
    AND session_token = trim(p_session_token)
    AND revoked_at IS NULL;

  RETURN QUERY SELECT * FROM production_team_members WHERE id = v_member.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.team_member_manage_page_access_for_session(p_production_id uuid, p_session_token text, p_target_team_member_id uuid, p_page_permissions jsonb, p_manage_access boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor production_team_members%ROWTYPE;
  v_target production_team_members%ROWTYPE;
  v_item jsonb;
  v_page_key text;
  v_new_level text;
  v_previous_level text;
  v_actor_level text;
  v_actor_rank integer;
  v_new_rank integer;
  v_manager_count integer;
  v_had_manage_access boolean;
BEGIN
  SELECT m.*
  INTO v_actor
  FROM production_team_member_sessions s
  JOIN production_team_members m ON m.id = s.team_member_id
  WHERE s.production_id = p_production_id
    AND s.session_token = trim(p_session_token)
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND m.is_active = true
  LIMIT 1;

  IF v_actor.id IS NULL THEN
    RAISE EXCEPTION 'Team access not found';
  END IF;

  IF NOT (
    lower(coalesce(v_actor.access_level, v_actor.role, '')) IN ('producer', 'admin', 'administrator', 'owner')
    OR EXISTS (
      SELECT 1
      FROM production_team_member_special_permissions sp
      WHERE sp.production_id = p_production_id
        AND sp.team_member_id = v_actor.id
        AND sp.permission_key = 'manage_access'
    )
  ) THEN
    RAISE EXCEPTION 'You do not have permission to manage access';
  END IF;

  SELECT *
  INTO v_target
  FROM production_team_members
  WHERE production_id = p_production_id
    AND id = p_target_team_member_id
  LIMIT 1;

  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'Team member not found';
  END IF;

  IF lower(coalesce(v_target.access_level, v_target.role, '')) IN ('producer', 'admin', 'administrator', 'owner') THEN
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(coalesce(p_page_permissions, '[]'::jsonb)) item
      WHERE coalesce(item->>'access_level', 'none') <> 'manage'
    ) THEN
      RAISE EXCEPTION 'Producer/admin access cannot be lowered';
    END IF;
    p_manage_access := true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM production_team_member_special_permissions
    WHERE production_id = p_production_id
      AND team_member_id = p_target_team_member_id
      AND permission_key = 'manage_access'
  )
  INTO v_had_manage_access;

  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_page_permissions, '[]'::jsonb))
  LOOP
    v_page_key := v_item->>'page_key';
    v_new_level := lower(coalesce(v_item->>'access_level', 'none'));
    IF v_page_key IS NULL OR v_new_level NOT IN ('none', 'view', 'edit', 'manage') THEN
      RAISE EXCEPTION 'Invalid access update';
    END IF;

    v_new_rank := CASE v_new_level WHEN 'none' THEN 0 WHEN 'view' THEN 1 WHEN 'edit' THEN 2 ELSE 3 END;
    IF lower(coalesce(v_actor.access_level, v_actor.role, '')) IN ('producer', 'admin', 'administrator', 'owner') THEN
      v_actor_rank := 3;
    ELSE
      SELECT coalesce(access_level, 'none')
      INTO v_actor_level
      FROM production_team_member_page_permissions
      WHERE production_id = p_production_id
        AND team_member_id = v_actor.id
        AND page_key = v_page_key
      LIMIT 1;
      v_actor_rank := CASE coalesce(v_actor_level, 'none') WHEN 'view' THEN 1 WHEN 'edit' THEN 2 WHEN 'manage' THEN 3 ELSE 0 END;
    END IF;

    IF v_new_rank > v_actor_rank THEN
      RAISE EXCEPTION 'You cannot grant access higher than your own';
    END IF;

    SELECT access_level
    INTO v_previous_level
    FROM production_team_member_page_permissions
    WHERE production_id = p_production_id
      AND team_member_id = p_target_team_member_id
      AND page_key = v_page_key
    LIMIT 1;
    v_previous_level := coalesce(v_previous_level, 'none');

    INSERT INTO production_team_member_page_permissions (
      production_id, team_member_id, page_key, access_level, granted_by, updated_at
    )
    VALUES (
      p_production_id, p_target_team_member_id, v_page_key, v_new_level, v_actor.id, now()
    )
    ON CONFLICT (production_id, team_member_id, page_key) DO UPDATE
    SET access_level = EXCLUDED.access_level,
        granted_by = EXCLUDED.granted_by,
        updated_at = now();

    IF v_previous_level <> v_new_level THEN
      INSERT INTO production_access_audit_log (
        production_id, changed_user_id, changed_by_user_id, page_key, previous_access_level, new_access_level
      )
      VALUES (
        p_production_id, p_target_team_member_id, v_actor.id, v_page_key, v_previous_level, v_new_level
      );
    END IF;
  END LOOP;

  SELECT count(*)
  INTO v_manager_count
  FROM (
    SELECT id
    FROM production_team_members
    WHERE production_id = p_production_id
      AND is_active = true
      AND lower(coalesce(access_level, role, '')) IN ('producer', 'admin', 'administrator', 'owner')
    UNION
    SELECT team_member_id
    FROM production_team_member_special_permissions
    WHERE production_id = p_production_id
      AND permission_key = 'manage_access'
      AND (p_manage_access = true OR team_member_id <> p_target_team_member_id)
  ) managers;

  IF v_manager_count < 1 THEN
    RAISE EXCEPTION 'At least one access manager must remain';
  END IF;

  IF p_manage_access THEN
    INSERT INTO production_team_member_special_permissions (
      production_id, team_member_id, permission_key, granted_by, updated_at
    )
    VALUES (p_production_id, p_target_team_member_id, 'manage_access', v_actor.id, now())
    ON CONFLICT (production_id, team_member_id, permission_key) DO UPDATE
    SET granted_by = EXCLUDED.granted_by,
        updated_at = now();
  ELSE
    DELETE FROM production_team_member_special_permissions
    WHERE production_id = p_production_id
      AND team_member_id = p_target_team_member_id
      AND permission_key = 'manage_access';
  END IF;

  IF v_had_manage_access IS DISTINCT FROM p_manage_access THEN
    INSERT INTO production_access_audit_log (
      production_id, changed_user_id, changed_by_user_id, permission_key, previous_access_level, new_access_level
    )
    VALUES (
      p_production_id,
      p_target_team_member_id,
      v_actor.id,
      'manage_access',
      CASE WHEN v_had_manage_access THEN 'manage' ELSE 'none' END,
      CASE WHEN p_manage_access THEN 'manage' ELSE 'none' END
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.team_member_page_access_for_session(p_production_id uuid, p_session_token text)
 RETURNS TABLE(team_member_id uuid, page_key text, access_level text, permission_key text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH authed AS (
    SELECT
      s.team_member_id,
      (
        lower(coalesce(m.access_level, m.role, '')) IN ('producer', 'admin', 'administrator', 'owner')
        OR EXISTS (
          SELECT 1
          FROM production_team_member_special_permissions sp
          WHERE sp.production_id = p_production_id
            AND sp.team_member_id = m.id
            AND sp.permission_key = 'manage_access'
        )
      ) AS can_manage_access
    FROM production_team_member_sessions s
    JOIN production_team_members m ON m.id = s.team_member_id
    WHERE s.production_id = p_production_id
      AND s.session_token = trim(p_session_token)
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND m.is_active = true
    LIMIT 1
  )
  SELECT pp.team_member_id, pp.page_key, pp.access_level, null::text AS permission_key
  FROM production_team_member_page_permissions pp
  JOIN authed a ON a.can_manage_access OR a.team_member_id = pp.team_member_id
  WHERE pp.production_id = p_production_id
  UNION ALL
  SELECT sp.team_member_id, null::text AS page_key, null::text AS access_level, sp.permission_key
  FROM production_team_member_special_permissions sp
  JOIN authed a ON a.can_manage_access OR a.team_member_id = sp.team_member_id
  WHERE sp.production_id = p_production_id;
$function$;

CREATE OR REPLACE FUNCTION public.team_members_for_session(p_production_id uuid, p_session_token text)
 RETURNS SETOF production_team_members
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH authed AS (
    SELECT
      m.id,
      (
        lower(coalesce(m.access_level, m.role, '')) IN ('producer', 'admin', 'administrator', 'owner')
        OR EXISTS (
          SELECT 1
          FROM production_team_member_special_permissions sp
          WHERE sp.production_id = p_production_id
            AND sp.team_member_id = m.id
            AND sp.permission_key = 'manage_access'
        )
      ) AS can_manage_access
    FROM production_team_member_sessions s
    JOIN production_team_members m ON m.id = s.team_member_id
    WHERE s.production_id = p_production_id
      AND s.session_token = trim(p_session_token)
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND m.is_active = true
    LIMIT 1
  )
  SELECT members.*
  FROM production_team_members members
  WHERE members.production_id = p_production_id
    AND members.is_active = true
    AND (
      EXISTS (SELECT 1 FROM authed WHERE can_manage_access)
      OR members.id = (SELECT id FROM authed)
    )
  ORDER BY members.created_at;
$function$;

CREATE OR REPLACE FUNCTION public.team_authored_notes_for_production(p_production_id uuid, p_session_token text)
 RETURNS SETOF production_audition_notes
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH authed AS (
    SELECT s.team_member_id FROM production_team_member_sessions s
    JOIN production_team_members m ON m.id = s.team_member_id
    WHERE s.production_id = p_production_id AND s.session_token = trim(p_session_token)
      AND s.revoked_at IS NULL AND s.expires_at > now() AND m.is_active = true LIMIT 1
  )
  SELECT n.* FROM production_audition_notes n
  WHERE EXISTS (SELECT 1 FROM authed) AND n.production_id = p_production_id ORDER BY n.created_at ASC;
$function$;

CREATE OR REPLACE FUNCTION public.team_note_list(p_production_id uuid, p_email text, p_passcode text)
 RETURNS SETOF production_audition_notes
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH authed AS (
    SELECT id
    FROM production_team_members
    WHERE production_id = p_production_id
      AND lower(trim(email)) = lower(trim(p_email))
      AND passcode = regexp_replace(trim(p_passcode), '\D+', '', 'g')
      AND is_active = true
    LIMIT 1
  )
  SELECT n.*
  FROM production_audition_notes n
  WHERE EXISTS (SELECT 1 FROM authed)
    AND n.production_id = p_production_id
  ORDER BY n.created_at ASC;
$function$;

CREATE OR REPLACE FUNCTION public.team_note_add(p_production_id uuid, p_passcode text, p_applicant_id uuid, p_session_id uuid, p_character_id uuid, p_note_area text, p_body text)
 RETURNS production_audition_notes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  tm production_team_members%rowtype;
  inserted production_audition_notes%rowtype;
begin
  select *
  into tm
  from production_team_members
  where production_id = p_production_id
    and is_active = true
    and lower(passcode) = lower(trim(p_passcode))
  limit 1;

  if tm.id is null then
    raise exception 'Invalid production team passcode';
  end if;

  insert into production_audition_notes (
    production_id, applicant_id, session_id, character_id, note_area, body,
    author_name, author_email, author_role, author_color, team_member_id
  )
  values (
    p_production_id, p_applicant_id, p_session_id, p_character_id,
    coalesce(nullif(trim(p_note_area), ''), 'in_room'),
    trim(p_body),
    tm.name, tm.email, tm.role, coalesce(tm.note_color, '#572e88'), tm.id
  )
  returning * into inserted;

  return inserted;
end;
$function$;

CREATE OR REPLACE FUNCTION public.team_note_add(p_production_id uuid, p_email text, p_passcode text, p_applicant_id uuid, p_session_id uuid, p_character_id uuid, p_note_area text, p_body text)
 RETURNS TABLE(id uuid, applicant_id uuid, session_id uuid, character_id uuid, note_area text, body text, author_name text, author_role text, author_color text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member production_team_members%ROWTYPE;
  v_note_id uuid;
BEGIN
  SELECT * INTO v_member
  FROM production_team_members
  WHERE production_id = p_production_id
    AND lower(email)  = lower(p_email)
    AND passcode      = p_passcode;

  IF v_member.id IS NULL THEN RETURN; END IF;

  INSERT INTO team_notes
    (production_id, team_member_id, applicant_id, session_id, character_id, note_area, body)
  VALUES
    (p_production_id, v_member.id, p_applicant_id, p_session_id, p_character_id, p_note_area, p_body)
  RETURNING id INTO v_note_id;

  RETURN QUERY
  SELECT n.id, n.applicant_id, n.session_id, n.character_id,
         n.note_area, n.body,
         v_member.name       AS author_name,
         v_member.role       AS author_role,
         v_member.note_color AS author_color,
         n.created_at
  FROM team_notes n WHERE n.id = v_note_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.team_note_add(p_production_id uuid, p_email text, p_passcode text, p_applicant_id uuid, p_session_id uuid DEFAULT NULL::uuid, p_character_id uuid DEFAULT NULL::uuid, p_note_area text DEFAULT 'in_room'::text, p_body text DEFAULT ''::text, p_note_type text DEFAULT 'general'::text, p_note_rating integer DEFAULT NULL::integer)
 RETURNS SETOF production_audition_notes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member production_team_members%ROWTYPE;
  v_note_id uuid;
BEGIN
  SELECT *
  INTO v_member
  FROM production_team_members
  WHERE production_id = p_production_id
    AND lower(trim(email)) = lower(trim(p_email))
    AND passcode = regexp_replace(trim(p_passcode), '\D+', '', 'g')
    AND is_active = true
  LIMIT 1;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'Team access not found';
  END IF;
  IF NULLIF(trim(p_body), '') IS NULL THEN
    RAISE EXCEPTION 'Note body is required';
  END IF;

  INSERT INTO production_audition_notes (
    production_id, applicant_id, session_id, character_id,
    team_member_id, author_name, author_email, author_role, author_color,
    note_area, note_type, note_rating, body
  )
  VALUES (
    p_production_id, p_applicant_id, p_session_id, p_character_id,
    v_member.id, v_member.name, v_member.email, v_member.role, v_member.note_color,
    COALESCE(NULLIF(p_note_area, ''), 'in_room'),
    COALESCE(NULLIF(p_note_type, ''), 'general'),
    p_note_rating,
    trim(p_body)
  )
  RETURNING id INTO v_note_id;

  RETURN QUERY SELECT * FROM production_audition_notes WHERE id = v_note_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.team_note_add_for_session(p_production_id uuid, p_session_token text, p_applicant_id uuid, p_session_id uuid DEFAULT NULL::uuid, p_character_id uuid DEFAULT NULL::uuid, p_note_area text DEFAULT 'in_room'::text, p_body text DEFAULT ''::text, p_note_type text DEFAULT 'general'::text, p_note_rating integer DEFAULT NULL::integer)
 RETURNS SETOF production_audition_notes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member production_team_members%ROWTYPE;
  v_note_id uuid;
BEGIN
  SELECT m.*
  INTO v_member
  FROM production_team_member_sessions s
  JOIN production_team_members m ON m.id = s.team_member_id
  WHERE s.production_id = p_production_id
    AND s.session_token = trim(p_session_token)
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND m.is_active = true
  LIMIT 1;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'Team access not found';
  END IF;
  IF NULLIF(trim(p_body), '') IS NULL THEN
    RAISE EXCEPTION 'Note body is required';
  END IF;

  UPDATE production_team_member_sessions
  SET last_used_at = now()
  WHERE production_id = p_production_id
    AND session_token = trim(p_session_token)
    AND revoked_at IS NULL;

  INSERT INTO production_audition_notes (
    production_id, applicant_id, session_id, character_id,
    team_member_id, author_name, author_email, author_role, author_color,
    note_area, note_type, note_rating, body
  )
  VALUES (
    p_production_id, p_applicant_id, p_session_id, p_character_id,
    v_member.id, v_member.name, v_member.email, v_member.role, v_member.note_color,
    COALESCE(NULLIF(p_note_area, ''), 'in_room'),
    COALESCE(NULLIF(p_note_type, ''), 'general'),
    p_note_rating,
    trim(p_body)
  )
  RETURNING id INTO v_note_id;

  RETURN QUERY SELECT * FROM production_audition_notes WHERE id = v_note_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.team_note_delete(p_production_id uuid, p_email text, p_passcode text, p_note_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member production_team_members%ROWTYPE;
BEGIN
  SELECT *
  INTO v_member
  FROM production_team_members
  WHERE production_id = p_production_id
    AND lower(trim(email)) = lower(trim(p_email))
    AND passcode = regexp_replace(trim(p_passcode), '\D+', '', 'g')
    AND is_active = true
  LIMIT 1;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'Team access not found';
  END IF;

  DELETE FROM production_audition_notes
  WHERE id = p_note_id
    AND production_id = p_production_id
    AND team_member_id = v_member.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You can only delete your own notes';
  END IF;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.team_note_delete_for_session(p_production_id uuid, p_session_token text, p_note_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member production_team_members%ROWTYPE;
BEGIN
  SELECT m.*
  INTO v_member
  FROM production_team_member_sessions s
  JOIN production_team_members m ON m.id = s.team_member_id
  WHERE s.production_id = p_production_id
    AND s.session_token = trim(p_session_token)
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND m.is_active = true
  LIMIT 1;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'Team access not found';
  END IF;

  DELETE FROM production_audition_notes
  WHERE id = p_note_id
    AND production_id = p_production_id
    AND team_member_id = v_member.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You can only delete your own notes';
  END IF;

  UPDATE production_team_member_sessions
  SET last_used_at = now()
  WHERE production_id = p_production_id
    AND session_token = trim(p_session_token)
    AND revoked_at IS NULL;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.team_note_list(p_production_id uuid, p_passcode text)
 RETURNS TABLE(id uuid, production_id uuid, applicant_id uuid, session_id uuid, character_id uuid, note_area text, body text, author_name text, author_email text, author_role text, author_color text, team_member_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select n.id, n.production_id, n.applicant_id, n.session_id, n.character_id,
         n.note_area, n.body, n.author_name, n.author_email, n.author_role,
         n.author_color, n.team_member_id, n.created_at, n.updated_at
  from production_audition_notes n
  where n.production_id = p_production_id
    and exists (
      select 1
      from production_team_members tm
      where tm.production_id = p_production_id
        and tm.is_active = true
        and lower(tm.passcode) = lower(trim(p_passcode))
    )
  order by n.created_at asc;
$function$;

CREATE OR REPLACE FUNCTION public.team_note_update(p_production_id uuid, p_email text, p_passcode text, p_note_id uuid, p_body text)
 RETURNS SETOF production_audition_notes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member production_team_members%ROWTYPE;
BEGIN
  SELECT *
  INTO v_member
  FROM production_team_members
  WHERE production_id = p_production_id
    AND lower(trim(email)) = lower(trim(p_email))
    AND passcode = regexp_replace(trim(p_passcode), '\D+', '', 'g')
    AND is_active = true
  LIMIT 1;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'Team access not found';
  END IF;

  UPDATE production_audition_notes
  SET body = trim(p_body),
      updated_at = now()
  WHERE id = p_note_id
    AND production_id = p_production_id
    AND team_member_id = v_member.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You can only edit your own notes';
  END IF;

  RETURN QUERY SELECT * FROM production_audition_notes WHERE id = p_note_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.team_note_update_for_session(p_production_id uuid, p_session_token text, p_note_id uuid, p_body text)
 RETURNS SETOF production_audition_notes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member production_team_members%ROWTYPE;
BEGIN
  SELECT m.*
  INTO v_member
  FROM production_team_member_sessions s
  JOIN production_team_members m ON m.id = s.team_member_id
  WHERE s.production_id = p_production_id
    AND s.session_token = trim(p_session_token)
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND m.is_active = true
  LIMIT 1;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'Team access not found';
  END IF;

  UPDATE production_audition_notes
  SET body = trim(p_body),
      updated_at = now()
  WHERE id = p_note_id
    AND production_id = p_production_id
    AND team_member_id = v_member.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You can only edit your own notes';
  END IF;

  UPDATE production_team_member_sessions
  SET last_used_at = now()
  WHERE production_id = p_production_id
    AND session_token = trim(p_session_token)
    AND revoked_at IS NULL;

  RETURN QUERY SELECT * FROM production_audition_notes WHERE id = p_note_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.team_audition_live_event_apply_for_session(p_production_id uuid, p_session_token text, p_session_id uuid, p_application_id uuid, p_room_key text, p_event_type text, p_payload jsonb, p_state_key text, p_state_type text, p_status text)
 RETURNS SETOF production_audition_live_state
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_team_member production_team_members%rowtype;
  v_org_id uuid;
BEGIN
  SELECT tm.*
  INTO v_team_member
  FROM production_team_member_sessions s
  JOIN production_team_members tm ON tm.id = s.team_member_id
  WHERE s.production_id = p_production_id
    AND s.session_token = p_session_token
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND tm.is_active = true
  LIMIT 1;

  IF v_team_member.id IS NULL THEN
    RETURN;
  END IF;

  SELECT organization_id INTO v_org_id
  FROM productions
  WHERE id = p_production_id;

  INSERT INTO production_audition_live_events (
    organization_id,
    production_id,
    session_id,
    application_id,
    room_key,
    event_type,
    payload,
    created_by,
    created_by_team_member_id
  )
  VALUES (
    v_org_id,
    p_production_id,
    p_session_id,
    p_application_id,
    NULLIF(p_room_key, ''),
    p_event_type,
    COALESCE(p_payload, '{}'::jsonb),
    v_team_member.name,
    v_team_member.id
  );

  INSERT INTO production_audition_live_state (
    organization_id,
    production_id,
    session_id,
    application_id,
    room_key,
    state_key,
    state_type,
    event_type,
    status,
    payload,
    updated_by,
    updated_by_team_member_id
  )
  VALUES (
    v_org_id,
    p_production_id,
    p_session_id,
    p_application_id,
    NULLIF(p_room_key, ''),
    p_state_key,
    p_state_type,
    p_event_type,
    p_status,
    COALESCE(p_payload, '{}'::jsonb),
    v_team_member.name,
    v_team_member.id
  )
  ON CONFLICT (production_id, state_key)
  DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    session_id = EXCLUDED.session_id,
    application_id = EXCLUDED.application_id,
    room_key = EXCLUDED.room_key,
    state_type = EXCLUDED.state_type,
    event_type = EXCLUDED.event_type,
    status = EXCLUDED.status,
    payload = EXCLUDED.payload,
    updated_by = EXCLUDED.updated_by,
    updated_by_team_member_id = EXCLUDED.updated_by_team_member_id;

  UPDATE production_team_member_sessions
  SET last_used_at = now()
  WHERE production_id = p_production_id
    AND session_token = p_session_token;

  RETURN QUERY
  SELECT *
  FROM production_audition_live_state
  WHERE production_id = p_production_id
    AND state_key = p_state_key;
END;
$function$;

CREATE OR REPLACE FUNCTION public.team_audition_live_state_list_for_session(p_production_id uuid, p_session_token text)
 RETURNS SETOF production_audition_live_state
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_team_member_id uuid;
BEGIN
  SELECT s.team_member_id
  INTO v_team_member_id
  FROM production_team_member_sessions s
  WHERE s.production_id = p_production_id
    AND s.session_token = p_session_token
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
  LIMIT 1;

  IF v_team_member_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE production_team_member_sessions
  SET last_used_at = now()
  WHERE production_id = p_production_id
    AND session_token = p_session_token;

  RETURN QUERY
  SELECT *
  FROM production_audition_live_state
  WHERE production_id = p_production_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.team_next_signal_list_for_session(p_production_id uuid, p_session_token text)
 RETURNS SETOF production_room_next_signals
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_team_member_id uuid;
BEGIN
  SELECT s.team_member_id
  INTO v_team_member_id
  FROM production_team_member_sessions s
  WHERE s.production_id = p_production_id
    AND s.session_token = p_session_token
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
  LIMIT 1;

  IF v_team_member_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE production_team_member_sessions
  SET last_used_at = now()
  WHERE production_id = p_production_id
    AND session_token = p_session_token;

  RETURN QUERY
  SELECT *
  FROM production_room_next_signals
  WHERE production_id = p_production_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.team_next_signal_upsert_for_session(p_production_id uuid, p_session_token text, p_session_id uuid, p_audition_type text, p_room_id text, p_room_key text, p_room_name text, p_current_applicant_id uuid DEFAULT NULL::uuid, p_current_group_key text DEFAULT NULL::text, p_current_group_label text DEFAULT NULL::text, p_current_group_member_ids uuid[] DEFAULT '{}'::uuid[], p_next_applicant_id uuid DEFAULT NULL::uuid, p_next_group_key text DEFAULT NULL::text, p_next_group_label text DEFAULT NULL::text, p_next_group_member_ids uuid[] DEFAULT '{}'::uuid[], p_next_label text DEFAULT NULL::text)
 RETURNS SETOF production_room_next_signals
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_team_member production_team_members%rowtype;
  v_org_id uuid;
BEGIN
  SELECT tm.*
  INTO v_team_member
  FROM production_team_member_sessions s
  JOIN production_team_members tm ON tm.id = s.team_member_id
  WHERE s.production_id = p_production_id
    AND s.session_token = p_session_token
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND tm.is_active = true
  LIMIT 1;

  IF v_team_member.id IS NULL THEN
    RETURN;
  END IF;

  SELECT organization_id INTO v_org_id
  FROM productions
  WHERE id = p_production_id;

  INSERT INTO production_room_next_signals (
    organization_id,
    production_id,
    session_id,
    audition_type,
    room_id,
    room_key,
    room_name,
    status,
    current_applicant_id,
    current_group_key,
    current_group_label,
    current_group_member_ids,
    next_applicant_id,
    next_group_key,
    next_group_label,
    next_group_member_ids,
    next_label,
    requested_by,
    requested_by_team_member_id,
    requested_at,
    sent_at,
    dismissed_at
  )
  VALUES (
    v_org_id,
    p_production_id,
    p_session_id,
    p_audition_type,
    COALESCE(NULLIF(p_room_id, ''), 'main'),
    p_room_key,
    p_room_name,
    'ready',
    p_current_applicant_id,
    p_current_group_key,
    p_current_group_label,
    COALESCE(p_current_group_member_ids, '{}'),
    p_next_applicant_id,
    p_next_group_key,
    p_next_group_label,
    COALESCE(p_next_group_member_ids, '{}'),
    p_next_label,
    v_team_member.name,
    v_team_member.id,
    now(),
    NULL,
    NULL
  )
  ON CONFLICT (production_id, room_key)
  DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    session_id = EXCLUDED.session_id,
    audition_type = EXCLUDED.audition_type,
    room_id = EXCLUDED.room_id,
    room_name = EXCLUDED.room_name,
    status = 'ready',
    current_applicant_id = EXCLUDED.current_applicant_id,
    current_group_key = EXCLUDED.current_group_key,
    current_group_label = EXCLUDED.current_group_label,
    current_group_member_ids = EXCLUDED.current_group_member_ids,
    next_applicant_id = EXCLUDED.next_applicant_id,
    next_group_key = EXCLUDED.next_group_key,
    next_group_label = EXCLUDED.next_group_label,
    next_group_member_ids = EXCLUDED.next_group_member_ids,
    next_label = EXCLUDED.next_label,
    requested_by = EXCLUDED.requested_by,
    requested_by_team_member_id = EXCLUDED.requested_by_team_member_id,
    requested_at = now(),
    sent_at = NULL,
    dismissed_at = NULL,
    updated_at = now();

  UPDATE production_team_member_sessions
  SET last_used_at = now()
  WHERE production_id = p_production_id
    AND session_token = p_session_token;

  RETURN QUERY
  SELECT *
  FROM production_room_next_signals
  WHERE production_id = p_production_id
    AND room_key = p_room_key;
END;
$function$;

CREATE OR REPLACE FUNCTION public.team_observation_delete_for_session(p_production_id uuid, p_session_token text, p_observation_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_member production_team_members%ROWTYPE;
BEGIN
  SELECT m.* INTO v_member FROM production_team_member_sessions s
  JOIN production_team_members m ON m.id = s.team_member_id
  WHERE s.production_id = p_production_id AND s.session_token = trim(p_session_token)
    AND s.revoked_at IS NULL AND s.expires_at > now() AND m.is_active = true LIMIT 1;
  IF v_member.id IS NULL THEN RAISE EXCEPTION 'Team access not found'; END IF;
  DELETE FROM production_audition_observations WHERE id = p_observation_id AND production_id = p_production_id AND team_member_id = v_member.id;
  UPDATE production_team_member_sessions SET last_used_at = now() WHERE production_id = p_production_id AND session_token = trim(p_session_token) AND revoked_at IS NULL;
  RETURN FOUND;
END; $function$;

CREATE OR REPLACE FUNCTION public.team_observation_upsert_for_session(p_production_id uuid, p_session_token text, p_applicant_id uuid, p_session_id uuid DEFAULT NULL::uuid, p_character_id uuid DEFAULT NULL::uuid, p_observation_area text DEFAULT 'in_room'::text, p_observation_type text DEFAULT 'general'::text, p_observation_key text DEFAULT 'general'::text, p_value text DEFAULT NULL::text, p_body text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS SETOF production_audition_observations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_member production_team_members%ROWTYPE; v_obs_id uuid;
BEGIN
  SELECT m.* INTO v_member FROM production_team_member_sessions s
  JOIN production_team_members m ON m.id = s.team_member_id
  WHERE s.production_id = p_production_id AND s.session_token = trim(p_session_token)
    AND s.revoked_at IS NULL AND s.expires_at > now() AND m.is_active = true LIMIT 1;
  IF v_member.id IS NULL THEN RAISE EXCEPTION 'Team access not found'; END IF;
  UPDATE production_team_member_sessions SET last_used_at = now()
    WHERE production_id = p_production_id AND session_token = trim(p_session_token) AND revoked_at IS NULL;
  SELECT id INTO v_obs_id FROM production_audition_observations
    WHERE production_id = p_production_id AND applicant_id = p_applicant_id
      AND source_type = 'team_member' AND team_member_id = v_member.id
      AND observation_area = p_observation_area AND observation_type = p_observation_type AND observation_key = p_observation_key
      AND (p_session_id IS NULL AND session_id IS NULL OR session_id = p_session_id)
      AND (p_character_id IS NULL AND character_id IS NULL OR character_id = p_character_id) LIMIT 1;
  IF v_obs_id IS NOT NULL THEN
    UPDATE production_audition_observations SET value = p_value, body = p_body, metadata = COALESCE(p_metadata,'{}'), updated_at = now() WHERE id = v_obs_id;
  ELSE
    INSERT INTO production_audition_observations (production_id,applicant_id,session_id,character_id,source_type,team_member_id,author_name,author_role,author_color,observation_area,observation_type,observation_key,value,body,metadata)
    VALUES (p_production_id,p_applicant_id,p_session_id,p_character_id,'team_member',v_member.id,v_member.name,v_member.role,v_member.note_color,p_observation_area,p_observation_type,p_observation_key,p_value,p_body,COALESCE(p_metadata,'{}'))
    RETURNING id INTO v_obs_id;
  END IF;
  RETURN QUERY SELECT * FROM production_audition_observations WHERE id = v_obs_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.team_observations_for_production(p_production_id uuid, p_session_token text)
 RETURNS SETOF production_audition_observations
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH authed AS (
    SELECT s.team_member_id FROM production_team_member_sessions s
    JOIN production_team_members m ON m.id = s.team_member_id
    WHERE s.production_id = p_production_id AND s.session_token = trim(p_session_token)
      AND s.revoked_at IS NULL AND s.expires_at > now() AND m.is_active = true LIMIT 1
  )
  SELECT o.* FROM production_audition_observations o
  WHERE EXISTS (SELECT 1 FROM authed) AND o.production_id = p_production_id ORDER BY o.created_at ASC;
$function$;

CREATE OR REPLACE FUNCTION public.team_room_state_list_for_session(p_production_id uuid, p_session_token text)
 RETURNS SETOF production_audition_room_states
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_team_member_id uuid;
BEGIN
  SELECT s.team_member_id
  INTO v_team_member_id
  FROM production_team_member_sessions s
  WHERE s.production_id = p_production_id
    AND s.session_token = p_session_token
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
  LIMIT 1;

  IF v_team_member_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE production_team_member_sessions
  SET last_used_at = now()
  WHERE production_id = p_production_id
    AND session_token = p_session_token;

  RETURN QUERY
  SELECT *
  FROM production_audition_room_states
  WHERE production_id = p_production_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.team_room_state_upsert_for_session(p_production_id uuid, p_session_token text, p_session_id uuid, p_audition_type text, p_room_id text, p_room_key text, p_room_name text, p_status text, p_current_applicant_id uuid DEFAULT NULL::uuid, p_current_group_key text DEFAULT NULL::text, p_current_group_label text DEFAULT NULL::text, p_current_group_member_ids uuid[] DEFAULT '{}'::uuid[], p_next_applicant_id uuid DEFAULT NULL::uuid, p_next_group_key text DEFAULT NULL::text, p_next_group_label text DEFAULT NULL::text, p_next_group_member_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS SETOF production_audition_room_states
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_team_member production_team_members%rowtype;
  v_org_id uuid;
BEGIN
  SELECT tm.*
  INTO v_team_member
  FROM production_team_member_sessions s
  JOIN production_team_members tm ON tm.id = s.team_member_id
  WHERE s.production_id = p_production_id
    AND s.session_token = p_session_token
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND tm.is_active = true
  LIMIT 1;

  IF v_team_member.id IS NULL THEN
    RETURN;
  END IF;

  SELECT organization_id INTO v_org_id
  FROM productions
  WHERE id = p_production_id;

  INSERT INTO production_audition_room_states (
    organization_id,
    production_id,
    session_id,
    audition_type,
    room_id,
    room_key,
    room_name,
    status,
    current_applicant_id,
    current_group_key,
    current_group_label,
    current_group_member_ids,
    next_applicant_id,
    next_group_key,
    next_group_label,
    next_group_member_ids,
    requested_by,
    requested_by_team_member_id,
    requested_at,
    sent_at,
    entered_at
  )
  VALUES (
    v_org_id,
    p_production_id,
    p_session_id,
    p_audition_type,
    COALESCE(NULLIF(p_room_id, ''), 'main'),
    p_room_key,
    p_room_name,
    p_status,
    p_current_applicant_id,
    p_current_group_key,
    p_current_group_label,
    COALESCE(p_current_group_member_ids, '{}'),
    p_next_applicant_id,
    p_next_group_key,
    p_next_group_label,
    COALESCE(p_next_group_member_ids, '{}'),
    v_team_member.name,
    v_team_member.id,
    CASE WHEN p_status = 'ready_for_next' THEN now() ELSE NULL END,
    CASE WHEN p_status = 'waiting_for_arrival' THEN now() ELSE NULL END,
    CASE WHEN p_status = 'in_progress' THEN now() ELSE NULL END
  )
  ON CONFLICT (production_id, room_key)
  DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    session_id = EXCLUDED.session_id,
    audition_type = EXCLUDED.audition_type,
    room_id = EXCLUDED.room_id,
    room_name = EXCLUDED.room_name,
    status = EXCLUDED.status,
    current_applicant_id = EXCLUDED.current_applicant_id,
    current_group_key = EXCLUDED.current_group_key,
    current_group_label = EXCLUDED.current_group_label,
    current_group_member_ids = EXCLUDED.current_group_member_ids,
    next_applicant_id = EXCLUDED.next_applicant_id,
    next_group_key = EXCLUDED.next_group_key,
    next_group_label = EXCLUDED.next_group_label,
    next_group_member_ids = EXCLUDED.next_group_member_ids,
    requested_by = EXCLUDED.requested_by,
    requested_by_team_member_id = EXCLUDED.requested_by_team_member_id,
    requested_at = COALESCE(EXCLUDED.requested_at, production_audition_room_states.requested_at),
    sent_at = COALESCE(EXCLUDED.sent_at, production_audition_room_states.sent_at),
    entered_at = COALESCE(EXCLUDED.entered_at, production_audition_room_states.entered_at),
    updated_at = now();

  UPDATE production_team_member_sessions
  SET last_used_at = now()
  WHERE production_id = p_production_id
    AND session_token = p_session_token;

  RETURN QUERY
  SELECT *
  FROM production_audition_room_states
  WHERE production_id = p_production_id
    AND room_key = p_room_key;
END;
$function$;

CREATE POLICY "Org can manage audition live events" ON public."production_audition_live_events" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE ((p.id = production_audition_live_events.production_id) AND (o.admin_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE ((p.id = production_audition_live_events.production_id) AND (o.admin_id = auth.uid())))));
CREATE POLICY "Org can manage audition live state" ON public."production_audition_live_state" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE ((p.id = production_audition_live_state.production_id) AND (o.admin_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE ((p.id = production_audition_live_state.production_id) AND (o.admin_id = auth.uid())))));
CREATE POLICY "Org admin can manage production audition observations" ON public."production_audition_observations" AS PERMISSIVE FOR ALL TO public USING ((production_id IN ( SELECT p.id
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE (o.admin_id = auth.uid())))) WITH CHECK ((production_id IN ( SELECT p.id
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE (o.admin_id = auth.uid()))));
CREATE POLICY "Org admin can read all observations" ON public."production_audition_observations" AS PERMISSIVE FOR SELECT TO public USING ((production_id IN ( SELECT p.id
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE (o.admin_id = auth.uid()))));
CREATE POLICY "organisation members can delete audition observations" ON public."production_audition_observations" AS PERMISSIVE FOR DELETE TO public USING ((EXISTS ( SELECT 1
   FROM productions p
  WHERE ((p.id = production_audition_observations.production_id) AND (p.organization_id IN ( SELECT p.organization_id
           FROM org_members
          WHERE (org_members.user_id = auth.uid())))))));
CREATE POLICY "organisation members can insert audition observations" ON public."production_audition_observations" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1
   FROM productions p
  WHERE ((p.id = production_audition_observations.production_id) AND (p.organization_id IN ( SELECT p.organization_id
           FROM org_members
          WHERE (org_members.user_id = auth.uid())))))));
CREATE POLICY "organisation members can read audition observations" ON public."production_audition_observations" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM productions p
  WHERE ((p.id = production_audition_observations.production_id) AND (p.organization_id IN ( SELECT p.organization_id
           FROM org_members
          WHERE (org_members.user_id = auth.uid())))))));
CREATE POLICY "organisation members can update audition observations" ON public."production_audition_observations" AS PERMISSIVE FOR UPDATE TO public USING ((EXISTS ( SELECT 1
   FROM productions p
  WHERE ((p.id = production_audition_observations.production_id) AND (p.organization_id IN ( SELECT p.organization_id
           FROM org_members
          WHERE (org_members.user_id = auth.uid()))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM productions p
  WHERE ((p.id = production_audition_observations.production_id) AND (p.organization_id IN ( SELECT p.organization_id
           FROM org_members
          WHERE (org_members.user_id = auth.uid())))))));
CREATE POLICY "Org can manage audition notes" ON public."production_audition_notes" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE ((p.id = production_audition_notes.production_id) AND (o.admin_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE ((p.id = production_audition_notes.production_id) AND (o.admin_id = auth.uid())))));
CREATE POLICY "team_portal_delete_notes" ON public."production_audition_notes" AS PERMISSIVE FOR DELETE TO anon USING (true);
CREATE POLICY "team_portal_insert_notes" ON public."production_audition_notes" AS PERMISSIVE FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "team_portal_read_notes" ON public."production_audition_notes" AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY "team_portal_update_notes" ON public."production_audition_notes" AS PERMISSIVE FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "team_portal_write_notes" ON public."production_audition_notes" AS PERMISSIVE FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Org can manage room next signals" ON public."production_room_next_signals" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE ((p.id = production_room_next_signals.production_id) AND (o.admin_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE ((p.id = production_room_next_signals.production_id) AND (o.admin_id = auth.uid())))));
CREATE POLICY "Org can manage audition room states" ON public."production_audition_room_states" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE ((p.id = production_audition_room_states.production_id) AND (o.admin_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (productions p
     JOIN organizations o ON ((o.id = p.organization_id)))
  WHERE ((p.id = production_audition_room_states.production_id) AND (o.admin_id = auth.uid())))));
