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

const CATEGORY_TO_TRIGGER: Record<string, string> = {
  booking_confirmation: 'booking_confirmed',
  self_tape_booked:     'self_tape_registered',
  audition_reminder:    'manual',
  callback:             'callback_set',
  cast_announcement:    'cast_set',
  not_cast:             'not_cast_set',
  rehearsal:            'manual',
  team_invite:          'team_invite',
  general:              'manual',
};

serve(async (req) => {
  try {
  if (req.method === 'OPTIONS') return corsResponse(null, 204);
  if (req.method !== 'POST')   return json({ error: 'Method not allowed' }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ── Test email mode ───────────────────────────────────────────
  // Substitutes all tokens with real production/session data + sample
  // performer info so the preview looks like an actual booking email.
  const testEmail = String(body.test_email || '').trim();
  if (testEmail) {
    const testSubject  = String(body.subject || 'Test Email').trim();
    const testBody     = String(body.body    || '').trim();
    const prodIdTest   = String(body.production_id || '').trim();

    if (!RESEND_API_KEY) return json({ ok: false, error: 'Email sending not configured.' });

    // Fetch production + all sessions in parallel
    const [{ data: prodRec }, { data: testSessions }, { data: testPerformanceEvents }] = await Promise.all([
      prodIdTest
        ? sb.from('productions').select('title,subtitle,venue,org_name,org_email,director,start_date,end_date').eq('id', prodIdTest).maybeSingle()
        : Promise.resolve({ data: null }),
      prodIdTest
        ? sb.from('audition_sessions').select('id,name,type,date,start_time,location,prepare_text').eq('production_id', prodIdTest).order('sort_order', { ascending: true })
        : Promise.resolve({ data: [] }),
      prodIdTest
        ? sb.from('production_events').select('title,start_time,end_time,venue,event_type').eq('production_id', prodIdTest).eq('event_type', 'performance').order('start_time', { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

    const p = (prodRec || {}) as Record<string, unknown>;
    const sessions = (testSessions || []) as Record<string, unknown>[];

    const fromName  = String(p.org_name  || p.title  || 'Build The Show');
    const fromEmail = FROM_EMAIL || 'noreply@buildtheshow.com';

    // Build a full token map using real data + sample performer values
    const generalSess  = sessions.find(s => String(s.type||'').toLowerCase() === 'audition' || String(s.type||'').toLowerCase().includes('general') || String(s.name||'').toLowerCase().includes('general'));
    const danceSess    = sessions.find(s => String(s.type||'').toLowerCase().includes('dance')    || String(s.name||'').toLowerCase().includes('dance'));
    const callbackSess = sessions.find(s => String(s.type||'').toLowerCase().includes('callback') || String(s.name||'').toLowerCase().includes('callback'));
    const primarySess  = generalSess || sessions[0];

    const showDates = p.start_date && p.end_date
      ? `${fmtDate(String(p.start_date))} – ${fmtDate(String(p.end_date))}`
      : (p.start_date ? fmtDate(String(p.start_date)) : '');

    const testTokens: Record<string, string> = {
      // Performer (sample)
      '{{contact_name}}':         'Morgan Lee',
      '{{performer_name}}':       'Jamie Lee',
      '{{performer_first_name}}': 'Jamie',
      '{{performer_pronouns}}':   'she/her',
      '{{performer_email}}':      testEmail,
      // Show (real)
      '{{show_name}}':     String(p.title    || 'Our Show'),
      '{{show_subtitle}}': String(p.subtitle || ''),
      '{{show_venue}}':    String(p.venue    || ''),
      '{{show_dates}}':    showDates,
      '{{org_name}}':      String(p.org_name  || p.title || 'Your Theatre Company'),
      '{{director_name}}': String(p.director  || ''),
      // Your Booking (uses general session as stand-in)
      '{{audition_session}}':      primarySess ? String(primarySess.name || '') : '',
      '{{audition_date}}':         primarySess?.date        ? fmtDate(String(primarySess.date))        : '',
      '{{audition_time}}':         primarySess?.start_time  ? fmtTime(String(primarySess.start_time))  : '10:00 AM',
      '{{audition_venue}}':        String(primarySess?.location || p.venue || ''),
      '{{what_to_prepare}}':       'Please prepare 16 bars of a song in the style of the show.',
      '{{booking_link}}':          `https://buildtheshow.com/audition-info?prod=${prodIdTest}`,
      '{{all_audition_sessions}}': sessions.map(s => `${s.name || 'Session'}: ${s.date ? fmtDate(String(s.date)) : 'TBC'}${s.start_time ? ' at ' + fmtTime(String(s.start_time)) : ''}`).join('\n'),
      // General Auditions (real)
      '{{general_audition_date}}':  generalSess?.date        ? fmtDate(String(generalSess.date))        : '',
      '{{general_audition_time}}':  generalSess?.start_time  ? fmtTime(String(generalSess.start_time))  : '',
      '{{general_audition_venue}}': String(generalSess?.location || p.venue || ''),
      '{{general_audition_name}}':  String(generalSess?.name || ''),
      '{{general_audition_prepare}}': String(generalSess?.prepare_text || ''),
      // Dance Call (real)
      '{{dance_call_date}}':  danceSess?.date        ? fmtDate(String(danceSess.date))        : '',
      '{{dance_call_time}}':  danceSess?.start_time  ? fmtTime(String(danceSess.start_time))  : '',
      '{{dance_call_venue}}': String(danceSess?.location || p.venue || ''),
      '{{dance_call_name}}':  String(danceSess?.name || ''),
      '{{dance_call_prepare}}': String(danceSess?.prepare_text || ''),
      // Callbacks (real)
      '{{callback_date}}':  callbackSess?.date        ? fmtDate(String(callbackSess.date))        : '',
      '{{callback_time}}':  callbackSess?.start_time  ? fmtTime(String(callbackSess.start_time))  : '',
      '{{callback_venue}}': String(callbackSess?.location || p.venue || ''),
      '{{callback_name}}':  String(callbackSess?.name || ''),
      '{{callback_prepare}}': String(callbackSess?.prepare_text || ''),
      // Casting (sample)
      '{{role_name}}': 'The Lead',
      '{{role_type}}': 'Principal',
      // Rehearsals (real)
      '{{rehearsal_start_date}}': p.start_date ? fmtDate(String(p.start_date)) : '',
      '{{rehearsal_schedule}}':   '',
      '{{rehearsal_end_date}}':   p.end_date   ? fmtDate(String(p.end_date))   : '',
      '{{opening_night}}':        p.end_date   ? fmtDate(String(p.end_date))   : '',
      '{{performance_schedule}}': ((testPerformanceEvents || []) as Record<string, unknown>[]).map(formatScheduleEvent).filter(Boolean).join('\n'),
      // Team Access (sample)
      '{{team_member_name}}':  'Alex Rivera',
      '{{team_member_role}}':  'Vocal Director',
      '{{team_member_email}}': testEmail,
      '{{team_access_code}}':  '294761',
      '{{portal_link}}':       `https://buildtheshow.com/audition-team?prod=${prodIdTest}`,
      '{{submission_link}}':    `https://buildtheshow.com/ryt/mary-poppins-jr-2026/SelfTape/JAMIE4827`,
    };

    for (const session of sessions) {
      const slug = sessionSlug(String(session.name || ''));
      if (!slug) continue;
      testTokens[`{{${slug}_date}}`] = session.date ? fmtDate(String(session.date)) : '';
      testTokens[`{{${slug}_time}}`] = session.start_time ? fmtTime(String(session.start_time)) : '';
      testTokens[`{{${slug}_venue}}`] = String(session.location || p.venue || '');
      testTokens[`{{${slug}_name}}`] = String(session.name || '');
      testTokens[`{{${slug}_prepare}}`] = String(session.prepare_text || '');
    }

    function substituteTest(text: string): string {
      let r = String(text || '');
      Object.entries(testTokens).forEach(([k, v]) => { r = r.split(k).join(v); });
      return r;
    }

    const subj    = substituteTest(testSubject);
    const subBody = substituteTest(testBody);
    const bodyLooksHtml = /<[a-z][\s\S]*>/i.test(subBody);
    const htmlBody = bodyLooksHtml ? subBody : plainTextToHtml(subBody);
    const textBody = bodyLooksHtml ? htmlToPlainText(subBody) : subBody;

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:sans-serif;color:#1a1530;max-width:600px;margin:0 auto;padding:2rem 1rem;">
  ${htmlBody}
  <hr style="margin:2rem 0;border:none;border-top:1px solid #e5e0f0;">
  <p style="font-size:0.75rem;color:#9a90b0;margin:0;">
    Test email — sent by <strong>${escHtml(fromName)}</strong> via Build The Show.
  </p>
</body></html>`;

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [testEmail], subject: subj, html, text: textBody }),
    });
    const rd = await r.json().catch(() => ({}));
    if (!r.ok) return json({ ok: false, error: (rd as Record<string,unknown>).message as string || 'Resend error.' });
    return json({ ok: true });
  }

  // ── Resolve category ──────────────────────────────────────────
  const statusRaw  = String(body.status  || '').trim().toLowerCase();
  const categoryRaw = String(body.category || '').trim();
  const category   = categoryRaw || STATUS_TO_CATEGORY[statusRaw] || 'booking_confirmation';
  const requestedTrigger = firstDefinedString(body.trigger, CATEGORY_TO_TRIGGER[category]);

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
  let contactName     = firstDefinedString(directContext.contact_name, body.contact_name);
  let roleType        = firstDefinedString(directContext.role_type, body.role_type);
  let appSessionId    = firstDefinedString(body.session_id, directContext.session_id);
  let appSlotId       = firstDefinedString(body.slot_id, directContext.slot_id);
  let productionId    = productionIdRaw;
  let slotAssignments: Record<string, unknown>[] = Array.isArray(directContext.slot_assignments)
    ? directContext.slot_assignments.filter(isRecord) as Record<string, unknown>[]
    : [];

  // Path A: we have an applicant_id — non-fatal if DB lookup fails, top-level email/name are the fallback
  if (applicantIdRaw) {
    try {
      const { data: app } = await sb
        .from('audition_applications')
        .select('id,name,email,contact_name,role_interest,custom_answers,session_id,slot_id,time_slot_id,slot_assignments,production_id')
        .eq('id', applicantIdRaw)
        .maybeSingle();
      if (app) {
        if (app.email) performerEmail = String(app.email);
        if (app.name)  performerName  = String(app.name);
        customAnswers  = isRecord(app.custom_answers) ? app.custom_answers as Record<string, unknown> : {};
        contactName    = firstDefinedString(contactName, (app as Record<string, unknown>).contact_name, customAnswers['Contact Name']);
        roleInterest   = firstDefinedString(directContext.role_name, String(app.role_interest || ''));
        appSessionId   = String(app.session_id || '');
        appSlotId      = String(app.time_slot_id || app.slot_id || '');
        slotAssignments = Array.isArray((app as Record<string, unknown>).slot_assignments)
          ? ((app as Record<string, unknown>).slot_assignments as unknown[]).filter(isRecord) as Record<string, unknown>[]
          : slotAssignments;
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
        .select('id,role_interest,custom_answers,session_id,slot_id,time_slot_id,slot_assignments')
        .eq('id', String(booking.applicant_id))
        .single();
      if (linkedApp) {
        roleInterest  = roleInterest  || String(linkedApp.role_interest || '');
        const appAnswers = isRecord(linkedApp.custom_answers) ? linkedApp.custom_answers as Record<string, unknown> : {};
        customAnswers = { ...appAnswers, ...customAnswers }; // booking answers win on conflicts
        contactName = firstDefinedString(contactName, appAnswers['Contact Name'], customAnswers['Contact Name']);
        slotAssignments = Array.isArray((linkedApp as Record<string, unknown>).slot_assignments)
          ? ((linkedApp as Record<string, unknown>).slot_assignments as unknown[]).filter(isRecord) as Record<string, unknown>[]
          : slotAssignments;
        appSessionId = firstDefinedString(appSessionId, linkedApp.session_id);
        appSlotId = firstDefinedString(appSlotId, linkedApp.time_slot_id, linkedApp.slot_id);
      }
    }
  }

  if (!productionId)   return json({ ok: false, error: 'Missing production_id' });
  if (!performerEmail && category !== 'team_invite') return json({ ok: false, error: 'No email address found for this performer' });

  // ── Fetch production + template + org ────────────────────────
  const [{ data: prod }, { data: templates }] = await Promise.all([
    sb.from('productions')
      .select('id,title,subtitle,venue,director,organization_id,start_date,end_date')
      .eq('id', productionId)
      .maybeSingle(),
    sb.from('email_templates')
      .select('subject,body,trigger')
      .eq('production_id', productionId)
      .eq('category', category)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  const templateList = Array.isArray(templates) ? templates as { subject?: string; body?: string; trigger?: string }[] : [];
  const template =
    templateList.find(t => String(t.trigger || '').trim() === requestedTrigger) ||
    templateList.find(t => !t.trigger && requestedTrigger === CATEGORY_TO_TRIGGER[category]) ||
    templateList[0] ||
    null;

  let teamMember: Record<string, unknown> | null = null;
  if (category === 'team_invite') {
    const teamMemberId = firstDefinedString(body.team_member_id, directContext.team_member_id);
    try {
      let teamQuery = sb
        .from('production_team_members')
        .select('id,name,email,role,passcode')
        .eq('production_id', productionId);
      if (teamMemberId) {
        teamQuery = teamQuery.eq('id', teamMemberId);
      } else if (performerEmail) {
        teamQuery = teamQuery.eq('email', performerEmail);
      }
      const { data } = await teamQuery.limit(1).maybeSingle();
      teamMember = data as Record<string, unknown> | null;
    } catch { teamMember = null; }
    performerEmail = firstDefinedString(performerEmail, teamMember?.email, directContext.team_member_email);
    performerName = firstDefinedString(performerName, teamMember?.name, directContext.team_member_name);
    if (!performerEmail) return json({ ok: false, error: 'No email address found for this team member' });
  }

  // Fallback template for booking_confirmation so the email always goes out
  const FALLBACK_TEMPLATES: Record<string, { subject: string; body: string }> = {
    booking_confirmation: {
      subject: 'Your audition is confirmed: {{show_name}}',
      body: `Hi {{contact_name}},

Your audition for {{show_name}} is confirmed. We can't wait to see you!

Here are your details:

Session: {{audition_session}}
Date: {{audition_date}}
Time: {{audition_time}}
Location: {{audition_venue}}

{{what_to_prepare}}

If you need to reschedule or have any questions, please get in touch as soon as possible.

See you soon,
{{director_name}}
{{org_name}}`,
    },
  };

  const fallback = !template && !body.subject && !body.message ? FALLBACK_TEMPLATES[category] : null;
  if (!template && !body.subject && !body.message && !fallback) {
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
    end_date: firstDefinedString(directContext.rehearsal_end_date, directContext.opening_night, directProduction.end_date, prod?.end_date),
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

  const sessionIds = [...new Set([sessionId].filter(Boolean))];
  const slotIds    = [...new Set([slotId].filter(Boolean))];
  slotAssignments.forEach(assignment => {
    const assignmentSessionId = String(assignment.session_id || '').trim();
    const assignmentSlotId = String(assignment.slot_id || '').trim();
    if (assignmentSessionId) sessionIds.push(assignmentSessionId);
    if (assignmentSlotId) slotIds.push(assignmentSlotId);
  });

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

  const [{ data: sessions }, { data: slots }, { data: allProductionSessions }, { data: performanceEvents }] = await Promise.all([
    sessionIds.length
      ? sb.from('audition_sessions').select('id,name,session_date,date,start_time,location,prepare_text').in('id', [...new Set(sessionIds)])
      : Promise.resolve({ data: [] }),
    slotIds.length
      ? sb.from('audition_time_slots').select('id,slot_time,slot_date,label').in('id', [...new Set(slotIds)])
      : Promise.resolve({ data: [] }),
    productionId
      ? sb.from('audition_sessions').select('id,name,type,date,start_time,location,prepare_text').eq('production_id', productionId).order('sort_order', { ascending: true })
      : Promise.resolve({ data: [] }),
    productionId
      ? sb.from('production_events').select('title,start_time,end_time,venue,event_type').eq('production_id', productionId).eq('event_type', 'performance').order('start_time', { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  if (applicantIdRaw && !roleType) {
    try {
      const { data: assignmentRows } = await sb
        .from('casting_assignments')
        .select('character_id,state')
        .eq('production_id', productionId)
        .eq('applicant_id', applicantIdRaw)
        .limit(5);
      const characterIds = (assignmentRows || [])
        .map((row: Record<string, unknown>) => String(row.character_id || ''))
        .filter(Boolean);
      if (characterIds.length) {
        const { data: characters } = await sb
          .from('production_characters')
          .select('id,name,role_type')
          .in('id', characterIds);
        const byId = new Map((characters || []).map((c: Record<string, unknown>) => [String(c.id), c]));
        const selected = (assignmentRows || [])
          .map((row: Record<string, unknown>) => byId.get(String(row.character_id || '')))
          .find(Boolean) as Record<string, unknown> | undefined;
        roleType = firstDefinedString(selected?.role_type, roleType);
        roleInterest = firstDefinedString(roleInterest, selected?.name);
      }
    } catch { /* role type remains optional */ }
  }

  const danceCallSession = (allProductionSessions || []).find((s: Record<string,unknown>) =>
    String(s.type || '').toLowerCase().includes('dance') ||
    String(s.name || '').toLowerCase().includes('dance')
  ) as Record<string,unknown> | undefined;

  const generalAuditionSession = (allProductionSessions || []).find((s: Record<string,unknown>) =>
    String(s.type || '').toLowerCase().includes('general') ||
    String(s.name || '').toLowerCase().includes('general')
  ) as Record<string,unknown> | undefined;

  const callbackSessionProd = (allProductionSessions || []).find((s: Record<string,unknown>) =>
    String(s.type || '').toLowerCase().includes('callback') ||
    String(s.name || '').toLowerCase().includes('callback')
  ) as Record<string,unknown> | undefined;

  const sessionsById = Object.fromEntries((sessions || []).map(r => [r.id, r]));
  const slotsById    = Object.fromEntries((slots    || []).map(r => [r.id, r]));

  const primarySession = sessionsById[sessionId] || null;
  const primarySlot    = slotsById[slotId]       || null;
  function slotForSession(session: Record<string, unknown> | undefined): Record<string, unknown> | null {
    if (!session?.id) return null;
    const assignment = slotAssignments.find(item => String(item.session_id || '') === String(session.id));
    return assignment?.slot_id ? (slotsById[String(assignment.slot_id)] || null) : null;
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
  // Keep as original HTML so it renders properly in HTML emails.
  // htmlToPlainText is applied to the whole body later for the plain-text version.
  const whatToPrepare = firstDefinedString(
    String(directContext.what_to_prepare || ''),
    String((primarySession as Record<string,unknown>)?.prepare_text || ''),
    String(customAnswers['What to Prepare'] || ''),
    String(customAnswers['what_to_prepare'] || ''),
  );
  const showDates = productionRecord.start_date && productionRecord.end_date
    ? `${fmtDate(String(productionRecord.start_date))} – ${fmtDate(String(productionRecord.end_date))}`
    : (productionRecord.start_date ? fmtDate(String(productionRecord.start_date)) : '');
  const bookingLink = `https://buildtheshow.com/audition-info?prod=${productionId}`;
  const pronouns    = firstDefinedString(
    directContext.performer_pronouns, customAnswers['Pronouns'], customAnswers['pronouns'],
  );
  contactName = firstDefinedString(contactName, customAnswers['Contact Name']);
  const contactFirstName = firstNameOnly(contactName);
  const performanceSchedule = firstDefinedString(
    directContext.performance_schedule,
    ((performanceEvents || []) as Record<string, unknown>[]).map(formatScheduleEvent).filter(Boolean).join('\n'),
  );
  const teamPortalLink = firstDefinedString(
    directContext.portal_link,
    `https://buildtheshow.com/audition-team?prod=${productionId}`,
  );

  const tokenValues: Record<string, string> = {
    '{{contact_name}}':          contactFirstName,
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
    '{{role_type}}':             roleType,
    '{{rehearsal_start_date}}':  productionRecord.start_date ? fmtDate(String(productionRecord.start_date)) : '',
    '{{rehearsal_schedule}}':    firstDefinedString(directContext.rehearsal_schedule, directProduction.rehearsal_schedule),
    '{{rehearsal_end_date}}':    productionRecord.end_date   ? fmtDate(String(productionRecord.end_date))   : '',
    '{{opening_night}}':         productionRecord.end_date   ? fmtDate(String(productionRecord.end_date))   : '',
    '{{performance_schedule}}':  performanceSchedule,
    '{{team_member_name}}':      firstDefinedString(directContext.team_member_name, teamMember?.name, performerName),
    '{{team_member_role}}':      firstDefinedString(directContext.team_member_role, teamMember?.role),
    '{{team_member_email}}':     firstDefinedString(directContext.team_member_email, teamMember?.email, performerEmail),
    '{{team_access_code}}':      firstDefinedString(directContext.team_access_code, teamMember?.passcode),
    '{{portal_link}}':           teamPortalLink,
    '{{submission_link}}':       firstDefinedString(directContext.submission_link, directContext.self_tape_submission_link),
    '{{general_audition_date}}':  firstDefinedString(directContext.general_audition_date, generalAuditionSession ? fmtDate(String(generalAuditionSession.date || '')) : ''),
    '{{general_audition_time}}':  firstDefinedString(directContext.general_audition_time, slotForSession(generalAuditionSession)?.slot_time ? fmtTime(String(slotForSession(generalAuditionSession)?.slot_time || '')) : '', generalAuditionSession ? fmtTime(String(generalAuditionSession.start_time || '')) : ''),
    '{{general_audition_venue}}': firstDefinedString(directContext.general_audition_venue, generalAuditionSession ? String(generalAuditionSession.location || audVenue) : audVenue),
    '{{general_audition_name}}':  firstDefinedString(directContext.general_audition_name, generalAuditionSession ? String(generalAuditionSession.name || '') : ''),
    '{{general_audition_prepare}}': generalAuditionSession ? String(generalAuditionSession.prepare_text || '') : '',
    '{{dance_call_date}}':        firstDefinedString(directContext.dance_call_date, danceCallSession ? fmtDate(String(danceCallSession.date || '')) : ''),
    '{{dance_call_time}}':        firstDefinedString(directContext.dance_call_time, slotForSession(danceCallSession)?.slot_time ? fmtTime(String(slotForSession(danceCallSession)?.slot_time || '')) : '', danceCallSession ? fmtTime(String(danceCallSession.start_time || '')) : ''),
    '{{dance_call_venue}}':       firstDefinedString(directContext.dance_call_venue, danceCallSession ? String(danceCallSession.location || audVenue) : audVenue),
    '{{dance_call_name}}':        firstDefinedString(directContext.dance_call_name, danceCallSession ? String(danceCallSession.name || '') : ''),
    '{{dance_call_prepare}}':     danceCallSession ? String(danceCallSession.prepare_text || '') : '',
    '{{callback_date}}':          firstDefinedString(
      directContext.callback_date,
      callbackSessionProd ? fmtDate(String(callbackSessionProd.date        || '')) : '',
    ),
    '{{callback_time}}':          firstDefinedString(
      directContext.callback_time,
      slotForSession(callbackSessionProd)?.slot_time ? fmtTime(String(slotForSession(callbackSessionProd)?.slot_time || '')) : '',
      callbackSessionProd ? fmtTime(String(callbackSessionProd.start_time  || '')) : '',
    ),
    '{{callback_venue}}':         firstDefinedString(
      directContext.callback_venue,
      callbackSessionProd ? String(callbackSessionProd.location || audVenue) : audVenue,
    ),
    '{{callback_name}}':          callbackSessionProd ? String(callbackSessionProd.name || '') : '',
    '{{callback_prepare}}':       firstDefinedString(
      directContext.callback_prepare,
      callbackSessionProd ? String(callbackSessionProd.prepare_text || '') : '',
    ),
    '{{all_audition_sessions}}': (allProductionSessions || [])
      .map((s: Record<string,unknown>) => `${s.name || 'Session'}: ${s.date ? fmtDate(String(s.date)) : 'TBC'}${s.start_time ? ' at ' + fmtTime(String(s.start_time)) : ''}`)
      .join('\n'),
  };

  // Dynamic per-session tokens — one group per session, keyed by name slug.
  // Uses "if not already set" so the explicit type-based tokens above take priority.
  for (const session of ((allProductionSessions ?? []) as Record<string,unknown>[])) {
    const slug = sessionSlug(String(session.name || ''));
    if (!slug) continue;
    const dk = `{{${slug}_date}}`;
    const tk = `{{${slug}_time}}`;
    const vk = `{{${slug}_venue}}`;
    const nk = `{{${slug}_name}}`;
    const pk = `{{${slug}_prepare}}`;
    if (!(dk in tokenValues)) tokenValues[dk] = session.date        ? fmtDate(String(session.date))        : '';
    if (!(tk in tokenValues)) tokenValues[tk] = slotForSession(session)?.slot_time ? fmtTime(String(slotForSession(session)?.slot_time || '')) : (session.start_time ? fmtTime(String(session.start_time)) : '');
    if (!(vk in tokenValues)) tokenValues[vk] = String(session.location || audVenue);
    if (!(nk in tokenValues)) tokenValues[nk] = String(session.name || '');
    if (!(pk in tokenValues)) tokenValues[pk] = String(session.prepare_text || '');
  }

  for (const [key, rawValue] of Object.entries(directContext)) {
    const token = `{{${key}}}`;
    if (token in tokenValues) continue;
    if (rawValue === null || rawValue === undefined) continue;
    if (['string', 'number', 'boolean'].includes(typeof rawValue)) {
      tokenValues[token] = String(rawValue);
    }
  }

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
    contact_name:          contactFirstName,
    role_name:            roleInterest,
    role_type:             roleType,
    ...customAnswers,
  };

  // These tokens contain rich HTML from the org's editor — insert as-is in HTML emails.
  const rawHtmlTokens = new Set([
    '{{what_to_prepare}}',
    '{{audition_notes}}',
    '{{general_audition_prepare}}',
    '{{dance_call_prepare}}',
    '{{callback_prepare}}',
  ]);

  function substituteTemplate(text: string, escapeForHtml = false): string {
    let result = String(text || '');
    Object.entries(tokenValues).forEach(([token, value]) => {
      const isRaw = escapeForHtml && (rawHtmlTokens.has(token) || /^\{\{[a-z0-9_]+_prepare\}\}$/.test(token));
      result = result.split(token).join((escapeForHtml && !isRaw) ? escHtml(value) : value);
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
  const sourceSubject = overrideSubject || template?.subject || fallback?.subject || CATEGORY_SUBJECTS[category] || `Update from ${showName || 'Build The Show'}`;
  const sourceBody    = overrideMessage || template?.body    || fallback?.body    || '';
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

  const bccAddresses = (orgEmail && orgEmail !== performerEmail)
    ? [orgEmail]
    : undefined;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:     fromField,
      to:       [performerEmail],
      reply_to: replyTo,
      ...(bccAddresses ? { bcc: bccAddresses } : {}),
      subject,
      html,
      text:     bodyText,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const resendMsg = (err as Record<string, string>).message || (err as Record<string, string>).name || JSON.stringify(err);
    console.error('[send-email] Resend error:', err);
    return json({ ok: false, error: `Resend API error: ${resendMsg}` });
  }

  return json({ ok: true, sent: true, category, trigger: requestedTrigger, performer_email: performerEmail });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[send-email] Unhandled error:', msg);
    return json({ ok: false, error: `Unexpected error: ${msg}` });
  }
});

// ── Helpers ───────────────────────────────────────────────────

function sessionSlug(name: string): string {
  return String(name || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

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

function formatScheduleEvent(row: Record<string, unknown>): string {
  if (!row?.start_time) return String(row?.title || 'Performance');
  const start = String(row.start_time).slice(0, 16);
  const [datePart, timePart = ''] = start.split('T');
  const date = datePart ? fmtDate(datePart) : '';
  const time = timePart ? fmtTime(timePart) : '';
  const venue = row.venue ? ` - ${row.venue}` : '';
  return `${row.title || 'Performance'}: ${[date, time].filter(Boolean).join(' at ')}${venue}`;
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
  let result = String(html || '');
  // Convert ordered lists to numbered items before stripping tags
  result = result.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_: string, content: string) => {
    let i = 0;
    return '\n' + content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_2: string, item: string) => {
      i++;
      return `${i}. ${item.replace(/<[^>]+>/g, '').trim()}\n`;
    });
  });
  // Convert unordered lists to bullet items
  result = result.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_: string, content: string) => {
    return '\n' + content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_2: string, item: string) => {
      return `• ${item.replace(/<[^>]+>/g, '').trim()}\n`;
    });
  });
  return result
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
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

function firstNameOnly(value: unknown): string {
  return String(value || '').trim().split(/\s+/)[0] || '';
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
