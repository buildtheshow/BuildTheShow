// Cloudflare Pages Function
// Routes /volunteer-quiz -> standalone volunteer quiz page.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/PUBLIC/volunteer-quiz.html', url);
  return context.env.ASSETS.fetch(new Request(assetUrl.toString(), context.request));
}
