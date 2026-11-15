# Account access and children’s privacy

This is implementation documentation, not a legal certification.

## Agreed product policy

Only account holders aged 18 or over may have a login. Parents and legal guardians manage under-18 profiles through their own account. An account birth date is separate from the performer’s birth date. Email verification and an age declaration do not verify legal guardianship or constitute a universal COPPA parental-consent mechanism.

## Authorities

| Concept | Canonical source | Meaning |
| --- | --- | --- |
| Login identity | Supabase Auth user ID | Identifies the signed-in person |
| Adult account eligibility | `bts_private.account_controls` | Private, server-controlled age declaration and status |
| Profile owner | `profiles.user_id`, with legacy `account_id` checked for consistency | Owns this private profile; neither field may be reassigned from the browser |
| Guardian declaration | Profile guardian ID, consent timestamp and notice version | Adult account holder attests responsibility for this child |
| Organisation owner | `organizations.admin_id` | Main organisation account holder; the historic column name does not mean every administrator |
| Organisation access | `org_members.access_level` | Viewer, editor or admin within one organisation |
| Production access | Production team membership and page permissions | Permissions within the assigned production, not platform ownership |
| Job title | Member title/role text | Display information; never a platform administrator flag |
| Platform operator | Supabase/hosting administration | Separate from website organisation accounts; no browser-editable super-admin flag |

Existing users must confirm the updated account notices once before accessing private account features. A historical under-18 account cannot be converted into an adult account by changing browser metadata; the operator must arrange guardian access safely.

Existing organisation workspace write policies are owner-only. This foundation does not silently give every editor, viewer or administrator access to every child’s records. Expanding delegated workspace access requires explicit, tested permissions.

## Invitation rules

The invitation directory is private. A token-scoped RPC shows only the organisation label and invited position. Accepting requires an active adult account with a verified email matching the intended recipient. The backend copies the stored permissions and consumes the invitation in the same transaction. Clients cannot choose a different role or organisation. Existing memberships are not upgraded by replaying an invitation.

## Ownership transfer

Only the current owner can invite an existing, verified adult member to take ownership. The recipient must accept while signed into the exact intended account. Links expire after 24 hours and are single-use; a replacement link revokes the previous one. The database locks the organisation while changing ownership. Personal profiles do not move with the organisation. The previous owner remains an organisation admin. No invitation email is sent automatically by this feature.

## Deletion requests

The request form stores an immutable request identifier and timestamp. Submitting does not claim that a login, storage objects or production history were deleted. The operator must review linked records, legal retention and organisation ownership, then complete and record the deletion. A request queue is not automatic deletion. Do not delete an organisation owner’s Auth user blindly: the existing foreign key cascades deletion to that organisation.

## International launch requirements

Language is not a legal jurisdiction. The intended markets include Canada, the US, the UK and other English-speaking markets. Before accepting children’s data in each market, document applicable laws, the legal basis for each data use, controller/processor responsibilities, international-transfer arrangements, retention periods, rights handling, breach procedures and any representative or registration requirements.

A guardian checkbox is an attestation, not identity verification. The US COPPA assessment must consider whether the service is directed to children or knowingly collects information directly from under-13s; obtain a reviewed verifiable parental-consent process wherever required. The UK Children’s Code requires high privacy defaults where applicable. Ireland’s digital-consent threshold is 16 where an online service relies on the child’s consent. BC also imposes retention requirements for information used to make decisions; a blanket promise to erase every audition record after 30 days is inappropriate.

Official guidance checked 2026-11-15:

- https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/7-default-settings/
- https://www.dataprotection.ie/sites/default/files/uploads/2023-04/DPC_ChildrensData_ParentalConsent.pdf
- https://www.oipc.bc.ca/documents/guidance-documents/2164
- https://www.priv.gc.ca/en/privacy-topics/privacy-for-businesses/appropriate-handling-of-personal-information/collecting-personal-information-and-consent/consent/gl_omc_201805/
- https://www.oaic.gov.au/privacy/your-privacy-rights/more-privacy-rights/children-and-young-people

## Remaining rollout checks

### Audition account ownership and public availability

The `20261115133000` stage binds new public audition writes to active adult accounts, records guardian declarations for new child submissions, protects account/production/profile links and staff decision fields, and replaces the slot pickers' applicant-list reads with a count-only RPC. Matching name and birth date only deduplicates records within the same adult account; it is never evidence of ownership across families. New photos use the private profile-file bucket with account-scoped paths.

The same cutover removes anonymous base-table reads, restricts base records to scoped staff access, and gives participants filtered, updatable projections for their own account. These projections omit staff assessment and server consent fields. Triggers still enforce ownership and allowed changes when writes pass through a view; synthetic tests verify that the view owner cannot bypass those checks. Legacy linking, transactional booking/holds, other participant tables and their storage remain unfinished.

### Account-bound production team sessions

Migration `20261115123000_account_bound_team_access.sql` requires an active adult Auth account before a team code can create a session. The entered email must match that account. Sessions are bound to the Auth user ID and production, expire after eight hours and are checked against current membership/permissions on each RPC. Historical bearer-only sessions are revoked rather than assigned to accounts by an unverified email match. Team login allows at most 20 requests per production/email target in a fixed 15-minute window; counters contain hashes rather than email addresses and expire after two days.

All historical `team_*` implementations move to the non-exposed private schema, with execution revoked from browser roles. Public session RPCs retain their existing signatures behind a common guard. Passcode-only overloads are retired. New team operations are denied until explicitly added to the guard's allowlist. Stored page permissions override access-level defaults; a job title or browser menu cannot grant permissions. Updates also validate referenced productions, performers, sessions, characters and the ownership of notes/observations.

| Stored team access level | Default audition access |
| --- | --- |
| Producer/admin/owner | Manage production pages |
| Creative/room | Edit general audition notes; view dashboard/schedule |
| Check-in | Edit dashboard/check-in; view general/schedule |
| Schedule | Edit schedule; view general/dashboard |
| View only | View general/dashboard/schedule; cannot write |
| Missing/unrecognised | None |

The six audition note/observation/live-state tables now deny anonymous access. Direct table access remains restricted to the active organisation owner; team members use checked RPCs. This closes both the permissive anonymous note policies and a faulty cross-organisation observation policy without broadening delegated workspace access.

This does not complete the public application/booking/volunteer migration, fix historical email confirmation, or grant organisation admins/editors access to every workspace. A team code remains a supplementary credential, not legal identity or guardianship verification.

The follow-up `20261115124500_require_team_session_for_staff_helpers.sql` closes the email-match-only branch in private photo access and service-only email authorisation. A staff account must have an active bound session for that exact team member and production. An authorised staff member may access a submitted profile image, not every file in the guardian's family folder. The owner's and organisation admin's existing Auth-user-ID-based checks remain separate.

Do not describe the whole product as locked down until public audition/volunteer portals, email endpoints, consent, storage and production team access have passed the same backend boundary tests. The schema review found broader public-record permissions that require a coordinated portal migration. Ticketing remains explicitly out of scope.

## Local verification

Run `npm ci --prefix tests/account-security` then `npm test --prefix tests/account-security`. The tests run a schema-only model of the relevant production tables in PostgreSQL (PGlite), with synthetic accounts. They exercise ownership boundaries, guardian consent, invitation recipient binding and replay, adult account eligibility, metadata privilege forgery and ownership transfer, then roll back the migration and fixture changes. A passing model is not a substitute for the production schema preflight or a legal review.

The 2026-11-15 live check found automatic email confirmation enabled. This remains unresolved: a non-null Auth confirmation timestamp from that configuration does not prove inbox ownership. Enabling real confirmation later will not retroactively verify existing accounts. Complete a reviewed inbox-verification flow before treating email-matched staff as verified.

Before rollout, verify Supabase email confirmation, an appropriate server-side password minimum, recovery redirect allowlists, signup/login rate limits and operator MFA. The website password-length check alone is not a server-side password policy.

## Privacy request operating procedure

Monitor the private deletion-request queue and the published privacy inbox. Assign an operator and record the applicable response deadline for the requester's jurisdiction. Verify the requester through their existing account; do not ask families to email children's identity documents as a default.

Before deleting an account, identify organisation ownership, guardian relationships, production submissions, uploaded files and any required retention. Complete an accepted ownership transfer first where an organisation must remain. Resolve shared guardianship or disputed authority through a reviewed process, rather than handing a child's profile to someone who merely knows its ID.

Remove or de-identify data that can be deleted, revoke active sessions and links, and document any narrow retention exception and its expiry. Account deletion does not automatically remove Storage objects or records held by a production organisation. Check backups and processors under their actual deletion schedules before describing deletion as complete. Then record completion and notify the requester with an honest description of the result. Do not run an unreviewed `auth.users` deletion: the current organisation ownership foreign key cascades.

This release only records the request. A named operator, a working monitored privacy inbox and this operating procedure are launch requirements, not completed automation.
