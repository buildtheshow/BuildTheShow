// Cloudflare Pages Function
// Routes /:org/:show/registration/:code to the shared public registration entry point.
// The page resolves the readable performer code back to the applicant.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Public/registration.html', url);
  try {
    return await context.env.ASSETS.fetch(new Request(assetUrl.toString(), context.request));
  } catch (error) {
    return new Response('Registration form is temporarily unavailable.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
}
