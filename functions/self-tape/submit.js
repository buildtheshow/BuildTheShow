// Cloudflare Pages Function
// Routes /self-tape/submit → serves SYSTEM/Public/self-tape-submit.html
// The page JS reads ?prod= and ?app= from the query string

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Public/self-tape-submit.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
