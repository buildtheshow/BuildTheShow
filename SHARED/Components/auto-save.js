/**
 * Build The Show — Auto Save
 * Google Docs-style auto-save for every page.
 *
 * Two ways to use:
 *
 * 1. Data attributes (zero JS required after init):
 *    <input data-autosave-table="profiles"
 *           data-autosave-id="{{rowId}}"
 *           data-autosave-field="display_name">
 *    Set data-autosave-id from JS: el.dataset.autosaveId = profile.id
 *
 * 2. Programmatic (for complex pages):
 *    AutoSave.save('profiles', profileId, 'bio', newValue)
 *    AutoSave.save('productions', prodId, { title: 'X', description: 'Y' })
 */
(function () {
  'use strict';

  const DEBOUNCE_MS    = 400;
  const SAVED_HIDE_MS  = 2500;
  const ERROR_HIDE_MS  = 4500;

  let _sb           = null;
  let _timers       = {};   // batchKey → setTimeout id
  let _batch        = {};   // batchKey → { table, id, updates }
  let _inFlight     = 0;
  let _statusEl     = null;
  let _hideTimer    = null;
  let _booted       = false;

  // ── Status pill ──────────────────────────────────────────────────────────

  function ensureStatusEl() {
    if (_statusEl) return _statusEl;
    const el = document.createElement('div');
    el.id = 'bts-autosave-status';
    el.style.cssText = [
      'position:fixed;top:12px;right:16px;z-index:99999',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'font-size:0.72rem;font-weight:500',
      'color:#6b7280;background:rgba(255,255,255,0.94)',
      'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)',
      'border:1px solid rgba(0,0,0,0.08);border-radius:20px',
      'padding:4px 13px;pointer-events:none',
      'opacity:0;transition:opacity 0.18s ease',
      'box-shadow:0 1px 6px rgba(0,0,0,0.07)',
    ].join(';');
    document.body.appendChild(el);
    _statusEl = el;
    return el;
  }

  function setStatus(text, color, hideAfter) {
    const el = ensureStatusEl();
    if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; }
    el.textContent = text;
    el.style.color = color || '#6b7280';
    el.style.opacity = '1';
    if (hideAfter) {
      _hideTimer = setTimeout(() => { if (_statusEl) _statusEl.style.opacity = '0'; }, hideAfter);
    }
  }

  function showSaving()  { setStatus('Saving…', '#572e88', null); }
  function showSaved()   { setStatus('All changes saved', '#22a06b', SAVED_HIDE_MS); }
  function showError()   { setStatus('Could not save — check your connection', '#dc2626', ERROR_HIDE_MS); }

  // ── Client discovery ─────────────────────────────────────────────────────

  function client() {
    return _sb || window.sb || null;
  }

  // ── Core save engine ─────────────────────────────────────────────────────

  async function flushBatch(key) {
    const entry = _batch[key];
    if (!entry) return;
    delete _batch[key];
    if (_timers[key]) { clearTimeout(_timers[key]); delete _timers[key]; }

    const sb = client();
    if (!sb) {
      _inFlight = Math.max(0, _inFlight - 1);
      console.warn('[BTS AutoSave] no Supabase client — cannot save', entry);
      return;
    }

    try {
      const { error } = await sb.from(entry.table).update(entry.updates).eq('id', entry.id);
      if (error) throw error;
      _inFlight = Math.max(0, _inFlight - 1);
      if (_inFlight === 0 && Object.keys(_batch).length === 0) showSaved();
    } catch (err) {
      _inFlight = Math.max(0, _inFlight - 1);
      console.error('[BTS AutoSave] save failed', { table: entry.table, id: entry.id, updates: entry.updates, err });
      showError();
    }
  }

  function queueSave(table, id, field, value) {
    if (!table || !id || !field) return;
    const key = `${table}::${id}`;

    if (!_batch[key]) {
      _batch[key] = { table, id, updates: {} };
      _inFlight++;
      showSaving();
    }
    _batch[key].updates[field] = value;

    if (_timers[key]) clearTimeout(_timers[key]);
    _timers[key] = setTimeout(() => flushBatch(key), DEBOUNCE_MS);
  }

  async function flushAll() {
    const keys = Object.keys(_batch);
    if (!keys.length) return;
    await Promise.all(keys.map(flushBatch));
  }

  // ── Data-attribute event delegation ──────────────────────────────────────

  function attrsOf(el) {
    const table = el.dataset && el.dataset.autosaveTable;
    const id    = el.dataset && el.dataset.autosaveId;
    const field = el.dataset && el.dataset.autosaveField;
    return (table && id && field) ? { table, id, field } : null;
  }

  function valueOf(el) {
    if (el.type === 'checkbox')  return el.checked;
    if (el.type === 'number')    return el.valueAsNumber;
    if (el.type === 'range')     return el.valueAsNumber;
    return el.value;
  }

  function onInput(e) {
    const a = attrsOf(e.target);
    if (a) queueSave(a.table, a.id, a.field, valueOf(e.target));
  }

  function onBlur(e) {
    const a = attrsOf(e.target);
    if (!a) return;
    const key = `${a.table}::${a.id}`;
    if (_batch[key]) {
      if (_timers[key]) { clearTimeout(_timers[key]); delete _timers[key]; }
      flushBatch(key);
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') flushAll();
  }

  // ── Bootstrap ────────────────────────────────────────────────────────────

  function boot() {
    if (_booted) return;
    _booted = true;
    document.addEventListener('input',            onInput,            true);
    document.addEventListener('change',           onInput,            true);
    document.addEventListener('blur',             onBlur,             true);
    document.addEventListener('visibilitychange', onVisibilityChange, false);
    window.addEventListener(  'beforeunload',     flushAll,           false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // ── Public API ───────────────────────────────────────────────────────────

  window.AutoSave = {
    /**
     * Optional: pass Supabase client explicitly if window.sb isn't set yet.
     */
    init(supabaseClient) {
      _sb = supabaseClient || null;
    },

    /**
     * Queue a save.
     * save(table, id, 'field', value)
     * save(table, id, { field1: val1, field2: val2 })
     */
    save(table, id, fieldOrUpdates, value) {
      if (!table || !id) return;
      if (fieldOrUpdates && typeof fieldOrUpdates === 'object') {
        Object.entries(fieldOrUpdates).forEach(([f, v]) => queueSave(table, id, f, v));
      } else {
        queueSave(table, id, fieldOrUpdates, value);
      }
    },

    /** Flush all pending saves immediately (e.g. before a page nav). */
    flush: flushAll,

    showSaving,
    showSaved,
    showError,
  };

})();
