-- ============================================================
-- Build The Show — Pending SQL Migrations
-- Run each block in the Supabase SQL Editor
-- ============================================================

-- ── 1. Production URL slugs ──────────────────────────────────
-- Already referenced in production-workspace.html saveSlug()
ALTER TABLE productions ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS productions_slug_idx ON productions (slug);

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
