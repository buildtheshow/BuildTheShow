-- ============================================================
-- Build The Show — Pending SQL Migrations
-- Run each block in the Supabase SQL Editor
-- ============================================================

-- ── 1. Production URL slugs ──────────────────────────────────
-- Already referenced in production-workspace.html saveSlug()
ALTER TABLE productions ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS productions_slug_idx ON productions (slug);

-- ── 1c. Production events: public Apollo visibility flag ─────
-- Controls whether an event shows on the public audition page (Apollo).
-- Audition/performance types default true; meetings/rehearsals default false.
ALTER TABLE production_events ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;
UPDATE production_events
SET is_public = true
WHERE event_type IN ('audition','dance_call','callback','other_audition','performance','dress','tech')
  AND is_public IS DISTINCT FROM true;

-- ── 1b. Organisation link slugs ───────────────────────────────
-- Used for clean audition URLs: buildtheshow.com/RYT/Audition/Annie2026
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_idx ON organizations (slug);
-- Backfill existing orgs from abbreviation (e.g. RYT) or name
UPDATE organizations
SET slug = regexp_replace(abbreviation, '[^a-zA-Z0-9]', '', 'g')
WHERE abbreviation IS NOT NULL AND (slug IS NULL OR slug = '');
UPDATE organizations
SET slug = regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')
WHERE (slug IS NULL OR slug = '');

-- ── 2. Profiles: add email column (for BTS ID invite lookup) ─
-- profile-create.html already saves email on new profiles.
-- This column doesn't exist yet on the table.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- ── 3. Audition applications: session + time slot columns ────
-- audition.html now passes session_id and time_slot_id on submit.
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS session_id   uuid REFERENCES audition_sessions(id)    ON DELETE SET NULL;
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS time_slot_id uuid REFERENCES audition_time_slots(id)  ON DELETE SET NULL;
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS attendance_mode text;
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS slot_assignments jsonb DEFAULT '[]'::jsonb;
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS audition_type_1 uuid REFERENCES audition_sessions(id) ON DELETE SET NULL;
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS audition_slot_1 uuid REFERENCES audition_time_slots(id) ON DELETE SET NULL;
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS audition_type_2 uuid REFERENCES audition_sessions(id) ON DELETE SET NULL;
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS audition_slot_2 uuid REFERENCES audition_time_slots(id) ON DELETE SET NULL;
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS audition_type_3 uuid REFERENCES audition_sessions(id) ON DELETE SET NULL;
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS audition_slot_3 uuid REFERENCES audition_time_slots(id) ON DELETE SET NULL;
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS audition_type_4 uuid REFERENCES audition_sessions(id) ON DELETE SET NULL;
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS audition_slot_4 uuid REFERENCES audition_time_slots(id) ON DELETE SET NULL;
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS audition_type_5 uuid REFERENCES audition_sessions(id) ON DELETE SET NULL;
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS audition_slot_5 uuid REFERENCES audition_time_slots(id) ON DELETE SET NULL;
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS audition_type_6 uuid REFERENCES audition_sessions(id) ON DELETE SET NULL;
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS audition_slot_6 uuid REFERENCES audition_time_slots(id) ON DELETE SET NULL;
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS audition_type_7 uuid REFERENCES audition_sessions(id) ON DELETE SET NULL;
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS audition_slot_7 uuid REFERENCES audition_time_slots(id) ON DELETE SET NULL;
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS audition_type_8 uuid REFERENCES audition_sessions(id) ON DELETE SET NULL;
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS audition_slot_8 uuid REFERENCES audition_time_slots(id) ON DELETE SET NULL;
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS audition_type_9 uuid REFERENCES audition_sessions(id) ON DELETE SET NULL;
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS audition_slot_9 uuid REFERENCES audition_time_slots(id) ON DELETE SET NULL;
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS audition_type_10 uuid REFERENCES audition_sessions(id) ON DELETE SET NULL;
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS audition_slot_10 uuid REFERENCES audition_time_slots(id) ON DELETE SET NULL;

ALTER TABLE audition_bookings ADD COLUMN IF NOT EXISTS attendance_mode text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audition_applications_attendance_mode_check'
  ) THEN
    ALTER TABLE audition_applications
      ADD CONSTRAINT audition_applications_attendance_mode_check
      CHECK (attendance_mode IS NULL OR attendance_mode IN ('in_person', 'video_call'));
  END IF;
END $$;

-- ── 8. Production audition team access + shared notes ────────
-- The production team area reuses the audition pages with role-based
-- permissions. Notes are shared across producer/team views and keyed
-- to the author person, not the author's role.
CREATE TABLE IF NOT EXISTS production_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id uuid NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'director',
  passcode text NOT NULL,
  note_color text DEFAULT '#572e88',
  bio text,
  headshot_url text,
  headshot_path text,
  is_active boolean NOT NULL DEFAULT true,
  invite_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (production_id, email)
);

UPDATE production_team_members
SET passcode = lpad(floor(random() * 1000000)::int::text, 6, '0')
WHERE passcode IS NULL OR passcode !~ '^[0-9]{6}$';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'production_team_members_passcode_six_digits_check'
  ) THEN
    ALTER TABLE production_team_members
      ADD CONSTRAINT production_team_members_passcode_six_digits_check
      CHECK (passcode ~ '^[0-9]{6}$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS production_team_members_colour_unique
  ON production_team_members (production_id, lower(note_color))
  WHERE is_active = true AND note_color IS NOT NULL;

CREATE TABLE IF NOT EXISTS production_team_member_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id uuid NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES production_team_members(id) ON DELETE CASCADE,
  session_token text NOT NULL UNIQUE,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS production_team_member_sessions_lookup_idx
  ON production_team_member_sessions (production_id, session_token)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS production_audition_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id uuid NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES audition_applications(id) ON DELETE CASCADE,
  session_id uuid REFERENCES audition_sessions(id) ON DELETE SET NULL,
  character_id uuid REFERENCES characters(id) ON DELETE SET NULL,
  team_member_id uuid REFERENCES production_team_members(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  author_email text,
  author_role text,
  author_color text DEFAULT '#572e88',
  note_area text NOT NULL DEFAULT 'in_room',
  note_type text NOT NULL DEFAULT 'general',
  note_rating integer CHECK (note_rating IS NULL OR note_rating BETWEEN 1 AND 5),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE production_audition_notes ADD COLUMN IF NOT EXISTS author_email text;
ALTER TABLE production_audition_notes ADD COLUMN IF NOT EXISTS note_type text NOT NULL DEFAULT 'general';
ALTER TABLE production_audition_notes ADD COLUMN IF NOT EXISTS note_rating integer;
ALTER TABLE production_audition_notes ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS production_audition_notes_prod_idx
  ON production_audition_notes (production_id, applicant_id, session_id, created_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'production_audition_notes_note_type_check'
  ) THEN
    ALTER TABLE production_audition_notes
      ADD CONSTRAINT production_audition_notes_note_type_check
      CHECK (note_type IN ('acting','vocals','dance','general','callback_interest','role_suggestion'));
  END IF;
END $$;

ALTER TABLE production_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_team_member_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_audition_notes ENABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS team_member_login(uuid,text,text);
DROP FUNCTION IF EXISTS team_member_start_session(uuid,text,text,text);
DROP FUNCTION IF EXISTS team_member_start_session_for_portal(text,text,text,text,text);
DROP FUNCTION IF EXISTS team_member_resume_session(uuid,text);
DROP FUNCTION IF EXISTS team_member_revoke_session(uuid,text);
DROP FUNCTION IF EXISTS team_member_colour_list(uuid,text,text);
DROP FUNCTION IF EXISTS team_member_colour_list_for_session(uuid,text);
DROP FUNCTION IF EXISTS team_member_update_profile(uuid,text,text,text,text,text,text);
ALTER TABLE production_team_members
  ADD COLUMN IF NOT EXISTS phone text;

DROP FUNCTION IF EXISTS team_member_update_profile_for_session(uuid,text,text,text,text,text);
DROP FUNCTION IF EXISTS team_member_update_profile_for_session(uuid,text,text,text,text,text,text,text);
DROP FUNCTION IF EXISTS team_member_update_profile_for_session(uuid,text,text,text,text,text,text,text,text);
DROP FUNCTION IF EXISTS team_note_add(uuid,text,text,uuid,uuid,uuid,text,text,text,integer);
DROP FUNCTION IF EXISTS team_note_update(uuid,text,text,uuid,text);
DROP FUNCTION IF EXISTS team_note_delete(uuid,text,text,uuid);
DROP FUNCTION IF EXISTS team_note_add_for_session(uuid,text,uuid,uuid,uuid,text,text,text,integer);
DROP FUNCTION IF EXISTS team_note_update_for_session(uuid,text,uuid,text);
DROP FUNCTION IF EXISTS team_note_delete_for_session(uuid,text,uuid);
DROP FUNCTION IF EXISTS remove_production_team_member(uuid,uuid);

CREATE OR REPLACE FUNCTION remove_production_team_member(
  p_production_id uuid,
  p_team_member_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_observations_deleted integer := 0;
  v_notes_deleted integer := 0;
  v_sessions_deleted integer := 0;
  v_members_deleted integer := 0;
BEGIN
  IF to_regclass('public.production_audition_observations') IS NOT NULL THEN
    EXECUTE
      'DELETE FROM production_audition_observations
       WHERE production_id = $1
         AND team_member_id = $2'
    USING p_production_id, p_team_member_id;
    GET DIAGNOSTICS v_observations_deleted = ROW_COUNT;
  END IF;

  DELETE FROM production_audition_notes
  WHERE production_id = p_production_id
    AND team_member_id = p_team_member_id;
  GET DIAGNOSTICS v_notes_deleted = ROW_COUNT;

  DELETE FROM production_team_member_sessions
  WHERE production_id = p_production_id
    AND team_member_id = p_team_member_id;
  GET DIAGNOSTICS v_sessions_deleted = ROW_COUNT;

  DELETE FROM production_team_members
  WHERE production_id = p_production_id
    AND id = p_team_member_id;
  GET DIAGNOSTICS v_members_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'team_members_deleted', v_members_deleted,
    'sessions_deleted', v_sessions_deleted,
    'notes_deleted', v_notes_deleted,
    'observations_deleted', v_observations_deleted
  );
END;
$$;

CREATE OR REPLACE FUNCTION team_member_start_session(
  p_production_id uuid,
  p_email text,
  p_passcode text,
  p_user_agent text DEFAULT NULL
)
RETURNS TABLE(
  session_token text,
  expires_at timestamptz,
  team_member production_team_members
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION team_member_start_session_for_portal(
  p_org_abbrev text,
  p_show_slug text,
  p_email text,
  p_passcode text,
  p_user_agent text DEFAULT NULL
)
RETURNS TABLE(
  production_id uuid,
  session_token text,
  expires_at timestamptz,
  team_member production_team_members
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION team_member_resume_session(
  p_production_id uuid,
  p_session_token text
)
RETURNS SETOF production_team_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION team_member_revoke_session(
  p_production_id uuid,
  p_session_token text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE production_team_member_sessions
  SET revoked_at = now()
  WHERE production_id = p_production_id
    AND session_token = trim(p_session_token)
    AND revoked_at IS NULL;

  SELECT true;
$$;

CREATE OR REPLACE FUNCTION team_member_colour_list_for_session(
  p_production_id uuid,
  p_session_token text
)
RETURNS TABLE(team_member_id uuid, note_color text, name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION team_member_update_profile_for_session(
  p_production_id uuid,
  p_session_token text,
  p_note_color text,
  p_name text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_headshot_url text DEFAULT NULL,
  p_headshot_path text DEFAULT NULL
)
RETURNS SETOF production_team_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION team_member_colour_list(
  p_production_id uuid,
  p_email text,
  p_passcode text
)
RETURNS TABLE(team_member_id uuid, note_color text, name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION team_member_update_profile(
  p_production_id uuid,
  p_email text,
  p_passcode text,
  p_note_color text,
  p_new_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_headshot_url text DEFAULT NULL,
  p_headshot_path text DEFAULT NULL
)
RETURNS SETOF production_team_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION team_note_list(
  p_production_id uuid,
  p_email text,
  p_passcode text
)
RETURNS SETOF production_audition_notes
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION team_note_add(
  p_production_id uuid,
  p_email text,
  p_passcode text,
  p_applicant_id uuid,
  p_session_id uuid DEFAULT NULL,
  p_character_id uuid DEFAULT NULL,
  p_note_area text DEFAULT 'in_room',
  p_body text DEFAULT '',
  p_note_type text DEFAULT 'general',
  p_note_rating integer DEFAULT NULL
)
RETURNS SETOF production_audition_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION team_note_update(
  p_production_id uuid,
  p_email text,
  p_passcode text,
  p_note_id uuid,
  p_body text
)
RETURNS SETOF production_audition_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION team_note_delete(
  p_production_id uuid,
  p_email text,
  p_passcode text,
  p_note_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION team_note_add_for_session(
  p_production_id uuid,
  p_session_token text,
  p_applicant_id uuid,
  p_session_id uuid DEFAULT NULL,
  p_character_id uuid DEFAULT NULL,
  p_note_area text DEFAULT 'in_room',
  p_body text DEFAULT '',
  p_note_type text DEFAULT 'general',
  p_note_rating integer DEFAULT NULL
)
RETURNS SETOF production_audition_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION team_note_update_for_session(
  p_production_id uuid,
  p_session_token text,
  p_note_id uuid,
  p_body text
)
RETURNS SETOF production_audition_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION team_note_delete_for_session(
  p_production_id uuid,
  p_session_token text,
  p_note_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION resolve_team_portal(
  p_org_abbrev text,
  p_show_slug text
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM productions p
  JOIN organizations o ON o.id = p.organization_id
  WHERE lower(regexp_replace(COALESCE(o.slug, o.abbreviation, o.name), '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(p_org_abbrev, '[^a-zA-Z0-9]', '', 'g'))
    AND (
      lower(COALESCE(p.slug, '')) = lower(p_show_slug)
      OR lower(regexp_replace(COALESCE(p.title, ''), '[^a-zA-Z0-9]+', '-', 'g')) = lower(regexp_replace(p_show_slug, '[^a-zA-Z0-9]+', '-', 'g'))
    )
  LIMIT 1;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audition_bookings_attendance_mode_check'
  ) THEN
    ALTER TABLE audition_bookings
      ADD CONSTRAINT audition_bookings_attendance_mode_check
      CHECK (attendance_mode IS NULL OR attendance_mode IN ('in_person', 'video_call'));
  END IF;
END $$;

-- ── 4. Audition time slots: is_available default ─────────────
-- Ensure column exists (may already be present)
ALTER TABLE audition_time_slots ADD COLUMN IF NOT EXISTS is_available boolean DEFAULT true;

-- ── 5. RLS: profiles email column accessible to authenticated ─
-- Existing RLS policies on profiles already cover the whole row.
-- No new policy needed unless you lock down individual columns.

-- ── 6. RLS: audition_time_slots update by anon (for booking) ─
-- Public users (no login) need to mark slots as unavailable on submit.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audition_time_slots'
      AND policyname = 'Public can mark slot unavailable'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Public can mark slot unavailable"
        ON audition_time_slots
        FOR UPDATE
        USING (is_available = true)
        WITH CHECK (is_available = false);
    $p$;
  END IF;
END $$;

-- Enable RLS on audition_time_slots if not already
ALTER TABLE audition_time_slots ENABLE ROW LEVEL SECURITY;

-- ── 7. RLS: audition_applications insert by anon ─────────────
-- Public applicants are not logged in — they need INSERT rights.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audition_applications'
      AND policyname = 'Public can submit audition application'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Public can submit audition application"
        ON audition_applications
        FOR INSERT
        WITH CHECK (true);
    $p$;
  END IF;
END $$;

-- ── 9. production_audition_observations + RPCs ───────────────────────────────
-- Stores structured per-applicant scores, role decisions, and quick notes
-- keyed by area/type/key and author (team member OR organisation).
-- Team portal writes here via session-token RPCs (SECURITY DEFINER).
-- Org admin reads directly via RLS. Team members read via team_observations_for_production.

CREATE TABLE IF NOT EXISTS production_audition_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id uuid NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES audition_applications(id) ON DELETE CASCADE,
  session_id uuid REFERENCES audition_sessions(id) ON DELETE SET NULL,
  character_id uuid,
  source_type text NOT NULL DEFAULT 'team_member',
  team_member_id uuid REFERENCES production_team_members(id) ON DELETE SET NULL,
  author_name text,
  author_role text,
  author_color text DEFAULT '#572e88',
  observation_area text NOT NULL DEFAULT 'in_room',
  observation_type text NOT NULL DEFAULT 'general',
  observation_key text NOT NULL DEFAULT 'general',
  value text,
  body text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE production_audition_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admin can manage production audition observations" ON production_audition_observations;
CREATE POLICY "Org admin can manage production audition observations" ON production_audition_observations
  USING (production_id IN (
    SELECT p.id FROM productions p
    JOIN organizations o ON o.id = p.organization_id
    WHERE o.admin_id = auth.uid()
  ))
  WITH CHECK (production_id IN (
    SELECT p.id FROM productions p
    JOIN organizations o ON o.id = p.organization_id
    WHERE o.admin_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS production_audition_observations_prod_idx
  ON production_audition_observations (production_id, applicant_id, session_id, created_at);

-- READ: team member reads all observations for a production
DROP FUNCTION IF EXISTS team_observations_for_production(uuid,text);
CREATE OR REPLACE FUNCTION team_observations_for_production(
  p_production_id uuid,
  p_session_token text
)
RETURNS SETOF production_audition_observations
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
  SELECT o.*
  FROM production_audition_observations o
  WHERE EXISTS (SELECT 1 FROM authed)
    AND o.production_id = p_production_id
  ORDER BY o.created_at ASC;
$$;

-- WRITE: team member upserts an observation
DROP FUNCTION IF EXISTS team_observation_upsert_for_session(uuid,text,uuid,uuid,uuid,text,text,text,text,text,jsonb);
CREATE OR REPLACE FUNCTION team_observation_upsert_for_session(
  p_production_id uuid,
  p_session_token text,
  p_applicant_id uuid,
  p_session_id uuid DEFAULT NULL,
  p_character_id uuid DEFAULT NULL,
  p_observation_area text DEFAULT 'in_room',
  p_observation_type text DEFAULT 'general',
  p_observation_key text DEFAULT 'general',
  p_value text DEFAULT NULL,
  p_body text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS SETOF production_audition_observations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member production_team_members%ROWTYPE;
  v_obs_id uuid;
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

  UPDATE production_team_member_sessions
  SET last_used_at = now()
  WHERE production_id = p_production_id
    AND session_token = trim(p_session_token)
    AND revoked_at IS NULL;

  SELECT id INTO v_obs_id
  FROM production_audition_observations
  WHERE production_id = p_production_id
    AND applicant_id = p_applicant_id
    AND source_type = 'team_member'
    AND team_member_id = v_member.id
    AND observation_area = p_observation_area
    AND observation_type = p_observation_type
    AND observation_key = p_observation_key
    AND (p_session_id IS NULL AND session_id IS NULL OR session_id = p_session_id)
    AND (p_character_id IS NULL AND character_id IS NULL OR character_id = p_character_id)
  LIMIT 1;

  IF v_obs_id IS NOT NULL THEN
    UPDATE production_audition_observations
    SET value = p_value,
        body = p_body,
        metadata = COALESCE(p_metadata, '{}'),
        updated_at = now()
    WHERE id = v_obs_id;
  ELSE
    INSERT INTO production_audition_observations (
      production_id, applicant_id, session_id, character_id,
      source_type, team_member_id,
      author_name, author_role, author_color,
      observation_area, observation_type, observation_key,
      value, body, metadata
    )
    VALUES (
      p_production_id, p_applicant_id, p_session_id, p_character_id,
      'team_member', v_member.id,
      v_member.name, v_member.role, v_member.note_color,
      p_observation_area, p_observation_type, p_observation_key,
      p_value, p_body, COALESCE(p_metadata, '{}')
    )
    RETURNING id INTO v_obs_id;
  END IF;

  RETURN QUERY SELECT * FROM production_audition_observations WHERE id = v_obs_id;
END;
$$;

-- DELETE: team member removes their own observation
DROP FUNCTION IF EXISTS team_observation_delete_for_session(uuid,text,uuid);
CREATE OR REPLACE FUNCTION team_observation_delete_for_session(
  p_production_id uuid,
  p_session_token text,
  p_observation_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  DELETE FROM production_audition_observations
  WHERE id = p_observation_id
    AND production_id = p_production_id
    AND team_member_id = v_member.id;

  UPDATE production_team_member_sessions
  SET last_used_at = now()
  WHERE production_id = p_production_id
    AND session_token = trim(p_session_token)
    AND revoked_at IS NULL;

  RETURN FOUND;
END;
$$;

-- WRITE: org admin upserts an observation
DROP FUNCTION IF EXISTS organisation_observation_upsert(uuid,uuid,uuid,uuid,text,text,text,text,text,jsonb,text,text,text);
CREATE OR REPLACE FUNCTION organisation_observation_upsert(
  p_production_id uuid,
  p_applicant_id uuid,
  p_session_id uuid DEFAULT NULL,
  p_character_id uuid DEFAULT NULL,
  p_observation_area text DEFAULT 'in_room',
  p_observation_type text DEFAULT 'general',
  p_observation_key text DEFAULT 'general',
  p_value text DEFAULT NULL,
  p_body text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}',
  p_author_name text DEFAULT NULL,
  p_author_role text DEFAULT NULL,
  p_author_color text DEFAULT '#b8b4c0'
)
RETURNS SETOF production_audition_observations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_obs_id uuid;
BEGIN
  SELECT id INTO v_obs_id
  FROM production_audition_observations
  WHERE production_id = p_production_id
    AND applicant_id = p_applicant_id
    AND source_type = 'organisation'
    AND team_member_id IS NULL
    AND observation_area = p_observation_area
    AND observation_type = p_observation_type
    AND observation_key = p_observation_key
    AND (p_session_id IS NULL AND session_id IS NULL OR session_id = p_session_id)
    AND (p_character_id IS NULL AND character_id IS NULL OR character_id = p_character_id)
  LIMIT 1;

  IF v_obs_id IS NOT NULL THEN
    UPDATE production_audition_observations
    SET value = p_value,
        body = p_body,
        metadata = COALESCE(p_metadata, '{}'),
        updated_at = now()
    WHERE id = v_obs_id;
  ELSE
    INSERT INTO production_audition_observations (
      production_id, applicant_id, session_id, character_id,
      source_type, team_member_id,
      author_name, author_role, author_color,
      observation_area, observation_type, observation_key,
      value, body, metadata
    )
    VALUES (
      p_production_id, p_applicant_id, p_session_id, p_character_id,
      'organisation', NULL,
      p_author_name, p_author_role, p_author_color,
      p_observation_area, p_observation_type, p_observation_key,
      p_value, p_body, COALESCE(p_metadata, '{}')
    )
    RETURNING id INTO v_obs_id;
  END IF;

  RETURN QUERY SELECT * FROM production_audition_observations WHERE id = v_obs_id;
END;
$$;

-- DELETE: org admin removes an observation
DROP FUNCTION IF EXISTS organisation_observation_delete(uuid,uuid);
CREATE OR REPLACE FUNCTION organisation_observation_delete(
  p_production_id uuid,
  p_observation_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM production_audition_observations
  WHERE id = p_observation_id
    AND production_id = p_production_id
    AND source_type = 'organisation';

  RETURN FOUND;
END;
$$;

-- READ: team member reads all authored notes for a production (session-token version)
DROP FUNCTION IF EXISTS team_authored_notes_for_production(uuid,text);
CREATE OR REPLACE FUNCTION team_authored_notes_for_production(
  p_production_id uuid,
  p_session_token text
)
RETURNS SETOF production_audition_notes
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
  SELECT n.*
  FROM production_audition_notes n
  WHERE EXISTS (SELECT 1 FROM authed)
    AND n.production_id = p_production_id
  ORDER BY n.created_at ASC;
$$;

-- GRANTS
GRANT EXECUTE ON FUNCTION team_observations_for_production(uuid,text) TO anon;
GRANT EXECUTE ON FUNCTION team_observation_upsert_for_session(uuid,text,uuid,uuid,uuid,text,text,text,text,text,jsonb) TO anon;
GRANT EXECUTE ON FUNCTION team_observation_delete_for_session(uuid,text,uuid) TO anon;
GRANT EXECUTE ON FUNCTION team_authored_notes_for_production(uuid,text) TO anon;
GRANT EXECUTE ON FUNCTION organisation_observation_upsert(uuid,uuid,uuid,uuid,text,text,text,text,text,jsonb,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION organisation_observation_delete(uuid,uuid) TO authenticated;

-- ── 10. production_room_next_signals ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_room_next_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  production_id uuid NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  session_id uuid REFERENCES audition_sessions(id) ON DELETE CASCADE,
  audition_type text,
  room_id text NOT NULL DEFAULT 'main',
  room_key text NOT NULL,
  room_name text,
  status text NOT NULL DEFAULT 'ready',
  current_applicant_id uuid REFERENCES audition_applications(id) ON DELETE SET NULL,
  current_group_key text,
  current_group_label text,
  current_group_member_ids uuid[] NOT NULL DEFAULT '{}',
  next_applicant_id uuid REFERENCES audition_applications(id) ON DELETE SET NULL,
  next_group_key text,
  next_group_label text,
  next_group_member_ids uuid[] NOT NULL DEFAULT '{}',
  next_label text,
  requested_by text,
  requested_by_team_member_id uuid REFERENCES production_team_members(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT production_room_next_signals_status_check
    CHECK (status IN ('ready','sent','dismissed'))
);

ALTER TABLE production_room_next_signals
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS audition_type text,
  ADD COLUMN IF NOT EXISTS room_id text NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS room_key text,
  ADD COLUMN IF NOT EXISTS room_name text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS current_applicant_id uuid REFERENCES audition_applications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_group_key text,
  ADD COLUMN IF NOT EXISTS current_group_label text,
  ADD COLUMN IF NOT EXISTS current_group_member_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS next_applicant_id uuid REFERENCES audition_applications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS next_group_key text,
  ADD COLUMN IF NOT EXISTS next_group_label text,
  ADD COLUMN IF NOT EXISTS next_group_member_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS next_label text,
  ADD COLUMN IF NOT EXISTS requested_by text,
  ADD COLUMN IF NOT EXISTS requested_by_team_member_id uuid REFERENCES production_team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE production_room_next_signals signal
SET organization_id = p.organization_id
FROM productions p
WHERE signal.production_id = p.id
  AND signal.organization_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS production_room_next_signals_room_key_idx
  ON production_room_next_signals (production_id, room_key);

CREATE INDEX IF NOT EXISTS production_room_next_signals_live_idx
  ON production_room_next_signals (production_id, status, updated_at);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE production_room_next_signals;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE production_room_next_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org can manage room next signals" ON production_room_next_signals;
CREATE POLICY "Org can manage room next signals"
ON production_room_next_signals
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM productions p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = production_room_next_signals.production_id
      AND o.admin_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM productions p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = production_room_next_signals.production_id
      AND o.admin_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS production_room_next_signals_touch_updated_at ON production_room_next_signals;
CREATE TRIGGER production_room_next_signals_touch_updated_at
BEFORE UPDATE ON production_room_next_signals
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE OR REPLACE FUNCTION team_next_signal_list_for_session(
  p_production_id uuid,
  p_session_token text
)
RETURNS SETOF production_room_next_signals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION team_next_signal_upsert_for_session(
  p_production_id uuid,
  p_session_token text,
  p_session_id uuid,
  p_audition_type text,
  p_room_id text,
  p_room_key text,
  p_room_name text,
  p_current_applicant_id uuid DEFAULT NULL,
  p_current_group_key text DEFAULT NULL,
  p_current_group_label text DEFAULT NULL,
  p_current_group_member_ids uuid[] DEFAULT '{}',
  p_next_applicant_id uuid DEFAULT NULL,
  p_next_group_key text DEFAULT NULL,
  p_next_group_label text DEFAULT NULL,
  p_next_group_member_ids uuid[] DEFAULT '{}',
  p_next_label text DEFAULT NULL
)
RETURNS SETOF production_room_next_signals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    organization_id, production_id, session_id, audition_type, room_id, room_key, room_name,
    status, current_applicant_id, current_group_key, current_group_label, current_group_member_ids,
    next_applicant_id, next_group_key, next_group_label, next_group_member_ids, next_label,
    requested_by, requested_by_team_member_id, requested_at, sent_at, dismissed_at
  )
  VALUES (
    v_org_id, p_production_id, p_session_id, p_audition_type, COALESCE(NULLIF(p_room_id, ''), 'main'), p_room_key, p_room_name,
    'ready', p_current_applicant_id, p_current_group_key, p_current_group_label, COALESCE(p_current_group_member_ids, '{}'),
    p_next_applicant_id, p_next_group_key, p_next_group_label, COALESCE(p_next_group_member_ids, '{}'), p_next_label,
    v_team_member.name, v_team_member.id, now(), NULL, NULL
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
$$;

GRANT EXECUTE ON FUNCTION team_next_signal_list_for_session(uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION team_next_signal_upsert_for_session(uuid,text,uuid,text,text,text,text,uuid,text,text,uuid[],uuid,text,text,uuid[],text) TO anon, authenticated;
