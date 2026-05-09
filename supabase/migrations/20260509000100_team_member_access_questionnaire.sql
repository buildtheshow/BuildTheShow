ALTER TABLE production_team_members
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS access_level text DEFAULT 'creative',
  ADD COLUMN IF NOT EXISTS menu_access jsonb DEFAULT '[]'::jsonb;

UPDATE production_team_members
SET access_level = CASE
  WHEN lower(coalesce(role, '')) IN ('producer', 'admin') THEN lower(role)
  WHEN lower(coalesce(role, '')) IN ('director', 'music director', 'musical director', 'vocal director', 'choreographer') THEN 'creative'
  ELSE coalesce(access_level, 'creative')
END
WHERE access_level IS NULL;

UPDATE production_team_members
SET menu_access = CASE
  WHEN access_level IN ('producer', 'admin') THEN '["overview","team","calendar","auditions","castlist","registration"]'::jsonb
  WHEN access_level = 'schedule' THEN '["calendar","auditions"]'::jsonb
  WHEN access_level IN ('room', 'check_in') THEN '["auditions"]'::jsonb
  WHEN access_level = 'view_only' THEN '["overview","calendar"]'::jsonb
  ELSE '["overview","auditions","castlist"]'::jsonb
END
WHERE menu_access IS NULL OR menu_access = '[]'::jsonb;
