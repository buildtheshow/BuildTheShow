# Member profile completion

The approved My Profile layout now has Audition Profile, Volunteer, Creative Team, Headshots and Contact & emergency tabs. Access, transfers, type changes and archiving are under Settings → Profile settings with an explicit profile picker. Legacy `#profile-settings` links redirect there. The profile page reuses the calendar’s 220px left drawer at mobile widths.

Initial circle-first profile setup remains name, date of birth and photo. The full profile uses “Name used on programmes and credits” and “Fill in the sections you need. You can come back to the rest.”

## Private contact boundary

`20261125140000_member_profile_completion.sql` adds three private workflow tables: `member_contact_details`, `member_contact_shares` and `member_absence_reports`. Existing `profile_contacts` is a notification-recipient ledger, not a place to store emergency information. Existing `profiles` and `sections` are readable by other authorised profile managers and are deliberately not used for these private fields. No duplicate identity, production, calendar or notification records are introduced.

All new tables have RLS enabled and no direct anonymous/authenticated grants. Checked RPCs require an active adult account. Only the current profile access manager/subject may read or edit private contact fields; an added guardian or circle admin gets no details. Reads and writes respect existing profile/age access boundaries. Version checks prevent another window silently overwriting a save. Private values are not written into the general audit trail.

Sharing creates an explicit selected-field snapshot for a linked production. Updating the private record does not silently update a previously shared snapshot. Contact and emergency groups are chosen separately. Revocation remains possible after participation ends. Production reads require the organisation owner/admin or a current account-bound, active production contact’s session; a matching email, unverified role title or general circle access is insufficient. Archived, expired guardian access and superseded manager shares are suppressed. These details never enter public profile responses or an audition submission. Account exports include private contacts only when the signed-in account may read them.

## Audition handoff

The existing audition picker lists manageable profiles and routes Add a profile through the existing circle-first page in a new tab, retaining the current form and offering Refresh profiles. The old `new:self`, `new:child` and `new:adult` creation bypass is rejected. Shared review supports saved bio, acting/dance/singing/training experience, selected headshot and Resume / CV, with per-application text edits and explicit confirmation. Unselected material is not added. Selected values are snapshotted in existing application fields/custom answers, rather than dynamically reading a profile later. Bio is also a readable named answer. Every prepare rechecks profile permission. Cached review contains selected material only, not older booking fields. Switching profile clears the review and prior headshot state.

The file permission helper now gives production staff access only to a file selected in a submitted application/booking. A production relationship no longer opens all files saved to the person’s profile. Existing authorised member and upload permissions remain enforced. No new media bucket is introduced.

The separate transactional audition booking work remains outside this release. Public-page changes in this release are limited to the shared handoff cache version and profile-switch headshot cleanup.

## Absence reports

My Calendar and My Activities production events share one absence component. Only called cast events, booked auditions and approved shifts can be reported; information-only/pending calls, invented events and unrelated members are rejected on the server using the existing canonical calendar. Whole-event, late-arrival and early-departure reports accept an optional 500-character note. Timed changes must fall within an event with confirmed start/end times. Multi-member reports use one atomic RPC; no partial success is claimed. Version checks prevent stale overwrite and an account/member daily limit bounds notification spam.

Reports keep the event in the schedule. They are reported, acknowledged or withdrawn, never automatically approved. The configured member-facing production contact is resolved on the server and receives a minimal queued email, without the private note or contact information. The existing mail worker handles delivery and safe canonical links. Queued mail is cancelled if that recipient no longer serves as a production contact. The production Calendar has a compact staff disclosure to review/acknowledge reports and read only explicitly shared contact details. Member-facing reads show the acknowledgement. Same-day changes also advise direct contact.

## Verification

- `node tests/account-security/member-completion-run.cjs`: synthetic contact save/version, second-parent isolation, direct-table denial, production opt-in/revocation, unverified staff denial, absence validation/version/withdrawal, staff acknowledgement, queued mail, submitted-file access and unselected-file denial; rolled back.
- `member-completion-browser.cjs`: contact save failure/recovery, explicit sharing, other-parent suppression, selected audition review and absence reporting, narrow widths; synthetic API only.
- Existing profile save/reload, Settings, access, transfer, calendar and production-details browser suites.
- Existing profile-data, invitation/email rendering and canonical URL suites.
- Exact-source hosted rollback rehearsal passes before applying only this migration. No real invitation, audition or absence email is sent by these tests.

Applied and recorded only `20261125140000_member_profile_completion` after exact-source hosted rollback rehearsals passed. Source MD5: `fc706b8061a43ee5d96ba81c67ea7f76`. Matching mail worker deployed; frontend asset/route checks follow publication. The unrelated booking migration remains unapplied.
