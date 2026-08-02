/* volunteers-shared.js — shared helpers for the 5 standalone Volunteers pages
   (volunteer-suggestions.html, volunteer-roles.html, volunteer-publish.html,
   volunteer-share.html, volunteer-applicants.html/Requests).

   Mirrors the equivalent logic in ASSETS/scripts/production-workspace.js:
   VOLUNTEER_DEPARTMENTS, volunteerDeptForOpp(), loadOpportunities(),
   openOppModal()/submitOpp()/toggleOppStatus()/deleteOpp(), roleCardHtml(),
   buildVolunteerSuggestions(). Keep in sync if the in-app versions change.

   Security: getPortalSession()/hasMenuKey()/scopeDeptKeyForSession() implement
   the same "no session -> full producer view; session present -> gate on the
   matching vol:* menu key, and for Dept Leads scope to their own department"
   pattern already used by volunteer-calendar.html and departments-dashboard.html. */
(function () {
  'use strict';

  const SB_URL = 'https://tkmaiktxpwqfbgeojbnf.supabase.co';
  const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrbWFpa3R4cHdxZmJnZW9qYm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MzE4MTcsImV4cCI6MjA4OTMwNzgxN30.TkTZBNWUatk3Y6Vmfv1hIRR3DfVjgwauwa76Pf00J_8';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtDate(raw) {
    if (!raw) return '';
    try {
      const d = new Date(String(raw).slice(0, 10) + 'T12:00:00');
      return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (_) { return String(raw).slice(0, 10); }
  }

  // Mirrors VOLUNTEER_DEPARTMENTS in production-workspace.js — keep in sync.
  const VOLUNTEER_DEPARTMENTS = [
    { key: 'foh', label: 'Front of House', hint: 'Audience-facing shifts: ushers, concessions, ticket table, lobby help.', match: /front|house|usher|concession|ticket|baker|treat|audience|lobby/i },
    { key: 'backstage', label: 'Backstage & Rehearsal Support', hint: 'People who keep performers safe, ready, and in the right place.', match: /stage|backstage|rehearsal|wrangler|quick|assistant|performer/i },
    { key: 'tech', label: 'Technical Crew', hint: 'Sound, lights, mics, and performance tech support.', match: /tech|sound|light|spot|mic|audio/i },
    { key: 'design', label: 'Design & Construction', hint: 'Set, props, build, paint, strike, and move-out work.', match: /set|build|paint|prop|strike|construction|move/i },
    { key: 'costume', label: 'Costume & Makeup', hint: 'Costume, hair, makeup, laundry, fittings, and visual character support.', match: /costume|makeup|hair|wardrobe|laundry|wash/i },
    { key: 'marketing', label: 'Marketing & Publicity', hint: 'Promotion, photography, video, programs, posters, and social media.', match: /market|photo|video|social|program|poster|promo|publicity|graphic/i },
    { key: 'other', label: 'Other / Flexible', hint: 'Flexible help, custom jobs, deadlines, and production-specific needs.', match: /.*/i },
  ];

  function volunteerDeptForOpp(opp) {
    const haystack = `${opp.volunteer_role || ''} ${opp.production_title || ''} ${opp.summary || ''} ${opp.description || ''}`;
    return VOLUNTEER_DEPARTMENTS.find(d => d.key !== 'other' && d.match.test(haystack)) || VOLUNTEER_DEPARTMENTS[VOLUNTEER_DEPARTMENTS.length - 1];
  }

  // ── Portal session gating ─────────────────────────────────────────────
  function getPortalSession() {
    try {
      const raw = sessionStorage.getItem('bts-team-portal-v1');
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function hasMenuKey(session, key) {
    return !!(session && Array.isArray(session.menuKeys) && session.menuKeys.indexOf(key) !== -1);
  }

  // Mirrors DEPT_LEAD_ROLE_TO_GROUP_KEY in departments-dashboard.html, mapped onto
  // VOLUNTEER_DEPARTMENTS' short keys instead of department-config group keys.
  // Treasurer and any role not listed here (incl. plain "Volunteer") are left
  // unscoped — only named Dept Lead roles get narrowed to their own department.
  const DEPT_LEAD_ROLE_TO_VOL_DEPT_KEY = {
    'stage manager': 'backstage',
    'front of house manager': 'foh',
    'concession manager': 'foh',
    'lighting designer/technician': 'tech',
    'lighting designer / technician': 'tech',
    'sound / audio technician': 'tech',
    'lead builder': 'design',
    'lead set painter': 'design',
    'lead prop person': 'design',
    'costume designer': 'costume',
    'hair & makeup lead': 'costume',
    'marketing director': 'marketing',
    'cast party coordinator': 'backstage',
  };

  // Returns a VOLUNTEER_DEPARTMENTS key to scope to, or null for unrestricted
  // (no session, Treasurer, full producer, or any role outside the dept-lead map).
  function scopeDeptKeyForSession(session) {
    if (!session) return null;
    const role = String(session.role || '').trim().toLowerCase();
    if (!role) return null;
    return DEPT_LEAD_ROLE_TO_VOL_DEPT_KEY[role] || null;
  }

  function heroHtml(kicker, title, copy) {
    return '<div class="aud-visual-hero" style="margin-bottom:0.75rem;">' +
      '<div class="aud-visual-hero-content"><div>' +
      '<div class="aud-visual-kicker"><span class="aud-visual-kicker-dot" aria-hidden="true"></span>' +
      '<span class="page-hierarchy"><span class="page-hierarchy-page">Volunteers</span><span class="page-hierarchy-sep"> - </span><span class="page-hierarchy-sub">' + esc(kicker) + '</span></span></div>' +
      '<h1 class="aud-visual-title">' + esc(title) + '</h1>' +
      (copy ? '<p class="aud-visual-copy">' + esc(copy) + '</p>' : '') +
      '</div></div></div>';
  }

  function accessDeniedHtml(pageLabel) {
    return heroHtml(pageLabel, 'Access restricted', '') +
      '<div class="vol-empty-board"><div class="vol-empty-board-title">You do not have access to this page</div>' +
      '<div class="vol-dept-sub">Ask a producer to grant access to ' + esc(pageLabel) + ' from Manage Access.</div></div>';
  }

  function volunteerBrandTileHtml({ mode = 'content', bg = '#572e88', ink = '#ffffff', kicker = '', title = '', body = '', footer = '' }) {
    return `
      <div class="template-brand-card template-brand-card--${esc(mode)}" style="--brand-tile-bg:${esc(bg)};--brand-tile-ink:${esc(ink)};">
        <div class="template-brand-card-inner">
          <div class="template-brand-tile-content">
            <div class="template-brand-tile-container template-brand-tile-container--header">${kicker}</div>
            <div class="template-brand-tile-container template-brand-tile-container--title">${title}</div>
            <div class="template-brand-tile-container template-brand-tile-container--body">${body}</div>
            <div class="template-brand-tile-container template-brand-tile-container--footer">${footer}</div>
          </div>
        </div>
      </div>`;
  }

  // ── Opportunities controller: load/CRUD/modal/role card, shared across the
  // Suggestions/Roles/Publish/Share pages so each page only needs to build its
  // own layout on top of ctrl.opportunities. ──────────────────────────────
  const OPP_MODAL_ID = 'bts-vol-opp-modal';

  function ensureOppModalMounted() {
    if (document.getElementById(OPP_MODAL_ID)) return;
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="modal-overlay" id="${OPP_MODAL_ID}">
        <div class="modal modal-wide">
          <div class="modal-header">
            <div class="modal-title" id="voc-modal-title">New Opportunity</div>
            <button class="modal-close" type="button" aria-label="Close" onclick="window.__voc.closeModal()">&#10005;</button>
          </div>
          <div class="form-error-msg" id="voc-error"></div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Type</label>
              <select class="form-select" id="voc-type">
                <option value="volunteer">Volunteer</option>
                <option value="creative_team">Creative Team</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Format</label>
              <select class="form-select" id="voc-mode">
                <option value="In Person">In Person</option>
                <option value="Virtual">Video Call / Self Tape</option>
                <option value="Hybrid">In Person / Video Call / Self Tape</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Role title</label>
            <input class="form-input" id="voc-prod-title" type="text" placeholder="e.g. Performance Ushers, Set Strike Crew" />
          </div>
          <div class="form-group">
            <label class="form-label">Summary <span class="opt">(shown on cards)</span></label>
            <textarea class="form-textarea" id="voc-summary" rows="2" style="min-height:64px;" placeholder="One or two sentences people see before clicking View Details."></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Location</label>
              <input class="form-input" id="voc-location" type="text" placeholder="e.g. Courtenay, BC" />
            </div>
            <div class="form-group">
              <label class="form-label">Cover Image URL <span class="opt">(optional)</span></label>
              <input class="form-input" id="voc-image" type="url" placeholder="https://..." />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Opens</label>
              <input class="form-input" id="voc-open-date" type="date" />
            </div>
            <div class="form-group">
              <label class="form-label">Sign-up deadline <span class="opt">(optional)</span></label>
              <input class="form-input" id="voc-close-date" type="date" />
            </div>
          </div>
          <div class="opp-section-header">Volunteer Details</div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Department / Group <span class="opt">(optional)</span></label>
              <input class="form-input" id="voc-vol-role" type="text" placeholder="e.g. Front of House, Backstage, Tech" />
            </div>
            <div class="form-group">
              <label class="form-label">Date, shift, or time commitment <span class="opt">(optional)</span></label>
              <input class="form-input" id="voc-vol-time" type="text" placeholder="e.g. Performance nights, June 3 at 6 PM, or flexible" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Volunteers needed <span class="opt">(optional)</span></label>
              <input class="form-input" id="voc-vol-needed" type="number" min="1" max="999" placeholder="e.g. 4" />
            </div>
            <div class="form-group">
              <label class="form-label">Age / Other Requirements <span class="opt">(optional)</span></label>
              <input class="form-input" id="voc-vol-age" type="text" placeholder="e.g. Must be 16+, no experience needed" />
            </div>
          </div>
          <div class="opp-section-header">Full Description</div>
          <div class="form-group">
            <textarea class="form-textarea" id="voc-description" rows="4" placeholder="Describe the production, the opportunity, and what applicants can expect..."></textarea>
          </div>
          <div style="display:flex;gap:0.6rem;margin-top:0.25rem;">
            <button class="btn-primary" id="voc-save-btn" onclick="window.__voc.submit(false)" style="flex:1;justify-content:center;">Save as Draft</button>
            <button class="btn-primary" id="voc-publish-btn" onclick="window.__voc.submit(true)" style="flex:1;justify-content:center;background:#769e7b;color:#fff;">Save &amp; Publish</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(div.firstElementChild);
  }

  function createOppController(opts) {
    const { sb, prodId, orgId, orgName, onChange } = opts;
    const ctrl = {
      opportunities: [],
      editingId: null,

      async load() {
        try {
          const { data, error } = await sb.from('opportunities').select('*')
            .eq('production_id', prodId)
            .in('opportunity_type', ['volunteer', 'creative_team'])
            .order('created_at', { ascending: false });
          if (error) throw error;
          ctrl.opportunities = data || [];
        } catch (e) {
          console.warn('[BTS] volunteers load error:', e?.message);
          ctrl.opportunities = [];
        }
        if (onChange) onChange();
      },

      roleCardHtml(opp) {
        const typeClass = opp.opportunity_type === 'volunteer' ? 'opp-type-volunteer' : 'opp-type-audition';
        const typeLabel = opp.opportunity_type === 'creative_team' ? 'Creative Team' : 'Volunteer';
        const statusClass = `opp-status-${opp.status || 'draft'}`;
        const statusLabel = (opp.status || 'draft').charAt(0).toUpperCase() + (opp.status || 'draft').slice(1);
        const closeDate = opp.close_date ? `Deadline ${fmtDate(opp.close_date)}` : 'No deadline';
        const loc = opp.location_text || '';
        const isPublished = opp.status === 'published';
        const missingDesc = isPublished && !opp.summary && !opp.description;
        const missingDates = !opp.time_commitment && !opp.close_date;
        const displayTime = opp.time_commitment || '';
        return `
          <div class="vol-role-card"${missingDesc ? ' style="border-color:rgba(221,130,51,0.38);"' : ''}>
            <div class="vol-role-top">
              <div style="min-width:0;flex:1;">
                <div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;">
                  <div class="vol-role-title">${esc(opp.production_title)}</div>
                  ${opp.volunteers_needed ? `<span class="vol-role-needs">${esc(String(opp.volunteers_needed))} needed</span>` : ''}
                </div>
                <div class="vol-role-meta">${esc(opp.volunteer_role || typeLabel)}${displayTime ? ` &middot; ${esc(displayTime)}` : ''}${loc ? ` &middot; ${esc(loc)}` : ''} &middot; ${esc(closeDate)}</div>
                ${missingDesc ? `<div class="vol-role-warning">Missing description &mdash; families cannot tell what this role involves.</div>` : ''}
                ${missingDates && isPublished ? `<div class="vol-role-warning">No dates or shifts set on this published role.</div>` : ''}
              </div>
              <span class="opp-status-badge ${statusClass}">${statusLabel}</span>
            </div>
            <div class="opp-card-meta" style="margin-top:0.55rem;">
              <span class="opp-type-badge ${typeClass}">${typeLabel}</span>
              ${opp.summary ? `<span>${esc(opp.summary)}</span>` : ''}
            </div>
            <div class="vol-role-actions">
              ${isPublished ? `<a href="/volunteer/signup?id=${esc(opp.id)}" target="_blank" class="btn-secondary" style="font-size:0.76rem;padding:0.34rem 0.72rem;text-decoration:none;">View sign-up</a>` : ''}
              <button class="btn-secondary" style="font-size:0.76rem;padding:0.34rem 0.72rem;" onclick="window.__voc.openEdit('${esc(opp.id)}')">Edit</button>
              <button class="${isPublished ? 'btn-danger' : 'btn-primary'}" style="font-size:0.76rem;padding:0.34rem 0.8rem;" onclick="window.__voc.togglePublish('${esc(opp.id)}','${esc(opp.status || 'draft')}')">${isPublished ? 'Unpublish' : 'Publish'}</button>
              <button class="btn-secondary" style="font-size:0.76rem;padding:0.34rem 0.6rem;color:#b91c1c;border-color:rgba(200,40,40,0.22);" onclick="window.__voc.remove('${esc(opp.id)}')" title="Delete">&#10005;</button>
            </div>
          </div>`;
      },

      openCreate(preset) {
        ensureOppModalMounted();
        ctrl.editingId = null;
        ctrl._fill(null, preset);
        document.getElementById('voc-modal-title').textContent = 'Create Internal Role';
        document.getElementById(OPP_MODAL_ID).classList.add('open');
      },
      openEdit(oppId) {
        ensureOppModalMounted();
        const opp = ctrl.opportunities.find(o => String(o.id) === String(oppId));
        ctrl.editingId = oppId;
        ctrl._fill(opp, null);
        document.getElementById('voc-modal-title').textContent = 'Edit Volunteer Role';
        document.getElementById(OPP_MODAL_ID).classList.add('open');
      },
      _fill(opp, preset) {
        document.getElementById('voc-error').classList.remove('visible');
        document.getElementById('voc-type').value = opp?.opportunity_type || preset?.opportunity_type || 'volunteer';
        document.getElementById('voc-mode').value = opp?.mode_tag || preset?.mode_tag || 'In Person';
        document.getElementById('voc-prod-title').value = opp?.production_title || preset?.production_title || '';
        document.getElementById('voc-summary').value = opp?.summary || preset?.summary || '';
        document.getElementById('voc-location').value = opp?.location_text || preset?.location_text || '';
        document.getElementById('voc-image').value = opp?.primary_image_url || preset?.primary_image_url || '';
        document.getElementById('voc-open-date').value = opp?.open_date || preset?.open_date || '';
        document.getElementById('voc-close-date').value = opp?.close_date || preset?.close_date || '';
        document.getElementById('voc-description').value = opp?.description || preset?.description || '';
        document.getElementById('voc-vol-role').value = opp?.volunteer_role || preset?.volunteer_role || '';
        document.getElementById('voc-vol-time').value = opp?.time_commitment || preset?.time_commitment || '';
        document.getElementById('voc-vol-age').value = opp?.age_requirements || preset?.age_requirements || '';
        document.getElementById('voc-vol-needed').value = opp?.volunteers_needed || preset?.volunteers_needed || '';
      },
      closeModal() {
        const el = document.getElementById(OPP_MODAL_ID);
        if (el) el.classList.remove('open');
        ctrl.editingId = null;
      },
      async submit(publish) {
        const errEl = document.getElementById('voc-error');
        errEl.classList.remove('visible');
        const title = document.getElementById('voc-prod-title').value.trim();
        if (!title) { errEl.textContent = 'Opportunity title is required.'; errEl.classList.add('visible'); return; }
        if (publish) {
          const summaryVal = document.getElementById('voc-summary').value.trim();
          const descVal = document.getElementById('voc-description').value.trim();
          if (!summaryVal && !descVal) {
            errEl.textContent = 'Add a summary or description before publishing. Families need to know what this role involves.';
            errEl.classList.add('visible');
            return;
          }
        }
        const saveBtn = document.getElementById('voc-save-btn');
        const pubBtn = document.getElementById('voc-publish-btn');
        saveBtn.disabled = pubBtn.disabled = true;
        const payload = {
          opportunity_type: document.getElementById('voc-type').value,
          mode_tag: document.getElementById('voc-mode').value,
          production_title: title,
          organization_name: orgName || '',
          organization_id: orgId || null,
          production_id: prodId,
          summary: document.getElementById('voc-summary').value.trim() || null,
          location_text: document.getElementById('voc-location').value.trim() || null,
          primary_image_url: document.getElementById('voc-image').value.trim() || null,
          open_date: document.getElementById('voc-open-date').value || null,
          close_date: document.getElementById('voc-close-date').value || null,
          description: document.getElementById('voc-description').value.trim() || null,
          status: publish ? 'published' : 'draft',
          volunteer_role: document.getElementById('voc-vol-role').value.trim() || null,
          time_commitment: document.getElementById('voc-vol-time').value.trim() || null,
          age_requirements: document.getElementById('voc-vol-age').value.trim() || null,
          volunteers_needed: parseInt(document.getElementById('voc-vol-needed').value, 10) || null,
        };
        let error;
        try {
          if (ctrl.editingId) {
            ({ error } = await sb.from('opportunities').update(payload).eq('id', ctrl.editingId));
          } else {
            ({ error } = await sb.from('opportunities').insert(payload));
          }
        } catch (err) {
          error = err;
        } finally {
          saveBtn.disabled = pubBtn.disabled = false;
        }
        if (error) { errEl.textContent = error.message; errEl.classList.add('visible'); return; }
        ctrl.closeModal();
        await ctrl.load();
      },
      async togglePublish(id, currentStatus) {
        const newStatus = currentStatus === 'published' ? 'draft' : 'published';
        const label = newStatus === 'published' ? 'publish' : 'unpublish';
        if (!confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} this opportunity?`)) return;
        const { error } = await sb.from('opportunities').update({ status: newStatus }).eq('id', id);
        if (error) { alert('Could not update: ' + error.message); return; }
        await ctrl.load();
      },
      async remove(id) {
        const opp = ctrl.opportunities.find(o => String(o.id) === String(id));
        const isPublished = opp?.status === 'published';
        const msg = isPublished
          ? 'This role is published and families may already have the sign-up link.\n\nDeleting it removes the public link permanently.\n\nDelete anyway?'
          : 'Delete this role? This cannot be undone.';
        if (!confirm(msg)) return;
        const { error } = await sb.from('opportunities').delete().eq('id', id);
        if (error) { alert('Could not delete: ' + error.message); return; }
        await ctrl.load();
      },
    };
    ensureOppModalMounted();
    window.__voc = ctrl;
    return ctrl;
  }

  // Mirrors buildVolunteerSuggestions() in production-workspace.js — needs the
  // production_events list (for per-event-type counts) plus the current
  // opportunities list (so already-created roles are not suggested again).
  function buildVolunteerSuggestions(events, opportunities) {
    function volCrewSubtypeFromTitle(title) {
      if (/costume/i.test(title)) return 'crew_costumes';
      if (/prop/i.test(title)) return 'crew_props';
      if (/paint/i.test(title)) return 'crew_set_painting';
      if (/(hair|make.?up)/i.test(title)) return 'crew_hair_makeup';
      if (/wig/i.test(title)) return 'crew_wigs';
      if (/light/i.test(title)) return 'crew_lighting';
      if (/sound/i.test(title)) return 'crew_sound';
      if (/(set\s*(build|dress)|build|construction)/i.test(title)) return 'crew_set';
      return null;
    }
    function volCalendarEventType(event = {}) {
      const rawType = event.event_type || 'event';
      const title = String(event.title || '').trim();
      if (event.is_deadline || rawType === 'deadline') return 'deadline';
      if (/cast\s*party/i.test(title)) return 'cast_party';
      if (rawType === 'crew') return volCrewSubtypeFromTitle(title) || rawType;
      return rawType;
    }
    const counts = (events || []).reduce((acc, ev) => {
      const k = volCalendarEventType(ev);
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const suggestions = [];
    const add = (title, department, reason, timeCommitment = '') => {
      const exists = (opportunities || []).some(opp => {
        const haystack = `${opp.production_title || ''} ${opp.volunteer_role || ''}`.toLowerCase();
        return haystack.includes(title.toLowerCase());
      });
      if (!exists) suggestions.push({ title, department, reason, timeCommitment });
    };
    if ((counts.performance || 0) > 0) {
      add('Performance Ushers', 'Front of House', `${counts.performance} performance${counts.performance === 1 ? '' : 's'} on the calendar`, 'Performance dates - shifts can vary');
      add('Concession Workers', 'Front of House', 'Audience breaks and intermission sales need coverage', 'Performance dates or flexible baking/drop-off');
      add('Backstage Crew', 'Backstage & Rehearsal Support', 'Performances need backstage support and scene-change help', 'Performance dates');
    }
    if ((counts.tech || 0) + (counts.dress || 0) > 0) {
      add('Mic Wrangler', 'Technical Crew', 'Tech/dress events usually need mic handoff and battery support', 'Tech week and performances');
      add('Quick-Change Assistant', 'Backstage & Rehearsal Support', 'Costume changes during tech/dress often need an extra pair of hands', 'Tech week and performances');
    }
    if ((counts.crew || 0) + (counts.crew_set || 0) + (counts.crew_set_painting || 0) + (counts.crew_props || 0) > 0) {
      add('Set Builders', 'Design & Construction', 'Build days are on the calendar', 'Flexible, build days');
      add('Set Painter', 'Design & Construction', 'Painting days help finish the set', 'Flexible, build days');
    }
    if ((counts.strike || 0) > 0) {
      add('Set Strike Crew', 'Design & Construction', 'A strike date is on the calendar', 'Strike date');
    }
    if ((counts.crew_costumes || 0) > 0 || (counts.costume_moveout || 0) > 0) {
      add('Costume Helper', 'Costume & Makeup', 'Costume work sessions are on the calendar', 'Flexible');
    }
    if ((counts.cast_party || 0) > 0) {
      add('Cast Party Helper', 'Backstage & Rehearsal Support', 'A cast party is on the calendar', 'Cast party date');
    }
    add('Marketing / Promotion Distribution', 'Marketing & Publicity', 'Every production needs posters, flyers, and social media help', 'Flexible');
    return suggestions.slice(0, 6);
  }

  window.BTSVolShared = {
    SB_URL, SB_ANON, esc, fmtDate, heroHtml, accessDeniedHtml, volunteerBrandTileHtml,
    VOLUNTEER_DEPARTMENTS, volunteerDeptForOpp,
    getPortalSession, hasMenuKey, scopeDeptKeyForSession,
    createOppController, buildVolunteerSuggestions,
  };
})();
