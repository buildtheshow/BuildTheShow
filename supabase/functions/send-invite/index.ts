// Retired anonymous sender. Organisation invitations use the authenticated queue RPC.
Deno.serve(()=>new Response(JSON.stringify({error:'This sender has been retired. Refresh the website and send the invitation from organisation management.'}),{status:410,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'https://buildtheshow.com'}}));
