/* marketing-programme.js — Programme auto-layout planner */
(function () {
  'use strict';

  var SUPABASE_URL = window.SUPABASE_URL || 'https://tkmaiktxpwqfbgeojbnf.supabase.co';
  var SUPABASE_ANON = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrbWFpa3R4cHdxZmJnZW9qYm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MzE4MTcsImV4cCI6MjA4OTMwNzgxN30.TkTZBNWUatk3Y6Vmfv1hIRR3DfVjgwauwa76Pf00J_8';

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
  var PROGRAMME_ASSET_BUCKET = 'production-files';

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
    editorOpen: false,
    exportOpen: false,
    dirty: false,
    saving: false,
    saveError: '',
    saveTimer: 0,
    uploadingAssetKey: '',
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
      customPages: [],
      pageOverrides: {},
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
    return fetch(url, { headers: sponsorHeaders() })
      .then(function (res) {
        if (!res.ok) return res.text().then(function (text) { throw new Error(text); });
        return res.json();
      });
  }

  function dbFetchById(table, id, select) {
    var url = SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + encodeURIComponent(id) + '&select=' + encodeURIComponent(select || '*') + '&limit=1';
    return fetch(url, { headers: sponsorHeaders() })
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

  function sponsorHeaders(extra) {
    return Object.assign({
      apikey: SUPABASE_ANON,
      Authorization: 'Bearer ' + (programmeAccessToken() || SUPABASE_ANON),
    }, extra || {});
  }

  function programmeAccessToken() {
    try {
      var raw = localStorage.getItem('sb-tkmaiktxpwqfbgeojbnf-auth-token');
      var stored = raw ? JSON.parse(raw) : null;
      return stored && (stored.access_token || (stored.currentSession && stored.currentSession.access_token)) || '';
    } catch (_) { return ''; }
  }

  function safeFileName(name) {
    return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  function uploadProgrammeAsset(file, folder, prefix) {
    var safeName = safeFileName(file && file.name ? file.name : 'asset');
    var path = ProgrammeState.prodId + '/programme-builder/' + folder + '/' + Date.now() + '_' + (prefix || 'asset') + '_' + safeName;
    return fetch(SUPABASE_URL + '/storage/v1/object/' + PROGRAMME_ASSET_BUCKET + '/' + path, {
      method: 'POST',
      headers: sponsorHeaders({ 'Content-Type': (file && file.type) || 'application/octet-stream' }),
      body: file,
    }).then(function (response) {
      if (!response.ok) return response.text().then(function (text) { throw new Error(text); });
      return {
        url: SUPABASE_URL + '/storage/v1/object/public/' + PROGRAMME_ASSET_BUCKET + '/' + path,
        path: path,
      };
    });
  }

  function removeProgrammeAsset(path) {
    if (!path) return Promise.resolve();
    return fetch(SUPABASE_URL + '/storage/v1/object/' + PROGRAMME_ASSET_BUCKET + '/' + path, {
      method: 'DELETE',
      headers: sponsorHeaders(),
    }).catch(function () { return null; });
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
      safeFetch(dbFetchById('productions', ProgrammeState.prodId, '*'), null),
      safeFetch(dbFetch('sponsor_businesses', 'select=*'), []),
      safeFetch(dbFetch('programme_ads', 'select=*'), []),
      safeFetch(dbFetch('sponsor_packages', 'select=*'), []),
      safeFetch(dbFetch('sponsor_deliverables', 'select=*'), []),
      safeFetch(dbFetch('sponsor_settings', 'select=settings&limit=1'), []),
      safeFetch(dbFetch('production_roles', 'select=*'), []),
      safeFetch(dbFetch('audition_applications', 'select=*'), []),
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
      hydrateProgrammeSettings();
    });
  }

  function hydrateProgrammeSettings() {
    var saved = ProgrammeState.data.sponsorSettings && ProgrammeState.data.sponsorSettings.programmeBuilder;
    if (!saved || typeof saved !== 'object') return;
    ProgrammeState.settings.paper = saved.paper || ProgrammeState.settings.paper;
    ProgrammeState.settings.output = saved.output || ProgrammeState.settings.output;
    ProgrammeState.settings.booklet = saved.booklet || ProgrammeState.settings.booklet;
    ProgrammeState.settings.template = saved.template || ProgrammeState.settings.template;
    ProgrammeState.settings.bioLayout = saved.bioLayout || ProgrammeState.settings.bioLayout;
    ProgrammeState.settings.pageLayouts = Object.assign({}, ProgrammeState.settings.pageLayouts, saved.pageLayouts || {});
    ProgrammeState.settings.sections = Array.isArray(saved.sections) && saved.sections.length ? saved.sections.slice() : ProgrammeState.settings.sections;
    ProgrammeState.settings.customPages = Array.isArray(saved.customPages) ? saved.customPages.slice() : [];
    ProgrammeState.settings.pageOverrides = saved.pageOverrides && typeof saved.pageOverrides === 'object' ? Object.assign({}, saved.pageOverrides) : {};
  }

  function programmeSettingsPayload() {
    return {
      paper: ProgrammeState.settings.paper,
      output: ProgrammeState.settings.output,
      booklet: ProgrammeState.settings.booklet,
      template: ProgrammeState.settings.template,
      bioLayout: ProgrammeState.settings.bioLayout,
      pageLayouts: Object.assign({}, ProgrammeState.settings.pageLayouts || {}),
      sections: (ProgrammeState.settings.sections || []).slice(),
      customPages: (ProgrammeState.settings.customPages || []).map(function (page) { return Object.assign({}, page); }),
      pageOverrides: Object.assign({}, ProgrammeState.settings.pageOverrides || {}),
    };
  }

  function persistProgrammeSettings() {
    var prodId = ProgrammeState.prodId;
    var ts = new Date().toISOString();
    var nextSettings = Object.assign({}, ProgrammeState.data.sponsorSettings || {});
    nextSettings.programmeBuilder = programmeSettingsPayload();
    ProgrammeState.saving = true;
    ProgrammeState.saveError = '';
    renderPlanner();
    return fetch(SUPABASE_URL + '/rest/v1/sponsor_settings?production_id=eq.' + encodeURIComponent(prodId), {
      method: 'PATCH',
      headers: sponsorHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal,count=exact' }),
      body: JSON.stringify({ settings: nextSettings, updated_at: ts }),
    }).then(function (response) {
      if (!response.ok) return response.text().then(function (text) { throw new Error(text); });
      var range = response.headers.get('content-range') || '';
      if (/\/0$/.test(range)) {
        return fetch(SUPABASE_URL + '/rest/v1/sponsor_settings', {
          method: 'POST',
          headers: sponsorHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
          body: JSON.stringify({ production_id: prodId, settings: nextSettings, updated_at: ts }),
        }).then(function (insertResponse) {
          if (!insertResponse.ok) return insertResponse.text().then(function (text) { throw new Error(text); });
        });
      }
    }).then(function () {
      ProgrammeState.data.sponsorSettings = nextSettings;
      ProgrammeState.dirty = false;
    }).catch(function (error) {
      console.error('[BTS] Could not save programme settings.', error);
      ProgrammeState.saveError = 'Could not save changes';
    }).finally(function () {
      ProgrammeState.saving = false;
      renderPlanner();
    });
  }

  function queueProgrammeSave() {
    ProgrammeState.dirty = true;
    ProgrammeState.saveError = '';
    if (ProgrammeState.saveTimer) window.clearTimeout(ProgrammeState.saveTimer);
    ProgrammeState.saveTimer = window.setTimeout(function () {
      ProgrammeState.saveTimer = 0;
      persistProgrammeSettings();
    }, 700);
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
    return app.name || app.display_name || app.full_name || 'Unnamed performer';
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

  function connectionRoute(item) {
    if (!item || !item.label) return null;
    if (item.label === 'Creative Team') return { type: 'production', tab: 'team', label: 'Open Team' };
    if (item.label === 'Cast List' || item.label === 'Cast Bios') return { type: 'production', tab: 'cast', label: 'Open Cast' };
    if (item.label === 'Sponsors') return { type: 'marketing', tab: 'sponsors', label: 'Open Sponsors' };
    if (item.label === 'Programme Ads') return { type: 'marketing', tab: 'programmeads', label: 'Open Ads' };
    if (item.label === 'Volunteers') return { type: 'production', tab: 'volunteers', label: 'Open Volunteers' };
    return null;
  }

  function defaultOverrideForPage(page) {
    return {
      syncMode: page && page.sectionKey === 'custom' ? 'manual' : 'auto',
      title: page && page.title ? page.title : '',
      subtitle: page && page.subtitle ? page.subtitle : '',
      headerText: page && page.type === 'cover' ? 'DIGITAL PROGRAMME' : 'PROGRAMME',
      bodyText: '',
      coverImage: '',
      coverImagePath: '',
      accentColor: '#572e88',
      textColor: page && page.type === 'cover' ? '#ffffff' : '#000000',
      showHeader: true,
      blocks: [],
    };
  }

  function createPageBlock(type) {
    if (type === 'image') {
      return {
        type: 'image',
        title: 'Image Caption',
        text: 'Add a photo, poster, or artwork URL.',
        imageUrl: '',
        imagePath: '',
      };
    }
    if (type === 'quote') {
      return {
        type: 'quote',
        title: 'Pull Quote',
        text: 'A short quote, testimonial, or highlighted line.',
        imageUrl: '',
        imagePath: '',
      };
    }
    if (type === 'divider') {
      return {
        type: 'divider',
        title: 'Section Break',
        text: '',
        imageUrl: '',
        imagePath: '',
      };
    }
    return {
      type: 'text',
      title: 'Text Block',
      text: 'Add body copy, acknowledgements, or custom programme notes.',
      imageUrl: '',
      imagePath: '',
    };
  }

  function normaliseBlocks(blocks) {
    if (!Array.isArray(blocks)) return [];
    return blocks.map(function (block) {
      var type = block && block.type ? block.type : 'text';
      var base = createPageBlock(type);
      return Object.assign({}, base, block, { type: type });
    });
  }

  function pageOverride(page) {
    var map = ProgrammeState.settings.pageOverrides || {};
    var existing = map[page.pageId] || {};
    return Object.assign({}, defaultOverrideForPage(page), existing);
  }

  function pageWithOverrides(page) {
    if (!page) return page;
    var override = pageOverride(page);
    var next = Object.assign({}, page, { override: override });
    if (override.title) next.title = override.title;
    if (override.subtitle) next.subtitle = override.subtitle;
    next.syncMode = override.syncMode || 'auto';
    next.headerText = override.headerText;
    next.bodyText = override.bodyText;
    next.coverImage = override.coverImage;
    next.coverImagePath = override.coverImagePath || '';
    next.accentColor = override.accentColor || '#572e88';
    next.textColor = override.textColor || (next.type === 'cover' ? '#ffffff' : '#000000');
    next.showHeader = override.showHeader !== false;
    next.blocks = normaliseBlocks(override.blocks);
    return next;
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
          pageId: 'ads-' + sizeId + '-' + (i / capacity),
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
    if (key === 'cover') return [{ pageId: 'cover-0', type: 'cover', title: prod.title || prod.name || 'Production Title', subtitle: [prod.venue, prod.start_date].filter(Boolean).join(' · ') || 'Cover page' }];
    if (key === 'welcome') return [{ pageId: 'welcome-0', type: 'note', title: 'Welcome Note', subtitle: 'Producer or organisation message placeholder' }];
    if (key === 'director') return [{ pageId: 'director-0', type: 'note', title: 'Director Note', subtitle: prod.director ? 'From ' + prod.director : 'Director note placeholder' }];
    if (key === 'land') return [{ pageId: 'land-0', type: 'note', title: 'Land Acknowledgement', subtitle: 'Structured text placeholder' }];
    if (key === 'creative') return [{ pageId: 'creative-0', type: 'creative', title: 'Creative Team', subtitle: team.length + ' team member' + (team.length === 1 ? '' : 's'), items: team }];
    if (key === 'cast') return [{ pageId: 'cast-0', type: 'cast', title: 'Cast List', subtitle: cast.length + ' performer' + (cast.length === 1 ? '' : 's'), items: cast, layout: ProgrammeState.settings.pageLayouts.cast }];
    if (key === 'characters') return [{ pageId: 'characters-0', type: 'characters', title: 'Character List', subtitle: ProgrammeState.data.roles.length + ' role' + (ProgrammeState.data.roles.length === 1 ? '' : 's'), items: ProgrammeState.data.roles, layout: ProgrammeState.settings.pageLayouts.cast }];
    if (key === 'bios') {
      var bioCapacity = ProgrammeState.settings.pageLayouts.bios === 'bios-compact' ? 10 : ProgrammeState.settings.pageLayouts.bios === 'bios-featured' ? 4 : 6;
      var bioPages = [];
      for (var i = 0; i < cast.length; i += bioCapacity) {
        bioPages.push({ pageId: 'bios-' + (i / bioCapacity), type: 'bios', title: 'Cast Bios', subtitle: 'Bios ' + (i + 1) + '-' + Math.min(i + bioCapacity, cast.length), items: cast.slice(i, i + bioCapacity), capacity: bioCapacity, layout: ProgrammeState.settings.pageLayouts.bios });
      }
      if (!cast.length) bioPages.push({ pageId: 'bios-0', type: 'bios', title: 'Cast Bios', subtitle: 'Waiting for cast list', items: [], capacity: bioCapacity, layout: ProgrammeState.settings.pageLayouts.bios });
      return bioPages;
    }
    if (key === 'sponsors') return [{ pageId: 'sponsors-0', type: 'sponsors', title: 'Sponsors', subtitle: ProgrammeState.data.packages.length + ' sponsor package' + (ProgrammeState.data.packages.length === 1 ? '' : 's'), groups: sponsorGroups(), layout: ProgrammeState.settings.pageLayouts.sponsors }];
    if (key === 'ads') return packAdPages();
    if (key === 'thanks') return [{ pageId: 'thanks-0', type: 'thanks', title: 'Special Thanks', subtitle: 'Community acknowledgements placeholder', layout: ProgrammeState.settings.pageLayouts.thanks }];
    if (key === 'upcoming') return [{ pageId: 'upcoming-0', type: 'upcoming', title: 'Upcoming Shows', subtitle: 'Future season placeholder' }];
    if (key === 'back') return [{ pageId: 'back-0', type: 'back', title: 'Back Cover', subtitle: 'Back cover or final sponsor placement' }];
    return [];
  }

  function buildProgrammePages() {
    var pages = [];
    ProgrammeState.settings.sections.forEach(function (key) {
      pagesForSection(key).forEach(function (page) {
        page.sectionKey = key;
        page.connections = pageConnections(page);
        pages.push(pageWithOverrides(page));
      });
    });
    (ProgrammeState.settings.customPages || []).forEach(function (page, index) {
      var custom = pageWithOverrides(Object.assign({
        pageId: page.pageId || ('custom-' + index),
        sectionKey: 'custom',
        type: 'custom',
        title: page.title || 'Custom Page',
        subtitle: page.subtitle || 'Fully custom content',
        connections: [],
      }, page));
      pages.push(custom);
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

  function exportPaperSpec() {
    var paper = selectedPaper();
    if (paper.id === 'letter-flat') {
      return {
        id: paper.id,
        label: paper.label,
        mode: 'flat',
        sheetLabel: '8.5 x 11 in sheet',
        sideLabel: 'Full-page side',
        pagesPerSheet: 2,
      };
    }
    return {
      id: paper.id,
      label: paper.label,
      mode: 'booklet',
      sheetLabel: paper.id === 'tabloid-folded' ? '11 x 17 in folded sheet' : '8.5 x 11 in folded sheet',
      sideLabel: 'Booklet side',
      pagesPerSheet: 4,
    };
  }

  function pageSlotLabel(slot) {
    if (!slot || slot.isBlank) return 'Blank';
    return 'Page ' + slot.pageNumber + ' · ' + (slot.title || 'Programme page');
  }

  function exportSlot(page, index, image) {
    if (!page) return { isBlank: true, pageNumber: null, title: 'Blank', image: '', kind: 'blank' };
    return {
      isBlank: false,
      pageNumber: index + 1,
      title: page.title || pageTypeLabel(page),
      image: image || '',
      kind: page.type || 'page',
    };
  }

  function exportPlan(pages) {
    var list = pages || buildProgrammePages();
    var images = programmePageImages(list);
    var spec = exportPaperSpec();
    if (spec.mode === 'flat') {
      return {
        spec: spec,
        paddedCount: list.length,
        blanksAdded: list.length % 2,
        sheets: Array.from({ length: Math.ceil(list.length / 2) || 1 }).map(function (_, sheetIndex) {
          var frontIndex = sheetIndex * 2;
          var backIndex = frontIndex + 1;
          return {
            sheetNumber: sheetIndex + 1,
            front: { side: 'Front', slots: [exportSlot(list[frontIndex], frontIndex, images[frontIndex])] },
            back: { side: 'Back', slots: [exportSlot(list[backIndex], backIndex, images[backIndex])] },
          };
        }),
      };
    }
    var paddedCount = Math.max(4, Math.ceil(list.length / 4) * 4);
    var padded = [];
    for (var i = 0; i < paddedCount; i++) padded.push(exportSlot(list[i], i, images[i]));
    return {
      spec: spec,
      paddedCount: paddedCount,
      blanksAdded: paddedCount - list.length,
      sheets: Array.from({ length: paddedCount / 4 }).map(function (_, sheetIndex) {
        var total = paddedCount;
        var leftFront = padded[total - 1 - (sheetIndex * 2)];
        var rightFront = padded[sheetIndex * 2];
        var leftBack = padded[(sheetIndex * 2) + 1];
        var rightBack = padded[total - 2 - (sheetIndex * 2)];
        return {
          sheetNumber: sheetIndex + 1,
          front: { side: 'Front', slots: [leftFront, rightFront] },
          back: { side: 'Back', slots: [leftBack, rightBack] },
        };
      }),
    };
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
    var saveLabel = ProgrammeState.saveError
      ? ProgrammeState.saveError
      : ProgrammeState.saving
        ? 'Saving...'
        : ProgrammeState.dirty
          ? 'Unsaved changes'
          : 'Saved';
    return '<div class="pgmb-header">' +
      '<div class="pgmb-header-copy">' +
        '<div class="pgmb-header-kicker">Programme Builder</div>' +
        '<h1>' + esc(prod.title || prod.name || 'Programme Builder') + '</h1>' +
        '<p>Create and customise your show programme.</p>' +
      '</div>' +
      '<div class="pgmb-header-actions">' +
        '<span class="pgmb-save-pill' + (ProgrammeState.saveError ? ' is-error' : ProgrammeState.saving ? ' is-saving' : ProgrammeState.dirty ? ' is-dirty' : ' is-saved') + '">' + esc(saveLabel) + '</span>' +
        '<button class="pgmb-btn pgmb-btn--ghost" type="button" onclick="MarketingProgrammeModule.previewAll()">Preview All Pages</button>' +
        '<button class="pgmb-btn pgmb-btn--ghost" type="button" onclick="MarketingProgrammeModule.openEditor()">Edit Page</button>' +
        '<button class="pgmb-btn pgmb-btn--primary" type="button" onclick="MarketingProgrammeModule.openExport()">' + iconImg('Upload - Document.svg', 15) + ' Export PDF</button>' +
        '<button class="pgmb-btn pgmb-btn--soft" type="button" onclick="MarketingProgrammeModule.saveNow()">Save</button>' +
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
      '<button class="pgmb-add-custom-btn" type="button" onclick="MarketingProgrammeModule.addCustomPage()">+ Add Custom Page</button>' +
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

  function currentPageData() {
    return buildProgrammePages()[ProgrammeState.currentPage] || null;
  }

  function renderEditorModal() {
    if (!ProgrammeState.editorOpen) return '';
    var page = currentPageData();
    if (!page) return '';
    var override = page.override || pageOverride(page);
    var isCustom = page.sectionKey === 'custom';
    var blocks = normaliseBlocks(override.blocks);
    var isManual = override.syncMode === 'manual';
    var sourceCount = (page.connections || []).length;
    return '<div class="pgmb-modal-overlay" onclick="if(event.target===this)MarketingProgrammeModule.closeEditor()">' +
      '<div class="pgmb-modal pgmb-editor-modal">' +
        '<div class="pgmb-modal-head">' +
          '<div><strong>Edit ' + esc(page.title || pageTypeLabel(page)) + '</strong><span>Customise this page while keeping live BTS data available when you want it.</span></div>' +
          '<button class="pgmb-modal-close" type="button" onclick="MarketingProgrammeModule.closeEditor()">&times;</button>' +
        '</div>' +
        '<div class="pgmb-modal-body">' +
          '<div class="pgmb-mode-card-row">' +
            '<button class="pgmb-mode-card' + (!isManual ? ' is-active' : '') + '" type="button" onclick="MarketingProgrammeModule.setPageOverride(\'' + esc(page.pageId) + '\',\'syncMode\',\'auto\')">' +
              '<strong>Keep Synced</strong><span>' + (sourceCount ? 'This page stays connected to live show data.' : 'Use this for standard generated pages.') + '</span>' +
            '</button>' +
            '<button class="pgmb-mode-card' + (isManual ? ' is-active' : '') + '" type="button" onclick="MarketingProgrammeModule.setPageOverride(\'' + esc(page.pageId) + '\',\'syncMode\',\'manual\')">' +
              '<strong>Customise Freely</strong><span>Add your own layout, copy, images, and section breaks.</span>' +
            '</button>' +
          '</div>' +
          '<div class="pgmb-editor-note">' + (isManual
            ? 'Manual mode is on. This page can use custom content blocks and override the live programme layout.'
            : 'Connected mode is on. Titles and colours can still be adjusted, and you can switch to manual whenever you want a bespoke layout.') + '</div>' +
          '<div class="pgmb-editor-grid">' +
            '<label class="pgmb-editor-field"><span>Sync Mode</span><select onchange="MarketingProgrammeModule.setPageOverride(\'' + esc(page.pageId) + '\',\'syncMode\',this.value)"><option value="auto"' + (override.syncMode === 'auto' ? ' selected' : '') + '>Connected to BTS data</option><option value="manual"' + (override.syncMode === 'manual' ? ' selected' : '') + '>Manual override</option></select></label>' +
            '<label class="pgmb-editor-field"><span>Header Label</span><input type="text" value="' + esc(override.headerText || '') + '" oninput="MarketingProgrammeModule.setPageOverride(\'' + esc(page.pageId) + '\',\'headerText\',this.value)" placeholder="PROGRAMME" /></label>' +
            '<label class="pgmb-editor-field"><span>Page Title</span><input type="text" value="' + esc(override.title || '') + '" oninput="MarketingProgrammeModule.setPageOverride(\'' + esc(page.pageId) + '\',\'title\',this.value)" placeholder="Page title" /></label>' +
            '<label class="pgmb-editor-field"><span>Subtitle</span><input type="text" value="' + esc(override.subtitle || '') + '" oninput="MarketingProgrammeModule.setPageOverride(\'' + esc(page.pageId) + '\',\'subtitle\',this.value)" placeholder="Subtitle or supporting line" /></label>' +
            '<label class="pgmb-editor-field pgmb-editor-field--full"><span>' + (isManual ? 'Fallback Body Copy' : 'Manual Note / Override Copy') + '</span><textarea oninput="MarketingProgrammeModule.setPageOverride(\'' + esc(page.pageId) + '\',\'bodyText\',this.value)" placeholder="' + (isManual ? 'Optional backup text if you are not using blocks.' : 'Optional copy if you later switch this page to manual.') + '">' + esc(override.bodyText || '') + '</textarea></label>' +
            '<label class="pgmb-editor-field pgmb-editor-field--full"><span>Cover / Background Image URL</span><input type="text" value="' + esc(override.coverImage || '') + '" oninput="MarketingProgrammeModule.setPageOverride(\'' + esc(page.pageId) + '\',\'coverImage\',this.value)" placeholder="https://... or /ASSETS/..." /></label>' +
            '<div class="pgmb-upload-row pgmb-editor-field pgmb-editor-field--full">' +
              '<span>Cover / Background Upload</span>' +
              '<div class="pgmb-upload-actions">' +
                '<button class="pgmb-mini-btn" type="button" onclick="MarketingProgrammeModule.uploadCoverImage(\'' + esc(page.pageId) + '\')">' + (ProgrammeState.uploadingAssetKey === ('cover:' + page.pageId) ? 'Uploading...' : 'Upload Image') + '</button>' +
                (override.coverImage ? '<button class="pgmb-mini-btn is-danger" type="button" onclick="MarketingProgrammeModule.clearCoverImage(\'' + esc(page.pageId) + '\')">Remove Image</button>' : '') +
              '</div>' +
            '</div>' +
            '<label class="pgmb-editor-field"><span>Accent Colour</span><input type="color" value="' + esc(override.accentColor || '#572e88') + '" oninput="MarketingProgrammeModule.setPageOverride(\'' + esc(page.pageId) + '\',\'accentColor\',this.value)" /></label>' +
            '<label class="pgmb-editor-field"><span>Text Colour</span><input type="color" value="' + esc(override.textColor || (page.type === 'cover' ? '#ffffff' : '#000000')) + '" oninput="MarketingProgrammeModule.setPageOverride(\'' + esc(page.pageId) + '\',\'textColor\',this.value)" /></label>' +
            '<label class="pgmb-editor-check"><input type="checkbox"' + (override.showHeader !== false ? ' checked' : '') + ' onchange="MarketingProgrammeModule.setPageOverride(\'' + esc(page.pageId) + '\',\'showHeader\',this.checked)" /> <span>Show page header label</span></label>' +
          '</div>' +
          '<div class="pgmb-blocks-section' + (isManual ? '' : ' is-disabled') + '">' +
            '<div class="pgmb-blocks-head">' +
              '<div><strong>Page Blocks</strong><span>Build a custom page with text, quotes, images, and dividers.</span></div>' +
              '<div class="pgmb-block-actions">' +
                '<button class="pgmb-mini-btn" type="button"' + (isManual ? '' : ' disabled') + ' onclick="MarketingProgrammeModule.addPageBlock(\'' + esc(page.pageId) + '\',\'text\')">+ Text</button>' +
                '<button class="pgmb-mini-btn" type="button"' + (isManual ? '' : ' disabled') + ' onclick="MarketingProgrammeModule.addPageBlock(\'' + esc(page.pageId) + '\',\'image\')">+ Image</button>' +
                '<button class="pgmb-mini-btn" type="button"' + (isManual ? '' : ' disabled') + ' onclick="MarketingProgrammeModule.addPageBlock(\'' + esc(page.pageId) + '\',\'quote\')">+ Quote</button>' +
                '<button class="pgmb-mini-btn" type="button"' + (isManual ? '' : ' disabled') + ' onclick="MarketingProgrammeModule.addPageBlock(\'' + esc(page.pageId) + '\',\'divider\')">+ Divider</button>' +
              '</div>' +
            '</div>' +
            (isManual ? '' : '<div class="pgmb-block-empty">Switch this page to manual mode to arrange your own blocks while keeping the connected version available as a fallback.</div>') +
            (isManual && blocks.length
              ? '<div class="pgmb-block-list">' + blocks.map(function (block, index) {
                  var isTextual = block.type === 'text' || block.type === 'quote';
                  var isImage = block.type === 'image';
                  return '<div class="pgmb-block-card">' +
                    '<div class="pgmb-block-card-head">' +
                      '<strong>' + esc((block.type || 'text').charAt(0).toUpperCase() + (block.type || 'text').slice(1)) + ' Block</strong>' +
                      '<div class="pgmb-block-moves">' +
                        '<button class="pgmb-mini-btn" type="button" ' + (index === 0 ? 'disabled' : '') + ' onclick="MarketingProgrammeModule.movePageBlock(\'' + esc(page.pageId) + '\',' + index + ',-1)">Up</button>' +
                        '<button class="pgmb-mini-btn" type="button" ' + (index === blocks.length - 1 ? 'disabled' : '') + ' onclick="MarketingProgrammeModule.movePageBlock(\'' + esc(page.pageId) + '\',' + index + ',1)">Down</button>' +
                        '<button class="pgmb-mini-btn is-danger" type="button" onclick="MarketingProgrammeModule.removePageBlock(\'' + esc(page.pageId) + '\',' + index + ')">Remove</button>' +
                      '</div>' +
                    '</div>' +
                    (block.type === 'divider'
                      ? '<div class="pgmb-block-divider-preview"></div>'
                      : '<label class="pgmb-editor-field"><span>Heading</span><input type="text" value="' + esc(block.title || '') + '" oninput="MarketingProgrammeModule.updatePageBlock(\'' + esc(page.pageId) + '\',' + index + ',\'title\',this.value)" placeholder="Block heading" /></label>') +
                    (isTextual || isImage
                      ? '<label class="pgmb-editor-field"><span>' + (isImage ? 'Caption / Description' : 'Copy') + '</span><textarea oninput="MarketingProgrammeModule.updatePageBlock(\'' + esc(page.pageId) + '\',' + index + ',\'text\',this.value)" placeholder="' + (isImage ? 'Describe the image, add a caption, or note placement.' : 'Add custom copy for this block.') + '">' + esc(block.text || '') + '</textarea></label>'
                      : '') +
                    (isImage
                      ? '<label class="pgmb-editor-field"><span>Image URL</span><input type="text" value="' + esc(block.imageUrl || '') + '" oninput="MarketingProgrammeModule.updatePageBlock(\'' + esc(page.pageId) + '\',' + index + ',\'imageUrl\',this.value)" placeholder="https://... or /ASSETS/..." /></label>' +
                        '<div class="pgmb-upload-row pgmb-editor-field">' +
                          '<span>Image Upload</span>' +
                          '<div class="pgmb-upload-actions">' +
                            '<button class="pgmb-mini-btn" type="button" onclick="MarketingProgrammeModule.uploadPageBlockImage(\'' + esc(page.pageId) + '\',' + index + ')">' + (ProgrammeState.uploadingAssetKey === ('block:' + page.pageId + ':' + index) ? 'Uploading...' : 'Upload Image') + '</button>' +
                            (block.imageUrl ? '<button class="pgmb-mini-btn is-danger" type="button" onclick="MarketingProgrammeModule.clearPageBlockImage(\'' + esc(page.pageId) + '\',' + index + ')">Remove Image</button>' : '') +
                          '</div>' +
                        '</div>'
                      : '') +
                  '</div>';
                }).join('') + '</div>'
              : isManual ? '<div class="pgmb-block-empty">No custom blocks yet. Add a few to create bespoke pages throughout the programme.</div>' : '') +
          '</div>' +
          '<div class="pgmb-editor-actions">' +
            '<button class="pgmb-btn pgmb-btn--soft" type="button" onclick="MarketingProgrammeModule.resetPageOverride(\'' + esc(page.pageId) + '\')">Reset Page</button>' +
            '<button class="pgmb-btn pgmb-btn--soft" type="button" onclick="MarketingProgrammeModule.duplicateCurrentPage()">Duplicate Page</button>' +
            (isCustom ? '<button class="pgmb-btn pgmb-btn--soft" type="button" onclick="MarketingProgrammeModule.deleteCurrentPage()">Delete Custom Page</button>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function renderExportModal() {
    if (!ProgrammeState.exportOpen) return '';
    var pages = buildProgrammePages();
    var plan = exportPlan(pages);
    var folded = plan.spec.mode === 'booklet';
    return '<div class="pgmb-modal-overlay" onclick="if(event.target===this)MarketingProgrammeModule.closeExport()">' +
      '<div class="pgmb-modal pgmb-export-modal">' +
        '<div class="pgmb-modal-head">' +
          '<div><strong>Export Programme</strong><span>The export plan adapts to ' + esc(plan.spec.label) + ' and lays out the physical print order for you.</span></div>' +
          '<button class="pgmb-modal-close" type="button" onclick="MarketingProgrammeModule.closeExport()">&times;</button>' +
        '</div>' +
        '<div class="pgmb-modal-body">' +
          '<div class="pgmb-export-summary">' +
            '<div class="pgmb-export-stat"><strong>' + plan.sheets.length + '</strong><span>' + esc(plan.spec.sheetLabel) + (plan.sheets.length === 1 ? '' : 's') + '</span></div>' +
            '<div class="pgmb-export-stat"><strong>' + plan.paddedCount + '</strong><span>print pages arranged</span></div>' +
            '<div class="pgmb-export-stat"><strong>' + plan.blanksAdded + '</strong><span>blank page' + (plan.blanksAdded === 1 ? '' : 's') + ' added</span></div>' +
          '</div>' +
          '<div class="pgmb-export-note">' +
            (folded
              ? 'Folded booklet export pairs outer and inner pages automatically, so cover, back cover, and interior spreads land in the right physical order.'
              : 'Loose-sheet export keeps one programme page per physical side, pairing fronts and backs for duplex printing.') +
          '</div>' +
          '<div class="pgmb-export-sheet-list">' + plan.sheets.map(function (sheet) {
            return '<section class="pgmb-export-sheet">' +
              '<div class="pgmb-export-sheet-head"><strong>Sheet ' + sheet.sheetNumber + '</strong><span>' + esc(plan.spec.sheetLabel) + '</span></div>' +
              ['front', 'back'].map(function (sideKey) {
                var side = sheet[sideKey];
                return '<div class="pgmb-export-side">' +
                  '<div class="pgmb-export-side-head"><strong>' + esc(side.side) + '</strong><span>' + esc(plan.spec.sideLabel) + '</span></div>' +
                  '<div class="pgmb-export-slots pgmb-export-slots--' + (side.slots.length === 2 ? 'spread' : 'single') + '">' +
                    side.slots.map(function (slot, slotIndex) {
                      return '<div class="pgmb-export-slot">' +
                        '<div class="pgmb-export-slot-kicker">' + (side.slots.length === 2 ? (slotIndex === 0 ? 'Left' : 'Right') : 'Side') + '</div>' +
                        (slot.image ? '<div class="pgmb-export-thumb"><img src="' + esc(slot.image) + '" alt="' + esc(slot.title || 'Programme page') + '" /></div>' : '<div class="pgmb-export-thumb is-blank"><span>Blank</span></div>') +
                        '<div class="pgmb-export-slot-copy"><strong>' + esc(pageSlotLabel(slot)) + '</strong><span>' + esc(slot.isBlank ? 'Inserted for print order' : slot.kind === 'cover' ? 'Cover placement' : 'Programme content') + '</span></div>' +
                      '</div>';
                    }).join('') +
                  '</div>' +
                '</div>';
              }).join('') +
            '</section>';
          }).join('') + '</div>' +
          '<div class="pgmb-editor-actions">' +
            '<button class="pgmb-btn pgmb-btn--primary" type="button" onclick="MarketingProgrammeModule.openPrintLayout()">Open Print Layout</button>' +
            '<button class="pgmb-btn pgmb-btn--soft" type="button" onclick="MarketingProgrammeModule.closeExport()">Close</button>' +
          '</div>' +
        '</div>' +
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
        var route = connectionRoute(item);
        return '<div class="pgmb-connection-item">' +
          '<div class="pgmb-connection-copy"><strong>' + esc(item.label) + '</strong><span>' + esc(item.detail) + '</span></div>' +
          '<div class="pgmb-connection-meta">' +
            '<span class="pgmb-connection-pill is-' + esc(item.status.tone) + '">' + esc(item.status.label) + '</span>' +
            (route ? '<button class="pgmb-connection-link" type="button" onclick="MarketingProgrammeModule.goToSource(\'' + esc(route.type) + '\',\'' + esc(route.tab) + '\')">' + esc(route.label) + '</button>' : '') +
          '</div>' +
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
    if (page.syncMode === 'manual' && Array.isArray(page.blocks) && page.blocks.length) {
      return page.blocks.map(function (block) {
        if (block.type === 'divider') return block.title || 'Section break';
        if (block.type === 'image') return [block.title, block.text].filter(Boolean).join(' · ') || 'Image block';
        return block.title || block.text || 'Custom block';
      }).slice(0, 8);
    }
    if (page.syncMode === 'manual' && page.bodyText) {
      return String(page.bodyText).split(/\n+/).filter(Boolean).slice(0, 8);
    }
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

  function renderManualBlocksArt(page, W, H, font) {
    var blocks = Array.isArray(page.blocks) ? page.blocks.slice(0, 6) : [];
    var accent = page.accentColor || '#572e88';
    var textColor = page.textColor || '#000000';
    var y = 188;
    if (!blocks.length && page.bodyText) {
      blocks = String(page.bodyText).split(/\n+/).filter(Boolean).slice(0, 5).map(function (line) {
        return { type: 'text', title: '', text: line };
      });
    }
    if (!blocks.length) {
      return '<rect x="56" y="210" width="' + (W - 112) + '" height="200" rx="18" fill="#efefef"/>' +
        '<text x="' + (W / 2) + '" y="304" fill="' + svgEsc(accent) + '" text-anchor="middle" font-family="' + font + '" font-size="22" font-weight="800">Add custom blocks to shape this page</text>' +
        '<text x="' + (W / 2) + '" y="334" fill="#000000" text-anchor="middle" font-family="' + font + '" font-size="14" font-weight="600">Text, quotes, dividers, and images can all be mixed together.</text>';
    }
    function multiLineText(text, x, baseY, options) {
      var lines = String(text || '').split(/\n+/).map(function (line) { return line.trim(); }).filter(Boolean).slice(0, options.maxLines || 3);
      if (!lines.length) return '';
      return '<text x="' + x + '" y="' + baseY + '" fill="' + svgEsc(options.fill || textColor) + '" font-family="' + (options.font || font) + '" font-size="' + (options.size || 18) + '" font-weight="' + (options.weight || 700) + '"' + (options.anchor ? ' text-anchor="' + options.anchor + '"' : '') + (options.italic ? ' font-style="italic"' : '') + '>' +
        lines.map(function (line, lineIndex) {
          return '<tspan x="' + x + '" dy="' + (lineIndex === 0 ? 0 : (options.lineHeight || 24)) + '">' + svgEsc(line.slice(0, options.maxChars || 68)) + '</tspan>';
        }).join('') +
      '</text>';
    }
    return blocks.map(function (block) {
      var markup = '';
      if (block.type === 'divider') {
        markup = '<line x1="70" y1="' + y + '" x2="' + (W - 70) + '" y2="' + y + '" stroke="' + svgEsc(accent) + '" stroke-width="4" stroke-linecap="round" opacity="0.4"/>';
        if (block.title) {
          markup += '<text x="' + (W / 2) + '" y="' + (y - 10) + '" fill="' + svgEsc(accent) + '" text-anchor="middle" font-family="' + font + '" font-size="13" font-weight="800" letter-spacing="2">' + svgEsc(String(block.title).slice(0, 28).toUpperCase()) + '</text>';
        }
        y += 42;
        return markup;
      }
      if (block.type === 'quote') {
        markup += '<rect x="64" y="' + (y - 24) + '" width="' + (W - 128) + '" height="86" rx="20" fill="' + svgEsc(accent) + '" opacity="0.08"/>';
        markup += '<text x="90" y="' + y + '" fill="' + svgEsc(accent) + '" font-family="' + SERIF + '" font-style="italic" font-size="26" font-weight="700">"</text>';
        markup += multiLineText(block.text || block.title || 'Quote', 116, y, { fill: textColor, font: SERIF, italic: true, size: 18, weight: 700, lineHeight: 22, maxLines: 2, maxChars: 62 });
        if (block.title) {
          markup += '<text x="116" y="' + (y + 24) + '" fill="' + svgEsc(accent) + '" font-family="' + font + '" font-size="12" font-weight="800" letter-spacing="1.4">' + svgEsc(String(block.title).slice(0, 36).toUpperCase()) + '</text>';
        }
        y += 112;
        return markup;
      }
      if (block.type === 'image') {
        var imageHeight = 118;
        markup += '<rect x="70" y="' + (y - 12) + '" width="' + (W - 140) + '" height="' + imageHeight + '" rx="18" fill="#f4eff9" stroke="' + svgEsc(accent) + '" stroke-width="2" stroke-dasharray="8 8" opacity="0.9"/>';
        if (block.imageUrl) {
          markup += '<image href="' + svgEsc(block.imageUrl) + '" x="74" y="' + (y - 8) + '" width="' + (W - 148) + '" height="' + (imageHeight - 8) + '" preserveAspectRatio="xMidYMid slice" clip-path="inset(0 round 16px)"/>';
          markup += '<rect x="74" y="' + (y - 8) + '" width="' + (W - 148) + '" height="' + (imageHeight - 8) + '" rx="16" fill="' + svgEsc(accent) + '" opacity="0.14"/>';
        } else {
          markup += '<text x="' + (W / 2) + '" y="' + (y + 38) + '" fill="' + svgEsc(accent) + '" text-anchor="middle" font-family="' + font + '" font-size="18" font-weight="800">Image Placeholder</text>';
        }
        markup += '<text x="82" y="' + (y + imageHeight + 22) + '" fill="' + svgEsc(textColor) + '" font-family="' + font + '" font-size="15" font-weight="800">' + svgEsc(String(block.title || 'Image block').slice(0, 34)) + '</text>';
        if (block.text) {
          markup += multiLineText(block.text, 82, y + imageHeight + 42, { fill: accent, font: SERIF, italic: true, size: 12, weight: 600, lineHeight: 16, maxLines: 2, maxChars: 70 });
        }
        y += 188;
        return markup;
      }
      markup += '<text x="70" y="' + y + '" fill="' + svgEsc(accent) + '" font-family="' + font + '" font-size="13" font-weight="900" letter-spacing="1.6">' + svgEsc(String(block.title || 'TEXT').slice(0, 26).toUpperCase()) + '</text>';
      markup += multiLineText(block.text || '', 70, y + 28, { fill: textColor, font: font, size: 18, weight: 700, lineHeight: 24, maxLines: 3, maxChars: 66 });
      y += 92;
      return markup;
    }).join('');
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
        (page.coverImage ? '<image href="' + svgEsc(page.coverImage) + '" x="0" y="0" width="' + W + '" height="' + bandHeight + '" preserveAspectRatio="xMidYMid slice"/><rect x="0" y="0" width="' + W + '" height="' + bandHeight + '" fill="' + svgEsc(page.accentColor || '#572e88') + '" opacity="0.58"/>' : '<rect x="0" y="0" width="' + W + '" height="' + bandHeight + '" fill="' + svgEsc(page.accentColor || '#572e88') + '"/>') +
        skylineSilhouette(W, bandHeight, '#000000', 0.18) +
        (page.showHeader === false ? '' : '<text x="60" y="76" fill="' + svgEsc(page.textColor || '#ffffff') + '" opacity="0.8" font-family="' + font + '" font-size="14" font-weight="800" letter-spacing="3">' + svgEsc(page.headerText || 'DIGITAL PROGRAMME') + '</text>') +
        '<text x="' + (W / 2) + '" y="' + Math.round(bandHeight * 0.42) + '" fill="' + svgEsc(page.textColor || '#ffffff') + '" text-anchor="middle" font-family="' + SERIF + '" font-style="italic" font-size="46" font-weight="700">' + svgEsc(title.slice(0, 24)) + '</text>' +
        '<rect x="' + (W / 2 - 60) + '" y="' + (Math.round(bandHeight * 0.42) + 22) + '" width="120" height="4" rx="2" fill="#efab45"/>' +
        '<text x="' + (W / 2) + '" y="' + (bandHeight - 40) + '" fill="' + svgEsc(page.textColor || '#ffffff') + '" text-anchor="middle" font-family="' + font + '" font-size="19" font-weight="700">' + svgEsc(subtitle.slice(0, 40)) + '</text>' +
        pageNumberChip +
      '</svg>';
      return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    }

    var body;
    if (isCastList) {
      body = renderCastListArt(page, W, H, font);
    } else if (page.syncMode === 'manual' || (Array.isArray(page.blocks) && page.blocks.length)) {
      body = renderManualBlocksArt(page, W, H, font);
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
      ? '<text x="60" y="128" fill="' + svgEsc(page.accentColor || '#572e88') + '" font-family="' + SERIF + '" font-style="italic" font-size="36" font-weight="700">' + svgEsc(title.slice(0, 26)) + '</text>'
      : '<text x="60" y="128" fill="' + svgEsc(page.textColor || '#000000') + '" font-family="' + font + '" font-size="38" font-weight="900">' + svgEsc(title.slice(0, 26)) + '</text>';

    svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
      '<rect width="100%" height="100%" fill="#ffffff"/>' +
      (page.showHeader === false ? '' : '<text x="60" y="76" fill="' + svgEsc(page.accentColor || '#572e88') + '" font-family="' + font + '" font-size="15" font-weight="800" letter-spacing="2">' + svgEsc(page.headerText || 'PROGRAMME') + '</text>') +
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
    if (page.syncMode === 'manual' && page.bodyText) {
      return '<div class="pgm-thanks-layout pgm-thanks-layout--note"><strong>' + esc(page.title || 'Thank You') + '</strong><em>' + esc(page.bodyText) + '</em></div>';
    }
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
        renderEditorModal() +
        renderExportModal() +
      '</div>';
  }

  function printLayoutHtml(plan) {
    var folded = plan.spec.mode === 'booklet';
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Programme Print Layout</title><style>' +
      'body{margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;background:#f3f0f8;color:#16111f;}' +
      '.prt-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;margin-bottom:20px;}' +
      '.prt-head h1{margin:0;font-size:28px;}' +
      '.prt-head p{margin:6px 0 0;color:#5a4d71;font-size:14px;line-height:1.5;max-width:760px;}' +
      '.prt-sheet{break-after:page;margin-bottom:28px;padding:20px;border-radius:20px;background:#fff;box-shadow:0 12px 28px rgba(0,0,0,.08);}' +
      '.prt-sheet:last-child{break-after:auto;}' +
      '.prt-sheet-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:14px;}' +
      '.prt-sheet-head strong{font-size:20px;}' +
      '.prt-sheet-head span{font-size:13px;color:#5a4d71;font-weight:700;}' +
      '.prt-side{margin-top:16px;}' +
      '.prt-side-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:13px;color:#5a4d71;font-weight:800;text-transform:uppercase;letter-spacing:.08em;}' +
      '.prt-slots{display:grid;gap:14px;}' +
      '.prt-slots--spread{grid-template-columns:repeat(2,minmax(0,1fr));}' +
      '.prt-slot{display:grid;gap:10px;padding:12px;border:1px solid rgba(87,46,136,.12);border-radius:18px;background:#fcfbfe;}' +
      '.prt-kicker{font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#572e88;}' +
      '.prt-thumb{aspect-ratio:' + (folded ? '5.5 / 8.5' : '8.5 / 11') + ';border-radius:14px;overflow:hidden;background:#efefef;display:grid;place-items:center;}' +
      '.prt-thumb img{width:100%;height:100%;object-fit:cover;display:block;}' +
      '.prt-thumb.is-blank{border:2px dashed rgba(87,46,136,.22);background:#f6f1fb;color:#7a6a96;font-weight:800;}' +
      '.prt-copy strong{display:block;font-size:14px;line-height:1.3;}' +
      '.prt-copy span{display:block;margin-top:4px;font-size:12px;color:#5a4d71;line-height:1.45;}' +
      '@media print{body{background:#fff;padding:0}.prt-sheet{box-shadow:none;border:0;padding:0 0 14px}.prt-head{padding:0 0 12px}}' +
    '</style></head><body>' +
      '<div class="prt-head"><div><h1>Programme Print Layout</h1><p>' +
        esc(folded
          ? 'This export is imposed as a folded booklet. Each sheet shows the exact left/right order for the front and back of the physical paper.'
          : 'This export is arranged for duplex loose-sheet printing. Each sheet shows the front side and the back side order.') +
      '</p></div><button onclick="window.print()" style="border:0;background:#572e88;color:#fff;padding:12px 18px;border-radius:999px;font-weight:800;cursor:pointer;">Print</button></div>' +
      plan.sheets.map(function (sheet) {
        return '<section class="prt-sheet"><div class="prt-sheet-head"><strong>Sheet ' + sheet.sheetNumber + '</strong><span>' + esc(plan.spec.sheetLabel) + '</span></div>' +
          ['front','back'].map(function (sideKey) {
            var side = sheet[sideKey];
            return '<div class="prt-side"><div class="prt-side-head"><strong>' + esc(side.side) + '</strong><span>' + esc(plan.spec.sideLabel) + '</span></div>' +
              '<div class="prt-slots prt-slots--' + (side.slots.length === 2 ? 'spread' : 'single') + '">' +
                side.slots.map(function (slot, index) {
                  return '<div class="prt-slot"><div class="prt-kicker">' + (side.slots.length === 2 ? (index === 0 ? 'Left' : 'Right') : 'Side') + '</div>' +
                    (slot.image ? '<div class="prt-thumb"><img src="' + esc(slot.image) + '" alt="' + esc(slot.title || 'Programme page') + '"></div>' : '<div class="prt-thumb is-blank">Blank</div>') +
                    '<div class="prt-copy"><strong>' + esc(pageSlotLabel(slot)) + '</strong><span>' + esc(slot.isBlank ? 'Inserted automatically to complete print order.' : 'Use this position on the physical sheet.') + '</span></div></div>';
                }).join('') +
              '</div></div>';
          }).join('') +
        '</section>';
      }).join('') +
    '</body></html>';
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
      queueProgrammeSave();
      renderPlanner();
    },
    setPageLayout: function (key, value) {
      ProgrammeState.settings.pageLayouts = ProgrammeState.settings.pageLayouts || {};
      ProgrammeState.settings.pageLayouts[key] = value;
      ProgrammeState.openLayoutGroup = key || ProgrammeState.openLayoutGroup;
      if (key === 'bios') {
        ProgrammeState.settings.bioLayout = value === 'bios-compact' ? 'text-compact' : value === 'bios-featured' ? 'featured-bios' : 'headshot-grid';
      }
      queueProgrammeSave();
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
    openExport: function () {
      ProgrammeState.exportOpen = true;
      renderPlanner();
    },
    closeExport: function () {
      ProgrammeState.exportOpen = false;
      renderPlanner();
    },
    openPrintLayout: function () {
      var plan = exportPlan(buildProgrammePages());
      var win = window.open('', '_blank', 'noopener,noreferrer');
      if (!win) {
        alert('Could not open the print layout window. Please allow pop-ups for Build The Show and try again.');
        return;
      }
      win.document.open();
      win.document.write(printLayoutHtml(plan));
      win.document.close();
    },
    toggleSection: function (key, checked) {
      var next = new Set(ProgrammeState.settings.sections);
      if (checked) next.add(key);
      else next.delete(key);
      ProgrammeState.settings.sections = Array.from(next);
      queueProgrammeSave();
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
      queueProgrammeSave();
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
    openEditor: function () {
      ProgrammeState.editorOpen = true;
      renderPlanner();
    },
    closeEditor: function () {
      ProgrammeState.editorOpen = false;
      renderPlanner();
    },
    goToSource: function (type, tab) {
      if (type === 'marketing' && typeof window.navigateToMarketing === 'function') {
        window.navigateToMarketing(tab || 'dashboard');
        return;
      }
      if (type === 'production') {
        if (tab === 'volunteers' && typeof window.navigateToVolunteers === 'function') {
          window.navigateToVolunteers('calendar');
          return;
        }
        if (typeof window.switchProdTab === 'function') {
          window.switchProdTab(tab || 'dashboard');
        }
      }
    },
    uploadCoverImage: function (pageId) {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml';
      input.onchange = function () {
        var file = input.files && input.files[0];
        if (!file) return;
        var existing = pageOverride({ pageId: pageId });
        ProgrammeState.uploadingAssetKey = 'cover:' + pageId;
        renderPlanner();
        uploadProgrammeAsset(file, 'covers', pageId)
          .then(function (asset) {
            ProgrammeState.settings.pageOverrides = ProgrammeState.settings.pageOverrides || {};
            var current = Object.assign({}, existing, ProgrammeState.settings.pageOverrides[pageId] || {});
            current.coverImage = asset.url;
            current.coverImagePath = asset.path;
            ProgrammeState.settings.pageOverrides[pageId] = current;
            if (pageId.indexOf('custom-') === 0) {
              ProgrammeState.settings.customPages = (ProgrammeState.settings.customPages || []).map(function (page) {
                if (page.pageId !== pageId) return page;
                page.coverImage = asset.url;
                page.coverImagePath = asset.path;
                return page;
              });
            }
            queueProgrammeSave();
            renderPlanner();
            if (existing.coverImagePath && existing.coverImagePath !== asset.path) removeProgrammeAsset(existing.coverImagePath);
          })
          .catch(function (error) {
            alert('Could not upload cover image: ' + error.message);
          })
          .finally(function () {
            ProgrammeState.uploadingAssetKey = '';
            renderPlanner();
          });
      };
      input.click();
    },
    clearCoverImage: function (pageId) {
      var current = pageOverride({ pageId: pageId });
      ProgrammeState.settings.pageOverrides = ProgrammeState.settings.pageOverrides || {};
      ProgrammeState.settings.pageOverrides[pageId] = Object.assign({}, current, {
        coverImage: '',
        coverImagePath: '',
      });
      if (pageId.indexOf('custom-') === 0) {
        ProgrammeState.settings.customPages = (ProgrammeState.settings.customPages || []).map(function (page) {
          if (page.pageId !== pageId) return page;
          page.coverImage = '';
          page.coverImagePath = '';
          return page;
        });
      }
      queueProgrammeSave();
      renderPlanner();
      if (current.coverImagePath) removeProgrammeAsset(current.coverImagePath);
    },
    setPageOverride: function (pageId, key, value) {
      ProgrammeState.settings.pageOverrides = ProgrammeState.settings.pageOverrides || {};
      var current = ProgrammeState.settings.pageOverrides[pageId] || {};
      current[key] = value;
      ProgrammeState.settings.pageOverrides[pageId] = current;
      if (pageId.indexOf('custom-') === 0) {
        ProgrammeState.settings.customPages = (ProgrammeState.settings.customPages || []).map(function (page) {
          if (page.pageId !== pageId) return page;
          page[key] = value;
          return page;
        });
      }
      queueProgrammeSave();
      renderPlanner();
    },
    addPageBlock: function (pageId, type) {
      ProgrammeState.settings.pageOverrides = ProgrammeState.settings.pageOverrides || {};
      var current = Object.assign({}, pageOverride({ pageId: pageId }), ProgrammeState.settings.pageOverrides[pageId] || {});
      current.syncMode = 'manual';
      current.blocks = normaliseBlocks(current.blocks);
      current.blocks.push(createPageBlock(type));
      ProgrammeState.settings.pageOverrides[pageId] = current;
      if (pageId.indexOf('custom-') === 0) {
        ProgrammeState.settings.customPages = (ProgrammeState.settings.customPages || []).map(function (page) {
          if (page.pageId !== pageId) return page;
          page.blocks = current.blocks.slice();
          return page;
        });
      }
      queueProgrammeSave();
      renderPlanner();
    },
    updatePageBlock: function (pageId, index, key, value) {
      ProgrammeState.settings.pageOverrides = ProgrammeState.settings.pageOverrides || {};
      var current = Object.assign({}, pageOverride({ pageId: pageId }), ProgrammeState.settings.pageOverrides[pageId] || {});
      var blocks = normaliseBlocks(current.blocks);
      if (!blocks[index]) return;
      blocks[index][key] = value;
      current.syncMode = 'manual';
      current.blocks = blocks;
      ProgrammeState.settings.pageOverrides[pageId] = current;
      if (pageId.indexOf('custom-') === 0) {
        ProgrammeState.settings.customPages = (ProgrammeState.settings.customPages || []).map(function (page) {
          if (page.pageId !== pageId) return page;
          page.blocks = blocks.slice();
          return page;
        });
      }
      queueProgrammeSave();
      renderPlanner();
    },
    uploadPageBlockImage: function (pageId, index) {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml';
      input.onchange = function () {
        var file = input.files && input.files[0];
        if (!file) return;
        ProgrammeState.uploadingAssetKey = 'block:' + pageId + ':' + index;
        renderPlanner();
        var current = Object.assign({}, pageOverride({ pageId: pageId }), (ProgrammeState.settings.pageOverrides || {})[pageId] || {});
        var blocks = normaliseBlocks(current.blocks);
        var previousPath = blocks[index] && blocks[index].imagePath ? blocks[index].imagePath : '';
        uploadProgrammeAsset(file, 'blocks', pageId + '_' + index)
          .then(function (asset) {
            if (!blocks[index]) throw new Error('This image block no longer exists.');
            blocks[index].imageUrl = asset.url;
            blocks[index].imagePath = asset.path;
            current.syncMode = 'manual';
            current.blocks = blocks;
            ProgrammeState.settings.pageOverrides = ProgrammeState.settings.pageOverrides || {};
            ProgrammeState.settings.pageOverrides[pageId] = current;
            if (pageId.indexOf('custom-') === 0) {
              ProgrammeState.settings.customPages = (ProgrammeState.settings.customPages || []).map(function (page) {
                if (page.pageId !== pageId) return page;
                page.blocks = blocks.slice();
                return page;
              });
            }
            queueProgrammeSave();
            renderPlanner();
            if (previousPath && previousPath !== asset.path) removeProgrammeAsset(previousPath);
          })
          .catch(function (error) {
            alert('Could not upload block image: ' + error.message);
          })
          .finally(function () {
            ProgrammeState.uploadingAssetKey = '';
            renderPlanner();
          });
      };
      input.click();
    },
    clearPageBlockImage: function (pageId, index) {
      var current = Object.assign({}, pageOverride({ pageId: pageId }), (ProgrammeState.settings.pageOverrides || {})[pageId] || {});
      var blocks = normaliseBlocks(current.blocks);
      if (!blocks[index]) return;
      var previousPath = blocks[index].imagePath || '';
      blocks[index].imageUrl = '';
      blocks[index].imagePath = '';
      current.syncMode = 'manual';
      current.blocks = blocks;
      ProgrammeState.settings.pageOverrides = ProgrammeState.settings.pageOverrides || {};
      ProgrammeState.settings.pageOverrides[pageId] = current;
      if (pageId.indexOf('custom-') === 0) {
        ProgrammeState.settings.customPages = (ProgrammeState.settings.customPages || []).map(function (page) {
          if (page.pageId !== pageId) return page;
          page.blocks = blocks.slice();
          return page;
        });
      }
      queueProgrammeSave();
      renderPlanner();
      if (previousPath) removeProgrammeAsset(previousPath);
    },
    movePageBlock: function (pageId, index, delta) {
      ProgrammeState.settings.pageOverrides = ProgrammeState.settings.pageOverrides || {};
      var current = Object.assign({}, pageOverride({ pageId: pageId }), ProgrammeState.settings.pageOverrides[pageId] || {});
      var blocks = normaliseBlocks(current.blocks);
      var nextIndex = index + (delta > 0 ? 1 : -1);
      if (!blocks[index] || nextIndex < 0 || nextIndex >= blocks.length) return;
      var swap = blocks[index];
      blocks[index] = blocks[nextIndex];
      blocks[nextIndex] = swap;
      current.syncMode = 'manual';
      current.blocks = blocks;
      ProgrammeState.settings.pageOverrides[pageId] = current;
      if (pageId.indexOf('custom-') === 0) {
        ProgrammeState.settings.customPages = (ProgrammeState.settings.customPages || []).map(function (page) {
          if (page.pageId !== pageId) return page;
          page.blocks = blocks.slice();
          return page;
        });
      }
      queueProgrammeSave();
      renderPlanner();
    },
    removePageBlock: function (pageId, index) {
      ProgrammeState.settings.pageOverrides = ProgrammeState.settings.pageOverrides || {};
      var current = Object.assign({}, pageOverride({ pageId: pageId }), ProgrammeState.settings.pageOverrides[pageId] || {});
      var blocks = normaliseBlocks(current.blocks);
      if (!blocks[index]) return;
      blocks.splice(index, 1);
      current.syncMode = 'manual';
      current.blocks = blocks;
      ProgrammeState.settings.pageOverrides[pageId] = current;
      if (pageId.indexOf('custom-') === 0) {
        ProgrammeState.settings.customPages = (ProgrammeState.settings.customPages || []).map(function (page) {
          if (page.pageId !== pageId) return page;
          page.blocks = blocks.slice();
          return page;
        });
      }
      queueProgrammeSave();
      renderPlanner();
    },
    resetPageOverride: function (pageId) {
      if (ProgrammeState.settings.pageOverrides) delete ProgrammeState.settings.pageOverrides[pageId];
      queueProgrammeSave();
      renderPlanner();
    },
    addCustomPage: function () {
      ProgrammeState.settings.customPages = ProgrammeState.settings.customPages || [];
      var pageId = 'custom-' + Date.now();
      ProgrammeState.settings.customPages.push({
        pageId: pageId,
        type: 'custom',
        title: 'Custom Page',
        subtitle: 'Manual content',
      });
      ProgrammeState.currentPage = buildProgrammePages().length;
      ProgrammeState.editorOpen = true;
      queueProgrammeSave();
      renderPlanner();
    },
    duplicateCurrentPage: function () {
      var page = currentPageData();
      if (!page) return;
      var nextId = 'custom-' + Date.now();
      var copiedBlocks = normaliseBlocks((page.override && page.override.blocks) || page.blocks || []);
      ProgrammeState.settings.customPages.push({
        pageId: nextId,
        type: 'custom',
        title: page.title + ' Copy',
        subtitle: page.subtitle,
        blocks: copiedBlocks,
      });
      ProgrammeState.settings.pageOverrides = ProgrammeState.settings.pageOverrides || {};
      ProgrammeState.settings.pageOverrides[nextId] = Object.assign({}, page.override || {}, {
        title: page.title + ' Copy',
        subtitle: page.subtitle,
        syncMode: 'manual',
        blocks: copiedBlocks,
      });
      queueProgrammeSave();
      renderPlanner();
    },
    deleteCurrentPage: function () {
      var page = currentPageData();
      if (!page || page.sectionKey !== 'custom') return;
      ProgrammeState.settings.customPages = (ProgrammeState.settings.customPages || []).filter(function (item) { return item.pageId !== page.pageId; });
      if (ProgrammeState.settings.pageOverrides) delete ProgrammeState.settings.pageOverrides[page.pageId];
      ProgrammeState.editorOpen = false;
      queueProgrammeSave();
      renderPlanner();
    },
    saveNow: function () {
      if (ProgrammeState.saveTimer) {
        window.clearTimeout(ProgrammeState.saveTimer);
        ProgrammeState.saveTimer = 0;
      }
      persistProgrammeSettings();
    },
    destroy: function () {},
  };
})();
