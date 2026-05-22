// Cloudflare Pages Function
// Routes clean member URLs directly to their HTML shells.

const MEMBER_ROUTE_ASSETS = new Map([
  ['', '/SYSTEM/Members/Profiles/profile-select.html'],
  ['dashboard', '/SYSTEM/Members/Dashboard/member-dashboard.html'],
  ['calendar', '/SYSTEM/Members/Dashboard/member-calendar.html'],
  ['profiles', '/SYSTEM/Members/Profiles/profiles.html'],
  ['profile', '/SYSTEM/Members/Profiles/profile-view.html'],
  ['profile/edit', '/SYSTEM/Members/Profiles/profile-sections.html'],
  ['profile/create', '/SYSTEM/Members/Profiles/profile-create.html'],
  ['applications', '/SYSTEM/Members/Auditions/applications.html'],
  ['media', '/SYSTEM/Members/Performer/performer-media.html'],
  ['performer', '/SYSTEM/Members/Performer/performer-hub.html'],
  ['performer/dashboard', '/SYSTEM/Members/Performer/performer-dashboard.html'],
  ['settings', '/SYSTEM/Members/Performer/performer-settings.html'],
  ['creative', '/SYSTEM/Organisations/Productions/Creative/creative-hub.html'],
  ['creative/tasks', '/SYSTEM/Organisations/Productions/Creative/creative-tasks.html'],
  ['creative/files', '/SYSTEM/Organisations/Productions/Creative/creative-files.html'],
  ['volunteer', '/SYSTEM/Members/Volunteer/volunteer-hub.html'],
  ['volunteer/shifts', '/SYSTEM/Members/Volunteer/volunteer-shifts.html'],
  ['volunteer/best-fit', '/SYSTEM/Members/Volunteer/volunteer-best-fit.html'],
  ['volunteer/hours', '/SYSTEM/Members/Volunteer/volunteer-hours.html'],
]);

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const rawPath = Array.isArray(context.params.path)
    ? context.params.path.join('/')
    : String(context.params.path || '');
  const key = rawPath.toLowerCase().replace(/^\/+|\/+$/g, '');
  const assetPath = MEMBER_ROUTE_ASSETS.get(key);
  if (!assetPath) return new Response('Not found', { status: 404 });
  return context.env.ASSETS.fetch(new URL(assetPath, url));
}
