revoke all on table public.sponsor_settings from anon;
revoke all on table public.sponsor_businesses from anon;
revoke all on table public.programme_ads from anon;
revoke all on table public.sponsor_packages from anon;
revoke all on table public.sponsor_deliverables from anon;

grant select on table public.sponsor_settings to anon;

grant select, insert, update, delete on table public.sponsor_settings to authenticated;
grant select, insert, update, delete on table public.sponsor_businesses to authenticated;
grant select, insert, update, delete on table public.programme_ads to authenticated;
grant select, insert, update, delete on table public.sponsor_packages to authenticated;
grant select, insert, update, delete on table public.sponsor_deliverables to authenticated;
