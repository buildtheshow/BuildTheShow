// Cloudflare Pages Function
// Routes /:org/:show/sponsors to the shared public sponsor opportunities page.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Public/sponsors.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
