create extension if not exists pgcrypto;

create table if not exists public.sponsor_settings (
  production_id uuid primary key references public.productions(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.sponsor_businesses (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  website text,
  social_links jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.programme_ads (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  business_id uuid references public.sponsor_businesses(id) on delete set null,
  ad_size text,
  ad_type text,
  price_cents integer not null default 0 check (price_cents >= 0),
  payment_status text not null default 'unpaid',
  artwork_status text not null default 'missing',
  approval_status text not null default 'pending',
  artwork_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sponsor_packages (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  business_id uuid references public.sponsor_businesses(id) on delete set null,
  tier_name text,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  payment_status text not null default 'unpaid',
  benefits text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sponsor_deliverables (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  business_id uuid references public.sponsor_businesses(id) on delete set null,
  title text not null,
  due_date date,
  status text not null default 'open',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sponsor_settings add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.sponsor_settings add column if not exists updated_at timestamptz not null default now();
alter table public.sponsor_businesses add column if not exists website text;
alter table public.sponsor_businesses add column if not exists social_links jsonb not null default '{}'::jsonb;
alter table public.programme_ads add column if not exists artwork_url text;
alter table public.programme_ads add column if not exists approval_status text not null default 'pending';
alter table public.sponsor_packages add column if not exists benefits text;

create unique index if not exists sponsor_settings_production_key on public.sponsor_settings(production_id);
create index if not exists sponsor_businesses_production_idx on public.sponsor_businesses(production_id);
create index if not exists programme_ads_production_idx on public.programme_ads(production_id);
create index if not exists sponsor_packages_production_idx on public.sponsor_packages(production_id);
create index if not exists sponsor_deliverables_production_idx on public.sponsor_deliverables(production_id);

create or replace function public.can_manage_sponsor_production(p_production_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.productions p
    join public.organizations o on o.id = p.organization_id
    where p.id = p_production_id
      and (
        o.admin_id = auth.uid()
        or exists (
          select 1 from public.org_members om
          where om.org_id = p.organization_id and om.user_id = auth.uid()
        )
      )
  );
$$;

grant execute on function public.can_manage_sponsor_production(uuid) to authenticated;

alter table public.sponsor_settings enable row level security;
alter table public.sponsor_businesses enable row level security;
alter table public.programme_ads enable row level security;
alter table public.sponsor_packages enable row level security;
alter table public.sponsor_deliverables enable row level security;

drop policy if exists "Sponsor settings public published read" on public.sponsor_settings;
create policy "Sponsor settings public published read" on public.sponsor_settings
for select to anon, authenticated
using (coalesce((settings #>> '{publicPage,published}')::boolean, true));

drop policy if exists "Sponsor settings organisation manage" on public.sponsor_settings;
create policy "Sponsor settings organisation manage" on public.sponsor_settings
for all to authenticated
using (public.can_manage_sponsor_production(production_id))
with check (public.can_manage_sponsor_production(production_id));

do $$
declare table_name text;
begin
  foreach table_name in array array['sponsor_businesses','programme_ads','sponsor_packages','sponsor_deliverables'] loop
    execute format('drop policy if exists "Sponsor workspace organisation manage" on public.%I', table_name);
    execute format('create policy "Sponsor workspace organisation manage" on public.%I for all to authenticated using (public.can_manage_sponsor_production(production_id)) with check (public.can_manage_sponsor_production(production_id))', table_name);
  end loop;
end $$;

create or replace function public.submit_sponsor_interest(
  p_production_id uuid,
  p_kind text,
  p_business_name text,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text default null,
  p_option_id text default null,
  p_option_label text default null,
  p_format text default null,
  p_amount_cents integer default 0,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings jsonb;
  v_business_id uuid;
  v_option jsonb;
  v_expected_cents integer;
begin
  if p_kind not in ('sponsor','ad') then raise exception 'Unsupported sponsor request type'; end if;
  if nullif(trim(p_business_name),'') is null or nullif(trim(p_contact_name),'') is null or nullif(trim(p_contact_email),'') is null then raise exception 'Business, contact, and email are required'; end if;
  if length(p_business_name) > 180 or length(p_contact_name) > 180 or length(p_contact_email) > 320 then raise exception 'Submitted value is too long'; end if;

  select settings into v_settings from public.sponsor_settings where production_id = p_production_id;
  if v_settings is null or not coalesce((v_settings #>> '{publicPage,published}')::boolean, true) then raise exception 'Sponsor opportunities are not published'; end if;

  if p_kind = 'sponsor' then
    select item into v_option from jsonb_array_elements(coalesce(v_settings->'tiers','[]'::jsonb)) item where item->>'label' = p_option_label limit 1;
    if v_option is null then raise exception 'Sponsor tier is unavailable'; end if;
    v_expected_cents := round(coalesce((v_option->>'amount')::numeric,0) * 100);
  else
    select item into v_option from jsonb_array_elements(coalesce(v_settings->'adSizes','[]'::jsonb)) item where item->>'id' = p_option_id limit 1;
    if v_option is null or p_format not in ('colour','bw') then raise exception 'Programme ad option is unavailable'; end if;
    if p_format = 'colour' and coalesce((v_option->>'colour_enabled')::boolean,true) is false then raise exception 'Colour option is unavailable'; end if;
    if p_format = 'bw' and coalesce((v_option->>'bw_enabled')::boolean,true) is false then raise exception 'Black and white option is unavailable'; end if;
    v_expected_cents := round(coalesce((v_option->>case when p_format='colour' then 'colour' else 'bw' end)::numeric,0) * 100);
  end if;
  if v_expected_cents <> greatest(coalesce(p_amount_cents,0),0) then raise exception 'Option price changed; refresh and try again'; end if;

  insert into public.sponsor_businesses(production_id,name,contact_name,contact_email,contact_phone,notes)
  values(p_production_id,trim(p_business_name),trim(p_contact_name),lower(trim(p_contact_email)),nullif(trim(p_contact_phone),''),'Submitted from sponsor public page.')
  returning id into v_business_id;

  if p_kind = 'sponsor' then
    insert into public.sponsor_packages(production_id,business_id,tier_name,amount_cents,payment_status,notes)
    values(p_production_id,v_business_id,p_option_label,v_expected_cents,'unpaid',nullif(trim(p_notes),''));
  else
    insert into public.programme_ads(production_id,business_id,ad_size,ad_type,price_cents,payment_status,artwork_status,approval_status,notes)
    values(p_production_id,v_business_id,p_option_id,p_format,v_expected_cents,'unpaid','missing','pending',nullif(trim(p_notes),''));
  end if;
  return jsonb_build_object('ok',true,'business_id',v_business_id);
end;
$$;

revoke all on function public.submit_sponsor_interest(uuid,text,text,text,text,text,text,text,text,integer,text) from public;
grant execute on function public.submit_sponsor_interest(uuid,text,text,text,text,text,text,text,text,integer,text) to anon, authenticated;

insert into storage.buckets(id,name,public)
values('programme-ads','programme-ads',true)
on conflict(id) do update set public = true;

drop policy if exists "Public can view programme ad assets" on storage.objects;
create policy "Public can view programme ad assets" on storage.objects for select to anon, authenticated using (bucket_id='programme-ads');

drop policy if exists "Organisation can upload programme ad assets" on storage.objects;
create policy "Organisation can upload programme ad assets" on storage.objects for insert to authenticated
with check (bucket_id='programme-ads' and public.can_manage_sponsor_production(((storage.foldername(name))[1])::uuid));

drop policy if exists "Organisation can update programme ad assets" on storage.objects;
create policy "Organisation can update programme ad assets" on storage.objects for update to authenticated
using (bucket_id='programme-ads' and public.can_manage_sponsor_production(((storage.foldername(name))[1])::uuid))
with check (bucket_id='programme-ads' and public.can_manage_sponsor_production(((storage.foldername(name))[1])::uuid));

drop policy if exists "Organisation can delete programme ad assets" on storage.objects;
create policy "Organisation can delete programme ad assets" on storage.objects for delete to authenticated
using (bucket_id='programme-ads' and public.can_manage_sponsor_production(((storage.foldername(name))[1])::uuid));
