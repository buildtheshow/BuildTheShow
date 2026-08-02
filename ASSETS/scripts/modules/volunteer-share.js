/* volunteer-share.js — Volunteer Share standalone module.
   Mirrors the Share sub-tab of renderOpportunities() in production-workspace.js
   (shareHtml block: public volunteer page + best-fit quiz + published role links).
   Gated on 'vol:share'. Not department-scoped (producer/treasurer-level step). */
(function () {
  'use strict';

  window.VolunteerShareModule = {
    async init(prodId, container) {
      const S = window.BTSVolShared;
      if (!prodId || !container) return;

      const session = S.getPortalSession();
      if (session && !S.hasMenuKey(session, 'vol:share')) {
        container.innerHTML = S.accessDeniedHtml('Share');
        return;
      }

      container.innerHTML = S.heroHtml('Share', 'Share with families', 'Use the quiz when people do not know where they fit. Use sign-up links when you need a specific job filled.') +
        '<div id="vsh-body">Loading...</div>';

      const sb = supabase.createClient(S.SB_URL, S.SB_ANON);
      const { data: prod } = await sb.from('productions').select('id, title, slug, organization_id').eq('id', prodId).single();
      let orgSlug = '';
      if (prod?.organization_id) {
        const { data: org } = await sb.from('organizations').select('slug').eq('id', prod.organization_id).single();
        orgSlug = org?.slug || '';
      }

      function volunteerPublicPageUrl() {
        if (orgSlug && prod?.slug) return `/${encodeURIComponent(orgSlug)}/${encodeURIComponent(prod.slug)}/volunteers`;
        const url = new URL('/volunteers', window.location.origin);
        if (prodId) url.searchParams.set('prod', prodId);
        return url.pathname + url.search;
      }
      function volunteerQuizPageUrl() {
        const url = new URL('/volunteer-quiz', window.location.origin);
        if (prodId) url.searchParams.set('prod', prodId);
        return url.pathname + url.search;
      }
      window.__volOpenPublicPage = function () { window.open(volunteerPublicPageUrl(), '_blank', 'noopener'); };
      window.__volOpenQuizPage = function () { window.open(volunteerQuizPageUrl(), '_blank', 'noopener'); };

      const ctrl = S.createOppController({ sb, prodId, orgId: prod?.organization_id, orgName: '', onChange: render });
      await ctrl.load();

      function render() {
        const body = document.getElementById('vsh-body');
        if (!body) return;
        const published = ctrl.opportunities.filter(opp => opp.status === 'published');
        body.innerHTML = `
          <div class="vol-dept-grid">
            <div class="vol-dept-card">
              <div class="vol-section-title">Volunteer page</div>
              <div class="vol-dept-sub" style="margin-top:0.35rem;">One public page for available volunteer opportunities.</div>
              <div class="vol-role-actions"><button type="button" class="btn-primary" style="font-size:0.78rem;" onclick="window.__volOpenPublicPage()">Open volunteer page</button></div>
            </div>
            <div class="vol-dept-card">
              <div class="vol-section-title">Best-fit quiz</div>
              <div class="vol-dept-sub" style="margin-top:0.35rem;">Helps families find a role by preference, energy, and comfort level.</div>
              <div class="vol-role-actions"><button type="button" class="btn-primary" style="font-size:0.78rem;" onclick="window.__volOpenQuizPage()">Open quiz</button></div>
            </div>
            <div class="vol-dept-card">
              <div class="vol-section-title">Published role links</div>
              <div class="vol-role-stack" style="margin-top:0.65rem;">${published.length ? published.map(o => ctrl.roleCardHtml(o)).join('') : '<div class="vol-empty-dept">Publish at least one role before sending direct sign-up links.</div>'}</div>
            </div>
          </div>`;
      }
      render();
    },
    destroy() { delete window.__volOpenPublicPage; delete window.__volOpenQuizPage; delete window.__voc; },
  };
})();
