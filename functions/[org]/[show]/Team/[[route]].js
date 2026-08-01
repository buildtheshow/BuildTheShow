// Cloudflare Pages Function
// Routes nested team portal pages like /:org/:show/Team/auditions/in-the-room
// back to the shared team workspace shell.
//
// A bare /:org/:show/Team/ (trailing slash, no further segments) is the Creative
// Team login link itself -- that goes to team-portal.html, same as the non-slash
// /:org/:show/Team route (see ../Team.js). Anything with real segments after Team/
// is audition-team.html's own internal page routing and is untouched.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const route = (context.params && context.params.route) || [];
  const hasSubPath = Array.isArray(route) ? route.some(Boolean) : !!route;
  const target = hasSubPath
    ? '/SYSTEM/Organisations/Productions/Workspace/audition-team.html'
    : '/SYSTEM/Organisations/Productions/Workspace/team-portal.html';
  const assetUrl = new URL(target, url);
  return context.env.ASSETS.fetch(assetUrl);
}
