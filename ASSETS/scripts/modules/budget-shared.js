/* budget-shared.js — shared utilities for all budget page modules */
(function () {
  'use strict';

  const SUPABASE_URL  = 'https://tkmaiktxpwqfbgeojbnf.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrbWFpa3R4cHdxZmJnZW9qYm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDc4NTI4NTYsImV4cCI6MjAyMzQyODg1Nn0.tVxOMkaMdBnuqQbLdHl00h4WA7DV8LHuVxCt6z5LFCY';

  const STARTER_CATEGORIES = {
    income: [
      'Ticket Sales', 'Production Fees', 'Programme Ads',
      'Merchandise', 'Sponsorship', 'Concessions', 'Grants', 'Other Income',
    ],
    expense: [
      'Venue Rental', 'Honoraria / Staff', 'Sound & Technical',
      'Costumes', 'Makeup & Hair', 'Sets & Scenery', 'Props',
      'Advertising & Marketing', 'Royalties & Licensing', 'Insurance',
      'Swag Bags', 'Celebrations & Gifts', 'Miscellaneous',
    ],
  };

  /* Shared state — reset when a new production loads */
  const BgtState = {
    prodId: null,
    categories: [],
    receipts: [],
    settings: null,
    reset() {
      this.prodId = null;
      this.categories = [];
      this.receipts = [];
      this.settings = null;
    },
  };

  /* --- Supabase helpers -------------------------------------------------- */

  function headers() {
    return { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON };
  }

  async function dbFetch(table, extra) {
    const r = await fetch(
      SUPABASE_URL + '/rest/v1/' + table + '?production_id=eq.' + BgtState.prodId + (extra || '') + '&order=created_at.asc',
      { headers: headers() }
    );
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  async function dbInsert(table, data) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + table, {
      method: 'POST',
      headers: Object.assign({}, headers(), { 'Content-Type': 'application/json', Prefer: 'return=representation' }),
      body: JSON.stringify(Object.assign({}, data, { production_id: BgtState.prodId })),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  async function dbUpdate(table, id, data) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + id, {
      method: 'PATCH',
      headers: Object.assign({}, headers(), { 'Content-Type': 'application/json', Prefer: 'return=representation' }),
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  async function dbDelete(table, id) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + id, {
      method: 'DELETE',
      headers: headers(),
    });
    if (!r.ok) throw new Error(await r.text());
  }

  /* --- Formatters -------------------------------------------------------- */

  function fmt$(cents) {
    if (cents == null) return '$0';
    return '$' + (cents / 100).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function fmtDate(d) {
    if (!d) return '';
    var parts = d.split('-');
    return parts[1] + '/' + parts[2] + '/' + parts[0].slice(2);
  }

  function esc(s) {
    return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '';
  }

  function catName(id) {
    var c = BgtState.categories.find(function (x) { return x.id === id; });
    return c ? c.name : '';
  }

  /* --- Exports ----------------------------------------------------------- */

  window.BgtShared = {
    SUPABASE_URL,
    SUPABASE_ANON,
    STARTER_CATEGORIES,
    BgtState,
    dbFetch,
    dbInsert,
    dbUpdate,
    dbDelete,
    fmt$,
    fmtDate,
    esc,
    catName,
  };
})();
