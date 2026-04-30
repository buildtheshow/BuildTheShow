// Cloudflare Pages Function
// Routes nested public audition pages like /:org/:show/Audition/...
// back to the shared public audition shell.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Public/audition-info.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
