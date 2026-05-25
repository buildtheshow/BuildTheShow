// Cloudflare Pages Function
// Routes /:org/:show/registration/:code to the shared public registration entry point.
// The page resolves the readable performer code back to the applicant.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const code = context.params.code || url.pathname.split('/').filter(Boolean).pop() || '';
  const target = new URL('/SYSTEM/Public/registration', url.origin);
  target.hash = `code=${encodeURIComponent(code)}`;
  return Response.redirect(target.toString(), 302);
}
