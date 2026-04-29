-- Organisation link rules
-- URLs are chosen during org setup, checked live, and locked after creation.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slug text;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

UPDATE organizations
SET slug = substring(lower(extensions.unaccent(regexp_replace(COALESCE(NULLIF(abbreviation, ''), name, custom_id, id::text), '[^a-zA-Z0-9]+', '-', 'g'))) from 1 for 50)
WHERE slug IS NULL OR slug = '';

UPDATE organizations
SET slug = substring(lower(extensions.unaccent(regexp_replace(regexp_replace(slug, '[^a-zA-Z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g'))) from 1 for 50)
WHERE slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_lower_idx
  ON organizations (lower(slug))
  WHERE slug IS NOT NULL;

DROP INDEX IF EXISTS productions_slug_idx;
CREATE UNIQUE INDEX IF NOT EXISTS productions_org_slug_lower_idx
  ON productions (organization_id, lower(slug))
  WHERE slug IS NOT NULL;

CREATE OR REPLACE FUNCTION is_reserved_organization_slug(p_slug text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(COALESCE(p_slug, '')) = ANY (ARRAY[
    'admin',
    'api',
    'auth',
    'billing',
    'dashboard',
    'login',
    'logout',
    'signup',
    'settings',
    'support',
    'help',
    'account',
    'profile',
    'users',
    'organisations',
    'organizations',
    'productions',
    'public',
    'system',
    'app',
    'assets',
    'backend',
    'shared',
    'home',
    'www',
    'mail'
  ]);
$$;

CREATE OR REPLACE FUNCTION normalize_slug_for_blocklist(p_slug text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
    translate(
      lower(extensions.unaccent(COALESCE(p_slug, ''))),
      '013457',
      'oieast'
    ),
    '[^a-z]',
    '',
    'g'
  );
$$;

CREATE OR REPLACE FUNCTION is_blocked_organization_slug(p_slug text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT normalize_slug_for_blocklist(p_slug) ~ '(arsehole|asshole|bitch|blowjob|bullshit|chink|cock|cocksucker|cunt|faggot|^fag$|fuck|kike|motherfucker|nazi|nigg|paki|porn|pussy|rape|shit|slut|spic|twat|whore|wop)';
$$;

ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_slug_format_chk;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_slug_format_chk
  CHECK (
    slug IS NOT NULL
    AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    AND char_length(slug) BETWEEN 3 AND 50
    AND NOT is_reserved_organization_slug(slug)
    AND NOT is_blocked_organization_slug(slug)
  )
  NOT VALID;

ALTER TABLE productions
  DROP CONSTRAINT IF EXISTS productions_slug_format_chk;

ALTER TABLE productions
  ADD CONSTRAINT productions_slug_format_chk
  CHECK (
    slug IS NULL
    OR (
      slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      AND char_length(slug) BETWEEN 3 AND 50
      AND NOT is_reserved_organization_slug(slug)
      AND NOT is_blocked_organization_slug(slug)
    )
  )
  NOT VALID;

CREATE OR REPLACE FUNCTION organization_slug_available(
  p_slug text,
  p_exclude_org_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text := lower(extensions.unaccent(trim(COALESCE(p_slug, ''))));
BEGIN
  IF v_slug = ''
    OR v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    OR char_length(v_slug) < 3
    OR char_length(v_slug) > 50
    OR is_reserved_organization_slug(v_slug)
    OR is_blocked_organization_slug(v_slug)
  THEN
    RETURN false;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1
    FROM organizations o
    WHERE lower(o.slug) = lower(v_slug)
      AND (p_exclude_org_id IS NULL OR o.id <> p_exclude_org_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION organization_slug_available(text, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION lock_organization_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.slug IS DISTINCT FROM NEW.slug THEN
    RAISE EXCEPTION 'Organisation link cannot be changed after creation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_slug_lock_trg ON organizations;
CREATE TRIGGER organizations_slug_lock_trg
BEFORE UPDATE ON organizations
FOR EACH ROW
EXECUTE FUNCTION lock_organization_slug();
