create table if not exists public.cast_members (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  applicant_id uuid not null,
  character_id uuid references public.production_characters(id) on delete set null,
  role_key text not null,
  character_name text,
  role_type text,
  state text not null default 'chosen',
  name text,
  preferred_name text,
  email text,
  phone text,
  headshot_url text,
  pronouns text,
  source_table text,
  registration_answers jsonb not null default '{}'::jsonb,
  casting_assignment_id uuid,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (production_id, applicant_id, role_key),
  check (state in ('chosen', 'offer_accepted', 'ensemble_manual'))
);

alter table public.cast_members
  add column if not exists production_id uuid references public.productions(id) on delete cascade,
  add column if not exists applicant_id uuid,
  add column if not exists character_id uuid references public.production_characters(id) on delete set null,
  add column if not exists role_key text,
  add column if not exists character_name text,
  add column if not exists role_type text,
  add column if not exists state text default 'chosen',
  add column if not exists name text,
  add column if not exists preferred_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists headshot_url text,
  add column if not exists pronouns text,
  add column if not exists source_table text,
  add column if not exists registration_answers jsonb not null default '{}'::jsonb,
  add column if not exists casting_assignment_id uuid,
  add column if not exists accepted_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.cast_members
set role_key = coalesce(character_id::text, 'ensemble')
where role_key is null;

alter table public.cast_members
  alter column role_key set not null;

create index if not exists cast_members_production_idx
  on public.cast_members (production_id, state, character_name);

create index if not exists cast_members_applicant_idx
  on public.cast_members (production_id, applicant_id);

create unique index if not exists cast_members_production_applicant_role_key_uidx
  on public.cast_members (production_id, applicant_id, role_key);

create or replace function public.bts_cast_member_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cast_members_touch_updated_at on public.cast_members;
create trigger cast_members_touch_updated_at
before update on public.cast_members
for each row execute function public.bts_cast_member_touch_updated_at();

create or replace function public.bts_upsert_cast_member_from_assignment(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_row public.casting_assignments%rowtype;
  app_row public.audition_applications%rowtype;
  booking_row public.audition_bookings%rowtype;
  character_row public.production_characters%rowtype;
  app_json jsonb;
  booking_json jsonb;
  next_role_key text;
  next_name text;
  next_preferred_name text;
  next_email text;
  next_phone text;
  next_headshot_url text;
  next_pronouns text;
  next_answers jsonb;
  next_source text;
begin
  select * into assignment_row
  from public.casting_assignments
  where id = p_assignment_id;

  if not found then
    delete from public.cast_members where casting_assignment_id = p_assignment_id;
    return;
  end if;

  if assignment_row.state not in ('chosen', 'offer_accepted', 'ensemble_manual') then
    delete from public.cast_members where casting_assignment_id = assignment_row.id;
    return;
  end if;

  if assignment_row.character_id is not null then
    select * into character_row
    from public.production_characters
    where id = assignment_row.character_id;
  end if;

  select * into app_row
  from public.audition_applications
  where id = assignment_row.applicant_id;

  if found then
    app_json := to_jsonb(app_row);
    next_source := 'audition_applications';
    next_name := app_json ->> 'name';
    next_preferred_name := app_json ->> 'preferred_name';
    next_email := app_json ->> 'email';
    next_phone := app_json ->> 'phone';
    next_headshot_url := app_json ->> 'headshot_url';
    next_pronouns := app_json ->> 'pronouns';
    next_answers := coalesce(app_json -> 'custom_answers', '{}'::jsonb);
  else
    select * into booking_row
    from public.audition_bookings
    where id = assignment_row.applicant_id;

    if found then
      booking_json := to_jsonb(booking_row);
      next_source := 'audition_bookings';
      next_name := booking_json ->> 'name';
      next_preferred_name := booking_json ->> 'preferred_name';
      next_email := booking_json ->> 'email';
      next_phone := booking_json ->> 'phone';
      next_headshot_url := booking_json ->> 'headshot_url';
      next_pronouns := booking_json ->> 'pronouns';
      next_answers := coalesce(booking_json -> 'custom_answers', '{}'::jsonb);
    else
      next_source := 'casting_assignments';
      next_answers := '{}'::jsonb;
    end if;
  end if;

  next_role_key := coalesce(assignment_row.character_id::text, 'ensemble');

  insert into public.cast_members (
    production_id,
    applicant_id,
    character_id,
    role_key,
    character_name,
    role_type,
    state,
    name,
    preferred_name,
    email,
    phone,
    headshot_url,
    pronouns,
    source_table,
    registration_answers,
    casting_assignment_id,
    accepted_at
  )
  values (
    assignment_row.production_id,
    assignment_row.applicant_id,
    assignment_row.character_id,
    next_role_key,
    coalesce(character_row.name, case when assignment_row.character_id is null then 'Ensemble' else null end),
    character_row.role_type,
    assignment_row.state,
    next_name,
    next_preferred_name,
    next_email,
    next_phone,
    next_headshot_url,
    next_pronouns,
    next_source,
    next_answers,
    assignment_row.id,
    coalesce(
      nullif(to_jsonb(assignment_row) ->> 'updated_at', '')::timestamptz,
      nullif(to_jsonb(assignment_row) ->> 'created_at', '')::timestamptz,
      now()
    )
  )
  on conflict (production_id, applicant_id, role_key)
  do update set
    character_id = excluded.character_id,
    character_name = excluded.character_name,
    role_type = excluded.role_type,
    state = excluded.state,
    name = excluded.name,
    preferred_name = excluded.preferred_name,
    email = excluded.email,
    phone = excluded.phone,
    headshot_url = excluded.headshot_url,
    pronouns = excluded.pronouns,
    source_table = excluded.source_table,
    registration_answers = excluded.registration_answers,
    casting_assignment_id = excluded.casting_assignment_id,
    accepted_at = excluded.accepted_at;
end;
$$;

create or replace function public.bts_sync_cast_member_assignment_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.cast_members where casting_assignment_id = old.id;
    return old;
  end if;

  perform public.bts_upsert_cast_member_from_assignment(new.id);
  return new;
end;
$$;

drop trigger if exists bts_sync_cast_member_assignment on public.casting_assignments;
create trigger bts_sync_cast_member_assignment
after insert or update or delete on public.casting_assignments
for each row execute function public.bts_sync_cast_member_assignment_trigger();

create or replace function public.bts_refresh_cast_members_from_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cast_members
  set
    name = to_jsonb(new) ->> 'name',
    preferred_name = to_jsonb(new) ->> 'preferred_name',
    email = to_jsonb(new) ->> 'email',
    phone = to_jsonb(new) ->> 'phone',
    headshot_url = to_jsonb(new) ->> 'headshot_url',
    pronouns = to_jsonb(new) ->> 'pronouns',
    registration_answers = coalesce(to_jsonb(new) -> 'custom_answers', '{}'::jsonb),
    source_table = 'audition_applications'
  where applicant_id = new.id
    and production_id = new.production_id;

  return new;
end;
$$;

drop trigger if exists bts_refresh_cast_members_application on public.audition_applications;
create trigger bts_refresh_cast_members_application
after update on public.audition_applications
for each row execute function public.bts_refresh_cast_members_from_application();

create or replace function public.bts_refresh_cast_members_from_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cast_members
  set
    name = to_jsonb(new) ->> 'name',
    preferred_name = to_jsonb(new) ->> 'preferred_name',
    email = to_jsonb(new) ->> 'email',
    phone = to_jsonb(new) ->> 'phone',
    headshot_url = to_jsonb(new) ->> 'headshot_url',
    pronouns = to_jsonb(new) ->> 'pronouns',
    registration_answers = coalesce(to_jsonb(new) -> 'custom_answers', '{}'::jsonb),
    source_table = 'audition_bookings'
  where applicant_id = new.id
    and production_id = new.production_id;

  return new;
end;
$$;

drop trigger if exists bts_refresh_cast_members_booking on public.audition_bookings;
create trigger bts_refresh_cast_members_booking
after update on public.audition_bookings
for each row execute function public.bts_refresh_cast_members_from_booking();

create or replace function public.bts_refresh_cast_members_from_character()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cast_members
  set
    character_name = new.name,
    role_type = new.role_type
  where character_id = new.id;

  return new;
end;
$$;

drop trigger if exists bts_refresh_cast_members_character on public.production_characters;
create trigger bts_refresh_cast_members_character
after update of name, role_type on public.production_characters
for each row execute function public.bts_refresh_cast_members_from_character();

insert into public.cast_members (
  production_id,
  applicant_id,
  character_id,
  role_key,
  character_name,
  role_type,
  state,
  name,
  preferred_name,
  email,
  phone,
  headshot_url,
  pronouns,
  source_table,
  registration_answers,
  casting_assignment_id,
  accepted_at
)
select
  ca.production_id,
  ca.applicant_id,
  ca.character_id,
  coalesce(ca.character_id::text, 'ensemble') as role_key,
  coalesce(pc.name, case when ca.character_id is null then 'Ensemble' else null end) as character_name,
  pc.role_type,
  ca.state,
  coalesce(to_jsonb(aa) ->> 'name', to_jsonb(ab) ->> 'name') as name,
  coalesce(to_jsonb(aa) ->> 'preferred_name', to_jsonb(ab) ->> 'preferred_name') as preferred_name,
  coalesce(to_jsonb(aa) ->> 'email', to_jsonb(ab) ->> 'email') as email,
  coalesce(to_jsonb(aa) ->> 'phone', to_jsonb(ab) ->> 'phone') as phone,
  coalesce(to_jsonb(aa) ->> 'headshot_url', to_jsonb(ab) ->> 'headshot_url') as headshot_url,
  coalesce(to_jsonb(aa) ->> 'pronouns', to_jsonb(ab) ->> 'pronouns') as pronouns,
  case
    when aa.id is not null then 'audition_applications'
    when ab.id is not null then 'audition_bookings'
    else 'casting_assignments'
  end as source_table,
  coalesce(to_jsonb(aa) -> 'custom_answers', to_jsonb(ab) -> 'custom_answers', '{}'::jsonb) as registration_answers,
  ca.id as casting_assignment_id,
  coalesce(
    nullif(to_jsonb(ca) ->> 'updated_at', '')::timestamptz,
    nullif(to_jsonb(ca) ->> 'created_at', '')::timestamptz,
    now()
  ) as accepted_at
from public.casting_assignments ca
left join public.production_characters pc on pc.id = ca.character_id
left join public.audition_applications aa on aa.id = ca.applicant_id
left join public.audition_bookings ab on ab.id = ca.applicant_id
where ca.state in ('chosen', 'offer_accepted', 'ensemble_manual')
on conflict (production_id, applicant_id, role_key)
do update set
  character_id = excluded.character_id,
  character_name = excluded.character_name,
  role_type = excluded.role_type,
  state = excluded.state,
  name = excluded.name,
  preferred_name = excluded.preferred_name,
  email = excluded.email,
  phone = excluded.phone,
  headshot_url = excluded.headshot_url,
  pronouns = excluded.pronouns,
  source_table = excluded.source_table,
  registration_answers = excluded.registration_answers,
  casting_assignment_id = excluded.casting_assignment_id,
  accepted_at = excluded.accepted_at;

alter table public.cast_members enable row level security;

drop policy if exists "Public can read cast members" on public.cast_members;
create policy "Public can read cast members"
on public.cast_members
for select
using (true);

drop policy if exists "Org admin can manage cast members" on public.cast_members;
create policy "Org admin can manage cast members"
on public.cast_members
using (
  production_id in (
    select p.id
    from public.productions p
    join public.organizations o on o.id = p.organization_id
    where o.admin_id = auth.uid()
  )
)
with check (
  production_id in (
    select p.id
    from public.productions p
    join public.organizations o on o.id = p.organization_id
    where o.admin_id = auth.uid()
  )
);
