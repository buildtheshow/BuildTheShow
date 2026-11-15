import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Decision = { allowed: true; internal: boolean } | { allowed: false; status: number; error: string };

/** Validate the real caller before any privileged performer lookup or email send. */
export async function authorizeEmailRequest(
  request: Request,
  body: Record<string, unknown>,
  service: SupabaseClient,
  serviceRoleKey: string,
): Promise<Decision> {
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') || '')?.[1] || '';
  if (serviceRoleKey && token === serviceRoleKey) return { allowed: true, internal: true };
  if (!token) return { allowed: false, status: 401, error: 'Sign in before sending production email.' };

  const { data: identity, error: identityError } = await service.auth.getUser(token);
  const user = identity?.user;
  if (identityError || !user?.id || !user.email_confirmed_at) {
    return { allowed: false, status: 401, error: 'Sign in with a verified email address.' };
  }
  const productionId = String(body.production_id || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productionId)) {
    return { allowed: false, status: 403, error: 'Production email access is unavailable.' };
  }
  const testEmail = String(body.test_email || '').trim().toLowerCase();
  if (testEmail && testEmail !== String(user.email || '').trim().toLowerCase()) {
    return { allowed: false, status: 403, error: 'Test emails can only be sent to your own verified account email.' };
  }
  // IDs from another production must not reach service-role lookups in the sender.
  for (const [field, tables] of [
    ['applicant_id',['audition_applications','audition_bookings']],
    ['booking_id',['audition_bookings']],
    ['session_id',['audition_sessions']],
  ] as const) {
    const id = String(body[field] || '').trim();
    if (!id) continue;
    let found = false;
    // Historic casting records use either an application ID or a booking ID.
    for (const table of tables) {
      const { data, error } = await service.from(table).select('id').eq('id', id).eq('production_id', productionId).maybeSingle();
      if (!error && data) { found = true; break; }
    }
    if (!found) return { allowed: false, status: 403, error: 'The email record is unavailable for this production.' };
  }
  const { data: decision, error: accessError } = await service.rpc('bts_authorize_email_send', {
    p_user_id: user.id, p_production_id: productionId, p_test: Boolean(testEmail),
  });
  if (accessError || !decision?.allowed) {
    const limited = decision?.reason === 'rate_limited';
    return { allowed: false, status: limited ? 429 : 403, error: limited ? 'Email limit reached. Please try again later.' : 'You do not have permission to send email for this production.' };
  }
  return { allowed: true, internal: false };
}
