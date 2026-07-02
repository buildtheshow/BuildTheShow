alter table public.organizations
  add column if not exists planning_calendar jsonb not null default '[]'::jsonb;
