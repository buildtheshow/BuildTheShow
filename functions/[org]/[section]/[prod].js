// Cloudflare Pages Function
// Routes /:org/Audition/:prod and /:org/ArchiveYEAR/:prod to the public production page.
// The page JS resolves the org + production slug from window.location.pathname.

export async function onRequest(context) {
  const section = String(context.params.section || '');
  if (section !== 'Audition' && !/^Archive\d{4}$/.test(section)) {
    return new Response('Not found', { status: 404 });
  }

  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Public/audition-info.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
