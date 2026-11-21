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
    s.href = '/ASSETS/styles/member-sidebar.css?v=20261121-nav-icons';
    document.head.appendChild(s);
  }

  // ── Position sub-navigation definitions ─────────────────────────
  //    Matches the spec: Dashboard, then tools for that position.
  const PERFORMER_SUBNAV = [
    { label: 'Dashboard',    href: '/member/performer',   key: 'performer-hub' },
    { label: 'Auditions',    href: '/find',         key: 'find-auditions' },
    { label: 'Applications', href: '/member/applications',    key: 'applications' },
    { label: 'Schedule',     href: '/member/calendar', key: 'calendar' },
    { label: 'Media',        href: '/member/media', key: 'performer-media' },
  ];

  const CREATIVE_SUBNAV = [
    { label: 'Dashboard', href: '/member/creative',   key: 'creative-hub' },
    { label: 'Tasks',     href: '/member/creative/tasks', key: 'creative-tasks' },
    { label: 'Files',     href: '/member/creative/files', key: 'creative-files' },
  ];

  const VOLUNTEER_SUBNAV = [
    { label: 'Volunteer activities', href: '/member/activities?tab=shifts',              key: 'volunteer-hub' },
    { label: 'Opportunities',   href: '/volunteers',                    key: 'find-volunteer' },
    { label: 'Assigned Shifts', href: '/member/volunteer/shifts',          key: 'volunteer-shifts' },
    { label: 'Availability',    href: '/volunteer-quiz',                   key: 'volunteer-best-fit' },
    { label: 'Hours',           href: '/member/volunteer/hours',           key: 'volunteer-hours' },
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
  const navIcons={'My Home':'navoverview.svg','My Activities':'Performer.svg','My Profile':'performer2.svg','My Circle':'Home.svg','Settings':'navsettings.svg'};
  function navLink(href, label, isActive) {
    return `<a href="${href}" class="sidebar-nav-item${isActive ? ' active' : ''}"${isActive ? ' aria-current="page"' : ''}>
      ${navIcons[label]?`<img class="sidebar-nav-icon" src="/ASSETS/Images/Icons/${navIcons[label]}" alt="" aria-hidden="true">`:""}<span>${label}</span>
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
  let activeSidebarPage;
  let contextHydrationStarted=false;
  function renderMemberSidebar(activePage) {
    activeSidebarPage = activePage;
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
    nav += navLink('/member/home', 'My Home', activePage === 'profile-select');
    nav += navLink('/member/activities', 'My Activities', ['activities','calendar'].includes(activePage));
    let memberContext={};try{memberContext=JSON.parse(sessionStorage.getItem('bts_member_context')||'{}');}catch{}
    const ownProfile=memberContext.own_profile_id;
    nav += navLink(profileId?'/member/profiles/'+encodeURIComponent(profileId)+'/edit':ownProfile?'/member/profiles/'+encodeURIComponent(ownProfile)+'/edit':'/member/profiles', 'My Profile', ['profiles','performer-hub'].includes(activePage));
    if(memberContext.circle_count>0)nav += navLink('/member/circles','My Circle',activePage==='circles'||activePage==='households');

    // Settings — always visible
    nav += navLink('/member/settings', 'Settings', activePage === 'settings');

    // ── Inject nav ──
    const navEl = document.querySelector('.sidebar-nav');
    if (navEl) navEl.innerHTML = nav;

    // The switcher always opens the profile picker, never the account home alias.
    const switcher = document.getElementById('sidebar-profile-switcher');
    if (switcher) switcher.href = '/member/profiles';
    // ── Profile switcher ──
    updateProfileSwitcher(profileName, profileId);
    if(!contextHydrationStarted&&!['settings','profile-select','activities','circles','households'].includes(activePage)&&typeof sb!=='undefined'){contextHydrationStarted=true;loadMemberSidebarProfile(sb).catch(()=>{});}

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
              if (numEl && !numEl.textContent && !sessionStorage.getItem('bts_active_profile_id')) numEl.textContent = 'Account ID: ' + data.display_id;
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
      const customId = sessionStorage.getItem('bts_active_profile_custom_id');
      const accountId = sessionStorage.getItem('bts_user_display_id');
      numEl.textContent = profileId ? (customId ? 'Profile ID: ' + customId : '') : (accountId ? 'Account ID: ' + accountId : '');
    }
  }

  // Resolve display context from authorised data, not a name left by a previous login.
  async function loadMemberSidebarProfile(client, profiles, circleSnapshot) {
    const {data: auth, error: authError} = await client.auth.getUser();
    if (authError || !auth?.user) return;
    const user = auth.user;
    if (!profiles || !circleSnapshot) {
      const result = await client.rpc('bts_circle', {p_action:'snapshot', p_data:{}});
      if (result.error) return;
      profiles = result.data?.profiles || [];circleSnapshot=result.data||{};
    }
    const own=profiles.find(profile=>profile.is_subject&&profile.can_manage);
    sessionStorage.setItem('bts_member_context',JSON.stringify({user_id:user.id,own_profile_id:own?.id||null,circle_count:(circleSnapshot.circles||circleSnapshot.households||[]).length}));
    const selectedId = sessionStorage.getItem('bts_active_profile_id');
    const selected = profiles.find(profile => profile.id === selectedId && profile.can_manage)
      || profiles.find(profile => profile.is_subject && profile.can_manage);
    let profileNumber = '';
    if (selected) {
      sessionStorage.setItem('bts_active_profile_id', selected.id);
      sessionStorage.setItem('bts_active_profile_name', selected.name);
      const result = await client.from('profiles').select('id,credit_name,profile_display_id,sections').eq('id', selected.id).maybeSingle();
      const record = !result.error && result.data?.id === selected.id ? result.data : null;
      profileNumber = record?.profile_display_id || '';
      sessionStorage.setItem('bts_active_profile_sections', JSON.stringify(record?.sections || {}));
      sessionStorage.setItem('bts_active_profile_custom_id', profileNumber);
      renderMemberSidebar(activeSidebarPage);
      updateProfileSwitcher(selected.name, selected.id);
    } else {
      for (const key of ['id','name','sections','custom_id']) sessionStorage.removeItem('bts_active_profile_' + key);
      renderMemberSidebar(activeSidebarPage);
      const meta = user.user_metadata || {};
      const name = [meta.first_name,meta.last_name].filter(Boolean).join(' ').trim() || meta.full_name || 'My Profile';
      updateProfileSwitcher(name, null);
    }
    const number = document.getElementById('sidebar-profile-num');
    if (number) {
      number.textContent = profileNumber ? 'Profile ID: ' + profileNumber : '';
      if (!selected) {
        const result = await client.from('member_ids').select('display_id').eq('user_id', user.id).maybeSingle();
        if (!result.error && result.data?.display_id) number.textContent = 'Account ID: ' + result.data.display_id;
      }
    }
    return selected || null;
  }
  window.loadMemberSidebarProfile = loadMemberSidebarProfile;
  // ── Expose globally ──────────────────────────────────────────────
  window.renderMemberSidebar = renderMemberSidebar;

})();
