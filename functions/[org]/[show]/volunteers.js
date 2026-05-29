// Cloudflare Pages Function
// Routes /:org/:show/volunteers → public volunteer sign-up page for that production

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/PUBLIC/volunteer-production-page.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
