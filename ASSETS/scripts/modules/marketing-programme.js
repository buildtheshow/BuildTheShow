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
    reordering: false,
    settingsOpen: false,
    settingsTab: 'sections',
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
      volunteers: [],
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
      safeFetch(dbFetch('volunteer_signups', 'select=id,name,role_name,department,status,email'), []),
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
      ProgrammeState.data.volunteers = results[9] || [];
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

  function connectionStatus(count, emptyLabel, readyLabel) {
    return count > 0
      ? { tone: 'live', label: readyLabel || (count + ' connected') }
      : { tone: 'empty', label: emptyLabel || 'Not connected yet' };
  }

  function pageConnections(page) {
    if (!page) return [];
    var cast = castApplications();
    var biosReady = cast.filter(function (app) { return !!bioText(app); }).length;
    var volunteers = ProgrammeState.data.volunteers || [];
    var connections = [];
    if (page.sectionKey === 'cover' || page.sectionKey === 'welcome' || page.sectionKey === 'director' || page.sectionKey === 'land' || page.sectionKey === 'back') {
      connections.push({
        label: 'Production',
        detail: (ProgrammeState.data.production && (ProgrammeState.data.production.title || ProgrammeState.data.production.name)) ? 'Using title, venue, and schedule' : 'Waiting for production details',
        status: connectionStatus(ProgrammeState.data.production ? 1 : 0, 'Add production details', 'Production details connected')
      });
    }
    if (page.sectionKey === 'creative') {
      connections.push({
        label: 'Creative Team',
        detail: ProgrammeState.data.team.length + ' team member' + (ProgrammeState.data.team.length === 1 ? '' : 's'),
        status: connectionStatus(ProgrammeState.data.team.length, 'No team members added', 'Creative team connected')
      });
    }
    if (page.sectionKey === 'cast' || page.sectionKey === 'characters') {
      connections.push({
        label: 'Cast List',
        detail: cast.length + ' performer' + (cast.length === 1 ? '' : 's') + ' from casting',
        status: connectionStatus(cast.length, 'No cast assigned yet', 'Cast list connected')
      });
    }
    if (page.sectionKey === 'bios') {
      connections.push({
        label: 'Cast Bios',
        detail: biosReady + ' bio' + (biosReady === 1 ? '' : 's') + ' ready',
        status: connectionStatus(cast.length, 'No cast bios available', 'Cast bios connected')
      });
    }
    if (page.sectionKey === 'sponsors') {
      connections.push({
        label: 'Sponsors',
        detail: ProgrammeState.data.packages.length + ' sponsor package' + (ProgrammeState.data.packages.length === 1 ? '' : 's'),
        status: connectionStatus(ProgrammeState.data.packages.length, 'No sponsors booked yet', 'Sponsors connected')
      });
    }
    if (page.sectionKey === 'ads') {
      connections.push({
        label: 'Programme Ads',
        detail: ProgrammeState.data.ads.length + ' ad placement' + (ProgrammeState.data.ads.length === 1 ? '' : 's'),
        status: connectionStatus(ProgrammeState.data.ads.length, 'No ad placements yet', 'Programme ads connected')
      });
    }
    if (page.sectionKey === 'thanks') {
      connections.push({
        label: 'Volunteers',
        detail: volunteers.length + ' volunteer' + (volunteers.length === 1 ? '' : 's') + ' available to acknowledge',
        status: connectionStatus(volunteers.length, 'No volunteers linked yet', 'Volunteer list connected')
      });
      connections.push({
        label: 'Sponsors',
        detail: ProgrammeState.data.packages.length + ' sponsor package' + (ProgrammeState.data.packages.length === 1 ? '' : 's') + ' available to thank',
        status: connectionStatus(ProgrammeState.data.packages.length, 'No sponsors to thank yet', 'Sponsors connected')
      });
    }
    return connections;
  }

  function pageConnectionSummary(page) {
    var sources = page && page.connections ? page.connections : [];
    if (!sources.length) return 'Manual page';
    return sources.map(function (item) { return item.label; }).join(' · ');
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

  function pagesForSection(key) {
    var prod = ProgrammeState.data.production || {};
    var cast = castApplications();
    var team = ProgrammeState.data.team;
    if (key === 'cover') return [{ type: 'cover', title: prod.title || prod.name || 'Production Title', subtitle: [prod.venue, prod.start_date].filter(Boolean).join(' · ') || 'Cover page' }];
    if (key === 'welcome') return [{ type: 'note', title: 'Welcome Note', subtitle: 'Producer or organisation message placeholder' }];
    if (key === 'director') return [{ type: 'note', title: 'Director Note', subtitle: prod.director ? 'From ' + prod.director : 'Director note placeholder' }];
    if (key === 'land') return [{ type: 'note', title: 'Land Acknowledgement', subtitle: 'Structured text placeholder' }];
    if (key === 'creative') return [{ type: 'creative', title: 'Creative Team', subtitle: team.length + ' team member' + (team.length === 1 ? '' : 's'), items: team }];
    if (key === 'cast') return [{ type: 'cast', title: 'Cast List', subtitle: cast.length + ' performer' + (cast.length === 1 ? '' : 's'), items: cast, layout: ProgrammeState.settings.pageLayouts.cast }];
    if (key === 'characters') return [{ type: 'characters', title: 'Character List', subtitle: ProgrammeState.data.roles.length + ' role' + (ProgrammeState.data.roles.length === 1 ? '' : 's'), items: ProgrammeState.data.roles, layout: ProgrammeState.settings.pageLayouts.cast }];
    if (key === 'bios') {
      var bioCapacity = ProgrammeState.settings.pageLayouts.bios === 'bios-compact' ? 10 : ProgrammeState.settings.pageLayouts.bios === 'bios-featured' ? 4 : 6;
      var bioPages = [];
      for (var i = 0; i < cast.length; i += bioCapacity) {
        bioPages.push({ type: 'bios', title: 'Cast Bios', subtitle: 'Bios ' + (i + 1) + '-' + Math.min(i + bioCapacity, cast.length), items: cast.slice(i, i + bioCapacity), capacity: bioCapacity, layout: ProgrammeState.settings.pageLayouts.bios });
      }
      if (!cast.length) bioPages.push({ type: 'bios', title: 'Cast Bios', subtitle: 'Waiting for cast list', items: [], capacity: bioCapacity, layout: ProgrammeState.settings.pageLayouts.bios });
      return bioPages;
    }
    if (key === 'sponsors') return [{ type: 'sponsors', title: 'Sponsors', subtitle: ProgrammeState.data.packages.length + ' sponsor package' + (ProgrammeState.data.packages.length === 1 ? '' : 's'), groups: sponsorGroups(), layout: ProgrammeState.settings.pageLayouts.sponsors }];
    if (key === 'ads') return packAdPages();
    if (key === 'thanks') return [{ type: 'thanks', title: 'Special Thanks', subtitle: 'Community acknowledgements placeholder', layout: ProgrammeState.settings.pageLayouts.thanks }];
    if (key === 'upcoming') return [{ type: 'upcoming', title: 'Upcoming Shows', subtitle: 'Future season placeholder' }];
    if (key === 'back') return [{ type: 'back', title: 'Back Cover', subtitle: 'Back cover or final sponsor placement' }];
    return [];
  }

  function buildProgrammePages() {
    var pages = [];
    ProgrammeState.settings.sections.forEach(function (key) {
      pagesForSection(key).forEach(function (page) {
        page.sectionKey = key;
        page.connections = pageConnections(page);
        pages.push(page);
      });
    });
    return pages;
  }

  function selectedPaper() {
    return PAPER_OPTIONS.find(function (item) { return item.id === ProgrammeState.settings.paper; }) || PAPER_OPTIONS[0];
  }

  function estimatePrintCost(pageCount) {
    var perPage = selectedPaper().id === 'tabloid-folded' ? 0.16 : 0.11;
    var binding = 0.45;
    return '~$' + (pageCount * perPage + binding).toFixed(2);
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
    if (!page) return 'Placeholder - Poster or document.svg';
    var type = page.type;
    if (type === 'cover' || type === 'back') return 'Placeholder - Poster or document.svg';
    if (type === 'note') return 'Messages.svg';
    if (type === 'cast' || type === 'characters') return 'page-cast.svg';
    if (type === 'bios') return 'navcastlist.svg';
    if (type === 'creative') return 'navproductionteam.svg';
    if (type === 'sponsors') return 'Budgeting-Sponsorship.svg';
    if (type === 'ads') return 'Star.svg';
    if (type === 'thanks') return 'heart.svg';
    if (type === 'upcoming') return 'calendar-date.svg';
    return 'Placeholder - Poster or document.svg';
  }

  function iconImg(file, size) {
    return '<img src="/ASSETS/Images/Icons/' + encodeURIComponent(file) + '" alt="" style="width:' + (size || 16) + 'px;height:' + (size || 16) + 'px;object-fit:contain;display:block;" onerror="this.style.display=\'none\'">';
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

  function readinessSummary() {
    var ready = buildReadiness();
    var blockers = ready.missingAds + ready.unapprovedAds + ready.missingBios + ready.missingHeadshots + ready.openDeliverables;
    return { blockers: blockers, label: blockers ? blockers + ' item' + (blockers === 1 ? '' : 's') + ' need attention' : 'Ready for proof review' };
  }

  function renderBuilderHeader(pages) {
    var prod = ProgrammeState.data.production || {};
    return '<div class="pgmb-header">' +
      '<div class="pgmb-header-copy">' +
        '<div class="pgmb-header-kicker">Programme Builder</div>' +
        '<h1>' + esc(prod.title || prod.name || 'Programme Builder') + '</h1>' +
        '<p>Create and customise your show programme.</p>' +
      '</div>' +
      '<div class="pgmb-header-actions">' +
        '<button class="pgmb-btn pgmb-btn--ghost" type="button" onclick="MarketingProgrammeModule.previewAll()">Preview All Pages</button>' +
        '<button class="pgmb-btn pgmb-btn--primary" type="button">' + iconImg('Upload - Document.svg', 15) + ' Export PDF</button>' +
        '<button class="pgmb-btn pgmb-btn--soft" type="button" onclick="MarketingProgrammeModule.openSettings()">More</button>' +
      '</div>' +
    '</div>';
  }

  function renderPageList(pages) {
    var reordering = !!ProgrammeState.reordering;
    var addable = SECTION_OPTIONS.filter(function (item) { return ProgrammeState.settings.sections.indexOf(item[0]) === -1; });
    var readiness = readinessSummary();
    return '<aside class="pgmb-sidebar">' +
      '<div class="pgmb-sidebar-head">' +
        '<div><strong>Pages</strong><span>' + pages.length + ' total</span></div>' +
        '<button class="pgmb-link-btn' + (reordering ? ' is-active' : '') + '" type="button" onclick="MarketingProgrammeModule.toggleReorder()">' + (reordering ? 'Done' : 'Reorder') + '</button>' +
      '</div>' +
      '<div class="pgmb-page-list">' + pages.map(function (page, index) {
        var active = index === ProgrammeState.currentPage;
        return '<div class="pgmb-page-row' + (active ? ' is-active' : '') + '">' +
          (reordering
            ? '<span class="pgmb-page-move">' +
                '<button type="button" class="pgmb-move-btn" ' + (index === 0 ? 'disabled' : '') + ' onclick="MarketingProgrammeModule.movePage(' + index + ',-1)" aria-label="Move page earlier">&#9650;</button>' +
                '<button type="button" class="pgmb-move-btn" ' + (index === pages.length - 1 ? 'disabled' : '') + ' onclick="MarketingProgrammeModule.movePage(' + index + ',1)" aria-label="Move page later">&#9660;</button>' +
              '</span>'
            : '<span class="pgmb-page-index">' + (index + 1) + '</span>') +
          '<span class="pgmb-page-icon">' + iconImg(pageIcon(page), 15) + '</span>' +
          '<button class="pgmb-page-copy" type="button" onclick="MarketingProgrammeModule.setCurrentPage(' + index + ')"><strong>' + esc(page.title || pageTypeLabel(page)) + '</strong><em>' + esc(page.subtitle || pageTypeLabel(page)) + '</em><span class="pgmb-page-source">' + esc(pageConnectionSummary(page)) + '</span></button>' +
        '</div>';
      }).join('') + '</div>' +
      (addable.length ? '<div class="pgmb-add-page">' +
        '<select class="pgmb-add-page-select" onchange="if(this.value){MarketingProgrammeModule.toggleSection(this.value,true);this.value=\'\';}">' +
          '<option value="">+ Add Page</option>' +
          addable.map(function (item) { return '<option value="' + esc(item[0]) + '">' + esc(item[1]) + '</option>'; }).join('') +
        '</select>' +
      '</div>' : '') +
      '<div class="pgmb-estimate-box">' +
        '<div class="pgmb-estimate-label">Estimated Programme</div>' +
        '<div class="pgmb-estimate-value">' + pages.length + ' <span>pages</span></div>' +
        '<div class="pgmb-estimate-print">Printing (booklet) <strong>' + estimatePrintCost(pages.length) + '</strong> each</div>' +
        '<div class="pgmb-estimate-readiness' + (readiness.blockers ? ' is-warn' : ' is-good') + '">' + esc(readiness.label) + '</div>' +
      '</div>' +
    '</aside>';
  }

  function renderSettingsModal() {
    if (!ProgrammeState.settingsOpen) return '';
    var tab = ProgrammeState.settingsTab || 'sections';
    var tabs = [['sections', 'Sections'], ['layouts', 'Page Layouts'], ['format', 'Format']];
    var body = tab === 'layouts' ? renderPageLayoutsTab() : tab === 'format' ? renderSetupTab() : renderSectionsTab();
    return '<div class="pgmb-modal-overlay" onclick="if(event.target===this)MarketingProgrammeModule.closeSettings()">' +
      '<div class="pgmb-modal">' +
        '<div class="pgmb-modal-head">' +
          '<div><strong>Programme Settings</strong><span>Choose what goes in the programme and how it looks</span></div>' +
          '<button class="pgmb-modal-close" type="button" onclick="MarketingProgrammeModule.closeSettings()">&times;</button>' +
        '</div>' +
        '<div class="pgmb-modal-tabs">' + tabs.map(function (t) {
          return '<button class="pgmb-modal-tab' + (tab === t[0] ? ' is-active' : '') + '" type="button" onclick="MarketingProgrammeModule.setSettingsTab(\'' + t[0] + '\')">' + esc(t[1]) + '</button>';
        }).join('') + '</div>' +
        '<div class="pgmb-modal-body">' + body + '</div>' +
      '</div>' +
    '</div>';
  }

  function spreadForPage(pages) {
    ensureCurrentPage(pages);
    if (!pages.length) return { left: -1, right: -1 };
    if (ProgrammeState.currentPage <= 0) return { left: 0, right: -1 };
    if (ProgrammeState.currentPage % 2 === 1) return { left: ProgrammeState.currentPage, right: Math.min(ProgrammeState.currentPage + 1, pages.length - 1) };
    return { left: ProgrammeState.currentPage - 1, right: ProgrammeState.currentPage };
  }

  function renderConnectionPanel(page) {
    var connections = page && page.connections ? page.connections : [];
    if (!connections.length) return '';
    return '<div class="pgmb-connection-panel">' +
      '<div class="pgmb-connection-head"><strong>Connected Data</strong><span>This page can stay synced with other parts of the show.</span></div>' +
      '<div class="pgmb-connection-list">' + connections.map(function (item) {
        return '<div class="pgmb-connection-item">' +
          '<div class="pgmb-connection-copy"><strong>' + esc(item.label) + '</strong><span>' + esc(item.detail) + '</span></div>' +
          '<span class="pgmb-connection-pill is-' + esc(item.status.tone) + '">' + esc(item.status.label) + '</span>' +
        '</div>';
      }).join('') + '</div>' +
    '</div>';
  }

  function renderSpreadStage(pages) {
    var images = programmePageImages(pages);
    var isSingleView = ProgrammeState.pageView === 'single';
    var spread = isSingleView ? { left: ProgrammeState.currentPage, right: -1 } : spreadForPage(pages);
    var showSingle = isSingleView || spread.right < 0 || spread.left === spread.right;
    var counter = (ProgrammeState.currentPage + 1) + ' of ' + pages.length;
    var current = pages[ProgrammeState.currentPage];
    return '<section class="pgmb-stage-card">' +
      '<div class="pgmb-stage-toolbar">' +
        '<div class="pgmb-stage-controls">' +
          '<span class="pgmb-toolbar-label">Page Size:</span>' +
          '<select class="pgmb-toolbar-select" onchange="MarketingProgrammeModule.setSetting(\'paper\', this.value)">' +
            PAPER_OPTIONS.map(function (paper) { return '<option value="' + esc(paper.id) + '"' + (paper.id === selectedPaper().id ? ' selected' : '') + '>' + esc(paper.label) + '</option>'; }).join('') +
          '</select>' +
        '</div>' +
        '<div class="pgmb-stage-controls">' +
          '<span class="pgmb-toolbar-label">View:</span>' +
          '<button class="pgmb-icon-toggle' + (!isSingleView ? ' is-selected' : '') + '" type="button" title="Spread view" onclick="MarketingProgrammeModule.setPageView(\'spread\')">&#9636;&#9636;</button>' +
          '<button class="pgmb-icon-toggle' + (isSingleView ? ' is-selected' : '') + '" type="button" title="Single page view" onclick="MarketingProgrammeModule.setPageView(\'single\')">&#9636;</button>' +
        '</div>' +
        '<div class="pgmb-stage-pagination">' +
          '<button class="pgmb-nav-btn" type="button" onclick="MarketingProgrammeModule.stepPage(-1)">&lt;</button>' +
          '<strong>' + counter + '</strong>' +
          '<button class="pgmb-nav-btn" type="button" onclick="MarketingProgrammeModule.stepPage(1)">&gt;</button>' +
        '</div>' +
      '</div>' +
      renderConnectionPanel(current) +
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

  var SERIF = "Georgia, 'Times New Roman', serif";

  function skylineSilhouette(W, H, color, opacity) {
    var groundY = H - 30;
    var widths = [26, 40, 20, 54, 30, 46, 24, 60, 28, 38, 22, 50, 32, 44, 20];
    var buildings = [];
    var x = 30, i = 0;
    while (x < W - 30 && i < 40) {
      var w = widths[i % widths.length];
      var h = 24 + ((i * 37) % 50);
      buildings.push('<rect x="' + x + '" y="' + (groundY - h) + '" width="' + w + '" height="' + h + '" fill="' + color + '"/>');
      x += w + 6;
      i++;
    }
    return '<g opacity="' + (opacity || 0.16) + '">' + buildings.join('') + '</g>';
  }

  function castPairsForPage(page) {
    var isCharacters = page.type === 'characters';
    var pairs = (page.items || []).map(function (item) {
      if (isCharacters) {
        var appId = item.cast_member_id ? String(item.cast_member_id) : '';
        var app = appId ? ProgrammeState.data.applications.find(function (a) { return String(a.id) === appId; }) : null;
        return { character: roleLabel(item), actor: app ? applicationName(app) : 'To be cast', blurb: item.description || item.bio || item.character_description || '' };
      }
      return { character: applicationName(item), actor: '', blurb: '' };
    });
    pairs.sort(function (a, b) { return a.character.localeCompare(b.character); });
    return pairs;
  }

  function renderCastListArt(page, W, H, font) {
    var pairs = castPairsForPage(page).slice(0, 11);
    var isCharacters = page.type === 'characters';
    if (!pairs.length) {
      var panelY = 220, panelH = 180;
      return '<rect x="56" y="' + panelY + '" width="' + (W - 112) + '" height="' + panelH + '" rx="16" fill="#efefef"/>' +
        '<text x="' + (W / 2) + '" y="' + (panelY + panelH / 2 - 6) + '" fill="#572e88" text-anchor="middle" font-family="' + font + '" font-size="21" font-weight="800">Waiting for source data</text>' +
        '<text x="' + (W / 2) + '" y="' + (panelY + panelH / 2 + 24) + '" fill="#000000" text-anchor="middle" font-family="' + font + '" font-size="14" font-weight="600">This page fills in automatically once information is added.</text>';
    }
    var kicker = '<text x="60" y="182" fill="#572e88" font-family="' + font + '" font-size="12" font-weight="800" letter-spacing="2">IN ALPHABETICAL ORDER' + (isCharacters ? ' BY CHARACTER' : '') + '</text>';
    var rows = pairs.map(function (pair, i) {
      var yy = 218 + i * 46;
      var row = '<text x="60" y="' + yy + '" fill="#000000" font-family="' + font + '" font-size="17" font-weight="800">' + svgEsc(pair.character.slice(0, 24)) + '</text>';
      if (pair.actor) {
        row += '<text x="' + (W - 60) + '" y="' + yy + '" text-anchor="end" fill="#000000" font-family="' + SERIF + '" font-style="italic" font-size="16" font-weight="600">' + svgEsc(pair.actor.slice(0, 24)) + '</text>';
      }
      if (pair.blurb) {
        row += '<text x="60" y="' + (yy + 17) + '" fill="#572e88" font-family="' + SERIF + '" font-style="italic" font-size="11" font-weight="500">' + svgEsc(String(pair.blurb).slice(0, 68)) + '</text>';
      }
      return row;
    }).join('');
    return kicker + rows + skylineSilhouette(W, H, '#572e88', 0.14);
  }

  function programmePageImage(page, index) {
    var size = pagePixelSize();
    var W = size.width, H = size.height;
    var isCover = page && page.type === 'cover';
    var isCastList = page && (page.type === 'cast' || page.type === 'characters');
    var title = page && page.title ? page.title : 'Programme Page';
    var lines = pageSummaryLines(page);
    var font = 'Arial, Helvetica, sans-serif';

    var pageNumberChip = index === 0 ? '' :
      '<circle cx="' + (W - 46) + '" cy="' + (H - 46) + '" r="19" fill="#efab45"/>' +
      '<text x="' + (W - 46) + '" y="' + (H - 40) + '" fill="#000000" text-anchor="middle" font-family="' + font + '" font-size="16" font-weight="800">' + (index + 1) + '</text>';

    var svg;
    if (isCover) {
      var bandHeight = Math.round(H * 0.62);
      var subtitle = lines[0] || 'Digital Programme';
      svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
        '<rect width="100%" height="100%" fill="#ffffff"/>' +
        '<rect x="0" y="0" width="' + W + '" height="' + bandHeight + '" fill="#572e88"/>' +
        skylineSilhouette(W, bandHeight, '#000000', 0.18) +
        '<text x="60" y="76" fill="#ffffff" opacity="0.8" font-family="' + font + '" font-size="14" font-weight="800" letter-spacing="3">DIGITAL PROGRAMME</text>' +
        '<text x="' + (W / 2) + '" y="' + Math.round(bandHeight * 0.42) + '" fill="#ffffff" text-anchor="middle" font-family="' + SERIF + '" font-style="italic" font-size="46" font-weight="700">' + svgEsc(title.slice(0, 24)) + '</text>' +
        '<rect x="' + (W / 2 - 60) + '" y="' + (Math.round(bandHeight * 0.42) + 22) + '" width="120" height="4" rx="2" fill="#efab45"/>' +
        '<text x="' + (W / 2) + '" y="' + (bandHeight - 40) + '" fill="#ffffff" text-anchor="middle" font-family="' + font + '" font-size="19" font-weight="700">' + svgEsc(subtitle.slice(0, 40)) + '</text>' +
        pageNumberChip +
      '</svg>';
      return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    }

    var body;
    if (isCastList) {
      body = renderCastListArt(page, W, H, font);
    } else {
      var hasContent = lines.length > 0 && lines[0] !== 'Waiting for source data';
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
    }

    var titleHtml = isCastList
      ? '<text x="60" y="128" fill="#572e88" font-family="' + SERIF + '" font-style="italic" font-size="36" font-weight="700">' + svgEsc(title.slice(0, 26)) + '</text>'
      : '<text x="60" y="128" fill="#000000" font-family="' + font + '" font-size="38" font-weight="900">' + svgEsc(title.slice(0, 26)) + '</text>';

    svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
      '<rect width="100%" height="100%" fill="#ffffff"/>' +
      '<text x="60" y="76" fill="#572e88" font-family="' + font + '" font-size="15" font-weight="800" letter-spacing="2">PROGRAMME</text>' +
      titleHtml +
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
        renderBuilderShell(pages) +
        renderSettingsModal() +
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
    toggleReorder: function () {
      ProgrammeState.reordering = !ProgrammeState.reordering;
      renderPlanner();
    },
    movePage: function (index, delta) {
      var pages = buildProgrammePages();
      var page = pages[index];
      if (!page) return;
      var sections = ProgrammeState.settings.sections.slice();
      var pos = sections.indexOf(page.sectionKey);
      var newPos = pos + (delta > 0 ? 1 : -1);
      if (pos < 0 || newPos < 0 || newPos >= sections.length) return;
      var swap = sections[pos];
      sections[pos] = sections[newPos];
      sections[newPos] = swap;
      ProgrammeState.settings.sections = sections;
      renderPlanner();
    },
    openSettings: function () {
      ProgrammeState.settingsOpen = true;
      renderPlanner();
    },
    closeSettings: function () {
      ProgrammeState.settingsOpen = false;
      renderPlanner();
    },
    setSettingsTab: function (tab) {
      ProgrammeState.settingsTab = tab;
      renderPlanner();
    },
    destroy: function () {},
  };
})();
