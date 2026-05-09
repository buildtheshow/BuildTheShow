alter table public.organizations
  add column if not exists logo_transparent_url text,
  add column if not exists brand_stamp_url text;
