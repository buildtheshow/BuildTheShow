create table if not exists public.production_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'under_review', 'shortlisted', 'selected', 'not_selected', 'archived')),
  proposed_show_title text not null,
  show_version text,
  licensing_company text,
  estimated_licensing_fee numeric(12,2),
  pitch_submitted_by text,
  pitch_submitted_by_user_id uuid,
  submitted_at timestamptz,
  runtime_minutes integer,
  number_of_songs integer,
  named_roles integer,
  has_intermission boolean default false,
  genre_type text,
  short_synopsis text,
  organization_fit text,
  character_list text,
  ensemble_opportunities text,
  gender_flexibility text,
  sets_level text check (sets_level in ('low', 'medium', 'high')),
  costumes_level text check (costumes_level in ('low', 'medium', 'high')),
  choreography_level text check (choreography_level in ('low', 'medium', 'high')),
  music_level text check (music_level in ('low', 'medium', 'high')),
  technical_requirements_level text check (technical_requirements_level in ('low', 'medium', 'high')),
  content_warnings text,
  special_requirements text,
  biggest_challenge text,
  additional_notes text,
  internal_notes text,
  selected_production_id uuid references public.productions(id) on delete set null,
  selected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists production_proposals_org_status_idx
  on public.production_proposals (organization_id, status, updated_at desc);

create index if not exists production_proposals_selected_prod_idx
  on public.production_proposals (selected_production_id);

create or replace function public.production_proposals_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists production_proposals_set_updated_at on public.production_proposals;
create trigger production_proposals_set_updated_at
before update on public.production_proposals
for each row
execute function public.production_proposals_set_updated_at();

alter table public.production_proposals enable row level security;

drop policy if exists "Org can view production proposals" on public.production_proposals;
create policy "Org can view production proposals"
on public.production_proposals
for select
to authenticated
using (
  exists (
    select 1
    from public.organizations o
    where o.id = production_proposals.organization_id
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

drop policy if exists "Org can insert production proposals" on public.production_proposals;
create policy "Org can insert production proposals"
on public.production_proposals
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organizations o
    where o.id = production_proposals.organization_id
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

drop policy if exists "Org can update production proposals" on public.production_proposals;
create policy "Org can update production proposals"
on public.production_proposals
for update
to authenticated
using (
  exists (
    select 1
    from public.organizations o
    where o.id = production_proposals.organization_id
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
    where o.id = production_proposals.organization_id
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

drop policy if exists "Org can delete production proposals" on public.production_proposals;
create policy "Org can delete production proposals"
on public.production_proposals
for delete
to authenticated
using (
  exists (
    select 1
    from public.organizations o
    where o.id = production_proposals.organization_id
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
