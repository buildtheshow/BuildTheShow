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

  // ── Group state ──────────────────────────────────────────────────────────

  const ALL_GROUPS = ['overview', 'plan', 'cast', 'departments', 'promote', 'ticketing', 'volunteers', 'financials', 'wrapup', 'settings', 'build'];

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

  function syncSidebarMenuA11y() {
    ['auditions', 'registration', 'casting', 'marketing', 'budget'].forEach(function (section) {
      const wrap = document.getElementById(section + '-wrap');
      const parent = document.getElementById(section + '-parent-tab');
      const chevron = parent ? parent.querySelector('.tab-chevron') : null;
      const expanded = wrap && wrap.classList.contains('open') ? 'true' : 'false';
      if (parent) parent.setAttribute('aria-expanded', expanded);
      if (chevron) chevron.setAttribute('aria-expanded', expanded);
    });
  }

  function openSubmenu(section) {
    ['auditions-wrap', 'registration-wrap', 'casting-wrap', 'marketing-wrap', 'budget-wrap'].forEach(function (id) {
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

  window.handleSidebarChevronKey = function (e, section) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const fn = { auditions: window.toggleAuditionsMenu, registration: window.toggleRegistrationMenu, casting: window.toggleCastingMenu, marketing: window.toggleMarketingMenu, budget: window.toggleBudgetMenu }[section];
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

  window.loadProductionSidebar = function (activeGroup) {
    const key = 'bts-prod-sidebar-v16';
    const cached = sessionStorage.getItem(key);
    const host = document.getElementById('prod-sidebar-host');
    if (!host) return;

    function applyAndInit(html) {
      host.innerHTML = html;
      window.enhanceSidebarNavControls(host);
      if (activeGroup) window.openSidebarGroup(activeGroup);
    }

    if (cached) applyAndInit(cached);

    fetch('/SHARED/Navigation/production-sidebar.html?v=sidebar-v42-20260605')
      .then(function (res) { return res.text(); })
      .then(function (html) {
        sessionStorage.setItem(key, html);
        if (!cached) applyAndInit(html);
      })
      .catch(function () {});
  };

})();
