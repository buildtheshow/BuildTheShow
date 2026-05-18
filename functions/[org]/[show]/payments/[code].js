// Cloudflare Pages Function
// Routes /:org/:show/payments/:code to the shared public payments entry point.
// The page resolves the readable performer code back to the applicant.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Public/cast-offer-response.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
