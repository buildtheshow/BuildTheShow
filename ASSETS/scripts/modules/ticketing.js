// Build The Show: Ticketing Module
// Extracted from production-workspace.html's TICKETING MODULE block so the
// 6 standalone ticketing-*.html pages (Dashboard, Build, Orders, Check-In,
// Reports, Settings) can each load this one shared file instead of carrying
// duplicate logic. Internal function names are kept identical to the
// monolith version so behaviour matches exactly.
//
// Each page calls window.initTicketingPage(subTab) once on load.

(function () {
  'use strict';

  // ── Local dependencies (standalone-page equivalents of monolith globals) ──

  var SB_URL = 'https://tkmaiktxpwqfbgeojbnf.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrbWFpa3R4cHdxZmJnZW9qYm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MzE4MTcsImV4cCI6MjA4OTMwNzgxN30.TkTZBNWUatk3Y6Vmfv1hIRR3DfVjgwauwa76Pf00J_8';
  var sb = supabase.createClient(SB_URL, SB_KEY);
  var prodId = new URLSearchParams(location.search).get('id') || '';

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var toastTimer;
  function showToast(msg, isError) {
    var t = document.getElementById('toast');
    if (!t) return;
    clearTimeout(toastTimer);
    t.textContent = msg;
    t.classList.toggle('toast--error', !!isError);
    t.classList.toggle('toast--success', !isError);
    t.classList.add('visible');
    toastTimer = setTimeout(function () { t.classList.remove('visible'); }, 3000);
  }
  window.showToast = window.showToast || showToast;

  function fitBrandTileTitles(root) {
    root = root || document;
    var LOCKED_ZONE_SELECTORS = [
      '.template-brand-tile-container--header',
      '.template-brand-tile-container--title',
      '.template-brand-tile-container--footer',
    ];
    var MIN_PX = 6;
    var cards = (root.querySelectorAll && root.querySelectorAll('.template-brand-card:not(.template-brand-card--empty)')) || [];
    cards.forEach(function (card) {
      LOCKED_ZONE_SELECTORS.forEach(function (selector) {
        var zone = card.querySelector(selector);
        var el = zone && zone.firstElementChild;
        if (!zone || !el) return;
        el.style.fontSize = '';
        el.style.whiteSpace = 'normal';
        if (!zone.clientWidth || !zone.clientHeight) return;
        var defaultSize = parseFloat(getComputedStyle(el).fontSize) || 24;
        var fits = function (size) {
          el.style.fontSize = size + 'px';
          return el.scrollHeight <= zone.clientHeight + 1 && el.scrollWidth <= zone.clientWidth + 1;
        };

        if (selector.indexOf('--title') !== -1) {
          var lo = MIN_PX;
          var hi = Math.max(defaultSize, zone.clientHeight * 1.55);
          for (var attempts = 0; attempts < 24; attempts++) {
            var mid = (lo + hi) / 2;
            if (fits(mid)) lo = mid;
            else hi = mid;
          }
          el.style.fontSize = lo + 'px';
          return;
        }

        var size = defaultSize;
        var tries = 0;
        while (tries < 72 && size > MIN_PX && !fits(size)) {
          size = Math.max(size - 0.5, MIN_PX);
          tries++;
        }
      });
    });
  }

  function loadScriptOnce(src) {
    if (!window._btsLoadedScripts) window._btsLoadedScripts = new Set();
    if (window._btsLoadedScripts.has(src)) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { window._btsLoadedScripts.add(src); resolve(); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // ██  TICKETING MODULE
  // ══════════════════════════════════════════════════════════════

  let _tixSetup = {};
  let _tixEvents = [];
  let _tixVenue = null;
  let _tixBuildStep = 'seating';
  let _tixWizardOpen = false;
  let _tixWizardStep = 'seating';

  const TICKETING_STEPS = [
    { key: 'seating',      label: 'Seating',      sub: 'Festival or reserved' },
    { key: 'performances', label: 'Performances', sub: 'Which shows?' },
    { key: 'types',        label: 'Ticket Types', sub: 'Set your prices' },
    { key: 'discounts',    label: 'Discounts',    sub: 'Deals & comps' },
    { key: 'blocks',       label: 'Holds',        sub: 'Reserve tickets' },
  ];

  const TICKETING_HEROES = {
    dashboard:    ['Dashboard', 'How are your ticket sales going? Sales, revenue, and occupancy at a glance.'],
    build:        ['Build Ticket Sales', 'See what the ticket wizard does, then answer the setup questions in one simple popup.'],
    orders:       ['Orders', 'Manage purchases, transfers, and refunds.'],
    checkin:      ['Check-In', 'Scan tickets and track attendance at the door.'],
    reports:      ['Reports', 'Sales, occupancy, revenue, and export data.'],
    settings:     ['Settings', 'Global ticketing preferences for this production.'],
  };
  window.TICKETING_HEROES = TICKETING_HEROES;

  const TICKETING_STEP_META = {
    venue: {
      icon: '/ASSETS/Images/Icons/Location1.svg',
      kicker: 'Venue',
      title: 'Where does your show take place?',
      copy: 'Add the venue name, address, and seating capacity. You can update this later.',
    },
    seating: {
      icon: '/ASSETS/Images/Icons/seats.svg',
      kicker: 'Question 1',
      title: 'How should people choose seats?',
      copy: 'Pick the simplest seating style for this production. You can use open seating or assigned seats.',
    },
    performances: {
      icon: '/ASSETS/Images/Icons/Rehearsals.svg',
      kicker: 'Question 2',
      title: 'Which performances are ticketed?',
      copy: 'We will pull your performance dates from the calendar and ask if dress rehearsal should be included.',
    },
    types: {
      icon: '/ASSETS/Images/Icons/page-tickets.svg',
      kicker: 'Question 3',
      title: 'What ticket prices do you need?',
      copy: 'Add the ticket types your audience will actually see at checkout, like Adult, Child, or Senior.',
    },
    discounts: {
      icon: '/ASSETS/Images/Icons/Budgeting-Fundraising.svg',
      kicker: 'Question 4',
      title: 'Are there any discounts or comps?',
      copy: 'If you need promo codes or complimentary tickets, add them here. Otherwise we skip it.',
    },
    blocks: {
      icon: '/ASSETS/Images/Icons/locked.svg',
      kicker: 'Question 5',
      title: 'Are you holding any tickets back?',
      copy: 'Reserve tickets for schools, sponsors, or invited guests before the public sale opens.',
    },
  };

  async function loadTicketingData(subTab) {
    try {
      const [setupRes, eventsRes] = await Promise.all([
        sb.from('productions').select('ticketing_setup').eq('id', prodId).single(),
        sb.from('production_events').select('id,title,event_type,start_time,end_time,venue,notes').eq('production_id', prodId).in('event_type', ['performance', 'dress']).order('start_time', { ascending: true }),
      ]);
      _tixSetup = setupRes.data?.ticketing_setup || {};
      _tixEvents = eventsRes.data || [];
      _tixVenue = null;
      if (_tixSetup.venue_id) {
        const { data: venueRow } = await sb.from('venues').select('id,name,address,capacity').eq('id', _tixSetup.venue_id).single();
        _tixVenue = venueRow || null;
      }
    } catch (e) {
      console.warn('[BTS] ticketing data load error:', e?.message);
      _tixSetup = {};
      _tixEvents = [];
      _tixVenue = null;
    }
    renderTicketingPanel(subTab || 'dashboard');
  }

  async function saveTicketingSetup() {
    const { error } = await sb.from('productions').update({ ticketing_setup: _tixSetup }).eq('id', prodId);
    if (error) console.warn('[BTS] ticketing save error:', error.message);
  }

  function updateTicketingHero(sub) {
    const h = TICKETING_HEROES[sub] || TICKETING_HEROES.dashboard;
    const title = document.getElementById('tix-hero-title');
    const copy = document.getElementById('tix-hero-copy');
    const actions = document.getElementById('tix-hero-actions');
    if (title) title.textContent = h[0];
    if (copy) copy.textContent = h[1];
    if (actions) actions.innerHTML = '';
    updateTicketingStatusStrip();
  }

  function updateTicketingStatusStrip() {
    const strip = document.getElementById('tkt-status-strip');
    if (!strip || typeof strip.update !== 'function') return;
    strip.style.display = '';
    if (!strip.dataset.tktEventsBound) {
      strip.addEventListener('audition-status-toggle', async () => {
        const isLive = _tixSetup.status === 'live';
        _tixSetup.status = isLive ? 'draft' : 'live';
        await saveTicketingSetup();
        try {
          const { data: prodRow } = await sb.from('productions').select('registration_settings').eq('id', prodId).single();
          const settings = prodRow?.registration_settings || {};
          settings.ticketing_published = _tixSetup.status === 'live';
          await sb.from('productions').update({ registration_settings: settings }).eq('id', prodId);
        } catch (_) {}
        updateTicketingStatusStrip();
        showToast(_tixSetup.status === 'live' ? 'Ticket sales are now live.' : 'Ticket sales paused.');
      });
      strip.dataset.tktEventsBound = 'true';
    }
    const isLive = _tixSetup.status === 'live';
    strip.update({
      state: isLive ? 'live' : 'hidden',
      title: isLive ? 'Ticket sales are live' : 'Ticket sales not published',
      subtitle: '',
      showView: false,
      showCopy: false,
      showToggle: true,
      toggleLabel: isLive ? 'Pause Sales' : 'Go Live',
    });
  }

  function tixSwitchBuildStep(step) {
    _tixBuildStep = step || 'seating';
    renderTicketingPanel('build');
  }

  function renderTicketingPanel(subTab) {
    updateTicketingHero(subTab);
    const container = document.getElementById('ticketing-content');
    if (!container) return;

    let bodyHtml = '';
    switch (subTab) {
      case 'build': {
        bodyHtml = renderTixBuildHome();
        break;
      }
      case 'dashboard': bodyHtml = '<div id="tix-dashboard-root"><div class="loading">Loading dashboard...</div></div>'; break;
      case 'orders':    bodyHtml = renderTixManagement('Orders will appear here once tickets are on sale.'); break;
      case 'checkin':   bodyHtml = renderTixManagement('Check-in tools will be available on performance days.'); break;
      case 'reports':   bodyHtml = renderTixManagement('Reports will generate once you have ticket sales data.'); break;
      case 'settings':  bodyHtml = renderTixManagement('Global ticketing preferences will be available here.'); break;
      default:          bodyHtml = '<div id="tix-dashboard-root"><div class="loading">Loading dashboard...</div></div>'; subTab = 'dashboard'; break;
    }

    const isManagement = ['orders','checkin','reports','settings'].includes(subTab);
    container.innerHTML = isManagement ? bodyHtml : `<div class="vol-plan">${bodyHtml}</div>`;
    if (subTab === 'build') {
      if (_tixWizardOpen) {
        requestAnimationFrame(() => renderTixWizardModal());
      } else {
        closeTixWizard(true);
      }
    }
    if (subTab === 'dashboard') {
      renderTixDashboard().then(html => {
        const root = document.getElementById('tix-dashboard-root');
        if (root) {
          root.innerHTML = html;
          requestAnimationFrame(() => requestAnimationFrame(() => { try { fitBrandTileTitles(root); } catch (_) {} }));
        }
      }).catch(e => {
        console.warn('[BTS] ticketing dashboard render error:', e?.message);
        const root = document.getElementById('tix-dashboard-root');
        if (root) root.innerHTML = '<div style="text-align:center;padding:3rem 1.5rem;color:rgba(26,21,48,0.45);font-size:0.88rem;font-weight:600;">Could not load the ticketing dashboard. Try refreshing the page.</div>';
      });
    }
  }

  function renderTixManagement(message) {
    return `<div style="background:#fff;border:1px solid rgba(87,46,136,0.1);border-radius:16px;padding:3rem 2rem;text-align:center;box-shadow:0 2px 12px rgba(87,46,136,0.06);margin-top:0.5rem;"><p style="font-size:0.9rem;color:#6b5f8a;line-height:1.6;max-width:42ch;margin:0 auto;">${esc(message)}</p></div>`;
  }

  const TICKETING_SETUP_PROGRESS = [
    { key: 'created',      label: 'Production Created' },
    { key: 'venue',        label: 'Venue' },
    { key: 'seating',      label: 'Seating Layout' },
    { key: 'performances', label: 'Performances' },
    { key: 'types',        label: 'Ticket Types' },
    { key: 'pricing',      label: 'Pricing' },
    { key: 'checkout',     label: 'Checkout' },
    { key: 'payments',     label: 'Payments' },
    { key: 'testpurchase', label: 'Test Purchase' },
    { key: 'publish',      label: 'Publish' },
  ];

  const TICKETING_QUICK_ACTIONS = [
    { key: 'venue',        icon: '/ASSETS/Images/Icons/Location1.svg',      title: 'Venue',             copy: 'Add where your show takes place.' },
    { key: 'seating',      icon: '/ASSETS/Images/Icons/seats.svg',          title: 'Seating Layout',    copy: 'Build your seating layout.' },
    { key: 'performances', icon: '/ASSETS/Images/Icons/navproductioncalendar.svg', title: 'Performances', copy: 'Add dates and times.' },
    { key: 'types',        icon: '/ASSETS/Images/Icons/page-tickets.svg',   title: 'Ticket Types',      copy: 'Adult, Child, Senior, VIP, etc.' },
    { key: 'pricing',      icon: '/ASSETS/Images/Icons/Budgeting-tickets.svg', title: 'Pricing',        copy: 'Set prices inside Ticket Types.', linksTo: 'types' },
    { key: 'checkout',     icon: '/ASSETS/Images/Icons/Budgeting-Receipts.svg', title: 'Checkout',      copy: 'Refunds, transfers, confirmations.', comingSoon: true },
    { key: 'payments',     icon: '/ASSETS/Images/Icons/Square.svg',         title: 'Payments',          copy: 'Connect Stripe or Square.', comingSoon: true },
    { key: 'publish',      icon: '/ASSETS/Images/Icons/portal.svg',         title: 'Public Ticket Page', copy: 'Make tickets available.' },
  ];

  function tixSetupStepDone(key) {
    const setup = _tixSetup;
    switch (key) {
      case 'created': return true;
      case 'venue': return !!setup.venue_id;
      case 'seating': return !!setup.seating_style;
      case 'performances': return (_tixEvents || []).some(e => e.event_type === 'performance');
      case 'types': return (setup.ticket_types || []).some(t => (t.name || '').trim());
      case 'pricing': return (setup.ticket_types || []).some(t => t.price !== undefined && t.price !== null && t.price !== '');
      case 'publish': return setup.status === 'live';
      default: return false;
    }
  }

  function tixWizardStepContent(step) {
    switch (step) {
      case 'venue': return renderTixStepVenue();
      case 'seating': return renderTixStepSeating();
      case 'performances': return renderTixStepPerformances();
      case 'types': return renderTixStepTypes();
      case 'discounts': return renderTixStepDiscounts();
      case 'blocks': return renderTixStepBlocks();
      default: return renderTixStepSeating();
    }
  }

  function renderTixInlineStepPanel() {
    const current = _tixBuildStep || 'seating';
    const meta = TICKETING_STEP_META[current] || TICKETING_STEP_META.seating;
    return `
      <div class="tix-inline-panel" style="margin-top:1rem;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;">
          <div style="display:flex;gap:0.85rem;align-items:flex-start;">
            <img src="${esc(meta.icon)}" alt="" style="width:38px;height:38px;padding:0.45rem;border-radius:12px;background:rgba(87,46,136,0.08);flex-shrink:0;" />
            <div>
              <div style="font-size:0.7rem;font-weight:900;color:#572e88;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.15rem;">Build it yourself</div>
              <div style="font-size:1rem;font-weight:900;color:#1a1530;margin-bottom:0.18rem;">${esc(meta.title)}</div>
              <div style="font-size:0.77rem;line-height:1.45;color:rgba(26,21,48,0.56);">${esc(meta.copy)}</div>
            </div>
          </div>
          <button type="button" class="btn-secondary" style="font-size:0.75rem;" onclick="openTixWizard('${esc(current)}')">Use Wizard For This Instead</button>
        </div>
        ${tixWizardStepContent(current)}
      </div>`;
  }

  function tixSummarizeStep(stepKey) {
    const setup = _tixSetup || {};
    switch (stepKey) {
      case 'venue':
        return _tixVenue?.name ? `${_tixVenue.name}.` : 'Add where your show takes place.';
      case 'pricing': {
        const priced = (setup.ticket_types || []).filter(t => t.price !== undefined && t.price !== null && t.price !== '');
        return priced.length ? `${priced.length} ticket type${priced.length === 1 ? '' : 's'} priced.` : 'Set prices inside Ticket Types.';
      }
      case 'seating':
        if (setup.seating_style === 'reserved') return 'Reserved seating selected.';
        if (setup.seating_style === 'festival') return 'Festival seating selected.';
        return 'Choose festival or reserved seating.';
      case 'performances': {
        const perfCount = (_tixEvents || []).filter(e => e.event_type === 'performance').length;
        const dressCount = (_tixEvents || []).filter(e => e.event_type === 'dress').length;
        if (!perfCount && !dressCount) return 'Pull in your performance dates from the calendar.';
        return `${perfCount} performance${perfCount === 1 ? '' : 's'}${setup.dress_ticketed && dressCount ? ' plus dress rehearsal tickets' : ''}.`;
      }
      case 'types': {
        const types = (setup.ticket_types || []).filter(t => (t.name || '').trim());
        return types.length ? `${types.length} ticket type${types.length === 1 ? '' : 's'} ready.` : 'Add the prices people can buy.';
      }
      case 'discounts': {
        if (!setup.discounts_enabled) return 'No discounts or comps.';
        const discounts = (setup.discounts || []).length;
        const comps = (setup.comps || []).length;
        return `${discounts} discount code${discounts === 1 ? '' : 's'}, ${comps} comp group${comps === 1 ? '' : 's'}.`;
      }
      case 'blocks': {
        if (!setup.reserved_blocks_enabled) return 'No held tickets.';
        const blocks = (setup.reserved_blocks || []).length;
        return `${blocks} held ticket group${blocks === 1 ? '' : 's'}.`;
      }
      default:
        return '';
    }
  }

  function renderTixSetupStepper() {
    const firstNotDone = TICKETING_SETUP_PROGRESS.find(s => !tixSetupStepDone(s.key));
    return `
      <div class="aud-dashboard-cards" style="margin-bottom:1rem;">
        <div class="aud-dashboard-cards-head">
          <div class="aud-dashboard-cards-title">Your Setup Progress</div>
        </div>
        <div class="tix-setup-stepper">
          ${TICKETING_SETUP_PROGRESS.map((s, idx) => {
            const done = tixSetupStepDone(s.key);
            const active = !done && firstNotDone && firstNotDone.key === s.key;
            return `
              <div class="tix-setup-step ${done ? 'done' : ''} ${active ? 'active' : ''}">
                <div class="tix-setup-step-circle">${done ? '&#10003;' : idx + 1}</div>
                <div class="tix-setup-step-label">${esc(s.label)}</div>
                <div class="tix-setup-step-sub">${done ? 'Done' : active ? 'In progress' : ''}</div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function renderTixQuickActions() {
    return `
      <div class="aud-dashboard-cards" style="margin-bottom:1rem;">
        <div class="aud-dashboard-cards-head">
          <div class="aud-dashboard-cards-title">Quick Actions</div>
        </div>
        <div class="tix-wizard-grid">
          ${TICKETING_QUICK_ACTIONS.map(action => {
            if (action.comingSoon) {
              return `
                <div class="tix-wizard-card coming-soon">
                  <div class="tix-wizard-card-top">
                    <img src="${esc(action.icon)}" alt="" class="tix-wizard-card-icon" />
                    <span class="tix-wizard-status coming-soon">Coming soon</span>
                  </div>
                  <h3>${esc(action.title)}</h3>
                  <p>${esc(action.copy)}</p>
                </div>`;
            }
            const done = tixSetupStepDone(action.key);
            const openKey = action.linksTo || action.key;
            const summary = tixSummarizeStep(action.key);
            const lineHtml = summary && summary !== action.copy ? esc(summary) : esc(action.copy);
            return `
              <div class="tix-wizard-card">
                <div class="tix-wizard-card-top">
                  <img src="${esc(action.icon)}" alt="" class="tix-wizard-card-icon" />
                  <span class="tix-wizard-status ${done ? 'done' : ''}">${done ? 'Ready' : 'Not started'}</span>
                </div>
                <h3>${esc(action.title)}</h3>
                <p>${lineHtml}</p>
                <button type="button" class="tix-wizard-edit" onclick="${action.key === 'publish' ? 'tixPromptPublish()' : `tixSwitchBuildStep('${esc(openKey)}')`}">${done ? 'Open' : 'Set this up'}</button>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function tixPromptPublish() {
    showToast('Use the Go Live toggle in the top right to publish your ticket page.');
  }

  function renderTixSalesSnapshot() {
    const setup = _tixSetup || {};
    const isLive = setup.status === 'live';
    const perfCount = (_tixEvents || []).filter(e => e.event_type === 'performance').length;
    const rows = [
      { icon: '/ASSETS/Images/Icons/Tickets 2.svg', label: 'Tickets live', value: isLive ? 'Yes' : 'No', positive: isLive },
      { icon: '/ASSETS/Images/Icons/Location1.svg', label: 'Venue', value: _tixVenue?.name || 'Not selected', positive: !!_tixVenue },
      { icon: '/ASSETS/Images/Icons/navproductioncalendar.svg', label: 'Performances', value: String(perfCount), positive: perfCount > 0 },
      { icon: '/ASSETS/Images/Icons/seats.svg', label: 'Capacity', value: _tixVenue?.capacity ? String(_tixVenue.capacity) : '—', positive: !!_tixVenue?.capacity },
      { icon: '/ASSETS/Images/Icons/Square.svg', label: 'Square', value: 'Not connected', positive: false },
      { icon: '/ASSETS/Images/Icons/portal.svg', label: 'Public ticket page', value: isLive ? 'Published' : 'Not published', positive: isLive },
    ];
    return `
      <div class="aud-dashboard-cards" style="margin-bottom:1rem;">
        <div class="aud-dashboard-cards-head">
          <div class="aud-dashboard-cards-title">Sales Snapshot</div>
        </div>
        ${rows.map(r => `
          <div class="tix-side-card-row">
            <span class="tix-side-card-label"><img src="${esc(r.icon)}" alt="" />${esc(r.label)}</span>
            <span class="tix-side-card-value ${r.positive ? 'positive' : ''}">${esc(r.value)}</span>
          </div>`).join('')}
        <div style="margin-top:0.75rem;">
          <button type="button" class="aud-dashboard-cards-link" onclick="navigateToTicketing('dashboard')">View all settings &rarr;</button>
        </div>
      </div>`;
  }

  function renderTixPromoCard(hasStarted) {
    return `
      <div class="tix-promo-card" style="margin-bottom:1rem;">
        <img src="/ASSETS/Images/Icons/page-tickets.svg" alt="" />
        <div class="tix-promo-card-title">Never sold tickets before?</div>
        <div class="tix-promo-card-copy">The wizard will guide you through everything step by step. Estimated setup: 20-30 minutes.</div>
        <button type="button" class="btn-primary" style="font-size:0.78rem;" onclick="openTixWizard()">${hasStarted ? 'Continue Wizard' : 'Start Ticket Wizard'} &rarr;</button>
      </div>`;
  }

  function renderTixRecentActivity() {
    return `
      <div class="aud-dashboard-cards">
        <div class="aud-dashboard-cards-head">
          <div class="aud-dashboard-cards-title">Recent Activity</div>
        </div>
        <div style="text-align:center;padding:1.25rem 0.5rem;color:rgba(26,21,48,0.4);font-size:0.78rem;">No activity yet. Updates will show here once you start setting up ticket sales.</div>
      </div>`;
  }

  function renderTixFeatureList() {
    const features = [
      { icon: '/ASSETS/Images/Icons/informationseat.svg', label: 'Assigned seating' },
      { icon: '/ASSETS/Images/Icons/seats.svg', label: 'General admission' },
      { icon: '/ASSETS/Images/Icons/navproductioncalendar.svg', label: 'Multiple performances' },
      { icon: '/ASSETS/Images/Icons/accessible.svg', label: 'Accessible seating' },
      { icon: '/ASSETS/Images/Icons/locked.svg', label: 'Reserved blocks' },
      { icon: '/ASSETS/Images/Icons/Budgeting-Fundraising.svg', label: 'Promo codes' },
    ];
    return `
      <div class="aud-dashboard-cards" style="margin-top:1rem;">
        <div class="aud-dashboard-cards-head">
          <div class="aud-dashboard-cards-title">Things You Can Do With Build The Show Ticketing</div>
        </div>
        <div class="tix-feature-grid">
          ${features.map(f => `<div class="tix-feature-item"><img src="${esc(f.icon)}" alt="" /><span>${esc(f.label)}</span></div>`).join('')}
        </div>
      </div>`;
  }

  function renderTixBuildHome() {
    const completed = _tixSetup.completed_steps || [];
    const hasStarted = completed.length > 0 || (_tixSetup.ticket_types || []).length || _tixSetup.seating_style;
    return `
      <div class="tix-build-home">
        <div class="tix-build-actions" style="margin-bottom:1.25rem;">
          <button type="button" class="btn-primary" onclick="openTixWizard()">${hasStarted ? 'Continue Wizard' : 'Start Ticket Wizard'} <span class="tix-wizard-status" style="margin-left:0.4rem;background:rgba(255,255,255,0.25);color:#fff;">Recommended</span></button>
          <button type="button" class="btn-secondary" onclick="tixChooseManualBuild()">Build It Yourself</button>
        </div>
        <div class="tix-build-layout">
          <div>
            ${renderTixSetupStepper()}
            ${renderTixQuickActions()}
            ${renderTixFeatureList()}
          </div>
          <div>
            ${renderTixSalesSnapshot()}
            ${renderTixPromoCard(hasStarted)}
            ${renderTixRecentActivity()}
          </div>
        </div>
        ${!_tixWizardOpen ? `<div id="tix-build-yourself-grid">${renderTixInlineStepPanel()}</div>` : ''}
      </div>`;
  }

  function openTixWizard(step) {
    _tixWizardOpen = true;
    _tixWizardStep = step || _tixWizardStep || 'seating';
    renderTixWizardModal();
  }

  function closeTixWizard(silent) {
    _tixWizardOpen = false;
    const modal = document.getElementById('tix-wizard-modal');
    if (modal) modal.remove();
    if (!silent) showToast('Ticket wizard closed.');
  }

  function tixChooseManualBuild() {
    _tixWizardOpen = false;
    const grid = document.getElementById('tix-build-yourself-grid');
    if (grid && typeof grid.scrollIntoView === 'function') {
      grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    showToast('Build it yourself below, one section at a time.');
  }

  function tixWizardPrev() {
    const idx = TICKETING_STEPS.findIndex(step => step.key === _tixWizardStep);
    if (idx > 0) {
      _tixWizardStep = TICKETING_STEPS[idx - 1].key;
      renderTixWizardModal();
    }
  }

  function tixWizardNext() {
    const idx = TICKETING_STEPS.findIndex(step => step.key === _tixWizardStep);
    if (idx < TICKETING_STEPS.length - 1) {
      _tixWizardStep = TICKETING_STEPS[idx + 1].key;
      renderTixWizardModal();
      return;
    }
    closeTixWizard(true);
    renderTicketingPanel('build');
    showToast('Ticket wizard complete. Review anything you want to change.');
  }

  function renderTixWizardModal() {
    if (!_tixWizardOpen) return;
    const existing = document.getElementById('tix-wizard-modal');
    if (existing) existing.remove();
    const current = _tixWizardStep || 'seating';
    const meta = TICKETING_STEP_META[current] || TICKETING_STEP_META.seating;
    const idx = Math.max(0, TICKETING_STEPS.findIndex(step => step.key === current));
    const modal = document.createElement('div');
    modal.id = 'tix-wizard-modal';
    modal.className = 'tix-wizard-modal';
    modal.onclick = function(e) { if (e.target === modal) closeTixWizard(true); };
    modal.innerHTML = `
      <div class="tix-wizard-dialog" role="dialog" aria-modal="true" aria-labelledby="tix-wizard-title" onclick="event.stopPropagation()">
        <div class="tix-wizard-head">
          <div class="tix-wizard-topline">
            <div class="tix-wizard-head-main">
              <img src="${esc(meta.icon)}" alt="" class="tix-wizard-head-icon" />
              <div>
                <div class="tix-wizard-kicker">${esc(meta.kicker)}</div>
                <div class="tix-wizard-title" id="tix-wizard-title">${esc(meta.title)}</div>
                <div class="tix-wizard-copy">${esc(meta.copy)}</div>
              </div>
            </div>
            <button type="button" class="tix-wizard-close" onclick="closeTixWizard(true)" aria-label="Close ticket wizard">×</button>
          </div>
          <div class="tix-wizard-progress">
            ${TICKETING_STEPS.map((step, stepIdx) => `
              <button type="button" class="tix-wizard-progress-step ${step.key === current ? 'active' : ''}" onclick="openTixWizard('${esc(step.key)}')">
                <strong>${stepIdx + 1}. ${esc(step.label)}</strong>
                <span>${esc(step.sub)}</span>
              </button>`).join('')}
          </div>
        </div>
        <div class="tix-wizard-body">${tixWizardStepContent(current)}</div>
        <div class="tix-wizard-foot">
          <div class="tix-wizard-foot-copy">Simple version: answer the question on this screen, then click next.</div>
          <div class="tix-wizard-foot-actions">
            <button type="button" class="btn-secondary" onclick="tixWizardPrev()" ${idx === 0 ? 'disabled' : ''}>Back</button>
            <button type="button" class="btn-secondary" onclick="closeTixWizard(true)">Close</button>
            <button type="button" class="btn-primary" onclick="tixWizardNext()">${idx === TICKETING_STEPS.length - 1 ? 'Finish Wizard' : 'Next Question'}</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    if (current === 'seating' && _tixSetup.seating_style === 'reserved') {
      requestAnimationFrame(() => tixLoadSeatMapBuilder());
    }
  }

  async function renderTixDashboard() {
    const setup = _tixSetup;
    const isLive = setup.status === 'live';
    const completedSteps = setup.completed_steps || [];
    const totalSteps = TICKETING_STEPS.length;
    const doneCount = completedSteps.length;
    const seatingLabel = setup.seating_style === 'reserved' ? 'Reserved Seating' : setup.seating_style === 'festival' ? 'Festival Seating' : 'Not set';
    const perfEvents = _tixEvents.filter(e => e.event_type === 'performance' || (e.event_type === 'dress' && setup.dress_ticketed));
    const ticketTypes = setup.ticket_types || [];
    const fmtDate = iso => { if (!iso) return ''; const d = new Date(iso); return d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }); };
    const fmtTime = iso => { if (!iso) return ''; const d = new Date(iso); return d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }); };

    let inventoryStats = { total: 0, available: 0, sold: 0, held: 0, blocked: 0 };
    let perfInventory = [];
    if (setup._layout_id && setup.seating_style === 'reserved') {
      try {
        const { data } = await sb.from('performance_seat_inventory').select('performance_id,status').in('performance_id', perfEvents.map(e => e.id));
        if (data) {
          data.forEach(r => {
            inventoryStats.total++;
            if (r.status === 'available') inventoryStats.available++;
            else if (r.status === 'sold') inventoryStats.sold++;
            else if (r.status === 'held') inventoryStats.held++;
            else if (r.status === 'blocked') inventoryStats.blocked++;
          });
          const byPerf = {};
          data.forEach(r => { if (!byPerf[r.performance_id]) byPerf[r.performance_id] = { total: 0, sold: 0, available: 0 }; byPerf[r.performance_id].total++; if (r.status === 'sold') byPerf[r.performance_id].sold++; if (r.status === 'available') byPerf[r.performance_id].available++; });
          perfInventory = perfEvents.map(ev => ({ event: ev, stats: byPerf[ev.id] || { total: 0, sold: 0, available: 0 } }));
        }
      } catch (_) {}
    }

    let ticketCount = 0, orderCount = 0, revenueCents = 0;
    try {
      const { data: tickets } = await sb.from('tickets').select('id,price_cents,order_id').eq('production_id', prodId).eq('status', 'active');
      if (tickets) { ticketCount = tickets.length; revenueCents = tickets.reduce((sum, t) => sum + (t.price_cents || 0), 0); orderCount = new Set(tickets.map(t => t.order_id).filter(Boolean)).size; }
    } catch (_) {}

    const tileRender = window.BTSAuditionTemplates?.renderBrandTileTemplate || function() { return ''; };
    const statsHtml = `
      <div class="vol-status-grid" style="margin-bottom:1.25rem;">
        ${tileRender({ mode: 'metric', variant: 'square', color: '#572e88', ink: '#fff', kicker: 'Ticketing', metricValue: String(ticketCount), metricLabel: 'Tickets Sold' })}
        ${tileRender({ mode: 'metric', variant: 'square', color: '#476aaa', ink: '#fff', kicker: 'Ticketing', metricValue: String(orderCount), metricLabel: 'Orders' })}
        ${tileRender({ mode: 'metric', variant: 'square', color: '#769e7b', ink: '#fff', kicker: 'Ticketing', metricValue: '$' + (revenueCents / 100).toFixed(2), metricLabel: 'Revenue' })}
        ${tileRender({ mode: 'metric', variant: 'square', color: '#dd8233', ink: '#fff', kicker: 'Ticketing', metricValue: String(perfEvents.length), metricLabel: 'Performances' })}
      </div>`;

    const setupProgressHtml = `
      <div class="aud-dashboard-cards">
        <div class="aud-dashboard-cards-head">
          <div class="aud-dashboard-cards-title">Setup Progress</div>
          <span class="${isLive ? 'tix-live-badge' : 'tix-draft-badge'}">${isLive ? 'Live' : 'Draft'}</span>
        </div>
        <div style="display:flex;gap:0.4rem;margin-bottom:0.75rem;">
          ${TICKETING_STEPS.map(s => {
            const done = completedSteps.includes(s.key);
            return `<div style="flex:1;height:6px;border-radius:3px;background:${done ? '#769e7b' : 'rgba(87,46,136,0.08)'};"></div>`;
          }).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:0.72rem;color:rgba(26,21,48,0.5);">${doneCount}/${totalSteps} steps complete</div>
          <button type="button" class="aud-dashboard-cards-link" onclick="navigateToTicketing('build')">Edit Setup</button>
        </div>
      </div>`;

    const perfTableHtml = perfEvents.length ? `
      <div class="aud-dashboard-cards">
        <div class="aud-dashboard-cards-head">
          <div class="aud-dashboard-cards-title">Upcoming Performances</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:0.35rem;">
          ${(perfInventory.length ? perfInventory : perfEvents.map(ev => ({ event: ev, stats: null }))).map(p => {
            const pct = p.stats?.total ? Math.round(p.stats.sold / p.stats.total * 100) : 0;
            return `<div style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0.65rem;border:1px solid rgba(87,46,136,0.06);border-radius:8px;">
              <div style="flex:1;">
                <div style="font-size:0.78rem;font-weight:800;color:#1a1530;">${esc(p.event.title || 'Performance')}</div>
                <div style="font-size:0.68rem;color:rgba(26,21,48,0.45);">${fmtDate(p.event.start_time)} ${fmtTime(p.event.start_time)}</div>
              </div>
              ${p.stats ? `<div style="text-align:right;">
                <div style="font-size:0.78rem;font-weight:900;color:#572e88;">${p.stats.sold}/${p.stats.total}</div>
                <div style="font-size:0.62rem;color:rgba(26,21,48,0.4);">${pct}% sold</div>
              </div>
              <div style="width:60px;height:6px;border-radius:3px;background:rgba(87,46,136,0.08);">
                <div style="width:${pct}%;height:100%;border-radius:3px;background:${pct >= 90 ? '#769e7b' : pct >= 50 ? '#efab45' : '#572e88'};"></div>
              </div>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>` : '';

    const quickInfoHtml = `
      <div class="aud-dashboard-cards">
        <div class="aud-dashboard-cards-head">
          <div class="aud-dashboard-cards-title">Quick Info</div>
          <button type="button" class="aud-dashboard-cards-link" onclick="navigateToTicketing('build')">Edit</button>
        </div>
        <div style="display:grid;gap:0.4rem;">
          <div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:0.35rem 0;border-bottom:1px solid rgba(87,46,136,0.06);">
            <span style="font-weight:700;color:rgba(26,21,48,0.5);">Seating</span><span style="font-weight:800;color:#1a1530;">${esc(seatingLabel)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:0.35rem 0;border-bottom:1px solid rgba(87,46,136,0.06);">
            <span style="font-weight:700;color:rgba(26,21,48,0.5);">Ticket Types</span><span style="font-weight:800;color:#1a1530;">${ticketTypes.length}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:0.35rem 0;border-bottom:1px solid rgba(87,46,136,0.06);">
            <span style="font-weight:700;color:rgba(26,21,48,0.5);">Discounts</span><span style="font-weight:800;color:#1a1530;">${setup.discounts_enabled ? (setup.discounts || []).length + ' codes' : 'None'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:0.35rem 0;">
            <span style="font-weight:700;color:rgba(26,21,48,0.5);">Reserved Blocks</span><span style="font-weight:800;color:#1a1530;">${setup.reserved_blocks_enabled ? (setup.reserved_blocks || []).length + ' groups' : 'None'}</span>
          </div>
        </div>
      </div>`;

    return `
      ${statsHtml}
      <div class="tix-dash-cols">
        <div style="display:flex;flex-direction:column;gap:1rem;">
          ${setupProgressHtml}
          ${quickInfoHtml}
        </div>
        <div style="display:flex;flex-direction:column;gap:1rem;">
          ${perfTableHtml}
        </div>
      </div>`;
  }

  async function tixGoLive() {
    _tixSetup.status = 'live';
    await saveTicketingSetup();
    try {
      const { data: prodRow } = await sb.from('productions').select('registration_settings').eq('id', prodId).single();
      const settings = prodRow?.registration_settings || {};
      settings.ticketing_published = true;
      await sb.from('productions').update({ registration_settings: settings }).eq('id', prodId);
    } catch (_) {}
    showToast('Ticketing is now live.');
    renderTicketingPanel('dashboard');
  }

  // ── Step: Venue ──
  function renderTixStepVenue() {
    const v = _tixVenue || {};
    return `
      <div>
        <div style="display:grid;gap:0.85rem;max-width:480px;">
          <div>
            <label style="display:block;font-size:0.74rem;font-weight:800;color:rgba(26,21,48,0.55);margin-bottom:0.3rem;">Venue name</label>
            <input type="text" id="tix-venue-name" class="form-input" value="${esc(v.name || '')}" placeholder="e.g. Centennial Theatre" />
          </div>
          <div>
            <label style="display:block;font-size:0.74rem;font-weight:800;color:rgba(26,21,48,0.55);margin-bottom:0.3rem;">Address</label>
            <input type="text" id="tix-venue-address" class="form-input" value="${esc(v.address || '')}" placeholder="Street, city, province" />
          </div>
          <div>
            <label style="display:block;font-size:0.74rem;font-weight:800;color:rgba(26,21,48,0.55);margin-bottom:0.3rem;">Seating capacity</label>
            <input type="number" id="tix-venue-capacity" class="form-input" value="${v.capacity || ''}" placeholder="e.g. 250" min="0" />
          </div>
          <div>
            <button type="button" class="btn-primary" onclick="tixSaveVenue()">Save Venue</button>
          </div>
        </div>
      </div>`;
  }

  async function tixSaveVenue() {
    const name = document.getElementById('tix-venue-name')?.value.trim();
    const address = document.getElementById('tix-venue-address')?.value.trim();
    const capacity = parseInt(document.getElementById('tix-venue-capacity')?.value, 10) || 0;
    if (!name) { showToast('Add a venue name first.'); return; }
    try {
      const { data: prodRow } = await sb.from('productions').select('organization_id').eq('id', prodId).single();
      const payload = { organization_id: prodRow?.organization_id, name, address, capacity };
      let venueRow;
      if (_tixSetup.venue_id) {
        const { data, error } = await sb.from('venues').update(payload).eq('id', _tixSetup.venue_id).select().single();
        if (error) throw error;
        venueRow = data;
      } else {
        const { data, error } = await sb.from('venues').insert(payload).select().single();
        if (error) throw error;
        venueRow = data;
      }
      _tixVenue = venueRow;
      _tixSetup.venue_id = venueRow.id;
      await saveTicketingSetup();
      showToast('Venue saved.');
      renderTicketingPanel('build');
    } catch (e) {
      console.warn('[BTS] venue save error:', e?.message);
      showToast('Could not save the venue. Try again.');
    }
  }

  // ── Step 1: Seating Style ──
  function renderTixStepSeating() {
    const current = _tixSetup.seating_style || '';
    const builderHtml = current === 'reserved' ? `
      <div style="margin-top:1.5rem;border-top:1.5px solid rgba(87,46,136,0.1);padding-top:1.25rem;">
        <div id="tix-seatmap-builder"><div class="loading">Loading seat map builder...</div></div>
      </div>` : '';
    return `
      <div>
        <div style="font-size:0.92rem;font-weight:700;color:#1a1530;margin-bottom:1rem;">How will your audience be seated?</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;max-width:560px;">
          <button type="button" class="tix-card-choice ${current === 'festival' ? 'selected' : ''}" onclick="tixSetSeatingStyle('festival')">
            <div class="tix-check">&#10003;</div>
            <div class="tix-card-choice-title">Festival Seating</div>
            <div class="tix-card-choice-sub">Open seating, first come first served. No assigned seats.</div>
          </button>
          <button type="button" class="tix-card-choice ${current === 'reserved' ? 'selected' : ''}" onclick="tixSetSeatingStyle('reserved')">
            <div class="tix-check">&#10003;</div>
            <div class="tix-card-choice-title">Reserved Seating</div>
            <div class="tix-card-choice-sub">Assigned seats with sections and rows.</div>
          </button>
        </div>
        ${builderHtml}
      </div>`;
  }

  function tixLoadSeatMapBuilder() {
    const container = document.getElementById('tix-seatmap-builder');
    if (!container) return;
    loadScriptOnce('/ASSETS/scripts/modules/ticketing-seatmap.js?v=seatmap-20260626')
      .then(() => { if (window.SeatMapBuilder) window.SeatMapBuilder.init(prodId, sb, container); })
      .catch(e => { container.innerHTML = '<div style="color:#b33a25;font-size:0.82rem;">Could not load seat map builder.</div>'; });
  }

  async function tixSetSeatingStyle(style) {
    _tixSetup.seating_style = style;
    if (!_tixSetup.completed_steps) _tixSetup.completed_steps = [];
    if (!_tixSetup.completed_steps.includes('seating')) _tixSetup.completed_steps.push('seating');
    await saveTicketingSetup();
    if (_tixWizardOpen) {
      renderTicketingPanel('build');
    } else {
      renderTicketingPanel('build');
    }
  }

  // ── Step 2: Performances ──
  function renderTixStepPerformances() {
    const perfEvents = _tixEvents.filter(e => e.event_type === 'performance');
    const dressEvents = _tixEvents.filter(e => e.event_type === 'dress');
    const dressTicketed = !!_tixSetup.dress_ticketed;
    const fmtDate = iso => { if (!iso) return ''; const d = new Date(iso); return d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); };
    const fmtTime = iso => { if (!iso) return ''; const d = new Date(iso); return d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }); };

    if (!perfEvents.length && !dressEvents.length) {
      return `<div style="text-align:center;padding:2.5rem 1.5rem;">
        <div style="font-size:0.92rem;font-weight:700;color:#1a1530;margin-bottom:0.5rem;">No performance dates found</div>
        <div style="font-size:0.78rem;color:rgba(26,21,48,0.5);margin-bottom:1rem;">Add performance dates in your production calendar first.</div>
        <button type="button" class="btn-primary" style="font-size:0.82rem;" onclick="location.href='/SYSTEM/Organisations/Productions/Workspace/plan-calendar.html?id='+encodeURIComponent('${esc(prodId)}')">Open Calendar</button>
      </div>`;
    }

    const perfRows = perfEvents.map(ev => `
      <div class="tix-row">
        <div style="flex:1;">
          <div style="font-size:0.82rem;font-weight:800;color:#1a1530;">${esc(ev.title || 'Performance')}</div>
          <div style="font-size:0.72rem;color:rgba(26,21,48,0.5);">${fmtDate(ev.start_time)} ${fmtTime(ev.start_time)} - ${fmtTime(ev.end_time)}</div>
        </div>
        <div style="font-size:0.68rem;font-weight:800;color:#769e7b;text-transform:uppercase;">Ticketed</div>
      </div>`).join('');

    const dressSection = dressEvents.length ? `
      <div style="margin-top:1.25rem;padding:1rem;border:1.5px solid rgba(87,46,136,0.12);border-radius:10px;background:rgba(87,46,136,0.02);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">
          <div style="font-size:0.85rem;font-weight:800;color:#1a1530;">Are you offering tickets to your dress rehearsal?</div>
          <label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer;">
            <input type="checkbox" ${dressTicketed ? 'checked' : ''} onchange="tixToggleDressTickets(this.checked)" style="accent-color:#572e88;width:16px;height:16px;" />
            <span style="font-size:0.75rem;font-weight:700;color:#572e88;">${dressTicketed ? 'Yes' : 'No'}</span>
          </label>
        </div>
        ${dressTicketed ? dressEvents.map(ev => `
          <div class="tix-row" style="background:rgba(239,171,69,0.06);">
            <div style="flex:1;">
              <div style="font-size:0.82rem;font-weight:800;color:#1a1530;">${esc(ev.title || 'Dress Rehearsal')}</div>
              <div style="font-size:0.72rem;color:rgba(26,21,48,0.5);">${fmtDate(ev.start_time)} ${fmtTime(ev.start_time)} - ${fmtTime(ev.end_time)}</div>
            </div>
            <div style="font-size:0.68rem;font-weight:800;color:#efab45;text-transform:uppercase;">Dress</div>
          </div>`).join('') : ''}
      </div>` : '';

    return `
      <div style="max-width:620px;">
        <div style="font-size:0.92rem;font-weight:700;color:#1a1530;margin-bottom:0.75rem;">${perfEvents.length} performance${perfEvents.length === 1 ? '' : 's'} from your calendar</div>
        ${perfRows}
        ${dressSection}
        <div style="display:flex;gap:0.5rem;margin-top:0.75rem;flex-wrap:wrap;">
          <button type="button" class="btn-secondary" style="font-size:0.75rem;" onclick="tixRefreshPerformances()">Refresh from Calendar</button>
          ${_tixSetup._layout_id && _tixSetup.seating_style === 'reserved' ? `<button type="button" class="btn-primary" style="font-size:0.75rem;" onclick="tixGenerateInventory()">Generate Seat Inventory</button>` : ''}
        </div>
      </div>`;
  }

  async function tixToggleDressTickets(val) {
    _tixSetup.dress_ticketed = val;
    if (!_tixSetup.completed_steps) _tixSetup.completed_steps = [];
    if (!_tixSetup.completed_steps.includes('performances')) _tixSetup.completed_steps.push('performances');
    await saveTicketingSetup();
    renderTicketingPanel('build');
  }

  async function tixRefreshPerformances() {
    try {
      const { data } = await sb.from('production_events').select('id,title,event_type,start_time,end_time,venue,notes').eq('production_id', prodId).in('event_type', ['performance', 'dress']).order('start_time', { ascending: true });
      _tixEvents = data || [];
    } catch (_) {}
    if (!_tixSetup.completed_steps) _tixSetup.completed_steps = [];
    if (!_tixSetup.completed_steps.includes('performances')) _tixSetup.completed_steps.push('performances');
    await saveTicketingSetup();
    renderTicketingPanel('build');
  }

  async function tixGenerateInventory() {
    const setup = _tixSetup;
    if (!setup._layout_id) { showToast('Build a seat map first.'); return; }
    const perfEvents = _tixEvents.filter(e => e.event_type === 'performance' || (e.event_type === 'dress' && setup.dress_ticketed));
    if (!perfEvents.length) { showToast('No ticketed performances found.'); return; }
    const { data: seats } = await sb.from('venue_seats').select('id,seat_type').eq('layout_id', setup._layout_id);
    if (!seats || !seats.length) { showToast('No seats found in the seat map.'); return; }
    const visibleSeats = seats.filter(s => s.seat_type !== 'aisle');
    let inserted = 0;
    for (const ev of perfEvents) {
      const rows = visibleSeats.map(seat => ({
        performance_id: ev.id,
        seat_id: seat.id,
        status: seat.seat_type === 'blocked' ? 'blocked' : 'available',
        blocked_reason: seat.seat_type === 'blocked' ? 'Blocked in venue layout' : null,
      }));
      const { error } = await sb.from('performance_seat_inventory').upsert(rows, { onConflict: 'performance_id,seat_id', ignoreDuplicates: true });
      if (!error) inserted += rows.length;
    }
    showToast(`Inventory generated: ${inserted} seats across ${perfEvents.length} performances.`);
  }

  // ── Step 3: Ticket Types ──
  function renderTixStepTypes() {
    if (!_tixSetup.ticket_types) _tixSetup.ticket_types = [];
    const rows = _tixSetup.ticket_types.map((t, i) => `
      <div class="tix-row">
        <input type="text" value="${esc(t.name || '')}" placeholder="e.g. Adult" style="flex:1;" onblur="tixSaveTicketType(${i},'name',this.value)" />
        <div style="display:flex;align-items:center;gap:0.2rem;">
          <span style="font-size:0.82rem;font-weight:800;color:rgba(26,21,48,0.4);">$</span>
          <input type="number" value="${(t.price_cents / 100).toFixed(2)}" placeholder="0.00" style="width:80px;text-align:right;" step="0.01" min="0" onblur="tixSaveTicketType(${i},'price',this.value)" />
        </div>
        <button type="button" class="tix-row-del" onclick="tixRemoveTicketType(${i})">&#10005;</button>
      </div>`).join('');

    return `
      <div style="max-width:560px;">
        <div style="font-size:0.92rem;font-weight:700;color:#1a1530;margin-bottom:0.75rem;">What ticket types are you offering?</div>
        <div style="font-size:0.75rem;color:rgba(26,21,48,0.5);margin-bottom:1rem;">Add a row for each price point. Common types: Adult, Child, Senior, Student, Front Row.</div>
        ${rows}
        <button type="button" class="btn-secondary" style="font-size:0.78rem;margin-top:0.5rem;" onclick="tixAddTicketType()">+ Add Ticket Type</button>
      </div>`;
  }

  function tixAddTicketType() {
    if (!_tixSetup.ticket_types) _tixSetup.ticket_types = [];
    _tixSetup.ticket_types.push({ id: crypto.randomUUID(), name: '', price_cents: 0, sort_order: _tixSetup.ticket_types.length });
    renderTicketingPanel('build');
  }

  async function tixRemoveTicketType(idx) {
    _tixSetup.ticket_types.splice(idx, 1);
    if (!_tixSetup.completed_steps) _tixSetup.completed_steps = [];
    if (_tixSetup.ticket_types.length > 0 && !_tixSetup.completed_steps.includes('types')) _tixSetup.completed_steps.push('types');
    await saveTicketingSetup();
    renderTicketingPanel('build');
  }

  async function tixSaveTicketType(idx, field, value) {
    const t = _tixSetup.ticket_types[idx];
    if (!t) return;
    if (field === 'name') t.name = value.trim();
    if (field === 'price') t.price_cents = Math.round(parseFloat(value || '0') * 100);
    if (!_tixSetup.completed_steps) _tixSetup.completed_steps = [];
    if (_tixSetup.ticket_types.some(tt => tt.name) && !_tixSetup.completed_steps.includes('types')) _tixSetup.completed_steps.push('types');
    await saveTicketingSetup();
  }

  // ── Step 4: Discounts & Comps ──
  function renderTixStepDiscounts() {
    const enabled = !!_tixSetup.discounts_enabled;
    if (!_tixSetup.discounts) _tixSetup.discounts = [];
    if (!_tixSetup.comps) _tixSetup.comps = [];

    const gateHtml = `
      <div style="font-size:0.92rem;font-weight:700;color:#1a1530;margin-bottom:0.75rem;">Are you offering any discounts or complimentary tickets?</div>
      <div class="tix-gate">
        <button type="button" class="tix-gate-btn ${enabled ? 'selected' : ''}" onclick="tixSetDiscountsEnabled(true)">Yes</button>
        <button type="button" class="tix-gate-btn ${!enabled ? 'selected' : ''}" onclick="tixSetDiscountsEnabled(false)">No, skip this</button>
      </div>`;

    if (!enabled) {
      return `<div style="max-width:560px;">${gateHtml}</div>`;
    }

    const discountRows = _tixSetup.discounts.map((d, i) => `
      <div class="tix-row">
        <input type="text" value="${esc(d.name || '')}" placeholder="e.g. Early Bird" style="flex:1;" onblur="tixSaveDiscount(${i},'name',this.value)" />
        <select style="border:1.5px solid rgba(87,46,136,0.18);border-radius:6px;padding:0.35rem;font-family:inherit;font-size:0.78rem;font-weight:600;" onchange="tixSaveDiscount(${i},'type',this.value)">
          <option value="percent" ${d.type === 'percent' ? 'selected' : ''}>% Off</option>
          <option value="fixed" ${d.type === 'fixed' ? 'selected' : ''}>$ Off</option>
          <option value="free" ${d.type === 'free' ? 'selected' : ''}>Free</option>
        </select>
        ${d.type !== 'free' ? `<input type="number" value="${d.value || ''}" placeholder="0" style="width:60px;text-align:right;" min="0" onblur="tixSaveDiscount(${i},'value',this.value)" />` : ''}
        <input type="text" value="${esc(d.code || '')}" placeholder="Code" style="width:90px;text-transform:uppercase;letter-spacing:0.05em;" onblur="tixSaveDiscount(${i},'code',this.value)" />
        <button type="button" class="tix-row-del" onclick="tixRemoveDiscount(${i})">&#10005;</button>
      </div>`).join('');

    const compRows = _tixSetup.comps.map((c, i) => `
      <div class="tix-row">
        <input type="text" value="${esc(c.name || '')}" placeholder="e.g. Cast Family" style="flex:1;" onblur="tixSaveComp(${i},'name',this.value)" />
        <input type="number" value="${c.qty || ''}" placeholder="Qty" style="width:60px;text-align:right;" min="1" onblur="tixSaveComp(${i},'qty',this.value)" />
        <span style="font-size:0.7rem;color:rgba(26,21,48,0.4);white-space:nowrap;">per show</span>
        <button type="button" class="tix-row-del" onclick="tixRemoveComp(${i})">&#10005;</button>
      </div>`).join('');

    return `
      <div style="max-width:620px;">
        ${gateHtml}
        <div style="margin-top:1rem;">
          <div style="font-size:0.82rem;font-weight:900;color:#572e88;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.5rem;">Discount Codes</div>
          ${discountRows}
          <button type="button" class="btn-secondary" style="font-size:0.75rem;margin-top:0.4rem;" onclick="tixAddDiscount()">+ Add Discount</button>
        </div>
        <div style="margin-top:1.25rem;">
          <div style="font-size:0.82rem;font-weight:900;color:#572e88;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.5rem;">Complimentary Tickets</div>
          ${compRows}
          <button type="button" class="btn-secondary" style="font-size:0.75rem;margin-top:0.4rem;" onclick="tixAddComp()">+ Add Comp Group</button>
        </div>
      </div>`;
  }

  async function tixSetDiscountsEnabled(val) {
    _tixSetup.discounts_enabled = val;
    if (!_tixSetup.completed_steps) _tixSetup.completed_steps = [];
    if (!_tixSetup.completed_steps.includes('discounts')) _tixSetup.completed_steps.push('discounts');
    await saveTicketingSetup();
    renderTicketingPanel('build');
  }

  function tixAddDiscount() {
    _tixSetup.discounts.push({ id: crypto.randomUUID(), name: '', type: 'percent', value: 0, code: '' });
    renderTicketingPanel('build');
  }
  async function tixRemoveDiscount(idx) { _tixSetup.discounts.splice(idx, 1); await saveTicketingSetup(); renderTicketingPanel('build'); }
  async function tixSaveDiscount(idx, field, value) {
    const d = _tixSetup.discounts[idx]; if (!d) return;
    if (field === 'name') d.name = value.trim();
    if (field === 'type') { d.type = value; if (value === 'free') d.value = 100; }
    if (field === 'value') d.value = parseFloat(value) || 0;
    if (field === 'code') d.code = value.trim().toUpperCase();
    await saveTicketingSetup();
  }

  function tixAddComp() {
    _tixSetup.comps.push({ id: crypto.randomUUID(), name: '', qty: 2 });
    renderTicketingPanel('build');
  }
  async function tixRemoveComp(idx) { _tixSetup.comps.splice(idx, 1); await saveTicketingSetup(); renderTicketingPanel('build'); }
  async function tixSaveComp(idx, field, value) {
    const c = _tixSetup.comps[idx]; if (!c) return;
    if (field === 'name') c.name = value.trim();
    if (field === 'qty') c.qty = parseInt(value) || 0;
    await saveTicketingSetup();
  }

  // ── Step 5: Reserved Blocks ──
  function renderTixStepBlocks() {
    const enabled = !!_tixSetup.reserved_blocks_enabled;
    if (!_tixSetup.reserved_blocks) _tixSetup.reserved_blocks = [];

    const gateHtml = `
      <div style="font-size:0.92rem;font-weight:700;color:#1a1530;margin-bottom:0.75rem;">Are you holding tickets for any groups?</div>
      <div style="font-size:0.75rem;color:rgba(26,21,48,0.5);margin-bottom:0.75rem;">These tickets will be set aside before public sale opens. Not for dress rehearsal guests.</div>
      <div class="tix-gate">
        <button type="button" class="tix-gate-btn ${enabled ? 'selected' : ''}" onclick="tixSetBlocksEnabled(true)">Yes</button>
        <button type="button" class="tix-gate-btn ${!enabled ? 'selected' : ''}" onclick="tixSetBlocksEnabled(false)">No, skip this</button>
      </div>`;

    if (!enabled) {
      return `<div style="max-width:560px;">${gateHtml}</div>`;
    }

    const blockRows = _tixSetup.reserved_blocks.map((b, i) => `
      <div class="tix-row" style="flex-wrap:wrap;">
        <input type="text" value="${esc(b.group_name || '')}" placeholder="e.g. School Group" style="flex:1;min-width:140px;" onblur="tixSaveBlock(${i},'group_name',this.value)" />
        <input type="number" value="${b.qty || ''}" placeholder="Qty" style="width:60px;text-align:right;" min="1" onblur="tixSaveBlock(${i},'qty',this.value)" />
        <input type="text" value="${esc(b.contact || '')}" placeholder="Contact name" style="flex:1;min-width:120px;" onblur="tixSaveBlock(${i},'contact',this.value)" />
        <button type="button" class="tix-row-del" onclick="tixRemoveBlock(${i})">&#10005;</button>
      </div>`).join('');

    return `
      <div style="max-width:620px;">
        ${gateHtml}
        <div style="margin-top:1rem;">
          ${blockRows}
          <button type="button" class="btn-secondary" style="font-size:0.75rem;margin-top:0.4rem;" onclick="tixAddBlock()">+ Add Reserved Block</button>
        </div>
      </div>`;
  }

  async function tixSetBlocksEnabled(val) {
    _tixSetup.reserved_blocks_enabled = val;
    if (!_tixSetup.completed_steps) _tixSetup.completed_steps = [];
    if (!_tixSetup.completed_steps.includes('blocks')) _tixSetup.completed_steps.push('blocks');
    await saveTicketingSetup();
    renderTicketingPanel('build');
  }

  function tixAddBlock() {
    _tixSetup.reserved_blocks.push({ id: crypto.randomUUID(), group_name: '', qty: 0, contact: '', notes: '' });
    renderTicketingPanel('build');
  }
  async function tixRemoveBlock(idx) { _tixSetup.reserved_blocks.splice(idx, 1); await saveTicketingSetup(); renderTicketingPanel('build'); }
  async function tixSaveBlock(idx, field, value) {
    const b = _tixSetup.reserved_blocks[idx]; if (!b) return;
    if (field === 'group_name') b.group_name = value.trim();
    if (field === 'qty') b.qty = parseInt(value) || 0;
    if (field === 'contact') b.contact = value.trim();
    await saveTicketingSetup();
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && _tixWizardOpen) closeTixWizard(true);
  });

  // ── Page entry point ─────────────────────────────────────────────
  // Each standalone ticketing-*.html page calls this once on load.
  window.initTicketingPage = function (subTab) {
    loadTicketingData(subTab || 'dashboard');
  };

  // Expose functions referenced via inline onclick="" handlers in the
  // rendered HTML strings above, and functions other pages call directly
  // (e.g. navigateToTicketing links into renderTixSalesSnapshot/Dashboard).
  window.renderTicketingPanel   = renderTicketingPanel;
  window.tixSwitchBuildStep     = tixSwitchBuildStep;
  window.tixPromptPublish       = tixPromptPublish;
  window.openTixWizard          = openTixWizard;
  window.closeTixWizard         = closeTixWizard;
  window.tixChooseManualBuild   = tixChooseManualBuild;
  window.tixWizardPrev          = tixWizardPrev;
  window.tixWizardNext          = tixWizardNext;
  window.tixGoLive              = tixGoLive;
  window.tixSaveVenue           = tixSaveVenue;
  window.tixSetSeatingStyle     = tixSetSeatingStyle;
  window.tixToggleDressTickets  = tixToggleDressTickets;
  window.tixRefreshPerformances = tixRefreshPerformances;
  window.tixGenerateInventory   = tixGenerateInventory;
  window.tixAddTicketType       = tixAddTicketType;
  window.tixRemoveTicketType    = tixRemoveTicketType;
  window.tixSaveTicketType      = tixSaveTicketType;
  window.tixSetDiscountsEnabled = tixSetDiscountsEnabled;
  window.tixAddDiscount         = tixAddDiscount;
  window.tixRemoveDiscount      = tixRemoveDiscount;
  window.tixSaveDiscount        = tixSaveDiscount;
  window.tixAddComp             = tixAddComp;
  window.tixRemoveComp          = tixRemoveComp;
  window.tixSaveComp            = tixSaveComp;
  window.tixSetBlocksEnabled    = tixSetBlocksEnabled;
  window.tixAddBlock            = tixAddBlock;
  window.tixRemoveBlock         = tixRemoveBlock;
  window.tixSaveBlock           = tixSaveBlock;

})();
