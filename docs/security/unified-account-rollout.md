# One account, two spaces

Authorised scope: all eight account/volunteer consolidation checkpoints, including cleanup of replaced paths.

Architecture: one Supabase Auth identity per adult; explicit organisation, production and profile memberships determine access. My Home leads to My Activities and Manage Organisations. Household membership alone grants no performer or volunteer access. Job titles are labels, not permission grants.

The implementation follows Supabase Auth and database Row Level Security patterns:
- https://supabase.com/docs/guides/auth
- https://supabase.com/docs/guides/database/postgres/row-level-security

User metadata is not an authorisation source. Existing records are not claimed by matching names or emails. Staff accept recipient-bound invitations; already proven account-bound staff sessions can preserve their established membership.

| Checkpoint | Acceptance condition | Status |
| --- | --- | --- |
| 1. Inventory | Every known entrance has a replacement or deliberate retained purpose | Complete; evidence below |
| 2. Signup/login | No account-type choice; safe return destinations; one adult identity | Complete; evidence below |
| 3. My Home | Participation and management available from the same account | Complete; evidence below |
| 4. My Activities | Profiles, productions, schedules, payments and volunteering are connected | Complete; evidence below |
| 5. Volunteer permissions | Actual profile keys govern requests; confirmed hours and staff approvals protected | Complete; evidence below |
| 6. Management | Accepted account-bound memberships replace repeated codes | Complete; evidence below |
| 7. Cleanup | Old routes remain compatible; replaced gates and misleading code messages removed | Complete; evidence below |
| 8. Verification/release | Boundary and browser journeys pass; hosted migration and publication verified | Complete; evidence below |

## Entrance map

- `/login`, `/signup`: canonical adult authentication; account type metadata becomes historical only.
- `/member`, `/home`: My Home. Profile selection moves to explicit My Profiles navigation.
- Cast/volunteer production `/portal`: signed-in account's authorised production activities; no production-code gate.
- `/Team`, team-portal, `/crew`, treasurer-portal, legacy general portal: management entry through accepted production membership and existing page permissions.
- Organisation member invitations and ownership transfers: retain recipient-confirmed actions tied to the same account.
- Household invitation/consent links: retain scoped capability actions, with adult login where required.
- Offer, registration, callback and self-tape links: retain their record destinations and account checks.
- Season-pitch passcode: an organisation's submission restriction; retain as a purpose-specific gate, not a login type.
- Daily sign-in/out: attendance, not account authentication.
- Sponsor submission: same adult account.

## Proof limits

Automated provider stubs cannot prove inbox delivery. A real recovery or invitation email journey must be reported separately from a passing automated test. International privacy/legal review remains a separate launch requirement. Historical unowned records and disputed authority require reviewed linking, never automatic assignment.

## What changed, in plain language

1. **One adult login.** Your email and password identify you. This is called authentication. You no longer choose an Individual or Organisation account when signing up.
2. **Two spaces behind the same front door.** My Activities holds the people and shows you participate in. Manage Organisations holds the productions you help run. My Home joins these spaces. A parent who volunteers and produces a show keeps the same login.
3. **A profile is a person; a household is a grouping.** A household can contain one adult, partners, children or a mixture. Joining a household does not unlock everybody's private records.
4. **Keys belong to individual adults.** A guardian has permission for the named child. A second guardian uses their own email and password, sees the same child's records and shared payment balance, and can receive separate emails. This permission check is called authorisation. Database Row Level Security (RLS) checks it even if someone bypasses a screen.
5. **Another adult can help without taking over.** An adult performer can confirm booking help without maintaining a regular login. Volunteering requires separate explicit permission. Notification-only contacts can receive updates without management access.
6. **Volunteering uses those same people.** The signup asks which authorised profile each request belongs to. My Activities shows requests and shifts across the connected shows. Staff approve requests and confirm hours; approving a future shift does not mean that person attended it. No new volunteer login or reusable volunteer code is created.
7. **Management uses invitations and permissions.** A staff member confirms the invitation sent to their assigned email, then opens the show from Manage Organisations. President, treasurer and director are job titles. Their assigned page permissions determine what they can read or change. Removing staff access closes their sessions.
8. **Old information stays safe.** Existing volunteer records are preserved. The adult requests a link sent to the record's existing inbox, signs in with that address and explicitly connects the matching authorised profile. Different names, disputed responsibility and duplicate identities use an operator review. There is no silent merge by surname, household or email.
9. **Payments remain a tracker.** Authorised adults see the schedule, recorded payments and outstanding balance. The site does not divide parental contributions or collect bank login credentials. Existing unreconciled historical payments remain visibly flagged.
10. **Old entrances still lead somewhere useful.** Member dashboards go to My Home; old volunteer/schedule links go to My Activities; old Team/crew/treasurer entrances check the same accepted management membership. Offer, registration, consent and recovery links retain their specific jobs.

| Website part | What it represents | Who can open it |
| --- | --- | --- |
| Adult account | Your identity and login | You |
| My Home | Overview and actions | You |
| My Activities | Your authorised profiles, shows, schedules and shifts | Adults with the relevant profile key |
| Household and access | Grouping, profile invitations, payment tracker and protected review requests | Relevant authorised adults; original access manager controls invitations |
| Manage Organisations | Organisation and production management | Accepted memberships with the required permissions |
| Email contact | Where confirmed updates are sent | Receives separate email; this alone grants no account access |
| Operator review | Checked correction, disputed access or historical linking | Privileged operator, with recorded evidence and decision |

## Operational details

- The new database migration is `20261116170000_one_account_and_volunteer_profiles.sql`. Private account bindings/invitations reuse existing team positions, profiles and the shared mail outbox.
- `bts_my_home` returns only the caller's participation records and explicit memberships. Ordinary staff can still manage the production records their page permissions allow, through the existing scoped tools.
- Invitations and historical confirmations expire in seven days, are recipient-bound, single-use and stored as hashes. The mail outbox temporarily holds the token needed for delivery, remains private and uses bounded retries and provider idempotency.
- Volunteer history requests reveal no record search results. Confirmation requires the inbox token, receiving account, actual profile key and consistent person name. A mismatch requires review. A copied link alone cannot claim records.
- `volunteer_link` reviews use the existing `tools/household-review.py` workflow. Check the requesting adult's authority and volunteer identity; include existing account controllers in the verified-user list where present. Approvals preserve the existing row, payment links and audit trail. Never approve solely because names match.
- Delivery-only contacts remain distinct from management. Active guardian/delegate keys are rechecked when queued volunteer updates are sent. Notification-only contacts need a confirmed invitation and can unsubscribe using their receipt preferences.
- Staff contact email changes invalidate the old position's account binding, invitations and sessions. A personal Auth email change preserves the same accepted adult identity until the production changes that assigned position.
- Deactivated or 18-year-old child profiles lose guardian-derived access immediately. Scheduled transitions and notifications do not substitute for these database checks.
- Failed invitation delivery after three attempts requires operator attention using queue metadata. Resend a fresh staff invitation or repair a still-relevant historical job with its existing UUID/idempotency key. Do not bulk replay expired links or delivered jobs.
- No active production was reported at rollout. Historical data remains preserved rather than being reset.

## Release acceptance and limits

The local database suites include account age/eligibility, cross-family isolation, split guardians, adult permission and withdrawal, cross-production staff denial, invitation binding, duplicate shift denial, protected approvals/hours, profile revocation/adulthood and historical confirmation/replay boundaries. Isolated Chromium journeys exercise the actual website scripts with synthetic APIs, mobile widths and invitation/volunteer confirmation buttons. They do not access Safari, send real emails or sign into real user accounts.

An exact hosted-schema rehearsal must pass and roll back before applying the migration. Publication requires matching website files and all three email functions, then live permission/schema/route/source checks. Deployment outcomes are recorded below.

**Separate launch checks:** a real receiving adult must complete an invitation and password-recovery journey in their own inbox. The known text-only recovery email is not certified fixed by a local HTML template or by successful SMTP sending. Supabase's hosted recovery HTML is now installed and was verified after reloading the dashboard; a fresh real reset email still needs to be checked by its recipient. Reviewed CLI sparse configuration corrected the production site/redirect URLs, raised the server password minimum from six to twelve and enabled confirmed-email signup. Double confirmation for email changes was already enabled. SMTP and MFA settings were preserved. International legal/privacy review, retention decisions and operating procedures remain launch work; this code change cannot certify compliance in every English-speaking jurisdiction. Existing volunteer opportunity capacity/attendance workflows are separate from account ownership and must be tested before opening a real show.


## Published release, 2026-11-16

- Implementation commit `fb496b69` pushed to `main`; a final follow-up preserves organisation invitations through signup verification and records these outcomes.
- Database migration `20261116170000` committed with its exact source in migration history after the hosted rollback rehearsal passed. Exact-source checksum verified.
- Active edge functions: `send-email` v35, `send-invite` v20 (retired endpoint returns 410), `household-mail` v2.
- All twelve local account-security suites passed; isolated household and unified-account browser journeys passed at mobile/tablet/desktop widths. The final signup journey verifies the recipient invitation and requested return survive email confirmation. 338 website script blocks parse without errors; diff whitespace checks pass.
- Thirteen live API checks pass: anonymous private actions, operator/mail service actions and raw volunteer reads are denied; invalid capability links fail; caller-chosen email content is rejected; private bindings are unexposed. No personal rows were retrieved and no real verification email was sent.
- Fourteen published routes/assets contain the matching release markers, including the three new spaces and old team/treasurer/People entrances.
- Private browser schema access, private relationship SELECT grants, anonymous new private RPC grants and publicly marked private file buckets all remain closed. Zero exact rehearsal accounts survive.
- All 128 historical volunteer records remain, still unassigned until an adult completes the confirmation/review process. Existing payment counts remain 44 canonical records and ten legacy rows; nothing was silently merged or discarded.
- The minute mail scheduler has successful runs and the live outbox is empty.
- Production Auth settings verified after changes: twelve-character minimum; email confirmation required; double confirmation for email changes; production website and canonical verification/reset redirect allowlist. SMTP/MFA settings preserved.
- Branded recovery email subject, button and fallback URL installed using only the Supabase tab inside this app. Saved source/preview persisted after reload. Safari and private inboxes were not opened. Screenshot: `/tmp/bts-reset-template.png` (local session artifact).
- Remaining acceptance by a real adult: receive a fresh reset email, complete the password change themselves, and accept an invitation in a second account. Automated tests do not claim personal inbox delivery or completion. Operator MFA enrolment, wider privacy/retention/legal launch review and production-specific staffing/capacity checks remain distinct launch requirements.


## Visual correction, 2026-11-16

The first consolidated My Home/My Activities release introduced a new horizontal navigation and custom card styling that Katie had not requested. The correction reuses the existing member dashboard shell/sidebar, member-sidebar stylesheet, position cards, icon assets, week-strip calendar and opportunity band from the pre-consolidation implementation (`b81f51a4`). The new account-wide data and permission checks remain connected to those existing visuals. No database, Auth, invitation or ownership rules change in this correction. The shared member sidebar shows the current consolidated destinations. Browser checks cover the restored sidebar/cards/week strip, mobile widths and the existing account/invitation/volunteer journeys. Work on transactional audition booking remains local and unapplied while this correction is completed.


## Organisation/member separation correction, 2026-11-16

Organisation profiles create and manage productions. Member profiles represent the individual and their household, cast/audition/volunteer activity. The same authenticated adult can access both, but their profiles, navigation and workspaces are distinct. Household access never grants organisation or production authority.

The member-style Manage Organisations landing page was an unwanted presentation change and is removed. `/manage` redirects to the existing `/org/dashboard`, retaining the production context when present. Owners/admins open the original organisation dashboard, hero, branding, production cards, calendar and settings. A small existing-style selector appears only for adults who manage multiple organisations; remembered selection is a UI preference and is rechecked against actual memberships. Invalid requested organisations fail closed. Accepted production staff open the original production workspace using their bound session; unaccepted staff must confirm their assigned-email invitation. Member-only accounts receive no organisation management controls.

Organisation navigation retains its original organisation tools, with a separate footer link back to Member profile. The unsolicited member navigation row is removed from production navigation. The three sidebar loaders use the documented shared v20 cache key and reject cached markup lacking the current release marker, so an old cached member-navigation row cannot mask the correction. Shared navigation consumers receive cache-version updates only. The member shell continues to use the restored existing member dashboard components; it no longer renders organisation or production management cards.

The organisation dashboard's CSS is preserved. No database, Auth, guardian or membership permissions are changed. Browser verification covers the actual original organisation page, owner entry, an unrelated organisation URL, member-only entry and accepted staff routing, plus the existing member/invitation/volunteer journeys. Audition booking work remains local and unapplied during this correction.
