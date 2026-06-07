create table if not exists public.production_script_import_items (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  item_kind text not null,
  item_key text not null,
  sort_order integer not null default 0,
  item_data jsonb not null default '{}'::jsonb,
  source_filename text,
  source_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (production_id, item_kind, item_key),
  check (item_kind in ('props', 'characters', 'songs', 'scenes', 'script'))
);

create index if not exists production_script_import_items_production_kind_idx
  on public.production_script_import_items (production_id, item_kind, sort_order);

drop trigger if exists production_script_import_items_touch_updated_at on public.production_script_import_items;
create trigger production_script_import_items_touch_updated_at
before update on public.production_script_import_items
for each row execute function public.bts_script_breakdown_touch_updated_at();

alter table public.production_script_import_items enable row level security;

drop policy if exists "Public can read production script import items" on public.production_script_import_items;
create policy "Public can read production script import items" on public.production_script_import_items
for select using (true);

drop policy if exists "Public can manage production script import items" on public.production_script_import_items;
create policy "Public can manage production script import items" on public.production_script_import_items
for all using (true) with check (true);
