/**
 * send-email
 * ─────────────────────────────────────────────────────────────
 * Unified email sender for all Build The Show templates.
 * Replaces send-audition-email and send-cast-notification.
 *
 * POST body — two modes:
 *
 *   Booking confirmation (public booking or manual resend):
 *   { booking_id, production_id, category?: 'booking_confirmation' }
 *
 *   Cast/callback/not-cast notification:
 *   { applicant_id, production_id, status: 'cast'|'callback'|'not_cast' }
 *   or
 *   { applicant_id, production_id, category: 'cast_announcement'|'callback'|'not_cast' }
 *
 *   Any template by category:
 *   { applicant_id?, booking_id?, production_id, category }
 *
 *   Optional overrides (skip template lookup):
 *   { ..., subject: '...', message: '...' }
 *
 * Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY
 * ─────────────────────────────────────────────────────────────
 */

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')             ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY   = Deno.env.get('RESEND_API_KEY')            ?? '';
const FROM_EMAIL       = Deno.env.get('FROM_EMAIL')                ?? '';

// Map legacy status field → template category
const STATUS_TO_CATEGORY: Record<string, string> = {
  callback:  'callback',
  cast:      'cast_announcement',
  not_cast:  'not_cast',
};

// Fallback subjects if no template found
const CATEGORY_SUBJECTS: Record<string, string> = {
  booking_confirmation: 'Your audition is confirmed!',
  callback:            'You have a callback!',
  cast_announcement:   'Congratulations — you have been cast!',
  not_cast:            'Regarding your audition',
  general:             'A message from the production team',
};

serve(async (req) => {
  try {
  if (req.method === 'OPTIONS') return corsResponse(null, 204);
  if (req.method !== 'POST')   return json({ error: 'Method not allowed' }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ── Resolve category ──────────────────────────────────────────
  const statusRaw  = String(body.status  || '').trim().toLowerCase();
  const categoryRaw = String(body.category || '').trim();
  const category   = categoryRaw || STATUS_TO_CATEGORY[statusRaw] || 'booking_confirmation';

  const bookingIdRaw   = String(body.booking_id   || '').trim();
  const applicantIdRaw = String(body.applicant_id || '').trim();
  const productionIdRaw = String(body.production_id || '').trim();
  const directContext = isRecord(body.context) ? body.context as Record<string, unknown> : {};
  const hasDirectBookingContext = Boolean(
    firstDefinedString(
      directContext.performer_email,
      body.email,
    ) &&
    firstDefinedString(
      directContext.audition_session,
      directContext.audition_date,
      directContext.audition_time,
      directContext.audition_venue,
      body.session_id,
    )
  );

  // ── Resolve performer data ────────────────────────────────────
  // Prefer audition_applications (has email + all custom answers).
  // Fall back to audition_bookings for booking confirmation flow.

  let performerEmail  = firstDefinedString(body.email, directContext.performer_email);
  let performerName   = firstDefinedString(body.name, directContext.performer_name);
  let customAnswers: Record<string, unknown> = isRecord(directContext.custom_answers) ? directContext.custom_answers as Record<string, unknown> : {};
  let roleInterest    = firstDefinedString(body.role_interest, directContext.role_name);
  let appSessionId    = firstDefinedString(body.session_id, directContext.session_id);
  let appSlotId       = firstDefinedString(body.slot_id, directContext.slot_id);
  let productionId    = productionIdRaw;

  // Path A: we have an applicant_id — non-fatal if DB lookup fails, top-level email/name are the fallback
  if (applicantIdRaw) {
    try {
      const { data: app } = await sb
        .from('audition_applications')
        .select('id,name,email,role_interest,custom_answers,session_id,slot_id,time_slot_id,production_id')
        .eq('id', applicantIdRaw)
        .maybeSingle();
      if (app) {
        if (app.email) performerEmail = String(app.email);
        if (app.name)  performerName  = String(app.name);
        customAnswers  = isRecord(app.custom_answers) ? app.custom_answers as Record<string, unknown> : {};
        roleInterest   = firstDefinedString(directContext.role_name, String(app.role_interest || ''));
        appSessionId   = String(app.session_id || '');
        appSlotId      = String(app.time_slot_id || app.slot_id || '');
        if (!productionId) productionId = String(app.production_id || '');
      }
    } catch { /* fall through — use top-level email/name */ }
  }

  // Path B: booking_id (booking confirmation / resend)
  let bookingSessionId = '';
  let bookingSlotId    = '';
  if (bookingIdRaw && !(category === 'booking_confirmation' && hasDirectBookingContext)) {
    const bookingSelect = 'id,email,name,first_name,last_name,session_id,slot_id,production_id,custom_answers,applicant_id';
    let booking: Record<string, unknown> | null = null;

    for (let attempt = 0; attempt < 3 && !booking; attempt += 1) {
      const { data } = await sb
        .from('audition_bookings')
        .select(bookingSelect)
        .eq('id', bookingIdRaw)
        .maybeSingle();
      if (data) {
        booking = data as Record<string, unknown>;
        break;
      }
      if (attempt < 2) await wait(180 * (attempt + 1));
    }

    if (!booking) {
      const fallbackEmail = String(body.email || '').trim();
      const fallbackProductionId = String(productionIdRaw || '').trim();
      const fallbackSessionId = String(body.session_id || '').trim();
      const fallbackSlotId = String(body.slot_id || '').trim();
      if (fallbackEmail && fallbackProductionId) {
        let query = sb
          .from('audition_bookings')
          .select(bookingSelect)
          .eq('production_id', fallbackProductionId)
          .eq('email', fallbackEmail)
          .order('created_at', { ascending: false })
          .limit(1);
        if (fallbackSessionId) query = query.eq('session_id', fallbackSessionId);
        if (fallbackSlotId) query = query.eq('slot_id', fallbackSlotId);
        const { data: fallbackBooking } = await query.maybeSingle();
        if (fallbackBooking) booking = fallbackBooking as Record<string, unknown>;
      }
    }

    if (!booking) return json({ error: 'Booking not found' }, 404);
    // Only overwrite email/name if we don't already have them from the application
    if (!performerEmail) performerEmail = String(booking.email || '');
    if (!performerName)  performerName  = String(booking.name  || [booking.first_name, booking.last_name].filter(Boolean).join(' ') || '');
    bookingSessionId = String(booking.session_id || '');
    bookingSlotId    = String(booking.slot_id    || '');
    if (!productionId) productionId = String(booking.production_id || '');

    // Merge custom_answers from booking if we don't have an app record
    if (!applicantIdRaw) {
      const bAnswers = isRecord(booking.custom_answers) ? booking.custom_answers as Record<string, unknown> : {};
      customAnswers = { ...bAnswers, ...customAnswers };
    }

    // If the booking has a linked applicant and we don't have one yet, fetch it
    if (!applicantIdRaw && booking.applicant_id) {
      const { data: linkedApp } = await sb
        .from('audition_applications')
        .select('id,role_interest,custom_answers')
        .eq('id', String(booking.applicant_id))
        .single();
      if (linkedApp) {
        roleInterest  = roleInterest  || String(linkedApp.role_interest || '');
        const appAnswers = isRecord(linkedApp.custom_answers) ? linkedApp.custom_answers as Record<string, unknown> : {};
        customAnswers = { ...appAnswers, ...customAnswers }; // booking answers win on conflicts
      }
    }
  }

  if (!productionId)   return json({ ok: false, error: 'Missing production_id' });
  if (!performerEmail) return json({ ok: false, error: 'No email address found for this performer' });

  // ── Fetch production + template + org ────────────────────────
  const [{ data: prod }, { data: template }] = await Promise.all([
    sb.from('productions')
      .select('id,title,subtitle,venue,director,organization_id,start_date,end_date')
      .eq('id', productionId)
      .maybeSingle(),
    sb.from('email_templates')
      .select('subject,body')
      .eq('production_id', productionId)
      .eq('category', category)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!template && !body.subject && !body.message) {
    console.error('[send-email] Template not found for category:', category, 'production:', productionId);
    return json({ ok: false, error: `No email template found for "${category}". Create one in the Emails tab first.` });
  }

  const directProduction = isRecord(directContext.production) ? directContext.production as Record<string, unknown> : {};
  const productionRecord = {
    id: productionId,
    title: firstDefinedString(directContext.show_name, directProduction.title, prod?.title),
    subtitle: firstDefinedString(directContext.show_subtitle, directProduction.subtitle, prod?.subtitle),
    venue: firstDefinedString(directContext.show_venue, directContext.audition_venue, directProduction.venue, prod?.venue),
    director: firstDefinedString(directContext.director_name, directProduction.director, prod?.director),
    organization_id: firstDefinedString(directProduction.organization_id, prod?.organization_id),
    start_date: firstDefinedString(directContext.rehearsal_start_date, directProduction.start_date, prod?.start_date),
    end_date: firstDefinedString(directContext.opening_night, directProduction.end_date, prod?.end_date),
  };

  let org: Record<string, unknown> | null = null;
  if (productionRecord.organization_id) {
    try {
      const { data } = await sb
        .from('organizations')
        .select('name,email')
        .eq('id', String(productionRecord.organization_id))
        .maybeSingle();
      org = data as Record<string, unknown> | null;
    } catch { org = null; }
  }
  if (!org) {
    org = {
      name: firstDefinedString(directContext.org_name, directContext.organization_name, directProduction.org_name),
      email: firstDefinedString(directContext.org_email, directContext.organization_email, directProduction.org_email),
    };
  }

  // ── Resolve session + slot ────────────────────────────────────
  const sessionId = appSessionId || bookingSessionId;
  const slotId    = appSlotId    || bookingSlotId;

  // For cast notifications, also look up all bookings to find callback session
  let callbackSession: Record<string, unknown> | null = null;
  let callbackSlot:    Record<string, unknown> | null = null;

  const sessionIds = [...new Set([sessionId].filter(Boolean))];
  const slotIds    = [...new Set([slotId].filter(Boolean))];

  if (applicantIdRaw && ['callback', 'cast_announcement', 'not_cast'].includes(category)) {
    const { data: bookingRows } = await sb
      .from('audition_bookings')
      .select('id,session_id,slot_id,status')
      .eq('applicant_id', applicantIdRaw)
      .eq('production_id', productionId);
    const active = (bookingRows || []).filter(r => !String(r.status || '').match(/cancel/i));
    active.forEach(r => {
      if (r.session_id) sessionIds.push(String(r.session_id));
      if (r.slot_id)    slotIds.push(String(r.slot_id));
    });
  }

  const [{ data: sessions }, { data: slots }] = await Promise.all([
    sessionIds.length
      ? sb.from('audition_sessions').select('id,name,session_date,date,start_time,location,prepare_text').in('id', [...new Set(sessionIds)])
      : Promise.resolve({ data: [] }),
    slotIds.length
      ? sb.from('audition_time_slots').select('id,slot_time,slot_date,label').in('id', [...new Set(slotIds)])
      : Promise.resolve({ data: [] }),
  ]);

  const sessionsById = Object.fromEntries((sessions || []).map(r => [r.id, r]));
  const slotsById    = Object.fromEntries((slots    || []).map(r => [r.id, r]));

  const primarySession = sessionsById[sessionId] || null;
  const primarySlot    = slotsById[slotId]       || null;

  // Find callback session (for callback/cast emails)
  for (const s of Object.values(sessionsById)) {
    if (String((s as Record<string,unknown>).name || '').toLowerCase().includes('callback')) {
      callbackSession = s as Record<string, unknown>;
      // Find its slot
      for (const slot of Object.values(slotsById)) {
        callbackSlot = slot as Record<string, unknown>;
        break;
      }
      break;
    }
  }

  // ── Build tokens ──────────────────────────────────────────────
  const firstName    = (performerName.split(' ')[0] || 'Performer');
  const orgName      = String(org?.name  || '');
  const orgEmail     = String(org?.email || '');
  const showName     = String(productionRecord.title || '');
  const director     = String(productionRecord.director || '');
  const audVenue     = firstDefinedString(
    directContext.audition_venue,
    (primarySession as Record<string,unknown>)?.location,
    productionRecord.venue,
  );
  const sessionDate  = firstDefinedString(
    directContext.audition_date,
    fmtDate(String((primarySession as Record<string,unknown>)?.date || (primarySession as Record<string,unknown>)?.session_date || '')),
  );
  const sessionName  = firstDefinedString(
    directContext.audition_session,
    (primarySession as Record<string,unknown>)?.name,
  );
  const slotTime     = firstDefinedString(
    directContext.audition_time,
    primarySlot ? fmtTime(String((primarySlot as Record<string,unknown>).slot_time || '')) : '',
    primarySession ? fmtTime(String((primarySession as Record<string,unknown>).start_time || '')) : '',
  );
  const prepareText  = firstDefinedString(
    directContext.what_to_prepare
      ? htmlToPlainText(String(directContext.what_to_prepare))
      : '',
    (primarySession as Record<string,unknown>)?.prepare_text
      ? htmlToPlainText(String((primarySession as Record<string,unknown>).prepare_text))
      : '',
  );
  const whatToPrepare = firstDefinedString(
    prepareText,
    customAnswers['What to Prepare']
      ? htmlToPlainText(String(customAnswers['What to Prepare']))
      : '',
    customAnswers['what_to_prepare']
      ? htmlToPlainText(String(customAnswers['what_to_prepare']))
      : '',
  );
  const showDates = productionRecord.start_date && productionRecord.end_date
    ? `${fmtDate(String(productionRecord.start_date))} – ${fmtDate(String(productionRecord.end_date))}`
    : (productionRecord.start_date ? fmtDate(String(productionRecord.start_date)) : '');
  const bookingLink = `https://buildtheshow.com/audition-info?prod=${productionId}`;
  const pronouns    = firstDefinedString(
    customAnswers['Pronouns'], customAnswers['pronouns'],
  );

  const tokenValues: Record<string, string> = {
    '{{performer_name}}':        performerName,
    '{{performer_first_name}}':  firstName,
    '{{performer_pronouns}}':    pronouns,
    '{{performer_email}}':       performerEmail,
    '{{show_name}}':             showName,
    '{{show_subtitle}}':         String(productionRecord.subtitle || ''),
    '{{show_venue}}':            String(productionRecord.venue    || ''),
    '{{show_dates}}':            showDates,
    '{{audition_session}}':      sessionName,
    '{{audition_date}}':         sessionDate,
    '{{audition_time}}':         slotTime,
    '{{audition_venue}}':        audVenue,
    '{{audition_notes}}':        whatToPrepare,
    '{{what_to_prepare}}':       whatToPrepare,
    '{{booking_link}}':          bookingLink,
    '{{org_name}}':              orgName,
    '{{director_name}}':         director,
    '{{role_name}}':             roleInterest,
    '{{role_type}}':             '',
    '{{callback_date}}':         firstDefinedString(
      directContext.callback_date,
      fmtDate(String((callbackSlot as Record<string,unknown>)?.slot_date || (callbackSession as Record<string,unknown>)?.session_date || '')),
    ),
    '{{callback_time}}':         firstDefinedString(
      directContext.callback_time,
      fmtTime(String((callbackSlot as Record<string,unknown>)?.slot_time || (callbackSession as Record<string,unknown>)?.start_time  || '')),
    ),
    '{{callback_venue}}':        firstDefinedString(
      directContext.callback_venue,
      audVenue,
    ),
    '{{rehearsal_start_date}}':  productionRecord.start_date ? fmtDate(String(productionRecord.start_date)) : '',
    '{{rehearsal_schedule}}':    '',
    '{{opening_night}}':         productionRecord.end_date   ? fmtDate(String(productionRecord.end_date))   : '',
  };

  const productionFieldValues: Record<string, unknown> = {
    ...(productionRecord as object),
    org_name:     orgName,
    director_name: director,
    show_dates:    showDates,
  };
  const performerFieldValues: Record<string, unknown> = {
    performer_name:       performerName,
    performer_first_name: firstName,
    performer_email:      performerEmail,
    performer_pronouns:   pronouns,
    role_name:            roleInterest,
    ...customAnswers,
  };

  function substituteTemplate(text: string, escapeForHtml = false): string {
    let result = String(text || '');
    Object.entries(tokenValues).forEach(([token, value]) => {
      result = result.split(token).join(escapeForHtml ? escHtml(value) : value);
    });
    result = result.replace(
      /\{\{\s*(custom|production|performer|booking|app|organization|org)\s*:\s*([^}]+)\}\}/gi,
      (_match, scope, rawKey) => {
        const s = String(scope || '').toLowerCase();
        const k = String(rawKey || '').trim();
        let v = '';
        if (s === 'custom')                                       v = lookupFlexibleValue(customAnswers,          k);
        if (s === 'production')                                   v = lookupFlexibleValue(productionFieldValues,  k);
        if (s === 'performer' || s === 'booking' || s === 'app') v = lookupFlexibleValue(performerFieldValues,   k);
        if (s === 'organization' || s === 'org')                 v = lookupFlexibleValue({ name: orgName, email: orgEmail }, k);
        return escapeForHtml ? escHtml(v) : v;
      }
    );
    return result;
  }

  // ── Resolve subject + body ────────────────────────────────────
  const overrideSubject = typeof body.subject === 'string' ? body.subject : '';
  const overrideMessage = typeof body.message === 'string' ? body.message : '';
  const sourceSubject = overrideSubject || template?.subject || CATEGORY_SUBJECTS[category] || `Update from ${showName || 'Build The Show'}`;
  const sourceBody    = overrideMessage || template?.body    || '';
  const sourceBodyText = htmlToPlainText(String(sourceBody || ''));

  if (!sourceBodyText.trim()) {
    console.error('[send-email] No usable body for category:', category, 'production:', productionId);
    return json({ ok: false, error: `The "${category}" email template has no body. Open it in the Emails tab and add content.` });
  }

  const subject       = substituteTemplate(sourceSubject);
  const templatedBody = substituteTemplate(sourceBody);
  const bodyLooksHtml = /<[a-z][\s\S]*>/i.test(templatedBody);
  const htmlBody      = bodyLooksHtml ? substituteTemplate(sourceBody, true) : plainTextToHtml(templatedBody);
  const bodyText      = bodyLooksHtml ? htmlToPlainText(templatedBody) : templatedBody;

  const fromName  = orgName || 'Build The Show';
  const fromEmail = FROM_EMAIL || `noreply@buildtheshow.com`;
  const fromField = `${fromName} <${fromEmail}>`;
  const replyTo   = orgEmail || undefined;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family:sans-serif;color:#1a1530;max-width:600px;margin:0 auto;padding:2rem 1rem;">
  ${htmlBody}
  <hr style="margin:2rem 0;border:none;border-top:1px solid #e5e0f0;" />
  <p style="font-size:0.75rem;color:#9a90b0;margin:0;">
    Sent by ${escHtml(fromName)} via <a href="https://buildtheshow.com" style="color:#572e88;">Build The Show</a>.
  </p>
</body>
</html>`;

  if (!RESEND_API_KEY) {
    console.error('[send-email] Missing RESEND_API_KEY. Cannot send to:', performerEmail, '| Subject:', subject);
    return json({ ok: false, error: 'Email sending is not configured (missing API key). Contact your admin.' });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    fromField,
      to:      [performerEmail],
      reply_to: replyTo,
      subject,
      html,
      text:    bodyText,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const resendMsg = (err as Record<string, string>).message || (err as Record<string, string>).name || JSON.stringify(err);
    console.error('[send-email] Resend error:', err);
    return json({ ok: false, error: `Resend API error: ${resendMsg}` });
  }

  return json({ ok: true, sent: true, category, performer_email: performerEmail });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[send-email] Unhandled error:', msg);
    return json({ ok: false, error: `Unexpected error: ${msg}` });
  }
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

function plainTextToHtml(text: string): string {
  return String(text || '')
    .split('\n\n')
    .map(p => `<p style="margin:0 0 1em;">${escHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

function htmlToPlainText(html: string): string {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isRecord(value: unknown): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function firstDefinedString(...values: unknown[]): string {
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
}

function normalizeLookupKey(value: string): string {
  return String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function lookupFlexibleValue(source: Record<string, unknown>, rawKey: string): string {
  const target = normalizeLookupKey(rawKey);
  for (const [key, value] of Object.entries(source || {})) {
    if (normalizeLookupKey(key) === target) return firstDefinedString(value);
  }
  return '';
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  });
}

function corsResponse(body: null, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  });
}
