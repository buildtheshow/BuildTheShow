// Organisation management uses the existing organisation workspace, not the member shell.
export async function onRequest(context) {
  const url=new URL(context.request.url);
  url.pathname='/org/dashboard';
  return new Response(null,{status:302,headers:{Location:url.pathname+url.search,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
