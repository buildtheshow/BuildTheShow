// Cloudflare Pages Function
// Routes /:org/Audition/:prod → serves SYSTEM/Public/audition-info.html
// The page JS reads org + prod slugs from window.location.pathname

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Public/audition-info.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
