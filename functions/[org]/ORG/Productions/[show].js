// Cloudflare Pages Function
// Routes /:org/ORG/Productions/:show -> protected production workspace.
// The workspace resolves org/show slugs and then manages nested section URLs client-side.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/production-workspace', url);
  return context.env.ASSETS.fetch(assetUrl);
}
