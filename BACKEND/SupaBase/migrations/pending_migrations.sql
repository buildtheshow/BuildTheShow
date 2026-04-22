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

-- ── 1b. Organisation URL slugs ───────────────────────────────
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

CREATE UNIQUE INDEX IF NOT EXISTS production_team_members_colour_unique
  ON production_team_members (production_id, lower(note_color))
  WHERE is_active = true AND note_color IS NOT NULL;

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
ALTER TABLE production_audition_notes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION team_member_login(
  p_production_id uuid,
  p_email text,
  p_passcode text
)
RETURNS SETOF production_team_members
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM production_team_members
  WHERE production_id = p_production_id
    AND lower(email) = lower(trim(p_email))
    AND passcode = trim(p_passcode)
    AND is_active = true
  LIMIT 1;
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
      AND lower(email) = lower(trim(p_email))
      AND passcode = trim(p_passcode)
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
    AND lower(email) = lower(trim(p_email))
    AND passcode = trim(p_passcode)
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

  UPDATE production_team_members
  SET note_color = COALESCE(NULLIF(p_note_color, ''), note_color),
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
      AND lower(email) = lower(trim(p_email))
      AND passcode = trim(p_passcode)
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
    AND lower(email) = lower(trim(p_email))
    AND passcode = trim(p_passcode)
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
    AND lower(email) = lower(trim(p_email))
    AND passcode = trim(p_passcode)
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
    AND lower(email) = lower(trim(p_email))
    AND passcode = trim(p_passcode)
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
