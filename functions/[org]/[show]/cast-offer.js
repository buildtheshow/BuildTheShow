// Cloudflare Pages Function
// Routes /:org/:show/cast-offer to the shared public cast offer response page.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Public/cast-offer-response.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
