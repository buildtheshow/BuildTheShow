// Cloudflare Pages Function
// Routes /:org/:show/CastOffer/:code to the shared public cast offer response page.
// The page resolves the readable offer code back to the applicant.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Public/cast-offer-response.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
