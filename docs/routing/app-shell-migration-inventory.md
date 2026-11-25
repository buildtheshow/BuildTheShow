# App navigation and route migration inventory

Read-only starting inventory for the persistent-shell migration. It records current source pages and routing mechanisms; it does not decide which destinations to remove or rename. Sidebar destinations must be preserved unless Katie approves a change.

## Current footprint

- Member-facing source pages: 23, including the shared My Home document.
- Organisation and production source pages: 123.
- Public, applicant, and account-entry source pages: 23.
- There are 169 HTML files across the Member, Organisation, and Public trees. Some source pages are legacy aliases or internal screens, not separate product destinations.
- Production workspace currently mixes an internal workspace route with separate tool-page routes. The Cloudflare middleware maps both to complete HTML documents.
- The Member sidebar is assembled by `ASSETS/scripts/member-sidebar.js`; the Organisation navigation lives in `org-dashboard.html`; the Production sidebar is shared in `SHARED/Navigation/production-sidebar.html`.
- Normal production navigation mixes in-page workspace state and full-document tool navigation. Active state, context, and loading behaviour therefore have more than one owner.
- Large legacy surfaces to split carefully: `production-workspace.html` (27,662 lines), `production-workspace.js` (49,518 lines), `audition-team.html` (62,071 lines), and `org-dashboard.html` (8,636 lines).
- Hosting is Cloudflare Pages/Functions and the app is currently static HTML plus JavaScript. No root Vite/React application or root package manifest was found; adding a new build system is a planned platform change, not an existing capability.

## Navigation areas already present

### Member

- Always-visible destinations: My Home, My Activities, My Calendar, My Profile, and Settings. My Circle appears when the member context has at least one circle.
- Position groups: Performer (dashboard, auditions, applications, schedule, media); Creative (dashboard, tasks, files); Volunteer (activities, opportunities, assigned shifts, availability, hours).
- Source: `ASSETS/scripts/member-sidebar.js` and `ASSETS/styles/member-sidebar.css`. `SHARED/Navigation/Member-nav.html` is empty and is not the active nav source.

### Organisation

- One organisation dashboard/sidebar contains Productions, Organisation Team, Proposals, and Settings, with in-page sections including organisation overview, productions, calendar, members, and settings.
- The document owns substantial dashboard, production listing, calendar, member/team, proposal, and settings code. Section changes use in-page rendering and update the URL with `history.replaceState`.
- Source: `SYSTEM/Organisations/org-dashboard.html`. `SHARED/Navigation/Organisation-nav.html` is empty and is not the active nav source.

### Production

- Shared groups: Overview, Plan, Cast, Departments, Promote, Ticketing, Volunteers, Check In, Financials, Wrap-up, Portals/People and Access, Settings, and internal Build tools.
- Existing destinations include rehearsal schedule, auditions, casting board, registration, volunteer roles/requests, programme, sponsors, ticket orders/check-in, budget, reports, and files.
- Source: `SHARED/Navigation/production-sidebar.html`. Navigation logic is split between `production-sidebar-nav.js`, workspace runtime code, and standalone tool pages.

## Routing model today

- `functions/_middleware.js` handles canonical pages, aliases, legacy paths, and route families.
- Member and organisation destinations are mostly served as full static HTML documents; profile routes use dynamic path patterns.
- Production URLs use readable organisation/production slugs, but currently resolve either to the workspace HTML or an explicitly registered standalone tool HTML page.
- Public URLs, auth pages, legacy aliases, submission endpoints, and app pages share the same middleware boundary. Public and auth routes should remain outside the authenticated app shell.
- Existing URL conventions are documented in `docs/routing/url-system.md` and must remain stable during migration.

### Route contract discrepancy to settle before the router is built

- `SHARED/CODEBASE_RULES.md` specifies `/{organisation_slug}/ORG/Productions/{production_slug}/{section}` and nested section routes.
- `docs/routing/url-system.md` and the middleware currently use `/org/{organisation_slug}/productions/{production_slug}` and legacy tool routes under `/tools/{tool}?id={production-id}`.
- The production setup URL shown in the current browser uses the lower-case `/org/{organisation}/productions/{production}/auditions/settings` form.
- Do not introduce a third pattern. For the migration, preserve the current lower-case, organisation-first routes people already use, map old tool links as compatibility aliases, and resolve the production UUID from its authorised slug route. Reconcile the two written specifications before changing any visible URL.

## Complete source-page list

| Context / area | Source file | Current title | Existing route or route family |
|---|---|---|---|
| Member | `SYSTEM/Members/Account/forgot-password.html` | Reset Password - Build The Show | /forgot-password |
| Member | `SYSTEM/Members/Account/login.html` | Log In - Build The Show | /login |
| Member | `SYSTEM/Members/Account/reset-password.html` | Set New Password - Build The Show | /reset-password |
| Member | `SYSTEM/Members/Account/signup.html` | Sign Up - Build The Show | /signup |
| Member | `SYSTEM/Members/Auditions/applications.html` | My Auditions - Build The Show | /member/applications |
| Member | `SYSTEM/Members/Dashboard/member-calendar.html` | My Calendar / Build The Show | /member/calendar |
| Member | `SYSTEM/Members/Dashboard/member-dashboard.html` | My Activities / Build The Show | /member/home (legacy/source alias) |
| Member | `SYSTEM/Members/Households/households.html` | My Circle / Build The Show | /member/households |
| Member | `SYSTEM/Members/Performer/performer-dashboard.html` | Dashboard - Build The Show | /member/performer/dashboard |
| Member | `SYSTEM/Members/Performer/performer-hub.html` | Performer Hub - Build The Show | /member/performer |
| Member | `SYSTEM/Members/Performer/performer-media.html` | Media - Build The Show | /member/media |
| Member | `SYSTEM/Members/Performer/performer-settings.html` | Account settings / Build The Show | /member/settings |
| Member | `SYSTEM/Members/Profiles/profile-access.html` | Member access / Build The Show | /member/access |
| Member | `SYSTEM/Members/Profiles/profile-create.html` | Create Your Profile - Build The Show | /member/profile/create, /member/profiles/new |
| Member | `SYSTEM/Members/Profiles/profile-sections.html` | My Profile / Build The Show | /member/profile/edit, /member/profiles/{profile-id}/edit |
| Member | `SYSTEM/Members/Profiles/profile-select.html` | My Activities / Build The Show | /member/profiles (legacy/source alias) |
| Member | `SYSTEM/Members/Profiles/profile-view.html` | Profile - Build The Show | /member/profile, /member/profiles/{profile-id} |
| Member | `SYSTEM/Members/Profiles/profiles.html` | Profiles - Build The Show | /member/profiles |
| Member | `SYSTEM/Members/Volunteer/volunteer-best-fit.html` | Volunteer Quiz / Build The Show | /member/volunteer/best-fit |
| Member | `SYSTEM/Members/Volunteer/volunteer-hours.html` | My Activities / Build The Show | /member/volunteer/hours |
| Member | `SYSTEM/Members/Volunteer/volunteer-hub.html` | My Activities / Build The Show | /member/volunteer |
| Member | `SYSTEM/Members/Volunteer/volunteer-shifts.html` | My Activities / Build The Show | /member/volunteer/shifts |
| Production casting | `SYSTEM/Organisations/Productions/Casting/casting.html` | Casting Board - Build The Show | /org/production/casting |
| Production casting | `SYSTEM/Organisations/Productions/Casting/in-the-room.html` | In The Room | /org/production/tools/in-the-room |
| Production creative team | `SYSTEM/Organisations/Productions/Creative/creative-files.html` | Files - Build The Show | /member/creative/files |
| Production creative team | `SYSTEM/Organisations/Productions/Creative/creative-hub.html` | Creative Team Hub - Build The Show | /member/creative |
| Production creative team | `SYSTEM/Organisations/Productions/Creative/creative-tasks.html` | Tasks - Build The Show | /member/creative/tasks |
| Production registration | `SYSTEM/Organisations/Productions/Registration/registration-settings.html` | Registration Settings — Build The Show | /org/production/tools/registration-setup |
| Production setup | `SYSTEM/Organisations/Productions/Setup/audition-builder-wizard.html` | Audition Builder - Build The Show | /org/production/audition-builder |
| Production setup | `SYSTEM/Organisations/Productions/Setup/create-production.html` | New Production - Build The Show | Organisation/production route or legacy alias; verify exact mapping |
| Production setup | `SYSTEM/Organisations/Productions/Setup/production-wizard.html` | New Production - Build The Show | /org/production/new |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/audition-team.html` | Production Workspace - Build The Show | /org/{org}/productions/{production}/tools/audition-team, legacy team-access route; resolve before migration |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/auditions-checkin.html` | Check-In - Build The Show | /org/{org}/productions/{production}/tools/auditions-checkin |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/auditions-dashboard.html` | Auditions - Build The Show | /org/{org}/productions/{production}/tools/auditions-dashboard |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/auditions-inroom.html` | In The Room - Build The Show | /org/{org}/productions/{production}/tools/auditions-inroom |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/auditions-performers.html` | Performers - Build The Show | /org/{org}/productions/{production}/tools/auditions-performers |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/auditions-schedule.html` | Audition Schedule - Build The Show | /org/{org}/productions/{production}/tools/auditions-schedule |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/auditions-selftapes.html` | Self Tapes - Build The Show | /org/{org}/productions/{production}/tools/auditions-selftapes |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/auditions-settings.html` | Audition Settings - Build The Show | /org/{org}/productions/{production}/tools/auditions-settings |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/budget-breakdown.html` | Budget Breakdown - Build The Show | /org/{org}/productions/{production}/tools/budget-breakdown |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/budget-collect.html` | Collect - Build The Show | /org/{org}/productions/{production}/tools/budget-collect |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/budget-dashboard.html` | Budget Dashboard - Build The Show | /org/{org}/productions/{production}/tools/budget-dashboard |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/budget-receipts.html` | Receipts - Build The Show | /org/{org}/productions/{production}/tools/budget-receipts |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/budget-submit.html` | Submit a Receipt - Build The Show | /org/{org}/productions/{production}/tools/budget-submit |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/budgeting.html` | Budgeting - Build The Show | /org/{org}/productions/{production}/tools/budgeting |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/cast-checkin.html` | Attendance - Build The Show | /org/{org}/productions/{production}/tools/cast-checkin |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/cast-dashboard.html` | Cast Dashboard - Build The Show | /org/{org}/productions/{production}/tools/cast-dashboard |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/casting-board.html` | Casting Board - Build The Show | /org/{org}/productions/{production}/tools/casting-board |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/casting-castlist.html` | Cast List - Build The Show | /org/{org}/productions/{production}/tools/casting-castlist |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/casting-offers.html` | Casting Offers - Build The Show | /org/{org}/productions/{production}/tools/casting-offers |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/daily-checkin.html` | Sign In & Sign Out - Build The Show | /org/{org}/productions/{production}/tools/daily-checkin |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/department-receipt-form.html` | Department Receipts - Build The Show | /org/{org}/productions/{production}/tools/department-receipt-form |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/department-section.html` | Production Department - Build The Show | /org/{org}/productions/{production}/tools/department-section |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/departments-backstage-receipts.html` | Backstage & Rehearsal Support Receipts - Build The Show | /org/{org}/productions/{production}/tools/departments-backstage-receipts |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/departments-backstage.html` | Backstage & Rehearsal Support - Build The Show | /org/{org}/productions/{production}/tools/departments-backstage |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/departments-costume-receipts.html` | Costumes Receipts - Build The Show | /org/{org}/productions/{production}/tools/departments-costume-receipts |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/departments-costume.html` | Costumes - Build The Show | /org/{org}/productions/{production}/tools/departments-costume |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/departments-dashboard.html` | Departments at a glance - Build The Show | /org/{org}/productions/{production}/tools/departments-dashboard |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/departments-design-receipts.html` | Design & Construction Receipts - Build The Show | /org/{org}/productions/{production}/tools/departments-design-receipts |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/departments-design.html` | Design & Construction - Build The Show | /org/{org}/productions/{production}/tools/departments-design |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/departments-front-of-house-receipts.html` | Front of House Receipts - Build The Show | /org/{org}/productions/{production}/tools/departments-front-of-house-receipts |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/departments-front-of-house.html` | Front of House - Build The Show | /org/{org}/productions/{production}/tools/departments-front-of-house |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/departments-hair-receipts.html` | Hair & Makeup Receipts - Build The Show | /org/{org}/productions/{production}/tools/departments-hair-receipts |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/departments-hair.html` | Hair & Makeup - Build The Show | /org/{org}/productions/{production}/tools/departments-hair |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/departments-makeup.html` | Makeup - Build The Show | /org/{org}/productions/{production}/tools/departments-makeup |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/departments-marketing-publicity-receipts.html` | Marketing & Publicity Receipts - Build The Show | /org/{org}/productions/{production}/tools/departments-marketing-publicity-receipts |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/departments-marketing-publicity.html` | Marketing & Publicity - Build The Show | /org/{org}/productions/{production}/tools/departments-marketing-publicity |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/departments-stage-management-receipts.html` | Stage Management Receipts - Build The Show | /org/{org}/productions/{production}/tools/departments-stage-management-receipts |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/departments-stage-management.html` | Stage Management - Build The Show | /org/{org}/productions/{production}/tools/departments-stage-management |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/departments-technical-receipts.html` | Technical Crew Receipts - Build The Show | /org/{org}/productions/{production}/tools/departments-technical-receipts |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/departments-technical.html` | Technical Crew - Build The Show | /org/{org}/productions/{production}/tools/departments-technical |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/emails.html` | Email Templates - Build The Show | /org/{org}/productions/{production}/tools/emails |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/financials-dashboard.html` | Financials Dashboard - Build The Show | /org/{org}/productions/{production}/tools/financials-dashboard |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/financials-reports.html` | Financial Reports - Build The Show | /org/{org}/productions/{production}/tools/financials-reports |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/financials-settlements.html` | Settlements - Build The Show | /org/{org}/productions/{production}/tools/financials-settlements |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/marketing-assets.html` | Assets - Build The Show | /org/{org}/productions/{production}/tools/marketing-assets |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/marketing-branding.html` | Assets - Build The Show | /org/{org}/productions/{production}/tools/marketing-branding |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/marketing-calendar.html` | Marketing Calendar - Build The Show | /org/{org}/productions/{production}/tools/marketing-calendar |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/marketing-dashboard.html` | Marketing - Build The Show | /org/{org}/productions/{production}/tools/marketing-dashboard |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/marketing-media.html` | Media - Build The Show | /org/{org}/productions/{production}/tools/marketing-media |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/marketing-programme.html` | Programme - Build The Show | /org/{org}/productions/{production}/tools/marketing-programme |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/marketing-sponsors.html` | Sponsors - Build The Show | /org/{org}/productions/{production}/tools/marketing-sponsors |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/marketing-tasks.html` | Marketing Tasks - Build The Show | /org/{org}/productions/{production}/tools/marketing-tasks |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/marketing.html` | Marketing - Build The Show | /org/{org}/productions/{production}/tools/marketing |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/plan-calendar.html` | Calendar - Build The Show | /org/{org}/productions/{production}/tools/plan-calendar |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/plan-dashboard.html` | Plan - Build The Show | /org/{org}/productions/{production}/tools/plan-dashboard |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/plan-files.html` | Production Files - Build The Show | /org/{org}/productions/{production}/tools/plan-files |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/plan-rehearsal-schedule.html` | Rehearsal Schedule - Build The Show | /org/{org}/productions/{production}/tools/plan-rehearsal-schedule |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/plan-setup.html` | Production Setup - Build The Show | /org/{org}/productions/{production}/tools/plan-setup |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/plan-team.html` | Creative Team - Build The Show | /org/{org}/productions/{production}/tools/plan-team |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/plan-timeline.html` | Producer Timeline - Build The Show | /org/{org}/productions/{production}/tools/plan-timeline |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/portal.html` | Open your activities / Build The Show | /org/{org}/productions/{production}/tools/portal |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/portals.html` | Open your activities / Build The Show | /org/{org}/productions/{production}/tools/portals |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/production-budget.html` | Budget - Build The Show | /org/{org}/productions/{production}/tools/production-budget |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/production-overview.html` | Overview - Build The Show | /org/{org}/productions/{production}/tools/production-overview |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/production-proposals.html` | Production Proposals - Build The Show | /org/{org}/productions/{production}/tools/production-proposals |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/production-settings.html` | Production Settings - Build The Show | /org/{org}/productions/{production}/tools/production-settings |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/production-template-test.html` | Template Test - Build The Show | /org/{org}/productions/{production}/tools/production-template-test |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/production-template.html` | Production Template - Build The Show | /org/{org}/productions/{production}/tools/production-template |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/production-workspace.html` | Production Workspace - Build The Show | /{org}/ORG/Productions/{production}[/{area}] (workspace route family) |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/production.html` | Production - Build The Show | /org/{org}/productions/{production}/tools/production |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/promote-dashboard.html` | Promote at a glance - Build The Show | /org/{org}/productions/{production}/tools/promote-dashboard |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/promote-programme-ads.html` | Programme Ads - Build The Show | /org/{org}/productions/{production}/tools/promote-programme-ads |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/promote-programme.html` | Programme - Build The Show | /org/{org}/productions/{production}/tools/promote-programme |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/promote-sponsors-crm.html` | Show Sponsors - Build The Show | /org/{org}/productions/{production}/tools/promote-sponsors-crm |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/promote-sponsors-settings.html` | Sponsor Settings - Build The Show | /org/{org}/productions/{production}/tools/promote-sponsors-settings |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/promote-sponsors.html` | Sponsors - Build The Show | /org/{org}/productions/{production}/tools/promote-sponsors |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/proposals-dashboard.html` | Proposals - Build The Show | /org/{org}/productions/{production}/tools/proposals-dashboard |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/registration-dashboard.html` | Registration Dashboard - Build The Show | /org/{org}/productions/{production}/tools/registration-dashboard |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/registration-form.html` | Registration Form - Build The Show | /org/{org}/productions/{production}/tools/registration-form |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/registration-settings.html` | Registration Settings - Build The Show | /org/{org}/productions/{production}/tools/registration-settings |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/registration-status.html` | Registration Status - Build The Show | /org/{org}/productions/{production}/tools/registration-status |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/registration.html` | Registration - Build The Show | /org/{org}/productions/{production}/tools/registration |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/script-breakdown.html` | Script Resources - Build The Show | /org/{org}/productions/{production}/tools/script-breakdown |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/settings-communications.html` | Communications - Build The Show | /org/{org}/productions/{production}/tools/settings-communications |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/settings-dashboard.html` | Settings - Build The Show | /org/{org}/productions/{production}/tools/settings-dashboard |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/settings-features.html` | Features - Build The Show | /org/{org}/productions/{production}/tools/settings-features |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/settings-forms.html` | Forms - Build The Show | /org/{org}/productions/{production}/tools/settings-forms |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/settings-integrations.html` | Integrations - Build The Show | /org/{org}/productions/{production}/tools/settings-integrations |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/settings-payments.html` | Payments - Build The Show | /org/{org}/productions/{production}/tools/settings-payments |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/settings-team.html` | Team & Permissions - Build The Show | /org/{org}/productions/{production}/tools/settings-team |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/team-portal.html` | Open your activities / Build The Show | /org/{org}/productions/{production}/tools/team-portal |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/template-test.html` | Template Test — Build The Show | /org/{org}/productions/{production}/tools/template-test |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/ticketing-build.html` | Build Ticket Sales - Build The Show | /org/{org}/productions/{production}/tools/ticketing-build |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/ticketing-checkin.html` | Ticketing Check-In - Build The Show | /org/{org}/productions/{production}/tools/ticketing-checkin |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/ticketing-dashboard.html` | Ticketing Dashboard - Build The Show | /org/{org}/productions/{production}/tools/ticketing-dashboard |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/ticketing-orders.html` | Ticketing Orders - Build The Show | /org/{org}/productions/{production}/tools/ticketing-orders |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/ticketing-reports.html` | Ticketing Reports - Build The Show | /org/{org}/productions/{production}/tools/ticketing-reports |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/ticketing-settings.html` | Ticketing Settings - Build The Show | /org/{org}/productions/{production}/tools/ticketing-settings |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/treasurer-portal.html` | Open your activities / Build The Show | /org/{org}/productions/{production}/tools/treasurer-portal |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/volunteer-applicants.html` | Volunteer Requests - Build The Show | /org/{org}/productions/{production}/tools/volunteer-applicants |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/volunteer-calendar.html` | Volunteer Calendar - Build The Show | /org/{org}/productions/{production}/tools/volunteer-calendar |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/volunteer-publish.html` | Publish Volunteer Sign-Ups - Build The Show | /org/{org}/productions/{production}/tools/volunteer-publish |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/volunteer-roles.html` | Volunteer Roster - Build The Show | /org/{org}/productions/{production}/tools/volunteer-roles |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/volunteer-settings.html` | Volunteer Settings - Build The Show | /org/{org}/productions/{production}/tools/volunteer-settings |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/volunteer-share.html` | Share Volunteer Links - Build The Show | /org/{org}/productions/{production}/tools/volunteer-share |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/volunteer-suggestions.html` | Volunteer Suggestions - Build The Show | /org/{org}/productions/{production}/tools/volunteer-suggestions |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/volunteer-supportlist.html` | Production Support List - Build The Show | /org/{org}/productions/{production}/tools/volunteer-supportlist |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/volunteers.html` | Volunteer Plan - Build The Show | /org/{org}/productions/{production}/tools/volunteers |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/wrapup-archive.html` | Archive - Build The Show | /org/{org}/productions/{production}/tools/wrapup-archive |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/wrapup-dashboard.html` | Wrap Up - Build The Show | /org/{org}/productions/{production}/tools/wrapup-dashboard |
| Production workspace or tool | `SYSTEM/Organisations/Productions/Workspace/wrapup-surveys.html` | Surveys - Build The Show | /org/{org}/productions/{production}/tools/wrapup-surveys |
| Organisation home and tabs | `SYSTEM/Organisations/org-dashboard.html` | Dashboard - Build The Show | /org/dashboard, /org |
| Organisation | `SYSTEM/Organisations/org-profile.html` | Organisation Profile - Build The Show | /org/profile |
| Organisation | `SYSTEM/Organisations/org-setup.html` | Set Up Your Organisation - Build The Show | /org/setup |
| Public / applicant | `SYSTEM/Public/audition-info.html` | Audition Info - Build The Show | /audition-info |
| Public / applicant | `SYSTEM/Public/audition.html` | Audition - Build The Show | /audition |
| Public / applicant | `SYSTEM/Public/callback-response.html` | Callback Response / Build The Show | Public/legacy/directory route; verify exact mapping |
| Public / applicant | `SYSTEM/Public/callback-self-tape-submit.html` | Submit Your Self Tape | /callback-self-tape/submit |
| Public / applicant | `SYSTEM/Public/callback-sides.html` | Callback Sides / Build The Show | Public/legacy/directory route; verify exact mapping |
| Public / applicant | `SYSTEM/Public/cast-offer-response.html` | Cast Offer / Build The Show | /cast-offer |
| Public / applicant | `SYSTEM/Public/production-proposal.html` | Season Pitch / Build The Show | /org/proposals/submit |
| Public / applicant | `SYSTEM/Public/registration.html` | Registration / Build The Show | /registration |
| Public / applicant | `SYSTEM/Public/self-tape-submit.html` | Submit Your Self Tape | /self-tape/submit |
| Public / applicant | `SYSTEM/Public/self-tape.html` | Self Tape Audition | Public/legacy/directory route; verify exact mapping |
| Public / account entry | `PUBLIC/accept-invite.html` | Accept Invitation - Build The Show | /invite |
| Public / account entry | `PUBLIC/account-entry.html` | Open your activities / Build The Show | /member/account/entry |
| Public / account entry | `PUBLIC/callback-sides.html` | Callback Sides / Build The Show | /callback-sides, /callbacksides |
| Public / account entry | `PUBLIC/confirm-account.html` | Confirm Your Account - Build The Show | /member/account/confirm |
| Public / account entry | `PUBLIC/find.html` | Find Opportunities - Build The Show | /find |
| Member | `PUBLIC/my-home.html` | My Home - Build The Show | /member/home, /member/activities |
| Public / account entry | `PUBLIC/opportunity-detail.html` | Opportunity - Build The Show | /opportunity |
| Public / account entry | `PUBLIC/pricing.html` | Pricing - Build The Show | /pricing |
| Public / account entry | `PUBLIC/sponsors.html` | Sponsor Opportunities - Build The Show | /sponsors |
| Public / account entry | `PUBLIC/tickets.html` | Tickets - Build The Show | /tickets |
| Public / account entry | `PUBLIC/transfer-ownership.html` | Accept Organisation Ownership - Build The Show | /member/account/transfer |
| Public / account entry | `PUBLIC/volunteer-production-page.html` | Volunteer / Build The Show | /volunteer |
| Public / account entry | `PUBLIC/volunteer-quiz.html` | Volunteer Quiz / Build The Show | Public/legacy/directory route; verify exact mapping |
| Public / account entry | `PUBLIC/volunteer-signup.html` | Volunteer Sign Up / Build The Show | /volunteer/signup |

## Second-pass dependency map

For every sidebar destination, trace the canonical URL and aliases, source page, loaded scripts, Supabase tables/RPCs, permissions, writes, realtime subscriptions, and error/loading behaviour. No page is assumed obsolete from its filename or from not appearing in the sidebar.

For Production, separate true destinations from local tabs, modal states, and the special team-access flow. For Member and Organisation, confirm each destination against the active sidebar code and middleware rather than empty or legacy nav files.

## Migration guardrails

- Keep all existing labelled sidebar destinations. Group them without hiding essential tools.
- Preserve approved UI and behaviour; migration is not a redesign.
- Mount one route module at a time inside a persistent context shell; never insert a whole HTML document into the content outlet.
- Give each route module a mount/unmount lifecycle, cancel stale requests, and check permissions at both route and data-operation boundaries.
- Keep Supabase canonical and invalidate cached data deliberately after writes.
- Use preview deployments before production. Preserve old route aliases until their replacement is complete.

## Recommended platform structure

Build The Show should grow as a **modular monolith**: one product, one deployable application, and one authoritative Supabase data layer, with clear boundaries between areas. The platform can support a large sidebar and many destinations without splitting every feature into its own service or duplicating its own data.

### 1. Keep three signed-in contexts

- **Member:** a person, their profiles and circles, activities, calendar, and personal settings.
- **Organisation:** organisation-level productions, people, proposals, and settings.
- **Production:** one production's plan and working areas, such as auditions, characters, volunteers, tickets, finance, and wrap-up.
- Public pages, sign-in, invitations, and application submissions remain outside the signed-in shells.

Each context owns its persistent layout, navigation, identity/context selector, and page outlet. Moving between destinations in the same context must leave its shell mounted. Moving to another context or crossing an authentication boundary may load a different shell. Keep the existing sidebar items, order, icons, and labels while we migrate; architecture work is not permission to redesign navigation.

### 2. Organise code by domain, not by sidebar row

The sidebar is a way to reach work, not the code architecture. Put each feature's route/view, data access, and domain actions together, then reuse shared UI and data contracts across features. Initial domain boundaries:

| Domain | Owns |
|---|---|
| Identity and access | Authentication session, organisation membership, circle access, profile access, role checks |
| Members | Profiles, circles, activities, member calendar, member settings |
| Organisations | Organisation record, team, organisation calendar, proposals, settings |
| Productions | Production identity, status, shared production schedule, cross-area context |
| Auditions and casting | Audition configuration, characters, applications, bookings, offers, casting assignments |
| Volunteers and creative work | Opportunities, volunteer roles/shifts/hours, creative assignments, tasks and files |
| Ticketing and finance | Inventory/orders/check-in; budgets, fees, payments and settlements |
| Communications and files | Notifications, messages, email templates and authorised file metadata |

These are ownership boundaries within the application, not a proposal for new Supabase tables. Use the existing schema, RPCs and policies as the source of truth. Record any missing backend contract before introducing data structures.

### 3. One route registry and one context resolver

- The URL is the source for the currently open destination. Back/forward, reload, and copied links must return to the same destination.
- A route registry maps a canonical route to its context, page module, required capability, and optional loader. The sidebar derives its active state from that route registry rather than maintaining a second page state.
- Resolve organisation, production, and member/profile context once at the route boundary. Pass the resolved IDs and permissions to the page; never infer authorization from a slug, a selected profile in browser storage, or a hidden sidebar item.
- Keep data loading scoped to the destination. The shell may load session and current context; a destination loads its own data. Do not make organisation home load auditions, tickets, every production, and all team records just to render its sidebar.
- Put Supabase access behind named domain query/action modules. Keep validation and access enforcement in Supabase/RPC/policies. Shared client caches may reduce repeat reads, but are disposable and never become business truth.
- Every route module owns loading, empty, error, retry, and cleanup states. Leaving a route cancels or ignores stale requests. A failure in one page must not leave the whole signed-in shell on its loading screen.

### 4. Migrate by replacement at the route boundary

Use a strangler migration: old pages continue to work until their replacement is complete. Do not inject entire legacy HTML documents into a shared page outlet; their global CSS, inline scripts, event handlers, and Supabase setup would collide.

1. Keep public/auth routes and all current URLs working.
2. Add the app-shell/route foundation alongside the current page delivery. First determine the actual Cloudflare Pages build and deployment settings; this checkout has no root package manifest or build configuration, so do not silently switch the production build to Vite or React.
3. Select one contained, low-risk route as the pilot only after matching its current UI, data queries, writes, permissions, and deep links. Preserve its approved design and behaviour.
4. Route that destination to a real page module in the persistent shell. Keep the old address as an alias to the same module. Leave neighbouring legacy pages untouched.
5. Compare the pilot against its source page for visual behaviour, data, access, loading/error handling, and browser navigation. Then migrate one route at a time by domain.
6. Remove legacy delivery only when no sidebar item, saved link, email, notification, or production workflow depends on it.

### 5. Suggested order

1. **Foundation:** route/context contracts, shell boundaries, error/loading ownership, and Cloudflare deployment constraints. No sidebar redesign and no mass page rewrite.
2. **Small pilot:** one route with limited cross-domain writes. This validates the shell without risking the approved audition builder or another deeply coupled tool.
3. **Member routes:** member home, activities, calendar, profile, circle, settings, preserving the approved profile-first flow and responsive left drawer.
4. **Organisation routes:** overview, productions, team, proposals, settings.
5. **Production routes:** dashboard and plan first, then auditions/characters/casting, volunteer and creative work, ticketing, finance, communications, and wrap-up. Preserve the approved sidebar and each existing page until its replacement is ready.
6. **Retire duplicate implementations:** only after routes and actions have a single owner and compatibility links are accounted for.

### Cloudflare deployment facts

Katie's Cloudflare Pages screenshot shows the connected `buildtheshow/BuildTheShow` Git repository, production branch `main`, and automatic deployments enabled. Build command, build output directory, and root directory appear unset. The current deployment therefore has no configured framework build step and uses the repository's static Pages delivery. Do not change these production settings as part of the inventory or route audit.

Before introducing a framework build, prepare a preview branch/build that preserves every current static path and Pages Function. Confirm that the preview contains the existing `/ASSETS`, `/PUBLIC`, `/SYSTEM`, `/SHARED`, root HTML, `_headers`, `_redirects`, and `_routes.json` surfaces, and that dynamic Pages Functions still deploy from the repository root. Only then update the Pages build command/output directory. This prevents a new app bundle from accidentally replacing the existing live site.
- This inventory is a baseline, not approval to rename or remove a page.
