CREATE OR REPLACE FUNCTION public_production_contact(p_production_id uuid)
RETURNS TABLE (
  name text,
  role text,
  email text,
  phone text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    tm.name,
    tm.role,
    tm.email,
    tm.phone
  FROM production_team_members tm
  WHERE tm.production_id = p_production_id
    AND coalesce(tm.is_active, true) = true
    AND lower(coalesce(tm.access_level, tm.role, '')) IN ('producer', 'owner', 'admin', 'administrator')
  ORDER BY
    CASE
      WHEN lower(coalesce(tm.access_level, tm.role, '')) = 'producer' THEN 0
      WHEN lower(coalesce(tm.access_level, tm.role, '')) = 'owner' THEN 1
      ELSE 2
    END,
    tm.created_at ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public_production_contact(uuid) TO anon, authenticated;
