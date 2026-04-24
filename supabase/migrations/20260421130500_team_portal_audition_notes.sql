-- Production team passcode access + authored audition notes.
-- This supports director / vocal director / choreographer access without Supabase Auth.

create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public)
values ('audition-headshots', 'audition-headshots', true)
on conflict (id) do update set public = true;

create table if not exists production_team_members (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references productions(id) on delete cascade,
  name text not null,
  email text,
  role text not null,
  passcode text not null,
  note_color text not null default '#572e88',
  bio text,
  headshot_url text,
  headshot_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists production_team_members_passcode_key
  on production_team_members (production_id, lower(passcode));

create unique index if not exists production_team_members_note_color_key
  on production_team_members (production_id, lower(note_color))
  where is_active = true;

create index if not exists production_team_members_production_idx
  on production_team_members (production_id);

alter table production_team_members
  add column if not exists note_color text not null default '#572e88',
  add column if not exists bio text,
  add column if not exists headshot_url text,
  add column if not exists headshot_path text;

drop policy if exists "Public can upload audition headshots" on storage.objects;
create policy "Public can upload audition headshots"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'audition-headshots');

drop policy if exists "Public can view audition headshots" on storage.objects;
create policy "Public can view audition headshots"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'audition-headshots');

drop policy if exists "Public can update audition headshots" on storage.objects;
create policy "Public can update audition headshots"
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'audition-headshots')
with check (bucket_id = 'audition-headshots');

create table if not exists production_audition_notes (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references productions(id) on delete cascade,
  applicant_id uuid,
  session_id uuid,
  character_id uuid,
  note_area text not null default 'in_room',
  body text not null,
  author_name text not null,
  author_email text,
  author_role text not null,
  author_color text not null default '#572e88',
  team_member_id uuid references production_team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists production_audition_notes_lookup_idx
  on production_audition_notes (production_id, applicant_id, session_id, character_id, note_area, created_at);

alter table production_team_members enable row level security;
alter table production_audition_notes enable row level security;

drop policy if exists "Org can manage production team members" on production_team_members;
create policy "Org can manage production team members"
on production_team_members
for all
using (
  exists (
    select 1
    from productions p
    join organizations o on o.id = p.organization_id
    where p.id = production_team_members.production_id
      and o.admin_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from productions p
    join organizations o on o.id = p.organization_id
    where p.id = production_team_members.production_id
      and o.admin_id = auth.uid()
  )
);

drop policy if exists "Org can manage audition notes" on production_audition_notes;
create policy "Org can manage audition notes"
on production_audition_notes
for all
using (
  exists (
    select 1
    from productions p
    join organizations o on o.id = p.organization_id
    where p.id = production_audition_notes.production_id
      and o.admin_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from productions p
    join organizations o on o.id = p.organization_id
    where p.id = production_audition_notes.production_id
      and o.admin_id = auth.uid()
  )
);

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists production_team_members_touch_updated_at on production_team_members;
create trigger production_team_members_touch_updated_at
before update on production_team_members
for each row execute function touch_updated_at();

drop trigger if exists production_audition_notes_touch_updated_at on production_audition_notes;
create trigger production_audition_notes_touch_updated_at
before update on production_audition_notes
for each row execute function touch_updated_at();

drop function if exists team_member_login(uuid,text);
drop function if exists team_member_login(uuid,text,text);
create or replace function team_member_login(p_production_id uuid, p_email text, p_passcode text)
returns table (
  id uuid,
  production_id uuid,
  name text,
  email text,
  role text,
  note_color text,
  bio text,
  headshot_url text,
  headshot_path text
)
language sql
security definer
set search_path = public
as $$
  select tm.id, tm.production_id, tm.name, tm.email, tm.role, tm.note_color,
         tm.bio, tm.headshot_url, tm.headshot_path
  from production_team_members tm
  where tm.production_id = p_production_id
    and tm.is_active = true
    and lower(coalesce(tm.email, '')) = lower(trim(p_email))
    and lower(tm.passcode) = lower(trim(p_passcode))
  limit 1;
$$;
grant execute on function team_member_login(uuid,text,text) to anon, authenticated;

drop function if exists team_member_colour_list(uuid,text);
drop function if exists team_member_colour_list(uuid,text,text);
create or replace function team_member_colour_list(p_production_id uuid, p_email text, p_passcode text)
returns table (
  team_member_id uuid,
  name text,
  role text,
  note_color text
)
language sql
security definer
set search_path = public
as $$
  select tm.id, tm.name, tm.role, tm.note_color
  from production_team_members tm
  where tm.production_id = p_production_id
    and tm.is_active = true
    and exists (
      select 1
      from production_team_members current_member
      where current_member.production_id = p_production_id
        and current_member.is_active = true
        and lower(coalesce(current_member.email, '')) = lower(trim(p_email))
        and lower(current_member.passcode) = lower(trim(p_passcode))
    )
  order by tm.created_at asc;
$$;
grant execute on function team_member_colour_list(uuid,text,text) to anon, authenticated;

drop function if exists team_member_update_profile(uuid,text,text,text,text,text);
drop function if exists team_member_update_profile(uuid,text,text,text,text,text,text);
create or replace function team_member_update_profile(
  p_production_id uuid,
  p_email text,
  p_passcode text,
  p_note_color text,
  p_bio text,
  p_headshot_url text,
  p_headshot_path text
)
returns table (
  id uuid,
  production_id uuid,
  name text,
  email text,
  role text,
  note_color text,
  bio text,
  headshot_url text,
  headshot_path text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  tm production_team_members%rowtype;
  chosen_color text := coalesce(nullif(trim(p_note_color), ''), '#572e88');
begin
  select *
  into tm
  from production_team_members
  where production_id = p_production_id
    and is_active = true
    and lower(coalesce(email, '')) = lower(trim(p_email))
    and lower(passcode) = lower(trim(p_passcode))
  limit 1;

  if tm.id is null then
    raise exception 'Invalid production team passcode';
  end if;

  if exists (
    select 1
    from production_team_members other
    where other.production_id = p_production_id
      and other.is_active = true
      and other.id <> tm.id
      and lower(other.note_color) = lower(chosen_color)
  ) then
    raise exception 'That colour is already being used by another team member';
  end if;

  update production_team_members updated
  set note_color = chosen_color,
      bio = nullif(trim(coalesce(p_bio, '')), ''),
      headshot_url = nullif(trim(coalesce(p_headshot_url, '')), ''),
      headshot_path = nullif(trim(coalesce(p_headshot_path, '')), '')
  where updated.id = tm.id
  returning updated.* into tm;

  return query
  select tm.id, tm.production_id, tm.name, tm.email, tm.role, tm.note_color,
         tm.bio, tm.headshot_url, tm.headshot_path;
end;
$$;
grant execute on function team_member_update_profile(uuid,text,text,text,text,text,text) to anon, authenticated;

drop function if exists team_note_list(uuid,text);
drop function if exists team_note_list(uuid,text,text);
create or replace function team_note_list(p_production_id uuid, p_email text, p_passcode text)
returns table (
  id uuid,
  production_id uuid,
  applicant_id uuid,
  session_id uuid,
  character_id uuid,
  note_area text,
  body text,
  author_name text,
  author_email text,
  author_role text,
  author_color text,
  team_member_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select n.id, n.production_id, n.applicant_id, n.session_id, n.character_id,
         n.note_area, n.body, n.author_name, n.author_email, n.author_role, n.author_color,
         n.team_member_id, n.created_at, n.updated_at
  from production_audition_notes n
  where n.production_id = p_production_id
    and exists (
      select 1
      from production_team_members tm
      where tm.production_id = p_production_id
        and tm.is_active = true
        and lower(coalesce(tm.email, '')) = lower(trim(p_email))
        and lower(tm.passcode) = lower(trim(p_passcode))
    )
  order by n.created_at asc;
$$;
grant execute on function team_note_list(uuid,text,text) to anon, authenticated;

drop function if exists team_note_add(uuid,text,uuid,uuid,uuid,text,text);
drop function if exists team_note_add(uuid,text,text,uuid,uuid,uuid,text,text);
create or replace function team_note_add(
  p_production_id uuid,
  p_email text,
  p_passcode text,
  p_applicant_id uuid,
  p_session_id uuid,
  p_character_id uuid,
  p_note_area text,
  p_body text
)
returns production_audition_notes
language plpgsql
security definer
set search_path = public
as $$
declare
  tm production_team_members%rowtype;
  inserted production_audition_notes%rowtype;
begin
  select *
  into tm
  from production_team_members
  where production_id = p_production_id
    and is_active = true
    and lower(coalesce(email, '')) = lower(trim(p_email))
    and lower(passcode) = lower(trim(p_passcode))
  limit 1;

  if tm.id is null then
    raise exception 'Invalid production team passcode';
  end if;

  insert into production_audition_notes (
    production_id, applicant_id, session_id, character_id, note_area, body,
    author_name, author_email, author_role, author_color, team_member_id
  )
  values (
    p_production_id, p_applicant_id, p_session_id, p_character_id,
    coalesce(nullif(trim(p_note_area), ''), 'in_room'),
    trim(p_body),
    tm.name, tm.email, tm.role, coalesce(tm.note_color, '#572e88'), tm.id
  )
  returning * into inserted;

  return inserted;
end;
$$;
grant execute on function team_note_add(uuid,text,text,uuid,uuid,uuid,text,text) to anon, authenticated;
