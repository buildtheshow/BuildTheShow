// Beta registration keeps the existing form at its public URL.
export async function onRequest(context) {
  const asset = await context.env.ASSETS.fetch(new URL('/SYSTEM/Members/Account/signup.html', context.request.url));
  const response = new Response(asset.body, asset);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
