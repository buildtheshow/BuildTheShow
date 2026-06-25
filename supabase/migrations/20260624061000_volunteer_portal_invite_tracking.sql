ALTER TABLE volunteer_signups
  ADD COLUMN IF NOT EXISTS portal_invite_sent_at timestamptz;
