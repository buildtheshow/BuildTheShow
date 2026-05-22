// Cloudflare Pages Function
// Routes nested production workspace pages like
// /:org/ORG/Productions/:show/auditions/casting-board back to the shared shell.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/production-workspace', url);
  return context.env.ASSETS.fetch(assetUrl);
}
