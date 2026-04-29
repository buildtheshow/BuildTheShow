(function attachCustomUrlValidation(root) {
  const RESERVED_SLUGS = new Set([
    'admin',
    'api',
    'auth',
    'billing',
    'dashboard',
    'login',
    'logout',
    'signup',
    'settings',
    'support',
    'help',
    'account',
    'profile',
    'users',
    'organisations',
    'organizations',
    'productions',
    'public',
    'system',
    'assets',
    'backend',
    'shared',
    'home',
    'www',
    'mail',
    'app',
  ]);

  const STRICT_BLOCKED_PATTERNS = [
    /arsehole/,
    /asshole/,
    /bitch/,
    /blowjob/,
    /bullshit/,
    /chink/,
    /cock/,
    /cocksucker/,
    /cunt/,
    /faggot/,
    /^fag$/,
    /fuck/,
    /kike/,
    /motherfucker/,
    /nazi/,
    /nigg/,
    /paki/,
    /porn/,
    /pussy/,
    /shit/,
    /slut/,
    /spic/,
    /twat/,
    /whore/,
    /wop/,
  ];

  const GENERIC_UNAVAILABLE_MESSAGE = 'This custom URL is not available. Please choose another one.';

  function removeDiacritics(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function slugify(value, maxLength = 50) {
    return removeDiacritics(value)
      .trim()
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, maxLength);
  }

  function normalizeSubmittedSlug(value) {
    return removeDiacritics(value).trim().toLowerCase();
  }

  function normalizeForBlockedComparison(value) {
    return removeDiacritics(value)
      .trim()
      .toLowerCase()
      .replace(/[013457]/g, char => ({
        0: 'o',
        1: 'i',
        3: 'e',
        4: 'a',
        5: 's',
        7: 't',
      })[char] || char)
      .replace(/[^a-z]/g, '');
  }

  function validateFormat(slug) {
    if (!slug) return false;
    if (slug.length < 3 || slug.length > 50) return false;
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
  }

  function isReserved(slug) {
    return RESERVED_SLUGS.has(String(slug || '').toLowerCase());
  }

  function isBlocked(slug) {
    const normalized = normalizeForBlockedComparison(slug);
    return STRICT_BLOCKED_PATTERNS.some(pattern => pattern.test(normalized));
  }

  function validate(slug) {
    const value = normalizeSubmittedSlug(slug);
    if (!validateFormat(value)) return { ok: false, reason: 'format', message: GENERIC_UNAVAILABLE_MESSAGE };
    if (isReserved(value)) return { ok: false, reason: 'reserved', message: GENERIC_UNAVAILABLE_MESSAGE };
    if (isBlocked(value)) return { ok: false, reason: 'blocked', message: GENERIC_UNAVAILABLE_MESSAGE };
    return { ok: true, reason: '', message: '' };
  }

  const api = {
    GENERIC_UNAVAILABLE_MESSAGE,
    RESERVED_SLUGS,
    normalizeSubmittedSlug,
    slugify,
    normalizeForBlockedComparison,
    validateFormat,
    isReserved,
    isBlocked,
    validate,
  };

  root.BTSCustomUrl = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
