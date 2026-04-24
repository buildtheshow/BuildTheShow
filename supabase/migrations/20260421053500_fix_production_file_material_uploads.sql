-- Fix production materials uploads.
-- The app uploads material files into storage bucket "production-files" using:
--   {production_id}/{folder_id}/{filename}
-- Then it updates production_characters and inserts a production_files row.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('production-files', 'production-files', true, null, null)
on conflict (id) do update
set public = true;

alter table if exists production_characters
  add column if not exists audition_file_url text,
  add column if not exists callback_file_url text,
  add column if not exists dance_call_file_url text,
  add column if not exists other_file_url text,
  add column if not exists audition_file_path text,
  add column if not exists callback_file_path text,
  add column if not exists dance_call_file_path text,
  add column if not exists other_file_path text,
  add column if not exists audition_file_name text,
  add column if not exists callback_file_name text,
  add column if not exists dance_call_file_name text,
  add column if not exists other_file_name text,
  add column if not exists audition_material_types text[] default '{}',
  add column if not exists callback_material_types text[] default '{}',
  add column if not exists dance_call_material_types text[] default '{}',
  add column if not exists other_material_types text[] default '{}',
  add column if not exists audition_side_url text,
  add column if not exists audition_side_path text,
  add column if not exists audition_side_name text,
  add column if not exists audition_songcut_url text,
  add column if not exists audition_songcut_path text,
  add column if not exists audition_songcut_name text,
  add column if not exists audition_other_url text,
  add column if not exists audition_other_path text,
  add column if not exists audition_other_name text,
  add column if not exists callback_side_url text,
  add column if not exists callback_side_path text,
  add column if not exists callback_side_name text,
  add column if not exists callback_songcut_url text,
  add column if not exists callback_songcut_path text,
  add column if not exists callback_songcut_name text,
  add column if not exists callback_other_url text,
  add column if not exists callback_other_path text,
  add column if not exists callback_other_name text,
  add column if not exists dance_call_side_url text,
  add column if not exists dance_call_side_path text,
  add column if not exists dance_call_side_name text,
  add column if not exists dance_call_songcut_url text,
  add column if not exists dance_call_songcut_path text,
  add column if not exists dance_call_songcut_name text,
  add column if not exists dance_call_other_url text,
  add column if not exists dance_call_other_path text,
  add column if not exists dance_call_other_name text,
  add column if not exists other_side_url text,
  add column if not exists other_side_path text,
  add column if not exists other_side_name text,
  add column if not exists other_songcut_url text,
  add column if not exists other_songcut_path text,
  add column if not exists other_songcut_name text,
  add column if not exists other_other_url text,
  add column if not exists other_other_path text,
  add column if not exists other_other_name text,
  add column if not exists audition_side_notes text,
  add column if not exists audition_songcut_notes text,
  add column if not exists audition_other_notes text,
  add column if not exists callback_side_notes text,
  add column if not exists callback_songcut_notes text,
  add column if not exists callback_other_notes text,
  add column if not exists dance_call_side_notes text,
  add column if not exists dance_call_songcut_notes text,
  add column if not exists dance_call_other_notes text,
  add column if not exists other_side_notes text,
  add column if not exists other_songcut_notes text,
  add column if not exists other_other_notes text;

alter table if exists production_folders enable row level security;
alter table if exists production_files enable row level security;
alter table if exists production_characters enable row level security;

drop policy if exists "Org can upload production file objects" on storage.objects;
drop policy if exists "Org can view production file objects" on storage.objects;
drop policy if exists "Org can update production file objects" on storage.objects;
drop policy if exists "Org can delete production file objects" on storage.objects;

create policy "Org can upload production file objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'production-files'
  and exists (
    select 1
    from productions p
    join organizations o on o.id = p.organization_id
    where p.id::text = (storage.foldername(name))[1]
      and (
        o.admin_id = auth.uid()
        or exists (
          select 1
          from org_members om
          where om.org_id = p.organization_id
            and om.user_id = auth.uid()
        )
      )
  )
);

create policy "Org can view production file objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'production-files'
  and exists (
    select 1
    from productions p
    join organizations o on o.id = p.organization_id
    where p.id::text = (storage.foldername(name))[1]
      and (
        o.admin_id = auth.uid()
        or exists (
          select 1
          from org_members om
          where om.org_id = p.organization_id
            and om.user_id = auth.uid()
        )
      )
  )
);

create policy "Org can update production file objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'production-files'
  and exists (
    select 1
    from productions p
    join organizations o on o.id = p.organization_id
    where p.id::text = (storage.foldername(name))[1]
      and (
        o.admin_id = auth.uid()
        or exists (
          select 1
          from org_members om
          where om.org_id = p.organization_id
            and om.user_id = auth.uid()
        )
      )
  )
)
with check (
  bucket_id = 'production-files'
  and exists (
    select 1
    from productions p
    join organizations o on o.id = p.organization_id
    where p.id::text = (storage.foldername(name))[1]
      and (
        o.admin_id = auth.uid()
        or exists (
          select 1
          from org_members om
          where om.org_id = p.organization_id
            and om.user_id = auth.uid()
        )
      )
  )
);

create policy "Org can delete production file objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'production-files'
  and exists (
    select 1
    from productions p
    join organizations o on o.id = p.organization_id
    where p.id::text = (storage.foldername(name))[1]
      and (
        o.admin_id = auth.uid()
        or exists (
          select 1
          from org_members om
          where om.org_id = p.organization_id
            and om.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "Org can manage production folders" on production_folders;
drop policy if exists "Org can manage production files" on production_files;
drop policy if exists "Org can manage production characters" on production_characters;

create policy "Org can manage production folders"
on production_folders
for all
to authenticated
using (
  production_id in (
    select p.id
    from productions p
    join organizations o on o.id = p.organization_id
    where o.admin_id = auth.uid()
       or exists (
        select 1
        from org_members om
        where om.org_id = p.organization_id
          and om.user_id = auth.uid()
      )
  )
)
with check (
  production_id in (
    select p.id
    from productions p
    join organizations o on o.id = p.organization_id
    where o.admin_id = auth.uid()
       or exists (
        select 1
        from org_members om
        where om.org_id = p.organization_id
          and om.user_id = auth.uid()
      )
  )
);

create policy "Org can manage production files"
on production_files
for all
to authenticated
using (
  production_id in (
    select p.id
    from productions p
    join organizations o on o.id = p.organization_id
    where o.admin_id = auth.uid()
       or exists (
        select 1
        from org_members om
        where om.org_id = p.organization_id
          and om.user_id = auth.uid()
      )
  )
)
with check (
  production_id in (
    select p.id
    from productions p
    join organizations o on o.id = p.organization_id
    where o.admin_id = auth.uid()
       or exists (
        select 1
        from org_members om
        where om.org_id = p.organization_id
          and om.user_id = auth.uid()
      )
  )
);

create policy "Org can manage production characters"
on production_characters
for all
to authenticated
using (
  production_id in (
    select p.id
    from productions p
    join organizations o on o.id = p.organization_id
    where o.admin_id = auth.uid()
       or exists (
        select 1
        from org_members om
        where om.org_id = p.organization_id
          and om.user_id = auth.uid()
      )
  )
)
with check (
  production_id in (
    select p.id
    from productions p
    join organizations o on o.id = p.organization_id
    where o.admin_id = auth.uid()
       or exists (
        select 1
        from org_members om
        where om.org_id = p.organization_id
          and om.user_id = auth.uid()
      )
  )
);
