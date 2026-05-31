alter table public.volunteer_signups
  add column if not exists check_in_with text;
