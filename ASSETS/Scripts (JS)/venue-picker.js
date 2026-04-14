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
 *   - Small checkbox + label sits below the dropdown.
 *   - Auto-checked when currentText is blank or "TBD".
 *   - When checked: dropdown is disabled and greyed out, value is "TBD".
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
    const { data } = await _sb.from('venues')
      .select('id, name, nickname, address, lat, lng')
      .eq('org_id', _orgId)
      .order('name', { ascending: true });
    _venues = data || [];
    document.querySelectorAll('[data-venue-picker]').forEach(el => {
      const id      = el.dataset.venuePicker;
      const current = el.dataset.venueCurrentText || '';
      _rebuildSelect(id, current);
    });
  }

  function render(containerId, currentText, onChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const isTbd = !currentText || currentText.trim().toLowerCase() === 'tbd';

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
          width: 14px; height: 14px; accent-color: #572e88; cursor: pointer; flex-shrink: 0;
        }
        .vp-tbd-row label {
          font-size: 0.75rem; font-weight: 700; color: #9a90b0;
          text-transform: uppercase; letter-spacing: 0.06em; cursor: pointer;
          user-select: none;
        }
        .vp-tbd-row input[type="checkbox"]:checked + label { color: #572e88; }
        .vp-picker-disabled { opacity: 0.45; pointer-events: none; }
      `;
      document.head.appendChild(style);
    }

    container.innerHTML = `
      <div data-venue-picker="${containerId}"
           data-venue-current-text="${(currentText || '').replace(/"/g, '&quot;')}"
           data-venue-onchange="__vp_cb_${containerId}">

        <div id="vp-picker-${containerId}"${isTbd ? ' class="vp-picker-disabled"' : ''}>
          <div class="venue-picker-row">
            <select class="form-select venue-picker-select" id="vp-select-${containerId}">
              <option value="">Select a venue...</option>
              ${_venues.map(v => { const lbl = v.nickname || v.name; return `<option value="${v.id}" data-name="${lbl.replace(/"/g, '&quot;')}" ${!isTbd && (currentText === lbl || currentText === v.name) ? 'selected' : ''}>${lbl}${v.address ? ' — ' + v.address : ''}</option>`; }).join('')}
              <option value="__new__">+ Add new venue...</option>
            </select>
          </div>
          <div class="venue-picker-new-wrap" id="vp-new-${containerId}" style="display:none;">
            <div style="font-size:0.72rem;font-weight:700;color:#9a90b0;text-transform:uppercase;letter-spacing:0.05em;margin:0.6rem 0 0.3rem;">Search for venue or address</div>
            <div style="position:relative;">
              <input class="form-input" id="vp-search-${containerId}" type="text"
                     placeholder="Start typing a name or address..." autocomplete="off" />
              <div id="vp-dropdown-${containerId}" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:9999;background:#fff;border:1.5px solid rgba(87,46,136,0.2);border-top:none;border-radius:0 0 8px 8px;box-shadow:0 6px 18px rgba(0,0,0,0.1);max-height:220px;overflow-y:auto;"></div>
            </div>
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

        <div class="vp-tbd-row">
          <input type="checkbox" id="vp-tbd-${containerId}" ${isTbd ? 'checked' : ''}
                 onchange="VenuePicker._toggleTbd('${containerId}')" />
          <label for="vp-tbd-${containerId}">TBD</label>
        </div>

      </div>`;

    window[`__vp_cb_${containerId}`] = onChange;

    if (isTbd && typeof onChange === 'function') {
      onChange('TBD', null);
    }

    const select = document.getElementById(`vp-select-${containerId}`);
    select.addEventListener('change', () => {
      const val = select.value;
      if (val === '__new__') {
        document.getElementById(`vp-new-${containerId}`).style.display = 'block';
        _initSearch(containerId);
        select.value = '';
      } else if (val) {
        const opt  = select.options[select.selectedIndex];
        const name = opt.dataset.name || opt.textContent.split(' — ')[0];
        document.getElementById(`vp-new-${containerId}`).style.display = 'none';
        _setTbd(containerId, false);
        if (typeof onChange === 'function') onChange(name, val);
      } else {
        if (typeof onChange === 'function') onChange('', null);
      }
    });
  }

  function _toggleTbd(containerId) {
    const cb = document.getElementById(`vp-tbd-${containerId}`);
    if (!cb) return;
    if (cb.checked) {
      _setTbd(containerId, true);
      const select = document.getElementById(`vp-select-${containerId}`);
      if (select) select.value = '';
      _cancelNew(containerId);
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

  function _rebuildSelect(id, currentText) {
    const select = document.getElementById(`vp-select-${id}`);
    if (!select) return;
    const existing = select.value;
    select.innerHTML = `
      <option value="">Select a venue...</option>
      ${_venues.map(v => { const lbl = v.nickname || v.name; return `<option value="${v.id}" data-name="${lbl.replace(/"/g, '&quot;')}" ${currentText === lbl || currentText === v.name ? 'selected' : ''}>${lbl}${v.address ? ' — ' + v.address : ''}</option>`; }).join('')}
      <option value="__new__">+ Add new venue...</option>`;
    if (existing && existing !== '__new__') {
      const match = _venues.find(v => v.id === existing);
      if (match) select.value = existing;
    }
  }

  function _initSearch(pickerId) {
    const input    = document.getElementById(`vp-search-${pickerId}`);
    const dropdown = document.getElementById(`vp-dropdown-${pickerId}`);
    if (!input || input._vpWired) return;
    input._vpWired = true;

    input.addEventListener('input', () => {
      clearTimeout(_debounceTimers[pickerId]);
      const q = input.value.trim();
      if (q.length < 2) { dropdown.style.display = 'none'; return; }
      _debounceTimers[pickerId] = setTimeout(() => _fetchSuggestions(pickerId, q), 350);
    });

    document.addEventListener('click', e => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    }, { once: false });
  }

  async function _fetchSuggestions(pickerId, query) {
    const dropdown = document.getElementById(`vp-dropdown-${pickerId}`);
    if (!dropdown) return;
    dropdown.innerHTML = '<div style="padding:0.5rem 0.75rem;font-size:0.8rem;color:#9a90b0;">Searching...</div>';
    dropdown.style.display = 'block';

    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6`;
      const res  = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'BuildTheShow/1.0' } });
      const data = await res.json();

      if (!data || !data.length) {
        dropdown.innerHTML = '<div style="padding:0.5rem 0.75rem;font-size:0.8rem;color:#9a90b0;">No results found.</div>';
        return;
      }

      dropdown.innerHTML = data.map((r, i) => {
        const name    = r.name || r.address?.amenity || r.address?.building || r.display_name.split(',')[0];
        const address = r.display_name;
        return `<div class="vp-suggestion" data-idx="${i}"
                     style="padding:0.55rem 0.85rem;cursor:pointer;border-bottom:1px solid rgba(87,46,136,0.06);font-size:0.84rem;transition:background 0.12s;"
                     onmouseover="this.style.background='rgba(87,46,136,0.05)'"
                     onmouseout="this.style.background=''"
                     onclick="VenuePicker._selectSuggestion('${pickerId}', ${JSON.stringify({ name, address, lat: r.lat, lng: r.lon, place_id: String(r.place_id) }).replace(/"/g, '&quot;')})">
                  <div style="font-weight:600;color:#1a1530;">${_esc(name)}</div>
                  <div style="font-size:0.72rem;color:#9a90b0;margin-top:0.1rem;">${_esc(address)}</div>
                </div>`;
      }).join('');
    } catch {
      dropdown.innerHTML = '<div style="padding:0.5rem 0.75rem;font-size:0.8rem;color:#dc2626;">Search failed. Check your connection.</div>';
    }
  }

  function _selectSuggestion(pickerId, dataStr) {
    const input    = document.getElementById(`vp-search-${pickerId}`);
    const dropdown = document.getElementById(`vp-dropdown-${pickerId}`);
    const d = typeof dataStr === 'string' ? JSON.parse(dataStr.replace(/&quot;/g, '"')) : dataStr;
    if (!input) return;
    input._placeData = d;
    input.value      = d.name;
    if (dropdown) dropdown.style.display = 'none';
    const nameEl = document.getElementById(`vp-pname-${pickerId}`);
    const addrEl = document.getElementById(`vp-paddress-${pickerId}`);
    if (nameEl) nameEl.textContent = d.name;
    if (addrEl) addrEl.textContent = d.address;
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
    const select = document.getElementById(`vp-select-${pickerId}`);
    if (select) select.value = data.id;
    _cancelNew(pickerId);
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
    if (input) { input.value = ''; input._placeData = null; }
  }

  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  window.VenuePicker = { init, reload, render, _toggleTbd, _setTbd, _saveNew, _cancelNew, _selectSuggestion };

})();
