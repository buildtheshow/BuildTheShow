# Member and circle setup

An adult account has one personal profile. `bts_ensure_own_profile` reuses its existing subject profile, adopts one unambiguous account-owned legacy profile with the matching declared birth date, or creates basic details from the adult account. It does not infer relationships from shared surnames or emails. Multiple legacy matches need review. A pending profile-claim invitation suppresses automatic profile creation to prevent duplicate personal profiles.

The existing My Circle dialog creates and names the circle first, includes the adult’s profile, refreshes Your Circles, then opens Create a profile. The existing profile-list Add Profile entry uses this flow. A sole personal profile opens directly in the existing full profile editor. Full audition, volunteer, creative and headshot layouts stay in that editor.

The basic form contains Name, Date of birth and Headshot / profile photo. It asks no additional email or phone number. A parent/guardian declaration is required for a minor; their name and notification email come from the adult account. Private photo uploads reuse the existing bucket and signed-media permissions. Upload failures preserve the form, double submission is blocked, and a per-request ID makes database retries idempotent. Existing owner/admin and circle access restrictions remain enforced. Additional adult details remain pending and cannot be used without that adult’s permission.

If signup begins with someone under 18, their name and date of birth are retained while the adult supplies their own login details. The private setup draft is bound to the adult email, can resume after email verification in another tab and is ignored after seven days. The cleanup wrapper removes the auth metadata draft atomically after successful profile creation. No account is created for the minor.

## Profile transfer

Transfer profile extends the existing Profile settings access section. For an unclaimed profile belonging to someone 18+, only its primary manager can send a recipient-bound invitation. Under-18 profiles remain adult-managed. Pending adults and members whose guardian access has ended can open the same control from My Circle.

The recipient needs an active, verified adult account with the matching birth date and must accept the single-use invitation. Existing personal profiles require review rather than an automatic merge or overwrite. The recipient confirms whether to keep or remove circle membership. Keeping membership grants no access to other members. Acceptance preserves the profile ID, details, media and history, moves its account/subject/manager binding, disables previous profile keys and notification contacts and revokes other pending invitations. Photos remain bound to the profile, so the previous uploader loses profile-based read access. Existing signed links can remain valid until their short expiry; independent production staff permissions are unchanged.

The existing invitation outbox, beta admission, email worker and branded message controls are reused. Transfer mail identifies the inviter, profile, sign-in requirement, acceptance consequences and ability to decline. No real test invitation was sent during this work.

## Database rollout and checks

No new tables are created. The two migrations use existing profiles, controls, keys, contacts, circle membership, audit records, auth metadata and invitation/email queues. Each exact source passed a hosted rollback rehearsal before being applied and recorded independently. The unrelated audition booking migration remains untouched.

- `member-setup-run.cjs`: existing circle-connection fixtures plus own/legacy profile setup, consent, circle-first creation, retries, adult permission, transfer recipient/replay, keep/remove circle, unrelated-profile denial and prior manager/photo denial; rolled back.
- `circle-page-browser.cjs`: original Circle page actions and permissions plus sequential create-circle/basic-profile photo flow at mobile widths.
- `profile-transfer-browser.cjs`: transfer fields, circle choice, acknowledgement and queued confirmation within existing Profile settings.
- `unified-browser.cjs`: signup parent prompt, retained additional-profile details, normal login and member navigation.
- `profile-access-browser.cjs`: original full profile tabs and settings behaviour.
- `family-client.test.cjs`: invitation escaping, transfer wording, single-recipient delivery and simulated provider failures.
- Canonical routes, URL inventory and changed script parsing.

Recorded migration source MD5: `fbd7a267329a720eca3ea5e90e515cfd` and `86ea69a54105e188eb2c1032d7c5f57f`.
