alter table public.organizations
  add column if not exists proposal_submission_token text;

alter table public.organizations
  alter column proposal_submission_token set default encode(gen_random_bytes(12), 'hex');

create unique index if not exists organizations_proposal_submission_token_idx
  on public.organizations (proposal_submission_token)
  where proposal_submission_token is not null;

alter table public.production_proposals
  add column if not exists submitter_email text,
  add column if not exists submitter_phone text,
  add column if not exists submission_origin text not null default 'internal';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'production_proposals_submission_origin_check'
  ) then
    alter table public.production_proposals
      add constraint production_proposals_submission_origin_check
      check (submission_origin in ('internal', 'public'));
  end if;
end $$;

create or replace function public.get_public_proposal_page(
  p_org_key text,
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations%rowtype;
begin
  select *
  into v_org
  from public.organizations
  where proposal_submission_token = p_token
    and (
      id::text = p_org_key
      or lower(coalesce(slug, '')) = lower(coalesce(p_org_key, ''))
      or lower(coalesce(abbreviation, '')) = lower(coalesce(p_org_key, ''))
    )
  limit 1;

  if v_org.id is null then
    raise exception 'Proposal page not found'
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
    )
  );
end;
$$;

grant execute on function public.get_public_proposal_page(text, text) to anon, authenticated;

create or replace function public.submit_public_production_proposal(
  p_org_key text,
  p_token text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations%rowtype;
  v_inserted public.production_proposals%rowtype;
begin
  select *
  into v_org
  from public.organizations
  where proposal_submission_token = p_token
    and (
      id::text = p_org_key
      or lower(coalesce(slug, '')) = lower(coalesce(p_org_key, ''))
      or lower(coalesce(abbreviation, '')) = lower(coalesce(p_org_key, ''))
    )
  limit 1;

  if v_org.id is null then
    raise exception 'Proposal page not found'
      using errcode = 'P0001';
  end if;

  if nullif(btrim(coalesce(p_payload->>'proposed_show_title', '')), '') is null then
    raise exception 'Proposed show title is required'
      using errcode = 'P0001';
  end if;

  insert into public.production_proposals (
    organization_id,
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
    v_org.id,
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
    'submitted_at', v_inserted.submitted_at
  );
end;
$$;

grant execute on function public.submit_public_production_proposal(text, text, jsonb) to anon, authenticated;
