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
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/member/home';
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : '/member/home';
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
  async function requireAdultLogin(client, returnPath) {
    const next = new URL(safeReturnPath(returnPath || window.location.pathname + window.location.search), window.location.origin);
    // Preview codes must not be forwarded through login URLs or copied links.
    next.searchParams.delete('pvw_passcode');
    for(const key of [...next.searchParams.keys()])if(key.startsWith('pvw_'))next.searchParams.delete(key);
    const destination = next.pathname + next.search;
    const { data, error } = await client.auth.getUser();
    if (error && data?.user) throw new Error('We could not verify your sign-in. Please try again.');
    if (!data?.user) {
      window.location.replace('/login?return=' + encodeURIComponent(destination));
      return false;
    }
    return ensureAdultAccount(client, destination);
  }
  function teamDefaultPageAccess(member, page) {
    const level = String(member?.access_level || '').trim().toLowerCase();
    if (['producer','admin','administrator','owner'].includes(level)) return 'manage';
    if (['creative','room'].includes(level) && page === 'auditions.general') return 'edit';
    if (level === 'check_in' && page === 'auditions.dashboard') return 'edit';
    if (level === 'schedule' && page === 'auditions.schedule') return 'edit';
    if (['creative','room','check_in','schedule','view_only'].includes(level)
      && ['auditions.general','auditions.dashboard','auditions.schedule'].includes(page)) return 'view';
    return 'none';
  }
  window.BTSAccountSecurity = { validAdultBirthDate, safeReturnPath, ensureAdultAccount, requireAdultLogin, teamDefaultPageAccess };
}());
