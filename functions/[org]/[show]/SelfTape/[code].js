// Cloudflare Pages Function
// Routes /:org/:show/SelfTape/:code → serves SYSTEM/Public/self-tape-submit.html
// The page resolves the short code back to the registered self-tape applicant.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Public/self-tape-submit.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
