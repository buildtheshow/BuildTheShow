alter table public.volunteer_signups
  add column if not exists required_dates jsonb not null default '[]'::jsonb;

