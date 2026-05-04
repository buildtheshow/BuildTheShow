// Cloudflare Pages Function
// Routes /:org/:show/self-tape/submit → serves SYSTEM/Public/self-tape-submit.html
// The page reads org/show slugs from pathname and app ID from ?app=

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Public/self-tape-submit.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
