create or replace function public.get_public_sponsor_page(p_production_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when coalesce((s.settings #>> '{publicPage,published}')::boolean, false) then
      jsonb_build_object(
        'adSizes', coalesce(s.settings->'adSizes','[]'::jsonb),
        'tiers', coalesce(s.settings->'tiers','[]'::jsonb),
        'deadlines', coalesce(s.settings->'deadlines','{}'::jsonb),
        'publicStats', coalesce(s.settings->'publicStats','[]'::jsonb),
        'publicPage', coalesce(s.settings->'publicPage','{}'::jsonb)
      )
    else null
  end
  from public.sponsor_settings s
  where s.production_id = p_production_id;
$$;

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
  if v_settings is null or not coalesce((v_settings #>> '{publicPage,published}')::boolean, false) then raise exception 'Sponsor opportunities are not published'; end if;

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

revoke all on function public.get_public_sponsor_page(uuid) from public;
grant execute on function public.get_public_sponsor_page(uuid) to anon, authenticated;
revoke all on function public.submit_sponsor_interest(uuid,text,text,text,text,text,text,text,text,integer,text) from public;
grant execute on function public.submit_sponsor_interest(uuid,text,text,text,text,text,text,text,text,integer,text) to anon, authenticated;
