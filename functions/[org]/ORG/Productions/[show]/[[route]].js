// Cloudflare Pages Function
// Routes nested production workspace pages like
// /:org/ORG/Productions/:show/auditions/casting-board back to the shared shell.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const next = new URL('/production-workspace', url.origin);
  next.search = url.search;
  next.searchParams.set('bts_path', url.pathname);
  return Response.redirect(next.toString(), 307);
}
