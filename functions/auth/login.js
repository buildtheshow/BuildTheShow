const SUPABASE_URL = 'https://tkmaiktxpwqfbgeojbnf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrbWFpa3R4cHdxZmJnZW9qYm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MzE4MTcsImV4cCI6MjA4OTMwNzgxN30.TkTZBNWUatk3Y6Vmfv1hIRR3DfVjgwauwa76Pf00J_8';

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ message: 'Invalid login request.' }, { status: 400 });
  }

  const email = String(body?.email || '').trim();
  const password = String(body?.password || '');
  if (!email || !password) {
    return Response.json({ message: 'Email and password are required.' }, { status: 400 });
  }

  let response;
  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    return Response.json(
      { message: 'Login service is taking too long. Please try again.' },
      { status: 504 }
    );
  }

  const payload = await response.json().catch(() => ({}));
  return Response.json(payload, { status: response.status });
}

export function onRequest() {
  return Response.json({ message: 'Method not allowed.' }, { status: 405 });
}
