// Cloudflare Pages Function
// Routes /org/production -> protected production workspace.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Organisations/Productions/Workspace/production-workspace.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
