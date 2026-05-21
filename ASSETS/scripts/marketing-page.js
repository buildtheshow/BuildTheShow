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

  // Navigate to the Budget page (tab = 'overview'|'budget'|'receipts'|'collect').
  window.navigateToBudget = function (tab) {
    const hash = tab ? '#' + tab : '';
    if (onSlugUrl()) {
      const base = productionBasePath();
      if (base) { window.location.href = base + '/budget' + hash; return; }
    }
    const id = new URLSearchParams(location.search).get('id');
    window.location.href = '/SYSTEM/Organisations/Productions/Workspace/production-budget.html' + (id ? '?id=' + encodeURIComponent(id) : '') + hash;
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
  window.toggleBudgetMenu = function (e) {
    e.stopPropagation();
    document.getElementById('budget-wrap')?.classList.toggle('open');
  };
  window.handleSidebarChevronKey = function (e, s) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (s === 'auditions') window.toggleAuditionsMenu(e);
    else if (s === 'registration') window.toggleRegistrationMenu(e);
    else if (s === 'marketing') window.toggleMarketingMenu(e);
    else if (s === 'budget') window.toggleBudgetMenu(e);
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
  const SIDEBAR_CACHE_KEY = 'bts-prod-sidebar-v5';

  function applySidebarState(subId) {
    document.querySelectorAll('.prod-tab.active, .prod-sub-item.active').forEach(el => el.classList.remove('active'));
    document.getElementById('marketing-wrap')?.classList.add('open');
    document.getElementById('marketing-parent-tab')?.classList.add('is-open-parent', 'active');
    if (subId) document.getElementById(subId)?.classList.add('active');
  }

  function applyBudgetSidebarState(subId) {
    document.querySelectorAll('.prod-tab.active, .prod-sub-item.active').forEach(el => el.classList.remove('active'));
    document.getElementById('budget-wrap')?.classList.add('open');
    document.getElementById('budget-parent-tab')?.classList.add('is-open-parent', 'active');
    if (subId) document.getElementById(subId)?.classList.add('active');
  }

  function loadSidebar(subId) {
    const cached = sessionStorage.getItem(SIDEBAR_CACHE_KEY);
    if (cached) {
      document.getElementById('prod-sidebar-host').innerHTML = cached;
      applySidebarState(subId);
    }
    fetch('/SHARED/Navigation/production-sidebar.html?v=budget-20260520')
      .then(r => r.text())
      .then(html => {
        sessionStorage.setItem(SIDEBAR_CACHE_KEY, html);
        if (!cached) {
          document.getElementById('prod-sidebar-host').innerHTML = html;
          applySidebarState(subId);
        }
      })
      .catch(() => {});
  }

  function loadBudgetSidebar(subId) {
    const cached = sessionStorage.getItem(SIDEBAR_CACHE_KEY);
    if (cached) {
      document.getElementById('prod-sidebar-host').innerHTML = cached;
      applyBudgetSidebarState(subId);
    }
    fetch('/SHARED/Navigation/production-sidebar.html?v=budget-20260520')
      .then(r => r.text())
      .then(html => {
        sessionStorage.setItem(SIDEBAR_CACHE_KEY, html);
        if (!cached) {
          document.getElementById('prod-sidebar-host').innerHTML = html;
          applyBudgetSidebarState(subId);
        }
      })
      .catch(() => {});
  }

  window.initBudgetPage = async function ({ pageTitle = 'Budget', subId } = {}) {
    if (!subId) {
      const hash = (location.hash || '').replace('#', '');
      const tabMap = { overview: 'bsub-overview', budget: 'bsub-budget', receipts: 'bsub-receipts', collect: 'bsub-collect' };
      subId = tabMap[hash] || 'bsub-overview';
    }
    loadBudgetSidebar(subId);
    const prodId = await resolveProductionId();
    if (!prodId) return;
    window.btsProdId = prodId;
    document.dispatchEvent(new CustomEvent('btsProdReady', { detail: { prodId } }));
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/productions?id=eq.${encodeURIComponent(prodId)}&select=title,org_id,poster_url`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const data = await res.json();
      if (!data?.[0]) return;
      const { title, org_id, poster_url } = data[0];
      document.title = title + ' — ' + pageTitle;
      const kicker = document.getElementById('bgt-prod-kicker');
      if (kicker) kicker.textContent = title + ' / Budget';
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('hdr-title', title);
      set('hdr-mobile-title', title);
      const orgHref = org_id
        ? `/SYSTEM/Organisations/org-dashboard.html?id=${encodeURIComponent(org_id)}`
        : '/SYSTEM/Organisations/org-dashboard.html';
      ['sidebar-org-back', 'sidebar-mobile-org-back'].forEach(id => {
        const el = document.getElementById(id); if (el) el.href = orgHref;
      });
      ['sidebar-poster-wrap', 'sidebar-mobile-poster-wrap'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (poster_url) { el.innerHTML = `<img src="${poster_url}" alt="Production poster" />`; el.classList.remove('hidden'); }
        else { el.innerHTML = ''; el.classList.add('hidden'); }
      });
    } catch (_) {}
  };

  window.initMarketingPage = async function ({ subId, kickerLabel = 'Marketing', pageTitle = '' } = {}) {
    // Load sidebar — cached path is synchronous so there's no flash between pages
    loadSidebar(subId);

    // Resolve production and populate UI
    const prodId = await resolveProductionId();
    if (!prodId) return;
    window.btsProdId = prodId;
    document.dispatchEvent(new CustomEvent('btsProdReady', { detail: { prodId } }));

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/productions?id=eq.${encodeURIComponent(prodId)}&select=title,org_id,poster_url`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const data = await res.json();
      if (!data?.[0]?.title) return;

      const { title, org_id, poster_url } = data[0];
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

      // Poster
      ['sidebar-poster-wrap', 'sidebar-mobile-poster-wrap'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (poster_url) {
          el.innerHTML = `<img src="${poster_url}" alt="Production poster" />`;
          el.classList.remove('hidden');
        } else {
          el.innerHTML = '';
          el.classList.add('hidden');
        }
      });
    } catch (_) {}
  };
})();
