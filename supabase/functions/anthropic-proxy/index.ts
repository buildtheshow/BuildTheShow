// Retired endpoint. Keep this response deployed so old clients cannot use it.
Deno.serve(() => new Response(JSON.stringify({ error: 'This endpoint has been removed.' }), {
  status: 410,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  },
}));
