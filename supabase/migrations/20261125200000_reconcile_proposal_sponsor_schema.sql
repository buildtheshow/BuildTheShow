BEGIN;

-- Keep public tokens usable by the restricted migration role without relying on
-- the pgcrypto extension schema being in its search_path.
ALTER TABLE public.organizations
  ALTER COLUMN proposal_submission_token
  SET DEFAULT left(replace(gen_random_uuid()::text, '-', ''), 24);

ALTER TABLE public.production_proposal_intakes
  ALTER COLUMN access_token
  SET DEFAULT left(replace(gen_random_uuid()::text, '-', ''), 24);

-- Earlier versions already added these fields, so normalize existing NULL values
-- before enforcing the defaults expected by the sponsor booking forms.
UPDATE public.programme_ads
SET artwork_data = '{}'::jsonb
WHERE artwork_data IS NULL;

ALTER TABLE public.programme_ads
  ALTER COLUMN artwork_data SET DEFAULT '{}'::jsonb,
  ALTER COLUMN artwork_data SET NOT NULL;

UPDATE public.sponsor_packages
SET artwork_data = '{}'::jsonb
WHERE artwork_data IS NULL;

ALTER TABLE public.sponsor_packages
  ALTER COLUMN artwork_data SET DEFAULT '{}'::jsonb,
  ALTER COLUMN artwork_data SET NOT NULL;

COMMIT;
