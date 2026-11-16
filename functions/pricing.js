// Serve the existing pricing page without exposing its internal asset address.
export async function onRequest(context) {
  const asset = await context.env.ASSETS.fetch(new URL('/PUBLIC/pricing.html', context.request.url));
  const response = new Response(asset.body, asset);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
