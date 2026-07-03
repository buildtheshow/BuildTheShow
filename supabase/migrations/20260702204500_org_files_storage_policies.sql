drop policy if exists "Organisation can upload org files" on storage.objects;
drop policy if exists "Organisation can view org files" on storage.objects;
drop policy if exists "Organisation can update org files" on storage.objects;
drop policy if exists "Organisation can delete org files" on storage.objects;

create policy "Organisation can upload org files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'org-files'
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

create policy "Organisation can view org files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'org-files'
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

create policy "Organisation can update org files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'org-files'
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
  bucket_id = 'org-files'
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

create policy "Organisation can delete org files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'org-files'
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
