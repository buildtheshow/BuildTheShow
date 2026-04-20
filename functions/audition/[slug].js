// Cloudflare Pages Function
// Routes /audition/:slug → serves SYSTEM/Public/audition-info.html
// The page JS reads the slug from window.location.pathname

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Public/audition-info.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
