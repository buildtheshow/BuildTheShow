# Organisation setup repair plan

Status: read-only code/schema audit completed on 2026-11-16. Repairs below are not implemented by this document. The separate audition-booking changes remain local and unapplied.

## Accepted model and design requirements

- Each adult has their own authenticated identity. An organisation has its own contact email, branding and production records; adults receive explicit ownership or memberships.
- An organisation-controlled address may be an individual's login address. A shared password is not the recommended team model.
- Member and organisation workspaces remain visibly separate. Preserve Katie's existing layouts and components. Ask before major visual or layout edits.
- Settings must support **correcting a mistaken profile type**, not merely switching between existing workspaces. Katie explicitly clarified this requirement.

## Confirmed setup defects

1. `SYSTEM/Organisations/org-setup.html` still recommends an organisation-wide shared login in its ownership step. Wording/behaviour must match individual logins and organisation ownership without replacing the existing visual design.
2. Its existing-organisation query filters `admin_id` on `bts_visible_organizations`, where that column is not exposed, and selects the nonexistent `leadership_roles` field. Live schema metadata confirmed these mismatches. Errors are ignored, so edit mode can fail to identify its target and fall through to creation.
3. The organisation table has the main/white/black/alternative logo fields, but no `leadership_roles` column. The save fallback removes all three alternative-logo values along with that unsupported field, allowing incomplete saves to appear successful.
4. The parent dashboard's edit-wizard URL supplies no organisation ID. Setup also selects the first owned organisation rather than the explicitly selected organisation. Editing/creation must be separate and fail closed when the requested target cannot be loaded.
5. Existing venue replacement deletes old rows and inserts replacements in separate unchecked requests. Preserve venue identities/references and reject incomplete saves.
6. Logo paths currently use the uploading adult's ID. Verify organisation asset management after ownership transfer and removal; do not break current asset URLs while repairing this.

## Confirmed URL defects

- An anonymous HTTP trace of a test organisation handle redirected from `/bts-url-audit-only` to `/SYSTEM/Organisations/org-profile`. The profile loader derives the organisation handle from the pathname, so that redirect loses its intended context. This trace did not access an organisation record.
- The live `lock_organization_slug` trigger rejects every slug change, while Settings offers one change using `slug_changed_at`.
- Frontend and database reserved-name lists differ. The live database does not reserve existing route names including `activities`, `manage`, `org` and `pricing`.
- Setup's availability fallback can treat a failed lookup as availability. Asynchronous responses also need to be tied to the current input.
- No URL alias/history mechanism was found in the inspected code. Agree the change policy before enabling changes; if changes are allowed, retain old-link redirects and prevent unsafe reuse of former handles.

## Profile-type correction acceptance requirements

The requested Settings action must correct the mistaken setup, not merely update legacy `user_metadata.account_type` or a display preference. Those fields must never grant organisation or guardian permissions.

- Identify the specific source profile and intended target type explicitly.
- Check the authenticated adult's authority over that source. Ordinary organisation membership must not permit conversion of the organisation. Child/guardian profiles must not be treated as business profiles automatically.
- Show a concrete explanation of what will be corrected and how existing records will be retained before the user confirms.
- A member-to-organisation correction must collect the required organisation details and create/use the actual organisation record and verified ownership workflow. Keep the adult login intact; do not copy private personal or child information into public organisation fields.
- An organisation-to-member correction must establish the actual person's profile. Existing productions, other team members, organisational assets and ownership obligations require explicit resolution; they cannot be silently reclassified as personal data or deleted.
- Simple mistaken/unused setups should have a straightforward guided path. Linked or disputed records require a protected correction path with recorded decisions. The exact data mapping and completion behaviour must be settled before implementation; this audit does not claim conversion is available yet.
- Retain an audit trail, provide an accurate completion state, and verify both directions with synthetic cases before publication.

## Next implementation checkpoint

Prepare a concrete correction flow within the existing Settings components alongside organisation setup and URL repairs. Show Katie any major visual/layout proposal before building it. Test failed loads/saves, explicit organisation selection, preserved logos/venues, URL collisions, stale availability responses and retained links. Rehearse any database change against the hosted schema before application; distinguish automation from real-email/ownership confirmation tests.
