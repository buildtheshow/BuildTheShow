import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL     = 'Build The Show <noreply@buildtheshow.com>';

const STATUS_SUBJECTS: Record<string, string> = {
  callback: 'You have a callback!',
  cast:     'Congratulations — you have been cast!',
  not_cast: 'Regarding your audition',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body: {
    to: string;
    name: string;
    status: string;
    message: string;
    production_title: string;
  };

  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { to, name, status, message, production_title } = body;

  if (!to || !message) {
    return json({ error: 'Missing required fields: to, message' }, 400);
  }

  const subject = STATUS_SUBJECTS[status] ?? `Update from ${production_title || 'Build The Show'}`;

  // Plain-text → HTML: wrap each paragraph in <p> tags
  const htmlBody = message
    .split('\n\n')
    .map(p => `<p style="margin:0 0 1em;">${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family:sans-serif;color:#1a1530;max-width:600px;margin:0 auto;padding:2rem 1rem;">
  <div style="margin-bottom:1.5rem;">
    <img src="https://buildtheshow.com/logo-long-colour.png" alt="Build The Show" height="32" style="display:block;" />
  </div>
  <h2 style="font-size:1.3rem;font-weight:800;color:#1a1530;margin:0 0 1.25rem;">${escHtml(subject)}</h2>
  ${htmlBody}
  <hr style="margin:2rem 0;border:none;border-top:1px solid #e5e0f0;" />
  <p style="font-size:0.75rem;color:#9a90b0;margin:0;">
    This message was sent via <a href="https://buildtheshow.com" style="color:#572e88;">Build The Show</a> on behalf of ${escHtml(production_title || 'a production team')}.
  </p>
</body>
</html>`;

  if (!RESEND_API_KEY) {
    // No email provider configured — log and return success so UI doesn't break
    console.log('[send-cast-notification] No RESEND_API_KEY set. Would have sent to:', to, 'Subject:', subject);
    return json({ ok: true, dev: true });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    FROM_EMAIL,
      to:      [to],
      subject,
      html,
      text:    message,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('[send-cast-notification] Resend error:', err);
    return json({ error: err.message || 'Email send failed' }, 502);
  }

  return json({ ok: true });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function escHtml(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
