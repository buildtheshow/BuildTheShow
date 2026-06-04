// Cloudflare Pages Function
// Routes /:org/:show/portal → production portal (same page as /volunteers, activates portal view)

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/PUBLIC/volunteer-production-page.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
