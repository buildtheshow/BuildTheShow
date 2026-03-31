-- ============================================================
-- Build The Show — Pending SQL Migrations
-- Run each block in the Supabase SQL Editor
-- ============================================================

-- ── 1. Production URL slugs ──────────────────────────────────
-- Already referenced in production-workspace.html saveSlug()
ALTER TABLE productions ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS productions_slug_idx ON productions (slug);

-- ── 2. Profiles: add email column (for BTS ID invite lookup) ─
-- profile-create.html already saves email on new profiles.
-- This column doesn't exist yet on the table.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- ── 3. Audition applications: session + time slot columns ────
-- audition.html now passes session_id and time_slot_id on submit.
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS session_id   uuid REFERENCES audition_sessions(id)    ON DELETE SET NULL;
ALTER TABLE audition_applications ADD COLUMN IF NOT EXISTS time_slot_id uuid REFERENCES audition_time_slots(id)  ON DELETE SET NULL;

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
