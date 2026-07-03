insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'venue-photos',
  'venue-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

alter table if exists public.venues
  add column if not exists photo_path text;

update public.venues
set photo_path = regexp_replace(photo_url, '^storage://venue-photos/', '')
where photo_path is null
  and photo_url like 'storage://venue-photos/%';

drop policy if exists "Organisation can upload venue photos" on storage.objects;
drop policy if exists "Organisation can view venue photos" on storage.objects;
drop policy if exists "Organisation can update venue photos" on storage.objects;
drop policy if exists "Organisation can delete venue photos" on storage.objects;

create policy "Organisation can upload venue photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'venue-photos'
  and exists (
    select 1
    from public.organizations o
    where o.id::text = (storage.foldername(name))[1]
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

create policy "Organisation can view venue photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'venue-photos'
  and exists (
    select 1
    from public.organizations o
    where o.id::text = (storage.foldername(name))[1]
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

create policy "Organisation can update venue photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'venue-photos'
  and exists (
    select 1
    from public.organizations o
    where o.id::text = (storage.foldername(name))[1]
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
  bucket_id = 'venue-photos'
  and exists (
    select 1
    from public.organizations o
    where o.id::text = (storage.foldername(name))[1]
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

create policy "Organisation can delete venue photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'venue-photos'
  and exists (
    select 1
    from public.organizations o
    where o.id::text = (storage.foldername(name))[1]
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
