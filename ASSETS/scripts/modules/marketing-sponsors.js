/* marketing-sponsors.js — Sponsors module */
(function () {
  'use strict';

  var SUPABASE_URL  = 'https://tkmaiktxpwqfbgeojbnf.supabase.co';
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrbWFpa3R4cHdxZmJnZW9qYm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MzE4MTcsImV4cCI6MjA4OTMwNzgxN30.TkTZBNWUatk3Y6Vmfv1hIRR3DfVjgwauwa76Pf00J_8';
  var STORAGE_BUCKET = 'programme-ads';

  /* Dims stored as "HeightxWidth" (printing convention).
     Programme is 8.5x11 folded in half = 5.5" wide x 8.5" tall (portrait).
     Printable area: 5" wide x 8" tall. */
  var PRINT_W = 5;
  var PRINT_H = 8;

  var DEFAULT_AD_SIZES = [
    { id: 'card',    label: 'Card',      dims: '2x2.5', colour: 50,  bw: 35  },
    { id: 'quarter', label: '1/4 Page',  dims: '4x2.5', colour: 80,  bw: 60  },
    { id: 'half',    label: '1/2 Page',  dims: '4x5',   colour: 140, bw: 90  },
    { id: 'full',    label: 'Full Page', dims: '8x5',   colour: 200, bw: 150 },
  ];

  var DEFAULT_TIERS = [
    {
      id: 'cherry-tree-lane',
      label: 'Cherry Tree Lane Sponsor',
      amount: 1000,
      bullets: 'Full-page colour programme advertisement\nSponsor recognition in the programme\nRecognized on Rainbow Youth Theatre social media throughout the Mary Poppins Jr. season\nLogo on the Rainbow Youth Theatre website for the duration of the production\nAcknowledgement during opening remarks before each performance',
    },
    {
      id: 'spoonful-of-sugar',
      label: 'A Spoonful of Sugar Sponsor',
      amount: 2000,
      slots: 1,
      bullets: 'Everything included in the Cherry Tree Lane Sponsor package, plus:\nLogo featured on the front cover of the official programme\nLogo on the Mary Poppins Jr. poster\nAcknowledgement on printed promotional materials\nTwo complimentary tickets to a performance',
    },
  ];

  function cloneDefaultTiers() {
    return DEFAULT_TIERS.map(function (tier) { return Object.assign({}, tier); });
  }

  function normalizeSponsorTiers(tiers) {
    if (!Array.isArray(tiers) || !tiers.length) return cloneDefaultTiers();
    var labels = tiers.map(function (tier) { return String(tier && tier.label || '').trim().toLowerCase(); });
    var legacyLabels = ['presenting sponsor', 'gold sponsor', 'silver sponsor', 'bronze sponsor', 'friend'];
    var isLegacyDefault = legacyLabels.every(function (label) { return labels.indexOf(label) >= 0; });
    return isLegacyDefault ? cloneDefaultTiers() : tiers;
  }

  var PUBLIC_PAGE_COLORS = [
    { name: 'Purple', value: '#572e88' }, { name: 'Light blue', value: '#74a2b4' },
    { name: 'Blue', value: '#476aaa' }, { name: 'Green', value: '#769e7b' },
    { name: 'Orange', value: '#dd8233' }, { name: 'Red', value: '#d1523d' },
    { name: 'Pink', value: '#ca7ea7' }, { name: 'Black', value: '#1a1530' },
    { name: 'White', value: '#ffffff' },
  ];

  function defaultPublicPage() {
    return {
      published: false,
      posterUrl: '', currentPosterOverride: '', pastPosters: [], pastPostersUrl: '/ASSETS/Images/Decrotive/past-posters-template.png?v=20260620', contactEmail: '',
      content: {
        navOverview: 'Overview', navSponsors: 'Sponsorships', navAds: 'Programme Ads', navBook: 'Book Now',
        heroTitle: 'Support Community Theatre', heroAccent: '',
        heroBody: 'Help local young performers bring this magical production to life.',
        heroSponsorButton: 'View Sponsorship Options', heroSponsorSub: 'Support the production', heroAdButton: 'View Programme Ads', heroAdSub: 'Promote your business',
        statsTitle: 'Your Business Seen by Local Families',
        sponsorWayTitle: 'Sponsor the Production', sponsorWayBody: 'Support the show and receive recognition throughout the season across the programme, website, social media, and live performances.',
        sponsorWayBullets: 'Recognition in the printed programme\nWebsite and social media mentions\nAcknowledgement at performances\nShow your commitment to local youth', sponsorWayCta: 'View Sponsorship Options',
        adWayTitle: 'Advertise in the Programme', adWayBody: 'Place your business in the printed booklet handed to every audience member at the door. A keepsake they take home after the show.',
        adWayBullets: 'Full colour and black & white options\nAffordable advertising for local businesses\nReach hundreds of local families\nMultiple ad sizes to suit any budget', adWayCta: 'View Ad Sizes & Pricing',
        programmeLabel: 'What is a Programme?', programmeTitle: 'A printed booklet for every audience member.',
        programmeBody: 'A programme is handed to every person who walks through the door. It includes show information, cast bios, and advertisements from local businesses like yours. Families take it home as a keepsake, so your ad lasts long after the curtain falls.',
        compareLabel: 'Who will see your business?', compareTitle: 'Your support reaches our entire theatre community.',
        compareRows: 'What it is | Support the production | Promote your business\nMain benefit | Season-wide recognition | Printed advertisement\nGreat if you want to | Show community support | Market your business\nWhere you will be seen | Programme, website, social media, announcements | In the printed programme',
        compareBoth: 'Yes! Many businesses sponsor and advertise.',
        stepsLabel: 'Getting started', stepsTitle: 'It’s Easy to Get Involved',
        stepsRows: 'Choose an option | Sponsor, advertise, or both!\nComplete the form | Quick and easy online booking.\nUpload your artwork | We’ll tell you exactly what we need.\nWe handle the rest! | We take care of all the details.',
        impactTitle: 'Your support makes a big impact.', impactBody: 'Thank you for helping young performers shine!',
        sponsorsKicker: 'Show Sponsorships', sponsorsTitle: 'Support the Production', sponsorsBody: 'Choose a sponsorship level and support the full production. You’ll be recognised throughout the season.',
        adsKicker: 'Programme Advertising', adsTitle: 'Advertise in the Programme', adsBody: 'Reach the show audience with an advertisement in the printed programme. Choose the size and format that works for your budget.',
        orgAboutBody: 'A local community theatre organisation dedicated to giving young performers a chance to shine on stage.',
        keyDatesTitle: 'Key Dates to Know', keyDatesBody: 'Plan your sponsorship around these important dates.',
        pastPostersKicker: 'Past Posters', pastPostersTitle: 'A look back at the shows sponsors helped bring to life',
        pastPostersBody: 'Share a visual snapshot of previous productions and the community your supporters are joining.',
        footerTitle: 'Have questions?', footerBody: 'We’re happy to help you find the right option.', footerButton: 'Contact Us',
      },
      colors: { hero: '#572e88', stats: '#74a2b4', sponsor: '#572e88', ads: '#769e7b', info: '#ffffff', steps: '#1a1530', sponsorships: '#572e88', programmeAds: '#476aaa', pastPosters: '#ffffff', footer: '#1a1530' },
      sections: [
        { id: 'hero', visible: true }, { id: 'stats', visible: true }, { id: 'ways', visible: true },
        { id: 'info', visible: true }, { id: 'steps', visible: true }, { id: 'sponsorships', visible: true },
        { id: 'programmeAds', visible: true }, { id: 'keyDates', visible: true }, { id: 'pastPosters', visible: true }, { id: 'footer', visible: true },
      ],
    };
  }

  function mergePublicPage(value) {
    var base = defaultPublicPage();
    value = value && typeof value === 'object' ? value : {};
    base.published = value.published === true;
    base.posterUrl = value.posterUrl || '';
    base.currentPosterOverride = value.currentPosterOverride || '';
    base.pastPosters = Array.isArray(value.pastPosters) ? value.pastPosters.slice() : [];
    base.pastPostersUrl = value.pastPostersUrl || base.pastPostersUrl;
    base.contactEmail = value.contactEmail || '';
    base.content = Object.assign(base.content, value.content || {});
    if (base.content.heroTitle === 'Promote Your Business While Supporting' && base.content.heroAccent === 'Local Youth Theatre.') {
      base.content.heroTitle = 'Support Community Theatre';
      base.content.heroAccent = '';
      base.content.heroBody = 'Help local young performers bring this magical production to life.';
      base.content.heroSponsorButton = 'View Sponsorship Options';
      base.content.heroAdButton = 'View Programme Ads';
    }
    base.colors = Object.assign(base.colors, value.colors || {});
    if (Array.isArray(value.sections) && value.sections.length) {
      var defaultSections = base.sections.map(function (section) { return Object.assign({}, section); });
      base.sections = value.sections.map(function (section) { return Object.assign({}, section); });
      defaultSections.forEach(function (section) {
        if (!base.sections.some(function (item) { return item.id === section.id; })) base.sections.push(section);
      });
      var footerIndex = base.sections.findIndex(function (section) { return section.id === 'footer'; });
      if (footerIndex >= 0) base.sections.push(base.sections.splice(footerIndex, 1)[0]);
    }
    return base;
  }

  var ADTILE_COLORS = ['#74a2b4', '#476aaa', '#769e7b', '#dd8233', '#d1523d', '#ca7ea7'];

  var SpnsState = {
    prodId: null,
    businesses: [],
    ads: [],
    packages: [],
    deliverables: [],
    settings: { adSizes: [], tiers: [] },
    loaded: {},
  };

  function resetState(prodId) {
    SpnsState.prodId = prodId;
    SpnsState.businesses = [];
    SpnsState.ads = [];
    SpnsState.packages = [];
    SpnsState.deliverables = [];
    SpnsState.settings = {
      adSizes:     DEFAULT_AD_SIZES.map(function (s) { return Object.assign({}, s); }),
      tiers:       cloneDefaultTiers(),
      publicStats: [],
      publicPage: defaultPublicPage(),
      publicPageDraft: defaultPublicPage(),
    };
    SpnsState.posterUrl = null;
    SpnsState.previewContentH = 4000;
    SpnsState.loaded = {};
    SpnsState.publicPageDirty = false;
    SpnsState.publicPageHasDraftChanges = false;
  }

  // -- DB helpers ---------------------------------------------------------------

  function sponsorAccessToken() {
    try {
      var raw = localStorage.getItem('sb-tkmaiktxpwqfbgeojbnf-auth-token');
      var stored = raw ? JSON.parse(raw) : null;
      return stored && (stored.access_token || (stored.currentSession && stored.currentSession.access_token)) || '';
    } catch (_) { return ''; }
  }

  function sponsorHeaders(extra) {
    return Object.assign({ apikey: SUPABASE_ANON, Authorization: 'Bearer ' + (sponsorAccessToken() || SUPABASE_ANON) }, extra || {});
  }

  function dbFetch(table, extra) {
    var url = SUPABASE_URL + '/rest/v1/' + table + '?production_id=eq.' + SpnsState.prodId + (extra || '') + '&order=created_at.asc';
    return fetch(url, { headers: sponsorHeaders() })
      .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t); }); return r.json(); });
  }

  function dbInsert(table, data) {
    return fetch(SUPABASE_URL + '/rest/v1/' + table, {
      method: 'POST',
      headers: sponsorHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
      body: JSON.stringify(Object.assign({}, data, { production_id: SpnsState.prodId })),
    }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t); }); return r.json(); });
  }

  function dbUpdate(table, id, data) {
    return fetch(SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + id, {
      method: 'PATCH',
      headers: sponsorHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
      body: JSON.stringify(data),
    }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t); }); return r.json(); });
  }

  function dbDelete(table, id) {
    return fetch(SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + id, {
      method: 'DELETE',
      headers: sponsorHeaders(),
    }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t); }); });
  }

  // -- Formatters ---------------------------------------------------------------

  function fmtDollars(cents) { return '$' + (cents / 100).toFixed(2).replace(/\.00$/, ''); }
  function fmtDate(d) { if (!d) return ''; var parts = d.split('-'); return parts[1] + '/' + parts[2] + '/' + parts[0].slice(2); }
  function bizName(id) { var b = SpnsState.businesses.find(function (x) { return x.id === id; }); return b ? b.name : ''; }
  function esc(s) { return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : ''; }

  // -- Settings tile builder ---------------------------------------------------

  function settingsTile(kicker, label, body, footer, color) {
    var renderer = window.BTSAuditionTemplates && window.BTSAuditionTemplates.renderTemplateById;
    if (!renderer) return '';
    return renderer('brand.tile.square', {
      esc: esc,
      mode: 'settings',
      color: color || '#572e88',
      ink: '#ffffff',
      kicker: kicker,
      title: label,
      bodyHtml: '<div class="spn-settings-tile-body">' + body + '</div>',
      buttonHtml: '<div class="spn-settings-tile-actions">' + footer + '</div>',
      ariaLabel: label,
    });
  }

  function deadlineTile(kicker, label, inputId, color) {
    var renderer = window.BTSAuditionTemplates && window.BTSAuditionTemplates.renderTemplateById;
    if (!renderer) return '';
    return renderer('brand.tile.square', {
      esc: esc,
      mode: 'settings',
      color: color || '#476aaa',
      ink: '#ffffff',
      kicker: kicker,
      title: label,
      inputHtml: '<div class="template-brand-tile-form-fields"><input type="date" id="' + inputId + '" class="template-brand-tile-form-input form-input" aria-label="' + esc(label) + '" /></div>',
      helper: 'Used for production planning and follow-up.',
      ariaLabel: label,
    });
  }

  function fetchPosterUrl() {
    var url = SUPABASE_URL + '/rest/v1/productions?id=eq.' + SpnsState.prodId + '&select=poster_url&limit=1';
    return fetch(url, { headers: sponsorHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (d) { return d && d[0] && d[0].poster_url || ''; })
      .catch(function () { return ''; });
  }

  // -- Ad sizes grouped visual --------------------------------------------------

  /* Dims format: "HxW" (height x width, printing convention).
     e.g. '8x5' = 8" tall x 5" wide. First number = height, second = width. */
  function parseAdDims(dims) {
    var m = String(dims || '').replace(/['"]/g, '').match(/^([\d.]+)[xX]([\d.]+)$/);
    return m ? { h: parseFloat(m[1]) || 1, w: parseFloat(m[2]) || 1 } : { h: 1, w: 1 };
  }

  function adMiniCard(sizeId, biz, type, paid, art) {
    var inner = biz
      ? ('<div class="spn-ad-mini-card spn-ad-mini-card--booked" onclick="MarketingSponsorsModule.openAdModal(' + JSON.stringify(biz.id) + ')">' +
           '<div class="spn-ad-mini-biz">' + esc(bizName(biz.business_id) || 'Unnamed') + '</div>' +
           '<div class="spn-ad-mini-type">' + esc(type) + '</div>' +
           '<div class="spn-ad-mini-dots">' +
             '<span class="spn-ad-mini-dot' + (paid ? ' on' : '') + '"></span>' +
             '<span class="spn-ad-mini-dot' + (art  ? ' on' : '') + '"></span>' +
           '</div>' +
         '</div>')
      : '<div class="spn-ad-mini-card spn-ad-mini-card--waiting"><span>Waiting</span></div>';
    return '<div class="reg-offer-item">' + inner + '</div>';
  }

  function renderAdSlotCards(sizeId, dims) {
    var ads = SpnsState.ads.filter(function (a) { return a.ad_size === sizeId; });
    var d = parseAdDims(dims);
    var ratio = (d.w / d.h).toFixed(3);
    var posterInner = SpnsState.posterUrl
      ? '<div class="spn-ad-ph-img" style="background-image:url(' + JSON.stringify(SpnsState.posterUrl) + ')"></div><div class="spn-ad-ph-overlay"></div>'
      : '<div class="spn-ad-ph-empty"></div>';
    var waitCard = '<div class="spn-ad-placeholder" style="aspect-ratio:' + ratio + '">'
      + posterInner
      + '<span class="spn-ad-ph-label">Example</span>'
      + '</div>';
    var addCard = '<div class="reg-offer-item spn-ad-mini-add" onclick="MarketingSponsorsModule.openAdModal(undefined,' + JSON.stringify(sizeId) + ')" title="Add ad"><span>+</span></div>';
    if (!ads.length) {
      return waitCard + addCard;
    }
    return ads.map(function (a) {
      var paid = a.payment_status === 'paid';
      var art  = a.artwork_status === 'received' || a.artwork_status === 'approved' || a.artwork_status === 'print_ready';
      var type = a.ad_type === 'bw' ? 'B&W' : 'Colour';
      return adMiniCard(sizeId, a, type, paid, art);
    }).join('') + addCard;
  }

  function renderAdsGrouped() {
    var renderer = window.BTSAuditionTemplates && window.BTSAuditionTemplates.renderTemplateById;
    if (!renderer) return '<div class="spn-loading-row">Loading templates...</div>';
    var sizes  = SpnsState.settings.adSizes;
    var colors = ADTILE_COLORS;
    return '<div class="spn-adpkg-list">' + sizes.map(function (s, i) {
      var color       = colors[i % colors.length];
      var dimsDisplay = String(s.dims || '').replace(/['"]/g, '').replace(/[xX]/, '″ x ') + '″';
      var priceParts  = [];
      if (s.colour_enabled !== false) priceParts.push('<div class="spn-tile-info-row"><span class="spn-tile-info-label">Colour</span> $' + s.colour + '</div>');
      if (s.bw_enabled !== false) priceParts.push('<div class="spn-tile-info-row"><span class="spn-tile-info-label">B&amp;W</span> $' + s.bw + '</div>');
      return renderer('brand.tile.lane', {
        esc:             esc,
        color:           color,
        ink:             '#ffffff',
        kicker:          'Ad Size',
        title:           s.label,
        anchorBodyHtml:  '<div class="template-brand-tile-body"><div class="spn-tile-info-row"><span class="spn-tile-info-label">Size</span> ' + esc(dimsDisplay) + '</div>' + priceParts.join('') + '</div>',
        anchorFooterHtml:'<button class="template-brand-tile-button" onclick="MarketingSponsorsModule.editAdSize(' + i + ')">Edit</button>',
        cardsHtml:       renderAdSlotCards(s.id, s.dims),
      });
    }).join('') + '</div>';
  }



  function refreshAdsGrouped() {
    var el = document.getElementById('spn-ads-grouped');
    if (!el) return;
    el.innerHTML = renderAdsGrouped();
    var count = document.getElementById('spn-ads-count');
    if (count) count.textContent = SpnsState.ads.length + ' Programme Ad' + (SpnsState.ads.length !== 1 ? 's' : '');
    var heroCount = document.getElementById('spn-hero-page-count');
    if (heroCount && heroCount.dataset.kind === 'ads') heroCount.textContent = SpnsState.ads.length;
  }

  // -- Artwork upload -----------------------------------------------------------

  function uploadArtwork(adId) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/gif,image/webp,application/pdf';
    input.onchange = function () {
      var file = input.files[0];
      if (!file) return;
      var safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      var path = SpnsState.prodId + '/' + adId + '/' + Date.now() + '_' + safeName;
      var btn = document.querySelector('[data-upload-ad="' + adId + '"]');
      if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }
      fetch(SUPABASE_URL + '/storage/v1/object/' + STORAGE_BUCKET + '/' + path, {
        method: 'POST',
        headers: sponsorHeaders({ 'Content-Type': file.type }),
        body: file,
      }).then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw new Error(t); });
        var url = SUPABASE_URL + '/storage/v1/object/public/' + STORAGE_BUCKET + '/' + path;
        return dbUpdate('programme_ads', adId, { artwork_url: url, artwork_status: 'received' });
      }).then(function () {
        SpnsState.loaded.ads = false;
        loadAds();
      }).catch(function (e) { alert('Upload failed: ' + e.message); });
    };
    input.click();
  }

  function removeArtwork(adId) {
    if (!confirm('Remove the uploaded artwork for this ad?')) return;
    dbUpdate('programme_ads', adId, { artwork_url: null, artwork_status: 'missing' })
      .then(function () { SpnsState.loaded.ads = false; loadAds(); })
      .catch(function (e) { alert('Could not remove artwork: ' + e.message); });
  }

  // -- Metric tile for overview -------------------------------------------------

  function mktTile(id, kicker, value, label, color) {
    return '<div class="template-brand-card template-brand-card--square template-brand-card--metric" style="--brand-tile-bg:' + color + ';--brand-tile-ink:#ffffff;">' +
      '<div class="template-brand-card-inner"><div class="template-brand-tile-content">' +
        '<div class="template-brand-tile-container template-brand-tile-container--header"><div class="template-brand-tile-kicker">' + kicker + '</div></div>' +
        '<div class="template-brand-tile-container template-brand-tile-container--title"><div class="template-brand-tile-number" id="' + id + '">' + value + '</div></div>' +
        '<div class="template-brand-tile-container template-brand-tile-container--body"><div class="template-brand-tile-metric-label">' + label + '</div></div>' +
        '<div class="template-brand-tile-container template-brand-tile-container--footer"><div class="template-brand-tile-progress"><span style="width:0%"></span></div></div>' +
      '</div></div>' +
    '</div>';
  }

  function badgePayment(s) {
    var m = { paid: ['paid','Paid'], unpaid: ['pending','Unpaid'], invoice_sent: ['review','Invoice Sent'], overdue: ['overdue','Overdue'] };
    var pair = m[s] || ['open', s || 'Unknown'];
    return '<span class="spn-badge spn-badge--' + pair[0] + '">' + pair[1] + '</span>';
  }
  function badgeArtwork(s) {
    var m = { missing: ['missing','Not Received'], received: ['received','Received'], approved: ['approved','Approved'], print_ready: ['done','Print Ready'] };
    var pair = m[s] || ['open', s || 'Unknown'];
    return '<span class="spn-badge spn-badge--' + pair[0] + '">' + pair[1] + '</span>';
  }
  function badgeStatus(s) {
    var m = { open: ['open','Open'], in_progress: ['review','In Progress'], done: ['done','Done'] };
    var pair = m[s] || ['open', s || 'Open'];
    return '<span class="spn-badge spn-badge--' + pair[0] + '">' + pair[1] + '</span>';
  }

  // -- Tab switching ------------------------------------------------------------

  function switchTab(name) {
    document.querySelectorAll('.spn-tab').forEach(function (t) { t.classList.toggle('active', t.dataset.panel === name); });
    document.querySelectorAll('.spn-panel').forEach(function (p) { p.classList.toggle('active', p.id === 'spn-panel-' + name); });
    if (!SpnsState.loaded[name] && SpnsState.prodId) loadTab(name);
  }

  function loadTab(name) {
    SpnsState.loaded[name] = true;
    if (name === 'overview')     return loadOverview();
    if (name === 'businesses')   return loadBusinesses();
    if (name === 'ads')          return loadAds();
    if (name === 'sponsors')     return loadPackages();
    if (name === 'deliverables') return loadDeliverables();
    if (name === 'settings')     return loadSettings();
  }

  function publicPageMeta() {
    var headers = sponsorHeaders();
    return fetch(SUPABASE_URL + '/rest/v1/productions?id=eq.' + encodeURIComponent(SpnsState.prodId) + '&select=id,title,slug,poster_url,organization_id&limit=1', { headers: headers })
      .then(function (response) { return response.ok ? response.json() : []; })
      .then(function (rows) {
        var production = rows && rows[0] || {};
        if (!production.organization_id) return { production: production, organization: {} };
        return fetch(SUPABASE_URL + '/rest/v1/organizations?id=eq.' + encodeURIComponent(production.organization_id) + '&select=id,name,slug,abbreviation,logo_url&limit=1', { headers: headers })
          .then(function (response) { return response.ok ? response.json() : []; })
          .then(function (orgRows) { return { production: production, organization: orgRows && orgRows[0] || {} }; });
      });
  }

  function sponsorPublicUrl(meta) {
    var production = meta && meta.production || {};
    var organization = meta && meta.organization || {};
    var orgKey = organization.slug || organization.abbreviation || '';
    if (orgKey && production.slug) return window.location.origin + '/' + encodeURIComponent(orgKey) + '/' + encodeURIComponent(production.slug) + '/sponsors';
    return window.location.origin + '/PUBLIC/sponsors.html?prod=' + encodeURIComponent(SpnsState.prodId);
  }

  function hydratePublicPageAction() {
    var action = document.getElementById('spn-public-page-action');
    if (!action) return;
    action.href = window.location.origin + '/PUBLIC/sponsors.html?prod=' + encodeURIComponent(SpnsState.prodId);
    publicPageMeta().then(function (meta) { action.href = sponsorPublicUrl(meta); }).catch(function () {});
  }

  // -- DASHBOARD ---------------------------------------------------------------

  function dashboardSet(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function dashboardPercent(value, total) {
    return total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  }

  function dashboardSetProgress(id, value) {
    var el = document.getElementById(id);
    if (el) el.style.width = value + '%';
  }

  function dashboardBusinessName(businesses, id) {
    var business = businesses.find(function (item) { return item.id === id; });
    return business ? business.name : 'Unassigned business';
  }

  function dashboardInitials(name) {
    return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function (part) { return part.charAt(0); }).join('').toUpperCase();
  }

  function dashboardAttentionRow(item, index) {
    var colors = ['#572e88', '#769e7b', '#476aaa', '#dd8233', '#ca7ea7'];
    return '<button type="button" class="spn-dashboard-attention-row" onclick="navigateToMarketing(\'' + item.page + '\')">' +
      '<span class="spn-dashboard-business-mark" style="background:' + colors[index % colors.length] + '">' + esc(dashboardInitials(item.business)) + '</span>' +
      '<span class="spn-dashboard-attention-copy"><strong>' + esc(item.business) + '</strong><span>' + esc(item.detail) + '</span></span>' +
      '<span class="spn-dashboard-status spn-dashboard-status--' + item.tone + '">' + esc(item.status) + '</span>' +
      '<span class="spn-dashboard-chevron" aria-hidden="true">›</span>' +
    '</button>';
  }

  function loadDashboard() {
    return Promise.all([
      dbFetch('sponsor_businesses', '&select=id,name').catch(function () { return []; }),
      dbFetch('programme_ads', '&select=id,business_id,price_cents,payment_status,artwork_status,approval_status').catch(function () { return []; }),
      dbFetch('sponsor_packages', '&select=id,business_id,amount_cents,payment_status').catch(function () { return []; }),
      dbFetch('sponsor_deliverables', '&select=id,business_id,title,status,due_date').catch(function () { return []; }),
      dbFetch('sponsor_settings', '&select=settings&limit=1').catch(function () { return []; }),
    ]).then(function (results) {
      var businesses = results[0];
      var ads = results[1];
      var packages = results[2];
      var deliverables = results[3];
      var savedSettings = results[4] && results[4][0] && results[4][0].settings || {};
      var deadlines = savedSettings.deadlines || {};

      var bookedRevenue = packages.reduce(function (sum, item) { return sum + (item.amount_cents || 0); }, 0);
      var paidPackages = packages.filter(function (item) { return item.payment_status === 'paid'; });
      var paidRevenue = paidPackages.reduce(function (sum, item) { return sum + (item.amount_cents || 0); }, 0);
      var paidAds = ads.filter(function (item) { return item.payment_status === 'paid'; }).length;
      var revenuePercent = dashboardPercent(paidRevenue, bookedRevenue);
      var sponsorPercent = dashboardPercent(paidPackages.length, packages.length);
      var adsPercent = dashboardPercent(paidAds, ads.length);

      dashboardSet('spn-dashboard-revenue', fmtDollars(paidRevenue));
      dashboardSet('spn-dashboard-revenue-sub', bookedRevenue ? 'of ' + fmtDollars(bookedRevenue) + ' booked' : 'No sponsorships booked yet');
      dashboardSet('spn-dashboard-revenue-percent', revenuePercent + '%');
      dashboardSetProgress('spn-dashboard-revenue-bar', revenuePercent);
      dashboardSet('spn-dashboard-sponsors', paidPackages.length);
      dashboardSet('spn-dashboard-sponsors-sub', packages.length ? 'of ' + packages.length + ' sponsor booking' + (packages.length === 1 ? '' : 's') : 'No sponsor bookings yet');
      dashboardSet('spn-dashboard-sponsors-percent', sponsorPercent + '%');
      dashboardSetProgress('spn-dashboard-sponsors-bar', sponsorPercent);
      dashboardSet('spn-dashboard-ads', ads.length);
      dashboardSet('spn-dashboard-ads-sub', ads.length ? paidAds + ' paid placement' + (paidAds === 1 ? '' : 's') : 'No programme ads sold yet');
      dashboardSet('spn-dashboard-ads-percent', adsPercent + '%');
      dashboardSetProgress('spn-dashboard-ads-bar', adsPercent);

      var today = new Date(); today.setHours(0, 0, 0, 0);
      var deadlineLabels = { artwork: 'Artwork Due', booking: 'Ad Booking', sponsor: 'Sponsor Confirmation' };
      var deadlineList = Object.keys(deadlineLabels).map(function (key) {
        if (!deadlines[key]) return null;
        var date = new Date(deadlines[key] + 'T12:00:00');
        return isNaN(date.getTime()) ? null : { key: key, label: deadlineLabels[key], date: date };
      }).filter(Boolean).sort(function (a, b) { return a.date - b.date; });
      var nextDeadline = deadlineList.find(function (item) { return item.date >= today; }) || deadlineList[deadlineList.length - 1];
      if (nextDeadline) {
        var days = Math.ceil((nextDeadline.date - today) / 86400000);
        dashboardSet('spn-dashboard-deadline-label', nextDeadline.label);
        dashboardSet('spn-dashboard-deadline-date', nextDeadline.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
        dashboardSet('spn-dashboard-deadline-days', days < 0 ? Math.abs(days) + ' days overdue' : (days === 0 ? 'Due today' : days + ' days left'));
      } else {
        dashboardSet('spn-dashboard-deadline-label', 'No deadline set');
        dashboardSet('spn-dashboard-deadline-date', '—');
        dashboardSet('spn-dashboard-deadline-days', 'Add dates in Settings');
      }

      var attention = [];
      ads.forEach(function (ad) {
        var business = dashboardBusinessName(businesses, ad.business_id);
        if (ad.artwork_status === 'missing') attention.push({ business: business, detail: 'Programme ad artwork is missing', status: 'Artwork', tone: 'orange', page: 'programmeads' });
        if (ad.approval_status === 'pending') attention.push({ business: business, detail: 'Programme ad is awaiting approval', status: 'Review', tone: 'blue', page: 'programmeads' });
        if (ad.payment_status !== 'paid') attention.push({ business: business, detail: 'Programme ad payment is outstanding', status: 'Unpaid', tone: 'red', page: 'programmeads' });
      });
      packages.forEach(function (item) {
        if (item.payment_status !== 'paid') attention.push({ business: dashboardBusinessName(businesses, item.business_id), detail: 'Sponsor payment is outstanding', status: 'Unpaid', tone: 'red', page: 'showsponsors' });
      });
      deliverables.forEach(function (item) {
        var due = item.due_date ? new Date(item.due_date + 'T12:00:00') : null;
        if (item.status !== 'done' && due && due < today) attention.push({ business: dashboardBusinessName(businesses, item.business_id), detail: (item.title || 'Sponsor deliverable') + ' is overdue', status: 'Overdue', tone: 'red', page: 'showsponsors' });
      });

      var attentionEl = document.getElementById('spn-dashboard-attention-list');
      dashboardSet('spn-dashboard-attention-count', attention.length + ' item' + (attention.length === 1 ? '' : 's'));
      if (attentionEl) attentionEl.innerHTML = attention.length
        ? attention.slice(0, 8).map(dashboardAttentionRow).join('')
        : '<div class="spn-dashboard-all-clear"><strong>Everything is on track</strong><span>There are no sponsor or programme ad items needing attention.</span></div>';
    });
  }

  // -- OVERVIEW -----------------------------------------------------------------

  function loadOverview() {
    deriveSponsorStats();
    return Promise.all([
      dbFetch('sponsor_businesses', '&select=id,name,created_at').catch(function () { return []; }),
      dbFetch('programme_ads', '&select=id,price_cents,payment_status,artwork_status,approval_status').catch(function () { return []; }),
      dbFetch('sponsor_packages', '&select=id,amount_cents,payment_status').catch(function () { return []; }),
      dbFetch('sponsor_deliverables', '&select=id,status,due_date').catch(function () { return []; }),
    ]).then(function (results) {
      var bizList   = results[0];
      var adList    = results[1];
      var pkgList   = results[2];
      var delivList = results[3];

      var adRev       = adList.filter(function (a) { return a.payment_status === 'paid'; }).reduce(function (s, a) { return s + (a.price_cents || 0); }, 0);
      var spnRev      = pkgList.filter(function (p) { return p.payment_status === 'paid'; }).reduce(function (s, p) { return s + (p.amount_cents || 0); }, 0);
      var missingArt  = adList.filter(function (a) { return a.artwork_status === 'missing'; }).length;
      var pendingAppr = adList.filter(function (a) { return a.approval_status === 'pending'; }).length;
      var unpaid      = adList.filter(function (a) { return a.payment_status === 'unpaid'; }).length +
                        pkgList.filter(function (p) { return p.payment_status === 'unpaid'; }).length;
      var today  = new Date(); today.setHours(0, 0, 0, 0);
      var soon   = new Date(today.getTime() + 7 * 86400000);
      var upcoming  = delivList.filter(function (d) { return d.status !== 'done' && d.due_date && new Date(d.due_date) <= soon; }).length;
      var openDeliv = delivList.filter(function (d) { return d.status !== 'done'; }).length;

      function setTile(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
      setTile('spn-hero-page-count', bizList.length);
      setTile('spn-tile-ad-rev',    fmtDollars(adRev));
      setTile('spn-tile-spn-rev',   fmtDollars(spnRev));
      setTile('spn-tile-biz',       bizList.length);
      setTile('spn-tile-art',       missingArt);
      setTile('spn-tile-unpaid',    unpaid);
      setTile('spn-tile-due',       upcoming);
      setTile('spn-tile-open',      openDeliv);
      setTile('spn-tile-pending',   pendingAppr);

      var alerts = [];
      if (missingArt > 0)  alerts.push(['err',  missingArt + ' ad' + (missingArt > 1 ? 's' : '') + ' missing artwork']);
      if (unpaid > 0)      alerts.push(['warn', unpaid + ' unpaid invoice' + (unpaid > 1 ? 's' : '')]);
      if (upcoming > 0)    alerts.push(['warn', upcoming + ' deliverable' + (upcoming > 1 ? 's' : '') + ' due this week']);
      if (pendingAppr > 0) alerts.push(['warn', pendingAppr + ' ad' + (pendingAppr > 1 ? 's' : '') + ' pending approval']);
      if (!alerts.length)  alerts.push(['ok', 'Everything looks on track']);

      var alertsEl = document.getElementById('spn-alerts');
      if (alertsEl) alertsEl.innerHTML = alerts.map(function (a) {
        return '<div class="spn-alert-item spn-alert-item--' + a[0] + '"><span class="spn-alert-dot"></span>' + a[1] + '</div>';
      }).join('');

      var recent = bizList.slice(-5).reverse();
      var recentEl = document.getElementById('spn-recent-biz');
      if (recentEl) recentEl.innerHTML = recent.length
        ? recent.map(function (b) { return '<div style="padding:0.55rem 0;border-bottom:1px solid rgba(87,46,136,0.07)"><div class="spn-list-name">' + esc(b.name) + '</div></div>'; }).join('')
        : '<div style="color:#9a90b0;font-size:0.85rem;padding-top:0.5rem">No businesses added yet.</div>';
    });
  }

  // -- BUSINESSES ---------------------------------------------------------------

  function loadBusinesses() {
    return dbFetch('sponsor_businesses').then(function (data) {
      SpnsState.businesses = data;
    }).catch(function () {
      SpnsState.businesses = [];
    }).then(renderBusinesses);
  }

  function renderBusinesses() {
    var biz   = SpnsState.businesses;
    var count = document.getElementById('spn-biz-count');
    if (count) count.textContent = biz.length + ' Business' + (biz.length !== 1 ? 'es' : '');
    var head  = '<div class="spn-list-head spn-biz-cols"><span>Business</span><span>Contact</span><span>Email</span><span>Phone</span><span></span></div>';
    var listEl = document.getElementById('spn-biz-list');
    if (!listEl) return;
    if (!biz.length) {
      listEl.innerHTML = head + '<div class="spn-list-empty"><div class="spn-empty"><div class="spn-empty-icon">&#x1F3E2;</div><h3>No businesses yet</h3><p>Add the businesses, community partners, and sponsors you are working with.</p></div></div>';
      return;
    }
    listEl.innerHTML = head + biz.map(function (b) {
      return '<div class="spn-list-row spn-biz-cols">' +
        '<div><div class="spn-list-name">' + esc(b.name) + '</div>' + (b.website ? '<div class="spn-list-sub">' + esc(b.website) + '</div>' : '') + '</div>' +
        '<div class="spn-list-sub">' + esc(b.contact_name || '') + '</div>' +
        '<div class="spn-list-sub">' + esc(b.contact_email || '') + '</div>' +
        '<div class="spn-list-sub">' + esc(b.contact_phone || '') + '</div>' +
        '<div class="spn-row-actions">' +
          '<button class="spn-btn spn-btn--ghost spn-btn--sm" onclick="MarketingSponsorsModule.openBizModal(\'' + b.id + '\')">Edit</button>' +
          '<button class="spn-btn spn-btn--danger spn-btn--sm" onclick="MarketingSponsorsModule.deleteBiz(\'' + b.id + '\',\'' + esc(b.name) + '\')">Delete</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function openBizModal(id) {
    var b = id ? SpnsState.businesses.find(function (x) { return x.id === id; }) : null;
    document.getElementById('spn-biz-modal-title').textContent = b ? 'Edit Business' : 'Add Business';
    document.getElementById('spn-biz-id').value        = id || '';
    document.getElementById('spn-biz-name').value      = (b && b.name)                                     || '';
    document.getElementById('spn-biz-contact').value   = (b && b.contact_name)                             || '';
    document.getElementById('spn-biz-email').value     = (b && b.contact_email)                            || '';
    document.getElementById('spn-biz-phone').value     = (b && b.contact_phone)                            || '';
    document.getElementById('spn-biz-website').value   = (b && b.website)                                  || '';
    document.getElementById('spn-biz-instagram').value = (b && b.social_links && b.social_links.instagram) || '';
    document.getElementById('spn-biz-notes').value     = (b && b.notes)                                    || '';
    document.getElementById('spn-biz-modal').classList.add('open');
  }
  function closeBizModal() { document.getElementById('spn-biz-modal').classList.remove('open'); }

  function saveBiz() {
    var name = document.getElementById('spn-biz-name').value.trim();
    if (!name) { alert('Business name is required.'); return; }
    var id = document.getElementById('spn-biz-id').value;
    var payload = {
      name:          name,
      contact_name:  document.getElementById('spn-biz-contact').value.trim()  || null,
      contact_email: document.getElementById('spn-biz-email').value.trim()    || null,
      contact_phone: document.getElementById('spn-biz-phone').value.trim()    || null,
      website:       document.getElementById('spn-biz-website').value.trim()  || null,
      social_links:  { instagram: document.getElementById('spn-biz-instagram').value.trim() || null },
      notes:         document.getElementById('spn-biz-notes').value.trim()    || null,
    };
    var p = id ? dbUpdate('sponsor_businesses', id, payload) : dbInsert('sponsor_businesses', payload);
    p.then(function () { closeBizModal(); SpnsState.loaded.businesses = false; loadBusinesses(); })
     .catch(function (e) { alert('Could not save: ' + e.message); });
  }

  function deleteBiz(id, name) {
    if (!confirm('Delete "' + name + '"? This cannot be undone.')) return;
    dbDelete('sponsor_businesses', id)
      .then(function () { SpnsState.loaded.businesses = false; loadBusinesses(); })
      .catch(function (e) { alert('Could not delete: ' + e.message); });
  }

  // -- ADS ----------------------------------------------------------------------

  function loadAds() {
    refreshAdsGrouped();
    var settingsPromise = SpnsState.loaded.settings
      ? Promise.resolve()
      : dbFetch('sponsor_settings', '&select=settings&limit=1').then(function (data) {
          SpnsState.loaded.settings = true;
          if (data && data[0] && data[0].settings) {
            var s = data[0].settings;
            if (s.adSizes     && s.adSizes.length)     SpnsState.settings.adSizes     = s.adSizes;
            if (s.tiers       && s.tiers.length)       SpnsState.settings.tiers       = normalizeSponsorTiers(s.tiers);
            if (s.publicStats && s.publicStats.length) SpnsState.settings.publicStats = s.publicStats;
          }
        }).catch(function () { SpnsState.loaded.settings = true; });
    var bizPromise = SpnsState.businesses.length === 0
      ? dbFetch('sponsor_businesses').then(function (d) { SpnsState.businesses = d; }).catch(function () {})
      : Promise.resolve();
    var posterPromise = SpnsState.loaded.poster
      ? Promise.resolve()
      : fetchPosterUrl().then(function (url) { SpnsState.posterUrl = url; SpnsState.loaded.poster = true; });
    return Promise.all([settingsPromise, bizPromise, posterPromise]).then(function () {
      return dbFetch('programme_ads').then(function (data) {
        SpnsState.ads = data;
      }).catch(function () {
        SpnsState.ads = [];
      }).then(function () {
        refreshAdsGrouped();
      });
    });
  }

  function openAdModal(id, defaultSizeId) {
    var a = id ? SpnsState.ads.find(function (x) { return x.id === id; }) : null;
    document.getElementById('spn-ad-modal-title').textContent = a ? 'Edit Ad' : 'Add Programme Ad';
    document.getElementById('spn-ad-id').value = id || '';

    var bizSel = document.getElementById('spn-ad-biz');
    bizSel.innerHTML = '<option value="">No business linked</option>' + SpnsState.businesses.map(function (b) {
      return '<option value="' + b.id + '"' + (a && a.business_id === b.id ? ' selected' : '') + '>' + esc(b.name) + '</option>';
    }).join('');

    var sizeSel = document.getElementById('spn-ad-size');
    sizeSel.innerHTML = '<option value="">Select size...</option>' + SpnsState.settings.adSizes.map(function (s) {
      return '<option value="' + s.id + '"' + (a && a.ad_size === s.id ? ' selected' : '') + '>' + s.label + '</option>';
    }).join('');
    if (!a && defaultSizeId) sizeSel.value = defaultSizeId;

    var typeSel = document.getElementById('spn-ad-type');
    document.getElementById('spn-ad-price').value    = a ? ((a.price_cents || 0) / 100).toFixed(2) : '';
    document.getElementById('spn-ad-payment').value  = (a && a.payment_status)  || 'unpaid';
    document.getElementById('spn-ad-artwork').value  = (a && a.artwork_status)  || 'missing';
    document.getElementById('spn-ad-approval').value = (a && a.approval_status) || 'pending';
    document.getElementById('spn-ad-notes').value    = (a && a.notes)           || '';

    function syncTypeOptions(preferredType) {
      var sz = SpnsState.settings.adSizes.find(function (x) { return x.id === sizeSel.value; });
      var choices = [];
      if (!sz || sz.colour_enabled !== false) choices.push({ value: 'colour', label: 'Colour' });
      if (!sz || sz.bw_enabled !== false) choices.push({ value: 'bw', label: 'Black & White' });
      typeSel.innerHTML = choices.map(function (choice) { return '<option value="' + choice.value + '">' + choice.label + '</option>'; }).join('');
      if (choices.some(function (choice) { return choice.value === preferredType; })) typeSel.value = preferredType;
    }
    function autofillPrice() {
      var sz = SpnsState.settings.adSizes.find(function (x) { return x.id === sizeSel.value; });
      if (sz) document.getElementById('spn-ad-price').value = (typeSel.value === 'bw' ? sz.bw : sz.colour).toFixed(2);
    }
    syncTypeOptions((a && a.ad_type) || 'colour');
    sizeSel.onchange = function () { syncTypeOptions(typeSel.value); autofillPrice(); };
    typeSel.onchange = autofillPrice;
    if (!a && defaultSizeId) autofillPrice();
    document.getElementById('spn-ad-modal').classList.add('open');
  }
  function closeAdModal() { document.getElementById('spn-ad-modal').classList.remove('open'); }

  function saveAd() {
    if (!document.getElementById('spn-ad-size').value) { alert('Please select an ad size.'); return; }
    var selectedSize = SpnsState.settings.adSizes.find(function (size) { return size.id === document.getElementById('spn-ad-size').value; });
    var selectedType = document.getElementById('spn-ad-type').value;
    if (selectedSize && ((selectedType === 'colour' && selectedSize.colour_enabled === false) || (selectedType === 'bw' && selectedSize.bw_enabled === false))) {
      alert('That format is not offered for this ad size.');
      return;
    }
    var id = document.getElementById('spn-ad-id').value;
    var payload = {
      business_id:     document.getElementById('spn-ad-biz').value     || null,
      ad_size:         document.getElementById('spn-ad-size').value,
      ad_type:         document.getElementById('spn-ad-type').value,
      price_cents:     Math.round((parseFloat(document.getElementById('spn-ad-price').value) || 0) * 100),
      payment_status:  document.getElementById('spn-ad-payment').value,
      artwork_status:  document.getElementById('spn-ad-artwork').value,
      approval_status: document.getElementById('spn-ad-approval').value,
      notes:           document.getElementById('spn-ad-notes').value.trim() || null,
    };
    var p = id ? dbUpdate('programme_ads', id, payload) : dbInsert('programme_ads', payload);
    p.then(function () { closeAdModal(); SpnsState.loaded.ads = false; loadAds(); })
     .catch(function (e) { alert('Could not save: ' + e.message); });
  }

  function deleteAd(id) {
    if (!confirm('Delete this ad? This cannot be undone.')) return;
    dbDelete('programme_ads', id)
      .then(function () { SpnsState.loaded.ads = false; loadAds(); })
      .catch(function (e) { alert('Could not delete: ' + e.message); });
  }

  // -- SPONSOR PACKAGES ---------------------------------------------------------

  function loadPackages() {
    var businessesPromise = SpnsState.businesses.length
      ? Promise.resolve()
      : dbFetch('sponsor_businesses').then(function (data) { SpnsState.businesses = data; }).catch(function () { SpnsState.businesses = []; });
    var packagesPromise = dbFetch('sponsor_packages').then(function (data) {
      SpnsState.packages = data;
    }).catch(function () {
      SpnsState.packages = [];
    });
    return Promise.all([businessesPromise, packagesPromise]).then(renderPackages);
  }

  function renderPackages() {
    var pkgs  = SpnsState.packages;
    var count = document.getElementById('spn-pkgs-count');
    if (count) count.textContent = pkgs.length + ' Sponsor' + (pkgs.length !== 1 ? 's' : '');
    var heroCount = document.getElementById('spn-hero-page-count');
    if (heroCount && heroCount.dataset.kind === 'sponsors') heroCount.textContent = pkgs.length;
    var head  = '<div class="spn-list-head spn-pkg-cols"><span>Business</span><span>Tier</span><span>Amount</span><span>Payment</span><span></span></div>';
    var listEl = document.getElementById('spn-pkgs-list');
    if (!listEl) return;
    if (!pkgs.length) {
      listEl.innerHTML = head + '<div class="spn-list-empty"><div class="spn-empty"><div class="spn-empty-icon">&#x2B50;</div><h3>No sponsor packages yet</h3><p>Add sponsor tiers and packages here to track amounts, payments, and included benefits.</p></div></div>';
      return;
    }
    listEl.innerHTML = head + pkgs.map(function (p) {
      return '<div class="spn-list-row spn-pkg-cols">' +
        '<div class="spn-list-name">' + (esc(bizName(p.business_id)) || '<span style="color:#b0a8c8">No business</span>') + '</div>' +
        '<div class="spn-list-sub">' + esc(p.tier_name || '') + '</div>' +
        '<div class="spn-list-sub">' + fmtDollars(p.amount_cents || 0) + '</div>' +
        '<div>' + badgePayment(p.payment_status) + '</div>' +
        '<div class="spn-row-actions">' +
          '<button class="spn-btn spn-btn--ghost spn-btn--sm" onclick="MarketingSponsorsModule.openPkgModal(\'' + p.id + '\')">Edit</button>' +
          '<button class="spn-btn spn-btn--danger spn-btn--sm" onclick="MarketingSponsorsModule.deletePkg(\'' + p.id + '\')">Delete</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function openPkgModal(id) {
    var p = id ? SpnsState.packages.find(function (x) { return x.id === id; }) : null;
    document.getElementById('spn-pkg-modal-title').textContent = p ? 'Edit Sponsor' : 'Add Sponsor';
    document.getElementById('spn-pkg-id').value = id || '';

    var bizSel = document.getElementById('spn-pkg-biz');
    bizSel.innerHTML = '<option value="">No business linked</option>' + SpnsState.businesses.map(function (b) {
      return '<option value="' + b.id + '"' + (p && p.business_id === b.id ? ' selected' : '') + '>' + esc(b.name) + '</option>';
    }).join('');

    var tierSel = document.getElementById('spn-pkg-tier');
    tierSel.innerHTML = '<option value="">Custom / no tier</option>' + SpnsState.settings.tiers.map(function (t) {
      return '<option value="' + esc(t.label) + '"' + (p && p.tier_name === t.label ? ' selected' : '') + '>' + esc(t.label) + ' (' + fmtDollars(t.amount * 100) + ')</option>';
    }).join('');
    tierSel.onchange = function () {
      var t = SpnsState.settings.tiers.find(function (x) { return x.label === tierSel.value; });
      if (t && !document.getElementById('spn-pkg-amount').value) document.getElementById('spn-pkg-amount').value = t.amount.toFixed(2);
    };

    document.getElementById('spn-pkg-amount').value   = p ? ((p.amount_cents || 0) / 100).toFixed(2) : '';
    document.getElementById('spn-pkg-payment').value  = (p && p.payment_status) || 'unpaid';
    document.getElementById('spn-pkg-benefits').value = (p && p.benefits)       || '';
    document.getElementById('spn-pkg-notes').value    = (p && p.notes)          || '';
    document.getElementById('spn-pkg-modal').classList.add('open');
  }
  function closePkgModal() { document.getElementById('spn-pkg-modal').classList.remove('open'); }

  function savePkg() {
    var id = document.getElementById('spn-pkg-id').value;
    var payload = {
      business_id:    document.getElementById('spn-pkg-biz').value    || null,
      tier_name:      document.getElementById('spn-pkg-tier').value    || null,
      amount_cents:   Math.round((parseFloat(document.getElementById('spn-pkg-amount').value) || 0) * 100),
      payment_status: document.getElementById('spn-pkg-payment').value,
      benefits:       document.getElementById('spn-pkg-benefits').value.trim() || null,
      notes:          document.getElementById('spn-pkg-notes').value.trim()    || null,
    };
    var p2 = id ? dbUpdate('sponsor_packages', id, payload) : dbInsert('sponsor_packages', payload);
    p2.then(function () { closePkgModal(); SpnsState.loaded.sponsors = false; loadPackages(); })
      .catch(function (e) { alert('Could not save: ' + e.message); });
  }

  function deletePkg(id) {
    if (!confirm('Delete this sponsor package? This cannot be undone.')) return;
    dbDelete('sponsor_packages', id)
      .then(function () { SpnsState.loaded.sponsors = false; loadPackages(); })
      .catch(function (e) { alert('Could not delete: ' + e.message); });
  }

  // -- DELIVERABLES -------------------------------------------------------------

  function loadDeliverables() {
    var p1 = SpnsState.businesses.length === 0
      ? dbFetch('sponsor_businesses').then(function (d) { SpnsState.businesses = d; }).catch(function () {})
      : Promise.resolve();
    return p1.then(function () {
      return dbFetch('sponsor_deliverables').then(function (data) {
        SpnsState.deliverables = data;
      }).catch(function () {
        SpnsState.deliverables = [];
      }).then(renderDeliverables);
    });
  }

  function renderDeliverables() {
    var items = SpnsState.deliverables;
    var done  = items.filter(function (d) { return d.status === 'done'; }).length;
    var count = document.getElementById('spn-deliv-count');
    if (count) count.textContent = done + ' of ' + items.length + ' complete';
    var listEl = document.getElementById('spn-deliv-list');
    if (!listEl) return;
    if (!items.length) {
      listEl.innerHTML = '<div class="spn-list-empty"><div class="spn-empty"><div class="spn-empty-icon">&#x2705;</div><h3>No deliverables yet</h3><p>Track everything the theatre owes to sponsors and ad buyers.</p></div></div>';
      return;
    }
    listEl.innerHTML = items.map(function (d) {
      var meta = [
        bizName(d.business_id) ? esc(bizName(d.business_id)) : '',
        d.due_date ? 'Due ' + fmtDate(d.due_date) : '',
        d.assigned_to ? esc(d.assigned_to) : '',
      ].filter(Boolean).join(' · ');
      return '<div class="spn-deliverable-row">' +
        '<input type="checkbox" class="spn-deliverable-check" ' + (d.status === 'done' ? 'checked' : '') + ' onchange="MarketingSponsorsModule.toggleDeliv(\'' + d.id + '\', this.checked)" />' +
        '<div>' +
          '<div class="spn-deliverable-title' + (d.status === 'done' ? ' done' : '') + '">' + esc(d.title) + '</div>' +
          '<div class="spn-deliverable-meta">' + meta + '</div>' +
        '</div>' +
        '<div>' + badgeStatus(d.status) + '</div>' +
        '<div class="spn-row-actions">' +
          '<button class="spn-btn spn-btn--ghost spn-btn--sm" onclick="MarketingSponsorsModule.openDelivModal(\'' + d.id + '\')">Edit</button>' +
          '<button class="spn-btn spn-btn--danger spn-btn--sm" onclick="MarketingSponsorsModule.deleteDeliv(\'' + d.id + '\')">Delete</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function toggleDeliv(id, checked) {
    dbUpdate('sponsor_deliverables', id, { status: checked ? 'done' : 'open' })
      .then(function () { SpnsState.loaded.deliverables = false; loadDeliverables(); })
      .catch(function (e) { alert('Could not update: ' + e.message); });
  }

  function openDelivModal(id) {
    var d = id ? SpnsState.deliverables.find(function (x) { return x.id === id; }) : null;
    document.getElementById('spn-deliv-modal-title').textContent = d ? 'Edit Deliverable' : 'Add Deliverable';
    document.getElementById('spn-deliv-id').value       = id || '';
    document.getElementById('spn-deliv-title').value    = (d && d.title)       || '';
    document.getElementById('spn-deliv-due').value      = (d && d.due_date)    || '';
    document.getElementById('spn-deliv-assigned').value = (d && d.assigned_to) || '';
    document.getElementById('spn-deliv-status').value   = (d && d.status)      || 'open';
    document.getElementById('spn-deliv-notes').value    = (d && d.notes)       || '';
    var bizSel = document.getElementById('spn-deliv-biz');
    bizSel.innerHTML = '<option value="">No business linked</option>' + SpnsState.businesses.map(function (b) {
      return '<option value="' + b.id + '"' + (d && d.business_id === b.id ? ' selected' : '') + '>' + esc(b.name) + '</option>';
    }).join('');
    document.getElementById('spn-deliv-modal').classList.add('open');
  }
  function closeDelivModal() { document.getElementById('spn-deliv-modal').classList.remove('open'); }

  function saveDeliv() {
    var title = document.getElementById('spn-deliv-title').value.trim();
    if (!title) { alert('Title is required.'); return; }
    var id = document.getElementById('spn-deliv-id').value;
    var payload = {
      title:       title,
      business_id: document.getElementById('spn-deliv-biz').value             || null,
      due_date:    document.getElementById('spn-deliv-due').value              || null,
      assigned_to: document.getElementById('spn-deliv-assigned').value.trim() || null,
      status:      document.getElementById('spn-deliv-status').value,
      notes:       document.getElementById('spn-deliv-notes').value.trim()    || null,
    };
    var p = id ? dbUpdate('sponsor_deliverables', id, payload) : dbInsert('sponsor_deliverables', payload);
    p.then(function () { closeDelivModal(); SpnsState.loaded.deliverables = false; loadDeliverables(); })
     .catch(function (e) { alert('Could not save: ' + e.message); });
  }

  function deleteDeliv(id) {
    if (!confirm('Delete this deliverable? This cannot be undone.')) return;
    dbDelete('sponsor_deliverables', id)
      .then(function () { SpnsState.loaded.deliverables = false; loadDeliverables(); })
      .catch(function (e) { alert('Could not delete: ' + e.message); });
  }

  // -- SETTINGS -----------------------------------------------------------------

  function loadSettings() {
    return dbFetch('sponsor_settings', '&select=settings&limit=1').then(function (data) {
      if (data && data[0] && data[0].settings) {
        var s = data[0].settings;
        if (s.adSizes && s.adSizes.length) SpnsState.settings.adSizes = s.adSizes;
        if (s.tiers   && s.tiers.length)   SpnsState.settings.tiers   = normalizeSponsorTiers(s.tiers);
        SpnsState.settings.publicStats = Array.isArray(s.publicStats) ? s.publicStats : [];
        SpnsState.settings.publicPage = mergePublicPage(s.publicPage);
        if (!SpnsState.publicPageDirty) {
          SpnsState.settings.publicPageDraft = mergePublicPage(s.publicPageDraft || s.publicPage);
          SpnsState.publicPageHasDraftChanges = publicPagesDiffer(SpnsState.settings.publicPage, SpnsState.settings.publicPageDraft);
        }
        if (s.deadlines) {
          var artEl = document.getElementById('spn-deadline-artwork');
          var bkEl  = document.getElementById('spn-deadline-booking');
          var spEl  = document.getElementById('spn-deadline-sponsor');
          if (artEl) artEl.value = s.deadlines.artwork || '';
          if (bkEl)  bkEl.value  = s.deadlines.booking || '';
          if (spEl)  spEl.value  = s.deadlines.sponsor  || '';
        }
      }
    }).catch(function () {}).then(function () {
      renderSettings();
      refreshAdsGrouped();
      updatePublicPageStatus();
      updatePublicPageDraftActions();
      deriveSponsorStats();
    });
  }

  function loadPublicPageStatus() {
    var url = SUPABASE_URL + '/rest/v1/sponsor_settings?production_id=eq.' + encodeURIComponent(SpnsState.prodId) + '&select=settings&limit=1';
    return fetch(url, { headers: sponsorHeaders() }).then(function (response) {
      if (!response.ok) return response.text().then(function (text) { throw new Error(text); });
      return response.json();
    }).then(function (data) {
      var settings = data && data[0] && data[0].settings;
      if (settings) {
        SpnsState.settings.publicStats = Array.isArray(settings.publicStats) ? settings.publicStats : SpnsState.settings.publicStats;
        SpnsState.settings.publicPage = mergePublicPage(settings.publicPage);
        if (!SpnsState.publicPageDirty) {
          SpnsState.settings.publicPageDraft = mergePublicPage(settings.publicPageDraft || settings.publicPage);
          SpnsState.publicPageHasDraftChanges = publicPagesDiffer(SpnsState.settings.publicPage, SpnsState.settings.publicPageDraft);
        }
      }
      updatePublicPageStatus();
      updatePublicPageDraftActions();
    }).catch(function () {
      var strip = ensurePublicPageStatusStrip();
      if (strip && typeof strip.update === 'function') {
        strip.update({ state: 'setup', title: 'Sponsor page status unavailable', subtitle: '', showView: false, showCopy: false, showToggle: false, toggleLabel: '' });
        if (typeof strip.setVisible === 'function') strip.setVisible(true);
      }
    });
  }

  function renderSettings() {
    var aszEl = document.getElementById('spn-adsize-list');
    if (aszEl) aszEl.innerHTML = '<div class="spn-settings-tile-grid">' +
      SpnsState.settings.adSizes.map(function (s, i) {
        var dimsDisplay = String(s.dims).replace(/[xX]/, '" x ') + '"';
        var priceParts = [];
        if (s.colour_enabled !== false) priceParts.push('Colour: $' + s.colour);
        if (s.bw_enabled !== false) priceParts.push('B&amp;W: $' + s.bw);
        return settingsTile(
          'Ad Size',
          esc(s.label),
          esc(dimsDisplay) + '<br>' + priceParts.join(' &nbsp;&middot;&nbsp; '),
          '<button class="template-brand-tile-button" onclick="MarketingSponsorsModule.editAdSize(' + i + ')">Edit</button>',
          ADTILE_COLORS[i % ADTILE_COLORS.length]
        );
      }).join('') +
    '</div>';

    var tierEl = document.getElementById('spn-tier-list');
    if (tierEl) tierEl.innerHTML = '<div class="spn-settings-tile-grid">' +
      SpnsState.settings.tiers.map(function (t, i) {
        return settingsTile(
          'Sponsor Tier',
          esc(t.label),
          '$' + t.amount,
          '<button class="template-brand-tile-button" onclick="MarketingSponsorsModule.editTier(' + i + ')">Edit</button>',
          ADTILE_COLORS[(i + 2) % ADTILE_COLORS.length]
        );
      }).join('') +
      '<div style="grid-column:1/-1;padding-top:0.25rem">' +
        '<button class="spn-btn spn-btn--ghost" onclick="MarketingSponsorsModule.addTier()">+ Add Tier</button>' +
      '</div>' +
    '</div>';
  }

  var _previewScaleObs = null;
  var autoSaveDraftTimer = null;

  function switchSettingsTab(name) {
    var valid = ['sizes', 'tiers', 'deadlines', 'publicpage'];
    var next = valid.indexOf(name) >= 0 ? name : 'sizes';
    if (next === 'publicpage') renderPublicPageEditor();
    document.querySelectorAll('.spn-settings-tab').forEach(function (button) {
      var active = button.dataset.settingsPanel === next;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    document.querySelectorAll('.spn-settings-panel').forEach(function (panel) {
      panel.classList.toggle('active', panel.id === 'spn-settings-' + next);
    });
    var savebar = document.getElementById('spn-settings-savebar');
    if (savebar) savebar.hidden = next === 'publicpage';
    if (next === 'publicpage') {
      requestAnimationFrame(function () { initPreviewScaling(); });
    }
  }

  function settingsSlug(value, fallback) {
    return String(value || fallback || 'item').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || fallback || 'item';
  }

  function syncAdSizeFormatControls() {
    var colourOn = document.getElementById('spn-adsize-colour-enabled').checked;
    var bwOn = document.getElementById('spn-adsize-bw-enabled').checked;
    document.getElementById('spn-adsize-colour').disabled = !colourOn;
    document.getElementById('spn-adsize-bw').disabled = !bwOn;
  }

  function editAdSize(i) {
    var item = Number.isInteger(i) ? SpnsState.settings.adSizes[i] : null;
    document.getElementById('spn-adsize-modal-title').textContent = item ? 'Edit Programme Ad Size' : 'Add Programme Ad Size';
    document.getElementById('spn-adsize-index').value = item ? String(i) : '';
    document.getElementById('spn-adsize-name').value = item ? item.label : '';
    document.getElementById('spn-adsize-dims').value = item ? item.dims : '';
    document.getElementById('spn-adsize-colour').value = item ? item.colour : '';
    document.getElementById('spn-adsize-bw').value = item ? item.bw : '';
    document.getElementById('spn-adsize-colour-enabled').checked = !item || item.colour_enabled !== false;
    document.getElementById('spn-adsize-bw-enabled').checked = !item || item.bw_enabled !== false;
    syncAdSizeFormatControls();
    document.getElementById('spn-adsize-delete').hidden = !item;
    document.getElementById('spn-adsize-modal').classList.add('open');
  }

  function closeAdSizeModal() {
    document.getElementById('spn-adsize-modal').classList.remove('open');
  }

  function saveAdSize() {
    var indexValue = document.getElementById('spn-adsize-index').value;
    var index = indexValue === '' ? -1 : Number(indexValue);
    var existing = index >= 0 ? SpnsState.settings.adSizes[index] : null;
    var label = document.getElementById('spn-adsize-name').value.trim();
    var dims = document.getElementById('spn-adsize-dims').value.trim().replace(/\s+/g, '');
    var colour = Number(document.getElementById('spn-adsize-colour').value);
    var bw = Number(document.getElementById('spn-adsize-bw').value);
    var colourEnabled = document.getElementById('spn-adsize-colour-enabled').checked;
    var bwEnabled = document.getElementById('spn-adsize-bw-enabled').checked;
    if (!label) { alert('Enter a name for this ad size.'); return; }
    if (!/^\d+(?:\.\d+)?[xX]\d+(?:\.\d+)?$/.test(dims)) { alert('Enter dimensions as height x width, for example 4x5.'); return; }
    if (!colourEnabled && !bwEnabled) { alert('Offer Colour, Black & White, or both.'); return; }
    if ((colourEnabled && (!Number.isFinite(colour) || colour < 0)) || (bwEnabled && (!Number.isFinite(bw) || bw < 0))) { alert('Enter a valid price for each offered format.'); return; }
    var item = Object.assign({}, existing || {}, {
      id: existing && existing.id || settingsSlug(label, 'ad-size') + '-' + Date.now(),
      label: label,
      dims: dims.toLowerCase(),
      colour: colour,
      bw: bw,
      colour_enabled: colourEnabled,
      bw_enabled: bwEnabled,
    });
    if (index >= 0) SpnsState.settings.adSizes[index] = item;
    else SpnsState.settings.adSizes.push(item);
    closeAdSizeModal();
    renderSettings();
    refreshAdsGrouped();
  }

  function deleteAdSize() {
    var index = Number(document.getElementById('spn-adsize-index').value);
    if (!Number.isInteger(index) || index < 0 || !SpnsState.settings.adSizes[index]) return;
    var sizeId = SpnsState.settings.adSizes[index].id;
    var inUse = SpnsState.ads.filter(function (ad) { return ad.ad_size === sizeId; }).length;
    if (inUse) { alert('This size is used by ' + inUse + ' programme ad' + (inUse === 1 ? '' : 's') + '. Move those ads to another size before removing it.'); return; }
    if (!confirm('Remove this programme ad size?')) return;
    SpnsState.settings.adSizes.splice(index, 1);
    closeAdSizeModal();
    renderSettings();
    refreshAdsGrouped();
  }

  function addTier() { editTier(); }

  function editTier(i) {
    var item = Number.isInteger(i) ? SpnsState.settings.tiers[i] : null;
    document.getElementById('spn-tier-modal-title').textContent = item ? 'Edit Sponsor Tier' : 'Add Sponsor Tier';
    document.getElementById('spn-tier-index').value = item ? String(i) : '';
    document.getElementById('spn-tier-name').value = item ? item.label : '';
    document.getElementById('spn-tier-amount').value = item ? item.amount : '';
    document.getElementById('spn-tier-slots').value = item && item.slots != null ? item.slots : '';
    document.getElementById('spn-tier-bullets').value = item ? (item.bullets || '') : '';
    document.getElementById('spn-tier-delete').hidden = !item;
    document.getElementById('spn-tier-modal').classList.add('open');
  }

  function closeTierModal() {
    document.getElementById('spn-tier-modal').classList.remove('open');
  }

  function saveTier() {
    var indexValue = document.getElementById('spn-tier-index').value;
    var index = indexValue === '' ? -1 : Number(indexValue);
    var existing = index >= 0 ? SpnsState.settings.tiers[index] : null;
    var label = document.getElementById('spn-tier-name').value.trim();
    var amount = Number(document.getElementById('spn-tier-amount').value);
    var slotsRaw = document.getElementById('spn-tier-slots').value.trim();
    var slots = slotsRaw !== '' ? Number(slotsRaw) : null;
    var bullets = document.getElementById('spn-tier-bullets').value.trim();
    if (!label) { alert('Enter a sponsor tier name.'); return; }
    if (!Number.isFinite(amount) || amount < 0) { alert('Enter a valid default amount.'); return; }
    var item = Object.assign({}, existing || {}, {
      id: existing && existing.id || settingsSlug(label, 'sponsor-tier') + '-' + Date.now(),
      label: label,
      amount: amount,
      bullets: bullets || '',
      slots: slots,
    });
    if (index >= 0) SpnsState.settings.tiers[index] = item;
    else SpnsState.settings.tiers.push(item);
    closeTierModal();
    renderSettings();
  }

  function deleteTier() {
    var index = Number(document.getElementById('spn-tier-index').value);
    if (!Number.isInteger(index) || index < 0 || !SpnsState.settings.tiers[index]) return;
    if (!confirm('Remove this sponsor tier?')) return;
    SpnsState.settings.tiers.splice(index, 1);
    closeTierModal();
    renderSettings();
  }

  var STAT_SLOT_DEFAULTS = [
    { label: 'Performances',      subtext: 'Pulled from the production schedule', color: '#572e88' },
    { label: 'Audience per show', subtext: 'Estimated from the ticket budget',    color: '#769e7b' },
    { label: 'Total audience',    subtext: 'Estimated across all performances',   color: '#efab45' },
    { label: 'Cast & crew',       subtext: 'People bringing the show to life',    color: '#d1523d' },
  ];

  function renderPublicStatsAdmin() {
    var grid = document.getElementById('spn-public-stats-grid');
    if (!grid) return;
    grid.innerHTML = '';
  }

  function publicStatsEditorRows() {
    var existing = SpnsState.settings.publicStats || [];
    return STAT_SLOT_DEFAULTS.map(function (def, i) {
      var stat = existing[i] || {};
      return '<div class="spn-public-stat-row">' +
        '<div class="spn-public-stat-swatch" style="background:' + def.color + '"></div>' +
        '<div class="spn-public-stat-fields">' +
          '<div class="spn-field"><label>Value</label><input type="text" class="spn-public-stat-value" data-i="' + i + '" placeholder="600+" value="' + escHtml(stat.value || '') + '" /></div>' +
          '<div class="spn-field"><label>Label</label><input type="text" class="spn-public-stat-label" data-i="' + i + '" placeholder="' + escHtml(def.label) + '" value="' + escHtml(stat.label || '') + '" /></div>' +
          '<div class="spn-field spn-public-stat-sub-field"><label>Subtext</label><input type="text" class="spn-public-stat-subtext" data-i="' + i + '" placeholder="' + escHtml(def.subtext) + '" value="' + escHtml(stat.subtext || '') + '" /></div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function collectPublicStats() {
    if (!document.querySelector('.spn-public-stat-value')) return SpnsState.settings.publicStats || [];
    return STAT_SLOT_DEFAULTS.map(function (def, i) {
      var value   = (document.querySelector('.spn-public-stat-value[data-i="'  + i + '"]')   || {}).value || '';
      var label   = (document.querySelector('.spn-public-stat-label[data-i="'  + i + '"]')   || {}).value || '';
      var subtext = (document.querySelector('.spn-public-stat-subtext[data-i="' + i + '"]')  || {}).value || '';
      if (!value.trim()) return null;
      return {
        value:   value.trim(),
        label:   label.trim()   || def.label,
        subtext: subtext.trim() || def.subtext,
        color:   def.color,
      };
    }).filter(Boolean);
  }

  function deriveSponsorStats() {
    var prodId = SpnsState.prodId;
    if (!prodId) return Promise.resolve();
    var base = SUPABASE_URL + '/rest/v1/';
    var h = sponsorHeaders();
    return Promise.all([
      fetch(base + 'production_events?production_id=eq.' + encodeURIComponent(prodId) + '&event_type=eq.performance&select=id', { headers: h }).then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; }),
      fetch(base + 'budget_items?production_id=eq.' + encodeURIComponent(prodId) + '&select=name,qty', { headers: h }).then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; }),
    ]).then(function(results) {
      var events = results[0] || [];
      var ticketItems = results[1] || [];
      console.log('[BTS Sponsors] deriveSponsorStats — budget_items returned:', ticketItems.length, 'items');
      console.log('[BTS Sponsors] item names+qty:', ticketItems.map(function(i){ return '"' + i.name + '"=' + i.qty; }).join(', '));
      var performanceCount = events.length;
      if (!performanceCount) {
        var showsItem = ticketItems.find ? ticketItems.find(function(it){ return /how many shows|number of shows/i.test(it.name || ''); }) : null;
        performanceCount = showsItem ? (Number(showsItem.qty) || 0) : 0;
      }
      function itemVal(it) { return Number(it.qty) || Math.round((Number(it.unit_cost_cents) || 0) / 100) || 0; }
      var seatsItem = ticketItems.find ? ticketItems.find(function(it){ return /seat|capacity|venue.*cap/i.test(it.name || ''); }) : null;
      var attendItem = ticketItems.find ? ticketItems.find(function(it){ return /attendance|occupancy|fill/i.test(it.name || ''); }) : null;
      var showsItem2 = ticketItems.find ? ticketItems.find(function(it){ return /number of shows|how many shows/i.test(it.name || ''); }) : null;
      var totalAudienceItem = ticketItems.find ? ticketItems.find(function(it){ return /total audience/i.test(it.name || ''); }) : null;
      console.log('[BTS Sponsors] seatsItem:', seatsItem ? '"'+seatsItem.name+'"='+itemVal(seatsItem) : 'NOT FOUND', '| attendItem:', attendItem ? '"'+attendItem.name+'"='+itemVal(attendItem) : 'NOT FOUND');
      var capacity = seatsItem ? itemVal(seatsItem) : 0;
      var attendRaw = attendItem ? itemVal(attendItem) : 0;
      var pct = attendRaw > 0 ? Math.min(100, attendRaw) / 100 : 1;
      var audiencePerShow = capacity > 0 ? Math.round(capacity * pct) : 0;
      if (!audiencePerShow && showsItem2 && performanceCount > 0) {
        var showCount2 = itemVal(showsItem2);
        if (showCount2 > 0 && totalAudienceItem) audiencePerShow = Math.round(itemVal(totalAudienceItem) / showCount2);
      }
      if (!audiencePerShow && totalAudienceItem && performanceCount > 0) {
        audiencePerShow = Math.round(itemVal(totalAudienceItem) / performanceCount);
      }
      if (!audiencePerShow && performanceCount > 0) {
        var genericItems = ticketItems.filter(function(it){ return /ticket|admission|adult|student|senior|child|season pass/i.test(it.name||''); });
        var totalQty = genericItems.reduce(function(s,it){ return s + itemVal(it); }, 0);
        if (totalQty > 0) audiencePerShow = Math.round(totalQty / performanceCount);
        console.log('[BTS Sponsors] genericItems fallback:', genericItems.map(function(i){ return i.name+'('+itemVal(i)+')'; }), '→ audiencePerShow:', audiencePerShow);
      }
      var totalAudience = audiencePerShow > 0 && performanceCount > 0 ? audiencePerShow * performanceCount : 0;
      console.log('[BTS Sponsors] derived → performances:', performanceCount, 'audiencePerShow:', audiencePerShow, 'totalAudience:', totalAudience);
      function fmt(n) { return n > 0 ? String(n) : 'TBC'; }
      var derived = [
        { value: fmt(performanceCount), label: 'Performances',      subtext: 'Pulled from the production schedule', color: '#572e88', icon: 'navproductioncalendar.svg' },
        { value: fmt(audiencePerShow),  label: 'Audience per show', subtext: 'Expected from the ticket budget',     color: '#769e7b', icon: 'Budgeting-tickets.svg' },
        { value: fmt(totalAudience),    label: 'Total audience',    subtext: 'Estimated across all performances',   color: '#efab45', icon: 'organisation-members.svg' },
      ];
      // Only update a slot if we have a real computed value — never overwrite a real value with TBC.
      var existing = Array.isArray(SpnsState.settings.publicStats) ? SpnsState.settings.publicStats.slice() : [];
      var changed = false;
      derived.forEach(function(d, i) {
        var curVal = existing[i] && String(existing[i].value || '').trim();
        if (d.value !== 'TBC') {
          existing[i] = d;
          changed = true;
        } else if (!curVal) {
          existing[i] = d;
          changed = true;
        }
      });
      if (changed) {
        SpnsState.settings.publicStats = existing;
        schedulePublicPagePreview(false);
        var payload = publicPageSettingsPayload();
        payload.publicStats = existing;
        persistSponsorSettings(payload, '').catch(function(){});
      }
    }).catch(function(){});
  }

  var PUBLIC_SECTION_LABELS = {
    hero: 'Hero', stats: 'Audience Reach', ways: 'Ways to Participate', info: 'What is a Programme?',
    steps: 'How It Works', sponsorships: 'Sponsorship Packages', programmeAds: 'Programme Ad Sizes', pastPosters: 'Past Posters', footer: 'Footer & Contact',
  };

  var PUBLIC_SECTION_META = {
    hero: { description: 'Big headline, poster, and calls to action.', icon: 'Placeholder - Poster.svg', color: '#572e88' },
    info: { description: 'Explain the programme and compare options.', icon: 'programme-8.5x11.svg', color: '#74a2b4' },
    stats: { description: 'Show audience impact and local reach.', icon: 'organisation-members.svg', color: '#769e7b' },
    sponsorships: { description: 'Show the sponsor packages and pricing.', icon: 'sponsorship-packages.svg', color: '#dd8233' },
    programmeAds: { description: 'Show programme ad sizes and pricing.', icon: 'programme-8.5x11Folded-11x17.svg', color: '#476aaa' },
    pastPosters: { description: 'Show a strip or collage of previous production posters.', icon: 'Placeholder - Poster.svg', color: '#572e88' },
    ways: { description: 'Help visitors choose sponsorship or advertising.', icon: 'Volunteers.svg', color: '#ca7ea7' },
    steps: { description: 'Explain how booking and artwork work.', icon: 'Production Checklist.svg', color: '#d1523d' },
    footer: { description: 'Add contact details and a final call to action.', icon: 'Profiles.svg', color: '#1a1530' },
  };

  var PUBLIC_SECTION_FIELDS = {
    hero: [
      ['navOverview','Navigation: Overview'], ['navSponsors','Navigation: Sponsorships'], ['navAds','Navigation: Programme Ads'], ['navBook','Navigation: Book Now'],
      ['heroTitle','Headline'], ['heroAccent','Headline Accent'], ['heroBody','Supporting Copy','textarea'],
      ['heroSponsorButton','Sponsor Button'], ['heroSponsorSub','Sponsor Button Subtext'], ['heroAdButton','Programme Ad Button'], ['heroAdSub','Programme Ad Button Subtext'],
    ],
    stats: [['statsTitle','Section Heading']],
    ways: [
      ['sponsorWayTitle','Sponsor Heading'], ['sponsorWayBody','Sponsor Copy','textarea'], ['sponsorWayBullets','Sponsor Benefits, one per line','textarea'], ['sponsorWayCta','Sponsor Button'],
      ['adWayTitle','Programme Ad Heading'], ['adWayBody','Programme Ad Copy','textarea'], ['adWayBullets','Programme Ad Benefits, one per line','textarea'], ['adWayCta','Programme Ad Button'],
    ],
    info: [
      ['programmeLabel','Programme Eyebrow'], ['programmeTitle','Programme Heading'], ['programmeBody','Programme Copy','textarea'],
      ['orgAboutBody','About Your Organisation','textarea'],
      ['compareLabel','Comparison Eyebrow'], ['compareTitle','Comparison Heading'], ['compareRows','Comparison rows: Label | Sponsorship | Programme Ad','textarea'], ['compareBoth','Final Comparison Message'],
    ],
    keyDates: [['keyDatesTitle','Heading'], ['keyDatesBody','Supporting Copy']],
    steps: [['stepsLabel','Eyebrow'], ['stepsTitle','Heading'], ['stepsRows','Steps: Title | Description','textarea'], ['impactTitle','Impact Heading'], ['impactBody','Impact Copy']],
    sponsorships: [['sponsorsKicker','Eyebrow'], ['sponsorsTitle','Heading'], ['sponsorsBody','Supporting Copy','textarea']],
    programmeAds: [['adsKicker','Eyebrow'], ['adsTitle','Heading'], ['adsBody','Supporting Copy','textarea']],
    pastPosters: [['pastPostersKicker','Eyebrow'], ['pastPostersTitle','Heading'], ['pastPostersBody','Supporting Copy','textarea']],
    footer: [['footerTitle','Heading'], ['footerBody','Supporting Copy'], ['footerButton','Contact Button']],
  };

  // ── Card-based edit panel system ─────────────────────────────────────────
  var ESVG = {
    T:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#572e88" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
    lines: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#572e88" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="17" y2="12"/><line x1="3" y1="18" x2="13" y2="18"/></svg>',
    btn:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#572e88" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    drop:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#572e88" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5C9 7.7 7.5 10.5 7.5 13a4.5 4.5 0 0 0 9 0c0-2.5-1.5-5.3-4.5-9.5z"/></svg>',
    chart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#572e88" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="3" width="4" height="18"/></svg>',
    cols:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#572e88" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/></svg>',
  };
  var FCARD_CHEV = '<svg class="spn-fcard-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>';

  var PUBLIC_FIELD_GROUPS = {
    hero: [
      { id:'poster',   img:'Placeholder - Poster.svg', title:'Poster',          subtitle:'Upload or change the poster image.',             type:'poster' },
      { id:'headline', svg:ESVG.T,                      title:'Headline',         subtitle:'Edit the main headline for this section.',       fields:[
        { key:'heroTitle',  label:'Line 1' },
        { key:'heroAccent', label:'Highlighted Text', accentColor:true },
      ]},
      { id:'body',     svg:ESVG.lines,                  title:'Supporting Text',  subtitle:'Edit the supporting paragraph.',                 fields:[
        { key:'heroBody', type:'textarea' },
      ]},
      { id:'buttons',  svg:ESVG.btn,                    title:'Buttons',          subtitle:'Customise the call-to-action buttons.',          type:'buttons', cols:[
        { label:'Primary Button',   colorKey:'hero', fields:[{ key:'heroSponsorButton', label:'Button Text' }, { key:'heroSponsorSub', label:'Description' }] },
        { label:'Secondary Button', colorKey:'ads',  fields:[{ key:'heroAdButton',      label:'Button Text' }, { key:'heroAdSub',      label:'Description' }] },
      ]},
      { id:'bgColor',  svg:ESVG.drop,                   title:'Background Style', subtitle:'Choose the background colour for this section.', type:'color', colorKey:'hero' },
    ],
    stats: [
      { id:'text',     svg:ESVG.T,     title:'Section Heading',  subtitle:'Edit the section heading.',                        fields:[{ key:'statsTitle', label:'Heading' }] },
      { id:'audience', svg:ESVG.chart, title:'Audience Numbers', subtitle:'Add your reach and audience stats.',               type:'statsRows' },
      { id:'bgColor',  svg:ESVG.drop,  title:'Background Style', subtitle:'Choose the background colour for this section.',   type:'color', colorKey:'stats' },
    ],
    ways: [
      { id:'sponsor',        svg:ESVG.T,    title:'Sponsor Column',      subtitle:'Edit the sponsorship side.',                       fields:[
        { key:'sponsorWayTitle', label:'Heading' }, { key:'sponsorWayBody', label:'Body', type:'textarea' },
        { key:'sponsorWayBullets', label:'Benefits, one per line', type:'textarea' }, { key:'sponsorWayCta', label:'Button' },
      ]},
      { id:'ads',            svg:ESVG.cols, title:'Programme Ad Column', subtitle:'Edit the advertising side.',                       fields:[
        { key:'adWayTitle', label:'Heading' }, { key:'adWayBody', label:'Body', type:'textarea' },
        { key:'adWayBullets', label:'Benefits, one per line', type:'textarea' }, { key:'adWayCta', label:'Button' },
      ]},
      { id:'bgColorSponsor', svg:ESVG.drop, title:'Sponsor Background',  subtitle:'Background colour for the sponsor side.',          type:'color', colorKey:'sponsor' },
      { id:'bgColorAds',     svg:ESVG.drop, title:'Ad Background',       subtitle:'Background colour for the ad side.',               type:'color', colorKey:'ads' },
    ],
    info: [
      { id:'programme', svg:ESVG.T,     title:'Programme Description', subtitle:'Explain what a programme is.',                      fields:[
        { key:'programmeLabel', label:'Eyebrow' }, { key:'programmeTitle', label:'Heading' }, { key:'programmeBody', label:'Body', type:'textarea' },
      ]},
      { id:'orgAbout',  svg:ESVG.lines, title:'About Your Organisation', subtitle:'Tell sponsors who you are.',                     fields:[
        { key:'orgAboutBody', label:'Description', type:'textarea' },
      ]},
      { id:'compare',   svg:ESVG.lines, title:'Comparison Table',      subtitle:'Help visitors compare the options.',                fields:[
        { key:'compareLabel', label:'Eyebrow' }, { key:'compareTitle', label:'Heading' },
        { key:'compareRows', label:'Rows: Label | Sponsorship | Ad, one per line', type:'textarea' }, { key:'compareBoth', label:'Footer Message' },
      ]},
      { id:'bgColor',   svg:ESVG.drop,  title:'Background Style',      subtitle:'Choose the background colour for this section.',    type:'color', colorKey:'info' },
    ],
    steps: [
      { id:'text',    svg:ESVG.T,    title:'Section Text',       subtitle:'Edit the heading and steps.',                            fields:[
        { key:'stepsLabel', label:'Eyebrow' }, { key:'stepsTitle', label:'Heading' },
        { key:'stepsRows', label:'Steps: Title | Description, one per line', type:'textarea' },
        { key:'impactTitle', label:'Impact Heading' }, { key:'impactBody', label:'Impact Copy' },
      ]},
      { id:'bgColor', svg:ESVG.drop, title:'Background Style',   subtitle:'Choose the background colour for this section.',         type:'color', colorKey:'steps' },
    ],
    sponsorships: [
      { id:'text',    svg:ESVG.T,    title:'Section Text',       subtitle:'Edit the heading and description.',                      fields:[
        { key:'sponsorsKicker', label:'Eyebrow' }, { key:'sponsorsTitle', label:'Heading' }, { key:'sponsorsBody', label:'Body', type:'textarea' },
      ]},
      { id:'bgColor', svg:ESVG.drop, title:'Background Style',   subtitle:'Choose the background colour for this section.',         type:'color', colorKey:'sponsorships' },
    ],
    programmeAds: [
      { id:'text',    svg:ESVG.T,    title:'Section Text',       subtitle:'Edit the heading and description.',                      fields:[
        { key:'adsKicker', label:'Eyebrow' }, { key:'adsTitle', label:'Heading' }, { key:'adsBody', label:'Body', type:'textarea' },
      ]},
      { id:'bgColor', svg:ESVG.drop, title:'Background Style',   subtitle:'Choose the background colour for this section.',         type:'color', colorKey:'programmeAds' },
    ],
    keyDates: [
      { id:'text',    svg:ESVG.T,    title:'Section Text',       subtitle:'Edit the heading and description.',                      fields:[
        { key:'keyDatesTitle', label:'Heading' }, { key:'keyDatesBody', label:'Supporting Copy' },
      ]},
    ],
    pastPosters: [
      { id:'currentPoster',   img:'Placeholder - Poster.svg', title:'Current Poster',    subtitle:'The production poster shown in the centre of the fan. Uses the production poster by default.',  type:'currentPosterFan' },
      { id:'pastPostersList', img:'Placeholder - Poster.svg', title:'Past Posters',       subtitle:'Upload individual past show posters. Up to 10 fanned out around the current poster.',           type:'pastPostersList' },
      { id:'text',            svg:ESVG.T,                     title:'Section Text',       subtitle:'Edit the heading and description.',                                                               fields:[
        { key:'pastPostersKicker', label:'Eyebrow' }, { key:'pastPostersTitle', label:'Heading' }, { key:'pastPostersBody', label:'Body', type:'textarea' },
      ]},
      { id:'bgColor',         svg:ESVG.drop,                  title:'Background Style',   subtitle:'Choose the background colour for this section.',                                                 type:'color', colorKey:'pastPosters' },
    ],
    footer: [
      { id:'text',    svg:ESVG.T,    title:'Footer Text',        subtitle:'Edit the footer message and button.',                    fields:[
        { key:'footerTitle', label:'Heading' }, { key:'footerBody', label:'Body' }, { key:'footerButton', label:'Contact Button' },
      ]},
      { id:'bgColor', svg:ESVG.drop, title:'Background Style',   subtitle:'Choose the background colour for this section.',         type:'color', colorKey:'footer' },
    ],
  };

  function renderFieldCard(group, page, isOpen) {
    var iconHtml = group.img
      ? '<img src="/ASSETS/Images/Icons/' + encodeURIComponent(group.img) + '" alt="" style="width:18px;height:18px;" />'
      : (group.svg || '');
    var aside = '';
    if (group.type === 'poster' && page.posterUrl) {
      aside = '<div class="spn-fcard-aside"><img class="spn-fcard-thumb" src="' + escHtml(page.posterUrl) + '" alt="" /></div>';
    } else if (group.type === 'pastPosters' && page.pastPostersUrl) {
      aside = '<div class="spn-fcard-aside"><img class="spn-fcard-thumb" src="' + escHtml(page.pastPostersUrl) + '" alt="" /></div>';
    } else if (group.type === 'currentPosterFan') {
      var effectivePoster = page.currentPosterOverride || SpnsState.posterUrl || '';
      if (effectivePoster) aside = '<div class="spn-fcard-aside"><img class="spn-fcard-thumb" src="' + escHtml(effectivePoster) + '" alt="" /></div>';
    }
    var body = '';
    if (group.type === 'poster') {
      body = '<input type="text" id="spn-public-poster-url" value="' + escHtml(page.posterUrl || '') + '" style="display:none" />' +
             '<button type="button" class="spn-change-img-btn" onclick="MarketingSponsorsModule.uploadPublicPoster()">Change Image</button>';
    } else if (group.type === 'pastPosters') {
      body = '<input type="text" id="spn-public-past-posters-url" value="' + escHtml(page.pastPostersUrl || '') + '" style="display:none" />' +
             '<button type="button" class="spn-change-img-btn" onclick="MarketingSponsorsModule.uploadPublicPastPosters()">Change Image</button>';
    } else if (group.type === 'currentPosterFan') {
      var eff = page.currentPosterOverride || SpnsState.posterUrl || '';
      var isOverride = !!page.currentPosterOverride;
      body = '<input type="text" id="spn-public-current-poster-override" value="' + escHtml(page.currentPosterOverride || '') + '" style="display:none" />' +
             (eff && !isOverride ? '<p class="spn-fcard-note" style="margin:0 0 0.6rem">Using the production poster. Upload a different image to use a custom centre poster.</p>' : '') +
             (isOverride ? '<p class="spn-fcard-note" style="margin:0 0 0.6rem">Using a custom image. <button type="button" class="spn-link-btn" onclick="MarketingSponsorsModule.clearCurrentPosterOverride()">Remove override</button></p>' : '') +
             '<button type="button" class="spn-change-img-btn" onclick="MarketingSponsorsModule.uploadCurrentPosterOverride()">' + (isOverride ? 'Change Custom Image' : 'Override Poster') + '</button>';
    } else if (group.type === 'pastPostersList') {
      var posters = page.pastPosters || [];
      var listHtml = posters.length
        ? '<div class="spn-past-poster-list" id="spn-past-poster-list">' + posters.map(function (url, idx) {
            return '<div class="spn-past-poster-item" draggable="true" data-poster-idx="' + idx + '">' +
              '<img src="' + escHtml(url) + '" alt="Past poster ' + (idx + 1) + '" draggable="false" />' +
              '<div class="spn-past-poster-drag-handle" title="Drag to reorder"><img src="/ASSETS/Images/Icons/drag-handle.svg" alt="" /></div>' +
              '<button type="button" class="spn-past-poster-remove" onclick="MarketingSponsorsModule.removePastPoster(' + idx + ')" title="Remove">&times;</button>' +
              '</div>';
          }).join('') + '</div>'
        : '<p class="spn-fcard-note" style="margin:0 0 0.6rem">No past posters added yet.</p>';
      body = listHtml + '<button type="button" class="spn-change-img-btn" onclick="MarketingSponsorsModule.addPastPoster()">Add Poster</button>';
    } else if (group.type === 'color') {
      var currentColor = (page.colors && page.colors[group.colorKey]) || '#572e88';
      body = '<div class="spn-fcard-swatches" role="radiogroup">' +
        PUBLIC_PAGE_COLORS.map(function (c) {
          return '<label class="spn-fcard-swatch" title="' + escHtml(c.name) + '"><input type="radio" name="public-color-' + escHtml(group.colorKey) + '" data-public-color="' + escHtml(group.colorKey) + '" value="' + escHtml(c.value) + '"' + (currentColor === c.value ? ' checked' : '') + ' /><span style="background:' + escHtml(c.value) + '"></span></label>';
        }).join('') + '</div>';
    } else if (group.type === 'buttons') {
      body = '<div class="spn-fcard-btn-cols">' + group.cols.map(function (col) {
        var dotColor = (page.colors && page.colors[col.colorKey]) || '#572e88';
        return '<div class="spn-fcard-btn-col">' +
          '<div class="spn-fcard-btn-col-hd"><span class="spn-fcard-btn-dot" style="background:' + escHtml(dotColor) + '"></span>' +
          '<span class="spn-fcard-btn-col-lbl">' + escHtml(col.label.toUpperCase()) + '</span></div>' +
          col.fields.map(function (f) {
            return '<label class="spn-edit-lbl">' + escHtml(f.label) + '</label>' +
                   '<input type="text" class="spn-edit-inp" data-public-key="' + escHtml(f.key) + '" value="' + escHtml((page.content && page.content[f.key]) || '') + '" />';
          }).join('') + '</div>';
      }).join('') + '</div>';
    } else if (group.type === 'statsRows') {
      body = '<div class="spn-public-stats-grid">' + publicStatsEditorRows() + '</div>';
    } else if (group.fields) {
      body = group.fields.map(function (f) {
        var val = escHtml((page.content && page.content[f.key]) || '');
        var inputHtml;
        if (f.type === 'textarea') {
          inputHtml = '<textarea class="spn-edit-ta" data-public-key="' + escHtml(f.key) + '" rows="3">' + val + '</textarea>';
        } else if (f.accentColor) {
          var accentCol = escHtml((page.colors && page.colors.hero) || '#572e88');
          inputHtml = '<div class="spn-edit-inp-row"><input type="text" class="spn-edit-inp" data-public-key="' + escHtml(f.key) + '" value="' + val + '" /><span class="spn-fcard-accent-dot" style="background:' + accentCol + '"></span></div>';
        } else {
          inputHtml = '<input type="text" class="spn-edit-inp" data-public-key="' + escHtml(f.key) + '" value="' + val + '" />';
        }
        return (f.label ? '<label class="spn-edit-lbl">' + escHtml(f.label) + '</label>' : '') + inputHtml;
      }).join('');
    }
    return '<div class="spn-fcard' + (isOpen ? ' is-open' : '') + '" data-fcard-id="' + escHtml(group.id) + '">' +
      '<div class="spn-fcard-hd" onclick="MarketingSponsorsModule.toggleFieldCard(\'' + escHtml(group.id) + '\')">' +
        '<div class="spn-fcard-icon">' + iconHtml + '</div>' +
        '<div class="spn-fcard-meta"><strong>' + escHtml(group.title) + '</strong><span>' + escHtml(group.subtitle) + '</span></div>' +
        aside + FCARD_CHEV +
      '</div>' +
      '<div class="spn-fcard-bd"><div class="spn-fcard-bd-inner">' + body + '</div></div>' +
    '</div>';
  }

  function buildEditPanel(page, activeId) {
    var label = PUBLIC_SECTION_LABELS[activeId] || activeId;
    var groups = PUBLIC_FIELD_GROUPS[activeId] || [];
    if (!SpnsState.openFieldCards) SpnsState.openFieldCards = {};
    if (!SpnsState.openFieldCards[activeId]) {
      SpnsState.openFieldCards[activeId] = {};
      groups.forEach(function (g) { SpnsState.openFieldCards[activeId][g.id] = true; });
    }
    var openMap = SpnsState.openFieldCards[activeId];
    var allOpen = groups.every(function (g) { return !!openMap[g.id]; });
    return '<section class="spn-public-section-manager spn-public-edit-panel">' +
      '<div class="spn-public-edit-topline"><button type="button" class="spn-public-back-btn" onclick="MarketingSponsorsModule.backToPublicSections()">Back to sections</button></div>' +
      '<div class="spn-epanel-hd">' +
        '<div><h2 class="spn-epanel-title">Edit ' + escHtml(label) + ' Section</h2>' +
        '<p class="spn-epanel-sub">Change the content below and see it update in real time.</p></div>' +
        '<button type="button" class="spn-epanel-collapse-all" onclick="MarketingSponsorsModule.toggleAllFieldCards(' + (allOpen ? 'false' : 'true') + ')">' +
          (allOpen ? 'Collapse All &#x2038;' : 'Expand All &#x2038;') + '</button>' +
      '</div>' +
      '<div class="spn-fcards">' +
        groups.map(function (g) { return renderFieldCard(g, page, !!openMap[g.id]); }).join('') +
      '</div>' +
    '</section>';
  }

  function toggleFieldCard(cardId) {
    SpnsState.settings.publicPageDraft = collectPublicPageEditor();
    var sectionId = SpnsState.publicEditorSection;
    if (!SpnsState.openFieldCards) SpnsState.openFieldCards = {};
    if (!SpnsState.openFieldCards[sectionId]) SpnsState.openFieldCards[sectionId] = {};
    SpnsState.openFieldCards[sectionId][cardId] = !SpnsState.openFieldCards[sectionId][cardId];
    renderPublicPageEditor();
  }

  function toggleAllFieldCards(open) {
    SpnsState.settings.publicPageDraft = collectPublicPageEditor();
    var sectionId = SpnsState.publicEditorSection;
    var groups = PUBLIC_FIELD_GROUPS[sectionId] || [];
    if (!SpnsState.openFieldCards) SpnsState.openFieldCards = {};
    SpnsState.openFieldCards[sectionId] = {};
    groups.forEach(function (g) { SpnsState.openFieldCards[sectionId][g.id] = !!open; });
    renderPublicPageEditor();
  }

  function publicEditorField(field, page) {
    var key = field[0], label = field[1], type = field[2] || 'input';
    var value = page.content[key] || '';
    return '<div class="spn-public-editor-field"><label>' + escHtml(label) + '</label>' +
      (type === 'textarea'
        ? '<textarea data-public-key="' + key + '" rows="3">' + escHtml(value) + '</textarea>'
        : '<input type="text" data-public-key="' + key + '" value="' + escHtml(value) + '" />') +
    '</div>';
  }

  function publicColorSwatches(sectionId, selected) {
    return '<div class="spn-public-color-row" role="radiogroup" aria-label="' + escHtml(PUBLIC_SECTION_LABELS[sectionId] || sectionId) + ' colour">' + PUBLIC_PAGE_COLORS.map(function (color) {
      return '<label class="spn-public-color-swatch" title="' + color.name + '"><input type="radio" name="public-color-' + sectionId + '" data-public-color="' + sectionId + '" value="' + color.value + '"' + (selected === color.value ? ' checked' : '') + ' /><span style="background:' + color.value + '"></span></label>';
    }).join('') + '</div>';
  }

  function renderPublicPageEditor() {
    renderPublicStatsAdmin();
    var host = document.getElementById('spn-public-editor');
    if (!host) return;
    var page = mergePublicPage(SpnsState.settings.publicPageDraft || SpnsState.settings.publicPage);
    SpnsState.settings.publicPageDraft = page;
    var visibleSections = page.sections.filter(function (section) { return section.visible !== false; });
    if (!SpnsState.publicEditorSection || !PUBLIC_FIELD_GROUPS[SpnsState.publicEditorSection]) SpnsState.publicEditorSection = (visibleSections[0] || page.sections[0]).id;
    var activeId = SpnsState.publicEditorSection;
    var mode = SpnsState.publicEditorMode === 'edit' ? 'edit' : 'sections';
    var sectionRows = page.sections.map(function (section, index) {
      var meta = PUBLIC_SECTION_META[section.id] || {};
      var isFooter = section.id === 'footer';
      var enabled = section.visible !== false;
      var active = section.id === activeId;
      var label = PUBLIC_SECTION_LABELS[section.id] || section.id;
      var visibilityIcon = isFooter ? 'locked.svg' : (enabled ? 'visible.svg' : 'visible-off.svg');
      return '<article class="spn-public-section-row' + (enabled ? ' is-visible' : ' is-hidden') + (active ? ' is-active' : '') + '"' + (isFooter ? '' : ' draggable="true" data-public-arrange="' + section.id + '"') + '>' +
        '<div class="spn-public-section-icon" style="--section-color:' + escHtml(meta.color || '#572e88') + '"><img src="/ASSETS/Images/Icons/' + encodeURIComponent(meta.icon || 'Square.svg') + '" alt="" /></div>' +
        '<div class="spn-public-section-copy"><strong>' + escHtml(label) + '</strong><p>' + escHtml(meta.description || '') + '</p></div>' +
        '<button type="button" class="spn-public-section-icon-btn" title="Edit section" aria-label="Edit ' + escHtml(label) + '" onclick="event.stopPropagation();MarketingSponsorsModule.editPublicSection(\'' + section.id + '\')"><img src="/ASSETS/Images/Icons/edit-pencil.svg" alt="" /></button>' +
        '<button type="button" class="spn-public-section-icon-btn" title="' + (isFooter ? 'Footer is always shown' : (enabled ? 'Hide section' : 'Show section')) + '" aria-label="' + (isFooter ? 'Footer is always shown' : (enabled ? 'Hide ' : 'Show ') + escHtml(label)) + '"' + (isFooter ? ' disabled' : ' onclick="event.stopPropagation();MarketingSponsorsModule.setPublicSectionVisible(\'' + section.id + '\',' + (enabled ? 'false' : 'true') + ')"') + '><img src="/ASSETS/Images/Icons/' + visibilityIcon + '" alt="" /></button>' +
        (isFooter ? '<span class="spn-public-drag" aria-hidden="true"></span><span class="spn-public-move-actions" aria-hidden="true"></span>' :
          '<span class="spn-public-drag" title="Drag to reorder" aria-hidden="true"></span>' +
          '<span class="spn-public-move-actions"><button type="button" title="Move up" aria-label="Move up"' + (index === 0 ? ' disabled' : '') + ' onclick="MarketingSponsorsModule.movePublicSection(\'' + section.id + '\',-1)">Up</button><button type="button" title="Move down" aria-label="Move down"' + (index === page.sections.length - 2 ? ' disabled' : '') + ' onclick="MarketingSponsorsModule.movePublicSection(\'' + section.id + '\',1)">Down</button></span>') +
      '</article>';
    }).join('');
    var editPanel = buildEditPanel(page, activeId);
    var sectionPanel =
      '<section class="spn-public-section-manager"><div class="spn-public-section-manager-head"><div><h3>Your Page Sections</h3><p>Drag to reorder sections. Use Edit and Hide to manage each section.</p></div><button type="button" class="spn-public-reset-order" onclick="MarketingSponsorsModule.resetPublicSectionOrder()">Reset order</button></div><div class="spn-public-section-list">' + sectionRows + '</div><div class="spn-public-footer-note">The footer is always shown at the bottom of the page.</div></section>';
    host.innerHTML =
      '<div class="spn-public-builder-intro"><h2>Let\'s build your sponsor page</h2><p>Choose the sections you need, put them in the right order, and make the copy and colours yours.</p></div>' +
      (mode === 'edit' ? editPanel : sectionPanel);
    host.oninput = function () { schedulePublicPagePreview(true); };
    host.onchange = function () { schedulePublicPagePreview(true); };
    host.ondragstart = function (event) { var row = event.target.closest('[data-public-arrange]'); if (!row) return; event.dataTransfer.setData('text/plain', row.dataset.publicArrange); row.classList.add('is-dragging'); };
    host.ondragend = function (event) { var row = event.target.closest('[data-public-arrange]'); if (row) row.classList.remove('is-dragging'); clearPublicDropMarkers(); };
    host.ondragover = function (event) {
      var row = event.target.closest('[data-public-arrange]');
      if (!row) return;
      event.preventDefault();
      var rect = row.getBoundingClientRect();
      var position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      clearPublicDropMarkers();
      row.classList.add(position === 'before' ? 'is-drop-before' : 'is-drop-after');
      row.dataset.dropPosition = position;
    };
    host.ondragleave = function (event) {
      if (!host.contains(event.relatedTarget)) clearPublicDropMarkers();
    };
    host.ondrop = function (event) {
      var row = event.target.closest('[data-public-arrange]');
      if (!row) return;
      event.preventDefault();
      var position = row.dataset.dropPosition || 'before';
      clearPublicDropMarkers();
      reorderPublicSections(event.dataTransfer.getData('text/plain'), row.dataset.publicArrange, null, position);
    };
    updatePublicPageStatus();
    schedulePublicPagePreview(false);
    initPosterDrag();
  }

  function initPosterDrag() {
    var list = document.getElementById('spn-past-poster-list');
    if (!list) return;
    var dragSrcIdx = null;
    list.addEventListener('dragstart', function (e) {
      var item = e.target.closest('[data-poster-idx]');
      if (!item) return;
      dragSrcIdx = Number(item.dataset.posterIdx);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(dragSrcIdx));
      item.classList.add('spn-poster-dragging');
    });
    list.addEventListener('dragend', function (e) {
      var item = e.target.closest('[data-poster-idx]');
      if (item) item.classList.remove('spn-poster-dragging');
      list.querySelectorAll('.spn-poster-drag-over').forEach(function (el) { el.classList.remove('spn-poster-drag-over'); });
    });
    list.addEventListener('dragover', function (e) {
      var item = e.target.closest('[data-poster-idx]');
      if (!item || Number(item.dataset.posterIdx) === dragSrcIdx) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      list.querySelectorAll('.spn-poster-drag-over').forEach(function (el) { el.classList.remove('spn-poster-drag-over'); });
      item.classList.add('spn-poster-drag-over');
    });
    list.addEventListener('dragleave', function (e) {
      var item = e.target.closest('[data-poster-idx]');
      if (item) item.classList.remove('spn-poster-drag-over');
    });
    list.addEventListener('drop', function (e) {
      e.preventDefault();
      var item = e.target.closest('[data-poster-idx]');
      if (!item) return;
      var destIdx = Number(item.dataset.posterIdx);
      if (dragSrcIdx === null || dragSrcIdx === destIdx) return;
      item.classList.remove('spn-poster-drag-over');
      MarketingSponsorsModule.reorderPastPosters(dragSrcIdx, destIdx);
    });
  }

  function reorderPastPosters(fromIdx, toIdx) {
    var page = collectPublicPageEditor();
    var posters = page.pastPosters;
    if (fromIdx < 0 || fromIdx >= posters.length || toIdx < 0 || toIdx >= posters.length) return;
    var moved = posters.splice(fromIdx, 1)[0];
    posters.splice(toIdx, 0, moved);
    SpnsState.settings.publicPageDraft = page;
    schedulePublicPagePreview(true);
    renderPublicPageEditor();
    markPublicPageDirty();
  }

  function collectPublicPageEditor() {
    var page = mergePublicPage(SpnsState.settings.publicPageDraft || SpnsState.settings.publicPage);
    document.querySelectorAll('[data-public-key]').forEach(function (input) { page.content[input.dataset.publicKey] = input.value; });
    document.querySelectorAll('[data-public-color]:checked').forEach(function (input) { page.colors[input.dataset.publicColor] = input.value; });
    SpnsState.settings.publicStats = collectPublicStats();
    var posterInput = document.getElementById('spn-public-poster-url');
    var pastPostersInput = document.getElementById('spn-public-past-posters-url');
    var currentPosterOverrideInput = document.getElementById('spn-public-current-poster-override');
    var emailInput = document.getElementById('spn-public-contact-email');
    if (posterInput) page.posterUrl = posterInput.value || '';
    if (pastPostersInput) page.pastPostersUrl = pastPostersInput.value || '';
    if (currentPosterOverrideInput) page.currentPosterOverride = currentPosterOverrideInput.value || '';
    if (emailInput) page.contactEmail = emailInput.value || '';
    return page;
  }

  function setPublicSectionVisible(id, visible) {
    var page = collectPublicPageEditor();
    var section = page.sections.find(function (item) { return item.id === id; });
    if (!section) return;
    if (id === 'footer') visible = true;
    section.visible = !!visible;
    if (visible) SpnsState.publicEditorSection = id;
    SpnsState.settings.publicPageDraft = page;
    renderPublicPageEditor();
    markPublicPageDirty();
  }

  function editPublicSection(id) {
    SpnsState.settings.publicPageDraft = collectPublicPageEditor();
    SpnsState.publicEditorSection = id;
    SpnsState.publicEditorMode = 'edit';
    renderPublicPageEditor();
  }

  function backToPublicSections() {
    SpnsState.settings.publicPageDraft = collectPublicPageEditor();
    SpnsState.publicEditorMode = 'sections';
    renderPublicPageEditor();
  }

  function movePublicSection(id, direction) {
    var page = collectPublicPageEditor();
    var current = page.sections.findIndex(function (section) { return section.id === id; });
    var target = current + Number(direction);
    if (id === 'footer' || current < 0 || target < 0 || target >= page.sections.length - 1) return;
    var moved = page.sections.splice(current, 1)[0];
    page.sections.splice(target, 0, moved);
    SpnsState.settings.publicPageDraft = page;
    renderPublicPageEditor();
    markPublicPageDirty();
  }

  function resetPublicSectionOrder() {
    var page = collectPublicPageEditor();
    var currentById = {};
    page.sections.forEach(function (section) { currentById[section.id] = section; });
    var ordered = defaultPublicPage().sections.map(function (section) {
      return currentById[section.id] || section;
    });
    page.sections.forEach(function (section) {
      if (!ordered.some(function (item) { return item.id === section.id; })) ordered.push(section);
    });
    page.sections = ordered;
    SpnsState.settings.publicPageDraft = page;
    SpnsState.publicEditorMode = 'sections';
    renderPublicPageEditor();
    markPublicPageDirty();
  }

  function clearPublicDropMarkers() {
    document.querySelectorAll('.spn-public-section-row.is-drop-before, .spn-public-section-row.is-drop-after').forEach(function (row) {
      row.classList.remove('is-drop-before', 'is-drop-after');
      delete row.dataset.dropPosition;
    });
  }

  function reorderPublicSections(sourceId, targetId, existingPage, position) {
    if (!sourceId || !targetId || sourceId === targetId || sourceId === 'footer') return;
    var page = existingPage || collectPublicPageEditor();
    var from = page.sections.findIndex(function (section) { return section.id === sourceId; });
    var to = page.sections.findIndex(function (section) { return section.id === targetId; });
    if (from < 0 || to < 0) return;
    var moved = page.sections.splice(from, 1)[0];
    if (from < to) to -= 1;
    if (position === 'after') to += 1;
    to = Math.max(0, Math.min(page.sections.length, to));
    page.sections.splice(to, 0, moved);
    var footerIndex = page.sections.findIndex(function (section) { return section.id === 'footer'; });
    if (footerIndex >= 0) page.sections.push(page.sections.splice(footerIndex, 1)[0]);
    SpnsState.settings.publicPageDraft = page;
    renderPublicPageEditor();
    markPublicPageDirty();
  }

  var publicPreviewTimer = null;
  var publicSaveInFlight = false;

  function publicPagesDiffer(publicPage, draftPage) {
    var published = mergePublicPage(publicPage);
    var draft = mergePublicPage(draftPage);
    published.published = false;
    draft.published = false;
    return JSON.stringify(published) !== JSON.stringify(draft);
  }

  function markPublicPageDirty() {
    SpnsState.publicPageDirty = true;
    SpnsState.publicPageHasDraftChanges = true;
    updatePublicPageDraftActions();
    updatePublicPageStatus();
    clearTimeout(autoSaveDraftTimer);
    autoSaveDraftTimer = setTimeout(function () { savePublicPage(false); }, 2000);
  }

  function updatePublicPageDraftActions() {
    var status = document.getElementById('spn-public-draft-status');
    var publishButton = document.getElementById('spn-public-publish-changes');
    var hasDraft = SpnsState.publicPageHasDraftChanges;
    if (status) {
      if (publicSaveInFlight) {
        status.textContent = 'Saving...';
        status.hidden = false;
      } else if (SpnsState.publicPageDirty) {
        status.textContent = 'Saving...';
        status.hidden = false;
      } else if (hasDraft) {
        status.textContent = 'Draft saved';
        status.hidden = false;
      } else {
        status.textContent = '';
        status.hidden = true;
      }
    }
    if (publishButton) {
      publishButton.disabled = !hasDraft || publicSaveInFlight;
      publishButton.hidden = false;
      publishButton.classList.toggle('spn-btn--publish-ready', hasDraft && !publicSaveInFlight);
    }
  }

  function scalePreviewFrame() {
    var shell = document.getElementById('spn-public-preview-shell');
    var scaler = document.getElementById('spn-preview-scaler');
    var frame = document.getElementById('spn-public-preview-frame');
    if (!shell || !scaler || !frame) return;
    var isMobile = shell.dataset.device === 'mobile';
    var targetW = isMobile ? 390 : 1280;
    var containerW = shell.offsetWidth;
    if (!containerW) return;
    var scale = containerW / targetW;
    var contentH = SpnsState.previewContentH || 4000;
    var scaledH = Math.round(contentH * scale);
    scaler.style.width = containerW + 'px';
    scaler.style.height = scaledH + 'px';
    scaler.style.position = 'relative';
    frame.style.width = targetW + 'px';
    frame.style.height = contentH + 'px';
    frame.style.transform = 'scale(' + scale + ')';
    frame.style.transformOrigin = 'top left';
    frame.style.position = 'absolute';
    frame.style.top = '0';
    frame.style.left = isMobile ? Math.round((containerW - targetW * scale) / 2) + 'px' : '0';
  }

  function initPreviewScaling() {
    if (_previewScaleObs) { _previewScaleObs.disconnect(); _previewScaleObs = null; }
    var shell = document.getElementById('spn-public-preview-shell');
    if (!shell) return;
    scalePreviewFrame();
    if (typeof ResizeObserver !== 'undefined') {
      _previewScaleObs = new ResizeObserver(function () { scalePreviewFrame(); });
      _previewScaleObs.observe(shell);
    }
  }

  window.addEventListener('message', function (e) {
    if (e.origin === window.location.origin && e.data && e.data.type === 'bts-sponsor-page-ready') {
      if (e.data.height) SpnsState.previewContentH = e.data.height;
      scalePreviewFrame();
    }
  });

  function schedulePublicPagePreview(markDirty) {
    if (markDirty) markPublicPageDirty();
    clearTimeout(publicPreviewTimer);
    publicPreviewTimer = setTimeout(function () {
      SpnsState.settings.publicPageDraft = collectPublicPageEditor();
      var frame = document.getElementById('spn-public-preview-frame');
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: 'bts-sponsor-preview', publicPage: SpnsState.settings.publicPageDraft, publicStats: collectPublicStats() }, window.location.origin);
      }
    }, 120);
  }

  function setPublicPreviewDevice(device) {
    var shell = document.getElementById('spn-public-preview-shell');
    if (shell) shell.dataset.device = device === 'mobile' ? 'mobile' : 'desktop';
    document.querySelectorAll('[data-public-device]').forEach(function (button) { button.classList.toggle('active', button.dataset.publicDevice === device); });
    setTimeout(scalePreviewFrame, 100);
  }

  function updatePublicPageStatus() {
    var published = SpnsState.settings.publicPage && SpnsState.settings.publicPage.published === true;
    setPublicPageStatus(
      published ? 'Sponsor page is live' : 'Sponsor page not published',
      published ? 'is-published' : 'is-draft'
    );
    var strip = ensurePublicPageStatusStrip();
    if (strip && typeof strip.setVisible === 'function') strip.setVisible(true);
  }

  function setPublicPageStatus(label, stateClass) {
    var strip = ensurePublicPageStatusStrip();
    if (!strip || typeof strip.update !== 'function') return;
    var isPublished = stateClass === 'is-published';
    strip.update({
      state: isPublished ? 'live' : 'hidden',
      title: label || (isPublished ? 'Sponsor page is live' : 'Sponsor page not published'),
      subtitle: '',
      showView: isPublished,
      showCopy: isPublished,
      showToggle: true,
      toggleLabel: isPublished ? 'Unpublish' : 'Publish',
    });
  }

  function ensurePublicPageStatusStrip() {
    var strip = document.getElementById('spn-public-status-strip');
    if (!strip) return null;
    if (strip.dataset.sponsorEventsBound !== 'true') {
      strip.addEventListener('audition-status-view', viewPublicPage);
      strip.addEventListener('audition-status-copy', copyPublicPageLink);
      strip.addEventListener('audition-status-toggle', togglePublicPagePublished);
      strip.dataset.sponsorEventsBound = 'true';
    }
    return strip;
  }

  function setPublicPageBusy(isBusy, label) {
    var strip = ensurePublicPageStatusStrip();
    if (!strip) return;
    strip.style.pointerEvents = isBusy ? 'none' : '';
    strip.style.opacity = isBusy ? '0.72' : '';
    if (isBusy) strip.setAttribute('aria-busy', 'true');
    else strip.removeAttribute('aria-busy');
    if (isBusy && typeof strip.update === 'function') {
      strip.update({ showView: false, showCopy: false, showToggle: true, toggleLabel: label });
    }
    updatePublicPageDraftActions();
  }

  function viewPublicPage() {
    publicPageMeta()
      .then(function (meta) { window.open(sponsorPublicUrl(meta), '_blank', 'noopener'); })
      .catch(function () { window.open(sponsorPublicUrl(), '_blank', 'noopener'); });
  }

  function copyPublicPageLink() {
    publicPageMeta()
      .then(function (meta) { return sponsorPublicUrl(meta); })
      .catch(function () { return sponsorPublicUrl(); })
      .then(function (url) {
        var copy = navigator.clipboard && navigator.clipboard.writeText
          ? navigator.clipboard.writeText(url)
          : Promise.reject(new Error('Clipboard unavailable'));
        return copy.then(function () {
          var strip = ensurePublicPageStatusStrip();
          if (strip && typeof strip.showCopyConfirmation === 'function') strip.showCopyConfirmation('Copied!', 2000);
        }).catch(function () {
          window.prompt('Copy this sponsor page link:', url);
        });
      })
      .catch(function () { sponsorNotify('Could not create the public page link.', true); });
  }

  function togglePublicPagePublished() {
    if (publicSaveInFlight) return;
    var published = SpnsState.settings.publicPage && SpnsState.settings.publicPage.published === true;
    if (published) unpublishPublicPage();
    else savePublicPage(true);
  }

  function sponsorNotify(message, isError) {
    if (typeof showToast === 'function') showToast(message, !!isError);
    else if (isError) alert(message);
  }

  function publicPageSettingsPayload() {
    return {
      adSizes: SpnsState.settings.adSizes,
      tiers: SpnsState.settings.tiers,
      deadlines: {
        artwork: (document.getElementById('spn-deadline-artwork') || {}).value || null,
        booking: (document.getElementById('spn-deadline-booking') || {}).value || null,
        sponsor: (document.getElementById('spn-deadline-sponsor') || {}).value || null,
      },
      publicStats: document.querySelector('.spn-public-stat-value') ? collectPublicStats() : (SpnsState.settings.publicStats || []),
      publicPage: SpnsState.settings.publicPage,
      publicPageDraft: SpnsState.settings.publicPageDraft,
    };
  }

  function persistSponsorSettings(settings, message) {
    var prodId = SpnsState.prodId;
    var ts = new Date().toISOString();
    // PATCH the existing row; only INSERT if no row matched (avoids unique-key conflicts entirely)
    return fetch(SUPABASE_URL + '/rest/v1/sponsor_settings?production_id=eq.' + encodeURIComponent(prodId), {
      method: 'PATCH',
      headers: sponsorHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal,count=exact' }),
      body: JSON.stringify({ settings: settings, updated_at: ts }),
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t); });
      var range = r.headers.get('content-range') || '';
      if (/\/0$/.test(range)) {
        // No existing row — INSERT fresh
        return fetch(SUPABASE_URL + '/rest/v1/sponsor_settings', {
          method: 'POST',
          headers: sponsorHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
          body: JSON.stringify({ production_id: prodId, settings: settings, updated_at: ts }),
        }).then(function (r2) { if (!r2.ok) return r2.text().then(function (t) { throw new Error(t); }); });
      }
    }).then(function () { if (message) sponsorNotify(message); });
  }

  function savePublicPage(publish) {
    if (publicSaveInFlight) return Promise.resolve();
    var previousPublicPage = mergePublicPage(SpnsState.settings.publicPage);
    var wasDirty = SpnsState.publicPageDirty;
    SpnsState.settings.publicStats = collectPublicStats();
    SpnsState.settings.publicPageDraft = collectPublicPageEditor();
    if (publish) {
      SpnsState.settings.publicPage = mergePublicPage(SpnsState.settings.publicPageDraft);
      SpnsState.settings.publicPage.published = true;
    }
    publicSaveInFlight = true;
    setPublicPageBusy(true, publish ? 'Publishing...' : 'Saving...');
    return persistSponsorSettings(publicPageSettingsPayload(), publish ? 'Public sponsor page published.' : 'Public sponsor page draft saved.')
      .then(function () {
        SpnsState.publicPageDirty = false;
        SpnsState.publicPageHasDraftChanges = !publish;
        if (publish) SpnsState.settings.publicPageDraft = mergePublicPage(SpnsState.settings.publicPage);
        updatePublicPageStatus();
        updatePublicPageDraftActions();
      })
      .catch(function (e) {
        SpnsState.settings.publicPage = previousPublicPage;
        SpnsState.publicPageDirty = wasDirty;
        SpnsState.publicPageHasDraftChanges = true;
        updatePublicPageStatus();
        updatePublicPageDraftActions();
        sponsorNotify('Could not save public page: ' + e.message, true);
      })
      .finally(function () {
        publicSaveInFlight = false;
        setPublicPageBusy(false);
        updatePublicPageStatus();
        updatePublicPageDraftActions();
      });
  }

  function unpublishPublicPage() {
    if (!confirm('Unpublish the public sponsor page? Visitors will see that sponsor opportunities are not currently available.')) return;
    if (publicSaveInFlight) return Promise.resolve();
    var previousPublicPage = mergePublicPage(SpnsState.settings.publicPage);
    SpnsState.settings.publicPage = mergePublicPage(SpnsState.settings.publicPage);
    SpnsState.settings.publicPage.published = false;
    publicSaveInFlight = true;
    setPublicPageBusy(true, 'Unpublishing...');
    return persistSponsorSettings(publicPageSettingsPayload(), 'Public sponsor page unpublished.')
      .then(function () {
        updatePublicPageStatus();
        updatePublicPageDraftActions();
      })
      .catch(function (e) {
        SpnsState.settings.publicPage = previousPublicPage;
        updatePublicPageStatus();
        sponsorNotify('Could not unpublish: ' + e.message, true);
      })
      .finally(function () {
        publicSaveInFlight = false;
        setPublicPageBusy(false);
        updatePublicPageStatus();
        updatePublicPageDraftActions();
      });
  }

  function uploadPublicPageImage(inputId, failureLabel) {
    var input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = function () {
      var file = input.files[0]; if (!file) return;
      var path = SpnsState.prodId + '/public-page/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      fetch(SUPABASE_URL + '/storage/v1/object/' + STORAGE_BUCKET + '/' + path, { method: 'POST', headers: sponsorHeaders({ 'Content-Type': file.type }), body: file })
        .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t); }); return SUPABASE_URL + '/storage/v1/object/public/' + STORAGE_BUCKET + '/' + path; })
        .then(function (url) {
          var target = document.getElementById(inputId);
          if (target) target.value = url;
          schedulePublicPagePreview(true);
        })
        .catch(function (e) { sponsorNotify(failureLabel + ' upload failed: ' + e.message, true); });
    };
    input.click();
  }

  function uploadPublicPoster() {
    uploadPublicPageImage('spn-public-poster-url', 'Poster');
  }

  function uploadPublicPastPosters() {
    uploadPublicPageImage('spn-public-past-posters-url', 'Past posters image');
  }

  function uploadCurrentPosterOverride() {
    uploadPublicPageImage('spn-public-current-poster-override', 'Current poster');
  }

  function clearCurrentPosterOverride() {
    var page = collectPublicPageEditor();
    page.currentPosterOverride = '';
    SpnsState.settings.publicPageDraft = page;
    schedulePublicPagePreview(true);
    renderPublicPageEditor();
    markPublicPageDirty();
  }

  function addPastPoster() {
    var input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp'; input.multiple = true;
    input.onchange = function () {
      var files = Array.from(input.files); if (!files.length) return;
      var page = collectPublicPageEditor();
      var remaining = 10 - page.pastPosters.length;
      if (remaining <= 0) { sponsorNotify('You already have 10 posters — remove one first.', true); return; }
      files = files.slice(0, remaining);
      // Upload sequentially; each poster appears immediately as it finishes
      function uploadNext(i) {
        if (i >= files.length) return;
        var file = files[i];
        var path = SpnsState.prodId + '/past-posters/' + (Date.now() + i) + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        fetch(SUPABASE_URL + '/storage/v1/object/' + STORAGE_BUCKET + '/' + path, { method: 'POST', headers: sponsorHeaders({ 'Content-Type': file.type }), body: file })
          .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t); }); return SUPABASE_URL + '/storage/v1/object/public/' + STORAGE_BUCKET + '/' + path; })
          .then(function (url) {
            var p = collectPublicPageEditor();
            p.pastPosters.push(url);
            SpnsState.settings.publicPageDraft = p;
            schedulePublicPagePreview(true);
            renderPublicPageEditor();
            markPublicPageDirty();
            uploadNext(i + 1);
          })
          .catch(function (e) {
            sponsorNotify('Poster ' + (i + 1) + ' failed: ' + e.message, true);
            uploadNext(i + 1);
          });
      }
      uploadNext(0);
    };
    input.click();
  }

  function removePastPoster(index) {
    var page = collectPublicPageEditor();
    page.pastPosters.splice(index, 1);
    SpnsState.settings.publicPageDraft = page;
    schedulePublicPagePreview(true);
    renderPublicPageEditor();
    markPublicPageDirty();
  }

  function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function saveSettings() {
    SpnsState.settings.publicStats = document.querySelector('.spn-public-stat-value') ? collectPublicStats() : (SpnsState.settings.publicStats || []);
    persistSponsorSettings(publicPageSettingsPayload(), 'Settings saved.').then(refreshAdsGrouped).catch(function (e) { alert('Could not save settings: ' + e.message); });
  }

  // -- Module API ---------------------------------------------------------------

  window.MarketingSponsorsModule = {

    init: function (prodId, container, options) {
      resetState(prodId);

      var page = options && options.page || 'sponsors';
      var isDashboardPage = page === 'sponsors';
      var isAdsPage = page === 'programmeads';
      var isShowSponsorsPage = page === 'showsponsors';
      var isSettingsPage = page === 'sponsorssettings';
      var pageTitle = isAdsPage ? 'Programme Ads' : (isShowSponsorsPage ? 'Show Sponsors' : (isSettingsPage ? 'Sponsor Settings' : 'Sponsors'));
      var pageCopy = isAdsPage
        ? 'Set your programme ad sizes and pricing, then track every booking, payment, and piece of artwork through to print.'
        : (isShowSponsorsPage
          ? 'Track show sponsors, package levels, payments, promised benefits, and acknowledgements.'
          : (isSettingsPage
            ? 'Set programme ad sizes, sponsor tiers, pricing, and campaign deadlines in one place.'
            : 'Track your programme ads, sponsor packages, and business partnerships all in one place.'));
      var heroLabel = isAdsPage ? 'Placements' : (isShowSponsorsPage ? 'Sponsors' : (isSettingsPage ? 'Groups' : 'Businesses'));
      var heroKind = isAdsPage ? 'ads' : (isShowSponsorsPage ? 'sponsors' : (isSettingsPage ? 'settings' : 'businesses'));
      var settingsHeading = isSettingsPage ? pageTitle : pageTitle + ' Settings';
      var deadlineCopy = isAdsPage
        ? 'Set the booking and artwork dates used by your programme ad team.'
        : (isShowSponsorsPage ? 'Set the confirmation date used by your sponsor team.' : 'Set the booking, artwork, and sponsor confirmation dates used by your team.');
      var settingsTabsHtml = '<button type="button" class="spn-settings-tab active" data-settings-panel="sizes" onclick="MarketingSponsorsModule.switchSettingsTab(\'sizes\')">Programme Ad Sizes</button>' +
        '<button type="button" class="spn-settings-tab" data-settings-panel="tiers" onclick="MarketingSponsorsModule.switchSettingsTab(\'tiers\')">Sponsor Tiers</button>' +
        '<button type="button" class="spn-settings-tab" data-settings-panel="deadlines" onclick="MarketingSponsorsModule.switchSettingsTab(\'deadlines\')">Deadlines</button>' +
        '<button type="button" class="spn-settings-tab" data-settings-panel="publicpage" onclick="MarketingSponsorsModule.switchSettingsTab(\'publicpage\')">Public Page</button>';
      var deadlineTilesHtml = deadlineTile('Programme Ads', 'Artwork Submission', 'spn-deadline-artwork', '#476aaa') +
        deadlineTile('Programme Ads', 'Ad Booking', 'spn-deadline-booking', '#dd8233') +
        deadlineTile('Show Sponsors', 'Sponsor Confirmation', 'spn-deadline-sponsor', '#769e7b');
      if (isDashboardPage) {
        container.innerHTML =
          '<div class="aud-visual-hero">' +
            '<div class="aud-visual-hero-content">' +
              '<div>' +
                '<div class="aud-visual-kicker"><span class="aud-visual-kicker-dot" aria-hidden="true"></span><span class="page-hierarchy"><span class="page-hierarchy-page">Promote</span><span class="page-hierarchy-sep"> - </span><span class="page-hierarchy-sub">Sponsors</span></span></div>' +
                '<h1 class="aud-visual-title">Dashboard</h1>' +
                '<p class="aud-visual-copy">Manage programme advertising and show sponsorships for this production.</p>' +
              '</div>' +
              '<div class="spn-hero-side">' +
                '<a class="spn-public-page-action" id="spn-public-page-action" href="#" target="_blank" rel="noopener">View Public Page</a>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="spn-dashboard-metrics">' +
            '<section class="spn-dashboard-metric spn-dashboard-metric--light-blue">' +
              '<img class="spn-dashboard-metric-icon" src="/ASSETS/Images/Icons/Budgeting-Fundraising.svg" alt="" />' +
              '<div class="spn-dashboard-metric-label">Revenue</div>' +
              '<div class="spn-dashboard-metric-value" id="spn-dashboard-revenue">--</div>' +
              '<div class="spn-dashboard-metric-sub" id="spn-dashboard-revenue-sub">Loading...</div>' +
              '<div class="spn-dashboard-progress"><span id="spn-dashboard-revenue-bar"></span></div><div class="spn-dashboard-progress-value" id="spn-dashboard-revenue-percent">--</div>' +
            '</section>' +
            '<section class="spn-dashboard-metric spn-dashboard-metric--green">' +
              '<img class="spn-dashboard-metric-icon" src="/ASSETS/Images/Icons/Budgeting-Sponsorship.svg" alt="" />' +
              '<div class="spn-dashboard-metric-label">Sponsors Confirmed</div>' +
              '<div class="spn-dashboard-metric-value" id="spn-dashboard-sponsors">--</div>' +
              '<div class="spn-dashboard-metric-sub" id="spn-dashboard-sponsors-sub">Loading...</div>' +
              '<div class="spn-dashboard-progress"><span id="spn-dashboard-sponsors-bar"></span></div><div class="spn-dashboard-progress-value" id="spn-dashboard-sponsors-percent">--</div>' +
            '</section>' +
            '<section class="spn-dashboard-metric spn-dashboard-metric--blue">' +
              '<img class="spn-dashboard-metric-icon" src="/ASSETS/Images/Icons/Budgeting-Ads.svg" alt="" />' +
              '<div class="spn-dashboard-metric-label">Programme Ads Sold</div>' +
              '<div class="spn-dashboard-metric-value" id="spn-dashboard-ads">--</div>' +
              '<div class="spn-dashboard-metric-sub" id="spn-dashboard-ads-sub">Loading...</div>' +
              '<div class="spn-dashboard-progress"><span id="spn-dashboard-ads-bar"></span></div><div class="spn-dashboard-progress-value" id="spn-dashboard-ads-percent">--</div>' +
            '</section>' +
            '<section class="spn-dashboard-metric spn-dashboard-metric--orange spn-dashboard-metric--deadline">' +
              '<img class="spn-dashboard-metric-icon" src="/ASSETS/Images/Icons/navproductioncalendar.svg" alt="" />' +
              '<div class="spn-dashboard-metric-label">Next Deadline</div>' +
              '<div class="spn-dashboard-deadline-label" id="spn-dashboard-deadline-label">Loading...</div>' +
              '<div class="spn-dashboard-deadline-date" id="spn-dashboard-deadline-date">--</div>' +
              '<div class="spn-dashboard-deadline-days" id="spn-dashboard-deadline-days">--</div>' +
            '</section>' +
          '</div>' +
          '<section class="spn-dashboard-attention">' +
            '<div class="spn-dashboard-attention-head"><div><span class="spn-dashboard-alert-icon">!</span><h2>Needs Your Attention</h2></div><span class="spn-dashboard-attention-count" id="spn-dashboard-attention-count">Loading...</span></div>' +
            '<div id="spn-dashboard-attention-list"><div class="spn-loading-row">Loading sponsor activity...</div></div>' +
          '</section>';
        hydratePublicPageAction();
        loadPublicPageStatus();
        loadDashboard();
        return;
      }

      container.innerHTML =
        '<div class="aud-visual-hero">' +
          '<div class="aud-visual-hero-content">' +
            '<div>' +
              '<div class="aud-visual-kicker"><span class="aud-visual-kicker-dot" aria-hidden="true"></span><span class="page-hierarchy"><span class="page-hierarchy-page">Promote</span><span class="page-hierarchy-sep"> - </span><span class="page-hierarchy-sub">Sponsors</span></span></div>' +
              '<h1 class="aud-visual-title">' + pageTitle + '</h1>' +
              '<p class="aud-visual-copy">' + pageCopy + '</p>' +
            '</div>' +
            '<div class="spn-hero-side">' +
              '<div class="aud-visual-total">' +
                '<div class="aud-visual-total-kicker">' + heroLabel + '</div>' +
                '<div class="aud-visual-total-value" id="spn-hero-page-count" data-kind="' + heroKind + '">' + (isSettingsPage ? '3' : '--') + '</div>' +
              '</div>' +
              '<a class="spn-public-page-action" id="spn-public-page-action" href="#" target="_blank" rel="noopener">View Public Page</a>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="spn-tabs" role="tablist">' +
          '<button class="spn-tab active" data-panel="overview"     onclick="MarketingSponsorsModule.switchTab(\'overview\')">Overview</button>' +
          '<button class="spn-tab"        data-panel="businesses"   onclick="MarketingSponsorsModule.switchTab(\'businesses\')">Businesses</button>' +
          '<button class="spn-tab"        data-panel="ads"          onclick="MarketingSponsorsModule.switchTab(\'ads\')">Ads</button>' +
          '<button class="spn-tab"        data-panel="sponsors"     onclick="MarketingSponsorsModule.switchTab(\'sponsors\')">Sponsors</button>' +
          '<button class="spn-tab"        data-panel="deliverables" onclick="MarketingSponsorsModule.switchTab(\'deliverables\')">Deliverables</button>' +
          '<button class="spn-tab"        data-panel="files"        onclick="MarketingSponsorsModule.switchTab(\'files\')">Files</button>' +
          '<button class="spn-tab"        data-panel="settings"     onclick="MarketingSponsorsModule.switchTab(\'settings\')">Settings</button>' +
        '</div>' +

        '<div id="spn-panel-overview" class="spn-panel active">' +
          '<div class="mkt-tile-grid" id="spn-stats">' +
            mktTile('spn-tile-ad-rev',  'Marketing', '--', 'Ad Revenue',        '#769e7b') +
            mktTile('spn-tile-spn-rev', 'Marketing', '--', 'Sponsor Revenue',   '#769e7b') +
            mktTile('spn-tile-biz',     'Marketing', '--', 'Businesses',        '#476aaa') +
            mktTile('spn-tile-art',     'Marketing', '--', 'Missing Artwork',   '#d1523d') +
            mktTile('spn-tile-unpaid',  'Marketing', '--', 'Unpaid Invoices',   '#dd8233') +
            mktTile('spn-tile-due',     'Marketing', '--', 'Due This Week',     '#dd8233') +
            mktTile('spn-tile-open',    'Marketing', '--', 'Open Deliverables', '#572e88') +
            mktTile('spn-tile-pending', 'Marketing', '--', 'Pending Approvals', '#ca7ea7') +
          '</div>' +
          '<div class="spn-overview-grid">' +
            '<div class="spn-card"><div class="spn-card-title">Needs attention</div><div id="spn-alerts" class="spn-alert-list"><div class="spn-loading-row" style="padding:0;color:#9a90b0;font-size:0.85rem">Loading...</div></div></div>' +
            '<div class="spn-card"><div class="spn-card-title">Recent businesses</div><div id="spn-recent-biz"><div class="spn-loading-row" style="padding:0;color:#9a90b0;font-size:0.85rem">Loading...</div></div></div>' +
          '</div>' +
        '</div>' +

        '<div id="spn-panel-businesses" class="spn-panel">' +
          '<div class="spn-toolbar">' +
            '<span class="spn-toolbar-title" id="spn-biz-count">Businesses</span>' +
            '<button class="spn-btn spn-btn--primary" onclick="MarketingSponsorsModule.openBizModal()">+ Add Business</button>' +
          '</div>' +
          '<div class="spn-list" id="spn-biz-list">' +
            '<div class="spn-list-head spn-biz-cols"><span>Business</span><span>Contact</span><span>Email</span><span>Phone</span><span></span></div>' +
            '<div class="spn-loading-row">Loading...</div>' +
          '</div>' +
        '</div>' +

        '<div id="spn-panel-ads" class="spn-panel">' +
          '<div class="spn-toolbar">' +
            '<span class="spn-toolbar-title" id="spn-ads-count">Programme Ads</span>' +
            '<button class="spn-btn spn-btn--primary" onclick="MarketingSponsorsModule.openAdModal()">+ Add Ad</button>' +
          '</div>' +
          '<div id="spn-ads-grouped"><div class="spn-loading-row">Loading...</div></div>' +
        '</div>' +

        '<div id="spn-panel-sponsors" class="spn-panel">' +
          '<div class="spn-toolbar">' +
            '<span class="spn-toolbar-title" id="spn-pkgs-count">Sponsor Packages</span>' +
            '<button class="spn-btn spn-btn--primary" onclick="MarketingSponsorsModule.openPkgModal()">+ Add Sponsor</button>' +
          '</div>' +
          '<div class="spn-list" id="spn-pkgs-list">' +
            '<div class="spn-list-head spn-pkg-cols"><span>Business</span><span>Tier</span><span>Amount</span><span>Payment</span><span></span></div>' +
            '<div class="spn-loading-row">Loading...</div>' +
          '</div>' +
        '</div>' +

        '<div id="spn-panel-deliverables" class="spn-panel">' +
          '<div class="spn-toolbar">' +
            '<span class="spn-toolbar-title" id="spn-deliv-count">Deliverables</span>' +
            '<button class="spn-btn spn-btn--primary" onclick="MarketingSponsorsModule.openDelivModal()">+ Add Deliverable</button>' +
          '</div>' +
          '<div class="spn-list" id="spn-deliv-list"><div class="spn-loading-row">Loading...</div></div>' +
        '</div>' +

        '<div id="spn-panel-files" class="spn-panel">' +
          '<div class="spn-toolbar"><span class="spn-toolbar-title">Files</span><button class="spn-btn spn-btn--ghost" disabled>Upload File</button></div>' +
          '<div class="spn-card"><div class="spn-empty"><div class="spn-empty-icon">&#x1F4C1;</div><h3>File library coming soon</h3><p>Logos, ad artwork, contracts, and invoices will all live here, connected back to their business or package.</p></div></div>' +
        '</div>' +

        '<div id="spn-panel-settings" class="spn-panel">' +
          '<div class="spn-settings-tabs" role="tablist" aria-label="Sponsor settings">' +
            settingsTabsHtml +
          '</div>' +
          '<div class="spn-settings-panel active" id="spn-settings-sizes">' +
            '<div class="spn-settings-panel-head"><div><div class="spn-settings-section-title">Programme Ad Sizes</div><div class="spn-settings-section-desc">Set the name, dimensions, colour price, and black-and-white price shown on your ad booking sheet.</div></div><button type="button" class="spn-btn spn-btn--primary" onclick="MarketingSponsorsModule.editAdSize()">+ Add Size</button></div>' +
            '<div id="spn-adsize-list"></div>' +
          '</div>' +
          '<div class="spn-settings-panel" id="spn-settings-tiers">' +
            '<div class="spn-settings-panel-head"><div><div class="spn-settings-section-title">Sponsor Tiers</div><div class="spn-settings-section-desc">Create the package levels available to show sponsors.</div></div></div>' +
            '<div id="spn-tier-list"></div>' +
          '</div>' +
          '<div class="spn-settings-panel" id="spn-settings-deadlines">' +
            '<div class="spn-settings-panel-head"><div><div class="spn-settings-section-title">Deadlines</div><div class="spn-settings-section-desc">' + deadlineCopy + '</div></div></div>' +
            '<div class="spn-settings-tile-grid">' +
              deadlineTilesHtml +
            '</div>' +
          '</div>' +
          '<div class="spn-settings-panel" id="spn-settings-publicpage">' +
            '<div class="spn-public-builder">' +
              '<div class="spn-public-builder-editor"><div id="spn-public-editor"></div><div class="spn-public-stats-grid" id="spn-public-stats-grid" hidden></div></div>' +
              '<aside class="spn-public-builder-preview"><div class="spn-public-preview-toolbar"><span><strong>Here\'s how your page looks</strong><small>This is a preview. Publish when you are happy with it.</small></span><div class="spn-public-preview-controls"><div class="spn-public-builder-actions"><span class="spn-public-draft-status" id="spn-public-draft-status" role="status" aria-live="polite" hidden></span><button type="button" class="spn-btn spn-btn--primary" id="spn-public-publish-changes" onclick="MarketingSponsorsModule.savePublicPage(true)" disabled>Publish Changes</button></div><div class="spn-public-device-controls"><button type="button" class="spn-public-device active" data-public-device="desktop" onclick="MarketingSponsorsModule.setPublicPreviewDevice(\'desktop\')">Desktop</button><button type="button" class="spn-public-device" data-public-device="mobile" onclick="MarketingSponsorsModule.setPublicPreviewDevice(\'mobile\')">Mobile</button></div></div></div>' +
                '<div class="spn-public-preview-frame-shell" id="spn-public-preview-shell" data-device="desktop"><div id="spn-preview-scaler"><iframe id="spn-public-preview-frame" title="Public sponsor page preview" src="/PUBLIC/sponsors.html?prod=' + encodeURIComponent(SpnsState.prodId) + '&preview=1&v=two-panel-20260620" onload="MarketingSponsorsModule.refreshPublicPreview();MarketingSponsorsModule.scalePreviewFrame()"></iframe></div></div>' +
              '</aside>' +
            '</div>' +
          '</div>' +
          '<div class="spn-settings-savebar" id="spn-settings-savebar">' +
            '<div><strong>' + settingsHeading + '</strong><span>Save changes to this campaign setup.</span></div>' +
            '<button class="spn-btn spn-btn--primary" onclick="MarketingSponsorsModule.saveSettings()">Save Settings</button>' +
          '</div>' +
        '</div>' +

        '<div class="spn-modal-overlay" id="spn-adsize-modal">' +
          '<div class="spn-modal">' +
            '<div class="spn-modal-title" id="spn-adsize-modal-title">Edit Programme Ad Size</div>' +
            '<input type="hidden" id="spn-adsize-index" />' +
            '<div class="spn-row-2">' +
              '<div class="spn-field"><label>Name *</label><input type="text" id="spn-adsize-name" placeholder="Quarter Page" /></div>' +
              '<div class="spn-field"><label>Size (height x width) *</label><input type="text" id="spn-adsize-dims" placeholder="4x2.5" inputmode="decimal" /></div>' +
            '</div>' +
            '<div class="spn-row-2">' +
              '<div class="spn-format-option"><label class="spn-format-toggle"><input type="checkbox" id="spn-adsize-colour-enabled" onchange="MarketingSponsorsModule.syncAdSizeFormatControls()" /><span><strong>Offer Colour</strong><small>Allow this size to be booked in colour.</small></span></label><div class="spn-field"><label>Colour Price ($)</label><input type="number" id="spn-adsize-colour" min="0" step="0.01" placeholder="80.00" /></div></div>' +
              '<div class="spn-format-option"><label class="spn-format-toggle"><input type="checkbox" id="spn-adsize-bw-enabled" onchange="MarketingSponsorsModule.syncAdSizeFormatControls()" /><span><strong>Offer Black &amp; White</strong><small>Allow this size to be booked in black and white.</small></span></label><div class="spn-field"><label>Black &amp; White Price ($)</label><input type="number" id="spn-adsize-bw" min="0" step="0.01" placeholder="60.00" /></div></div>' +
            '</div>' +
            '<div class="spn-modal-footer spn-modal-footer--split">' +
              '<button type="button" class="spn-btn spn-btn--danger" id="spn-adsize-delete" onclick="MarketingSponsorsModule.deleteAdSize()">Remove Size</button>' +
              '<div class="spn-modal-footer-group"><button type="button" class="spn-btn spn-btn--ghost" onclick="MarketingSponsorsModule.closeAdSizeModal()">Cancel</button><button type="button" class="spn-btn spn-btn--primary" onclick="MarketingSponsorsModule.saveAdSize()">Save Size</button></div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="spn-modal-overlay" id="spn-tier-modal">' +
          '<div class="spn-modal">' +
            '<div class="spn-modal-title" id="spn-tier-modal-title">Edit Sponsor Tier</div>' +
            '<input type="hidden" id="spn-tier-index" />' +
            '<div class="spn-row-2">' +
              '<div class="spn-field"><label>Tier Name *</label><input type="text" id="spn-tier-name" placeholder="Gold Sponsor" /></div>' +
              '<div class="spn-field"><label>Default Amount ($) *</label><input type="number" id="spn-tier-amount" min="0" step="0.01" placeholder="500.00" /></div>' +
            '</div>' +
            '<div class="spn-row-2">' +
              '<div class="spn-field"><label>Slots Available <span style="font-weight:400;opacity:.7">(leave blank for unlimited)</span></label><input type="number" id="spn-tier-slots" min="1" step="1" placeholder="e.g. 1" /></div>' +
            '</div>' +
            '<div class="spn-field"><label>Benefits <span style="font-weight:400;opacity:.7">(one per line)</span></label><textarea id="spn-tier-bullets" placeholder="Recognition in the programme&#10;Logo on website&#10;Two complimentary tickets" style="min-height:130px"></textarea></div>' +
            '<div class="spn-modal-footer spn-modal-footer--split">' +
              '<button type="button" class="spn-btn spn-btn--danger" id="spn-tier-delete" onclick="MarketingSponsorsModule.deleteTier()">Remove Tier</button>' +
              '<div class="spn-modal-footer-group"><button type="button" class="spn-btn spn-btn--ghost" onclick="MarketingSponsorsModule.closeTierModal()">Cancel</button><button type="button" class="spn-btn spn-btn--primary" onclick="MarketingSponsorsModule.saveTier()">Save Tier</button></div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="spn-modal-overlay" id="spn-biz-modal">' +
          '<div class="spn-modal">' +
            '<div class="spn-modal-title" id="spn-biz-modal-title">Add Business</div>' +
            '<input type="hidden" id="spn-biz-id" />' +
            '<div class="spn-row-2">' +
              '<div class="spn-field"><label>Business Name *</label><input type="text" id="spn-biz-name" placeholder="Rainbow Youth Theatre" /></div>' +
              '<div class="spn-field"><label>Contact Person</label><input type="text" id="spn-biz-contact" placeholder="Jane Smith" /></div>' +
            '</div>' +
            '<div class="spn-row-2">' +
              '<div class="spn-field"><label>Email</label><input type="email" id="spn-biz-email" placeholder="jane@example.com" /></div>' +
              '<div class="spn-field"><label>Phone</label><input type="tel" id="spn-biz-phone" placeholder="250-555-0100" /></div>' +
            '</div>' +
            '<div class="spn-row-2">' +
              '<div class="spn-field"><label>Website</label><input type="url" id="spn-biz-website" placeholder="https://example.com" /></div>' +
              '<div class="spn-field"><label>Instagram</label><input type="text" id="spn-biz-instagram" placeholder="@handle" /></div>' +
            '</div>' +
            '<div class="spn-field"><label>Notes</label><textarea id="spn-biz-notes" placeholder="Any notes about this business..."></textarea></div>' +
            '<div class="spn-modal-footer">' +
              '<button class="spn-btn spn-btn--ghost" onclick="MarketingSponsorsModule.closeBizModal()">Cancel</button>' +
              '<button class="spn-btn spn-btn--primary" onclick="MarketingSponsorsModule.saveBiz()">Save Business</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="spn-modal-overlay" id="spn-ad-modal">' +
          '<div class="spn-modal">' +
            '<div class="spn-modal-title" id="spn-ad-modal-title">Add Programme Ad</div>' +
            '<input type="hidden" id="spn-ad-id" />' +
            '<div class="spn-field"><label>Business</label><select id="spn-ad-biz"></select></div>' +
            '<div class="spn-row-2">' +
              '<div class="spn-field"><label>Ad Size *</label><select id="spn-ad-size"><option value="">Select size...</option></select></div>' +
              '<div class="spn-field"><label>Colour or Black &amp; White</label><select id="spn-ad-type"><option value="colour">Colour</option><option value="bw">Black &amp; White</option></select></div>' +
            '</div>' +
            '<div class="spn-row-2">' +
              '<div class="spn-field"><label>Price ($)</label><input type="number" id="spn-ad-price" min="0" step="0.01" placeholder="0.00" /></div>' +
              '<div class="spn-field"><label>Payment Status</label><select id="spn-ad-payment"><option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="invoice_sent">Invoice Sent</option><option value="overdue">Overdue</option></select></div>' +
            '</div>' +
            '<div class="spn-row-2">' +
              '<div class="spn-field"><label>Artwork Status</label><select id="spn-ad-artwork"><option value="missing">Not Received</option><option value="received">Received</option><option value="approved">Approved</option><option value="print_ready">Print Ready</option></select></div>' +
              '<div class="spn-field"><label>Approval Status</label><select id="spn-ad-approval"><option value="pending">Pending Review</option><option value="approved">Approved</option><option value="changes_needed">Changes Needed</option></select></div>' +
            '</div>' +
            '<div class="spn-field"><label>Notes</label><textarea id="spn-ad-notes" placeholder="Placement notes, special instructions..."></textarea></div>' +
            '<div class="spn-modal-footer">' +
              '<button class="spn-btn spn-btn--ghost" onclick="MarketingSponsorsModule.closeAdModal()">Cancel</button>' +
              '<button class="spn-btn spn-btn--primary" onclick="MarketingSponsorsModule.saveAd()">Save Ad</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="spn-modal-overlay" id="spn-pkg-modal">' +
          '<div class="spn-modal">' +
            '<div class="spn-modal-title" id="spn-pkg-modal-title">Add Sponsor</div>' +
            '<input type="hidden" id="spn-pkg-id" />' +
            '<div class="spn-field"><label>Business</label><select id="spn-pkg-biz"></select></div>' +
            '<div class="spn-row-2">' +
              '<div class="spn-field"><label>Tier / Package</label><select id="spn-pkg-tier"><option value="">Custom / no tier</option></select></div>' +
              '<div class="spn-field"><label>Amount ($)</label><input type="number" id="spn-pkg-amount" min="0" step="0.01" placeholder="0.00" /></div>' +
            '</div>' +
            '<div class="spn-field"><label>Payment Status</label><select id="spn-pkg-payment"><option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="invoice_sent">Invoice Sent</option><option value="overdue">Overdue</option></select></div>' +
            '<div class="spn-field"><label>Included Benefits</label><textarea id="spn-pkg-benefits" placeholder="Logo on poster, website mention, social post..."></textarea></div>' +
            '<div class="spn-field"><label>Notes</label><textarea id="spn-pkg-notes"></textarea></div>' +
            '<div class="spn-modal-footer">' +
              '<button class="spn-btn spn-btn--ghost" onclick="MarketingSponsorsModule.closePkgModal()">Cancel</button>' +
              '<button class="spn-btn spn-btn--primary" onclick="MarketingSponsorsModule.savePkg()">Save Sponsor</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="spn-modal-overlay" id="spn-deliv-modal">' +
          '<div class="spn-modal">' +
            '<div class="spn-modal-title" id="spn-deliv-modal-title">Add Deliverable</div>' +
            '<input type="hidden" id="spn-deliv-id" />' +
            '<div class="spn-field"><label>Title *</label><input type="text" id="spn-deliv-title" placeholder="Add logo to poster" /></div>' +
            '<div class="spn-row-2">' +
              '<div class="spn-field"><label>Business</label><select id="spn-deliv-biz"><option value="">No business linked</option></select></div>' +
              '<div class="spn-field"><label>Due Date</label><input type="date" id="spn-deliv-due" /></div>' +
            '</div>' +
            '<div class="spn-row-2">' +
              '<div class="spn-field"><label>Assigned To</label><input type="text" id="spn-deliv-assigned" placeholder="Name or role" /></div>' +
              '<div class="spn-field"><label>Status</label><select id="spn-deliv-status"><option value="open">Open</option><option value="in_progress">In Progress</option><option value="done">Done</option></select></div>' +
            '</div>' +
            '<div class="spn-field"><label>Notes</label><textarea id="spn-deliv-notes" placeholder="Additional context..."></textarea></div>' +
            '<div class="spn-modal-footer">' +
              '<button class="spn-btn spn-btn--ghost" onclick="MarketingSponsorsModule.closeDelivModal()">Cancel</button>' +
              '<button class="spn-btn spn-btn--primary" onclick="MarketingSponsorsModule.saveDeliv()">Save Deliverable</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      document.querySelectorAll('.spn-modal-overlay').forEach(function (el) {
        el.addEventListener('click', function (e) { if (e.target === el) el.classList.remove('open'); });
      });

      if (isAdsPage) {
        container.querySelectorAll('.spn-tab').forEach(function (tab) {
          tab.hidden = !['ads', 'businesses', 'deliverables'].includes(tab.dataset.panel);
        });
      } else if (isShowSponsorsPage) {
        container.querySelectorAll('.spn-tab').forEach(function (tab) {
          tab.hidden = !['sponsors', 'businesses', 'deliverables'].includes(tab.dataset.panel);
        });
      } else if (isSettingsPage) {
        var pageTabs = container.querySelector('.spn-tabs');
        if (pageTabs) pageTabs.hidden = true;
      }

      refreshAdsGrouped();
      hydratePublicPageAction();
      loadPublicPageStatus();
      switchSettingsTab('sizes');
      switchTab(isAdsPage ? 'ads' : (isShowSponsorsPage ? 'sponsors' : (isSettingsPage ? 'settings' : 'overview')));
    },

    destroy: function () {
      clearTimeout(autoSaveDraftTimer); autoSaveDraftTimer = null;
      if (_previewScaleObs) { _previewScaleObs.disconnect(); _previewScaleObs = null; }
      SpnsState.prodId       = null;
      SpnsState.businesses   = [];
      SpnsState.ads          = [];
      SpnsState.packages     = [];
      SpnsState.deliverables = [];
      SpnsState.loaded       = {};
      publicSaveInFlight = false;
    },

    switchTab:       switchTab,
    openBizModal:    openBizModal,
    closeBizModal:   closeBizModal,
    saveBiz:         saveBiz,
    deleteBiz:       deleteBiz,
    openAdModal:     openAdModal,
    closeAdModal:    closeAdModal,
    saveAd:          saveAd,
    deleteAd:        deleteAd,
    uploadArtwork:   uploadArtwork,
    removeArtwork:   removeArtwork,
    openPkgModal:    openPkgModal,
    closePkgModal:   closePkgModal,
    savePkg:         savePkg,
    deletePkg:       deletePkg,
    openDelivModal:  openDelivModal,
    closeDelivModal: closeDelivModal,
    saveDeliv:       saveDeliv,
    deleteDeliv:     deleteDeliv,
    toggleDeliv:     toggleDeliv,
    editAdSize:      editAdSize,
    syncAdSizeFormatControls: syncAdSizeFormatControls,
    closeAdSizeModal: closeAdSizeModal,
    saveAdSize:      saveAdSize,
    deleteAdSize:    deleteAdSize,
    addTier:         addTier,
    editTier:        editTier,
    closeTierModal:  closeTierModal,
    saveTier:        saveTier,
    deleteTier:      deleteTier,
    saveSettings:    saveSettings,
    switchSettingsTab: switchSettingsTab,
    savePublicPage: savePublicPage,
    unpublishPublicPage: unpublishPublicPage,
    uploadPublicPoster: uploadPublicPoster,
    uploadPublicPastPosters: uploadPublicPastPosters,
    uploadCurrentPosterOverride: uploadCurrentPosterOverride,
    clearCurrentPosterOverride: clearCurrentPosterOverride,
    addPastPoster: addPastPoster,
    removePastPoster: removePastPoster,
    reorderPastPosters: reorderPastPosters,
    setPublicSectionVisible: setPublicSectionVisible,
    editPublicSection: editPublicSection,
    backToPublicSections: backToPublicSections,
    toggleFieldCard: toggleFieldCard,
    toggleAllFieldCards: toggleAllFieldCards,
    movePublicSection: movePublicSection,
    resetPublicSectionOrder: resetPublicSectionOrder,
    setPublicPreviewDevice: setPublicPreviewDevice,
    scalePreviewFrame: scalePreviewFrame,
    refreshPublicPreview: schedulePublicPagePreview,
  };
})();
