// Keep authentication at the public login route while serving the existing form.
export async function onRequest(context) {
  const asset = await context.env.ASSETS.fetch(new URL('/SYSTEM/Members/Account/login.html', context.request.url));
  const response = new Response(asset.body, asset);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
