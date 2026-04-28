/**
 * member-sidebar.js
 * Shared sidebar builder for all member-facing pages.
 * Injects its own CSS so it wins the cascade over any inline page styles.
 *
 * Usage: call renderMemberSidebar('page-key') after DOM is ready.
 */
(function () {

  // ── Inject sidebar CSS (wins cascade as last <style> in <head>) ──
  if (!document.getElementById('member-sidebar-css')) {
    const s = document.createElement('link');
    s.id   = 'member-sidebar-css';
    s.rel  = 'stylesheet';
    s.href = '/ASSETS/Styles (CSS)/member-sidebar.css';
    document.head.appendChild(s);
  }

  // ── Position sub-navigation definitions ─────────────────────────
  //    Matches the spec: Dashboard, then tools for that position.
  const PERFORMER_SUBNAV = [
    { label: 'Dashboard',    href: '../Performer/performer-hub.html',   key: 'performer-hub' },
    { label: 'Auditions',    href: '../../../PUBLIC/find.html',         key: 'find-auditions' },
    { label: 'Applications', href: '../Auditions/applications.html',    key: 'applications' },
    { label: 'Schedule',     href: '../Dashboard/member-calendar.html', key: 'calendar' },
    { label: 'Media',        href: '../Performer/performer-media.html', key: 'performer-media' },
  ];

  const CREATIVE_SUBNAV = [
    { label: 'Dashboard', href: '../../Organisations/Productions/Creative/creative-hub.html',   key: 'creative-hub' },
    { label: 'Tasks',     href: '../../Organisations/Productions/Creative/creative-tasks.html', key: 'creative-tasks' },
    { label: 'Files',     href: '../../Organisations/Productions/Creative/creative-files.html', key: 'creative-files' },
  ];

  const VOLUNTEER_SUBNAV = [
    { label: 'Dashboard',       href: '../Volunteer/volunteer-hub.html',              key: 'volunteer-hub' },
    { label: 'Opportunities',   href: '../../../PUBLIC/find.html?type=volunteer',    key: 'find-volunteer' },
    { label: 'Assigned Shifts', href: '../Volunteer/volunteer-shifts.html',          key: 'volunteer-shifts' },
    { label: 'Availability',    href: '../Volunteer/volunteer-best-fit.html',        key: 'volunteer-best-fit' },
    { label: 'Hours',           href: '../Volunteer/volunteer-hours.html',           key: 'volunteer-hours' },
  ];

  // Which position a given page belongs to (controls which group auto-expands)
  const PAGE_POSITION = {
    'performer-hub':    'performer',
    'applications':     'performer',
    'performer-media':  'performer',
    'creative-hub':     'creative',
    'creative-tasks':   'creative',
    'creative-files':   'creative',
    'volunteer-hub':    'volunteer',
    'volunteer-best-fit': 'volunteer',
    'volunteer-shifts': 'volunteer',
    'volunteer-hours':  'volunteer',
    // 'calendar' is top-level — not scoped to a position
  };

  // ── Escape HTML ──────────────────────────────────────────────────
  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  }

  // ── Build a plain nav link ───────────────────────────────────────
  function navLink(href, label, isActive) {
    return `<a href="${href}" class="sidebar-nav-item${isActive ? ' active' : ''}"${isActive ? ' aria-current="page"' : ''}>
      ${label}
    </a>`;
  }

  // ── Build a position group with expandable subnav ────────────────
  function positionGroup(label, subnav, isOpen, activePage) {
    const hub = subnav[0].href;
    const subLinksHTML = subnav.map(s => {
      const isSubActive = s.key === activePage;
      return `<a href="${s.href}" class="sidebar-subnav-item${isSubActive ? ' active' : ''}">${s.label}</a>`;
    }).join('');

    return `<div class="sidebar-position-group${isOpen ? ' open' : ''}">
      <a href="${hub}" class="sidebar-nav-item sidebar-position-trigger${isOpen ? ' open-parent' : ''}">
        ${label}
      </a>
      <div class="sidebar-subnav${isOpen ? ' open' : ''}">
        ${subLinksHTML}
      </div>
    </div>`;
  }

  // ── Main sidebar builder ─────────────────────────────────────────
  function renderMemberSidebar(activePage) {
    // Read active profile context
    const profileId   = sessionStorage.getItem('bts_active_profile_id');
    const profileName = sessionStorage.getItem('bts_active_profile_name') || 'My Profile';

    let sections = {};
    try {
      sections = JSON.parse(sessionStorage.getItem('bts_active_profile_sections') || '{}');
    } catch (_) {}

    const isPerformer = !!sections?.performer?.enabled;
    const isVolunteer = !!sections?.volunteer?.enabled;
    const isCreative  = !!sections?.creative?.enabled;

    const activePosition = PAGE_POSITION[activePage] || null;

    // ── Build nav HTML ──
    let nav = '';

    // Dashboard — always visible
    nav += navLink('../Profiles/profile-select.html', 'Dashboard', activePage === 'profile-select');

    // Position groups — only if enabled on selected profile
    if (isPerformer) {
      nav += positionGroup('Performer', PERFORMER_SUBNAV, activePosition === 'performer', activePage);
    }
    if (isCreative) {
      nav += positionGroup('Creative Team', CREATIVE_SUBNAV, activePosition === 'creative', activePage);
    }
    if (isVolunteer) {
      nav += positionGroup('Volunteer', VOLUNTEER_SUBNAV, activePosition === 'volunteer', activePage);
    }

    // Calendar — always visible, top-level (not scoped to a position)
    nav += navLink('../Dashboard/member-calendar.html', 'Calendar', activePage === 'calendar');

    // Settings — always visible
    nav += navLink('../Performer/performer-settings.html', 'Settings', activePage === 'settings');

    // ── Inject nav ──
    const navEl = document.querySelector('.sidebar-nav');
    if (navEl) navEl.innerHTML = nav;

    // ── Profile switcher ──
    updateProfileSwitcher(profileName, profileId);

    // ── Fetch BTS ID if not already cached ──
    if (!sessionStorage.getItem('bts_user_display_id') && typeof sb !== 'undefined') {
      sb.auth.getSession().then(({ data: { session } }) => {
        if (!session) return;
        sb.from('member_ids')
          .select('display_id')
          .eq('user_id', session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data?.display_id) {
              sessionStorage.setItem('bts_user_display_id', data.display_id);
              const numEl = document.getElementById('sidebar-profile-num');
              if (numEl && !numEl.textContent) numEl.textContent = data.display_id;
            }
          });
      });
    }

    // ── Toggle behaviour for position groups ──
    document.querySelectorAll('.sidebar-position-trigger').forEach(trigger => {
      trigger.addEventListener('click', function (e) {
        const group = trigger.closest('.sidebar-position-group');
        if (!group) return;
        if (group.classList.contains('open')) return;
        group.classList.toggle('open');
        const subnav = group.querySelector('.sidebar-subnav');
        if (subnav) subnav.classList.toggle('open');
      });
    });
  }

  function updateProfileSwitcher(name, profileId) {
    const nameEl = document.getElementById('sidebar-profile-name');
    if (nameEl) nameEl.textContent = name;

    const topbarName = document.getElementById('topbar-profile-name');
    if (topbarName) topbarName.textContent = name;

    // Inject profile number between name and "Switch profile" hint
    const info = document.querySelector('.sidebar-profile-switcher-info');
    if (info) {
      let numEl = document.getElementById('sidebar-profile-num');
      if (!numEl) {
        numEl = document.createElement('div');
        numEl.id = 'sidebar-profile-num';
        numEl.className = 'sidebar-profile-num';
        const hint = info.querySelector('.sidebar-profile-switcher-hint');
        if (hint) info.insertBefore(numEl, hint);
        else info.appendChild(numEl);
      }
      const customId = sessionStorage.getItem('bts_active_profile_custom_id')
                    || sessionStorage.getItem('bts_user_display_id')
                    || '';
      numEl.textContent = customId;
    }
  }

  // ── Expose globally ──────────────────────────────────────────────
  window.renderMemberSidebar = renderMemberSidebar;

})();
