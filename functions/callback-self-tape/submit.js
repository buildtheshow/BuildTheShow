// Cloudflare Pages Function
// Routes /callback-self-tape/submit to the callback self tape submit page.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Public/callback-self-tape-submit.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
