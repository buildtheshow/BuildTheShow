alter table if exists public.production_files
  add column if not exists document_type text;

create index if not exists production_files_production_document_type_idx
  on public.production_files (production_id, document_type);

update public.production_files
set document_type = 'actors-script'
where document_type is null
  and tags @> array['actors-script']::text[];

update public.production_files
set document_type = 'directors-script'
where document_type is null
  and tags @> array['directors-script']::text[];

update public.production_files
set document_type = 'piano-vocal-score'
where document_type is null
  and tags @> array['piano-vocal-score']::text[];
