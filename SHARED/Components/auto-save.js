/**
 * Build The Show — Auto Save
 * Stable, background autosave for every page.
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

  const SHORT_DEBOUNCE_MS = 450;
  const LONG_DEBOUNCE_MS  = 1400;
  const SAVED_HIDE_MS  = 2500;
  const ERROR_HIDE_MS  = 4500;

  let _sb              = null;
  const _timers        = {};   // batchKey -> setTimeout id
  const _batch         = {};   // batchKey -> { table, id, updates, fields, sourceEl }
  const _fields        = new Map();
  const _pendingValues = new Map();
  const _dirtyFields   = new Set();
  let _inFlight        = 0;
  let _statusEl        = null;
  let _hideTimer       = null;
  let _booted          = false;
  let _lastActiveAt    = 0;

  // ── Status pill ──────────────────────────────────────────────────────────
  // Uses the page's existing #toast element if present (manipulates it directly
  // with BTS toast classes). Falls back to creating its own matching gold pill.

  function getToastEl() {
    return document.getElementById('toast') || null;
  }

  function ensureOwnPill() {
    if (_statusEl) return _statusEl;
    const el = document.createElement('div');
    el.id = 'bts-autosave-status';
    el.style.cssText = [
      'position:fixed;bottom:1.5rem;right:1.5rem;z-index:99999',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'font-size:0.87rem;font-weight:900',
      'color:#1a1530;background:#efab45',
      'border:1px solid #efab45;border-radius:0.5rem',
      'padding:0.7rem 1.2rem;pointer-events:none',
      'opacity:0;transform:translateY(6px)',
      'transition:opacity 0.2s,transform 0.2s',
      'box-shadow:0 14px 34px rgba(87,46,136,0.22)',
    ].join(';');
    document.body.appendChild(el);
    _statusEl = el;
    return el;
  }

  function setStatus(text, isError, hideAfter) {
    if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; }
    const pageToast = getToastEl();
    if (pageToast) {
      pageToast.textContent = text;
      pageToast.classList.remove('toast--success', 'toast--error', 'visible');
      void pageToast.offsetWidth; // force reflow so transition replays
      pageToast.classList.toggle('toast--success', !isError);
      pageToast.classList.toggle('toast--error', !!isError);
      pageToast.classList.add('visible');
      if (hideAfter) {
        _hideTimer = setTimeout(() => pageToast.classList.remove('visible', 'toast--success', 'toast--error'), hideAfter);
      }
      return;
    }
    // No page toast — use own pill
    const el = ensureOwnPill();
    el.textContent = text;
    if (isError) {
      el.style.background = 'rgba(220,60,60,0.12)';
      el.style.borderColor = 'rgba(220,60,60,0.35)';
      el.style.color = '#f08080';
    } else {
      el.style.background = '#efab45';
      el.style.borderColor = '#efab45';
      el.style.color = '#1a1530';
    }
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
    if (hideAfter) {
      _hideTimer = setTimeout(() => {
        if (_statusEl) { _statusEl.style.opacity = '0'; _statusEl.style.transform = 'translateY(6px)'; }
      }, hideAfter);
    }
  }

  function showSaving()  { /* silent — saved confirmation is enough */ }
  function showSaved()   { setStatus('Saved!', false, SAVED_HIDE_MS); }
  function showError()   { setStatus("Couldn't save. Try again.", true, ERROR_HIDE_MS); }

  // ── Client discovery ─────────────────────────────────────────────────────

  function client() {
    return _sb || window.sb || null;
  }

  // ── Core save engine ─────────────────────────────────────────────────────

  function statusTargetFor(el) {
    const id = el?.dataset?.autosaveStatus;
    if (id) return document.getElementById(id);
    return el?.closest?.('[data-autosave-scope]')?.querySelector?.('[data-autosave-status]') || null;
  }

  function setInlineStatus(el, state) {
    const target = statusTargetFor(el);
    if (!target) return;
    target.classList.remove('saving', 'saved', 'error', 'dirty', 'out-of-sync');
    if (!state || state === 'idle') {
      target.textContent = '';
      return;
    }
    target.classList.add(state);
    if (state === 'saving' || state === 'dirty') target.textContent = 'Saving...';
    else if (state === 'saved') target.textContent = 'Saved!';
    else if (state === 'error') target.textContent = "Couldn't save. Try again.";
    else if (state === 'out-of-sync') target.textContent = 'Out of sync. Finish typing to update.';
  }

  function elementKey(el) {
    const a = attrsOf(el);
    if (a) return `field:${a.table}:${a.id}:${a.field}`;
    return el?.id ? `element:${location.pathname}:${el.id}` : '';
  }

  function isLongField(el) {
    if (!el) return false;
    if (el.dataset?.autosaveLong === 'true') return true;
    if (el.dataset?.autosaveLong === 'false') return false;
    return el.tagName === 'TEXTAREA' || el.isContentEditable || Number(el.getAttribute('rows') || 0) >= 3;
  }

  function debounceFor(el, fallback) {
    const explicit = parseInt(el?.dataset?.autosaveDelay || '', 10);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    if (Number.isFinite(fallback) && fallback > 0) return fallback;
    return isLongField(el) ? LONG_DEBOUNCE_MS : SHORT_DEBOUNCE_MS;
  }

  function draftKey(key) {
    return key ? `bts-autosave-draft:${key}` : '';
  }

  function saveDraft(key, value) {
    if (!key) return;
    try {
      localStorage.setItem(draftKey(key), JSON.stringify({ value, savedAt: Date.now() }));
    } catch {}
  }

  function clearDraft(key) {
    if (!key) return;
    try { localStorage.removeItem(draftKey(key)); } catch {}
  }

  function readDraft(key) {
    if (!key) return null;
    try {
      const raw = localStorage.getItem(draftKey(key));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function registerActive(el) {
    const key = elementKey(el);
    if (!key) return;
    _fields.set(key, { el, focusedAt: Date.now() });
    _lastActiveAt = Date.now();
  }

  function releaseActive(el) {
    const key = elementKey(el);
    if (!key) return;
    _fields.delete(key);
    _lastActiveAt = Date.now();
  }

  function isActiveElement(el) {
    return !!el && (document.activeElement === el || _fields.has(elementKey(el)));
  }

  function hasActiveEdit() {
    const active = document.activeElement;
    if (active && (
      active.matches?.('input,textarea,select') ||
      active.isContentEditable
    )) return true;
    return _fields.size > 0 || Date.now() - _lastActiveAt < 500;
  }

  function notifyFlushComplete() {
    window.dispatchEvent(new CustomEvent('bts:autosave-flushed'));
  }

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
      Object.values(entry.fields || {}).forEach(fieldKey => {
        _dirtyFields.delete(fieldKey);
        setInlineStatus(_fields.get(fieldKey)?.el || entry.sourceEl, 'saving');
      });
      const { error } = await sb.from(entry.table).update(entry.updates).eq('id', entry.id);
      if (error) throw error;
      _inFlight = Math.max(0, _inFlight - 1);
      Object.values(entry.fields || {}).forEach(fieldKey => {
        const pending = _pendingValues.get(fieldKey);
        if (pending !== undefined) clearDraft(fieldKey);
        setInlineStatus(_fields.get(fieldKey)?.el || entry.sourceEl, 'saved');
      });
      if (_inFlight === 0 && Object.keys(_batch).length === 0) showSaved();
      notifyFlushComplete();
    } catch (err) {
      _inFlight = Math.max(0, _inFlight - 1);
      console.error('[BTS AutoSave] save failed', { table: entry.table, id: entry.id, updates: entry.updates, err });
      Object.values(entry.fields || {}).forEach(fieldKey => {
        _dirtyFields.add(fieldKey);
        setInlineStatus(_fields.get(fieldKey)?.el || entry.sourceEl, 'error');
      });
      showError();
      notifyFlushComplete();
    }
  }

  function queueSave(table, id, field, value, options = {}) {
    if (!table || !id || !field) return;
    const key = `${table}::${id}`;
    const fieldKey = `field:${table}:${id}:${field}`;
    const sourceEl = options.sourceEl || _fields.get(fieldKey)?.el || null;

    if (!_batch[key]) {
      _batch[key] = { table, id, updates: {}, fields: {}, sourceEl };
      _inFlight++;
      showSaving();
    }
    _batch[key].updates[field] = value;
    _batch[key].fields[field] = fieldKey;
    if (sourceEl) _batch[key].sourceEl = sourceEl;
    _pendingValues.set(fieldKey, value);
    _dirtyFields.add(fieldKey);
    setInlineStatus(sourceEl, 'dirty');
    if (isLongField(sourceEl) || options.draft) saveDraft(fieldKey, value);

    if (_timers[key]) clearTimeout(_timers[key]);
    _timers[key] = setTimeout(() => flushBatch(key), debounceFor(sourceEl, options.delay));
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
    if (el.isContentEditable)    return el.innerHTML;
    return el.value;
  }

  function onInput(e) {
    const a = attrsOf(e.target);
    if (a) {
      registerActive(e.target);
      queueSave(a.table, a.id, a.field, valueOf(e.target), { sourceEl: e.target });
    }
  }

  function onBlur(e) {
    const a = attrsOf(e.target);
    releaseActive(e.target);
    if (!a) return;
    const key = `${a.table}::${a.id}`;
    if (_batch[key]) {
      if (_timers[key]) { clearTimeout(_timers[key]); delete _timers[key]; }
      flushBatch(key);
    }
  }

  function onFocus(e) {
    if (attrsOf(e.target) || e.target?.matches?.('input,textarea,select') || e.target?.isContentEditable) {
      registerActive(e.target);
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') flushAll();
  }

  // ── Bootstrap ────────────────────────────────────────────────────────────

  function boot() {
    if (_booted) return;
    _booted = true;
    document.addEventListener('focus',            onFocus,            true);
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

    queueSave,

    createField(options = {}) {
      const {
        key,
        element,
        getValue,
        save,
        delay,
        long = false,
        draft = long,
        onSaved,
        onError,
      } = options;
      const el = typeof element === 'string' ? document.getElementById(element) : element;
      if (!key || !el || typeof save !== 'function') return null;
      const fieldKey = `custom:${key}`;
      const existingDraft = (draft || long || isLongField(el)) ? readDraft(fieldKey) : null;
      if (existingDraft && existingDraft.value != null) {
        if (el.isContentEditable) el.innerHTML = existingDraft.value;
        else if ('value' in el) el.value = existingDraft.value;
        setInlineStatus(el, 'dirty');
      }
      let timer = null;
      let latestValue = getValue ? getValue(el) : valueOf(el);
      let savingToken = 0;
      const setFieldStatus = state => setInlineStatus(el, state);
      const writeDraft = value => {
        if (draft || long || isLongField(el)) saveDraft(fieldKey, value);
      };
      const flush = async () => {
        if (timer) { clearTimeout(timer); timer = null; }
        const value = latestValue;
        const token = ++savingToken;
        _dirtyFields.delete(fieldKey);
        setFieldStatus('saving');
        showSaving();
        try {
          await save(value, { element: el, key: fieldKey });
          if (token === savingToken) {
            clearDraft(fieldKey);
            setFieldStatus('saved');
            showSaved();
            if (typeof onSaved === 'function') onSaved(value, { element: el, key: fieldKey });
            notifyFlushComplete();
          }
        } catch (err) {
          _dirtyFields.add(fieldKey);
          setFieldStatus('error');
          showError();
          if (typeof onError === 'function') onError(err, value, { element: el, key: fieldKey });
          notifyFlushComplete();
        }
      };
      const schedule = () => {
        latestValue = getValue ? getValue(el) : valueOf(el);
        registerActive(el);
        _dirtyFields.add(fieldKey);
        setFieldStatus('dirty');
        writeDraft(latestValue);
        if (timer) clearTimeout(timer);
        timer = setTimeout(flush, debounceFor(el, delay || (long ? LONG_DEBOUNCE_MS : SHORT_DEBOUNCE_MS)));
      };
      el.addEventListener('focus', () => registerActive(el), true);
      el.addEventListener('input', schedule, true);
      el.addEventListener('change', schedule, true);
      el.addEventListener('blur', () => {
        releaseActive(el);
        if (timer || _dirtyFields.has(fieldKey)) flush();
      }, true);
      return { schedule, flush, key: fieldKey };
    },

    hydrateValue(el, value, options = {}) {
      const node = typeof el === 'string' ? document.getElementById(el) : el;
      if (!node) return;
      const next = value == null ? '' : String(value);
      const key = options.key || elementKey(node);
      const draft = options.long || isLongField(node) ? readDraft(key) : null;
      if (draft && String(draft.value || '') !== next && !isActiveElement(node)) {
        if (node.isContentEditable) node.innerHTML = draft.value || '';
        else if ('value' in node) node.value = draft.value || '';
        setInlineStatus(node, 'dirty');
        return;
      }
      if (isActiveElement(node) && (node.value !== next && node.innerHTML !== next)) {
        setInlineStatus(node, 'out-of-sync');
        return;
      }
      if (node.type === 'checkbox') node.checked = !!value;
      else if (node.isContentEditable) node.innerHTML = next;
      else if ('value' in node) node.value = next;
      else node.textContent = next;
    },

    /** Flush all pending saves immediately (e.g. before a page nav). */
    flush: flushAll,

    hasActiveEdit,
    isFieldDirty(key) { return _dirtyFields.has(key); },
    readDraft,
    clearDraft,

    showSaving,
    showSaved,
    showError,
  };

})();
