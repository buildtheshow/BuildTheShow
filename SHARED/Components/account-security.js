/* Account eligibility is checked by the backend. These helpers explain the result. */
(function () {
  'use strict';
  const CONFIRM_URL = '/member/account/confirm';
  function validAdultBirthDate(value, today = new Date()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const [year, month, day] = value.split('-').map(Number);
    const birth = new Date(year, month - 1, day);
    if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day) return false;
    let age = today.getFullYear() - year;
    if (today.getMonth() < month - 1 || (today.getMonth() === month - 1 && today.getDate() < day)) age--;
    return age >= 18 && age <= 120;
  }
  function safeReturnPath(value) {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/member';
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : '/member';
  }
  async function ensureAdultAccount(client, returnPath) {
    const { data, error } = await client.rpc('bts_get_account_status');
    if (error) throw new Error('We could not check your account. Please try again or contact privacy@buildtheshow.com.');
    if (!data?.active) {
      const next = safeReturnPath(returnPath || window.location.pathname + window.location.search);
      window.location.replace(CONFIRM_URL + '?return=' + encodeURIComponent(next));
      return false;
    }
    return true;
  }
  window.BTSAccountSecurity = { validAdultBirthDate, safeReturnPath, ensureAdultAccount };
}());
