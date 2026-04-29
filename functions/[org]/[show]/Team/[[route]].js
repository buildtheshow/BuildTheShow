// Cloudflare Pages Function
// Routes nested team portal pages like /:org/:show/Team/auditions/in-the-room
// back to the shared team workspace shell.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/SYSTEM/Organisations/Productions/Workspace/audition-team.html', url);
  return context.env.ASSETS.fetch(assetUrl);
}
