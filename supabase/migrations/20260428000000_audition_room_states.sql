CREATE TABLE IF NOT EXISTS production_audition_room_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  production_id uuid NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  session_id uuid REFERENCES audition_sessions(id) ON DELETE CASCADE,
  audition_type text,
  room_id text NOT NULL DEFAULT 'main',
  room_key text NOT NULL,
  room_name text,
  status text NOT NULL DEFAULT 'idle',
  current_applicant_id uuid REFERENCES audition_applications(id) ON DELETE SET NULL,
  current_group_key text,
  current_group_label text,
  current_group_member_ids uuid[] NOT NULL DEFAULT '{}',
  next_applicant_id uuid REFERENCES audition_applications(id) ON DELETE SET NULL,
  next_group_key text,
  next_group_label text,
  next_group_member_ids uuid[] NOT NULL DEFAULT '{}',
  requested_by text,
  requested_by_team_member_id uuid REFERENCES production_team_members(id) ON DELETE SET NULL,
  requested_at timestamptz,
  sent_at timestamptz,
  entered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT production_audition_room_states_status_check
    CHECK (status IN ('idle','in_progress','ready_for_next','waiting_for_arrival'))
);

ALTER TABLE production_audition_room_states
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS audition_type text,
  ADD COLUMN IF NOT EXISTS room_id text NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS room_key text,
  ADD COLUMN IF NOT EXISTS room_name text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS current_applicant_id uuid REFERENCES audition_applications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_group_key text,
  ADD COLUMN IF NOT EXISTS current_group_label text,
  ADD COLUMN IF NOT EXISTS current_group_member_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS next_applicant_id uuid REFERENCES audition_applications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS next_group_key text,
  ADD COLUMN IF NOT EXISTS next_group_label text,
  ADD COLUMN IF NOT EXISTS next_group_member_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS requested_by text,
  ADD COLUMN IF NOT EXISTS requested_by_team_member_id uuid REFERENCES production_team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS entered_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE production_audition_room_states ars
SET organization_id = p.organization_id
FROM productions p
WHERE ars.production_id = p.id
  AND ars.organization_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS production_audition_room_states_room_key_idx
  ON production_audition_room_states (production_id, room_key);

CREATE INDEX IF NOT EXISTS production_audition_room_states_live_idx
  ON production_audition_room_states (production_id, status, updated_at);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE production_audition_room_states;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE production_audition_room_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org can manage audition room states" ON production_audition_room_states;
CREATE POLICY "Org can manage audition room states"
ON production_audition_room_states
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM productions p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = production_audition_room_states.production_id
      AND o.admin_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM productions p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = production_audition_room_states.production_id
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

DROP TRIGGER IF EXISTS production_audition_room_states_touch_updated_at ON production_audition_room_states;
CREATE TRIGGER production_audition_room_states_touch_updated_at
BEFORE UPDATE ON production_audition_room_states
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE OR REPLACE FUNCTION team_room_state_list_for_session(
  p_production_id uuid,
  p_session_token text
)
RETURNS SETOF production_audition_room_states
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
  FROM production_audition_room_states
  WHERE production_id = p_production_id;
END;
$$;

GRANT EXECUTE ON FUNCTION team_room_state_list_for_session(uuid,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION team_room_state_upsert_for_session(
  p_production_id uuid,
  p_session_token text,
  p_session_id uuid,
  p_audition_type text,
  p_room_id text,
  p_room_key text,
  p_room_name text,
  p_status text,
  p_current_applicant_id uuid DEFAULT NULL,
  p_current_group_key text DEFAULT NULL,
  p_current_group_label text DEFAULT NULL,
  p_current_group_member_ids uuid[] DEFAULT '{}',
  p_next_applicant_id uuid DEFAULT NULL,
  p_next_group_key text DEFAULT NULL,
  p_next_group_label text DEFAULT NULL,
  p_next_group_member_ids uuid[] DEFAULT '{}'
)
RETURNS SETOF production_audition_room_states
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
$$;

GRANT EXECUTE ON FUNCTION team_room_state_upsert_for_session(uuid,text,uuid,text,text,text,text,text,uuid,text,text,uuid[],uuid,text,text,uuid[]) TO anon, authenticated;
