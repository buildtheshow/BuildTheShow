# Correcting a profile set up as the wrong type

This feature is in the existing member Settings → Profile and organisation Settings → Organisation Profile panels. It adds one matching Settings card. Page CSS, navigation, dashboard layouts and existing branding are unchanged.

The adult login is a person. A member profile and an organisation are separate records, not interchangeable access roles. This correction changes the actual records used by the workspaces, without changing authentication, password, email, organisation privileges or household keys.

## What the form does

1. The server lists only the adult's own personal profile and organisations they currently own. Children, delegated adults, organisation administrators and volunteers cannot convert someone else's profile.
2. The person explicitly chooses the source and confirms the consequences.
3. Person → organisation either uses an organisation they already own or creates a private organisation with an explicitly entered name, contact email and available address. Personal dates of birth, photos and other private profile information are not copied. The unused mistaken member profile is archived.
4. Organisation → person reuses the adult's own member profile, or creates one using the entered personal name and the existing adult-account birth-date declaration. It archives the unused mistaken organisation and hides its public page. Its old address remains reserved.
5. An archived member profile can be restored automatically only if a previous completed type correction archived it. An unrelated archive/deletion request is not silently reversed.
6. Existing productions, files, auditions, volunteering, households, invitations, additional contacts or other linked records prevent automatic correction. The source remains unchanged and a private review reference is recorded. A review request is not a completed correction.
7. A private ledger records requester, source, intended target, outcome and decision. The user can retrieve their own recent references in the same card. This ledger stores workflow evidence; it is not another people/account database.

Database migration: `supabase/migrations/20261116210000_profile_type_corrections.sql`. It adds the private ledger, an organisation archival timestamp, authenticated options/correction RPCs, and an operator-only resolver. Archived mistaken organisations are filtered from the canonical My Home workspace list. Existing records are retained; this is not a privacy deletion operation.

The server checks permissions and dependencies inside a transaction. An account lock serialises correction requests and rate limits them. Source row locks prevent new foreign-key relationships appearing between the dependency check and archival. FK-backed links are inspected from the database catalogue, including newly added tables. Unsupported composite references require review. Shared contact/key checks are explicit. The existing slug CHECK's helper receives a pinned search path so it works under the correction RPC's restricted lookup path. Existing slug uniqueness, blocklist and locking rules remain authoritative.

## Resolving a protected review

No email is sent by this feature. Operators list the private queue through the linked Supabase CLI:

```sh
python3 tools/profile-type-review.py --list --apply
```

Verify the requesting adult's identity and current authority outside the request. Inspect the source's actual linked records and resolve those relationships with the appropriate existing ownership/history workflow. Do not delete production or personal history merely to enable conversion. A production-bearing organisation should normally stay an organisation; the person should keep their separate member profile.

Record a factual decision in a local text file. The reason is visible to the requesting adult; exclude identity documents and other people's confidential information. Prepare a decision (prints SQL without running it):

```sh
python3 tools/profile-type-review.py --request REQUEST_UUID --approve --verified-user ADULT_UUID --reason-file /path/to/decision.txt
```

Add `--apply` to execute. Declining uses `--decline --reason-file /path/to/decision.txt`. The tool checks the intended linked project; approval also checks that the verified adult matches the request. The service-only resolver rechecks ownership, account status, target eligibility and all dependencies. Approval cannot bypass an unresolved connection. If linked history must remain, decline with an explanation and use the existing separate member/organisation model.

## Validation and rollout

```sh
node tests/account-security/profile-type-run.cjs
PLAYWRIGHT_BROWSERS_PATH=/tmp/bts-playwright-browsers node tests/account-security/profile-type-browser.cjs
```

The database fixtures include both correction directions, personal-profile reuse/restoration, creation when no personal profile exists, stranger/child rejection, explicit confirmation, malformed target rejection, reserved addresses, scoped history, protected production history, deduplicated reviews and operator resolution. Browser checks use the actual Settings files with synthetic APIs, verify 320/768/1280 widths, and send no emails.

Hosted rollout: rehearse the exact migration plus synthetic fixtures in one transaction ending ROLLBACK; apply and record only this migration atomically; publish matching Settings/component code; check live source checksum, grants, route assets, original style-block equality and zero fixture leftovers. Do not blanket-push unrelated pending migrations. Real account corrections happen only when their adult submits the form.

Separate work remains in the existing organisation setup wizard and public URL routing audit. This feature does not claim those repairs or international privacy/legal review are finished.

2026-11-16 validation: all thirteen existing local suites, the correction database fixtures, the isolated actual-Settings browser checks, and all 339 JavaScript/inline-block parses passed. Both original Settings style blocks match the pre-change versions exactly. The final hosted rehearsal passed and rolled back. Migration `20261116210000` was applied with exact source history and verified by checksum. Postflight confirms authenticated-only correction RPCs, a service-only resolver, no browser private-ledger/schema access, the active-workspace archive filter, unchanged existing record counts and zero synthetic accounts. No real account was corrected and no test email was sent.

Follow-up: member Settings incorrectly limited source choices to personal profiles, leaving an organisation owner without a personal profile at an empty state. The form now lists all server-authorised own personal profiles and owned organisations in member Settings, with explicit type labels. Organisation Settings remains restricted to its current organisation. Source changes rebuild the matching fields and clear confirmation, and submission retains the selected source's actual type and ID. Regression browser coverage includes an organisation-only owner, both available types, source changes, a genuinely empty eligible list and an unrelated organisation context. Both HTML consumers use the bumped shared-script version. No database migration or real profile correction is needed for this repair.

Settings URL follow-up: the `/member/settings` static rewrite returned a 308 to the internal extensionless source path. An explicit Pages Function now serves the existing Settings asset at the clean route using the established URL-only asset fetch. Both old SYSTEM Settings forms redirect to `/member/settings`, retaining query parameters and using uncached redirects. Route unit checks cover the handler contract and old URL forms; Settings browser fixtures now enter through `/member/settings`. Hosted verification must require the initial `/member/settings` response to be 200 with no Location header, and old-path redirects must terminate at that exact clean URL. A successful final HTML body after following redirects is insufficient evidence of a correct route.

Login destination follow-up: ordinary login previously sent every adult to `/home`. The existing login form now checks canonical `bts_my_home` memberships and defaults organisation owners/administrators and accepted production staff to `/org/dashboard`; other adults go to member home. Old signup account-type metadata is not authority. Explicit return destinations and invitations retain precedence, so the existing Member profile switch remains deliberate. Membership-check failure shows a retryable error instead of guessing a workspace. A dedicated `/login` handler and both legacy login URL mappings preserve the clean login URL. Login and dashboard style blocks are unchanged. Regression browser checks exercise owner/admin/staff/member/viewer, forged legacy labels, deliberate member and volunteer returns, invitation precedence, stored returns and connection failure using synthetic credentials only.
