// Cloudflare Pages Function
// Routes /:org/:show/CastOffer/:code/:decision to the shared public cast offer response page.
// YES and NO stay visually separated in the email and in the URL.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Public/cast-offer-response.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
