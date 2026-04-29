// Cloudflare Pages Function
// Routes /:org/org/productions/:show -> protected production workspace.
// The workspace still reads ?id=... as the source of truth.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Organisations/Productions/Workspace/production-workspace.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
