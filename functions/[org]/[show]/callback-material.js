// Exact clean route for public callback material pages:
// /:org/:show/callback-material

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Public/callback-sides.html', url);
  return context.env.ASSETS.fetch(new Request(assetUrl.toString(), context.request));
}
