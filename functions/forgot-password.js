// Serve the existing recovery form at its public route without an internal redirect.
export async function onRequest(context) {
  const asset = await context.env.ASSETS.fetch(new URL('/SYSTEM/Members/Account/forgot-password.html', context.request.url));
  const response = new Response(asset.body, asset);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
