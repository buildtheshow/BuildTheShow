/* ticketing-seatmap.js — Seat Map Builder Module */
'use strict';

window.SeatMapBuilder = (function() {

  let _sb = null, _prodId = '', _container = null;
  let smLayout = null, smStagePos = 'top', smSectionCount = 1;
  let smActiveTool = 'standard', smDrawing = false, smSaveTimer = null;
  let _venueId = null, _layoutId = null;

  const SECTION_COLORS = ['#572e88','#78bbd4','#dd8233','#769e7b','#476aaa','#d1523d','#ca7ea7','#efab45'];
  const SEAT_COLORS = { standard: null, aisle: '#e8e4f0', wheelchair: '#78bbd4', companion: '#476aaa', blocked: '#d1523d', obstructed: '#efab45' };
  const DEFAULT_SECTION_NAMES = {
    1: ['Centre'], 2: ['House Left', 'House Right'], 3: ['House Left', 'Centre', 'House Right'],
    4: ['Far Left', 'Centre Left', 'Centre Right', 'Far Right'], 5: ['Far Left', 'Left', 'Centre', 'Right', 'Far Right'],
  };

  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // ── Init ──
  function init(prodId, supabaseClient, container) {
    _sb = supabaseClient; _prodId = prodId; _container = container;
    loadAndRender();
  }

  async function loadAndRender() {
    await loadLayout();
    render();
  }

  // ── Load from DB ──
  async function loadLayout() {
    try {
      const { data: prodRow } = await _sb.from('productions').select('registration_settings,ticketing_setup').eq('id', _prodId).single();
      const tkt = prodRow?.registration_settings?.ticketing || {};
      const existingLayout = tkt.venue_layout;
      if (existingLayout && existingLayout.sections && existingLayout.sections.length) {
        smLayout = existingLayout;
        smStagePos = existingLayout.stage_position || 'top';
      }
      const setup = prodRow?.ticketing_setup || {};
      _venueId = setup._venue_id || null;
      _layoutId = setup._layout_id || null;
    } catch (e) { console.warn('[BTS] seatmap load error:', e?.message); }
  }

  // ── Save ──
  async function saveLayout() {
    if (!smLayout || !_sb || !_prodId) return;
    try {
      const { data: prodRow } = await _sb.from('productions').select('registration_settings').eq('id', _prodId).single();
      const settings = prodRow?.registration_settings || {};
      if (!settings.ticketing) settings.ticketing = {};
      settings.ticketing.venue_layout = smLayout;
      settings.ticketing.seating_mode = 'reserved';
      await _sb.from('productions').update({ registration_settings: settings }).eq('id', _prodId);
    } catch (e) { console.warn('[BTS] seatmap save error:', e?.message); }

    await saveToNormalizedTables();
  }

  async function saveToNormalizedTables() {
    if (!smLayout || !_sb || !_prodId) return;
    try {
      const { data: prod } = await _sb.from('productions').select('organization_id').eq('id', _prodId).single();
      const orgId = prod?.organization_id;
      if (!orgId) return;

      if (!_venueId) {
        const { data: v } = await _sb.from('venues').insert({ organization_id: orgId, name: smLayout.venue_name || 'Venue', capacity: smLayout.venue_capacity || 0 }).select('id').single();
        _venueId = v?.id;
      } else {
        await _sb.from('venues').update({ name: smLayout.venue_name || 'Venue', capacity: smLayout.venue_capacity || 0 }).eq('id', _venueId);
      }

      if (_layoutId) {
        await _sb.from('venue_seats').delete().eq('layout_id', _layoutId);
        await _sb.from('venue_rows').delete().match({}).in('section_id', (await _sb.from('venue_sections').select('id').eq('layout_id', _layoutId)).data?.map(s => s.id) || []);
        await _sb.from('venue_sections').delete().eq('layout_id', _layoutId);
        await _sb.from('venue_layouts').update({ stage_position: smLayout.stage_position || 'top', layout_data: smLayout }).eq('id', _layoutId);
      } else {
        const { data: l } = await _sb.from('venue_layouts').insert({ venue_id: _venueId, name: smLayout.venue_name || 'Layout', stage_position: smLayout.stage_position || 'top', layout_data: smLayout }).select('id').single();
        _layoutId = l?.id;
      }

      if (!_layoutId) return;

      for (let si = 0; si < smLayout.sections.length; si++) {
        const sec = smLayout.sections[si];
        const { data: secRow } = await _sb.from('venue_sections').insert({ layout_id: _layoutId, name: sec.name, color: sec.color, display_order: si }).select('id').single();
        if (!secRow) continue;
        for (let ri = 0; ri < sec.rows.length; ri++) {
          const row = sec.rows[ri];
          const { data: rowRow } = await _sb.from('venue_rows').insert({ section_id: secRow.id, label: row.label, display_order: ri }).select('id').single();
          if (!rowRow) continue;
          const seatInserts = row.seats.map((seat, sei) => ({
            layout_id: _layoutId, section_id: secRow.id, row_id: rowRow.id,
            label: sec.name + ' ' + row.label + seat.number, seat_number: seat.number,
            seat_type: seat.type, accessible: seat.type === 'wheelchair', companion: seat.type === 'companion',
            visible: seat.type !== 'aisle',
          }));
          if (seatInserts.length) await _sb.from('venue_seats').insert(seatInserts);
        }
      }

      const { data: prodRow } = await _sb.from('productions').select('ticketing_setup').eq('id', _prodId).single();
      const setup = prodRow?.ticketing_setup || {};
      setup._venue_id = _venueId;
      setup._layout_id = _layoutId;
      await _sb.from('productions').update({ ticketing_setup: setup }).eq('id', _prodId);
    } catch (e) { console.warn('[BTS] seatmap normalized save error:', e?.message); }
  }

  function debounceSave() { clearTimeout(smSaveTimer); smSaveTimer = setTimeout(() => saveLayout(), 500); }

  // ── Render ──
  function render() {
    if (!_container) return;
    if (smLayout && smLayout.sections && smLayout.sections.length) {
      renderResult();
    } else {
      renderWizard();
    }
  }

  function renderWizard() {
    smSectionCount = 1;
    const names = DEFAULT_SECTION_NAMES[1];
    _container.innerHTML = `
      <style>${getCSS()}</style>
      <div id="sm-wizard">
        <div style="display:flex;flex-direction:column;gap:1.25rem;max-width:480px;">
          <div>
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.2rem;">
              <span class="sm-step-num">1</span><span class="sm-step-title">Create your venue</span>
            </div>
            <div class="sm-step-desc">Tell us about your space.</div>
            <div style="display:flex;flex-direction:column;gap:0.5rem;">
              <div><label style="font-size:0.72rem;font-weight:800;color:#352756;">Venue Name</label><input id="sm-venue-name" placeholder="e.g. Georges P. Vanier Secondary" style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid rgba(87,46,136,0.18);border-radius:8px;font:inherit;font-size:0.84rem;" /></div>
              <div><label style="font-size:0.72rem;font-weight:800;color:#352756;">Total Seats</label><input id="sm-total-seats" type="number" placeholder="e.g. 300" min="1" style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid rgba(87,46,136,0.18);border-radius:8px;font:inherit;font-size:0.84rem;" /></div>
            </div>
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.2rem;">
              <span class="sm-step-num">2</span><span class="sm-step-title">Describe your layout</span>
            </div>
            <div class="sm-step-desc">Answer a few questions and we will build your venue automatically.</div>
            <div style="margin-bottom:1rem;">
              <label style="font-size:0.72rem;font-weight:800;color:#352756;display:block;margin-bottom:0.3rem;">Where is the stage?</label>
              <div class="sm-stage-btns">
                <button class="sm-stage-btn sm-stage-btn--active" data-pos="top" onclick="SeatMapBuilder.pickStage(this)">Top</button>
                <button class="sm-stage-btn" data-pos="bottom" onclick="SeatMapBuilder.pickStage(this)">Bottom</button>
                <button class="sm-stage-btn" data-pos="left" onclick="SeatMapBuilder.pickStage(this)">Left</button>
                <button class="sm-stage-btn" data-pos="right" onclick="SeatMapBuilder.pickStage(this)">Right</button>
              </div>
            </div>
            <div style="margin-bottom:1rem;">
              <label style="font-size:0.72rem;font-weight:800;color:#352756;display:block;margin-bottom:0.3rem;">How many seating sections?</label>
              <div class="sm-stage-btns">
                ${[1,2,3,4,5].map(n => `<button class="sm-stage-btn ${n===1?'sm-stage-btn--active':''}" data-val="${n}" onclick="SeatMapBuilder.pickSections(this)">${n}</button>`).join('')}
              </div>
            </div>
            <div id="sm-section-config"></div>
          </div>
          <div style="text-align:center;padding:0.5rem 0;">
            <button class="sm-generate-btn" onclick="SeatMapBuilder.autoGenerate()" style="max-width:400px;margin:0 auto">Generate Seat Map</button>
            <p style="font-size:0.72rem;color:#8e82a7;margin:0.5rem 0 0">We will create all your sections, rows, and seats automatically.</p>
          </div>
        </div>
      </div>
      <div id="sm-result" style="display:none"></div>`;
    renderSectionConfig();
  }

  function renderSectionConfig() {
    const names = DEFAULT_SECTION_NAMES[smSectionCount] || DEFAULT_SECTION_NAMES[1];
    let html = '<div class="sm-section-cfg-head"><span>Section Name</span><span>Rows</span></div>';
    for (let i = 0; i < smSectionCount; i++) {
      const defaultRows = smSectionCount === 1 ? 10 : 8;
      html += `<div class="sm-section-cfg-row" style="grid-template-columns:1fr 80px">
        <div><input id="sm-sec-name-${i}" value="${esc(names[i] || 'Section ' + (i+1))}" style="padding:0.4rem 0.5rem;border:1.5px solid #e0dce8;border-radius:6px;font:inherit;font-size:0.78rem;width:100%;" /></div>
        <div><input type="number" id="sm-sec-rows-${i}" min="1" max="30" value="${defaultRows}" style="padding:0.4rem 0.5rem;border:1.5px solid #e0dce8;border-radius:6px;font:inherit;font-size:0.78rem;width:100%;text-align:center;" /></div>
      </div>`;
    }
    const el = document.getElementById('sm-section-config');
    if (el) el.innerHTML = html;
  }

  function pickStage(btn) {
    smStagePos = btn.dataset.pos;
    btn.parentNode.querySelectorAll('.sm-stage-btn').forEach(b => b.classList.remove('sm-stage-btn--active'));
    btn.classList.add('sm-stage-btn--active');
  }

  function pickSections(btn) {
    smSectionCount = parseInt(btn.dataset.val);
    btn.parentNode.querySelectorAll('.sm-stage-btn').forEach(b => b.classList.remove('sm-stage-btn--active'));
    btn.classList.add('sm-stage-btn--active');
    renderSectionConfig();
  }

  function autoGenerate() {
    const venueName = document.getElementById('sm-venue-name')?.value?.trim() || '';
    const totalSeatsTarget = parseInt(document.getElementById('sm-total-seats')?.value) || 0;
    if (!venueName) { alert('Please enter a venue name.'); return; }
    if (!totalSeatsTarget) { alert('Please set the total number of seats.'); return; }

    const sectionDefs = [];
    let totalRows = 0;
    for (let i = 0; i < smSectionCount; i++) {
      const name = document.getElementById('sm-sec-name-' + i)?.value?.trim() || 'Section ' + (i+1);
      const rows = parseInt(document.getElementById('sm-sec-rows-' + i)?.value) || 8;
      sectionDefs.push({ name, rows });
      totalRows += rows;
    }

    const sections = [];
    for (let i = 0; i < sectionDefs.length; i++) {
      const def = sectionDefs[i];
      const sectionShare = def.rows / totalRows;
      const sectionSeats = Math.round(totalSeatsTarget * sectionShare);
      const seatsPerRow = Math.max(1, Math.round(sectionSeats / def.rows));
      const sec = { id: crypto.randomUUID(), name: def.name, color: SECTION_COLORS[i % SECTION_COLORS.length], rows: [] };
      for (let r = 0; r < def.rows; r++) {
        const seats = [];
        for (let s = 0; s < seatsPerRow; s++) seats.push({ id: crypto.randomUUID(), number: s + 1, type: 'standard' });
        sec.rows.push({ id: crypto.randomUUID(), label: String.fromCharCode(65 + r), seats });
      }
      sections.push(sec);
    }

    smLayout = { venue_name: venueName, venue_capacity: totalSeatsTarget, stage_position: smStagePos, sections };
    renderResult();
    saveLayout();
  }

  function renderResult() {
    if (!smLayout) return;
    const wizard = document.getElementById('sm-wizard');
    const result = document.getElementById('sm-result');
    if (wizard) wizard.style.display = 'none';
    if (!result) return;
    result.style.display = '';

    let totalSeats = 0;
    smLayout.sections.forEach(sec => sec.rows.forEach(row => row.seats.forEach(seat => { if (seat.type !== 'aisle' && seat.type !== 'blocked') totalSeats++; })));
    const cap = smLayout.venue_capacity || 0;
    const diff = cap - totalSeats;
    const isOver = totalSeats > cap;

    const containerW = _container ? _container.clientWidth - 100 : 800;
    let maxSeatsInRow = 0;
    smLayout.sections.forEach(sec => sec.rows.forEach(row => { maxSeatsInRow = Math.max(maxSeatsInRow, row.seats.length); }));
    const SEAT_IN = 18, SEAT_GAP_IN = 2, STAGE_IN = 35 * 12, ROW_DEPTH_IN = 36;
    const seatingWidthIn = maxSeatsInRow * (SEAT_IN + SEAT_GAP_IN);
    const totalWidthIn = Math.max(STAGE_IN, seatingWidthIn);
    const X = Math.min(1.5, containerW / totalWidthIn);
    const SEAT_PX = Math.round(SEAT_IN * X);
    const SEAT_GAP = Math.max(1, Math.round(SEAT_GAP_IN * X));
    const SECTION_GAP = Math.max(4, Math.round(24 * X));
    const ROW_GAP = Math.max(2, Math.round(ROW_DEPTH_IN * X) - SEAT_PX);
    const stageWidthPx = Math.round(STAGE_IN * X);

    let mapHtml = `<div class="sm-stage" style="width:${stageWidthPx}px">STAGE</div>`;
    mapHtml += `<div class="sm-floor" style="gap:${SECTION_GAP}px">`;

    smLayout.sections.forEach((sec, si) => {
      const firstRow = sec.rows[0];
      let numRow = `<div class="sm-row-line"><span class="sm-row-label"></span><div class="sm-seats" style="gap:${SEAT_GAP}px">`;
      if (firstRow) {
        let seatNum = 0;
        firstRow.seats.forEach(seat => {
          if (seat.type === 'aisle') numRow += `<span class="sm-seat-num" style="width:${SEAT_PX}px"></span>`;
          else { seatNum++; numRow += `<span class="sm-seat-num" style="width:${SEAT_PX}px">${seatNum}</span>`; }
        });
      }
      numRow += '</div><span class="sm-row-label"></span></div>';

      mapHtml += '<div class="sm-section-block">';
      mapHtml += `<div class="sm-section-label">${esc(sec.name).toUpperCase()}</div>`;
      mapHtml += numRow;
      sec.rows.forEach((row, ri) => {
        mapHtml += `<div class="sm-row-line" style="margin-bottom:${ROW_GAP}px">`;
        mapHtml += `<span class="sm-row-label">${esc(row.label)}</span>`;
        mapHtml += `<div class="sm-seats" style="gap:${SEAT_GAP}px">`;
        row.seats.forEach((seat, sei) => {
          const color = SEAT_COLORS[seat.type] || sec.color;
          const title = `${esc(sec.name)} ${row.label}${seat.number}${seat.type !== 'standard' ? ' (' + seat.type + ')' : ''}`;
          mapHtml += `<div class="sm-seat" style="background:${color};width:${SEAT_PX}px;height:${SEAT_PX}px" title="${title}" onclick="SeatMapBuilder.clickSeat(${si},${ri},${sei},this);event.preventDefault()" onmousedown="SeatMapBuilder.startDraw()" onmouseover="if(SeatMapBuilder.isDrawing())SeatMapBuilder.clickSeat(${si},${ri},${sei},this)"></div>`;
        });
        mapHtml += '</div>';
        mapHtml += `<span class="sm-row-label">${esc(row.label)}</span></div>`;
      });
      mapHtml += numRow + '</div>';
    });
    mapHtml += '</div>';

    const legendHtml = smLayout.sections.map(sec => `<div class="sm-legend-item"><span class="sm-legend-dot" style="background:${sec.color}"></span>${esc(sec.name)}</div>`).join('') +
      '<div class="sm-legend-item"><span class="sm-legend-dot" style="background:#78bbd4"></span>Wheelchair</div>' +
      '<div class="sm-legend-item"><span class="sm-legend-dot" style="background:#476aaa"></span>Companion</div>' +
      '<div class="sm-legend-item"><span class="sm-legend-dot" style="background:#d1523d"></span>Blocked</div>' +
      '<div class="sm-legend-item"><span class="sm-legend-dot" style="background:#efab45"></span>Obstructed</div>' +
      '<div class="sm-legend-item"><span class="sm-legend-dot" style="background:#e8e4f0"></span>Aisle</div>';

    const adjustHtml = smLayout.sections.map((sec, si) => {
      const rowCount = sec.rows.length;
      const seatsPerRow = sec.rows.length ? sec.rows[0].seats.length : 0;
      return `<div class="sm-adj"><span class="sm-adj-dot" style="background:${sec.color}"></span><span class="sm-adj-name">${esc(sec.name)}</span>` +
        `<span class="sm-adj-lbl">Rows</span><input type="number" min="1" max="30" value="${rowCount}" onchange="SeatMapBuilder.adjustSection(${si},parseInt(this.value)||1,null)" />` +
        `<span class="sm-adj-lbl">Seats/Row</span><input type="number" min="1" max="50" value="${seatsPerRow}" onchange="SeatMapBuilder.adjustSection(${si},null,parseInt(this.value)||1)" /></div>`;
    }).join('');

    result.innerHTML = `
      <div class="sm-capacity-bar ${isOver ? 'sm-capacity-bar--over' : 'sm-capacity-bar--ok'}" id="sm-capacity-bar">
        <div class="sm-cap-item"><span class="sm-cap-label">Maximum Capacity</span><span class="sm-cap-val">${cap}</span></div>
        <div class="sm-cap-item"><span class="sm-cap-label">Mapped Seats</span><span class="sm-cap-val">${totalSeats}</span></div>
        <div class="sm-cap-item"><span class="sm-cap-label">${isOver ? 'Over Capacity' : 'Remaining'}</span><span class="sm-cap-val">${Math.abs(diff)}</span></div>
      </div>
      <div class="sm-edit-area">
        <div class="sm-toolpanel">
          <button class="sm-tool sm-tool--active" data-tool="standard" onclick="SeatMapBuilder.setTool(this)"><span class="sm-tool-icon-wrap" style="background:#572e88"><img src="/ASSETS/Images/Icons/seats.svg" class="sm-tool-icon" /></span><span class="sm-tool-lbl">Seat</span></button>
          <button class="sm-tool" data-tool="aisle" onclick="SeatMapBuilder.setTool(this)"><span class="sm-tool-icon-wrap" style="background:#b0a8c8"><img src="/ASSETS/Images/Icons/isle.svg" class="sm-tool-icon" /></span><span class="sm-tool-lbl">Aisle</span></button>
          <div class="sm-toolpanel-divider"></div>
          <button class="sm-tool" data-tool="wheelchair" onclick="SeatMapBuilder.setTool(this)"><span class="sm-tool-icon-wrap" style="background:#78bbd4"><img src="/ASSETS/Images/Icons/accessible.svg" class="sm-tool-icon" /></span><span class="sm-tool-lbl">Accessible</span></button>
          <button class="sm-tool" data-tool="companion" onclick="SeatMapBuilder.setTool(this)"><span class="sm-tool-icon-wrap" style="background:#476aaa"><img src="/ASSETS/Images/Icons/companion.svg" class="sm-tool-icon" /></span><span class="sm-tool-lbl">Companion</span></button>
          <div class="sm-toolpanel-divider"></div>
          <button class="sm-tool" data-tool="blocked" onclick="SeatMapBuilder.setTool(this)"><span class="sm-tool-icon-wrap" style="background:#d1523d"><img src="/ASSETS/Images/Icons/informationseat.svg" class="sm-tool-icon" /></span><span class="sm-tool-lbl">Blocked</span></button>
          <button class="sm-tool" data-tool="obstructed" onclick="SeatMapBuilder.setTool(this)"><span class="sm-tool-icon-wrap" style="background:#efab45"><img src="/ASSETS/Images/Icons/visionobstructed.svg" class="sm-tool-icon" /></span><span class="sm-tool-lbl">Obstructed</span></button>
        </div>
        <div class="sm-preview" style="flex:1">
          <div class="sm-preview-head">
            <div>
              <div class="sm-preview-title">${esc(smLayout.venue_name || 'Seat Map')}</div>
              <div class="sm-preview-subtitle">Click or drag to paint seats. Changes save automatically.</div>
            </div>
            <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
              <div id="sm-adjust" style="display:flex;gap:0.75rem;flex-wrap:wrap">${adjustHtml}</div>
              <button class="sm-generate-btn" style="padding:0.45rem 0.85rem;font-size:0.78rem;" onclick="SeatMapBuilder.showWizard()">Rebuild</button>
            </div>
          </div>
          <div class="sm-map-wrap"><div id="sm-map">${mapHtml}</div></div>
          <div class="sm-legend" id="sm-legend">${legendHtml}</div>
        </div>
      </div>`;
  }

  // ── Seat editing ──
  function setTool(btn) {
    smActiveTool = btn.dataset.tool;
    document.querySelectorAll('.sm-toolpanel .sm-tool').forEach(t => t.classList.remove('sm-tool--active'));
    btn.classList.add('sm-tool--active');
  }

  function startDraw() { smDrawing = true; }
  function isDrawing() { return smDrawing; }

  function clickSeat(secIdx, rowIdx, seatIdx, el) {
    if (!smLayout) return;
    const sec = smLayout.sections[secIdx];
    if (!sec || !sec.rows[rowIdx] || !sec.rows[rowIdx].seats[seatIdx]) return;
    const seat = sec.rows[rowIdx].seats[seatIdx];
    const wasSellable = seat.type !== 'aisle';
    seat.type = smActiveTool;

    if (wasSellable && smActiveTool === 'aisle') {
      sec.rows[rowIdx].seats.push({ id: crypto.randomUUID(), number: sec.rows[rowIdx].seats.length + 1, type: 'standard' });
      renderResult(); debounceSave(); return;
    }
    if (!wasSellable && smActiveTool !== 'aisle') {
      const row = sec.rows[rowIdx];
      for (let i = row.seats.length - 1; i >= 0; i--) {
        if (row.seats[i].type === 'standard' && i !== seatIdx) { row.seats.splice(i, 1); break; }
      }
      renderResult(); debounceSave(); return;
    }

    const color = SEAT_COLORS[seat.type] || sec.color;
    el.style.backgroundColor = color;
    debounceSave();
  }

  function adjustSection(secIdx, newRows, newSeatsPerRow) {
    const sec = smLayout.sections[secIdx];
    if (!sec) return;
    const rows = newRows !== null ? newRows : sec.rows.length;
    const spr = newSeatsPerRow !== null ? newSeatsPerRow : (sec.rows.length ? sec.rows[0].seats.length : 10);

    while (sec.rows.length > rows) sec.rows.pop();
    while (sec.rows.length < rows) {
      const seats = [];
      for (let s = 0; s < spr; s++) seats.push({ id: crypto.randomUUID(), number: s + 1, type: 'standard' });
      sec.rows.push({ id: crypto.randomUUID(), label: String.fromCharCode(65 + sec.rows.length), seats });
    }
    sec.rows.forEach(row => {
      while (row.seats.length > spr) row.seats.pop();
      while (row.seats.length < spr) row.seats.push({ id: crypto.randomUUID(), number: row.seats.length + 1, type: 'standard' });
    });
    renderResult(); saveLayout();
  }

  function showWizard() {
    document.getElementById('sm-wizard').style.display = '';
    document.getElementById('sm-result').style.display = 'none';
    renderSectionConfig();
  }

  // ── CSS ──
  function getCSS() {
    return `
    .sm-step-num { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: #572e88; color: #fff; font-size: 0.68rem; font-weight: 900; flex-shrink: 0; }
    .sm-step-title { font-size: 0.88rem; font-weight: 900; color: #1a1530; }
    .sm-step-desc { font-size: 0.72rem; color: #8e82a7; margin: 0.15rem 0 0.6rem; }
    .sm-stage-btns { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .sm-stage-btn { padding: 0.45rem 0.85rem; border: 1.5px solid #e0dce8; border-radius: 8px; background: #fff; color: #3a3050; font: inherit; font-size: 0.78rem; font-weight: 800; cursor: pointer; }
    .sm-stage-btn:hover { border-color: #b5a8d8; }
    .sm-stage-btn--active { border-color: #572e88; background: #572e88; color: #fff; }
    .sm-section-cfg-head { display: grid; grid-template-columns: 1fr 80px; gap: 0.65rem; font-size: 0.58rem; font-weight: 900; color: #8e82a7; text-transform: uppercase; letter-spacing: 0.08em; padding-bottom: 0.3rem; border-bottom: 1.5px solid #eceaf3; margin-bottom: 0.15rem; }
    .sm-section-cfg-row { display: grid; grid-template-columns: 1fr 80px; gap: 0.65rem; align-items: end; padding: 0.5rem 0; border-bottom: 1px solid #f5f3fa; }
    .sm-generate-btn { width: 100%; padding: 0.85rem; border: none; border-radius: 10px; background: #572e88; color: #fff; font: inherit; font-size: 0.88rem; font-weight: 950; cursor: pointer; }
    .sm-generate-btn:hover { background: #6b3ba6; }
    .sm-capacity-bar { display: flex; align-items: center; gap: 1.25rem; font-size: 0.72rem; font-weight: 800; margin-bottom: 1rem; }
    .sm-capacity-bar--ok { color: #769e7b; } .sm-capacity-bar--over { color: #d1523d; }
    .sm-cap-item { display: flex; flex-direction: column; gap: 0.1rem; }
    .sm-cap-label { font-size: 0.6rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.7; }
    .sm-edit-area { display: flex; gap: 0; }
    .sm-toolpanel { display: flex; flex-direction: column; gap: 2px; padding: 8px 4px; background: #1a1530; border-radius: 10px 0 0 10px; flex-shrink: 0; width: 64px; }
    .sm-tool { width: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 6px 2px; border: none; border-radius: 6px; background: transparent; cursor: pointer; }
    .sm-tool:hover { background: rgba(255,255,255,0.1); }
    .sm-tool.sm-tool--active { background: rgba(255,255,255,0.18); }
    .sm-tool-icon-wrap { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
    .sm-tool-icon { width: 22px; height: 22px; filter: brightness(0) invert(1); }
    .sm-tool-lbl { font-size: 0.44rem; font-weight: 800; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.04em; }
    .sm-tool.sm-tool--active .sm-tool-lbl { color: #fff; }
    .sm-toolpanel-divider { height: 1px; background: rgba(255,255,255,0.12); margin: 3px 4px; }
    .sm-preview { display: flex; flex-direction: column; }
    .sm-preview-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .sm-preview-title { font-size: 0.95rem; font-weight: 900; color: #1a1530; }
    .sm-preview-subtitle { font-size: 0.72rem; color: #8e82a7; }
    .sm-map-wrap { flex: 1; overflow: auto; }
    .sm-stage { background: #572e88; color: #fff; text-align: center; padding: 0.4rem 1rem; border-radius: 4px 4px 8px 8px; font-size: 0.62rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 auto 0.75rem; }
    .sm-floor { display: flex; gap: 1.5rem; justify-content: center; align-items: flex-start; padding: 0.5rem 0; }
    .sm-section-block { flex: 0 1 auto; }
    .sm-section-label { font-size: 0.58rem; font-weight: 900; color: #572e88; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.3rem; text-align: center; white-space: nowrap; }
    .sm-row-line { display: flex; align-items: center; gap: 0; }
    .sm-row-label { font-size: 0.62rem; font-weight: 900; color: #8e82a7; width: 20px; text-align: center; flex-shrink: 0; }
    .sm-seats { display: flex; gap: 3px; justify-content: center; }
    .sm-seat-num { font-size: 0.52rem; font-weight: 800; color: #b0a8c8; text-align: center; flex-shrink: 0; line-height: 20px; }
    .sm-seat { border-radius: 50%; flex-shrink: 0; cursor: crosshair; transition: opacity 0.1s, transform 0.1s; user-select: none; }
    .sm-seat:hover { opacity: 0.7; transform: scale(1.3); }
    .sm-legend { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; padding-top: 0.75rem; border-top: 1px solid #eceaf3; margin-top: 1rem; }
    .sm-legend-item { display: flex; align-items: center; gap: 0.3rem; font-size: 0.62rem; font-weight: 800; color: #3a3050; }
    .sm-legend-dot { width: 12px; height: 12px; border-radius: 50%; }
    .sm-adj { display: flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.65rem; border: 1.5px solid #eceaf3; border-radius: 8px; background: #faf9fd; font-size: 0.72rem; }
    .sm-adj-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .sm-adj-name { font-weight: 800; color: #1a1530; }
    .sm-adj input { width: 44px; padding: 0.2rem 0.3rem; border: 1px solid #e0dce8; border-radius: 4px; font: inherit; font-size: 0.72rem; text-align: center; }
    .sm-adj-lbl { color: #8e82a7; font-size: 0.6rem; font-weight: 700; }
    @media (max-width: 900px) { .sm-edit-area { flex-direction: column; } .sm-toolpanel { flex-direction: row; width: 100%; border-radius: 10px 10px 0 0; } }
    `;
  }

  // Global mouseup handler
  document.addEventListener('mouseup', () => { if (smDrawing) { smDrawing = false; debounceSave(); } });

  return {
    init, pickStage, pickSections, autoGenerate, setTool, startDraw, isDrawing,
    clickSeat, adjustSection, showWizard,
  };
})();
