# Member production activities, access and payments

## User map

- My Profile retains exactly four tabs: Audition Profile, Volunteer, Creative Team and Headshots. Profile settings below the editor contain access, invitations, the adult's own email preference, reviewed access changes, eligible type changes and archiving. There is no Payments tab in My Profile.
- My Activities lists the selected person's or authorised circle members' productions using existing compact poster cards and actual audition/cast/volunteer roles. Accepted account-bound team participation is attached only to that adult's own subject profile. Organisation ownership alone does not place every managed production in the member/circle list. Unaccepted email matches grant nothing.
- Opening a production keeps the profile/circle context. Payment information appears there only when an authorised profile has fees, a confirmed discount/waiver or recorded payments. Paid history remains visible. No-fee productions have no payment tracker. The production view offers a scoped All productions link; irrelevant creative tools and empty shift sections are hidden.
- Payments show the remaining balance and next/overdue amount, then collapsed sections in the approved order: Fee breakdown, Payment schedule, Payments received, How to pay. Shared invoices are deduplicated and explicitly show the full shared balance. Currencies remain separate. Older shared payments or payment history without fee information are marked unconfirmed; failed loads never become £0.
- My Calendar is a separate page at `/member/calendar`, accessible from the sidebar. My Activities has no calendar tab. Home retains its calendar overview. The existing Home payment reminders now open the relevant production's payment section in Activities.

## Sources and permissions

Migration `20261121170000_member_production_payments.sql` wraps the existing `bts_family_tracker` financial calculation and `bts_my_home` account projection. The old implementations are private helpers without browser execution privilege. No payment/account/profile table is added and no historical records are reassigned.

Fees, discounts, instalments and receipts remain the existing production ledger. How to pay uses the existing production instructions where supplied, otherwise the organisation's saved manual instructions; e-transfer destination follows the explicit production override and organisation configuration. Currency uses production settings, then the organisation default when absent. The response includes only the organisation's name, URL abbreviation/slug, contact email and intended payment instructions/destination. Payment provider credentials and unrelated organisation settings are not returned. Members cannot edit fees or mark a payment received here.

Instructions retain a strict formatting allowlist and safe links. Names and supported existing registration variables are substituted into text nodes; raw HTML, script, event handlers, images and executable URLs are never inserted. Incomplete variables or missing instructions are identified rather than replaced by invented bank details or references. Payment questions use the organisation's recorded contact email where available.

`bts_member_profile_access` returns the selected member's accepted key names/roles and update status, only the current adult's contact addresses, invitations that adult sent for this member, and recent action labels/dates without audit payloads. It exposes no other parent's contact addresses, private profile, siblings or raw invitation tokens. Existing protected family actions still enforce invitation scope, guardian declarations, own notification preferences and access-review rules. Reviews record a request; they do not revoke a guardian immediately.

Old manageable-profile View links forward to the agreed editor; canonical old access bookmarks forward into its Profile settings. Existing email-only consent, activation and preference links retain their compatibility handler. Broader contact/emergency-information and field-specific privacy design remains the previously deferred My Profile task.

## Verification and rollout

- `production-payments-run.cjs`: actual migrations with synthetic organisation/production defaults and overrides, accepted own-profile team roles, confirmed shared-guardian payment access, sibling/outsider isolation, narrow contact data and helper ACLs; rolled back.
- `production-payments-browser.cjs`: posters/roles, production context, conditional/no-fee/paid/unconfirmed/error/retry states, shared-invoice deduplication, malicious instruction handling and mobile widths.
- `profile-access-browser.cjs`: four profile tabs, inline access, own email preference, scoped recipient invitation and protected review.
- Existing profile-editor, Home, unified navigation, family consent/tracker, Settings, financial-summary and URL checks.
- Exact-source hosted rehearsal uses only labelled synthetic fixtures in one transaction ending ROLLBACK. No emails are sent. Apply and record only this migration, preserving the unrelated pending audition-booking migration; then publish and verify the matching frontend.

Database deployment verified: exact-source hosted rollback rehearsal passed; migration `20261121170000` was applied and its exact source recorded atomically. Postflight confirmed the recorded checksum, anonymous denial, private helper grants and absence of rehearsal accounts. No real profile, organisation payment instruction or payment record was changed; no emails were sent.

Frontend release `9f9034c4` published and verified: live Activities/Profile HTML and new script/CSS markers matched. Both production-payment and inline-profile-access browser journeys passed against published assets with synthetic APIs. No receiving-account email or financial record was changed. `production-payments.test.cjs` additionally verifies overdue amounts, no-fee visibility, paid history and unknown legacy balances.
