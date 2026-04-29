// Cloudflare Pages Function
// Routes public production pages to the public production page.
// Supported:
// - /:org/:prod/Audition
// - /:org/:prod/ArchiveYEAR
// - /:org/:prod/Team
// - /:org/Audition/:prod (legacy)
// - /:org/ArchiveYEAR/:prod (legacy)
// The page JS resolves the org + production slug from window.location.pathname.

export async function onRequest(context) {
  const org = String(context.params.org || '');
  const section = String(context.params.section || '');
  const prod = String(context.params.prod || '');

  if (['ASSETS', 'HOME', 'PUBLIC', 'SHARED', 'SYSTEM'].includes(org)) {
    return context.env.ASSETS.fetch(context.request);
  }

  const isLegacyPurpose = section === 'Audition' || /^Archive\d{4}$/.test(section);
  const isTeamPurpose = /^team$/i.test(prod);
  const isPurposeLast = prod === 'Audition' || /^Archive\d{4}$/.test(prod) || isTeamPurpose;
  if (!isLegacyPurpose && !isPurposeLast) {
    return new Response('Not found', { status: 404 });
  }

  const url = new URL(context.request.url);
  const assetUrl = new URL(
    isTeamPurpose
      ? '/SYSTEM/Organisations/Productions/Workspace/audition-team.html'
      : '/SYSTEM/Public/audition-info.html',
    url
  );
  return context.env.ASSETS.fetch(assetUrl);
}
