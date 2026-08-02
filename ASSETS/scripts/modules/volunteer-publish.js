/* volunteer-publish.js — Volunteer Publish standalone module.
   Mirrors the Publish sub-tab of renderOpportunities() in production-workspace.js
   (publishHtml block: draft roles vs published sign-ups). Gated on 'vol:publish'.
   Not department-scoped per the spec — Publish is a producer/treasurer-level
   step (Dept Leads get Suggestions/Roles/Requests scoped, not Publish). */
(function () {
  'use strict';

  window.VolunteerPublishModule = {
    async init(prodId, container) {
      const S = window.BTSVolShared;
      if (!prodId || !container) return;

      const session = S.getPortalSession();
      if (session && !S.hasMenuKey(session, 'vol:publish')) {
        container.innerHTML = S.accessDeniedHtml('Publish');
        return;
      }

      container.innerHTML = S.heroHtml('Publish', 'Ready to publish', 'Publish only the roles families should sign up for right now. Everything else can stay internal.') +
        '<div id="vp-body">Loading roles...</div>';

      const sb = supabase.createClient(S.SB_URL, S.SB_ANON);
      const { data: prod } = await sb.from('productions').select('id, title, organization_id').eq('id', prodId).single();
      let orgName = '';
      if (prod?.organization_id) {
        const { data: org } = await sb.from('organizations').select('name').eq('id', prod.organization_id).single();
        orgName = org?.name || '';
      }

      const ctrl = S.createOppController({ sb, prodId, orgId: prod?.organization_id, orgName, onChange: render });
      await ctrl.load();

      function render() {
        const body = document.getElementById('vp-body');
        if (!body) return;
        const drafts = ctrl.opportunities.filter(opp => opp.status !== 'published');
        const published = ctrl.opportunities.filter(opp => opp.status === 'published');
        body.innerHTML = `
          <div class="vol-dept-grid">
            <div class="vol-dept-card">
              <div class="vol-dept-head">
                <div>
                  <div class="vol-section-title">Draft roles</div>
                  <div class="vol-dept-sub">Private until published.</div>
                </div>
                <div class="vol-dept-count">${drafts.length}</div>
              </div>
              <div class="vol-role-stack">${drafts.length ? drafts.map(o => ctrl.roleCardHtml(o)).join('') : '<div class="vol-empty-dept">No draft roles waiting to publish.</div>'}</div>
            </div>
            <div class="vol-dept-card">
              <div class="vol-dept-head">
                <div>
                  <div class="vol-section-title">Published sign-ups</div>
                  <div class="vol-dept-sub">Visible to families on public links.</div>
                </div>
                <div class="vol-dept-count">${published.length}</div>
              </div>
              <div class="vol-role-stack">${published.length ? published.map(o => ctrl.roleCardHtml(o)).join('') : '<div class="vol-empty-dept">No volunteer sign-ups are public yet.</div>'}</div>
            </div>
          </div>`;
      }
      render();
    },
    destroy() { delete window.__voc; },
  };
})();
