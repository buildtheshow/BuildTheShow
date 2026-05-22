// Cloudflare Pages Function
// Routes /:org/ORG/Productions/:show -> protected production workspace.
// The workspace resolves org/show slugs and then manages nested section URLs client-side.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const next = new URL('/production-workspace', url.origin);
  next.search = url.search;
  next.searchParams.set('bts_path', url.pathname);
  return Response.redirect(next.toString(), 307);
}
