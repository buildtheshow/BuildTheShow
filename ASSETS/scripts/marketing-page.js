/* marketing-page.js — shared init for all marketing sub-pages */
(function () {
  'use strict';

  const SUPABASE_URL = 'https://tkmaiktxpwqfbgeojbnf.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrbWFpa3R4cHdxZmJnZW9qYm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDc4NTI4NTYsImV4cCI6MjAyMzQyODg1Nn0.tVxOMkaMdBnuqQbLdHl00h4WA7DV8LHuVxCt6z5LFCY';

  // --- Path helpers ---------------------------------------------------------

  function pathParts() {
    return window.location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  }

  // Returns { org, show } from a slug URL like /ryt/org/Productions/show-slug/...
  // Returns { org: '', show: '' } when not on a slug URL.
  function productionSlugParts() {
    const parts = pathParts();
    const orgIndex = parts.findIndex(p => p.toLowerCase() === 'org');
    const prodIndex = parts.findIndex(p => p.toLowerCase() === 'productions');
    if (orgIndex < 1 || prodIndex < 0 || prodIndex + 1 >= parts.length) {
      return { org: '', show: '' };
    }
    return {
      org: parts[orgIndex - 1] || '',
      show: parts[prodIndex + 1] || '',
    };
  }

  // Returns the production base path, e.g. /ryt/org/Productions/show-slug
  function productionBasePath() {
    const parts = pathParts();
    const prodIndex = parts.findIndex(p => p.toLowerCase() === 'productions');
    if (prodIndex < 0 || prodIndex + 1 >= parts.length) return null;
    return '/' + parts.slice(0, prodIndex + 2).join('/');
  }

  // True when the current URL is a slug-based URL (not a ?id= file URL).
  function onSlugUrl() {
    const s = productionSlugParts();
    return !!(s.org && s.show);
  }

  // --- Production ID resolution ---------------------------------------------

  async function resolveProductionId() {
    const qid = new URLSearchParams(location.search).get('id');
    if (qid) return qid;

    const slugParts = productionSlugParts();
    if (!slugParts.org || !slugParts.show) return '';

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/resolve_team_portal`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_org_abbrev: slugParts.org, p_show_slug: slugParts.show }),
      });
      if (!res.ok) throw new Error(res.statusText);
      const id = await res.json();
      return id || '';
    } catch (err) {
      console.error('[BTS] marketing production lookup failed', err);
      return '';
    }
  }

  // --- Navigation -----------------------------------------------------------

  // Navigate to another marketing sub-page, preserving slug or ?id= pattern.
  window.navigateToMarketing = function (section) {
    const sec = section || 'dashboard';
    if (onSlugUrl()) {
      const base = productionBasePath();
      if (base) { window.location.href = base + '/marketing/' + sec; return; }
    }
    const id = new URLSearchParams(location.search).get('id');
    window.location.href = '/SYSTEM/Organisations/Productions/Workspace/marketing-' + sec + '.html' + (id ? '?id=' + encodeURIComponent(id) : '');
  };

  // Navigate to the production workspace (another top-level tab).
  window.navigateToWorkspace = function (tab, sub) {
    if (onSlugUrl()) {
      const base = productionBasePath();
      if (base) {
        const dest = base + (tab ? '/' + tab : '');
        if (sub) {
          window.location.href = dest + '/' + sub;
        } else {
          window.location.href = dest;
        }
        return;
      }
    }
    const id = new URLSearchParams(location.search).get('id');
    const p = new URLSearchParams();
    if (id) p.set('id', id);
    if (tab) p.set('tab', tab);
    if (sub) p.set('subtab', sub);
    window.location.href = '/SYSTEM/Organisations/Productions/Workspace/production-workspace.html?' + p.toString();
  };

  window.switchProdTab = function (tab) { window.navigateToWorkspace(tab); };
  window.openAuditionsSubTab = function (sub) { window.navigateToWorkspace('auditions', sub); };
  window.openRegistrationSubTab = function (sub) { window.navigateToWorkspace('registration', sub); };

  // --- Sidebar toggle helpers -----------------------------------------------

  window.toggleAuditionsMenu = function (e) {
    e.stopPropagation();
    document.getElementById('auditions-wrap')?.classList.toggle('open');
  };
  window.toggleRegistrationMenu = function (e) {
    e.stopPropagation();
    document.getElementById('registration-wrap')?.classList.toggle('open');
  };
  window.toggleMarketingMenu = function (e) {
    e.stopPropagation();
    document.getElementById('marketing-wrap')?.classList.toggle('open');
  };
  window.handleSidebarChevronKey = function (e, s) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (s === 'auditions') window.toggleAuditionsMenu(e);
    else if (s === 'registration') window.toggleRegistrationMenu(e);
    else if (s === 'marketing') window.toggleMarketingMenu(e);
  };
  window.toggleMobileSidebar = function () {
    document.body.classList.toggle('mobile-sidebar-open');
    document.getElementById('mobile-nav-toggle')?.setAttribute('aria-expanded', String(document.body.classList.contains('mobile-sidebar-open')));
  };
  window.closeMobileSidebar = function () {
    document.body.classList.remove('mobile-sidebar-open');
    document.getElementById('mobile-nav-toggle')?.setAttribute('aria-expanded', 'false');
  };

  // --- Main init ------------------------------------------------------------

  /**
   * Call once per marketing page.
   * @param {{ subId: string, kickerLabel: string, pageTitle: string }} opts
   *   subId       — the sidebar sub-item element ID to mark active (e.g. 'msub-dashboard')
   *   kickerLabel — fallback kicker text before production title loads (e.g. 'Marketing')
   *   pageTitle   — fallback document title suffix (e.g. 'Dashboard')
   */
  window.initMarketingPage = async function ({ subId, kickerLabel = 'Marketing', pageTitle = '' } = {}) {
    // Load sidebar
    try {
      const html = await fetch('/SHARED/Navigation/production-sidebar.html').then(r => r.text());
      document.getElementById('prod-sidebar-host').innerHTML = html;
      document.getElementById('marketing-wrap')?.classList.add('open');
      document.getElementById('marketing-parent-tab')?.classList.add('is-open-parent');
      if (subId) document.getElementById(subId)?.classList.add('active');
    } catch (_) {}

    // Resolve production and populate UI
    const prodId = await resolveProductionId();
    if (!prodId) return;

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/productions?id=eq.${encodeURIComponent(prodId)}&select=title,org_id`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const data = await res.json();
      if (!data?.[0]?.title) return;

      const { title, org_id } = data[0];
      document.title = title + (pageTitle ? ' — ' + pageTitle + ' — Marketing' : ' — Marketing');
      const kicker = document.getElementById('mkt-prod-kicker');
      if (kicker) kicker.textContent = title + ' / Marketing';

      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('hdr-title', title);
      set('hdr-mobile-title', title);

      const orgHref = org_id
        ? `/SYSTEM/Organisations/org-dashboard.html?id=${encodeURIComponent(org_id)}`
        : '/SYSTEM/Organisations/org-dashboard.html';
      ['sidebar-org-back', 'sidebar-mobile-org-back'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.href = orgHref;
      });
    } catch (_) {}
  };
})();
