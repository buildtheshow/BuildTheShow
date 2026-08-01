// Cloudflare Pages Function
// Routes /:org/:show/crew → serves SYSTEM/Organisations/Productions/Workspace/treasurer-portal.html,
// the login portal for Department Leads, the Treasurer, and Volunteers (one shared login gate,
// same file, different role labels -- see PORTAL_DEFS in portals.html). Previously this portal had
// no pretty URL at all and could only be reached via the raw /SYSTEM/.../treasurer-portal.html path.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Organisations/Productions/Workspace/treasurer-portal.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
