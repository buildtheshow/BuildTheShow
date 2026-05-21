CREATE TABLE IF NOT EXISTS production_audition_live_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  production_id uuid NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  session_id uuid REFERENCES audition_sessions(id) ON DELETE CASCADE,
  application_id uuid REFERENCES audition_applications(id) ON DELETE SET NULL,
  room_key text,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_by_team_member_id uuid REFERENCES production_team_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT production_audition_live_events_type_check
    CHECK (event_type IN (
      'performer_checked_in',
      'performer_marked_no_show',
      'performer_unchecked',
      'room_requested_next',
      'performer_sent_to_room',
      'room_started_audition',
      'room_finished_audition'
    ))
);

CREATE TABLE IF NOT EXISTS production_audition_live_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  production_id uuid NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  session_id uuid REFERENCES audition_sessions(id) ON DELETE CASCADE,
  application_id uuid REFERENCES audition_applications(id) ON DELETE SET NULL,
  room_key text,
  state_key text NOT NULL,
  state_type text NOT NULL,
  event_type text,
  status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by text,
  updated_by_team_member_id uuid REFERENCES production_team_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT production_audition_live_state_type_check
    CHECK (state_type IN ('performer_checkin','room_request','room_state','slot_tally'))
);

ALTER TABLE production_audition_live_events
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES audition_sessions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES audition_applications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS room_key text,
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS created_by_team_member_id uuid REFERENCES production_team_members(id) ON DELETE SET NULL;

ALTER TABLE production_audition_live_state
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES audition_sessions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES audition_applications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS room_key text,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_by text,
  ADD COLUMN IF NOT EXISTS updated_by_team_member_id uuid REFERENCES production_team_members(id) ON DELETE SET NULL;

UPDATE production_audition_live_events evt
SET organization_id = p.organization_id
FROM productions p
WHERE evt.production_id = p.id
  AND evt.organization_id IS NULL;

UPDATE production_audition_live_state st
SET organization_id = p.organization_id
FROM productions p
WHERE st.production_id = p.id
  AND st.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS production_audition_live_events_lookup_idx
  ON production_audition_live_events (production_id, session_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS production_audition_live_events_room_idx
  ON production_audition_live_events (production_id, room_key, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS production_audition_live_state_key_idx
  ON production_audition_live_state (production_id, state_key);

CREATE INDEX IF NOT EXISTS production_audition_live_state_lookup_idx
  ON production_audition_live_state (production_id, state_type, session_id, updated_at DESC);

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS production_audition_live_state_touch_updated_at ON production_audition_live_state;
CREATE TRIGGER production_audition_live_state_touch_updated_at
BEFORE UPDATE ON production_audition_live_state
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE production_audition_live_events;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE production_audition_live_state;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE production_audition_live_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_audition_live_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org can manage audition live events" ON production_audition_live_events;
CREATE POLICY "Org can manage audition live events"
ON production_audition_live_events
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM productions p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = production_audition_live_events.production_id
      AND o.admin_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM productions p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = production_audition_live_events.production_id
      AND o.admin_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Org can manage audition live state" ON production_audition_live_state;
CREATE POLICY "Org can manage audition live state"
ON production_audition_live_state
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM productions p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = production_audition_live_state.production_id
      AND o.admin_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM productions p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = production_audition_live_state.production_id
      AND o.admin_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION team_audition_live_state_list_for_session(
  p_production_id uuid,
  p_session_token text
)
RETURNS SETOF production_audition_live_state
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
  FROM production_audition_live_state
  WHERE production_id = p_production_id;
END;
$$;

GRANT EXECUTE ON FUNCTION team_audition_live_state_list_for_session(uuid,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION team_audition_live_event_apply_for_session(
  p_production_id uuid,
  p_session_token text,
  p_session_id uuid,
  p_application_id uuid,
  p_room_key text,
  p_event_type text,
  p_payload jsonb,
  p_state_key text,
  p_state_type text,
  p_status text
)
RETURNS SETOF production_audition_live_state
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
$$;

GRANT EXECUTE ON FUNCTION team_audition_live_event_apply_for_session(uuid,text,uuid,uuid,text,text,jsonb,text,text,text) TO anon, authenticated;
