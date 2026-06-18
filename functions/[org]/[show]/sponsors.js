// Cloudflare Pages Function
// Routes /:org/:show/sponsors to the public sponsor opportunities page.
// Served from /PUBLIC/ (not /SYSTEM/Public/) to avoid the SYSTEM/[[path]].js intercept loop.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/PUBLIC/sponsors.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
