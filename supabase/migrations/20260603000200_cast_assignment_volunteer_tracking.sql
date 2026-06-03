alter table public.casting_assignments
  add column if not exists volunteer_hours_completed numeric,
  add column if not exists volunteer_role_notes text;
