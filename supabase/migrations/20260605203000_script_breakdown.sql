create table if not exists public.production_acts (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  number integer not null default 1,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (production_id, number)
);

create table if not exists public.production_scenes (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  act_id uuid references public.production_acts(id) on delete set null,
  number integer not null default 1,
  title text not null,
  location text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scene_characters (
  id uuid primary key default gen_random_uuid(),
  production_id uuid references public.productions(id) on delete cascade,
  scene_id uuid not null references public.production_scenes(id) on delete cascade,
  character_id uuid not null references public.production_characters(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (scene_id, character_id)
);

create table if not exists public.scene_groups (
  id uuid primary key default gen_random_uuid(),
  production_id uuid references public.productions(id) on delete cascade,
  scene_id uuid not null references public.production_scenes(id) on delete cascade,
  group_name text not null,
  member_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scene_notes (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  scene_id uuid not null references public.production_scenes(id) on delete cascade,
  body text not null,
  note_type text not null default 'general',
  department_tags text[] not null default '{}'::text[],
  author_name text,
  author_role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    note_type in (
      'general',
      'costume',
      'props',
      'hair_makeup',
      'stage_mgmt',
      'quick_change',
      'preset',
      'safety'
    )
  )
);

alter table public.production_acts
  add column if not exists production_id uuid references public.productions(id) on delete cascade,
  add column if not exists number integer default 1,
  add column if not exists title text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.production_scenes
  add column if not exists production_id uuid references public.productions(id) on delete cascade,
  add column if not exists act_id uuid references public.production_acts(id) on delete set null,
  add column if not exists number integer default 1,
  add column if not exists title text,
  add column if not exists location text,
  add column if not exists description text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.scene_characters
  add column if not exists production_id uuid references public.productions(id) on delete cascade,
  add column if not exists scene_id uuid references public.production_scenes(id) on delete cascade,
  add column if not exists character_id uuid references public.production_characters(id) on delete cascade,
  add column if not exists created_at timestamptz not null default now();

alter table public.scene_groups
  add column if not exists production_id uuid references public.productions(id) on delete cascade,
  add column if not exists scene_id uuid references public.production_scenes(id) on delete cascade,
  add column if not exists group_name text,
  add column if not exists member_count integer,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.scene_notes
  add column if not exists production_id uuid references public.productions(id) on delete cascade,
  add column if not exists scene_id uuid references public.production_scenes(id) on delete cascade,
  add column if not exists body text,
  add column if not exists note_type text default 'general',
  add column if not exists department_tags text[] not null default '{}'::text[],
  add column if not exists author_name text,
  add column if not exists author_role text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.scene_characters sc
set production_id = ps.production_id
from public.production_scenes ps
where sc.scene_id = ps.id
  and sc.production_id is null;

update public.scene_groups sg
set production_id = ps.production_id
from public.production_scenes ps
where sg.scene_id = ps.id
  and sg.production_id is null;

update public.scene_notes
set department_tags = array_remove(array[note_type], 'general')
where department_tags = '{}'::text[]
  and note_type <> 'general';

create index if not exists production_acts_production_idx
  on public.production_acts (production_id, number);

create unique index if not exists production_acts_production_number_uidx
  on public.production_acts (production_id, number);

create index if not exists production_scenes_production_idx
  on public.production_scenes (production_id, act_id, number);

create index if not exists scene_characters_scene_idx
  on public.scene_characters (scene_id);

create unique index if not exists scene_characters_scene_character_uidx
  on public.scene_characters (scene_id, character_id);

create index if not exists scene_groups_scene_idx
  on public.scene_groups (scene_id);

create index if not exists scene_notes_scene_idx
  on public.scene_notes (scene_id, created_at desc);

create index if not exists scene_notes_department_tags_idx
  on public.scene_notes using gin (department_tags);

create or replace function public.bts_script_breakdown_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists production_acts_touch_updated_at on public.production_acts;
create trigger production_acts_touch_updated_at
before update on public.production_acts
for each row execute function public.bts_script_breakdown_touch_updated_at();

drop trigger if exists production_scenes_touch_updated_at on public.production_scenes;
create trigger production_scenes_touch_updated_at
before update on public.production_scenes
for each row execute function public.bts_script_breakdown_touch_updated_at();

drop trigger if exists scene_groups_touch_updated_at on public.scene_groups;
create trigger scene_groups_touch_updated_at
before update on public.scene_groups
for each row execute function public.bts_script_breakdown_touch_updated_at();

drop trigger if exists scene_notes_touch_updated_at on public.scene_notes;
create trigger scene_notes_touch_updated_at
before update on public.scene_notes
for each row execute function public.bts_script_breakdown_touch_updated_at();

insert into public.production_permission_pages (page_key, parent_page_key, label, sort_order, is_active)
values
  ('script_breakdown', null, 'Script Breakdown', 260, true)
on conflict (page_key) do update
set parent_page_key = excluded.parent_page_key,
    label = excluded.label,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active;

alter table public.production_acts enable row level security;
alter table public.production_scenes enable row level security;
alter table public.scene_characters enable row level security;
alter table public.scene_groups enable row level security;
alter table public.scene_notes enable row level security;

drop policy if exists "Public can read production acts" on public.production_acts;
create policy "Public can read production acts" on public.production_acts
for select using (true);

drop policy if exists "Public can manage production acts" on public.production_acts;
create policy "Public can manage production acts" on public.production_acts
for all using (true) with check (true);

drop policy if exists "Public can read production scenes" on public.production_scenes;
create policy "Public can read production scenes" on public.production_scenes
for select using (true);

drop policy if exists "Public can manage production scenes" on public.production_scenes;
create policy "Public can manage production scenes" on public.production_scenes
for all using (true) with check (true);

drop policy if exists "Public can read scene characters" on public.scene_characters;
create policy "Public can read scene characters" on public.scene_characters
for select using (true);

drop policy if exists "Public can manage scene characters" on public.scene_characters;
create policy "Public can manage scene characters" on public.scene_characters
for all using (true) with check (true);

drop policy if exists "Public can read scene groups" on public.scene_groups;
create policy "Public can read scene groups" on public.scene_groups
for select using (true);

drop policy if exists "Public can manage scene groups" on public.scene_groups;
create policy "Public can manage scene groups" on public.scene_groups
for all using (true) with check (true);

drop policy if exists "Public can read scene notes" on public.scene_notes;
create policy "Public can read scene notes" on public.scene_notes
for select using (true);

drop policy if exists "Public can manage scene notes" on public.scene_notes;
create policy "Public can manage scene notes" on public.scene_notes
for all using (true) with check (true);
