// Cloudflare Pages Function
// Routes /self-tape → serves SYSTEM/Public/self-tape.html
// The page JS reads ?prod= from the query string

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Public/self-tape.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
