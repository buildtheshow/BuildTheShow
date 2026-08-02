/* volunteer-roles.js — Volunteer Roles standalone module.
   Mirrors the Roles sub-tab of renderOpportunities() in production-workspace.js
   (departmentHtml block: department board of internal roles). Gated on 'vol:roles'. */
(function () {
  'use strict';

  window.VolunteerRolesModule = {
    async init(prodId, container) {
      const S = window.BTSVolShared;
      if (!prodId || !container) return;

      const session = S.getPortalSession();
      if (session && !S.hasMenuKey(session, 'vol:roles')) {
        container.innerHTML = S.accessDeniedHtml('Roles');
        return;
      }

      container.innerHTML = S.heroHtml('Roles', 'Internal roles', 'Clean up the role list before families see it. Drafts stay private until you publish them.') +
        '<div id="vr-body">Loading roles...</div>';

      const sb = supabase.createClient(S.SB_URL, S.SB_ANON);
      const scopeDeptKey = S.scopeDeptKeyForSession(session);

      const { data: prod } = await sb.from('productions').select('id, title, organization_id').eq('id', prodId).single();
      let orgName = '';
      if (prod?.organization_id) {
        const { data: org } = await sb.from('organizations').select('name').eq('id', prod.organization_id).single();
        orgName = org?.name || '';
      }

      const ctrl = S.createOppController({
        sb, prodId, orgId: prod?.organization_id, orgName,
        onChange: render,
      });
      await ctrl.load();

      window.__volCreateRole = function () { ctrl.openCreate(); };

      function render() {
        const body = document.getElementById('vr-body');
        if (!body) return;
        let opportunities = ctrl.opportunities;
        if (scopeDeptKey) {
          opportunities = opportunities.filter(opp => S.volunteerDeptForOpp(opp).key === scopeDeptKey);
        }
        const departmentMap = new Map(S.VOLUNTEER_DEPARTMENTS.map(dept => [dept.key, { ...dept, roles: [] }]));
        opportunities.forEach(opp => {
          const dept = S.volunteerDeptForOpp(opp);
          departmentMap.get(dept.key).roles.push(opp);
        });
        let departments = [...departmentMap.values()];
        if (scopeDeptKey) departments = departments.filter(d => d.key === scopeDeptKey);
        const activeDepartments = departments.filter(dept => dept.roles.length);
        const emptyDepartments = departments.filter(dept => !dept.roles.length);

        body.innerHTML = `
          <div>
            <div style="display:flex;justify-content:space-between;gap:1rem;align-items:center;margin-bottom:0.75rem;">
              <div>
                <div class="vol-section-title">Departments and roles</div>
                <div class="vol-dept-sub">Keep roles as drafts while planning. Publish when families should sign up.</div>
              </div>
              <button class="btn-primary" style="font-size:0.8rem;" onclick="window.__volCreateRole()">+ Create Internal Role</button>
            </div>
            ${opportunities.length ? `
              <div class="vol-dept-grid">
                ${activeDepartments.map(dept => `
                  <div class="vol-dept-card">
                    <div class="vol-dept-head">
                      <div>
                        <div class="vol-section-title">${S.esc(dept.label)}</div>
                        <div class="vol-dept-sub">${S.esc(dept.hint)}</div>
                      </div>
                      <div class="vol-dept-count">${dept.roles.length}</div>
                    </div>
                    <div class="vol-role-stack">
                      ${dept.roles.map(o => ctrl.roleCardHtml(o)).join('')}
                    </div>
                  </div>`).join('')}
              </div>
              ${emptyDepartments.length ? `
                <div class="vol-empty-board" style="margin-top:0.85rem;">
                  <div>
                    <div class="vol-empty-board-title">Departments still open</div>
                    <div class="vol-dept-sub">These groups do not have internal roles yet. Add them only when they matter for this production.</div>
                  </div>
                  <div class="vol-dept-pill-row">${emptyDepartments.map(dept => `<span class="vol-dept-pill">${S.esc(dept.label)}</span>`).join('')}</div>
                </div>` : ''}
            ` : `
              <div class="vol-empty-board">
                  <div class="vol-dept-head">
                    <div>
                      <div class="vol-empty-board-title">Create the first internal role</div>
                      <div class="vol-dept-sub">Start with a calendar suggestion, or make a custom role for a department you already know you need.</div>
                    </div>
                    <button class="btn-primary" style="font-size:0.8rem;" onclick="window.__volCreateRole()">+ Create Internal Role</button>
                  </div>
                  <div class="vol-dept-pill-row">${departments.map(dept => `<span class="vol-dept-pill">${S.esc(dept.label)}</span>`).join('')}</div>
              </div>`}
          </div>`;
      }
      render();
    },
    destroy() { delete window.__volCreateRole; delete window.__voc; },
  };
})();
