// Cloudflare Pages Function
// Canonicalises old direct SYSTEM asset URLs into clean public routes.

const SYSTEM_REDIRECTS = new Map([
  ['members/account/login.html', '/login'],
  ['members/account/signup.html', '/signup'],
  ['members/account/forgot-password.html', '/forgot-password'],
  ['members/account/reset-password.html', '/reset-password'],
  ['members/profiles/profile-select.html', '/member'],
  ['members/profiles/profile-create.html', '/member/profile/create'],
  ['members/profiles/profile-sections.html', '/member/profile/edit'],
  ['members/performer/performer-dashboard.html', '/member/performer/dashboard'],
  ['members/volunteer/volunteer-shifts.html', '/member/volunteer/shifts'],
  ['members/volunteer/volunteer-best-fit.html', '/member/volunteer/best-fit'],
  ['members/volunteer/volunteer-hours.html', '/member/volunteer/hours'],
  ['organisations/org-dashboard.html', '/org/dashboard'],
  ['organisations/org-setup.html', '/org/setup'],
  ['organisations/productions/setup/production-wizard.html', '/org/production/new'],
  ['organisations/productions/creative/creative-tasks.html', '/member/creative/tasks'],
  ['organisations/productions/creative/creative-files.html', '/member/creative/files'],
  ['public/audition.html', '/audition'],
  ['public/audition-info.html', '/audition-info'],
]);

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const rawPath = Array.isArray(context.params.path)
    ? context.params.path.join('/')
    : String(context.params.path || '');
  const key = rawPath.toLowerCase();
  const target = SYSTEM_REDIRECTS.get(key);
  if (target) {
    const next = new URL(target, url.origin);
    next.search = url.search;
    next.hash = url.hash;
    return Response.redirect(next.toString(), 308);
  }
  return context.env.ASSETS.fetch(context.request);
}
