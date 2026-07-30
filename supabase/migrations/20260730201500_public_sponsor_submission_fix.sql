create or replace function public.try_uuid(p_value text)
returns uuid
language plpgsql
immutable
as $$
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;
  return p_value::uuid;
exception
  when others then
    return null;
end;
$$;

create or replace function public.can_public_upload_programme_ad_asset(p_production_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sponsor_settings s
    where s.production_id = p_production_id
      and coalesce((s.settings #>> '{publicPage,published}')::boolean, false)
  );
$$;

grant execute on function public.try_uuid(text) to anon, authenticated;
grant execute on function public.can_public_upload_programme_ad_asset(uuid) to anon, authenticated;

drop policy if exists "Public can upload programme ad assets" on storage.objects;
create policy "Public can upload programme ad assets"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'programme-ads'
  and public.can_public_upload_programme_ad_asset(public.try_uuid((storage.foldername(name))[1]))
);

create or replace function public.finalize_sponsor_submission(
  p_production_id uuid,
  p_business_id uuid,
  p_kind text,
  p_website text default null,
  p_notes text default null,
  p_artwork_status text default null,
  p_files jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ad_id uuid;
  v_submission_note text;
  v_file jsonb;
  v_file_name text;
  v_file_url text;
  v_file_path text;
begin
  if p_kind not in ('sponsor', 'ad') then
    raise exception 'Unsupported sponsor request type';
  end if;

  if not exists (
    select 1
    from public.sponsor_businesses b
    where b.id = p_business_id
      and b.production_id = p_production_id
  ) then
    raise exception 'Sponsor submission not found';
  end if;

  if jsonb_typeof(coalesce(p_files, '[]'::jsonb)) <> 'array' then
    raise exception 'Uploaded files must be an array';
  end if;

  v_submission_note := nullif(trim(p_notes), '');
  if v_submission_note is not null then
    v_submission_note := v_submission_note || E'\n\nSubmitted from sponsor public page.';
  else
    v_submission_note := 'Submitted from sponsor public page.';
  end if;

  update public.sponsor_businesses
  set website = nullif(trim(p_website), ''),
      notes = v_submission_note,
      updated_at = now()
  where id = p_business_id
    and production_id = p_production_id;

  if p_kind = 'ad' then
    select a.id
    into v_ad_id
    from public.programme_ads a
    where a.production_id = p_production_id
      and a.business_id = p_business_id
    order by a.created_at desc, a.id desc
    limit 1;

    if v_ad_id is not null then
      update public.programme_ads
      set artwork_status = case
            when coalesce(jsonb_array_length(p_files), 0) > 0 and p_artwork_status = 'ready' then 'received'
            else artwork_status
          end,
          artwork_url = case
            when coalesce(jsonb_array_length(p_files), 0) > 0 then coalesce(nullif(trim((p_files->0->>'url')), ''), artwork_url)
            else artwork_url
          end,
          updated_at = now()
      where id = v_ad_id;
    end if;
  end if;

  for v_file in
    select value
    from jsonb_array_elements(coalesce(p_files, '[]'::jsonb))
  loop
    v_file_name := nullif(trim(v_file->>'name'), '');
    v_file_url := nullif(trim(v_file->>'url'), '');
    v_file_path := nullif(trim(v_file->>'path'), '');

    if v_file_name is null or v_file_url is null or v_file_path is null then
      continue;
    end if;

    if position(p_production_id::text || '/' || p_business_id::text || '/' in v_file_path) <> 1 then
      raise exception 'Uploaded file path does not match this submission';
    end if;

    if position('/storage/v1/object/public/programme-ads/' || v_file_path in v_file_url) = 0 then
      raise exception 'Uploaded file URL is invalid';
    end if;

    insert into public.sponsor_files (
      business_id,
      file_url,
      file_name,
      file_type,
      linked_ad_id,
      uploaded_by
    )
    values (
      p_business_id,
      v_file_url,
      v_file_name,
      case when p_kind = 'ad' then 'artwork' else 'logo' end,
      v_ad_id,
      'business'
    );
  end loop;

  return jsonb_build_object('ok', true, 'business_id', p_business_id, 'ad_id', v_ad_id);
end;
$$;

revoke all on function public.finalize_sponsor_submission(uuid,uuid,text,text,text,text,jsonb) from public;
grant execute on function public.finalize_sponsor_submission(uuid,uuid,text,text,text,text,jsonb) to anon, authenticated;
