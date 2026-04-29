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
