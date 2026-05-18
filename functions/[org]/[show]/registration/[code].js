// Cloudflare Pages Function
// Routes /:org/:show/registration/:code to the shared public registration entry point.
// The page resolves the readable performer code back to the applicant.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Public/cast-offer-response.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
