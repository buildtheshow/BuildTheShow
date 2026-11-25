(function () {
  'use strict';
  function requestId() {
    if (window.crypto.randomUUID) return window.crypto.randomUUID();
    const bytes=window.crypto.getRandomValues(new Uint8Array(16));
    bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const hex=[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
    return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
  }
  async function availability(client, productionId) {
    const result = await client.rpc('bts_public_audition_capacity', {p_production_id:productionId});
    if (result.error) throw new Error('We could not check available audition times. Please try again.');
    return result;
  }
  function counts(rows) {
    return Object.fromEntries((rows || []).map(row => [row.slot_id, (Number(row.booked_count) || 0) + (Number(row.held_count) || 0)]));
  }
  async function hold(client, action, slotId, holdId = null) {
    const result = await client.rpc('bts_audition_hold', {p_action:action,p_slot_id:slotId,p_hold_id:holdId});
    if (result.error) throw result.error;
    return result.data;
  }
  async function receipt(client, requestId) {
    const result = await client.rpc('bts_audition_receipt', {p_request_id:requestId});
    if (result.error) throw result.error;
    return result.data?.booking_id ? result.data : null;
  }
  async function confirm(client, requestId, booking, application, extraSessions = []) {
    const result = await client.rpc('bts_confirm_audition', {p_request_id:requestId,p_booking:bookingPayload(booking),p_application:applicationPayload(application),p_extra_sessions:extraSessions});
    if (result.error) throw result.error;
    if (!result.data?.booking_id || !result.data?.application_id) throw new Error('We could not confirm the saved booking. Please retry using this form.');
    return result.data;
  }
  function applicationPayload(value) {
    const fields = ['production_id','user_id','profile_id','name','email','phone','notes','headshot_url','role_interest','status','slot_id','experience','conflicts','skills','file_url','session_id','time_slot_id','experience_level','custom_answers','date_conflicts','slot_assignments','attendance_mode','audition_method','preferred_name','pronouns'];
    return Object.fromEntries(Object.entries(value).filter(([key]) => fields.includes(key)));
  }
  function bookingPayload(value) {
    const fields = ['production_id','session_id','slot_id','user_id','profile_id','age','is_minor','custom_answers','name','email','phone','pronouns','contact_name','role_preference','gender_preference','roles_requested','guardian_name','guardian_email','headshot_url','status','attendance_mode','portal_code'];
    return Object.fromEntries(Object.entries(value).filter(([key]) => fields.includes(key)));
  }
  window.BTSAuditionAccess = {requestId, availability, counts, hold, receipt, confirm, applicationPayload, bookingPayload};
}());
