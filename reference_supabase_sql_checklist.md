# Supabase SQL checklist

The live schema was inspected on 2026-11-15 without reading personal records.

## Member profile editor (2026-11-21)

No SQL needs to be run. The four-tab editor reuses `profiles.bio`, `profiles.headshot_url`, `profiles.headshot_urls` and the existing `profiles.sections` JSONB. Volunteer and Creative History use `sections.volunteer.history` and `sections.creative.history`; training, skills and private portfolio/media references stay under the corresponding existing section. Uploads reuse the private `profile-headshots` bucket and `bts_bind_profile_file`. Existing row and storage policies remain in force; saving grants no public access. See `docs/security/member-profile-editor.md` for the save and privacy checks.

## Households and explicit performer keys

Migration: `supabase/migrations/20261116150000_households_and_profile_keys.sql`.

Adds private relationship tables `households`, `household_members`, `household_profiles`, `profile_controls`, `profile_keys`, `profile_contacts`, `family_invites`, `family_reviews`, `family_audit`, `family_mail` and `profile_file_keys` under `bts_private`. The existing profile, audition, casting and payment records remain canonical. No household membership implicitly grants performer access. Recipient-bound guardian invitations, no-login adult booking consent, later adult activation, reviewed linking/duplicates, age-18 expiry, read-only shared fee tracking, file bindings, change history and durable notification delivery use narrow checked RPCs.

Deploy the matching household page, performer picker, member profile queries, `send-email` authorisation/queue integration and new `household-mail` Edge Function together. The queue pump uses existing Resend secrets, bounded service-only claims and provider idempotency keys. A private `pg_cron`/`pg_net` tick runs each minute. The migration removes the retired `on-audition-booked` webhook pointing to an absent function. Queue metadata is not evidence of actual delivery.

The local household suites and exact hosted rollback rehearsal pass. Hosted preflight found 44 current registration-payment rows and 10 older household-log rows, without retrieving their contents. Current payments drive the total; relevant older logs are separately flagged for staff reconciliation rather than silently double-counted. Legal/custody verification, wider authentication/recovery checks, transactional capacity, attendance proof and operational launch checks remain separate.

Plain-language explanation/map: `docs/security/households-guide.md`. Implementation, reviewed operator tool and delivery runbook: `docs/security/households-operations.md`. Deployment status: migration `20261116150000` applied on 2026-11-16 with exact source recorded atomically. Matching `send-email` v34 and `household-mail` v1 are active. Website release `f577b9a5` was pushed and all ten checked HTTPS routes/assets contain the matching household markers. Eleven live anonymous/zero-row HTTP checks passed. Postflight confirmed exact migration source, no browser relationship-table/operator RPC access, private file buckets, zero synthetic accounts, unchanged 44 current/10 legacy payment rows and an active scheduler with successful runs. No automated real email or production-account journey was performed.

## Audition account ownership and availability

Migration: `supabase/migrations/20261115133000_audition_account_ownership.sql`.

Adds adult-account ownership to bookings, server-recorded guardian declarations, immutable ownership fields, restrictions on casting/assessment/check-in/schedule edits, and a public count-only availability RPC. Anonymous base-record reads and writes are revoked. Participant projections expose only the active adult account's records or records within an authorised staff scope; staff assessment and internal consent fields are excluded. Existing unowned records cannot be adopted through name, birth date or email matching; linking needs an operator-reviewed process. No legacy records are automatically assigned to a family.

Both audition entry forms now require an adult login to submit, use account-scoped duplicate checks, and upload new photos into the adult's private profile-file folder. Related public/member application lookups use the participant projections, and invitation/registration/self-tape entry pages require adult sign-in. Public slot pickers use counts rather than applicant-list queries. The browser-side slot hold and multi-write booking flow have NOT yet been replaced with an atomic server booking operation.

Local tests and live-schema rehearsals passed and rolled back synthetic records. The rehearsal also passed anonymous/base-table read denial, cross-family projection isolation, and omission of private assessment fields. This closes direct application/booking table exposure; it does not finish volunteer/casting-assignment/self-tape table or storage permissions, transactional booking, old-record linking or the full account project. Applied and recorded as version `20261115133000`, with matching website release `89d62856`. Post-deployment checks confirmed anonymous base-record reads and inserts are revoked, private assessment fields are absent from the participant view, and no synthetic accounts remain. Anonymous HTTPS checks and live-page deployment verification passed without reading personal rows.

## Account-bound team access

Follow-up migration: `supabase/migrations/20261115124500_require_team_session_for_staff_helpers.sql`. Requires a currently active, account-bound team session for staff access through the profile-file and service-only email helpers. An email-address match alone cannot grant this access. Tests cover both a denied email-only identity and successful code-authenticated producer access, including denial for an unsubmitted sibling photo. The Edge Function sender itself remains undeployed pending the public confirmation workflow.

Migration: `supabase/migrations/20261115123000_account_bound_team_access.sql`

Requires adult Auth login plus team code, binds sessions to the Auth user ID, revokes historical unbound sessions, retires passcode-only RPC overloads and adds a shared operation/page/reference guard around every session RPC. Removes anonymous direct access to audition notes/observations/live state and restricts direct table access to the active production owner. Team login is limited to 20 requests per target per 15 minutes; sessions expire after eight hours.

Matching login/portal/workspace changes preserve safe return paths and stop treating a job title as a permission. Team previews no longer put another person's code in the URL. Existing explicit page grants are preserved. Team members must sign in again after deployment.

Local boundary tests and the production-schema rehearsal pass, including direct table bypass, copied-session/account mismatch, cross-production references, viewer writes, job-title forgery, rate limiting, explicit page denial and revocation. The rehearsal ended in ROLLBACK. Schema-only originals are saved locally under `/tmp/bts-account-rollout/team-functions-*.json` and the checked-in synthetic baseline. Applied successfully and recorded as version `20261115123000`; matching website release is `e9f641f2`. Post-deployment checks confirmed zero anonymous team RPCs, no anonymous note reads/writes, no browser access to the session table, no active unbound sessions, no surviving passcode-only login, and no remaining synthetic accounts. The updated portal, helper and workspace script were verified over HTTPS.

## Account security foundation

Migration: `supabase/migrations/20261115103000_account_security_foundation.sql`

Adds private adult-account controls and deletion-request records, server-side signup eligibility, profile guardian declaration fields, ownership protection and two-person ownership transfer, token-scoped invitation RPCs, and private profile-file access.

Also adds service-only production email authorisation and request limits. The matching `send-email` Edge Function must be deployed separately. Public booking and response emails currently need a replacement server-triggered workflow; do not deploy this endpoint in isolation and silently break those messages.

Deploy matching account pages, confirmation route and private-media resolver together with this migration. Test the migration and access boundaries in a transaction ending in ROLLBACK before production application. Retain a schema-only backup of the replaced policies.

Do not run a blanket rollback that restores public access to personal records. A deployment failure should be fixed forward or restored from reviewed schema definitions. No automatic deletion job is introduced; deletion requests require an operator procedure.

Deployment status must be recorded here after verification.

2026-11-15: migration applied successfully through the authenticated Supabase CLI and recorded as version `20261115103000` in `supabase_migrations.schema_migrations`. Matching website release `35c7b8a3` was pushed to main and verified over HTTPS. Local tests and the live-schema rehearsal with synthetic accounts passed; that rehearsal ended in ROLLBACK, and no synthetic users remain. Schema-only policy/grant/constraint backup: `/tmp/bts-account-rollout/schema-before-compact.json`.

Post-deployment checks confirmed the profile bucket is private; anonymous profile and invitation reads are revoked; browsers cannot insert member IDs or call the service-only email authoriser; both signup triggers exist. The existing slug-check helper now has a fixed lookup path, and the local model includes that dependency.

The email function has NOT been deployed. Public booking/response email workflows, wider portal access policies, server-side Auth settings and the privacy operating procedures remain outstanding. This release is the account foundation, not a full-product security or legal sign-off.

## Authentication configuration finding

The public Auth settings endpoint reports `mailer_autoconfirm: true`, with anonymous sign-ins and social providers disabled. This is a release-blocking issue for claims that email-based staff access proves inbox ownership. The settings Management API returned HTTP 401; no Auth configuration was changed. Database CLI access is working separately.

Before changing the switch, confirm production Custom SMTP is configured and that confirmation/recovery redirect URLs are restricted to the production website. Then disable automatic confirmation and enforce the 12-character password minimum in Supabase itself. Do not use a full config push with defaults that could overwrite unrelated settings.

Turning confirmation on does not retrospectively prove ownership of historical automatically confirmed addresses. Existing accounts need a real inbox-verification workflow before relying on email matches for sensitive staff access. An age/notice acknowledgement alone is not inbox verification. Katie confirmed Custom SMTP is saved and a password-recovery email arrived. The message contained text without a reset link or code, so delivery passed but recovery did not. No test emails were sent by the agent. The replacement Auth recovery template is versioned at `BACKEND/SupaBase/templates/reset-password.html`; applying it in the hosted template editor and testing a fresh message remain outstanding.


## Volunteer account ownership (2026-11-16)

Migration: `supabase/migrations/20261116100000_volunteer_account_ownership.sql`.

Adds Auth-owned volunteer requests and private guardian declaration fields to the existing volunteer table, plus the filtered `bts_participant_volunteers` view, atomic request RPC and public count-only availability RPC. `bts_production_page_permission` is now the canonical permission helper; the audition helper forwards to it. Replaces public volunteer policies with scoped staff policies and prevents participant approval/hour/ownership forgery. Historical records are deliberately not claimed by matching email or code.

Apply with the matching volunteer page and legacy financial portal account gates. Rehearse with synthetic fixtures ending in ROLLBACK first. Capacity reservation, attendance-derived hours, historical linking and the wider finance/participant audit remain outstanding. Guardian declarations require inclusion in the privacy request and retention procedure. Deployment verification will be recorded below.

2026-11-16 deployment verified: applied and recorded as version `20261116100000`; matching website release `b1683e6c` pushed to main. Local boundary suite and hosted synthetic rehearsal passed; the rehearsal rolled back. Postflight confirmed anonymous volunteer SELECT/INSERT/UPDATE are revoked, guardian audit fields are absent from the participant projection, and zero synthetic accounts remain. HTTPS checks returned 401 for base records, 200 for the zero-row safe projection, 400 for a private guardian field, and 200 with matching release markers on the volunteer page and both gated legacy financial portals. These checks did not send email or retrieve personal records. Full browser account journeys remain outstanding.


## Step 1: remaining private-record routes (2026-11-16)

Migration: `supabase/migrations/20261116120000_private_record_routes.sql`. Coverage inventory: `docs/security/private-route-coverage.md`.

Adds a submitter Auth ID to `sponsor_businesses`; uses the existing proposal submitter field; introduces filtered public/participant views, scope/ownership helpers and protected offer-response/submission RPCs. Replaces remaining non-ticket public record policies and wraps historical staff/sponsor/proposal security-definer routines. Private buckets: organisation files, production files, audition headshots, receipts, proposal attachments, profile headshots, programme artwork and venue photos. Public material/artwork exceptions are explicitly filtered. No files or family records are deleted, and no historical records are assigned to accounts by email or code.

Supabase's default grants include writes on newly created views. The migration explicitly revokes all browser grants on each projection, then grants its intended SELECT/INSERT/UPDATE operations; DELETE is not inherited. Matching website pages use those projections and an authorised five-minute file-link resolver. Raw slot-hold mutations are denied; transactional booking/hold replacement remains checklist step 5. Existing signed links/cached copies are subject to their expiry, not instant revocation.

Local synthetic tests include hosted-style default ACLs, family/staff separation, private fields, offers, registration contacts, self-tapes, mixed households, finance edits, revocation, cross-production links and private file paths. The production-schema rehearsal must end in ROLLBACK before application. Ticket/seating tables remain excluded. This is not legal certification or completion of checklist steps 2–10.

Deployment verification will be recorded below.

2026-11-16 step-1 deployment verified: migration `20261116120000` applied and recorded; matching website release `256a3a25` pushed to main. The complete local account suite passed with hosted-style inherited table/view grants enabled; all 333 tracked JavaScript/inline blocks parsed. The final hosted synthetic rehearsal passed and rolled back. Postflight found zero anonymous private base-table reads, zero unintended projection writes/deletes, zero public buckets among the eight private buckets, no anonymous execution of the tested privileged RPCs, and zero remaining synthetic accounts. All 27 zero-row live API/query checks passed, including safe-view relations; six deployed page/script release markers returned 200 and matched. No personal rows were requested and no test emails were sent. Step 1 is complete for the current non-ticket route inventory. Steps 2–10 remain as documented; full browser journeys are step 9.

## One adult account and profile-linked volunteering — 2026-11-16

Migration: `supabase/migrations/20261116170000_one_account_and_volunteer_profiles.sql`.

Adds private accepted production-account bindings and recipient-bound invitations; reuses existing organisation, profile, household, consent, audit and mail storage. Adds volunteer `profile_id` and `discount_profile_id`, explicit delegated volunteer consent and narrowly scoped historical-volunteer confirmation IDs on existing private invitations. These are relationships and permission evidence, not duplicated people or accounts. No historical row is assigned by name/email alone. Existing proven staff sessions can preserve their binding; other staff confirm their assigned inbox invitation. All 128 existing volunteer rows are preserved; unowned records use an inbox-confirmation link plus an authorised matching profile, or an operator-reviewed link when identity differs. Historical codes become inert compatibility values.

Participant updates cannot forge ownership, profile links, approvals, guardian declarations or confirmed hours. Approving/rescheduling a future shift no longer writes scheduled duration into confirmed hours. Notification-only contacts remain separate from management keys. Staff invitations, organisation invitations and volunteer updates use the existing bounded outbox; the old anonymous `send-invite` endpoint is retired. The invitation sender cannot choose another recipient or inject email content. New UI: `/home`, `/activities`, `/manage`; replaced team, crew, member and volunteer entrances retain redirects/account gateways.

Required rollout: full local suites and browser journeys; exact-source hosted synthetic rehearsal ending ROLLBACK; apply and record only this migration in one transaction; deploy matching household-mail/send-email/retired send-invite functions; publish matching UI and check live grants/routes/fixture cleanup. Do not blanket-push unrelated migration history. Preserve private relationship and audit history during forward repairs.

Hosted authentication correction: Supabase CLI v3.1.0 sparse config diff reviewed exactly `auth.site_url` and `auth.additional_redirect_urls`; changed localhost to the production origin and allowed canonical login/verification-return/reset paths. Undeclared SMTP, MFA and all other settings were preserved. The hosted recovery HTML was subsequently installed and verified after reloading the in-app Supabase dashboard; inbox completion remains a recipient check.

2026-11-16 unified-account release verified: implementation `fb496b69`; migration `20261116170000` applied with exact source recorded atomically, checksum verified. Hosted rollback rehearsal, twelve local security suites, isolated browser journeys, 338 script parses, thirteen live API denials/checks and fourteen live route/asset markers pass. Functions active: send-email v35, retired send-invite v20, household-mail v2. All 128 historical volunteer records and 44 current/ten legacy payment rows preserved; zero exact rehearsal accounts remain. Private schema/table/service grants remain closed; scheduler successful, outbox empty. Hosted Auth minimum raised from six to twelve; email verification enabled; double email-change confirmation verified; SMTP/MFA preserved. Branded recovery subject/body installed in the in-app dashboard and persisted after reload. Real receiving-account reset/invitation completion, operator MFA enrolment and wider international privacy/legal/retention review are not certified by these automated checks. See `docs/security/unified-account-rollout.md` for the full user map, workflow and remaining acceptance conditions.

## Correct mistaken member/organisation profile setup — 2026-11-16

Migration: `supabase/migrations/20261116210000_profile_type_corrections.sql`. Adds a private correction decision ledger and `organizations.profile_archived_at`; reuses the existing adult account, member profile, organisation, consent, ownership and audit records. A type correction creates or reuses the correct domain record and archives the unused mistaken record. It never changes login identity or grants roles from metadata. Linked records/other people require a protected review; the CLI operator resolver cannot bypass unresolved dependencies. Original records and organisation addresses remain retained. Shared Settings control preserves the existing design. Operator instructions and validation: `docs/security/profile-type-corrections.md`.

Rollout requires exact-source hosted rollback rehearsal, atomic migration/history application, matching website publication and live grants/source/fixture verification. Apply only this migration; transactional audition booking migration `20261116190000` is separate pending work.

## Beta invitation signup — 2026-11-16

Migration: `supabase/migrations/20261116230000_beta_signup_invitations.sql`. Adds private hashed, expiring, revocable beta invitations with atomic use limits and an invitation reference on existing private account controls. A new Auth insert guard enforces a valid code server-side after adult/consent checks, removes raw code metadata, and rolls back uses when signup fails. An anonymous boolean checker supports the existing popup/form; code issuance is service-only. Existing accounts, login and recovery are unchanged. Exact hosted rollback rehearsal, atomic source/history recording and live grants/trigger/fixture checks are required. Operator details: `docs/security/beta-testing.md`.

## 2026-11-17: Canonical URL namespaces

Applied `supabase/migrations/20261117130000_canonical_url_namespaces.sql` through the linked CLI. Extends the existing reserved organisation slug validator to the website's public, member and organisation route words. No organisation slug, account, profile or production records are changed. Before applying, the collision count for the newly reserved names was zero. Existing unique slug indexes stay in place.

The follow-up `20261117133000_reserve_about_page_url.sql` also reserves the existing `who-we-are` page name. Its pre-application organisation collision count was zero.

## 2026-11-17: Member circles

`supabase/migrations/20261117173000_member_circles.sql` adds selected circle-admin invitation scope to the existing private invitations table and the `bts_circle` API. Existing household/profile records are reused, not renamed or duplicated. Applied only this migration through the linked CLI after local SQL and browser verification; the earlier transactional-booking migration remains separate.

## 2026-11-21: Circle connections and recipient-bound requests

Applied and recorded only `supabase/migrations/20261121120000_circle_connections.sql` through the linked CLI, after exact-source hosted rollback rehearsal. The earlier transactional audition booking migration remains separate and unapplied. Reuses profile permissions and the existing invitation/mail queue; adds private access-request workflow state, recipient-only notices, scoped request approval and invitation-bound beta signup. Matching household-mail function deployed. Local SQL, browser, email-rendering and canonical URL checks pass. Katie confirmed receipt of the explicitly authorised, labelled test invitation. Katie approved the revised branded invitation, and the matching household-mail function was redeployed. Matching frontend changes are included with this release; verify deployed routes and asset markers after publication. Sensitive contact/safety field controls in My Profile remain separate follow-up work. See `docs/security/circle-connections.md`.

## 2026-11-21: Account settings and notification preferences

`supabase/migrations/20261121150000_account_notification_preferences.sql` adds one service-only recipient preference check using existing Auth metadata and the private mail queue. No new profile/account storage. The matching household-mail worker cancels opted-out optional messages while retaining essential confirmations and existing unsubscribe/eligibility checks. Account settings use the signed-in adult regardless of selected profile. Selected-profile access, archive and type-change controls stay in My Profile. Contact/emergency field controls remain separate. Local browser/SQL tests and exact-source hosted rollback rehearsal are required before applying only this migration and deploying the matching worker/UI. The unrelated transactional-booking migration remains separate. Details: `docs/security/account-settings.md`.

Account settings deployment: exact-source hosted rollback rehearsal passed; applied and recorded version `20261121150000` atomically, then deployed the matching household-mail worker. Browser settings/profile-editor tests, SQL recipient-preference tests, URL inventory and parse checks pass. No test email or real account credential change.

## 2026-11-21: Member production activities and payment tracker

`supabase/migrations/20261121170000_member_production_payments.sql` reuses the existing tracker ledger and account activity API, adds safe organisation/production payment instructions, accepted own-profile team participation and a narrow profile-access projection. No new tables or historical record reassignment. Old implementations become private helpers with browser execution revoked. Local SQL/browser checks and exact-source hosted rollback rehearsal pass. Only this migration has been applied and recorded; the matching Activities/profile UI is included in this release. The unrelated transactional-booking migration remains separate. See `docs/security/member-production-payments.md`.

Member production payments deployment: applied and recorded only version `20261121170000` after the exact-source rollback rehearsal. Checksum and grants verified; zero rehearsal accounts remain. No existing payment/instruction records changed and no email sent. Matching frontend publication is part of the same release.


## Member production details (2026-11-22)

`supabase/migrations/20261122110000_member_production_details.sql` adds a profile-bound read-only RPC for existing production contacts, cast calls, event instructions, venues and permitted files. It creates no tables and grants no blanket access to staff files or notes. Tests cover cast/volunteer/mixed roles, legacy and pending calls, private notes/files and outsider/profile/production boundaries. Applied and recorded only this migration after its exact-source hosted rollback rehearsal passed; the unrelated transactional audition booking migration remains separate. See `docs/security/member-production-details.md`.

## Member calendar (2026-11-25)

`supabase/migrations/20261122150000_member_calendar.sql` adds `bts_member_calendar(uuid[],date,date,uuid)`, a read-only date-range RPC over existing production events, audition bookings and volunteer signups. No tables are created. Every selected profile needs explicit management access; call lists and account-bound team permissions still apply. Anonymous execution is denied. Local and hosted rollback rehearsals cover historic calls, exact timed audition duration, volunteer dates, private notes and outsider denial. Applied and recorded only this migration after the hosted rollback rehearsal passed. See `docs/security/member-calendar.md`.

## Member setup and profile transfer (2026-11-25)

`20261125120000_member_setup.sql` adds protected own-profile setup, circle-bound basic profile creation and recipient-bound adult profile transfers over existing records. `20261125123000_setup_draft_resume.sql` clears the private signup draft atomically after creation. No tables are added. Both exact sources passed hosted rollback rehearsals and were applied and recorded separately; unrelated booking work remains pending. See `docs/security/member-setup.md`.
