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
      label: '8.5&quot; x 11&quot;',
      detail: 'Folded to 5.5&quot; x 8.5&quot;',
      note: 'Standard booklet programme',
      pageLabel: '5.5&quot; x 8.5&quot; folded pages',
    },
    {
      id: 'letter-flat',
      label: '8.5&quot; x 11&quot;',
      detail: 'Not folded',
      note: 'Full letter pages',
      pageLabel: '8.5&quot; x 11&quot; pages',
    },
    {
      id: 'tabloid-folded',
      label: '11&quot; x 17&quot;',
      detail: 'Folded to 8.5&quot; x 11&quot;',
      note: 'Large booklet programme',
      pageLabel: '8.5&quot; x 11&quot; folded pages',
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
      sections: ['cover', 'welcome', 'creative', 'cast', 'bios', 'sponsors', 'ads', 'thanks', 'back'],
    },
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
    if (selected.has('cast')) pages.push({ type: 'cast', title: 'Cast List', subtitle: cast.length + ' performer' + (cast.length === 1 ? '' : 's'), items: cast });
    if (selected.has('characters')) pages.push({ type: 'characters', title: 'Character List', subtitle: ProgrammeState.data.roles.length + ' role' + (ProgrammeState.data.roles.length === 1 ? '' : 's'), items: ProgrammeState.data.roles });
    if (selected.has('bios')) {
      for (var i = 0; i < cast.length; i += 6) {
        pages.push({ type: 'bios', title: 'Cast Bios', subtitle: 'Bios ' + (i + 1) + '-' + Math.min(i + 6, cast.length), items: cast.slice(i, i + 6), capacity: 6 });
      }
      if (!cast.length) pages.push({ type: 'bios', title: 'Cast Bios', subtitle: 'Waiting for cast list', items: [], capacity: 6 });
    }
    if (selected.has('sponsors')) pages.push({ type: 'sponsors', title: 'Sponsors', subtitle: ProgrammeState.data.packages.length + ' sponsor package' + (ProgrammeState.data.packages.length === 1 ? '' : 's'), groups: sponsorGroups() });
    if (selected.has('ads')) pages = pages.concat(packAdPages());
    if (selected.has('thanks')) pages.push({ type: 'thanks', title: 'Special Thanks', subtitle: 'Community acknowledgements placeholder' });
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
          '<span class="pgm-paper-visual pgm-paper-visual--' + esc(paper.id) + '"><span></span></span>' +
          '<span class="pgm-paper-copy">' +
            '<strong>' + paper.label + '</strong>' +
            '<em>' + paper.detail + '</em>' +
            '<small>' + esc(paper.note) + '</small>' +
          '</span>' +
        '</label>';
      }).join('') +
    '</div>';
  }

  function renderSetupControls() {
    var checked = new Set(ProgrammeState.settings.sections);
    var paper = selectedPaper();
    return '<div class="pgm-builder-grid">' +
      '<section class="pgm-panel">' +
        '<div class="pgm-panel-title">Programme Setup</div>' +
        '<div class="pgm-paper-heading">Paper</div>' +
        renderPaperPicker() +
        '<div class="pgm-paper-note">Mockup pages below are shown as ' + paper.pageLabel + '.</div>' +
        '<div class="pgm-control-grid">' +
          selectControl('Output', 'output', [['print', 'Print'], ['digital', 'Digital'], ['proof', 'Proof only']]) +
          selectControl('Booklet', 'booklet', [['saddle-stitch', 'Saddle stitch'], ['single-pages', 'Single pages'], ['digital-scroll', 'Digital scroll']]) +
          selectControl('Template', 'template', [['classic-theatre', 'Classic Theatre'], ['modern-clean', 'Modern Clean'], ['youth-theatre', 'Youth Theatre'], ['sponsor-heavy', 'Sponsor Heavy']]) +
          selectControl('Bio Layout', 'bioLayout', [['headshot-grid', 'Headshot grid'], ['text-compact', 'Compact text'], ['featured-bios', 'Featured bios']]) +
        '</div>' +
      '</section>' +
      '<section class="pgm-panel">' +
        '<div class="pgm-panel-title">Included Sections</div>' +
        '<div class="pgm-section-picker">' + SECTION_OPTIONS.map(function (item) {
          return '<label class="pgm-section-option"><input type="checkbox" ' + (checked.has(item[0]) ? 'checked' : '') + ' onchange="MarketingProgrammeModule.toggleSection(\'' + esc(item[0]) + '\', this.checked)" /> <span>' + esc(item[1]) + '</span></label>';
        }).join('') + '</div>' +
      '</section>' +
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

  function renderPagePreview(page, index) {
    var body = '';
    if (page.type === 'cover') body = '<div class="pgm-page-cover-title">' + esc(page.title) + '</div><div class="pgm-page-muted">' + esc(page.subtitle) + '</div>';
    else if (page.type === 'ads') body = renderAdPage(page);
    else if (page.type === 'bios') body = renderBioPage(page);
    else if (page.type === 'sponsors') body = renderSponsorPage(page);
    else if (page.type === 'creative') body = renderSimpleList(page.items, function (item) { return [item.role || item.department || 'Team', item.name || 'Unnamed'].filter(Boolean).join(': '); }, 12);
    else if (page.type === 'cast') body = renderSimpleList(page.items, applicationName, 16);
    else if (page.type === 'characters') body = renderSimpleList(page.items, roleLabel, 18);
    else body = '<div class="pgm-placeholder-lines"><span></span><span></span><span></span><span></span></div>';
    return '<article class="pgm-page-card">' +
      '<div class="pgm-page-number">Page ' + (index + 1) + '</div>' +
      '<div class="pgm-page-sheet pgm-page-sheet--' + esc(page.type) + ' pgm-page-sheet--paper-' + esc(selectedPaper().id) + '">' + body + '</div>' +
      '<div class="pgm-page-caption"><strong>' + esc(page.title) + '</strong><span>' + esc(page.subtitle || '') + '</span></div>' +
    '</article>';
  }

  function renderSimpleList(items, labelFn, max) {
    var list = (items || []).slice(0, max || 12);
    if (!list.length) return '<div class="pgm-page-empty">Waiting for source data</div>';
    return '<div class="pgm-page-list">' + list.map(function (item) { return '<div>' + esc(labelFn(item)) + '</div>'; }).join('') + '</div>';
  }

  function renderAdPage(page) {
    var cells = [];
    for (var i = 0; i < page.capacity; i++) {
      var ad = page.items[i];
      cells.push('<div class="pgm-ad-slot pgm-ad-slot--' + esc(page.adSize) + '">' +
        (ad ? '<strong>' + esc(businessName(ad.business_id)) + '</strong><span>' + esc(ad.artwork_url ? (ad.approval_status || 'Artwork received') : 'Artwork missing') + '</span>' : '<span>Empty ad slot</span>') +
      '</div>');
    }
    return '<div class="pgm-ad-layout pgm-ad-layout--' + esc(page.adSize) + '">' + cells.join('') + '</div>';
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
    return '<div class="pgm-bio-grid">' + cells.join('') + '</div>';
  }

  function renderSponsorPage(page) {
    var groups = page.groups || [];
    if (!groups.length) return '<div class="pgm-page-empty">No sponsor packages yet</div>';
    return '<div class="pgm-sponsor-groups">' + groups.map(function (group) {
      return '<div><strong>' + esc(group.tier.label || group.tier.id) + '</strong>' +
        group.items.slice(0, 5).map(function (item) { return '<span>' + esc(businessName(item.business_id)) + '</span>'; }).join('') +
      '</div>';
    }).join('') + '</div>';
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
      '<section class="pgm-intro-band">' +
        '<div><div class="pgm-kicker">Auto-layout planner</div><h2>' + esc(prod.title || prod.name || 'Production programme') + '</h2><p>BTS owns the structure: sections, sponsor hierarchy, ad placement, bios, placeholders, approvals, and readiness. This is a logistics planner, not a freeform design canvas.</p></div>' +
      '</section>' +
      renderSetupControls() +
      renderReadiness(pages) +
      '<section class="pgm-panel">' +
        '<div class="pgm-panel-head"><div><div class="pgm-panel-title">Page Mockup</div><p>Structured preview of where content lands. Missing material appears as placeholders.</p></div><button class="spn-btn spn-btn--ghost" disabled>Export Later</button></div>' +
        '<div class="pgm-page-grid">' + pages.map(renderPagePreview).join('') + '</div>' +
      '</section>';
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
