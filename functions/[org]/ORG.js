// Cloudflare Pages Function
// Routes /:org/ORG -> protected organisation dashboard.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Organisations/org-dashboard.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
