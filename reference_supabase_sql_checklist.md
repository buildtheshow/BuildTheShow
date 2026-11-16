# Supabase SQL checklist

The live schema was inspected on 2026-11-15 without reading personal records.

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
