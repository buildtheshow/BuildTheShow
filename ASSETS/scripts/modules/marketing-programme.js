/* marketing-programme.js — Programme auto-layout planner */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://tkmaiktxpwqfbgeojbnf.supabase.co';
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrbWFpa3R4cHdxZmJnZW9qYm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDc4NTI4NTYsImV4cCI6MjAyMzQyODg1Nn0.tVxOMkaMdBnuqQbLdHl00h4WA7DV8LHuVxCt6z5LFCY';

  var DEFAULT_AD_SIZES = [
    { id: 'full', label: 'Full Page', capacity: 1 },
    { id: 'half', label: '1/2 Page', capacity: 2 },
    { id: 'quarter', label: '1/4 Page', capacity: 4 },
    { id: 'card', label: 'Card', capacity: 8 },
  ];

  var DEFAULT_TIERS = [
    { id: 'presenting', label: 'Presenting Sponsor', amount: 1000 },
    { id: 'gold', label: 'Gold Sponsor', amount: 500 },
    { id: 'silver', label: 'Silver Sponsor', amount: 250 },
    { id: 'bronze', label: 'Bronze Sponsor', amount: 100 },
    { id: 'friend', label: 'Friend', amount: 50 },
  ];
  var FLIPBOOK_SCRIPT = '/SHARED/Components/flipbook-viewer.js?v=20260521-real-viewer';

  var SECTION_OPTIONS = [
    ['cover', 'Cover'],
    ['welcome', 'Welcome note'],
    ['director', 'Director note'],
    ['land', 'Land acknowledgement'],
    ['creative', 'Creative team'],
    ['cast', 'Cast list'],
    ['characters', 'Character list'],
    ['bios', 'Cast bios'],
    ['sponsors', 'Sponsor thank-you'],
    ['ads', 'Programme ads'],
    ['thanks', 'Special thanks'],
    ['upcoming', 'Upcoming shows'],
    ['back', 'Back cover'],
  ];

  var PAPER_OPTIONS = [
    {
      id: 'letter-folded',
      label: '8.5 x 5.5 in',
      detail: '(folded in half from 8.5 x 11 in paper)',
      note: 'Standard booklet programme',
      pageLabel: '8.5 x 5.5 in folded pages',
      image: '/ASSETS/Images/Icons/programme-%205.5x11-folded-8.5x11.svg',
    },
    {
      id: 'letter-flat',
      label: '11 x 8.5 in',
      detail: '(not folded; print front/back from 8.5 x 11 in paper)',
      note: 'Loose full-letter sheets',
      pageLabel: '11 x 8.5 in loose sheets',
      image: '/ASSETS/Images/Icons/programme-8.5x11.svg',
    },
    {
      id: 'tabloid-folded',
      label: '11 x 8.5 in',
      detail: '(folded in half from 11 x 17 in paper)',
      note: 'Large booklet programme',
      pageLabel: '11 x 8.5 in folded pages',
      image: '/ASSETS/Images/Icons/programme-8.5x11Folded-11x17.svg',
    },
  ];

  var PAGE_LAYOUT_GROUPS = [
    {
      key: 'cast',
      title: 'Cast Lists',
      detail: 'How performers and roles are arranged.',
      options: [
        { id: 'cast-two-column', label: 'Two Columns', detail: 'Compact names for long casts', mockup: 'columns' },
        { id: 'cast-role-table', label: 'Role Table', detail: 'Character and performer pairings', mockup: 'table' },
        { id: 'cast-clean-list', label: 'Clean List', detail: 'Simple reading order', mockup: 'list' },
      ],
    },
    {
      key: 'bios',
      title: 'Bios',
      detail: 'How headshots and bios flow across pages.',
      options: [
        { id: 'bios-grid', label: 'Headshot Grid', detail: 'Six bios per page', mockup: 'bio-grid' },
        { id: 'bios-compact', label: 'Compact Text', detail: 'More performers per page', mockup: 'bio-compact' },
        { id: 'bios-featured', label: 'Featured Bios', detail: 'Larger headshots, fewer per page', mockup: 'bio-featured' },
      ],
    },
    {
      key: 'ads',
      title: 'Ads',
      detail: 'How purchased ad artwork is packed.',
      options: [
        { id: 'ads-auto', label: 'Auto Pack', detail: 'Full, half, quarter, card rules', mockup: 'ad-pack' },
        { id: 'ads-grid', label: 'Grid Page', detail: 'Balanced sponsor ad blocks', mockup: 'ad-grid' },
        { id: 'ads-featured', label: 'Featured Lead', detail: 'One key ad plus smaller blocks', mockup: 'ad-featured' },
      ],
    },
    {
      key: 'thanks',
      title: 'Thank Yous',
      detail: 'How acknowledgements and supporters appear.',
      options: [
        { id: 'thanks-note', label: 'Note Page', detail: 'Warm message with grouped names', mockup: 'note' },
        { id: 'thanks-columns', label: 'Name Columns', detail: 'Dense community thank-you list', mockup: 'columns' },
        { id: 'thanks-spotlight', label: 'Spotlight', detail: 'Large title and featured names', mockup: 'spotlight' },
      ],
    },
    {
      key: 'sponsors',
      title: 'Sponsors',
      detail: 'How sponsor tiers and logos are grouped.',
      options: [
        { id: 'sponsors-tiered', label: 'Tiered', detail: 'Platinum, Gold, Silver order', mockup: 'tiers' },
        { id: 'sponsors-logo-wall', label: 'Logo Wall', detail: 'Grouped logo-style blocks', mockup: 'logo-wall' },
        { id: 'sponsors-featured', label: 'Featured Tier', detail: 'Top sponsor gets stronger placement', mockup: 'sponsor-featured' },
      ],
    },
  ];

  var ProgrammeState = {
    prodId: null,
    container: null,
    viewer: null,
    currentPage: 0,
    pageView: 'spread',
    settings: {
      paper: 'letter-folded',
      output: 'print',
      booklet: 'saddle-stitch',
      template: 'classic-theatre',
      bioLayout: 'headshot-grid',
      pageLayouts: {
        cast: 'cast-two-column',
        bios: 'bios-grid',
        ads: 'ads-auto',
        thanks: 'thanks-note',
        sponsors: 'sponsors-tiered',
      },
      sections: ['cover', 'welcome', 'creative', 'cast', 'bios', 'sponsors', 'ads', 'thanks', 'back'],
    },
    openLayoutGroup: 'cast',
    data: {
      production: null,
      businesses: [],
      ads: [],
      packages: [],
      deliverables: [],
      sponsorSettings: {},
      roles: [],
      applications: [],
      team: [],
    },
  };

  function esc(value) {
    return value == null ? '' : String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function dbFetch(table, extra) {
    var url = SUPABASE_URL + '/rest/v1/' + table + '?' + (extra || '') + '&production_id=eq.' + encodeURIComponent(ProgrammeState.prodId);
    return fetch(url, { headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON } })
      .then(function (res) {
        if (!res.ok) return res.text().then(function (text) { throw new Error(text); });
        return res.json();
      });
  }

  function dbFetchById(table, id, select) {
    var url = SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + encodeURIComponent(id) + '&select=' + encodeURIComponent(select || '*') + '&limit=1';
    return fetch(url, { headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON } })
      .then(function (res) {
        if (!res.ok) return res.text().then(function (text) { throw new Error(text); });
        return res.json();
      })
      .then(function (rows) { return rows && rows[0] ? rows[0] : null; });
  }

  function safeFetch(promise, fallback) {
    return promise.catch(function (error) {
      console.warn('[BTS] Programme planner data unavailable.', error);
      return fallback;
    });
  }

  function loadScript(src) {
    if (!src) return Promise.resolve();
    if (src.indexOf('flipbook-viewer') !== -1 && window.createFlipbookViewer) return Promise.resolve();
    window._btsProgrammeLoadedScripts = window._btsProgrammeLoadedScripts || {};
    if (window._btsProgrammeLoadedScripts[src]) return window._btsProgrammeLoadedScripts[src];
    window._btsProgrammeLoadedScripts[src] = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = function () { reject(new Error('Could not load ' + src)); };
      document.head.appendChild(script);
    });
    return window._btsProgrammeLoadedScripts[src];
  }

  function loadProgrammeData() {
    return Promise.all([
      safeFetch(dbFetchById('productions', ProgrammeState.prodId, 'id,title,name,subtitle,venue,start_date,end_date,producer,director,org_name,slug'), null),
      safeFetch(dbFetch('sponsor_businesses', 'select=*'), []),
      safeFetch(dbFetch('programme_ads', 'select=*'), []),
      safeFetch(dbFetch('sponsor_packages', 'select=*'), []),
      safeFetch(dbFetch('sponsor_deliverables', 'select=*'), []),
      safeFetch(dbFetch('sponsor_settings', 'select=settings&limit=1'), []),
      safeFetch(dbFetch('production_roles', 'select=*'), []),
      safeFetch(dbFetch('audition_applications', 'select=id,name,first_name,last_name,headshot_url,custom_answers,status,created_at'), []),
      safeFetch(dbFetch('production_team_members', 'select=id,name,role,department,bio,headshot_url,is_active'), []),
    ]).then(function (results) {
      ProgrammeState.data.production = results[0];
      ProgrammeState.data.businesses = results[1] || [];
      ProgrammeState.data.ads = results[2] || [];
      ProgrammeState.data.packages = results[3] || [];
      ProgrammeState.data.deliverables = results[4] || [];
      ProgrammeState.data.sponsorSettings = (results[5] && results[5][0] && results[5][0].settings) || {};
      ProgrammeState.data.roles = results[6] || [];
      ProgrammeState.data.applications = results[7] || [];
      ProgrammeState.data.team = (results[8] || []).filter(function (member) { return member.is_active !== false; });
    });
  }

  function adSizes() {
    var fromSettings = ProgrammeState.data.sponsorSettings && ProgrammeState.data.sponsorSettings.adSizes;
    return Array.isArray(fromSettings) && fromSettings.length ? fromSettings.map(function (size) {
      var match = DEFAULT_AD_SIZES.find(function (item) { return item.id === size.id; });
      return Object.assign({}, match || {}, size);
    }) : DEFAULT_AD_SIZES.slice();
  }

  function tiers() {
    var fromSettings = ProgrammeState.data.sponsorSettings && ProgrammeState.data.sponsorSettings.tiers;
    return Array.isArray(fromSettings) && fromSettings.length ? fromSettings : DEFAULT_TIERS;
  }

  function businessName(id) {
    var biz = ProgrammeState.data.businesses.find(function (item) { return String(item.id) === String(id); });
    return biz ? biz.name : 'Unlinked business';
  }

  function applicationName(app) {
    return app.name || [app.first_name, app.last_name].filter(Boolean).join(' ') || 'Unnamed performer';
  }

  function customAnswers(app) {
    return app && typeof app.custom_answers === 'object' && app.custom_answers ? app.custom_answers : {};
  }

  function bioText(app) {
    var answers = customAnswers(app);
    return app.bio || answers.Bio || answers.bio || answers['Cast Bio'] || answers['Programme Bio'] || '';
  }

  function castApplications() {
    var byId = {};
    ProgrammeState.data.applications.forEach(function (app) { byId[String(app.id)] = app; });
    var castIds = new Set();
    ProgrammeState.data.roles.forEach(function (role) {
      if (role.cast_member_id) castIds.add(String(role.cast_member_id));
    });
    if (!castIds.size) return ProgrammeState.data.applications.slice(0, 24);
    return Array.from(castIds).map(function (id) { return byId[id]; }).filter(Boolean);
  }

  function roleLabel(role) {
    return role.name || role.role_name || role.character_name || role.title || 'Role';
  }

  function buildReadiness() {
    var ads = ProgrammeState.data.ads;
    var packages = ProgrammeState.data.packages;
    var deliverables = ProgrammeState.data.deliverables;
    var cast = castApplications();
    return {
      missingAds: ads.filter(function (ad) { return !ad.artwork_url || ad.artwork_status === 'missing'; }).length,
      unapprovedAds: ads.filter(function (ad) { return !['approved', 'print_ready'].includes(String(ad.approval_status || '').toLowerCase()); }).length,
      unpaidAds: ads.filter(function (ad) { return String(ad.payment_status || '').toLowerCase() !== 'paid'; }).length,
      unpaidSponsors: packages.filter(function (pkg) { return String(pkg.payment_status || '').toLowerCase() !== 'paid'; }).length,
      openDeliverables: deliverables.filter(function (item) { return String(item.status || '').toLowerCase() !== 'done'; }).length,
      missingBios: cast.filter(function (app) { return !bioText(app); }).length,
      missingHeadshots: cast.filter(function (app) { return !app.headshot_url; }).length,
    };
  }

  function packAdPages() {
    var sizes = adSizes();
    var order = ['full', 'half', 'quarter', 'card'];
    var pages = [];
    order.forEach(function (sizeId) {
      var size = sizes.find(function (item) { return item.id === sizeId; }) || DEFAULT_AD_SIZES.find(function (item) { return item.id === sizeId; });
      var capacity = Number(size && size.capacity) || (sizeId === 'full' ? 1 : sizeId === 'half' ? 2 : sizeId === 'quarter' ? 4 : 8);
      var booked = ProgrammeState.data.ads.filter(function (ad) { return String(ad.ad_size || '') === sizeId; });
      for (var i = 0; i < booked.length; i += capacity) {
        pages.push({
          type: 'ads',
          title: (size && size.label ? size.label : sizeId) + ' Ads',
          subtitle: booked.slice(i, i + capacity).length + ' of ' + capacity + ' placements',
          items: booked.slice(i, i + capacity),
          capacity: capacity,
          adSize: sizeId,
          layout: ProgrammeState.settings.pageLayouts.ads,
        });
      }
    });
    return pages;
  }

  function sponsorGroups() {
    var tierOrder = tiers().slice().sort(function (a, b) { return Number(b.amount || 0) - Number(a.amount || 0); });
    return tierOrder.map(function (tier) {
      var items = ProgrammeState.data.packages.filter(function (pkg) { return String(pkg.tier || '') === String(tier.id); });
      return { tier: tier, items: items };
    }).filter(function (group) { return group.items.length; });
  }

  function buildProgrammePages() {
    var selected = new Set(ProgrammeState.settings.sections);
    var pages = [];
    var prod = ProgrammeState.data.production || {};
    var cast = castApplications();
    var team = ProgrammeState.data.team;
    if (selected.has('cover')) pages.push({ type: 'cover', title: prod.title || prod.name || 'Production Title', subtitle: [prod.venue, prod.start_date].filter(Boolean).join(' · ') || 'Cover page' });
    if (selected.has('welcome')) pages.push({ type: 'note', title: 'Welcome Note', subtitle: 'Producer or organisation message placeholder' });
    if (selected.has('director')) pages.push({ type: 'note', title: 'Director Note', subtitle: prod.director ? 'From ' + prod.director : 'Director note placeholder' });
    if (selected.has('land')) pages.push({ type: 'note', title: 'Land Acknowledgement', subtitle: 'Structured text placeholder' });
    if (selected.has('creative')) pages.push({ type: 'creative', title: 'Creative Team', subtitle: team.length + ' team member' + (team.length === 1 ? '' : 's'), items: team });
    if (selected.has('cast')) pages.push({ type: 'cast', title: 'Cast List', subtitle: cast.length + ' performer' + (cast.length === 1 ? '' : 's'), items: cast, layout: ProgrammeState.settings.pageLayouts.cast });
    if (selected.has('characters')) pages.push({ type: 'characters', title: 'Character List', subtitle: ProgrammeState.data.roles.length + ' role' + (ProgrammeState.data.roles.length === 1 ? '' : 's'), items: ProgrammeState.data.roles, layout: ProgrammeState.settings.pageLayouts.cast });
    if (selected.has('bios')) {
      var bioCapacity = ProgrammeState.settings.pageLayouts.bios === 'bios-compact' ? 10 : ProgrammeState.settings.pageLayouts.bios === 'bios-featured' ? 4 : 6;
      for (var i = 0; i < cast.length; i += bioCapacity) {
        pages.push({ type: 'bios', title: 'Cast Bios', subtitle: 'Bios ' + (i + 1) + '-' + Math.min(i + bioCapacity, cast.length), items: cast.slice(i, i + bioCapacity), capacity: bioCapacity, layout: ProgrammeState.settings.pageLayouts.bios });
      }
      if (!cast.length) pages.push({ type: 'bios', title: 'Cast Bios', subtitle: 'Waiting for cast list', items: [], capacity: bioCapacity, layout: ProgrammeState.settings.pageLayouts.bios });
    }
    if (selected.has('sponsors')) pages.push({ type: 'sponsors', title: 'Sponsors', subtitle: ProgrammeState.data.packages.length + ' sponsor package' + (ProgrammeState.data.packages.length === 1 ? '' : 's'), groups: sponsorGroups(), layout: ProgrammeState.settings.pageLayouts.sponsors });
    if (selected.has('ads')) pages = pages.concat(packAdPages());
    if (selected.has('thanks')) pages.push({ type: 'thanks', title: 'Special Thanks', subtitle: 'Community acknowledgements placeholder', layout: ProgrammeState.settings.pageLayouts.thanks });
    if (selected.has('upcoming')) pages.push({ type: 'upcoming', title: 'Upcoming Shows', subtitle: 'Future season placeholder' });
    if (selected.has('back')) pages.push({ type: 'back', title: 'Back Cover', subtitle: 'Back cover or final sponsor placement' });
    return pages;
  }

  function statusClass(count) {
    return count ? 'warn' : 'good';
  }

  function statusTile(label, value, sub, cls) {
    return '<div class="pgm-status-tile pgm-status-tile--' + esc(cls || '') + '">' +
      '<div class="pgm-status-label">' + esc(label) + '</div>' +
      '<div class="pgm-status-value">' + esc(value) + '</div>' +
      '<div class="pgm-status-sub">' + esc(sub || '') + '</div>' +
    '</div>';
  }

  function selectedPaper() {
    return PAPER_OPTIONS.find(function (item) { return item.id === ProgrammeState.settings.paper; }) || PAPER_OPTIONS[0];
  }

  function ensureCurrentPage(pages) {
    var count = (pages || []).length;
    if (!count) {
      ProgrammeState.currentPage = 0;
      return;
    }
    if (ProgrammeState.currentPage < 0) ProgrammeState.currentPage = 0;
    if (ProgrammeState.currentPage >= count) ProgrammeState.currentPage = count - 1;
  }

  function renderPaperPicker() {
    var selected = selectedPaper().id;
    return '<div class="pgmb-paper-picker" role="radiogroup" aria-label="Programme paper">' +
      PAPER_OPTIONS.map(function (paper) {
        var isSelected = selected === paper.id;
        return '<label class="pgmb-paper-card' + (isSelected ? ' is-selected' : '') + '">' +
          '<input type="radio" name="pgm-paper" value="' + esc(paper.id) + '"' + (isSelected ? ' checked' : '') + ' onchange="MarketingProgrammeModule.setSetting(\'paper\', this.value)" />' +
          '<span class="pgmb-paper-visual pgmb-paper-visual--' + esc(paper.id) + '"><img src="' + esc(paper.image) + '" alt="" /></span>' +
          '<span class="pgmb-paper-copy">' +
            '<strong>' + esc(paper.label) + '</strong>' +
            '<em>' + esc(paper.detail) + '</em>' +
            '<small>' + esc(paper.note) + '</small>' +
          '</span>' +
        '</label>';
      }).join('') +
    '</div>';
  }

  function pageTypeLabel(page) {
    if (!page) return 'Page';
    if (page.type === 'cover') return 'Cover';
    if (page.type === 'note') return 'Note';
    if (page.type === 'creative') return 'Production Team';
    if (page.type === 'cast') return 'Cast List';
    if (page.type === 'characters') return 'Characters';
    if (page.type === 'bios') return 'Bios';
    if (page.type === 'sponsors') return 'Sponsors';
    if (page.type === 'ads') return 'Advertisements';
    if (page.type === 'thanks') return 'Thank You';
    if (page.type === 'upcoming') return 'Upcoming';
    if (page.type === 'back') return 'Back Cover';
    return page.title || 'Page';
  }

  function pageIcon(page) {
    if (!page) return 'P';
    var type = page.type;
    if (type === 'cover' || type === 'back') return 'C';
    if (type === 'note') return 'N';
    if (type === 'cast' || type === 'characters') return 'L';
    if (type === 'bios') return 'B';
    if (type === 'creative') return 'T';
    if (type === 'sponsors') return 'S';
    if (type === 'ads') return 'A';
    if (type === 'thanks') return 'Y';
    if (type === 'upcoming') return 'U';
    return 'P';
  }

  function layoutKeyForPage(page) {
    if (!page) return '';
    if (page.type === 'cast' || page.type === 'characters') return 'cast';
    if (page.type === 'bios') return 'bios';
    if (page.type === 'ads') return 'ads';
    if (page.type === 'thanks') return 'thanks';
    if (page.type === 'sponsors') return 'sponsors';
    return '';
  }

  function selectedPage(pages) {
    ensureCurrentPage(pages);
    return pages[ProgrammeState.currentPage] || null;
  }

  function renderSetupTab() {
    return '<div class="pgmb-side-scroll">' +
      '<div class="pgmb-panel-eyebrow">Format</div>' +
      renderPaperPicker() +
      '<div class="pgmb-panel-eyebrow">Page Layouts</div>' +
      renderPageLayoutsTab() +
    '</div>';
  }

  function renderSectionsTab() {
    var checked = new Set(ProgrammeState.settings.sections);
    return '<div class="pgmb-side-scroll">' +
      '<div class="pgmb-side-help">Choose which structured sections Build The Show should place into this programme.</div>' +
      '<div class="pgmb-section-picker">' + SECTION_OPTIONS.map(function (item) {
        return '<label class="pgmb-section-option"><input type="checkbox" ' + (checked.has(item[0]) ? 'checked' : '') + ' onchange="MarketingProgrammeModule.toggleSection(\'' + esc(item[0]) + '\', this.checked)" /> <span>' + esc(item[1]) + '</span></label>';
      }).join('') + '</div>' +
    '</div>';
  }

  function renderLayoutMockup(option) {
    var bars = '<span></span><span></span><span></span><span></span>';
    var mockup = option.mockup;
    if (mockup === 'columns') return '<span class="pgm-layout-mini pgm-layout-mini--columns">' + bars + bars + '</span>';
    if (mockup === 'table') return '<span class="pgm-layout-mini pgm-layout-mini--table">' + bars + bars + bars + '</span>';
    if (mockup === 'bio-grid') return '<span class="pgm-layout-mini pgm-layout-mini--bio-grid"><i></i><span></span><i></i><span></span><i></i><span></span><i></i><span></span></span>';
    if (mockup === 'bio-compact') return '<span class="pgm-layout-mini pgm-layout-mini--bio-compact">' + bars + bars + bars + '</span>';
    if (mockup === 'bio-featured') return '<span class="pgm-layout-mini pgm-layout-mini--bio-featured"><i></i><span></span><span></span><i></i><span></span><span></span></span>';
    if (mockup === 'ad-pack') return '<span class="pgm-layout-mini pgm-layout-mini--ad-pack"><i></i><b></b><b></b><em></em><em></em><em></em><em></em></span>';
    if (mockup === 'ad-grid') return '<span class="pgm-layout-mini pgm-layout-mini--ad-grid"><i></i><i></i><i></i><i></i></span>';
    if (mockup === 'ad-featured') return '<span class="pgm-layout-mini pgm-layout-mini--ad-featured"><i></i><b></b><b></b><b></b></span>';
    if (mockup === 'note') return '<span class="pgm-layout-mini pgm-layout-mini--note"><strong></strong>' + bars + '<em></em></span>';
    if (mockup === 'spotlight') return '<span class="pgm-layout-mini pgm-layout-mini--spotlight"><strong></strong><i></i><i></i><span></span><span></span></span>';
    if (mockup === 'tiers') return '<span class="pgm-layout-mini pgm-layout-mini--tiers"><strong></strong><span></span><span></span><b></b><b></b><b></b></span>';
    if (mockup === 'logo-wall') return '<span class="pgm-layout-mini pgm-layout-mini--logo-wall"><i></i><i></i><i></i><i></i><i></i><i></i></span>';
    if (mockup === 'sponsor-featured') return '<span class="pgm-layout-mini pgm-layout-mini--sponsor-featured"><strong></strong><span></span><span></span><i></i><i></i><i></i></span>';
    return '<span class="pgm-layout-mini pgm-layout-mini--list">' + bars + '</span>';
  }

  function renderPageLayoutsTab() {
    var selected = ProgrammeState.settings.pageLayouts || {};
    var sectionLabels = {
      cast: 'Cast List',
      bios: 'Bios',
      ads: 'Ads',
      thanks: 'Thank Yous',
      sponsors: 'Sponsors',
    };
    return '<div class="pgmb-layout-groups">' + PAGE_LAYOUT_GROUPS.map(function (group) {
        var selectedOption = group.options.find(function (option) { return option.id === selected[group.key]; }) || group.options[0];
        return '<details class="pgmb-layout-group" ' + (group.key === ProgrammeState.openLayoutGroup ? 'open' : '') + '>' +
          '<summary class="pgmb-layout-group-head"><strong>' + esc(sectionLabels[group.key] || group.title) + '</strong><span>' + esc(selectedOption.label) + '</span></summary>' +
          '<div class="pgmb-layout-options">' + group.options.map(function (option) {
            var isSelected = selected[group.key] === option.id;
            return '<button class="pgmb-layout-option' + (isSelected ? ' is-selected' : '') + '" type="button" onclick="MarketingProgrammeModule.setPageLayout(\'' + esc(group.key) + '\', \'' + esc(option.id) + '\')">' +
              renderLayoutMockup(option) +
              '<span class="pgmb-layout-option-copy"><strong>' + esc(option.label) + '</strong><em>' + esc(option.detail) + '</em></span>' +
            '</button>';
          }).join('') + '</div>' +
        '</details>';
      }).join('') + '</div>';
  }

  function renderReadiness(pages) {
    var ready = buildReadiness();
    var blockers = ready.missingAds + ready.unapprovedAds + ready.missingBios + ready.missingHeadshots + ready.openDeliverables;
    var paper = selectedPaper();
    return '<div class="pgmb-status-grid">' +
      statusTile('Page Estimate', String(pages.length), paper.pageLabel, 'info') +
      statusTile('Print Readiness', blockers ? 'Needs Review' : 'Ready', blockers ? blockers + ' item' + (blockers === 1 ? '' : 's') + ' need attention' : 'Ready for proof review', blockers ? 'warn' : 'good') +
      statusTile('Missing Ads', String(ready.missingAds), 'Artwork placeholders', statusClass(ready.missingAds)) +
      statusTile('Unapproved Art', String(ready.unapprovedAds), 'Needs artwork approval', statusClass(ready.unapprovedAds)) +
    '</div>';
  }

  function renderBuilderHeader(pages) {
    var prod = ProgrammeState.data.production || {};
    return '<div class="pgmb-header">' +
      '<div class="pgmb-header-copy">' +
        '<div class="pgmb-header-kicker">Programme Builder</div>' +
        '<h1>' + esc(prod.title || prod.name || 'Programme Builder') + '</h1>' +
        '<p>Create and customise your show programme with live page planning and spread previews.</p>' +
      '</div>' +
      '<div class="pgmb-header-actions">' +
        '<button class="pgmb-btn pgmb-btn--ghost" type="button" onclick="MarketingProgrammeModule.previewAll()">Preview All Pages</button>' +
        '<button class="pgmb-btn pgmb-btn--primary" type="button">Export PDF</button>' +
        '<button class="pgmb-btn pgmb-btn--soft" type="button">More</button>' +
      '</div>' +
    '</div>';
  }

  function renderPageList(pages) {
    return '<aside class="pgmb-sidebar">' +
      '<div class="pgmb-sidebar-head">' +
        '<div><strong>Pages</strong><span>' + pages.length + ' total</span></div>' +
        '<button class="pgmb-link-btn" type="button">Reorder</button>' +
      '</div>' +
      '<div class="pgmb-page-list">' + pages.map(function (page, index) {
        var active = index === ProgrammeState.currentPage;
        return '<button class="pgmb-page-row' + (active ? ' is-active' : '') + '" type="button" onclick="MarketingProgrammeModule.setCurrentPage(' + index + ')">' +
          '<span class="pgmb-page-index">' + (index + 1) + '</span>' +
          '<span class="pgmb-page-icon">' + esc(pageIcon(page)) + '</span>' +
          '<span class="pgmb-page-copy"><strong>' + esc(page.title || pageTypeLabel(page)) + '</strong><em>' + esc(page.subtitle || pageTypeLabel(page)) + '</em></span>' +
        '</button>';
      }).join('') + '</div>' +
      '<div class="pgmb-sidebar-section">' + renderSelectedPageOptions(pages) + '</div>' +
    '</aside>';
  }

  function renderOptionButtons(groupKey) {
    var selected = ProgrammeState.settings.pageLayouts || {};
    var group = PAGE_LAYOUT_GROUPS.find(function (item) { return item.key === groupKey; });
    if (!group) return '';
    return '<div class="pgmb-toggle-row">' + group.options.map(function (option) {
      var isSelected = selected[groupKey] === option.id;
      return '<button class="pgmb-toggle-btn' + (isSelected ? ' is-selected' : '') + '" type="button" onclick="MarketingProgrammeModule.setPageLayout(\'' + esc(groupKey) + '\', \'' + esc(option.id) + '\')">' + esc(option.label) + '</button>';
    }).join('') + '</div>';
  }

  function renderSelectedPageOptions(pages) {
    var page = selectedPage(pages);
    var layoutKey = layoutKeyForPage(page);
    return '<div class="pgmb-options-card">' +
      '<div class="pgmb-options-eyebrow">' + esc(pageTypeLabel(page)).toUpperCase() + ' OPTIONS</div>' +
      '<h3>' + esc(page ? page.title : 'Programme Page') + '</h3>' +
      '<p>' + esc(page && page.subtitle ? page.subtitle : 'Adjust the structure and layout of this programme page.') + '</p>' +
      (layoutKey ? '<div class="pgmb-option-group"><label>Layout</label>' + renderOptionButtons(layoutKey) + '</div>' : '') +
      '<div class="pgmb-option-group"><label>Included Sections</label>' + renderSectionsTab() + '</div>' +
      '<div class="pgmb-option-group"><label>Format</label>' + renderSetupTab() + '</div>' +
      '</div>';
  }

  function spreadForPage(pages) {
    ensureCurrentPage(pages);
    if (!pages.length) return { left: -1, right: -1 };
    if (ProgrammeState.currentPage <= 0) return { left: 0, right: -1 };
    if (ProgrammeState.currentPage % 2 === 1) return { left: ProgrammeState.currentPage, right: Math.min(ProgrammeState.currentPage + 1, pages.length - 1) };
    return { left: ProgrammeState.currentPage - 1, right: ProgrammeState.currentPage };
  }

  function renderSpreadStage(pages) {
    var images = programmePageImages(pages);
    var spread = spreadForPage(pages);
    var showSingle = spread.right < 0 || spread.left === spread.right;
    var counter = (ProgrammeState.currentPage + 1) + ' of ' + pages.length;
    return '<section class="pgmb-stage-card">' +
      '<div class="pgmb-stage-toolbar">' +
        '<div class="pgmb-stage-controls">' +
          '<span class="pgmb-toolbar-label">Page Size:</span>' +
          '<span class="pgmb-toolbar-pill">' + esc(selectedPaper().label) + '</span>' +
        '</div>' +
        '<div class="pgmb-stage-controls">' +
          '<span class="pgmb-toolbar-label">View:</span>' +
          '<button class="pgmb-icon-toggle is-selected" type="button" onclick="MarketingProgrammeModule.setPageView(\'spread\')">Spread</button>' +
        '</div>' +
        '<div class="pgmb-stage-pagination">' +
          '<button class="pgmb-nav-btn" type="button" onclick="MarketingProgrammeModule.stepPage(-1)">&lt;</button>' +
          '<strong>' + counter + '</strong>' +
          '<button class="pgmb-nav-btn" type="button" onclick="MarketingProgrammeModule.stepPage(1)">&gt;</button>' +
        '</div>' +
      '</div>' +
      '<div class="pgmb-stage">' +
        '<button class="pgmb-arrow pgmb-arrow--left" type="button" onclick="MarketingProgrammeModule.stepPage(-1)">&lt;</button>' +
        '<div class="pgmb-spread' + (showSingle ? ' is-single' : '') + '">' +
          (spread.left > -1 ? '<div class="pgmb-sheet"><img src="' + esc(images[spread.left]) + '" alt="' + esc((pages[spread.left] && pages[spread.left].title) || 'Programme page') + '" /></div>' : '') +
          (showSingle ? '' : '<div class="pgmb-sheet"><img src="' + esc(images[spread.right]) + '" alt="' + esc((pages[spread.right] && pages[spread.right].title) || 'Programme page') + '" /></div>') +
        '</div>' +
        '<button class="pgmb-arrow pgmb-arrow--right" type="button" onclick="MarketingProgrammeModule.stepPage(1)">&gt;</button>' +
      '</div>' +
    '</section>';
  }

  function renderFilmstrip(pages) {
    var images = programmePageImages(pages);
    return '<div class="pgmb-filmstrip">' +
      '<button class="pgmb-film-arrow" type="button" onclick="MarketingProgrammeModule.stepPage(-1)">&lt;</button>' +
      '<div class="pgmb-film-track">' + pages.map(function (page, index) {
        var active = index === ProgrammeState.currentPage;
        return '<button class="pgmb-thumb' + (active ? ' is-active' : '') + '" type="button" onclick="MarketingProgrammeModule.setCurrentPage(' + index + ')">' +
          '<span class="pgmb-thumb-frame"><img src="' + esc(images[index]) + '" alt="' + esc(page.title || 'Programme page') + '" /></span>' +
          '<span class="pgmb-thumb-meta"><strong>' + (index + 1) + '</strong><em>' + esc(page.title || pageTypeLabel(page)) + '</em></span>' +
        '</button>';
      }).join('') + '</div>' +
      '<button class="pgmb-film-arrow" type="button" onclick="MarketingProgrammeModule.stepPage(1)">&gt;</button>' +
    '</div>';
  }

  function renderBuilderShell(pages) {
    return '<section class="pgmb-shell">' +
      renderPageList(pages) +
      '<div class="pgmb-main">' +
        renderSpreadStage(pages) +
        renderFilmstrip(pages) +
      '</div>' +
    '</section>';
  }

  function pageBody(page) {
    var body = '';
    if (page.type === 'cover') body = '<div class="pgm-page-cover-title">' + esc(page.title) + '</div><div class="pgm-page-muted">' + esc(page.subtitle) + '</div>';
    else if (page.type === 'ads') body = renderAdPage(page);
    else if (page.type === 'bios') body = renderBioPage(page);
    else if (page.type === 'sponsors') body = renderSponsorPage(page);
    else if (page.type === 'creative') body = renderSimpleList(page.items, function (item) { return [item.role || item.department || 'Team', item.name || 'Unnamed'].filter(Boolean).join(': '); }, 12);
    else if (page.type === 'cast') body = renderSimpleList(page.items, applicationName, page.layout === 'cast-clean-list' ? 14 : 20, 'pgm-page-list--' + (page.layout || 'cast-two-column'));
    else if (page.type === 'characters') body = renderSimpleList(page.items, roleLabel, page.layout === 'cast-clean-list' ? 16 : 22, 'pgm-page-list--' + (page.layout || 'cast-two-column'));
    else if (page.type === 'thanks') body = renderThanksPage(page);
    else body = '<div class="pgm-placeholder-lines"><span></span><span></span><span></span><span></span></div>';
    return body;
  }

  function svgEsc(value) {
    return value == null ? '' : String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function pagePixelSize() {
    var paper = selectedPaper().id;
    if (paper === 'letter-folded') return { width: 660, height: 1020 };
    return { width: 765, height: 990 };
  }

  function pageSummaryLines(page) {
    if (!page) return [];
    if (page.type === 'cover') return [page.subtitle || 'Digital programme'];
    if (Array.isArray(page.items) && page.items.length) {
      return page.items.slice(0, 8).map(function (item) {
        if (typeof item === 'string') return item;
        if (item && item.name) return item.name;
        if (item && (item.first_name || item.last_name)) return [item.first_name, item.last_name].filter(Boolean).join(' ');
        if (item && item.role) return [item.role, item.name].filter(Boolean).join(': ');
        if (item && item.business_id) return businessName(item.business_id);
        return 'Programme item';
      });
    }
    if (page.groups && page.groups.length) {
      return page.groups.slice(0, 6).map(function (group) { return group.tier.label || group.tier.id || 'Sponsor tier'; });
    }
    if (page.type === 'bios') return ['Bio slots fill from cast registration', 'Missing bios become placeholders'];
    if (page.type === 'ads') return ['Purchased ads are placed automatically', 'Missing artwork stays visible'];
    return ['Waiting for source data'];
  }

  function programmePageImage(page, index) {
    var size = pagePixelSize();
    var W = size.width, H = size.height;
    var isCover = page && page.type === 'cover';
    var title = page && page.title ? page.title : 'Programme Page';
    var lines = pageSummaryLines(page);
    var font = 'Arial, Helvetica, sans-serif';

    var pageNumberChip = index === 0 ? '' :
      '<circle cx="' + (W - 46) + '" cy="' + (H - 46) + '" r="19" fill="#efab45"/>' +
      '<text x="' + (W - 46) + '" y="' + (H - 40) + '" fill="#000000" text-anchor="middle" font-family="' + font + '" font-size="16" font-weight="800">' + (index + 1) + '</text>';

    var svg;
    if (isCover) {
      var bandHeight = Math.round(H * 0.6);
      var subtitle = lines[0] || 'Digital Programme';
      svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
        '<rect width="100%" height="100%" fill="#ffffff"/>' +
        '<rect x="0" y="0" width="' + W + '" height="' + bandHeight + '" fill="#572e88"/>' +
        '<text x="60" y="90" fill="#ffffff" opacity="0.82" font-family="' + font + '" font-size="16" font-weight="800" letter-spacing="2">DIGITAL PROGRAMME</text>' +
        '<text x="60" y="172" fill="#ffffff" font-family="' + font + '" font-size="50" font-weight="900">' + svgEsc(title.slice(0, 22)) + '</text>' +
        '<rect x="60" y="198" width="120" height="6" rx="3" fill="#efab45"/>' +
        '<text x="60" y="' + (bandHeight - 46) + '" fill="#ffffff" font-family="' + font + '" font-size="22" font-weight="700">' + svgEsc(subtitle.slice(0, 40)) + '</text>' +
        pageNumberChip +
      '</svg>';
      return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    }

    var hasContent = lines.length > 0 && lines[0] !== 'Waiting for source data';
    var body;
    if (hasContent) {
      body = lines.map(function (line, lineIndex) {
        var yy = 210 + lineIndex * 40;
        return '<circle cx="70" cy="' + (yy - 7) + '" r="4" fill="#efab45"/>' +
          '<text x="88" y="' + yy + '" fill="#000000" font-family="' + font + '" font-size="21" font-weight="700">' + svgEsc(String(line).slice(0, 44)) + '</text>';
      }).join('');
    } else {
      var panelY = 210, panelH = 190;
      body =
        '<rect x="56" y="' + panelY + '" width="' + (W - 112) + '" height="' + panelH + '" rx="16" fill="#efefef"/>' +
        '<text x="' + (W / 2) + '" y="' + (panelY + panelH / 2 - 6) + '" fill="#572e88" text-anchor="middle" font-family="' + font + '" font-size="21" font-weight="800">Waiting for source data</text>' +
        '<text x="' + (W / 2) + '" y="' + (panelY + panelH / 2 + 24) + '" fill="#000000" text-anchor="middle" font-family="' + font + '" font-size="14" font-weight="600">This page fills in automatically once information is added.</text>';
    }

    svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
      '<rect width="100%" height="100%" fill="#ffffff"/>' +
      '<text x="60" y="76" fill="#572e88" font-family="' + font + '" font-size="15" font-weight="800" letter-spacing="2">PROGRAMME</text>' +
      '<text x="60" y="128" fill="#000000" font-family="' + font + '" font-size="38" font-weight="900">' + svgEsc(title.slice(0, 26)) + '</text>' +
      '<rect x="60" y="148" width="70" height="6" rx="3" fill="#efab45"/>' +
      body +
      pageNumberChip +
    '</svg>';
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  function programmePageImages(pages) {
    return (pages || []).map(programmePageImage);
  }

  function renderSimpleList(items, labelFn, max, modifier) {
    var list = (items || []).slice(0, max || 12);
    if (!list.length) return '<div class="pgm-page-empty">Waiting for source data</div>';
    return '<div class="pgm-page-list ' + esc(modifier || '') + '">' + list.map(function (item) { return '<div>' + esc(labelFn(item)) + '</div>'; }).join('') + '</div>';
  }

  function renderAdPage(page) {
    var cells = [];
    for (var i = 0; i < page.capacity; i++) {
      var ad = page.items[i];
      cells.push('<div class="pgm-ad-slot pgm-ad-slot--' + esc(page.adSize) + '">' +
        (ad ? '<strong>' + esc(businessName(ad.business_id)) + '</strong><span>' + esc(ad.artwork_url ? (ad.approval_status || 'Artwork received') : 'Artwork missing') + '</span>' : '<span>Empty ad slot</span>') +
      '</div>');
    }
    return '<div class="pgm-ad-layout pgm-ad-layout--' + esc(page.adSize) + ' pgm-ad-layout--' + esc(page.layout || 'ads-auto') + '">' + cells.join('') + '</div>';
  }

  function renderBioPage(page) {
    var cells = [];
    for (var i = 0; i < page.capacity; i++) {
      var app = page.items[i];
      cells.push('<div class="pgm-bio-slot">' +
        '<div class="pgm-bio-photo">' + (app && app.headshot_url ? '<img src="' + esc(app.headshot_url) + '" alt="" />' : '') + '</div>' +
        '<div><strong>' + esc(app ? applicationName(app) : 'Bio slot') + '</strong><span>' + esc(app ? (bioText(app) ? 'Bio ready' : 'Bio missing') : 'Waiting for cast') + '</span></div>' +
      '</div>');
    }
    return '<div class="pgm-bio-grid pgm-bio-grid--' + esc(page.layout || 'bios-grid') + '">' + cells.join('') + '</div>';
  }

  function renderSponsorPage(page) {
    var groups = page.groups || [];
    if (!groups.length) return '<div class="pgm-page-empty">No sponsor packages yet</div>';
    return '<div class="pgm-sponsor-groups pgm-sponsor-groups--' + esc(page.layout || 'sponsors-tiered') + '">' + groups.map(function (group) {
      return '<div><strong>' + esc(group.tier.label || group.tier.id) + '</strong>' +
        group.items.slice(0, 5).map(function (item) { return '<span>' + esc(businessName(item.business_id)) + '</span>'; }).join('') +
      '</div>';
    }).join('') + '</div>';
  }

  function renderThanksPage(page) {
    var layout = page.layout || 'thanks-note';
    if (layout === 'thanks-columns') return '<div class="pgm-thanks-layout pgm-thanks-layout--columns"><strong>Special Thanks</strong><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>';
    if (layout === 'thanks-spotlight') return '<div class="pgm-thanks-layout pgm-thanks-layout--spotlight"><strong>Thank You</strong><em>Families, volunteers, donors, and community partners</em><span></span><span></span><span></span></div>';
    return '<div class="pgm-thanks-layout pgm-thanks-layout--note"><strong>Special Thanks</strong><span></span><span></span><span></span><em>Community acknowledgements placeholder</em></div>';
  }

  function renderPlanner() {
    var pages = buildProgrammePages();
    ensureCurrentPage(pages);
    ProgrammeState.container.innerHTML =
      '<div class="pgmb-page">' +
        renderBuilderHeader(pages) +
        renderReadiness(pages) +
        renderBuilderShell(pages) +
      '</div>';
  }

  window.MarketingProgrammeModule = {
    init: function (prodId, container) {
      ProgrammeState.prodId = prodId;
      ProgrammeState.container = container;
      container.innerHTML = '<div class="spn-loading-row">Building programme planner...</div>';
      loadProgrammeData().then(renderPlanner).catch(function (error) {
        console.error('[BTS] Programme planner failed.', error);
        container.innerHTML = '<div class="spn-card"><div class="spn-card-title">Programme Planner</div><div style="color:#d1523d;font-weight:800;">Could not load programme data.</div></div>';
      });
    },
    setSetting: function (key, value) {
      ProgrammeState.settings[key] = value;
      if (key === 'bioLayout') {
        ProgrammeState.settings.pageLayouts = ProgrammeState.settings.pageLayouts || {};
        ProgrammeState.settings.pageLayouts.bios = value === 'text-compact' ? 'bios-compact' : value === 'featured-bios' ? 'bios-featured' : 'bios-grid';
      }
      renderPlanner();
    },
    setPageLayout: function (key, value) {
      ProgrammeState.settings.pageLayouts = ProgrammeState.settings.pageLayouts || {};
      ProgrammeState.settings.pageLayouts[key] = value;
      ProgrammeState.openLayoutGroup = key || ProgrammeState.openLayoutGroup;
      if (key === 'bios') {
        ProgrammeState.settings.bioLayout = value === 'bios-compact' ? 'text-compact' : value === 'bios-featured' ? 'featured-bios' : 'headshot-grid';
      }
      renderPlanner();
    },
    setCurrentPage: function (index) {
      ProgrammeState.currentPage = Number(index) || 0;
      renderPlanner();
    },
    stepPage: function (delta) {
      ProgrammeState.currentPage += Number(delta) || 0;
      renderPlanner();
    },
    setPageView: function (view) {
      ProgrammeState.pageView = view || 'spread';
      renderPlanner();
    },
    previewAll: function () {
      ProgrammeState.currentPage = 0;
      renderPlanner();
    },
    toggleSection: function (key, checked) {
      var next = new Set(ProgrammeState.settings.sections);
      if (checked) next.add(key);
      else next.delete(key);
      ProgrammeState.settings.sections = Array.from(next);
      renderPlanner();
    },
    destroy: function () {},
  };
})();
