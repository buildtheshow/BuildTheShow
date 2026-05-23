// Cloudflare Pages Function
// Routes /:org/:show/callbacksides to the public callback sides page.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Public/callback-sides.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
