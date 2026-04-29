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

export async function onRequest(context) {
  const org = String(context.params.org || '');
  if (RESERVED_ROOTS.has(org)) {
    return context.env.ASSETS.fetch(context.request);
  }

  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Organisations/org-profile.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
