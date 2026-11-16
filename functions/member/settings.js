// Serve Settings at its public route without exposing the source-file path.
export async function onRequest(context) {
  const asset = await context.env.ASSETS.fetch(new URL('/SYSTEM/Members/Performer/performer-settings.html', context.request.url));
  const response = new Response(asset.body, asset);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
