export async function onRequest(context) {
  const asset = await context.env.ASSETS.fetch(new URL('/PUBLIC/confirm-account.html', context.request.url));
  const response = new Response(asset.body, asset);
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
