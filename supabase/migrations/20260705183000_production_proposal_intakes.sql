create table if not exists public.production_proposal_intakes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  season_label text,
  description text,
  access_token text not null default encode(gen_random_bytes(12), 'hex'),
  access_code text not null,
  is_open boolean not null default true,
  closes_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists production_proposal_intakes_access_token_idx
  on public.production_proposal_intakes (access_token);

create index if not exists production_proposal_intakes_org_idx
  on public.production_proposal_intakes (organization_id, created_at desc);

create or replace function public.production_proposal_intakes_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists production_proposal_intakes_set_updated_at on public.production_proposal_intakes;
create trigger production_proposal_intakes_set_updated_at
before update on public.production_proposal_intakes
for each row
execute function public.production_proposal_intakes_set_updated_at();

alter table public.production_proposal_intakes enable row level security;

drop policy if exists "Org can view production proposal intakes" on public.production_proposal_intakes;
create policy "Org can view production proposal intakes"
on public.production_proposal_intakes
for select
to authenticated
using (
  exists (
    select 1
    from public.organizations o
    where o.id = production_proposal_intakes.organization_id
      and (
        o.admin_id = auth.uid()
        or exists (
          select 1
          from public.org_members om
          where om.org_id = o.id
            and om.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "Org can insert production proposal intakes" on public.production_proposal_intakes;
create policy "Org can insert production proposal intakes"
on public.production_proposal_intakes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organizations o
    where o.id = production_proposal_intakes.organization_id
      and (
        o.admin_id = auth.uid()
        or exists (
          select 1
          from public.org_members om
          where om.org_id = o.id
            and om.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "Org can update production proposal intakes" on public.production_proposal_intakes;
create policy "Org can update production proposal intakes"
on public.production_proposal_intakes
for update
to authenticated
using (
  exists (
    select 1
    from public.organizations o
    where o.id = production_proposal_intakes.organization_id
      and (
        o.admin_id = auth.uid()
        or exists (
          select 1
          from public.org_members om
          where om.org_id = o.id
            and om.user_id = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.organizations o
    where o.id = production_proposal_intakes.organization_id
      and (
        o.admin_id = auth.uid()
        or exists (
          select 1
          from public.org_members om
          where om.org_id = o.id
            and om.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "Org can delete production proposal intakes" on public.production_proposal_intakes;
create policy "Org can delete production proposal intakes"
on public.production_proposal_intakes
for delete
to authenticated
using (
  exists (
    select 1
    from public.organizations o
    where o.id = production_proposal_intakes.organization_id
      and (
        o.admin_id = auth.uid()
        or exists (
          select 1
          from public.org_members om
          where om.org_id = o.id
            and om.user_id = auth.uid()
        )
      )
  )
);

alter table public.production_proposals
  add column if not exists intake_id uuid references public.production_proposal_intakes(id) on delete set null;

create index if not exists production_proposals_intake_idx
  on public.production_proposals (intake_id, status, updated_at desc);

create or replace function public.get_public_proposal_page(
  p_intake_key text,
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intake public.production_proposal_intakes%rowtype;
  v_org public.organizations%rowtype;
begin
  select *
  into v_intake
  from public.production_proposal_intakes
  where id::text = p_intake_key
    and access_token = p_token
  limit 1;

  if v_intake.id is null then
    raise exception 'Proposal intake not found'
      using errcode = 'P0001';
  end if;

  select *
  into v_org
  from public.organizations
  where id = v_intake.organization_id
  limit 1;

  if v_org.id is null then
    raise exception 'Organization not found'
      using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'organization', jsonb_build_object(
      'id', v_org.id,
      'name', v_org.name,
      'slug', v_org.slug,
      'abbreviation', v_org.abbreviation,
      'logo_url', v_org.logo_url,
      'logo_white_url', v_org.logo_white_url
    ),
    'intake', jsonb_build_object(
      'id', v_intake.id,
      'title', v_intake.title,
      'season_label', v_intake.season_label,
      'description', v_intake.description,
      'is_open', v_intake.is_open,
      'closes_at', v_intake.closes_at
    )
  );
end;
$$;

grant execute on function public.get_public_proposal_page(text, text) to anon, authenticated;

create or replace function public.unlock_public_proposal_page(
  p_intake_key text,
  p_token text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intake public.production_proposal_intakes%rowtype;
begin
  select *
  into v_intake
  from public.production_proposal_intakes
  where id::text = p_intake_key
    and access_token = p_token
  limit 1;

  if v_intake.id is null then
    raise exception 'Proposal intake not found'
      using errcode = 'P0001';
  end if;

  if not v_intake.is_open then
    raise exception 'This season pitch is closed'
      using errcode = 'P0001';
  end if;

  if v_intake.closes_at is not null and v_intake.closes_at < now() then
    raise exception 'This season pitch has expired'
      using errcode = 'P0001';
  end if;

  if coalesce(v_intake.access_code, '') <> coalesce(p_access_code, '') then
    raise exception 'Incorrect passcode'
      using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'unlocked', true,
    'intake_id', v_intake.id,
    'title', v_intake.title
  );
end;
$$;

grant execute on function public.unlock_public_proposal_page(text, text, text) to anon, authenticated;

create or replace function public.submit_public_production_proposal(
  p_intake_key text,
  p_token text,
  p_access_code text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intake public.production_proposal_intakes%rowtype;
  v_inserted public.production_proposals%rowtype;
begin
  select *
  into v_intake
  from public.production_proposal_intakes
  where id::text = p_intake_key
    and access_token = p_token
  limit 1;

  if v_intake.id is null then
    raise exception 'Proposal intake not found'
      using errcode = 'P0001';
  end if;

  if not v_intake.is_open then
    raise exception 'This season pitch is closed'
      using errcode = 'P0001';
  end if;

  if v_intake.closes_at is not null and v_intake.closes_at < now() then
    raise exception 'This season pitch has expired'
      using errcode = 'P0001';
  end if;

  if coalesce(v_intake.access_code, '') <> coalesce(p_access_code, '') then
    raise exception 'Incorrect passcode'
      using errcode = 'P0001';
  end if;

  if nullif(btrim(coalesce(p_payload->>'proposed_show_title', '')), '') is null then
    raise exception 'Proposed show title is required'
      using errcode = 'P0001';
  end if;

  insert into public.production_proposals (
    organization_id,
    intake_id,
    status,
    proposed_show_title,
    show_version,
    licensing_company,
    estimated_licensing_fee,
    pitch_submitted_by,
    submitter_email,
    submitter_phone,
    submitted_at,
    runtime_minutes,
    number_of_songs,
    named_roles,
    has_intermission,
    genre_type,
    short_synopsis,
    organization_fit,
    character_list,
    ensemble_opportunities,
    gender_flexibility,
    sets_level,
    costumes_level,
    choreography_level,
    music_level,
    technical_requirements_level,
    content_warnings,
    special_requirements,
    biggest_challenge,
    additional_notes,
    submission_origin
  )
  values (
    v_intake.organization_id,
    v_intake.id,
    'submitted',
    btrim(p_payload->>'proposed_show_title'),
    nullif(btrim(coalesce(p_payload->>'show_version', '')), ''),
    nullif(btrim(coalesce(p_payload->>'licensing_company', '')), ''),
    nullif(btrim(coalesce(p_payload->>'estimated_licensing_fee', '')), '')::numeric(12,2),
    nullif(btrim(coalesce(p_payload->>'pitch_submitted_by', '')), ''),
    nullif(btrim(coalesce(p_payload->>'submitter_email', '')), ''),
    nullif(btrim(coalesce(p_payload->>'submitter_phone', '')), ''),
    now(),
    nullif(btrim(coalesce(p_payload->>'runtime_minutes', '')), '')::integer,
    nullif(btrim(coalesce(p_payload->>'number_of_songs', '')), '')::integer,
    nullif(btrim(coalesce(p_payload->>'named_roles', '')), '')::integer,
    coalesce((p_payload->>'has_intermission')::boolean, false),
    nullif(btrim(coalesce(p_payload->>'genre_type', '')), ''),
    nullif(btrim(coalesce(p_payload->>'short_synopsis', '')), ''),
    nullif(btrim(coalesce(p_payload->>'organization_fit', '')), ''),
    nullif(btrim(coalesce(p_payload->>'character_list', '')), ''),
    nullif(btrim(coalesce(p_payload->>'ensemble_opportunities', '')), ''),
    nullif(btrim(coalesce(p_payload->>'gender_flexibility', '')), ''),
    case
      when lower(coalesce(p_payload->>'sets_level', '')) in ('low', 'medium', 'high') then lower(p_payload->>'sets_level')
      else 'medium'
    end,
    case
      when lower(coalesce(p_payload->>'costumes_level', '')) in ('low', 'medium', 'high') then lower(p_payload->>'costumes_level')
      else 'medium'
    end,
    case
      when lower(coalesce(p_payload->>'choreography_level', '')) in ('low', 'medium', 'high') then lower(p_payload->>'choreography_level')
      else 'medium'
    end,
    case
      when lower(coalesce(p_payload->>'music_level', '')) in ('low', 'medium', 'high') then lower(p_payload->>'music_level')
      else 'medium'
    end,
    case
      when lower(coalesce(p_payload->>'technical_requirements_level', '')) in ('low', 'medium', 'high') then lower(p_payload->>'technical_requirements_level')
      else 'medium'
    end,
    nullif(btrim(coalesce(p_payload->>'content_warnings', '')), ''),
    nullif(btrim(coalesce(p_payload->>'special_requirements', '')), ''),
    nullif(btrim(coalesce(p_payload->>'biggest_challenge', '')), ''),
    nullif(btrim(coalesce(p_payload->>'additional_notes', '')), ''),
    'public'
  )
  returning *
  into v_inserted;

  return jsonb_build_object(
    'proposal_id', v_inserted.id,
    'status', v_inserted.status,
    'submitted_at', v_inserted.submitted_at,
    'intake_id', v_inserted.intake_id
  );
end;
$$;

grant execute on function public.submit_public_production_proposal(text, text, text, jsonb) to anon, authenticated;
