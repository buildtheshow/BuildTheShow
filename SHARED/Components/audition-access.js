(function () {
  'use strict';
  async function availability(client, productionId) {
    const result = await client.rpc('bts_public_audition_availability', {p_production_id:productionId});
    if (result.error) throw new Error('We could not check available audition times. Please try again.');
    return result;
  }
  function counts(rows) {
    return Object.fromEntries((rows || []).map(row => [row.slot_id, Number(row.booked_count) || 0]));
  }
  function applicationPayload(value) {
    const fields = ['production_id','user_id','profile_id','name','email','phone','notes','headshot_url','role_interest','status','slot_id','experience','conflicts','skills','file_url','session_id','time_slot_id','experience_level','custom_answers','date_conflicts','slot_assignments','attendance_mode','audition_method','preferred_name','pronouns'];
    return Object.fromEntries(Object.entries(value).filter(([key]) => fields.includes(key)));
  }
  function bookingPayload(value) {
    const fields = ['production_id','session_id','slot_id','user_id','profile_id','age','is_minor','custom_answers','name','email','phone','pronouns','contact_name','role_preference','gender_preference','roles_requested','guardian_name','guardian_email','headshot_url','status','attendance_mode','portal_code'];
    return Object.fromEntries(Object.entries(value).filter(([key]) => fields.includes(key)));
  }
  window.BTSAuditionAccess = {availability, counts, applicationPayload, bookingPayload};
}());
