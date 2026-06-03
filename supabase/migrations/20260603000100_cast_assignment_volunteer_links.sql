alter table public.casting_assignments
  add column if not exists volunteer_signup_ids text[] default '{}',
  add column if not exists volunteer_signup_name text;
