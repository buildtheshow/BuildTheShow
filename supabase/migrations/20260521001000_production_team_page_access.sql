CREATE TABLE IF NOT EXISTS production_permission_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL UNIQUE,
  parent_page_key text,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS production_team_member_page_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id uuid NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES production_team_members(id) ON DELETE CASCADE,
  page_key text NOT NULL REFERENCES production_permission_pages(page_key) ON DELETE CASCADE,
  access_level text NOT NULL DEFAULT 'none',
  granted_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (production_id, team_member_id, page_key),
  CHECK (access_level IN ('none', 'view', 'edit', 'manage'))
);

CREATE TABLE IF NOT EXISTS production_team_member_special_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id uuid NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES production_team_members(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  granted_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (production_id, team_member_id, permission_key),
  CHECK (permission_key IN ('manage_access'))
);

CREATE TABLE IF NOT EXISTS production_access_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id uuid NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  changed_user_id uuid,
  changed_by_user_id uuid,
  permission_key text,
  page_key text,
  previous_access_level text,
  new_access_level text,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO production_permission_pages (page_key, parent_page_key, label, sort_order, is_active)
VALUES
  ('overview', null, 'Overview', 10, true),
  ('auditions.dashboard', 'auditions', 'Dashboard', 20, true),
  ('auditions.schedule', 'auditions', 'Audition Schedule', 30, true),
  ('auditions.general', 'auditions', 'General Auditions', 40, true),
  ('auditions.dance_call', 'auditions', 'Dance Call', 50, true),
  ('auditions.casting_board', 'auditions', 'Casting Board', 60, true),
  ('auditions.callback', 'auditions', 'Callback', 70, true),
  ('auditions.final_casting', 'auditions', 'Final Casting', 80, true),
  ('cast_list', null, 'Cast List', 90, true),
  ('production_team', null, 'Production Team', 100, true)
ON CONFLICT (page_key) DO UPDATE
SET parent_page_key = EXCLUDED.parent_page_key,
    label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

CREATE INDEX IF NOT EXISTS production_team_member_page_permissions_member_idx
  ON production_team_member_page_permissions (production_id, team_member_id);

CREATE INDEX IF NOT EXISTS production_team_member_special_permissions_member_idx
  ON production_team_member_special_permissions (production_id, team_member_id);

CREATE INDEX IF NOT EXISTS production_access_audit_log_prod_idx
  ON production_access_audit_log (production_id, created_at DESC);

WITH creative_members AS (
  SELECT m.production_id, m.id AS team_member_id, p.page_key
  FROM production_team_members m
  CROSS JOIN (
    VALUES
      ('overview'),
      ('auditions.dashboard'),
      ('auditions.schedule'),
      ('auditions.general'),
      ('auditions.dance_call'),
      ('auditions.casting_board'),
      ('auditions.callback'),
      ('auditions.final_casting'),
      ('cast_list')
  ) AS p(page_key)
  WHERE m.is_active = true
    AND (
      lower(coalesce(m.department, '')) IN ('creative team', 'artistic team')
      OR lower(coalesce(m.access_level, '')) IN ('creative', 'producer', 'admin')
      OR lower(coalesce(m.role, '')) IN ('producer', 'admin', 'administrator', 'director', 'vocal director', 'music director', 'musical director', 'choreographer')
    )
)
INSERT INTO production_team_member_page_permissions (
  production_id, team_member_id, page_key, access_level, granted_by, updated_at
)
SELECT production_id, team_member_id, page_key, 'manage', null, now()
FROM creative_members
ON CONFLICT (production_id, team_member_id, page_key) DO NOTHING;

INSERT INTO production_team_member_special_permissions (
  production_id, team_member_id, permission_key, granted_by, updated_at
)
SELECT production_id, id, 'manage_access', null, now()
FROM production_team_members
WHERE is_active = true
  AND lower(coalesce(access_level, role, '')) IN ('producer', 'admin', 'administrator', 'owner')
ON CONFLICT (production_id, team_member_id, permission_key) DO NOTHING;

ALTER TABLE production_permission_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_team_member_page_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_team_member_special_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_access_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Production permission pages are readable" ON production_permission_pages;
CREATE POLICY "Production permission pages are readable" ON production_permission_pages
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Org admin can manage production page permissions" ON production_team_member_page_permissions;
CREATE POLICY "Org admin can manage production page permissions" ON production_team_member_page_permissions
FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM productions p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = production_team_member_page_permissions.production_id
      AND o.admin_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1
    FROM productions p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = production_team_member_page_permissions.production_id
      AND o.admin_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Org admin can manage production special permissions" ON production_team_member_special_permissions;
CREATE POLICY "Org admin can manage production special permissions" ON production_team_member_special_permissions
FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM productions p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = production_team_member_special_permissions.production_id
      AND o.admin_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1
    FROM productions p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = production_team_member_special_permissions.production_id
      AND o.admin_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Org admin can read production access audit log" ON production_access_audit_log;
CREATE POLICY "Org admin can read production access audit log" ON production_access_audit_log
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM productions p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = production_access_audit_log.production_id
      AND o.admin_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Org admin can insert production access audit log" ON production_access_audit_log;
CREATE POLICY "Org admin can insert production access audit log" ON production_access_audit_log
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM productions p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = production_access_audit_log.production_id
      AND o.admin_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION team_member_page_access_for_session(
  p_production_id uuid,
  p_session_token text
)
RETURNS TABLE(
  team_member_id uuid,
  page_key text,
  access_level text,
  permission_key text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION team_members_for_session(
  p_production_id uuid,
  p_session_token text
)
RETURNS SETOF production_team_members
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION team_member_manage_page_access_for_session(
  p_production_id uuid,
  p_session_token text,
  p_target_team_member_id uuid,
  p_page_permissions jsonb,
  p_manage_access boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION team_member_page_access_for_session(uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION team_members_for_session(uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION team_member_manage_page_access_for_session(uuid,text,uuid,jsonb,boolean) TO anon, authenticated;
