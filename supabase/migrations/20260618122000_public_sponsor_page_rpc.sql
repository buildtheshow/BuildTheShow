drop policy if exists "Sponsor settings public published read" on public.sponsor_settings;
revoke select on table public.sponsor_settings from anon;

create or replace function public.get_public_sponsor_page(p_production_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when coalesce((s.settings #>> '{publicPage,published}')::boolean, true) then
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

revoke all on function public.get_public_sponsor_page(uuid) from public;
grant execute on function public.get_public_sponsor_page(uuid) to anon, authenticated;
