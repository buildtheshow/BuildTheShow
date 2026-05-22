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
      image: '/ASSETS/Images/programme-%205.5x11-folded-8.5x11.svg',
    },
    {
      id: 'letter-flat',
      label: '11 x 8.5 in',
      detail: '(not folded, from 8.5 x 11 in paper)',
      note: 'Full letter pages',
      pageLabel: '11 x 8.5 in pages',
      image: '/ASSETS/Images/programme-8.5x11.svg',
    },
    {
      id: 'tabloid-folded',
      label: '11 x 8.5 in',
      detail: '(folded in half from 11 x 17 in paper)',
      note: 'Large booklet programme',
      pageLabel: '11 x 8.5 in folded pages',
      image: '/ASSETS/Images/programme-8.5x11Folded-11x17.svg',
    },
  ];

  var TEMPLATE_OPTIONS = [
    {
      id: 'classic-theatre',
      label: 'Classic Theatre',
      detail: 'Balanced notes, cast, bios, sponsors, ads',
      accent: '#572e88',
    },
    {
      id: 'modern-clean',
      label: 'Modern Clean',
      detail: 'More white space, simple section flow',
      accent: '#476aaa',
    },
    {
      id: 'sponsor-heavy',
      label: 'Sponsor Heavy',
      detail: 'Earlier ad blocks and stronger sponsor placement',
      accent: '#efab45',
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
    spreadStart: 0,
    sideTab: 'setup',
    flipDirection: 'none',
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

  function renderPaperPicker() {
    var selected = selectedPaper().id;
    return '<div class="pgm-paper-picker" role="radiogroup" aria-label="Programme paper">' +
      PAPER_OPTIONS.map(function (paper) {
        var isSelected = selected === paper.id;
        return '<label class="pgm-paper-card' + (isSelected ? ' is-selected' : '') + '">' +
          '<input type="radio" name="pgm-paper" value="' + esc(paper.id) + '"' + (isSelected ? ' checked' : '') + ' onchange="MarketingProgrammeModule.setSetting(\'paper\', this.value)" />' +
          '<span class="pgm-paper-visual pgm-paper-visual--' + esc(paper.id) + '"><img src="' + esc(paper.image) + '" alt="" /></span>' +
          '<span class="pgm-paper-copy">' +
            '<strong>' + esc(paper.label) + '</strong>' +
            '<em>' + esc(paper.detail) + '</em>' +
            '<small>' + esc(paper.note) + '</small>' +
          '</span>' +
        '</label>';
      }).join('') +
    '</div>';
  }

  function renderTemplatePicker() {
    var selected = ProgrammeState.settings.template;
    return '<div class="pgm-template-picker" role="radiogroup" aria-label="Programme template">' +
      TEMPLATE_OPTIONS.map(function (template) {
        var isSelected = selected === template.id;
        return '<label class="pgm-template-option' + (isSelected ? ' is-selected' : '') + '" style="--pgm-template-accent:' + esc(template.accent) + ';">' +
          '<input type="radio" name="pgm-template" value="' + esc(template.id) + '"' + (isSelected ? ' checked' : '') + ' onchange="MarketingProgrammeModule.setSetting(\'template\', this.value)" />' +
          '<span class="pgm-template-thumb" aria-hidden="true"><span></span><span></span><span></span></span>' +
          '<span class="pgm-template-copy"><strong>' + esc(template.label) + '</strong><em>' + esc(template.detail) + '</em></span>' +
        '</label>';
      }).join('') +
    '</div>';
  }

  function renderSetupTab() {
    var paper = selectedPaper();
    return '<div class="pgm-side-scroll">' +
      '<div class="pgm-paper-heading">Paper</div>' +
      renderPaperPicker() +
      '<div class="pgm-paper-note">Preview pages are shown as ' + paper.pageLabel + '.</div>' +
      '<div class="pgm-paper-heading">Template</div>' +
      renderTemplatePicker() +
      '<div class="pgm-control-grid">' +
        selectControl('Output', 'output', [['print', 'Print'], ['digital', 'Digital'], ['proof', 'Proof only']]) +
        selectControl('Booklet', 'booklet', [['saddle-stitch', 'Saddle stitch'], ['single-pages', 'Single pages'], ['digital-scroll', 'Digital scroll']]) +
        selectControl('Bio Layout', 'bioLayout', [['headshot-grid', 'Headshot grid'], ['text-compact', 'Compact text'], ['featured-bios', 'Featured bios']]) +
      '</div>' +
    '</div>';
  }

  function renderSectionsTab() {
    var checked = new Set(ProgrammeState.settings.sections);
    return '<div class="pgm-side-scroll">' +
      '<div class="pgm-side-help">Choose which structured sections BTS should place into this programme.</div>' +
      '<div class="pgm-section-picker">' + SECTION_OPTIONS.map(function (item) {
        return '<label class="pgm-section-option"><input type="checkbox" ' + (checked.has(item[0]) ? 'checked' : '') + ' onchange="MarketingProgrammeModule.toggleSection(\'' + esc(item[0]) + '\', this.checked)" /> <span>' + esc(item[1]) + '</span></label>';
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
    return '<div class="pgm-side-scroll">' +
      '<div class="pgm-side-help">Choose the page shapes BTS should use when it auto-places each type of programme content.</div>' +
      '<div class="pgm-layout-groups">' + PAGE_LAYOUT_GROUPS.map(function (group) {
        return '<section class="pgm-layout-group">' +
          '<div class="pgm-layout-group-head"><strong>' + esc(group.title) + '</strong><span>' + esc(group.detail) + '</span></div>' +
          '<div class="pgm-layout-options">' + group.options.map(function (option) {
            var isSelected = selected[group.key] === option.id;
            return '<button class="pgm-layout-option' + (isSelected ? ' is-selected' : '') + '" type="button" onclick="MarketingProgrammeModule.setPageLayout(\'' + esc(group.key) + '\', \'' + esc(option.id) + '\')">' +
              renderLayoutMockup(option) +
              '<span class="pgm-layout-option-copy"><strong>' + esc(option.label) + '</strong><em>' + esc(option.detail) + '</em></span>' +
            '</button>';
          }).join('') + '</div>' +
        '</section>';
      }).join('') + '</div>' +
    '</div>';
  }

  function selectControl(label, key, options) {
    return '<label class="pgm-control"><span>' + esc(label) + '</span><select onchange="MarketingProgrammeModule.setSetting(\'' + esc(key) + '\', this.value)">' +
      options.map(function (item) {
        return '<option value="' + esc(item[0]) + '"' + (ProgrammeState.settings[key] === item[0] ? ' selected' : '') + '>' + esc(item[1]) + '</option>';
      }).join('') +
    '</select></label>';
  }

  function renderReadiness(pages) {
    var ready = buildReadiness();
    var blockers = ready.missingAds + ready.unapprovedAds + ready.missingBios + ready.missingHeadshots + ready.openDeliverables;
    var paper = selectedPaper();
    return '<div class="pgm-status-grid">' +
      statusTile('Page Estimate', String(pages.length), paper.pageLabel, 'info') +
      statusTile('Print Readiness', blockers ? 'Not Ready' : 'Ready', blockers ? blockers + ' item' + (blockers === 1 ? '' : 's') + ' need attention' : 'Ready for proof review', blockers ? 'warn' : 'good') +
      statusTile('Missing Ads', String(ready.missingAds), 'Artwork placeholders', statusClass(ready.missingAds)) +
      statusTile('Unapproved Art', String(ready.unapprovedAds), 'Needs artwork approval', statusClass(ready.unapprovedAds)) +
      statusTile('Unpaid Revenue', String(ready.unpaidAds + ready.unpaidSponsors), 'Internal only, hidden from print', statusClass(ready.unpaidAds + ready.unpaidSponsors)) +
      statusTile('Missing Bios', String(ready.missingBios), 'Cast bio placeholders', statusClass(ready.missingBios)) +
      statusTile('Missing Headshots', String(ready.missingHeadshots), 'Bio image placeholders', statusClass(ready.missingHeadshots)) +
      statusTile('Open Deliverables', String(ready.openDeliverables), 'Sponsor promises not done', statusClass(ready.openDeliverables)) +
    '</div>';
  }

  function renderSideTabButton(key, label) {
    return '<button class="pgm-side-tab' + (ProgrammeState.sideTab === key ? ' is-active' : '') + '" type="button" onclick="MarketingProgrammeModule.setSideTab(\'' + esc(key) + '\')">' + esc(label) + '</button>';
  }

  function renderPreviewSidebar(pages, start, isCover) {
    var tab = ProgrammeState.sideTab || 'setup';
    var body = tab === 'setup' ? renderSetupTab()
      : tab === 'status' ? '<div class="pgm-side-scroll">' + renderReadiness(pages) + '</div>'
      : tab === 'page' ? renderPageLayoutsTab()
      : renderSectionsTab();
    return '<aside class="pgm-preview-sidebar">' +
      '<div class="pgm-side-tabs">' +
        renderSideTabButton('setup', 'Setup') +
        renderSideTabButton('page', 'Page') +
        renderSideTabButton('status', 'Status') +
        renderSideTabButton('sections', 'Sections') +
      '</div>' +
      body +
    '</aside>';
  }

  function spreadStartForPage(index) {
    if (index <= 0) return 0;
    return index % 2 ? index : index - 1;
  }

  function clampSpreadStart(pages) {
    var max = Math.max(0, pages.length - 1);
    if (ProgrammeState.spreadStart > max) ProgrammeState.spreadStart = spreadStartForPage(max);
    if (ProgrammeState.spreadStart < 0) ProgrammeState.spreadStart = 0;
  }

  function pageRangeLabel(pages) {
    var start = ProgrammeState.spreadStart;
    if (!pages.length) return 'No pages';
    if (start === 0) return 'Cover / Page 1 of ' + pages.length;
    var end = Math.min(start + 1, pages.length - 1);
    return 'Pages ' + (start + 1) + (end > start ? '-' + (end + 1) : '') + ' of ' + pages.length;
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

  function renderPreviewPage(page, index, side) {
    if (!page) return '<div class="pgm-preview-page pgm-preview-page--blank pgm-preview-page--' + esc(side || '') + '"></div>';
    return '<article class="pgm-preview-page pgm-preview-page--' + esc(side || '') + '">' +
      '<div class="pgm-page-sheet pgm-page-sheet--' + esc(page.type) + ' pgm-page-sheet--paper-' + esc(selectedPaper().id) + ' pgm-page-sheet--layout-' + esc(page.layout || 'default') + '">' + pageBody(page) + '</div>' +
      '<div class="pgm-page-caption"><strong>' + esc(page.title) + '</strong><span>Page ' + (index + 1) + (page.subtitle ? ' · ' + esc(page.subtitle) : '') + '</span></div>' +
    '</article>';
  }

  function renderPageFilmstrip(pages, start, isCover) {
    return '<div class="pgm-page-filmstrip" aria-label="Programme page thumbnails">' + pages.map(function (page, index) {
      var openStart = spreadStartForPage(index);
      var active = openStart === start || (isCover && index === 0);
      return '<button class="pgm-page-thumb' + (active ? ' is-active' : '') + '" type="button" onclick="MarketingProgrammeModule.setSpread(' + openStart + ')">' +
        '<span class="pgm-page-thumb-sheet pgm-page-sheet--' + esc(page.type) + ' pgm-page-sheet--paper-' + esc(selectedPaper().id) + ' pgm-page-sheet--layout-' + esc(page.layout || 'default') + '">' + pageBody(page) + '</span>' +
        '<span class="pgm-page-thumb-meta"><strong>' + (index + 1) + '</strong><em>' + esc(page.title) + '</em></span>' +
      '</button>';
    }).join('') + '</div>';
  }

  function renderProgrammePreview(pages) {
    clampSpreadStart(pages);
    var start = ProgrammeState.spreadStart;
    var isCover = start === 0;
    var leftPage = isCover ? null : pages[start];
    var rightPage = isCover ? pages[0] : pages[start + 1];
    var leftIndex = start;
    var rightIndex = isCover ? 0 : start + 1;
    if (!isCover && leftPage && !rightPage) {
      rightPage = leftPage;
      rightIndex = start;
      leftPage = null;
    }
    var prevStart = start <= 1 ? 0 : Math.max(0, start - 2);
    var nextStart = start === 0 ? 1 : start + 2;
    var canPrev = start > 0;
    var canNext = nextStart < pages.length;
    return '<section class="pgm-panel pgm-preview-panel">' +
      '<div class="pgm-panel-head">' +
        '<div><div class="pgm-panel-title">Digital Programme Preview</div><p>' + esc(selectedPaper().pageLabel) + ' · ' + pageRangeLabel(pages) + '</p></div>' +
        '<div class="pgm-preview-controls">' +
          '<button class="spn-btn spn-btn--ghost pgm-preview-btn" type="button" ' + (canPrev ? "onclick=\"MarketingProgrammeModule.flipTo(" + prevStart + ", 'back')\"" : 'disabled') + '>Flip Back</button>' +
          '<button class="spn-btn spn-btn--primary pgm-preview-btn" type="button" ' + (canNext ? "onclick=\"MarketingProgrammeModule.flipTo(" + nextStart + ", 'forward')\"" : 'disabled') + '>Flip Forward</button>' +
          '<button class="spn-btn spn-btn--ghost" disabled>Export Later</button>' +
        '</div>' +
      '</div>' +
      '<div class="pgm-preview-layout">' +
        renderPreviewSidebar(pages, start, isCover) +
        '<div class="pgm-preview-stage pgm-preview-stage--flipbook pgm-preview-stage--paper-' + esc(selectedPaper().id) + ' pgm-preview-stage--' + esc(ProgrammeState.flipDirection || 'none') + (isCover ? ' pgm-preview-stage--cover' : ' pgm-preview-stage--spread') + '">' +
          '<div class="pgm-preview-spread">' +
            renderPreviewPage(leftPage, leftIndex, 'left') +
            '<div class="pgm-preview-gutter" aria-hidden="true"></div>' +
            renderPreviewPage(rightPage, rightIndex, 'right') +
          '</div>' +
        '</div>' +
        '<div class="pgm-filmstrip-wrap">' + renderPageFilmstrip(pages, start, isCover) + '</div>' +
      '</div>' +
    '</section>';
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
    var prod = ProgrammeState.data.production || {};
    ProgrammeState.container.innerHTML =
      '<div class="aud-visual-hero">' +
        '<div class="aud-visual-hero-content">' +
          '<div>' +
            '<div class="aud-visual-kicker"><span class="aud-visual-kicker-dot" aria-hidden="true"></span>Marketing</div>' +
            '<h1 class="aud-visual-title">Programme.</h1>' +
            '<p class="aud-visual-copy">Auto-layout the programme plan from production data, sponsor ads, cast content, and missing-materials status.</p>' +
          '</div>' +
          '<div class="aud-visual-total"><div class="aud-visual-total-kicker">Estimated</div><div class="aud-visual-total-value">' + pages.length + '</div><div class="aud-visual-total-label">Pages</div></div>' +
        '</div>' +
      '</div>' +
      renderProgrammePreview(pages);
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
      if (key === 'bios') {
        ProgrammeState.settings.bioLayout = value === 'bios-compact' ? 'text-compact' : value === 'bios-featured' ? 'featured-bios' : 'headshot-grid';
      }
      renderPlanner();
    },
    setSpread: function (start) {
      ProgrammeState.spreadStart = Number(start) || 0;
      ProgrammeState.flipDirection = 'jump';
      renderPlanner();
    },
    flipTo: function (start, direction) {
      ProgrammeState.spreadStart = Number(start) || 0;
      ProgrammeState.flipDirection = direction === 'back' ? 'back' : 'forward';
      renderPlanner();
    },
    setSideTab: function (key) {
      ProgrammeState.sideTab = key || 'setup';
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
