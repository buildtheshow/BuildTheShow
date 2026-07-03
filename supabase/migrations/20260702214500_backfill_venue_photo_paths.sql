update public.venues
set photo_path = regexp_replace(photo_url, '^storage://venue-photos/', '')
where photo_path is null
  and photo_url like 'storage://venue-photos/%';

update public.venues
set photo_path = split_part(
  substring(photo_url from '/storage/v1/object(?:/public|/sign)?/venue-photos/(.+)$'),
  '?',
  1
)
where photo_path is null
  and photo_url like '%/storage/v1/object%/venue-photos/%';
