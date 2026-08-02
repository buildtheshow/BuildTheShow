/* volunteer-suggestions.js — Volunteer Suggestions standalone module.
   Mirrors the Suggestions sub-tab of renderOpportunities() in production-workspace.js
   (suggestionHtml block + openVolunteerSuggestion). Gated on menu key 'vol:suggestions'. */
(function () {
  'use strict';

  window.VolunteerSuggestionsModule = {
    async init(prodId, container) {
      const S = window.BTSVolShared;
      if (!prodId || !container) return;

      const session = S.getPortalSession();
      if (session && !S.hasMenuKey(session, 'vol:suggestions')) {
        container.innerHTML = S.accessDeniedHtml('Suggestions');
        return;
      }

      container.innerHTML = S.heroHtml('Suggestions', 'Calendar suggestions', 'Turn rehearsals, tech, performances, and strike into role drafts. Nothing here is public yet.') +
        '<div id="vs-body">Loading suggestions...</div>';

      const sb = supabase.createClient(S.SB_URL, S.SB_ANON);
      const scopeDeptKey = S.scopeDeptKeyForSession(session);

      const [prodRes, eventsRes] = await Promise.all([
        sb.from('productions').select('id, title, organization_id').eq('id', prodId).single(),
        sb.from('production_events').select('id,title,event_type,start_time,end_time,is_deadline').eq('production_id', prodId).order('start_time'),
      ]);
      const prod = prodRes.data || {};
      let orgName = '';
      if (prod.organization_id) {
        const { data: org } = await sb.from('organizations').select('name').eq('id', prod.organization_id).single();
        orgName = org?.name || '';
      }
      const events = eventsRes.data || [];

      const palette = [
        { bg: '#572e88', ink: '#ffffff' }, { bg: '#efab45', ink: '#000000' },
        { bg: '#476aaa', ink: '#ffffff' }, { bg: '#769e7b', ink: '#ffffff' },
        { bg: '#ca7ea7', ink: '#ffffff' }, { bg: '#dd8233', ink: '#ffffff' },
      ];

      // Recomputed on every render so newly-created roles drop off the
      // suggestion list immediately (buildVolunteerSuggestions skips titles
      // that already exist among ctrl.opportunities).
      let suggestions = [];
      function computeSuggestions() {
        suggestions = S.buildVolunteerSuggestions(events, ctrl.opportunities);
        if (scopeDeptKey) {
          const deptLabel = (S.VOLUNTEER_DEPARTMENTS.find(d => d.key === scopeDeptKey) || {}).label || '';
          suggestions = suggestions.filter(s => s.department === deptLabel);
        }
      }

      const ctrl = S.createOppController({
        sb, prodId, orgId: prod.organization_id, orgName,
        onChange: render,
      });
      await ctrl.load();

      window.__volUseSuggestion = function (i) {
        const suggestion = suggestions[i];
        if (!suggestion) return;
        ctrl.openCreate({
          production_title: suggestion.title,
          volunteer_role: suggestion.department,
          summary: `Help with ${suggestion.department.toLowerCase()} for ${prod?.title || 'this production'}.`,
          time_commitment: suggestion.timeCommitment || '',
          description: `${suggestion.reason}. Add specific dates, duties, and call times before publishing.`,
        });
      };

      function render() {
        const body = document.getElementById('vs-body');
        if (!body) return;
        computeSuggestions();
        body.innerHTML = `
          <div class="vol-suggestions" id="vol-calendar-suggestions">
            <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;flex-wrap:wrap;">
              <div>
                <div class="vol-section-title">Generated from calendar</div>
                <div class="vol-dept-sub">${events.length ? 'Suggested roles based on your production schedule.' : 'Add production calendar dates first.'}</div>
              </div>
            </div>
            ${suggestions.length ? `
              <div class="vol-suggestion-grid">
                ${suggestions.map((item, i) => S.volunteerBrandTileHtml({
                  mode: 'content',
                  bg: palette[i % palette.length].bg,
                  ink: palette[i % palette.length].ink,
                  kicker: `<div class="template-brand-tile-kicker">${S.esc(item.department)}</div>`,
                  title: `<div class="template-brand-tile-title">${S.esc(item.title)}</div>`,
                  body: `<div class="template-brand-tile-body">${S.esc(item.reason)}</div>`,
                  footer: `<button type="button" class="template-brand-tile-button" onclick="window.__volUseSuggestion(${i})">Use suggestion</button>`,
                })).join('')}
              </div>` : `
              <div class="vol-empty-dept" style="margin-top:0.8rem;">No suggestions yet. You can still create a custom internal role.</div>`}
          </div>`;
      }
      render();
    },
    destroy() { delete window.__volUseSuggestion; delete window.__voc; },
  };
})();
