// Cloudflare Pages Function
// Routes public production pages to the public production page.
// Supported:
// - /:org/:prod/Audition
// - /:org/:prod/Callbackmaterial
// - /:org/:prod/ArchiveYEAR
// - /:org/:prod/Team
// - /:org/Audition/:prod (legacy)
// - /:org/ArchiveYEAR/:prod (legacy)
// The page JS resolves the org + production slug from window.location.pathname.

const CLEAN_ROUTE_ASSETS = new Map([
  ['member/profile/edit', '/SYSTEM/Members/Profiles/profile-sections.html'],
  ['member/profile/create', '/SYSTEM/Members/Profiles/profile-create.html'],
  ['member/performer/dashboard', '/SYSTEM/Members/Performer/performer-dashboard.html'],
  ['member/volunteer/shifts', '/SYSTEM/Members/Volunteer/volunteer-shifts.html'],
  ['member/volunteer/best-fit', '/SYSTEM/Members/Volunteer/volunteer-best-fit.html'],
  ['member/volunteer/hours', '/SYSTEM/Members/Volunteer/volunteer-hours.html'],
  ['member/creative/tasks', '/SYSTEM/Organisations/Productions/Creative/creative-tasks.html'],
  ['member/creative/files', '/SYSTEM/Organisations/Productions/Creative/creative-files.html'],
  ['org/production/new', '/SYSTEM/Organisations/Productions/Setup/production-wizard.html'],
]);

function fetchAsset(context, assetPath) {
  const url = new URL(context.request.url);
  const assetUrl = new URL(assetPath, url);
  return context.env.ASSETS.fetch(new Request(assetUrl.toString(), context.request));
}

export async function onRequest(context) {
  const org = String(context.params.org || '');
  const section = String(context.params.section || '');
  const prod = String(context.params.prod || '');

  if (['ASSETS', 'HOME', 'PUBLIC', 'SHARED', 'SYSTEM'].includes(org)) {
    return context.env.ASSETS.fetch(context.request);
  }

  const cleanRouteAsset = CLEAN_ROUTE_ASSETS.get(
    `${org.toLowerCase()}/${section.toLowerCase()}/${prod.toLowerCase()}`
  );
  if (cleanRouteAsset) {
    return fetchAsset(context, cleanRouteAsset);
  }

  const isLegacyPurpose = /^auditions?$/i.test(section) || /^Archive\d{4}$/i.test(section);
  const isTeamPurpose = /^team$/i.test(prod);
  const isCallbackMaterialsPurpose = /^callback-?(sides|materials?)$/i.test(prod);
  const isPurposeLast = /^auditions?$/i.test(prod) || /^Archive\d{4}$/i.test(prod) || isTeamPurpose || isCallbackMaterialsPurpose;
  if (!isLegacyPurpose && !isPurposeLast) {
    return new Response('Not found', { status: 404 });
  }

  return fetchAsset(
    context,
    isCallbackMaterialsPurpose
      ? '/PUBLIC/callback-sides'
      : isTeamPurpose
      ? '/SYSTEM/Organisations/Productions/Workspace/audition-team.html'
      : '/SYSTEM/Public/audition-info.html'
  );
}
