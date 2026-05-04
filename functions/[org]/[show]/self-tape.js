// Cloudflare Pages Function
// Routes /:org/:show/self-tape → serves SYSTEM/Public/self-tape.html
// The page reads org and show slugs from window.location.pathname

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Public/self-tape.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
