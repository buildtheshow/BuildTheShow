/* marketing-sponsors.js — Sponsors module */
(function () {
  'use strict';

  var SUPABASE_URL  = 'https://tkmaiktxpwqfbgeojbnf.supabase.co';
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrbWFpa3R4cHdxZmJnZW9qYm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDc4NTI4NTYsImV4cCI6MjAyMzQyODg1Nn0.tVxOMkaMdBnuqQbLdHl00h4WA7DV8LHuVxCt6z5LFCY';
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
    { id: 'presenting', label: 'Presenting Sponsor', amount: 1000 },
    { id: 'gold',       label: 'Gold Sponsor',       amount: 500  },
    { id: 'silver',     label: 'Silver Sponsor',     amount: 250  },
    { id: 'bronze',     label: 'Bronze Sponsor',     amount: 100  },
    { id: 'friend',     label: 'Friend',             amount: 50   },
  ];

  var ADTILE_COLORS = ['#78bbd4', '#476aaa', '#769e7b', '#dd8233', '#d1523d', '#ca7ea7'];

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
      adSizes: DEFAULT_AD_SIZES.map(function (s) { return Object.assign({}, s); }),
      tiers:   DEFAULT_TIERS.map(function (t) { return Object.assign({}, t); }),
    };
    SpnsState.loaded = {};
  }

  // -- DB helpers ---------------------------------------------------------------

  function dbFetch(table, extra) {
    var url = SUPABASE_URL + '/rest/v1/' + table + '?production_id=eq.' + SpnsState.prodId + (extra || '') + '&order=created_at.asc';
    return fetch(url, { headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON } })
      .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t); }); return r.json(); });
  }

  function dbInsert(table, data) {
    return fetch(SUPABASE_URL + '/rest/v1/' + table, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(Object.assign({}, data, { production_id: SpnsState.prodId })),
    }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t); }); return r.json(); });
  }

  function dbUpdate(table, id, data) {
    return fetch(SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + id, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(data),
    }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t); }); return r.json(); });
  }

  function dbDelete(table, id) {
    return fetch(SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + id, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON },
    }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t); }); });
  }

  // -- Formatters ---------------------------------------------------------------

  function fmtDollars(cents) { return '$' + (cents / 100).toFixed(2).replace(/\.00$/, ''); }
  function fmtDate(d) { if (!d) return ''; var parts = d.split('-'); return parts[1] + '/' + parts[2] + '/' + parts[0].slice(2); }
  function bizName(id) { var b = SpnsState.businesses.find(function (x) { return x.id === id; }); return b ? b.name : ''; }
  function esc(s) { return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : ''; }

  // -- Settings tile builder ---------------------------------------------------

  function settingsTile(kicker, label, body, footer) {
    return '<div class="template-brand-card template-brand-card--settings">' +
      '<div class="template-brand-card-inner"><div class="template-brand-tile-content">' +
        '<div class="template-brand-tile-container template-brand-tile-container--header">' +
          '<div class="template-brand-tile-kicker">' + kicker + '</div>' +
        '</div>' +
        '<div class="template-brand-tile-container template-brand-tile-container--title">' +
          '<div class="template-brand-tile-settings-label">' + label + '</div>' +
        '</div>' +
        '<div class="template-brand-tile-container template-brand-tile-container--body">' +
          '<div class="spn-settings-tile-body">' + body + '</div>' +
        '</div>' +
        '<div class="template-brand-tile-container template-brand-tile-container--footer">' +
          '<div class="spn-settings-tile-actions">' + footer + '</div>' +
        '</div>' +
      '</div></div>' +
    '</div>';
  }

  function deadlineTile(kicker, label, inputId) {
    return '<div class="template-brand-card template-brand-card--settings">' +
      '<div class="template-brand-card-inner"><div class="template-brand-tile-content">' +
        '<div class="template-brand-tile-container template-brand-tile-container--header">' +
          '<div class="template-brand-tile-kicker">' + kicker + '</div>' +
        '</div>' +
        '<div class="template-brand-tile-container template-brand-tile-container--title">' +
          '<div class="template-brand-tile-settings-label">' + label + '</div>' +
        '</div>' +
        '<div class="template-brand-tile-container template-brand-tile-container--body">' +
          '<input type="date" id="' + inputId + '" class="spn-field input" style="width:100%;padding:0.45rem 0.6rem;border:1.5px solid rgba(87,46,136,0.18);border-radius:7px;font-family:inherit;font-size:0.84rem;color:#1a1530;background:#fff;" />' +
        '</div>' +
        '<div class="template-brand-tile-container template-brand-tile-container--footer"></div>' +
      '</div></div>' +
    '</div>';
  }

  // -- Ad sizes grouped visual --------------------------------------------------

  /* Dims format: "HxW" (height x width, printing convention).
     e.g. '8x5' = 8" tall x 5" wide. First number = height, second = width. */
  function parseAdDims(dims) {
    var m = String(dims || '').replace(/['"]/g, '').match(/^([\d.]+)[xX]([\d.]+)$/);
    return m ? { h: parseFloat(m[1]) || 1, w: parseFloat(m[2]) || 1 } : { h: 1, w: 1 };
  }

  function hzContentTile(color, kicker, title, body, footerHtml) {
    return (
      '<div class="template-brand-card template-brand-card--horizontal template-brand-card--content"' +
        ' style="--brand-tile-bg:' + color + ';--brand-tile-ink:#ffffff;">' +
        '<div class="template-brand-card-inner">' +
          '<div class="template-brand-horizontal-quad-split">' +
            '<div class="template-brand-horizontal-quad-cell template-brand-horizontal-quad-cell--anchor">' +
              '<div class="template-brand-text-holder template-brand-text-holder--invisible">' +
                '<div class="template-brand-text-holder-inner template-brand-text-holder-inner--invisible">' +
                  '<div class="template-brand-tile-container template-brand-tile-container--header"><div class="template-brand-tile-kicker">' + kicker + '</div></div>' +
                  '<div class="template-brand-tile-container template-brand-tile-container--title"><div class="template-brand-tile-title">' + title + '</div></div>' +
                  '<div class="template-brand-tile-container template-brand-tile-container--body"><div class="template-brand-tile-body">' + body + '</div></div>' +
                  '<div class="template-brand-tile-container template-brand-tile-container--footer">' + footerHtml + '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="template-brand-horizontal-quad-cell template-brand-horizontal-quad-cell--right" aria-hidden="true"></div>' +
            '<div class="template-brand-horizontal-quad-cell template-brand-horizontal-quad-cell--bottom-left" aria-hidden="true"></div>' +
            '<div class="template-brand-horizontal-quad-cell template-brand-horizontal-quad-cell--bottom-right" aria-hidden="true"></div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderAdSlotCards(sizeId, color) {
    var ads = SpnsState.ads.filter(function (a) { return a.ad_size === sizeId; });
    if (!ads.length) {
      return hzContentTile(
        color,
        'Ad Slot',
        'Waiting',
        'No booking yet',
        '<button class="template-brand-tile-button" onclick="MarketingSponsorsModule.openAdModal(undefined,' + JSON.stringify(sizeId) + ')">+ Add Ad</button>'
      );
    }
    return ads.map(function (a) {
      var biz  = esc(bizName(a.business_id) || 'Unnamed Business');
      var type = a.ad_type === 'bw' ? 'B&W' : 'Colour';
      var paid = a.payment_status === 'paid';
      var art  = a.artwork_status === 'received' || a.artwork_status === 'approved' || a.artwork_status === 'print_ready';
      var status = (paid ? 'Paid' : 'Unpaid') + ' &middot; ' + (art ? 'Art received' : 'Art missing');
      return hzContentTile(
        color,
        esc(type),
        biz,
        status,
        '<button class="template-brand-tile-button" onclick="MarketingSponsorsModule.openAdModal(' + JSON.stringify(a.id) + ')">Edit</button>'
      );
    }).join('') +
    hzContentTile(
      color,
      'Ad Slot',
      'Add Another',
      '',
      '<button class="template-brand-tile-button" onclick="MarketingSponsorsModule.openAdModal(undefined,' + JSON.stringify(sizeId) + ')">+ Add Ad</button>'
    );
  }

    return cards + addCard;
  }


  function renderAdsGrouped() {
    var sizes  = SpnsState.settings.adSizes;
    var colors = ADTILE_COLORS;
    var tiles  = sizes.map(function (s, i) {
      var color       = colors[i % colors.length];
      var dimsDisplay = String(s.dims || '').replace(/['"]/g, '').replace(/[xX]/, '″ × ') + '″';
      return (
        '<div class="template-brand-card template-brand-card--horizontal template-brand-card--content spn-adpkg-tile"' +
          ' style="--brand-tile-bg:' + color + ';--brand-tile-ink:#ffffff;"' +
          ' aria-label="' + esc(s.label) + ' ad size tile">' +
          '<div class="template-brand-card-inner">' +
            '<div class="template-brand-horizontal-quad-split">' +

              '<div class="template-brand-horizontal-quad-cell template-brand-horizontal-quad-cell--anchor">' +
                '<div class="template-brand-text-holder">' +
                  '<div class="template-brand-text-holder-inner">' +
                    '<div class="template-brand-tile-container template-brand-tile-container--header">' +
                      '<div class="template-brand-tile-kicker">' + esc(s.label) + '</div>' +
                    '</div>' +
                    '<div class="template-brand-tile-container template-brand-tile-container--title">' +
                      '<div class="template-brand-tile-title">' + esc(dimsDisplay) + '</div>' +
                    '</div>' +
                    '<div class="template-brand-tile-container template-brand-tile-container--body">' +
                      '<div class="template-brand-tile-body">Colour $' + s.colour + ' · B&amp;W $' + s.bw + '</div>' +
                    '</div>' +
                    '<div class="template-brand-tile-container template-brand-tile-container--footer">' +
                      '<button class="template-brand-tile-button spn-adpkg-anchor-edit" onclick="MarketingSponsorsModule.editAdSize(' + i + ')" title="Edit pricing">Edit</button>' +
                    '</div>' +
                  '</div>' +
                '</div>' +
              '</div>' +

              '<div class="template-brand-horizontal-quad-cell template-brand-horizontal-quad-cell--right spn-adpkg-slots">' +
                renderAdSlotCards(s.id, color) +
              '</div>' +

              '<div class="template-brand-horizontal-quad-cell template-brand-horizontal-quad-cell--bottom-left" aria-hidden="true"></div>' +
              '<div class="template-brand-horizontal-quad-cell template-brand-horizontal-quad-cell--bottom-right" aria-hidden="true"></div>' +

            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');
    return '<div class="spn-adpkg-list">' + tiles + '</div>';
  }


  function refreshAdsGrouped() {
    var el = document.getElementById('spn-ads-grouped');
    if (!el) return;
    el.innerHTML = renderAdsGrouped();
    var count = document.getElementById('spn-ads-count');
    if (count) count.textContent = SpnsState.ads.length + ' Programme Ad' + (SpnsState.ads.length !== 1 ? 's' : '');
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
        headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON, 'Content-Type': file.type },
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

  // -- OVERVIEW -----------------------------------------------------------------

  function loadOverview() {
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
      setTile('spn-hero-biz-count', bizList.length);
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
            if (s.adSizes && s.adSizes.length) SpnsState.settings.adSizes = s.adSizes;
            if (s.tiers   && s.tiers.length)   SpnsState.settings.tiers   = s.tiers;
          }
        }).catch(function () { SpnsState.loaded.settings = true; });
    var bizPromise = SpnsState.businesses.length === 0
      ? dbFetch('sponsor_businesses').then(function (d) { SpnsState.businesses = d; }).catch(function () {})
      : Promise.resolve();
    return Promise.all([settingsPromise, bizPromise]).then(function () {
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

    document.getElementById('spn-ad-type').value     = (a && a.ad_type)        || 'colour';
    document.getElementById('spn-ad-price').value    = a ? ((a.price_cents || 0) / 100).toFixed(2) : '';
    document.getElementById('spn-ad-payment').value  = (a && a.payment_status)  || 'unpaid';
    document.getElementById('spn-ad-artwork').value  = (a && a.artwork_status)  || 'missing';
    document.getElementById('spn-ad-approval').value = (a && a.approval_status) || 'pending';
    document.getElementById('spn-ad-notes').value    = (a && a.notes)           || '';

    function autofillPrice() {
      if (document.getElementById('spn-ad-price').value) return;
      var sz   = SpnsState.settings.adSizes.find(function (x) { return x.id === sizeSel.value; });
      var type = document.getElementById('spn-ad-type').value;
      if (sz) document.getElementById('spn-ad-price').value = (type === 'bw' ? sz.bw : sz.colour).toFixed(2);
    }
    sizeSel.onchange = autofillPrice;
    document.getElementById('spn-ad-type').onchange = autofillPrice;
    if (!a && defaultSizeId) autofillPrice();
    document.getElementById('spn-ad-modal').classList.add('open');
  }
  function closeAdModal() { document.getElementById('spn-ad-modal').classList.remove('open'); }

  function saveAd() {
    if (!document.getElementById('spn-ad-size').value) { alert('Please select an ad size.'); return; }
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
    return dbFetch('sponsor_packages').then(function (data) {
      SpnsState.packages = data;
    }).catch(function () {
      SpnsState.packages = [];
    }).then(renderPackages);
  }

  function renderPackages() {
    var pkgs  = SpnsState.packages;
    var count = document.getElementById('spn-pkgs-count');
    if (count) count.textContent = pkgs.length + ' Sponsor' + (pkgs.length !== 1 ? 's' : '');
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
        if (s.tiers   && s.tiers.length)   SpnsState.settings.tiers   = s.tiers;
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
    });
  }

  function renderSettings() {
    var aszEl = document.getElementById('spn-adsize-list');
    if (aszEl) aszEl.innerHTML = '<div class="spn-settings-tile-grid">' +
      SpnsState.settings.adSizes.map(function (s, i) {
        var dimsDisplay = String(s.dims).replace(/[xX]/, '" x ') + '"';
        return settingsTile(
          'Ad Size',
          esc(s.label),
          esc(dimsDisplay) + '<br>Colour: $' + s.colour + ' &nbsp;&middot;&nbsp; B&amp;W: $' + s.bw,
          '<button class="spn-btn spn-btn--ghost spn-btn--sm" onclick="MarketingSponsorsModule.editAdSize(' + i + ')">Edit</button>'
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
          '<button class="spn-btn spn-btn--ghost spn-btn--sm" onclick="MarketingSponsorsModule.editTier(' + i + ')">Edit</button>' +
          '<button class="spn-btn spn-btn--danger spn-btn--sm" onclick="MarketingSponsorsModule.deleteTier(' + i + ')">Remove</button>'
        );
      }).join('') +
      '<div style="grid-column:1/-1;padding-top:0.25rem">' +
        '<button class="spn-btn spn-btn--ghost" onclick="MarketingSponsorsModule.addTier()">+ Add Tier</button>' +
      '</div>' +
    '</div>';
  }

  function editAdSize(i) {
    var s      = SpnsState.settings.adSizes[i];
    var label  = prompt('Size name:', s.label);                   if (label  == null) return;
    var dims   = prompt('Dimensions H x W (e.g. 4x5):', s.dims); if (dims   == null) return;
    var colour = parseFloat(prompt('Colour price ($):', s.colour)); if (isNaN(colour)) return;
    var bw     = parseFloat(prompt('B&W price ($):', s.bw));        if (isNaN(bw))     return;
    SpnsState.settings.adSizes[i] = Object.assign({}, s, { label: label.trim(), dims: dims.trim(), colour: colour, bw: bw });
    renderSettings();
    refreshAdsGrouped();
  }

  function addTier() {
    var label  = prompt('Tier name:');                      if (!label)        return;
    var amount = parseFloat(prompt('Default amount ($):')); if (isNaN(amount)) return;
    SpnsState.settings.tiers.push({ id: label.toLowerCase().replace(/\s+/g, '-'), label: label.trim(), amount: amount });
    renderSettings();
  }

  function editTier(i) {
    var t      = SpnsState.settings.tiers[i];
    var label  = prompt('Tier name:', t.label);                        if (label  == null) return;
    var amount = parseFloat(prompt('Default amount ($):', t.amount));  if (isNaN(amount))  return;
    SpnsState.settings.tiers[i] = Object.assign({}, t, { label: label.trim(), amount: amount });
    renderSettings();
  }

  function deleteTier(i) {
    if (!confirm('Remove this tier?')) return;
    SpnsState.settings.tiers.splice(i, 1);
    renderSettings();
  }

  function saveSettings() {
    var settings = {
      adSizes: SpnsState.settings.adSizes,
      tiers:   SpnsState.settings.tiers,
      deadlines: {
        artwork: (document.getElementById('spn-deadline-artwork') || {}).value || null,
        booking: (document.getElementById('spn-deadline-booking') || {}).value || null,
        sponsor: (document.getElementById('spn-deadline-sponsor') || {}).value || null,
      },
    };
    fetch(SUPABASE_URL + '/rest/v1/sponsor_settings', {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({ production_id: SpnsState.prodId, settings: settings, updated_at: new Date().toISOString() }),
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t); });
      alert('Settings saved.');
      refreshAdsGrouped();
    }).catch(function (e) { alert('Could not save settings: ' + e.message); });
  }

  // -- Module API ---------------------------------------------------------------

  window.MarketingSponsorsModule = {

    init: function (prodId, container) {
      resetState(prodId);

      container.innerHTML =
        '<div class="aud-visual-hero">' +
          '<div class="aud-visual-hero-content">' +
            '<div>' +
              '<div class="aud-visual-kicker"><span class="aud-visual-kicker-dot" aria-hidden="true"></span>Marketing</div>' +
              '<h1 class="aud-visual-title">Sponsors.</h1>' +
              '<p class="aud-visual-copy">Track your programme ads, sponsor packages, and business partnerships all in one place.</p>' +
            '</div>' +
            '<div class="aud-visual-total">' +
              '<div class="aud-visual-total-kicker">Businesses</div>' +
              '<div class="aud-visual-total-value" id="spn-hero-biz-count">--</div>' +
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
          '<div class="spn-settings-section">' +
            '<div class="spn-settings-section-title">Programme Ad Sizes</div>' +
            '<div class="spn-settings-section-desc">These sizes appear on your ad booking sheet. Dims are height x width (printing convention), on an 8.5x11 sheet folded in half.</div>' +
            '<div id="spn-adsize-list"></div>' +
          '</div>' +
          '<div class="spn-settings-section">' +
            '<div class="spn-settings-section-title">Sponsor Tiers</div>' +
            '<div class="spn-settings-section-desc">Tiers are used when adding sponsor packages. Add any tiers your production offers.</div>' +
            '<div id="spn-tier-list"></div>' +
          '</div>' +
          '<div class="spn-settings-section">' +
            '<div class="spn-settings-section-title">Deadlines</div>' +
            '<div class="spn-settings-section-desc">Set the key dates for your ad and sponsorship campaign. These are for your reference only.</div>' +
            '<div class="spn-settings-tile-grid">' +
              deadlineTile('Sponsors', 'Artwork Submission Deadline', 'spn-deadline-artwork') +
              deadlineTile('Sponsors', 'Ad Booking Deadline', 'spn-deadline-booking') +
              deadlineTile('Sponsors', 'Sponsor Confirmation Deadline', 'spn-deadline-sponsor') +
            '</div>' +
            '<button class="spn-btn spn-btn--primary" onclick="MarketingSponsorsModule.saveSettings()">Save Settings</button>' +
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

      refreshAdsGrouped();
      switchTab('overview');
    },

    destroy: function () {
      SpnsState.prodId       = null;
      SpnsState.businesses   = [];
      SpnsState.ads          = [];
      SpnsState.packages     = [];
      SpnsState.deliverables = [];
      SpnsState.loaded       = {};
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
    addTier:         addTier,
    editTier:        editTier,
    deleteTier:      deleteTier,
    saveSettings:    saveSettings,
  };
})();
