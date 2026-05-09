alter table public.organizations
  add column if not exists logo_white_url text,
  add column if not exists logo_black_url text,
  add column if not exists logo_alternative_url text;
