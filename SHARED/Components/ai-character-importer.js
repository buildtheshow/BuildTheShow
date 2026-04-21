/**
 * ai-character-importer.js
 * Shared AI character import component for all production pages.
 *
 * Two entry points:
 *   AICharacterImporter.open(config)    — opens the full upload/paste modal first
 *   AICharacterImporter.process(config) — skips straight to AI if files/text already collected
 *
 * config: { files, text, productionId, productionTitle, supabase, existingCount, onSuccess }
 */
(function () {

  const PROXY_URL = 'https://tkmaiktxpwqfbgeojbnf.supabase.co/functions/v1/anthropic-proxy';
  const PROXY_HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrbWFpa3R4cHdxZmJnZW9qYm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MzE4MTcsImV4cCI6MjA4OTMwNzgxN30.TkTZBNWUatk3Y6Vmfv1hIRR3DfVjgwauwa76Pf00J_8',
  };

  const EXTRACT_PROMPT = (title) =>
    `List every character and role in this theatre production document for "${title}". ` +
    `For each, note: name, role type (Principal/Supporting/Featured/Cameo/Group), how the role is written (woman/girl, man/boy, non-binary/gender-neutral, or any/open), ` +
    `age range, vocal range, singing strength, dancing requirement, and performer count. Be thorough.`;

  const CONVERT_PROMPT = (extracted) =>
    `Convert this character list to a JSON array. Each object must have these exact keys: ` +
    `name, role_type (one of: Principal, Supporting, Featured, Cameo, Group), ` +
    `gender (use exactly: "She/Her", "He/Him", "They/Them", "Any", or null — these describe the pronouns the role is written with, not a person's sex), age_range (text or null), ` +
    `description (1–2 sentences or null), ` +
    `vocal_type (Soprano/Mezzo-Soprano/Alto/Tenor/Baritone/Bass/Non-Singing or null), ` +
    `vocal_range (text like "A3–E5" or null), ` +
    `vocal_usage (one of: Primary Vocals/Featured Vocals/Vocal Group/Supporting Vocals/Ensemble Vocals/Minimal/Non-Singing or null — Primary Vocals: leads full songs; Featured Vocals: one clear standout solo moment; Vocal Group: recurring small group unit; Supporting Vocals: regular but never focal; Ensemble Vocals: full group numbers only; Minimal: sings once or barely; Non-Singing: no singing at all), ` +
    `singing_strength (Strong/Moderate/Light/Non-Singing or null), ` +
    `dancing_strength (No Dance/Beginner Friendly/Performer Level/Dance-Focused or null), ` +
    `performer_count (integer, default 1). ` +
    `Return ONLY the JSON array, nothing else.\n\n${extracted}`;

  const LOADING_MESSAGES = [
    'Reading the cast list…',
    'Checking the dramatis personae…',
    'Running through the libretto…',
    'Counting the roles…',
    'Consulting the director…',
  ];

  // ── Module state ──────────────────────────────────────────────────────────

  let _pendingChars = [];
  let _currentConfig = null;
  let _loadingInterval = null;
  let _modalInjected = false;
  let _pickerFiles = [];

  // ── Helpers ───────────────────────────────────────────────────────────────

  function esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function startLoading(el) {
    let i = 0;
    el.textContent = LOADING_MESSAGES[0];
    _loadingInterval = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      el.textContent = LOADING_MESSAGES[i];
    }, 3000);
  }

  function stopLoading() {
    if (_loadingInterval) { clearInterval(_loadingInterval); _loadingInterval = null; }
  }

  // ── Modal injection ───────────────────────────────────────────────────────

  function ensureModal() {
    if (_modalInjected) return;
    _modalInjected = true;

    const style = document.createElement('style');
    style.textContent = `
      /* ── Picker modal ── */
      #aci-picker-overlay {
        display: none; position: fixed; inset: 0; z-index: 9000;
        background: rgba(10,5,20,0.55); align-items: center; justify-content: center;
      }
      #aci-picker-overlay.open { display: flex; }
      #aci-picker-modal {
        background: #fff; border-radius: 12px; width: 90%; max-width: 520px;
        max-height: 85vh; display: flex; flex-direction: column;
        box-shadow: 0 8px 40px rgba(87,46,136,0.18);
        overflow-y: auto;
      }
      #aci-picker-header {
        padding: 1.2rem 1.4rem 1rem; border-bottom: 1px solid rgba(87,46,136,0.1);
        display: flex; align-items: center; justify-content: space-between;
        position: sticky; top: 0; background: #fff; z-index: 1;
      }
      #aci-picker-header h2 { margin: 0; font-size: 1rem; font-weight: 700; color: #1a1530; }
      #aci-picker-close {
        background: none; border: none; font-size: 1.2rem; color: #9a7aa0;
        cursor: pointer; padding: 0 0.2rem; line-height: 1;
      }
      #aci-picker-body { padding: 1.2rem 1.4rem; }
      #aci-picker-hints {
        font-size: 0.82rem; color: #4a3a70; line-height: 1.5; margin-bottom: 1rem;
      }
      #aci-picker-hints strong { color: #1a1530; }
      #aci-picker-hints ul { padding-left: 1.1rem; margin: 0.4rem 0 0; }
      #aci-picker-hints li { margin-bottom: 0.2rem; }
      #aci-picker-upload-btn {
        width: 100%; padding: 0.6rem 1rem; border: 1.5px dashed rgba(87,46,136,0.3);
        border-radius: 8px; background: rgba(87,46,136,0.04); color: #572e88;
        font-size: 0.85rem; font-weight: 600; cursor: pointer;
        margin-bottom: 0.5rem; text-align: center;
      }
      #aci-picker-upload-btn:hover { background: rgba(87,46,136,0.08); }
      #aci-picker-file-list { margin-bottom: 0.75rem; }
      #aci-picker-or {
        text-align: center; font-size: 0.75rem; color: #9a8aa0; margin: 0.5rem 0;
      }
      #aci-picker-text-label {
        font-size: 0.8rem; font-weight: 600; color: #4a3a70; margin-bottom: 0.35rem; display: block;
      }
      #aci-picker-textarea {
        width: 100%; box-sizing: border-box; padding: 0.55rem 0.75rem;
        border: 1px solid rgba(87,46,136,0.2); border-radius: 8px;
        font-size: 0.8rem; color: #1a1530; resize: vertical; min-height: 110px;
        font-family: inherit; margin-bottom: 0.75rem;
      }
      #aci-picker-textarea:focus { outline: none; border-color: #572e88; }
      #aci-picker-submit {
        width: 100%; padding: 0.65rem 1rem; background: #572e88; color: #fff;
        border: none; border-radius: 8px; font-size: 0.9rem; font-weight: 700;
        cursor: pointer;
      }
      #aci-picker-submit:hover { background: #6a3aa0; }

      /* ── Review modal ── */
      #aci-overlay {
        display: none; position: fixed; inset: 0; z-index: 9100;
        background: rgba(10,5,20,0.55); align-items: center; justify-content: center;
      }
      #aci-overlay.open { display: flex; }
      #aci-modal {
        background: #fff; border-radius: 12px; width: 90%; max-width: 680px;
        max-height: 80vh; display: flex; flex-direction: column;
        box-shadow: 0 8px 40px rgba(87,46,136,0.18);
      }
      #aci-modal-header {
        padding: 1.2rem 1.4rem 1rem; border-bottom: 1px solid rgba(87,46,136,0.1);
        display: flex; align-items: center; justify-content: space-between;
      }
      #aci-modal-header h2 { margin: 0; font-size: 1rem; font-weight: 700; color: #1a1530; }
      #aci-modal-close {
        background: none; border: none; font-size: 1.2rem; color: #9a7aa0;
        cursor: pointer; padding: 0 0.2rem; line-height: 1;
      }
      #aci-modal-body { padding: 1.2rem 1.4rem; overflow-y: auto; flex: 1; }
      #aci-status {
        font-size: 0.82rem; color: #572e88; font-weight: 600;
        text-align: center; padding: 0.6rem 0; display: none;
      }
      #aci-status.error { color: #c0392b; }
      #aci-table-wrap { overflow-x: auto; }
      #aci-table {
        width: 100%; border-collapse: collapse; font-size: 0.82rem;
      }
      #aci-table th {
        text-align: left; padding: 0.4rem 0.6rem; color: #8a7aa0;
        font-weight: 600; font-size: 0.75rem; text-transform: uppercase;
        letter-spacing: 0.04em; border-bottom: 1px solid rgba(87,46,136,0.12);
      }
      #aci-modal-footer {
        padding: 1rem 1.4rem; border-top: 1px solid rgba(87,46,136,0.1);
        display: flex; align-items: center; justify-content: space-between; gap: 0.8rem;
      }
      #aci-count { font-size: 0.82rem; color: #8a7aa0; }
      #aci-save-btn {
        background: #572e88; color: #fff; border: none; border-radius: 7px;
        padding: 0.55rem 1.2rem; font-size: 0.88rem; font-weight: 600;
        cursor: pointer;
      }
      #aci-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      #aci-cancel-btn {
        background: none; border: 1px solid rgba(87,46,136,0.2); border-radius: 7px;
        padding: 0.5rem 1rem; font-size: 0.85rem; color: #6a5a80; cursor: pointer;
      }
    `;
    document.head.appendChild(style);

    // Picker modal
    const pickerOverlay = document.createElement('div');
    pickerOverlay.id = 'aci-picker-overlay';
    pickerOverlay.innerHTML = `
      <div id="aci-picker-modal">
        <div id="aci-picker-header">
          <h2>Import Characters with AI</h2>
          <button id="aci-picker-close" type="button" aria-label="Close">✕</button>
        </div>
        <div id="aci-picker-body">
          <div id="aci-picker-hints">
            <strong>What the AI looks for in your document:</strong>
            <ul>
              <li><strong>Name</strong> and role type (Principal, Supporting, Ensemble, etc.)</li>
              <li><strong>Age</strong> or range (teens, 30s–40s, child)</li>
              <li><strong>Gender</strong></li>
              <li><strong>Voice type</strong> and vocal range (if singing is involved)</li>
              <li><strong>Dance/movement</strong> requirement</li>
              <li><strong>How many performers</strong> play this role</li>
              <li><strong>Description</strong> — shows on audition forms and your public page</li>
            </ul>
          </div>
          <button id="aci-picker-upload-btn" type="button">📎 Upload Files (PDF, image, Word doc)</button>
          <input type="file" id="aci-picker-file-input" accept=".pdf,.doc,.docx,.txt,image/*" multiple style="display:none;" />
          <div id="aci-picker-file-list"></div>
          <div id="aci-picker-or">— or —</div>
          <label id="aci-picker-text-label" for="aci-picker-textarea">Paste character list or script text</label>
          <textarea id="aci-picker-textarea" placeholder="JESS: Principal | 16–18 | She/Her | Alto | Strong singer | some movement | 1 performer&#10;MR. THOMAS: Supporting | 40–60 | He/Him | Baritone | No dance required | 1 performer"></textarea>
          <button id="aci-picker-submit" type="button">Work the Magic ✨</button>
        </div>
      </div>
    `;
    document.body.appendChild(pickerOverlay);

    // Review modal
    const overlay = document.createElement('div');
    overlay.id = 'aci-overlay';
    overlay.innerHTML = `
      <div id="aci-modal">
        <div id="aci-modal-header">
          <h2>Review Characters</h2>
          <button id="aci-modal-close" type="button" aria-label="Close">✕</button>
        </div>
        <div id="aci-modal-body">
          <div id="aci-status"></div>
          <div id="aci-table-wrap">
            <table id="aci-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Name</th>
                  <th>Role Type</th>
                  <th>Gender</th>
                  <th>Vocal Type</th>
                  <th>Vocal Usage</th>
                </tr>
              </thead>
              <tbody id="aci-table-body"></tbody>
            </table>
          </div>
        </div>
        <div id="aci-modal-footer">
          <span id="aci-count"></span>
          <div style="display:flex;gap:0.6rem;">
            <button id="aci-cancel-btn" type="button">Cancel</button>
            <button id="aci-save-btn" type="button">Add Selected</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Picker events
    document.getElementById('aci-picker-close').addEventListener('click', closePicker);
    pickerOverlay.addEventListener('click', (e) => { if (e.target === pickerOverlay) closePicker(); });

    document.getElementById('aci-picker-upload-btn').addEventListener('click', () => {
      document.getElementById('aci-picker-file-input').click();
    });
    document.getElementById('aci-picker-file-input').addEventListener('change', (e) => {
      _pickerFiles = [..._pickerFiles, ...Array.from(e.target.files)];
      e.target.value = '';
      renderPickerFileList();
    });
    document.getElementById('aci-picker-submit').addEventListener('click', submitFromPicker);

    // Review events
    document.getElementById('aci-modal-close').addEventListener('click', closeModal);
    document.getElementById('aci-cancel-btn').addEventListener('click', closeModal);
    document.getElementById('aci-save-btn').addEventListener('click', confirmSave);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  }

  // ── Picker helpers ────────────────────────────────────────────────────────

  function renderPickerFileList() {
    const list = document.getElementById('aci-picker-file-list');
    if (!_pickerFiles.length) { list.innerHTML = ''; return; }
    list.innerHTML = _pickerFiles.map((f, i) => `
      <div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0.6rem;background:rgba(87,46,136,0.06);border-radius:6px;margin-bottom:0.3rem;font-size:0.8rem;">
        <span style="color:#572e88;">📄</span>
        <span style="flex:1;color:#1a1530;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(f.name)}</span>
        <button type="button" data-idx="${i}" style="background:none;border:none;color:#9a7aa0;cursor:pointer;font-size:0.9rem;padding:0 0.2rem;">✕</button>
      </div>`).join('') +
      `<div style="font-size:0.72rem;color:#8a7aa0;margin-top:0.2rem;">${_pickerFiles.length} file${_pickerFiles.length !== 1 ? 's' : ''} selected</div>`;

    list.querySelectorAll('button[data-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        _pickerFiles.splice(Number(btn.dataset.idx), 1);
        renderPickerFileList();
      });
    });
  }

  function openPicker(config) {
    ensureModal();
    _currentConfig = config;
    _pickerFiles = [];
    renderPickerFileList();
    document.getElementById('aci-picker-textarea').value = '';
    document.getElementById('aci-picker-overlay').classList.add('open');
  }

  function closePicker() {
    const overlay = document.getElementById('aci-picker-overlay');
    if (overlay) overlay.classList.remove('open');
    _pickerFiles = [];
    _currentConfig = null;
  }

  async function submitFromPicker() {
    const text = document.getElementById('aci-picker-textarea').value.trim();
    const files = _pickerFiles.slice();
    if (!files.length && !text) {
      alert('Upload a file or paste some text first.');
      return;
    }
    const config = { ..._currentConfig, files, text };
    closePicker();
    await runProcess(config);
  }

  // ── Review modal state ────────────────────────────────────────────────────

  function showLoading(message) {
    ensureModal();
    const statusEl = document.getElementById('aci-status');
    const tableWrap = document.getElementById('aci-table-wrap');
    const footer = document.getElementById('aci-modal-footer');
    statusEl.className = '';
    statusEl.style.display = 'block';
    statusEl.textContent = message || LOADING_MESSAGES[0];
    tableWrap.style.display = 'none';
    footer.style.display = 'none';
    document.getElementById('aci-overlay').classList.add('open');
    startLoading(statusEl);
  }

  function showReview(chars) {
    stopLoading();
    const statusEl = document.getElementById('aci-status');
    const tableWrap = document.getElementById('aci-table-wrap');
    const footer = document.getElementById('aci-modal-footer');

    statusEl.style.display = 'none';
    tableWrap.style.display = 'block';
    footer.style.display = 'flex';

    document.getElementById('aci-count').textContent =
      chars.length + ' character' + (chars.length !== 1 ? 's' : '') + ' found';

    document.getElementById('aci-table-body').innerHTML = chars.map((c, i) => `
      <tr style="border-top:1px solid rgba(87,46,136,0.08);">
        <td style="padding:0.5rem 0.6rem;">
          <input type="checkbox" checked id="aci-check-${i}" style="accent-color:#572e88;width:14px;height:14px;" />
        </td>
        <td style="padding:0.5rem 0.6rem;font-weight:700;color:#1a1530;">${esc(c.name)}</td>
        <td style="padding:0.5rem 0.6rem;color:#6a5a80;">${esc(c.role_type || '-')}</td>
        <td style="padding:0.5rem 0.6rem;color:#6a5a80;">${esc(c.gender || '-')}</td>
        <td style="padding:0.5rem 0.6rem;color:#6a5a80;">${esc(c.vocal_type || '-')}</td>
        <td style="padding:0.5rem 0.6rem;color:#6a5a80;">${esc(c.vocal_usage || '-')}</td>
      </tr>`).join('');
  }

  function showError(message) {
    stopLoading();
    ensureModal();
    const statusEl = document.getElementById('aci-status');
    const tableWrap = document.getElementById('aci-table-wrap');
    const footer = document.getElementById('aci-modal-footer');
    statusEl.className = 'error';
    statusEl.style.display = 'block';
    statusEl.textContent = message;
    tableWrap.style.display = 'none';
    footer.style.display = 'none';
    setTimeout(closeModal, 10000);
  }

  function closeModal() {
    stopLoading();
    const overlay = document.getElementById('aci-overlay');
    if (overlay) overlay.classList.remove('open');
    _pendingChars = [];
    _currentConfig = null;
    const btn = document.getElementById('aci-save-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Add Selected'; }
  }

  // ── AI extraction ─────────────────────────────────────────────────────────

  async function runExtraction(content) {
    const extractRes = await fetch(PROXY_URL, {
      method: 'POST', headers: PROXY_HEADERS,
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 2048,
        messages: [{ role: 'user', content }],
      }),
    });
    if (!extractRes.ok) throw new Error('AI request failed: ' + extractRes.status);
    const extractData = await extractRes.json();
    const extractedText = (extractData.content || []).find(c => c.type === 'text')?.text?.trim() || '';
    if (!extractedText) throw new Error('Could not read the document.');

    const convertRes = await fetch(PROXY_URL, {
      method: 'POST', headers: PROXY_HEADERS,
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 4096,
        messages: [{ role: 'user', content: CONVERT_PROMPT(extractedText) }],
      }),
    });
    if (!convertRes.ok) throw new Error('AI request failed: ' + convertRes.status);
    const convertData = await convertRes.json();
    const raw = (convertData.content || []).find(c => c.type === 'text')?.text?.trim() || '[]';

    const match = raw.match(/\[[\s\S]*\]/);
    const chars = JSON.parse(match ? match[0] : raw);
    if (!Array.isArray(chars)) throw new Error('Could not read AI response.');
    return chars;
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function confirmSave() {
    if (!_currentConfig) return;
    const btn = document.getElementById('aci-save-btn');
    btn.disabled = true; btn.textContent = 'Saving…';

    const toSave = _pendingChars.filter((_, i) => {
      const cb = document.getElementById('aci-check-' + i);
      return cb && cb.checked;
    });

    if (!toSave.length) { closeModal(); return; }

    const { productionId, supabase, existingCount, onSuccess } = _currentConfig;

    const payload = toSave.map((c, i) => ({
      production_id: productionId,
      name: c.name,
      role_type: c.role_type || null,
      gender: c.gender || null,
      age_range: c.age_range || null,
      description: c.description || null,
      vocal_type: c.vocal_type || null,
      vocal_range: c.vocal_range || null,
      vocal_usage: c.vocal_usage || null,
      singing_strength: c.singing_strength || null,
      dancing_strength: c.dancing_strength || null,
      performer_count: c.performer_count || 1,
      show_on_form: true,
      show_on_public_page: true,
      sort_order: (existingCount || 0) + i,
    }));

    const { data, error } = await supabase.from('production_characters').insert(payload).select();
    if (error) {
      btn.disabled = false; btn.textContent = 'Add Selected';
      showError('Save failed: ' + error.message);
      return;
    }

    closeModal();
    if (onSuccess) onSuccess(data || []);
  }

  // ── Core process (internal + public) ─────────────────────────────────────

  async function runProcess(config) {
    const { files = [], text = '', productionTitle = 'this production' } = config;
    if (!files.length && !text.trim()) {
      alert('Upload a file or paste some text first.');
      return;
    }

    _currentConfig = config;
    showLoading();

    try {
      const content = [];

      for (const file of files) {
        const isPdf = file.type === 'application/pdf';
        const b64 = await toBase64(file);
        content.push({
          type: isPdf ? 'document' : 'image',
          source: { type: 'base64', media_type: file.type, data: b64 },
        });
      }

      if (text.trim()) {
        content.push({
          type: 'text',
          text: EXTRACT_PROMPT(productionTitle) + '\n\n---TEXT TO PROCESS---\n\n' + text,
        });
      } else {
        content.push({ type: 'text', text: EXTRACT_PROMPT(productionTitle) });
      }

      const chars = await runExtraction(content);

      if (!chars.length) {
        showError('No characters found. Try a different file or add manually.');
        return;
      }

      _pendingChars = chars;
      showReview(chars);

    } catch (err) {
      showError('Import failed: ' + err.message);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  window.AICharacterImporter = {

    /**
     * Open the full upload/paste modal — user picks files and text before anything runs.
     * This is the preferred entry point for any page that doesn't already have its own picker UI.
     */
    open(config) {
      ensureModal();
      openPicker(config);
    },

    /**
     * Skip the picker and process files/text that have already been collected.
     * Used by the production workspace which has its own picker modal.
     */
    async process(config) {
      await runProcess(config);
    },
  };

})();
