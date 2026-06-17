// Build The Show — Production Sidebar Navigation
// Shared sidebar toggle and navigation functions for standalone production pages.

(function () {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────────────────────

  function prodId() {
    return new URLSearchParams(location.search).get('id') || '';
  }

  function workspaceUrl(tab, sub) {
    const id = prodId();
    let url = '/SYSTEM/Organisations/Productions/Workspace/production-workspace.html?id=' + encodeURIComponent(id) + '&tab=' + tab;
    if (sub) url += '&sub=' + sub;
    return url;
  }

  function pageUrl(file) {
    const id = prodId();
    return '/SYSTEM/Organisations/Productions/Workspace/' + file + '?id=' + encodeURIComponent(id);
  }

  window.btsProdNav = function (file) {
    location.href = pageUrl(file);
  };

  window.btsDeptSectionNav = function (group, section, tab) {
    var url = pageUrl('department-section.html') +
      '&group=' + encodeURIComponent(group || '') +
      '&section=' + encodeURIComponent(section || '') +
      '&tab=' + encodeURIComponent(tab || 'dashboard');
    location.href = url;
  };

  // ── Group state ──────────────────────────────────────────────────────────

  const ALL_GROUPS = ['overview', 'plan', 'cast', 'departments', 'promote', 'ticketing', 'volunteers', 'financials', 'wrapup', 'portals', 'settings', 'build'];

  window.openSidebarGroup = function (groupId) {
    ALL_GROUPS.forEach(function (id) {
      const g = document.getElementById('group-' + id);
      if (!g) return;
      const open = id === groupId;
      g.classList.toggle('open', open);
      const header = g.querySelector('.sidebar-group-header');
      if (header) header.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  };

  window.toggleSidebarGroup = function (groupId, e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const grp = document.getElementById('group-' + groupId);
    if (!grp) return;
    const isOpen = grp.classList.contains('open');
    ALL_GROUPS.forEach(function (id) {
      const g = document.getElementById('group-' + id);
      if (!g) return;
      g.classList.remove('open');
      const header = g.querySelector('.sidebar-group-header');
      if (header) header.setAttribute('aria-expanded', 'false');
    });
    if (!isOpen) {
      grp.classList.add('open');
      const header = grp.querySelector('.sidebar-group-header');
      if (header) header.setAttribute('aria-expanded', 'true');
    }
  };

  window.handleGroupHeaderKey = function (e, groupId) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    window.toggleSidebarGroup(groupId, e);
  };

  // ── Submenu toggles ──────────────────────────────────────────────────────

  const SUBMENU_SECTIONS = [
    'auditions',
    'registration',
    'casting',
    'marketing',
    'budget',
    'dept-front-of-house',
    'dept-backstage',
    'dept-technical',
    'dept-design',
    'dept-costume',
    'dept-hair',
    'dept-marketing-publicity',
    'dept-stage-management',
  ];

  function syncSidebarMenuA11y() {
    SUBMENU_SECTIONS.forEach(function (section) {
      const wrap = document.getElementById(section + '-wrap');
      const parent = document.getElementById(section + '-parent-tab');
      const chevron = parent ? parent.querySelector('.tab-chevron') : null;
      const expanded = wrap && wrap.classList.contains('open') ? 'true' : 'false';
      if (parent) parent.setAttribute('aria-expanded', expanded);
      if (chevron) chevron.setAttribute('aria-expanded', expanded);
    });
  }

  function openSubmenu(section) {
    SUBMENU_SECTIONS.map(function (item) { return item + '-wrap'; }).forEach(function (id) {
      const wrap = document.getElementById(id);
      if (wrap) wrap.classList.toggle('open', id === section + '-wrap');
    });
    syncSidebarMenuA11y();
  }

  function makeToggle(section) {
    return function (e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      const wrap = document.getElementById(section + '-wrap');
      if (!wrap) return;
      const isOpen = wrap.classList.contains('open');
      if (isOpen) { wrap.classList.remove('open'); syncSidebarMenuA11y(); return; }
      openSubmenu(section);
    };
  }

  window.toggleAuditionsMenu    = makeToggle('auditions');
  window.toggleRegistrationMenu = makeToggle('registration');
  window.toggleCastingMenu      = makeToggle('casting');
  window.toggleMarketingMenu    = makeToggle('marketing');
  window.toggleBudgetMenu       = makeToggle('budget');
  window.toggleDepartmentSubmenu = function (e, section) {
    makeToggle(section)(e);
  };

  window.handleSidebarChevronKey = function (e, section) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const fn = { auditions: window.toggleAuditionsMenu, registration: window.toggleRegistrationMenu, casting: window.toggleCastingMenu, marketing: window.toggleMarketingMenu, budget: window.toggleBudgetMenu }[section];
    if (!fn && section.indexOf('dept-') === 0) {
      window.toggleDepartmentSubmenu(e, section);
      return;
    }
    if (fn) fn(e);
  };

  // ── Mobile sidebar ───────────────────────────────────────────────────────

  window.toggleMobileSidebar = function () {
    document.body.classList.toggle('mobile-sidebar-open');
  };

  window.closeMobileSidebar = function () {
    document.body.classList.remove('mobile-sidebar-open');
  };

  // ── Navigation ───────────────────────────────────────────────────────────

  window.switchProdTab = function (tab) {
    const pageMap = {
      overview:  'production-workspace.html',
      calendar:  'production-workspace.html',
      team:      'production-workspace.html',
      auditions: 'production-workspace.html',
      casting:   'production-workspace.html',
      castlist:  'production-workspace.html',
      registration: 'production-workspace.html',
      marketing: 'production-workspace.html',
      volunteers: 'production-workspace.html',
      budget:    'production-workspace.html',
      settings:  'production-workspace.html',
      emails:    'production-workspace.html',
      test:      'production-workspace.html',
    };
    if (pageMap[tab]) {
      location.href = workspaceUrl(tab);
    }
  };

  window.openAuditionsSubTab = function (sub) {
    location.href = workspaceUrl('auditions', sub);
  };

  window.navigateToRegistration = function (sub) {
    location.href = workspaceUrl('registration', sub);
  };

  window.openCastingSubTab = function () {
    location.href = workspaceUrl('casting', 'castingboard');
  };

  window.openFinalCastingSubTab = function () {
    location.href = workspaceUrl('casting', 'offers');
  };

  window.navigateToMarketing = function (sub) {
    location.href = workspaceUrl('marketing', sub);
  };

  window.navigateToVolunteers = function (sub) {
    location.href = workspaceUrl('volunteers', sub);
  };

  window.navigateToBudget = function (sub) {
    location.href = workspaceUrl('budget', sub);
  };

  window.setSidebarSubmenuState = function () {};

  // ── Accessibility enhancements ───────────────────────────────────────────

  window.enhanceSidebarNavControls = function (root) {
    (root || document).querySelectorAll('.prod-tab[data-tab], .prod-sub-item, .prod-sub-group-link').forEach(function (el) {
      if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      if (el.dataset.sidebarKeyBound === 'true') return;
      el.dataset.sidebarKeyBound = 'true';
      el.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (event.target.closest('.tab-chevron')) return;
        event.preventDefault();
        el.click();
      });
    });
    syncSidebarMenuA11y();
  };

  // ── Sidebar HTML loader ──────────────────────────────────────────────────

  // Currency for the financials nav icon — set by initProductionPage, read by applyAndInit
  var _finCurrency = null;

  function applyFinancialsIcon() {
    var icon = document.getElementById('sidebar-financials-icon');
    if (!icon) return;
    var file = _finCurrency === 'GBP'
      ? 'Budgeting-total-spent-gbp.svg'
      : 'Budgeting-total-spent-cad-usd.svg';
    icon.src = '/ASSETS/Images/Icons/' + file + '?v=20260611';
  }

  window.loadProductionSidebar = function (activeGroup, activePage) {
    const key = 'bts-prod-sidebar-v29';
    const cached = sessionStorage.getItem(key);
    const host = document.getElementById('prod-sidebar-host');
    if (!host) return;

    function applyAndInit(html) {
      host.innerHTML = html;
      window.enhanceSidebarNavControls(host);
      // Wire up data-tab items that have no onclick — same as workspace initProdSidebarEvents
      host.querySelectorAll('.prod-tab[data-tab]').forEach(function (el) {
        if (el.hasAttribute('onclick')) return;
        if (!el.dataset.tab) return;
        el.addEventListener('click', function () {
          window.switchProdTab(el.dataset.tab);
        });
      });
      if (activeGroup) window.openSidebarGroup(activeGroup);
      // Mark active immediately — we inject a DOM span, not a CSS ::before, so no rAF needed.
      // Also re-run in rAF as belt-and-suspenders in case the group open is animated.
      markCurrentPageActive(activePage);
      requestAnimationFrame(function () { markCurrentPageActive(activePage); });
      // Apply currency-specific financials icon if currency is already known
      applyFinancialsIcon();
    }

    if (cached) applyAndInit(cached);

    fetch('/SHARED/Navigation/production-sidebar.html?v=sidebar-v56-20260617')
      .then(function (res) { return res.text(); })
      .then(function (html) {
        sessionStorage.setItem(key, html);
        if (!cached) applyAndInit(html);
      })
      .catch(function () {});
  };

  // ── Production header loader ─────────────────────────────────────────────
  // Fetches minimal production data from Supabase and populates the sidebar
  // header on standalone production pages.

  window.initProductionPage = async function (activeGroup) {
    const idParam = prodId();

    // Load sidebar HTML first so it shows immediately
    var currentFile = location.pathname.split('/').pop().split('?')[0];
    window.loadProductionSidebar(activeGroup, currentFile);

    if (!idParam) return;

    // Supabase client — anon key, read-only public data
    if (typeof supabase === 'undefined') return;
    const { createClient } = supabase;
    const sb = createClient(
      'https://tkmaiktxpwqfbgeojbnf.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrbWFpa3R4cHdxZmJnZW9qYm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MzE4MTcsImV4cCI6MjA4OTMwNzgxN30.TkTZBNWUatk3Y6Vmfv1hIRR3DfVjgwauwa76Pf00J_8'
    );

    const { data: prod } = await sb
      .from('productions')
      .select('id, title, subtitle, season_year, status, venue, poster_url, organization_id, registration_settings, organizations(slug)')
      .eq('id', idParam)
      .single();

    if (!prod) return;

    // Set currency-specific financials nav icon
    _finCurrency = prod.registration_settings?.payment_settings?.currency || 'CAD';
    applyFinancialsIcon();

    document.title = prod.title + ' - Build The Show';

    const setEl = function (id, val) {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    const sub = [prod.subtitle, prod.season_year].filter(Boolean).join(' · ');
    setEl('hdr-title', prod.title);
    setEl('hdr-mobile-title', prod.title);
    setEl('hdr-sub', sub || prod.venue || '');
    setEl('hdr-mobile-sub', sub || prod.venue || '');

    const labels = { setup: 'In Planning', auditions: 'Auditions Launched', casting: 'Show Cast', rehearsals: 'Rehearsing', performances: 'Performing', wrapped: 'Wrapped' };
    const statusLabel = labels[prod.status] || 'Setup';
    const statusClass = 'status-badge s-' + (prod.status || 'setup');
    ['hdr-status', 'hdr-mobile-status'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = statusLabel;
      el.className = statusClass + (id === 'hdr-mobile-status' ? ' sidebar-mobile-status' : '');
      el.style.display = '';
    });

    const orgSlug = prod.organizations && prod.organizations.slug;
    const orgHref = orgSlug ? '/' + encodeURIComponent(orgSlug) + '/ORG' : '/org/dashboard';
    document.querySelectorAll('#sidebar-org-back, #sidebar-mobile-org-back').forEach(function (link) {
      link.href = orgHref;
    });

    if (prod.poster_url) {
      ['sidebar-poster-wrap', 'sidebar-mobile-poster-wrap'].forEach(function (id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = '<img src="' + prod.poster_url + '" alt="Production poster" />';
        el.classList.remove('hidden');
      });
    }
  };


  function addActiveDot(el) {
    el.classList.add('active');
  }

  function markCurrentPageActive(explicitFile) {
    var currentFile = explicitFile || location.pathname.split('/').pop().split('?')[0];
    if (!currentFile) return;
    if (currentFile === 'department-section.html') {
      var params = new URLSearchParams(location.search);
      var group = params.get('group') || '';
      var section = params.get('section') || '';
      var exact = document.querySelector('.prod-sub-item[data-dept-group="' + group + '"][data-dept-section="' + section + '"]');
      if (exact) {
        var exactWrap = exact.closest('.prod-tab-submenu-wrap');
        if (exactWrap) {
          exactWrap.classList.add('open');
          syncSidebarMenuA11y();
        }
        addActiveDot(exact);
        return;
      }
    }
    // Use attribute selector — most reliable, no quote-matching required
    var sel = '.prod-tab[onclick*="' + currentFile + '"], .prod-sub-item[onclick*="' + currentFile + '"]';
    var found = document.querySelector(sel);
    if (found) {
      var wrap = found.closest('.prod-tab-submenu-wrap');
      if (wrap) {
        wrap.classList.add('open');
        syncSidebarMenuA11y();
      }
      addActiveDot(found);
      return;
    }
    // Fallback: iterate (handles edge cases where attribute selector might not match)
    document.querySelectorAll('.prod-tab, .prod-sub-item').forEach(function (el) {
      var onclick = el.getAttribute('onclick') || '';
      if (onclick.indexOf(currentFile) !== -1) addActiveDot(el);
    });
  }


})();
