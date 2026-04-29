// Cloudflare Pages Function
// Routes /org/setup -> protected organisation setup.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Organisations/org-setup.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
