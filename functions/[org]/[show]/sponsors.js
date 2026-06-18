// Cloudflare Pages Function
// Routes /:org/:show/sponsors to the shared public sponsor opportunities page.
// Must use the pretty path (no .html) — CF Pages ASSETS.fetch runs redirect rules
// so requesting the .html path triggers a strip-extension redirect and loops.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Public/sponsors', url);
  return context.env.ASSETS.fetch(assetUrl);
}
