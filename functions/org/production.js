// Cloudflare Pages Function
// Routes /org/production -> protected production workspace.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const next = new URL('/production-workspace', url.origin);
  next.search = url.search;
  next.searchParams.set('bts_path', url.pathname);
  return Response.redirect(next.toString(), 307);
}
