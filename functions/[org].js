// Cloudflare Pages Function
// Routes /:org -> public organisation profile.
// Reserved/static folders continue to be served as normal assets.

const RESERVED_ROOTS = new Set([
  'ASSETS',
  'BACKEND',
  'HOME',
  'PUBLIC',
  'SHARED',
  'SYSTEM',
  'functions',
  'supabase',
]);

const CLEAN_ROUTE_ASSETS = new Map([
  ['login', '/SYSTEM/Members/Account/login.html'],
  ['signup', '/SYSTEM/Members/Account/signup.html'],
  ['forgot-password', '/SYSTEM/Members/Account/forgot-password.html'],
  ['reset-password', '/SYSTEM/Members/Account/reset-password.html'],
  ['find', '/PUBLIC/find.html'],
  ['opportunity', '/PUBLIC/opportunity-detail.html'],
  ['invite', '/PUBLIC/accept-invite.html'],
  ['audition', '/SYSTEM/Public/audition.html'],
  ['audition-info', '/SYSTEM/Public/audition-info.html'],
  ['privacy', '/SHARED/Legal/privacy-policy.html'],
  ['terms', '/SHARED/Legal/terms-of-service.html'],
  ['copyright', '/SHARED/Legal/copyright-policy.html'],
  ['accessibility', '/SHARED/Legal/accessibility-statement.html'],
  ['member', '/SYSTEM/Members/Profiles/profile-select.html'],
]);

export async function onRequest(context) {
  const org = String(context.params.org || '');
  if (RESERVED_ROOTS.has(org)) {
    return context.env.ASSETS.fetch(context.request);
  }

  const url = new URL(context.request.url);
  const cleanRouteAsset = CLEAN_ROUTE_ASSETS.get(org.toLowerCase());
  if (cleanRouteAsset) {
    return context.env.ASSETS.fetch(new URL(cleanRouteAsset, url));
  }

  const assetUrl = new URL('/SYSTEM/Organisations/org-profile.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
