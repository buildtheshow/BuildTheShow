// Keep household setup at its public route using the existing protected page.
export async function onRequest(context) {
  const asset = await context.env.ASSETS.fetch(new URL('/SYSTEM/Members/Households/households.html', context.request.url));
  const response = new Response(asset.body, asset);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
