-- Hotfix for team access login failures seen on 2026-04-22.
-- Fixes:
-- 1. team_member_start_session_for_portal referenced productions.season, which does not exist.
-- 2. team_member_start_session functions used gen_random_bytes(), which is unavailable in the live DB.

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
  v_notes_deleted integer := 0;
  v_sessions_deleted integer := 0;
  v_members_deleted integer := 0;
BEGIN
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
    'notes_deleted', v_notes_deleted
  );
END;
$$;
