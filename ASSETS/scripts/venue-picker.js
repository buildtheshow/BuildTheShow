/**
 * venue-picker.js
 * Shared venue picker — uses OpenStreetMap/Nominatim (free, no API key).
 *
 * Usage:
 *   VenuePicker.init(sb, orgId);
 *   VenuePicker.render('container-id', currentText, onChange);
 *   // onChange(venueText, venueId|null) called when a venue is chosen
 *
 * TBD behaviour:
 *   - Small checkbox + label sits below the search field.
 *   - Auto-checked when currentText is blank or "TBD".
 *   - When checked: search is disabled and greyed out, value is "TBD".
 *   - Picking a real venue unchecks TBD automatically.
 *   - Checking TBD while a venue is set clears the selection.
 */
(function () {

  let _sb     = null;
  let _orgId  = null;
  let _venues = [];
  let _debounceTimers = {};

  async function init(sb, orgId) {
    _sb    = sb;
    _orgId = orgId;
    await reload();
  }

  async function reload() {
    if (!_sb || !_orgId) return;
    const { data } = await _sb.from('bts_visible_venues')
      .select('id, name, nickname, address, lat, lng')
      .eq('org_id', _orgId)
      .order('name', { ascending: true });
    _venues = data || [];
    document.querySelectorAll('[data-venue-picker]').forEach(el => {
      const id = el.dataset.venuePicker;
      const input = document.getElementById(`vp-search-${id}`);
      if (input && document.activeElement !== input) input.value = el.dataset.venueCurrentText || '';
      if (input && document.activeElement === input) _showResults(id, input.value);
    });
  }

  function render(containerId, currentText, onChange, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const isTbd = !options.hideTbd && (!currentText || currentText.trim().toLowerCase() === 'tbd');
    const showAddressInSavedOptions = options.showAddressInSavedOptions !== false;

    // Inject styles once
    if (!document.getElementById('vp-tbd-style')) {
      const style = document.createElement('style');
      style.id = 'vp-tbd-style';
      style.textContent = `
        .vp-tbd-row {
          display: flex; align-items: center; gap: 0.4rem;
          margin-top: 0.45rem;
        }
        .vp-tbd-row input[type="checkbox"] {
          width: 14px; height: 14px; accent-color: var(--ap-accent, #572e88); cursor: pointer; flex-shrink: 0;
        }
        .vp-tbd-row label {
          font-size: 0.75rem; font-weight: 700; color: #000;
          text-transform: uppercase; letter-spacing: 0.06em; cursor: pointer;
          user-select: none;
        }
        .vp-tbd-row input[type="checkbox"]:checked + label { color: var(--ap-accent, #572e88); }
        .vp-picker-disabled { opacity: 0.45; pointer-events: none; }
        .vp-search-wrap { position: relative; }
        .vp-search-dropdown { display:none; position:absolute; top:100%; left:0; right:0; z-index:9999; background:#fff; border:1px solid #cfc8dc; border-radius:0 0 10px 10px; box-shadow:0 8px 22px rgba(35,20,50,.16); max-height:280px; overflow-y:auto; }
        .vp-result-heading { padding:.55rem .8rem .3rem; color:#76668a; font-size:.7rem; font-weight:800; letter-spacing:.06em; text-transform:uppercase; }
        .vp-result { padding:.55rem .8rem; cursor:pointer; border-top:1px solid #eeeaf3; }
        .vp-result:hover,.vp-result:focus { background:#f4f0f8; outline:none; }
        .vp-result-name { font-weight:700; }
        .vp-result-address { margin-top:.12rem; font-size:.78em; opacity:.75; }
        .vp-search-status { padding:.65rem .8rem; font-size:.82em; color:#76668a; }
      `;
      document.head.appendChild(style);
    }

    container.innerHTML = `
      <div data-venue-picker="${containerId}"
           data-venue-current-text="${_esc(currentText || '')}"
           data-show-saved-venue-address="${showAddressInSavedOptions}"
           data-venue-onchange="__vp_cb_${containerId}">

        <div id="vp-picker-${containerId}"${isTbd ? ' class="vp-picker-disabled"' : ''}>
          <div class="vp-search-wrap">
              <input class="form-input" id="vp-search-${containerId}" type="text"
                     value="${_esc(isTbd ? '' : currentText || '')}"
                     placeholder="Search saved venues or type a venue or address..." autocomplete="off" />
              <div class="vp-search-dropdown" id="vp-dropdown-${containerId}"></div>
          </div>
          <div class="venue-picker-new-wrap" id="vp-new-${containerId}" style="display:none;">
            <div id="vp-preview-${containerId}" style="display:none;margin-top:0.5rem;">
              <div class="venue-picker-preview">
                <div>
                  <div class="venue-picker-preview-name" id="vp-pname-${containerId}"></div>
                  <div class="venue-picker-preview-addr" id="vp-paddress-${containerId}"></div>
                </div>
                <div style="display:flex;gap:0.4rem;flex-shrink:0;">
                  <button class="btn-primary" style="font-size:0.78rem;padding:0.35rem 0.75rem;"
                          onclick="VenuePicker._saveNew('${containerId}')">Save &amp; Select</button>
                  <button class="btn--secondary" style="font-size:0.78rem;padding:0.35rem 0.75rem;"
                          onclick="VenuePicker._cancelNew('${containerId}')">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        ${options.hideTbd ? '' : `<div class="vp-tbd-row">
          <input type="checkbox" id="vp-tbd-${containerId}" ${isTbd ? 'checked' : ''}
                 onchange="VenuePicker._toggleTbd('${containerId}')" />
          <label for="vp-tbd-${containerId}">TBD</label>
        </div>`}

      </div>`;

    window[`__vp_cb_${containerId}`] = onChange;

    if (isTbd && typeof onChange === 'function') {
      onChange('TBD', null);
    }

    _initSearch(containerId);
    const input = document.getElementById(`vp-search-${containerId}`);
    input.dataset.currentText = isTbd ? '' : (currentText || '');
    input.addEventListener('focus', () => _showResults(containerId, input.value));
    if (options.searchImmediately) input.focus();
  }

  function _toggleTbd(containerId) {
    const cb = document.getElementById(`vp-tbd-${containerId}`);
    if (!cb) return;
    if (cb.checked) {
      _setTbd(containerId, true);
      const input = document.getElementById(`vp-search-${containerId}`);
      if (input) input.value = '';
      _cancelNew(containerId);
      if (input) { input.value = ''; input.dataset.currentText = ''; }
      const onChange = window[`__vp_cb_${containerId}`];
      if (typeof onChange === 'function') onChange('TBD', null);
    } else {
      _setTbd(containerId, false);
      const onChange = window[`__vp_cb_${containerId}`];
      if (typeof onChange === 'function') onChange('', null);
    }
  }

  function _setTbd(containerId, active) {
    const cb     = document.getElementById(`vp-tbd-${containerId}`);
    const picker = document.getElementById(`vp-picker-${containerId}`);
    if (cb) cb.checked = active;
    if (picker) picker.classList.toggle('vp-picker-disabled', active);
  }

  function _initSearch(pickerId) {
    const input    = document.getElementById(`vp-search-${pickerId}`);
    const dropdown = document.getElementById(`vp-dropdown-${pickerId}`);
    if (!input || input._vpWired) return;
    input._vpWired = true;

    input.addEventListener('input', () => {
      clearTimeout(_debounceTimers[pickerId]);
      const q = input.value.trim();
      const selected = _venues.find(v => v.id === input._selectedVenueId);
      if (selected && q !== (selected.nickname || selected.name)) input._selectedVenueId = null;
      input._externalResults = [];
      input._placeSearchDone = false;
      _showResults(pickerId, q);
      if (q.length >= 2) _debounceTimers[pickerId] = setTimeout(() => _fetchSuggestions(pickerId, q), 350);
    });

    document.addEventListener('click', e => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    }, { once: false });
  }

  function _showResults(pickerId, query = '') {
    const dropdown = document.getElementById(`vp-dropdown-${pickerId}`);
    const input = document.getElementById(`vp-search-${pickerId}`);
    if (!dropdown || !input) return;
    const q = String(query || '').trim().toLowerCase();
    const saved = _venues.filter(v => [v.nickname, v.name, v.address].some(value => String(value || '').toLowerCase().includes(q)));
    let html = '';
    if (saved.length) html += `<div class="vp-result-heading">Saved venues</div>` + saved.map(v => `<div class="vp-result" tabindex="0" data-saved-id="${_esc(v.id)}"><div class="vp-result-name">${_esc(v.nickname || v.name)}</div>${v.address ? `<div class="vp-result-address">${_esc(v.address)}</div>` : ''}</div>`).join('');
    const external = input._externalResults || [];
    if (external.length) html += `<div class="vp-result-heading">Search places</div>` + external.map((place, i) => `<div class="vp-result" tabindex="0" data-place-index="${i}"><div class="vp-result-name">${_esc(place.name)}</div><div class="vp-result-address">${_esc(place.address)}</div></div>`).join('');
    if (!html) html = `<div class="vp-search-status">${q.length < 2 ? 'Start typing to search saved venues and places.' : input._placeSearchDone ? 'No places found. Try another search.' : 'Searching for places…'}</div>`;
    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
    dropdown.querySelectorAll('[data-saved-id]').forEach(el => el.addEventListener('click', () => {
      const venue = _venues.find(v => v.id === el.dataset.savedId);
      if (!venue) return;
      input.value = venue.nickname || venue.name;
      input._selectedVenueId = venue.id;
      input.dataset.currentText = input.value;
      const pickerRoot = document.querySelector(`[data-venue-picker="${pickerId}"]`);
      if (pickerRoot) pickerRoot.dataset.venueCurrentText = input.value;
      dropdown.style.display = 'none';
      const wrap = document.getElementById(`vp-new-${pickerId}`);
      if (wrap) wrap.style.display = 'none';
      _setTbd(pickerId, false);
      const cb = window[`__vp_cb_${pickerId}`];
      if (typeof cb === 'function') cb(input.value, venue.id);
    }));
    dropdown.querySelectorAll('[data-place-index]').forEach(el => el.addEventListener('click', () => {
      const place = external[Number(el.dataset.placeIndex)];
      if (place) _selectSuggestion(pickerId, place);
    }));
  }

  async function _fetchSuggestions(pickerId, query) {
    const dropdown = document.getElementById(`vp-dropdown-${pickerId}`);
    if (!dropdown) return;
    _showResults(pickerId, query);
    const status = document.createElement('div');
    status.className = 'vp-search-status'; status.textContent = 'Searching places…'; dropdown.appendChild(status);

    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6`;
      const res  = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'BuildTheShow/1.0' } });
      const data = await res.json();

      const input = document.getElementById(`vp-search-${pickerId}`);
      if (!input || input.value.trim() !== query) return;
      input._externalResults = (data || []).map(r => {
        const name    = r.name || r.address?.amenity || r.address?.building || r.display_name.split(',')[0];
        const address = r.display_name;
        return { name, address, lat: r.lat, lng: r.lon, place_id: String(r.place_id) };
      });
      input._placeSearchDone = true;
      _showResults(pickerId, query);
    } catch {
      const input = document.getElementById(`vp-search-${pickerId}`);
      if (!input || input.value.trim() !== query) return;
      _showResults(pickerId, query);
      const error = document.createElement('div');
      error.className = 'vp-search-status'; error.textContent = 'Place search failed. You can still choose a saved venue.';
      dropdown.appendChild(error);
    }
  }

  function _selectSuggestion(pickerId, dataStr) {
    const input    = document.getElementById(`vp-search-${pickerId}`);
    const dropdown = document.getElementById(`vp-dropdown-${pickerId}`);
    const d = typeof dataStr === 'string' ? JSON.parse(dataStr.replace(/&quot;/g, '"')) : dataStr;
    if (!input) return;
    input._placeData = d;
    input.value      = d.name;
    input._selectedVenueId = null;
    if (dropdown) dropdown.style.display = 'none';
    const nameEl = document.getElementById(`vp-pname-${pickerId}`);
    const addrEl = document.getElementById(`vp-paddress-${pickerId}`);
    if (nameEl) nameEl.textContent = d.name;
    if (addrEl) addrEl.textContent = d.address;
    document.getElementById(`vp-new-${pickerId}`).style.display = 'block';
    document.getElementById(`vp-preview-${pickerId}`).style.display = 'block';
  }

  async function _saveNew(pickerId) {
    const input = document.getElementById(`vp-search-${pickerId}`);
    if (!input || !input._placeData || !_sb || !_orgId) return;
    const d = input._placeData;
    const { data, error } = await _sb.from('venues').insert({
      org_id:   _orgId,
      name:     d.name,
      address:  d.address  || null,
      place_id: d.place_id || null,
      lat:      d.lat      ? parseFloat(d.lat)  : null,
      lng:      d.lng      ? parseFloat(d.lng)  : null,
    }).select().single();
    if (error) { console.error('Venue save error', error); return; }
    await reload();
    const savedInput = document.getElementById(`vp-search-${pickerId}`);
    if (savedInput) { savedInput.value = d.name; savedInput._selectedVenueId = data.id; savedInput.dataset.currentText = d.name; }
    const pickerRoot = document.querySelector(`[data-venue-picker="${pickerId}"]`);
    if (pickerRoot) pickerRoot.dataset.venueCurrentText = d.name;
    const wrap = document.getElementById(`vp-new-${pickerId}`);
    if (wrap) wrap.style.display = 'none';
    const dropdown = document.getElementById(`vp-dropdown-${pickerId}`);
    if (dropdown) dropdown.style.display = 'none';
    const preview = document.getElementById(`vp-preview-${pickerId}`);
    if (preview) preview.style.display = 'none';
    _setTbd(pickerId, false);
    const cb = window[`__vp_cb_${pickerId}`];
    if (typeof cb === 'function') cb(d.name, data.id);
  }

  function _cancelNew(pickerId) {
    const wrap  = document.getElementById(`vp-new-${pickerId}`);
    const prev  = document.getElementById(`vp-preview-${pickerId}`);
    const drop  = document.getElementById(`vp-dropdown-${pickerId}`);
    const input = document.getElementById(`vp-search-${pickerId}`);
    if (wrap)  wrap.style.display  = 'none';
    if (prev)  prev.style.display  = 'none';
    if (drop)  drop.style.display  = 'none';
    if (input) { input.value = input.dataset.currentText || ''; input._placeData = null; }
  }

  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function getVenues() { return _venues; }

  window.VenuePicker = { init, reload, render, getVenues, _toggleTbd, _setTbd, _saveNew, _cancelNew, _selectSuggestion };

})();
