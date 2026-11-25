BEGIN;

-- Keep public tokens usable by the restricted migration role without relying on
-- the pgcrypto extension schema being in its search_path.
ALTER TABLE public.organizations
  ALTER COLUMN proposal_submission_token
  SET DEFAULT left(replace(gen_random_uuid()::text, '-', ''), 24);

ALTER TABLE public.production_proposal_intakes
  ALTER COLUMN access_token
  SET DEFAULT left(replace(gen_random_uuid()::text, '-', ''), 24);

-- Earlier versions already added these fields, so normalize existing NULL values
-- before enforcing the defaults expected by the sponsor booking forms.
UPDATE public.programme_ads
SET artwork_data = '{}'::jsonb
WHERE artwork_data IS NULL;

ALTER TABLE public.programme_ads
  ALTER COLUMN artwork_data SET DEFAULT '{}'::jsonb,
  ALTER COLUMN artwork_data SET NOT NULL;

UPDATE public.sponsor_packages
SET artwork_data = '{}'::jsonb
WHERE artwork_data IS NULL;

ALTER TABLE public.sponsor_packages
  ALTER COLUMN artwork_data SET DEFAULT '{}'::jsonb,
  ALTER COLUMN artwork_data SET NOT NULL;

-- Preserve the current account-scoped wrapper while fixing missing production_id
-- on files stored by the private sponsor-submission function.
CREATE OR REPLACE FUNCTION bts_private.finalize_sponsor_submission(
  p_production_id uuid,
  p_business_id uuid,
  p_kind text,
  p_website text default null,
  p_notes text default null,
  p_artwork_status text default null,
  p_files jsonb default '[]'::jsonb,
  p_artwork_data jsonb default '{}'::jsonb,
  p_payment_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ad_id uuid;
  v_pkg_id uuid;
  v_submission_note text;
  v_file jsonb;
  v_file_name text;
  v_file_url text;
  v_file_path text;
  v_linked_id uuid;
begin
  if p_kind not in ('sponsor', 'ad') then
    raise exception 'Unsupported sponsor request type';
  end if;

  if p_payment_status is not null and p_payment_status not in ('unpaid', 'paid', 'invoice_sent', 'overdue', 'trade') then
    raise exception 'Unsupported payment status';
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

  if jsonb_typeof(coalesce(p_artwork_data, '{}'::jsonb)) <> 'object' then
    raise exception 'Artwork data must be an object';
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
          artwork_data = coalesce(p_artwork_data, '{}'::jsonb),
          payment_status = coalesce(p_payment_status, payment_status),
          updated_at = now()
      where id = v_ad_id;
    end if;
    v_linked_id := v_ad_id;
  else
    select p.id
    into v_pkg_id
    from public.sponsor_packages p
    where p.production_id = p_production_id
      and p.business_id = p_business_id
    order by p.created_at desc, p.id desc
    limit 1;

    if v_pkg_id is not null then
      update public.sponsor_packages
      set artwork_data = coalesce(p_artwork_data, '{}'::jsonb),
          payment_status = coalesce(p_payment_status, payment_status),
          updated_at = now()
      where id = v_pkg_id;
    end if;
    v_linked_id := v_pkg_id;
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
      production_id,
      business_id,
      file_url,
      file_name,
      file_type,
      linked_ad_id,
      uploaded_by
    )
    values (
      p_production_id,
      p_business_id,
      v_file_url,
      v_file_name,
      case when p_kind = 'ad' then 'artwork' else 'logo' end,
      v_ad_id,
      'business'
    );
  end loop;

  return jsonb_build_object('ok', true, 'business_id', p_business_id, 'ad_id', v_ad_id, 'package_id', v_pkg_id);
end;
$$;

COMMIT;
