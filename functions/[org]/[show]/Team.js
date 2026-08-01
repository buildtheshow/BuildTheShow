// Cloudflare Pages Function
// Routes /:org/:show/Team → serves SYSTEM/Organisations/Productions/Workspace/team-portal.html,
// the Creative Team (Director/Choreographer/Vocal Director/Producer/Admin) login portal.
// This used to route to audition-team.html, an unrelated internal team-management tool with its
// own separate passcode gate -- that was a leftover from before team-portal.html existed and sent
// every Creative Team member to the wrong page.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Organisations/Productions/Workspace/team-portal.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
