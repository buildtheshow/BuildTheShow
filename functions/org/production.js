// Cloudflare Pages Function
// Routes /org/production -> protected production workspace.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/production-workspace', url);
  return context.env.ASSETS.fetch(assetUrl);
}
