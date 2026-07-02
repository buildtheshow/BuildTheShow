alter table public.organization_planning_events
  add column if not exists category text not null default 'other';

update public.organization_planning_events
set category = 'other'
where category is null or btrim(category) = '';
