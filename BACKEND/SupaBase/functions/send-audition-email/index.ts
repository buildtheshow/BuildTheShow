/**
 * send-audition-email
 * ─────────────────────────────────────────────────────────────
 * Sends a booking confirmation email using the org's own
 * email_templates entry (category = booking_confirmation).
 *
 * Called two ways:
 *   1. Manual resend from workspace:
 *      POST { _resend: true, booking_id: "<uuid>" }
 *
 *   2. Auto-send after booking (invoked from audition-info.html):
 *      POST { booking_id: "<uuid>", production_id: "<uuid>" }
 *
 *   3. DB trigger (legacy Supabase webhook format):
 *      POST { type: "INSERT", record: { id, email, name, session_id, production_id, ... } }
 *
 * Requires env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY
 * ─────────────────────────────────────────────────────────────
 */

import { serve }       from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')             ?? '';
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY    = Deno.env.get('RESEND_API_KEY')            ?? '';
const FROM_EMAIL        = 'Build The Show <noreply@buildtheshow.com>';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(null, 204);
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ── Resolve booking record ────────────────────────────────────
  let booking: Record<string, unknown> | null = null;

  // DB trigger format
  if (body.type === 'INSERT' && body.record && typeof body.record === 'object') {
    booking = body.record as Record<string, unknown>;
  }

  // Direct call or resend — look up by booking_id
  const bookingId = (body.booking_id ?? (booking?.id)) as string | undefined;
  if (!booking && bookingId) {
    const { data, error } = await sb
      .from('audition_bookings')
      .select('id,email,name,first_name,last_name,session_id,slot_id,production_id,created_at')
      .eq('id', bookingId)
      .single();
    if (error || !data) {
      return json({ error: 'Booking not found' }, 404);
    }
    booking = data as Record<string, unknown>;
  }

  if (!booking) {
    return json({ error: 'No booking data provided' }, 400);
  }

  const productionId = (booking.production_id ?? body.production_id) as string | undefined;
  if (!productionId) {
    return json({ error: 'Missing production_id' }, 400);
  }

  // ── Fetch supporting data in parallel ────────────────────────
  const [{ data: prod }, { data: template }, { data: session }, { data: slot }] = await Promise.all([
    sb.from('productions')
      .select('id,title,subtitle,venue,director,organization_id')
      .eq('id', productionId)
      .single(),
    sb.from('email_templates')
      .select('subject,body')
      .eq('production_id', productionId)
      .eq('category', 'booking_confirmation')
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    booking.session_id
      ? sb.from('audition_sessions')
          .select('id,name,session_date,start_time,venue_id')
          .eq('id', booking.session_id as string)
          .single()
      : Promise.resolve({ data: null }),
    booking.slot_id
      ? sb.from('audition_time_slots')
          .select('id,slot_time,label')
          .eq('id', booking.slot_id as string)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  // No template = no send
  if (!template?.subject || !template?.body) {
    console.log('[send-audition-email] No booking_confirmation template for production', productionId, '— skipping send.');
    return json({ ok: true, skipped: true, reason: 'no_template' });
  }

  // ── Org name ──────────────────────────────────────────────────
  let orgName = '';
  if (prod?.organization_id) {
    const { data: org } = await sb
      .from('organizations')
      .select('name')
      .eq('id', prod.organization_id as string)
      .single();
    orgName = org?.name ?? '';
  }

  // ── Token substitution ────────────────────────────────────────
  const performerName  = String(booking.name || [booking.first_name, booking.last_name].filter(Boolean).join(' ') || 'Performer');
  const firstName      = performerName.split(' ')[0] || 'Performer';
  const toEmail        = String(booking.email || '');

  const sessionName    = session?.name   ?? '';
  const sessionDate    = fmtDate(String(session?.session_date || ''));
  const slotTime       = slot?.slot_time   ? fmtTime(String(slot.slot_time))   : (session?.start_time ? fmtTime(String(session.start_time)) : '');
  const venue          = prod?.venue      ?? '';
  const showName       = prod?.title      ?? '';
  const director       = prod?.director   ?? '';

  function sub(text: string) {
    return text
      .replace(/\{\{performer_name\}\}/g,       performerName)
      .replace(/\{\{performer_first_name\}\}/g, firstName)
      .replace(/\{\{show_name\}\}/g,            showName)
      .replace(/\{\{show_subtitle\}\}/g,        prod?.subtitle ?? '')
      .replace(/\{\{show_venue\}\}/g,           venue)
      .replace(/\{\{audition_session\}\}/g,     sessionName)
      .replace(/\{\{audition_date\}\}/g,        sessionDate)
      .replace(/\{\{audition_time\}\}/g,        slotTime)
      .replace(/\{\{audition_venue\}\}/g,       venue)
      .replace(/\{\{audition_notes\}\}/g,       '')
      .replace(/\{\{org_name\}\}/g,             orgName)
      .replace(/\{\{director_name\}\}/g,        director);
  }

  const subject  = sub(template.subject);
  const bodyText = sub(template.body);

  // Plain-text → HTML
  const htmlBody = bodyText
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
    This message was sent via <a href="https://buildtheshow.com" style="color:#572e88;">Build The Show</a>
    on behalf of ${escHtml(orgName || showName || 'a production team')}.
  </p>
</body>
</html>`;

  if (!toEmail) {
    return json({ error: 'Booking has no email address' }, 422);
  }

  // Dev mode — no Resend key
  if (!RESEND_API_KEY) {
    console.log('[send-audition-email] No RESEND_API_KEY. Would send to:', toEmail, '| Subject:', subject);
    return json({ ok: true, dev: true });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    FROM_EMAIL,
      to:      [toEmail],
      subject,
      html,
      text:    bodyText,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('[send-audition-email] Resend error:', err);
    return json({ error: (err as Record<string, string>).message || 'Email send failed' }, 502);
  }

  return json({ ok: true });
});

// ── Helpers ───────────────────────────────────────────────────

function fmtDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
}

function fmtTime(timeStr: string): string {
  if (!timeStr) return '';
  try {
    // slot_time may be "HH:MM:SS" or an ISO timestamp
    const parts = timeStr.includes('T') ? timeStr.split('T')[1].split(':') : timeStr.split(':');
    const h = Number(parts[0]);
    const m = Number(parts[1] || 0);
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12  = h % 12 || 12;
    return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`;
  } catch { return timeStr; }
}

function escHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function corsResponse(body: null, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
  });
}
