// Cloudflare Pages Function
// Routes /:org/:show/Team → serves SYSTEM/Organisations/Productions/Workspace/audition-team.html
// The page JS reads org + show slugs from window.location.pathname to resolve the production

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Organisations/Productions/Workspace/audition-team.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
