create table if not exists public.organization_planning_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  start_at text not null,
  end_at text,
  all_day boolean not null default true,
  notes text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_org_planning_events_org_start
  on public.organization_planning_events (organization_id, start_at);

alter table public.organization_planning_events enable row level security;

drop policy if exists "Org admins can read planning events" on public.organization_planning_events;
create policy "Org admins can read planning events"
  on public.organization_planning_events
  for select
  using (
    organization_id in (
      select o.id
      from public.organizations o
      where o.admin_id = auth.uid()
    )
  );

drop policy if exists "Org admins can insert planning events" on public.organization_planning_events;
create policy "Org admins can insert planning events"
  on public.organization_planning_events
  for insert
  with check (
    organization_id in (
      select o.id
      from public.organizations o
      where o.admin_id = auth.uid()
    )
  );

drop policy if exists "Org admins can update planning events" on public.organization_planning_events;
create policy "Org admins can update planning events"
  on public.organization_planning_events
  for update
  using (
    organization_id in (
      select o.id
      from public.organizations o
      where o.admin_id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select o.id
      from public.organizations o
      where o.admin_id = auth.uid()
    )
  );

drop policy if exists "Org admins can delete planning events" on public.organization_planning_events;
create policy "Org admins can delete planning events"
  on public.organization_planning_events
  for delete
  using (
    organization_id in (
      select o.id
      from public.organizations o
      where o.admin_id = auth.uid()
    )
  );

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organizations'
      and column_name = 'planning_calendar'
  ) then
    execute $sql$
      insert into public.organization_planning_events (
        id,
        organization_id,
        title,
        start_at,
        end_at,
        all_day,
        notes,
        created_at,
        updated_at
      )
      select
        coalesce(nullif(item->>'id', '')::uuid, gen_random_uuid()),
        o.id,
        item->>'title',
        item->>'start',
        nullif(item->>'end', ''),
        coalesce((item->>'allDay')::boolean, true),
        coalesce(item->>'notes', ''),
        coalesce((item->>'created_at')::timestamptz, now()),
        coalesce((item->>'updated_at')::timestamptz, now())
      from public.organizations o
      cross join lateral jsonb_array_elements(coalesce(o.planning_calendar, '[]'::jsonb)) item
      where coalesce(item->>'title', '') <> ''
        and coalesce(item->>'start', '') <> ''
      on conflict (id) do nothing
    $sql$;
  end if;
end
$$;
