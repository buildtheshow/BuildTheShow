// Cloudflare Pages Function
// Routes /:org/:show/sponsors to the shared public sponsor opportunities page.

export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    const assetUrl = new URL('/SYSTEM/Public/sponsors.html', url);
    return context.env.ASSETS.fetch(new Request(assetUrl.toString(), context.request));
  } catch (err) {
    return new Response('Sponsor page unavailable: ' + err.message, { status: 500 });
  }
}
