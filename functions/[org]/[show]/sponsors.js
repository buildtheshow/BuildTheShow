// Cloudflare Pages Function
// Routes /:org/:show/sponsors to the shared public sponsor opportunities page.

export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    // Use the pretty path (no .html) — ASSETS.fetch runs redirect rules,
    // so .html triggers a strip-extension redirect that loops.
    const assetUrl = new URL('/SYSTEM/Public/sponsors', url);
    return await context.env.ASSETS.fetch(assetUrl.toString());
  } catch (err) {
    return new Response(
      '<!DOCTYPE html><html><body><h2>Could not load sponsors page</h2><pre>' + err.message + '</pre></body></html>',
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
}
