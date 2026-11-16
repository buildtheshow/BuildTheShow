# Beta signup

The existing home-page popup now explains that Build The Show is in beta testing and accepts an invitation code. A successful check carries the code in same-tab session storage to `/signup`; it is never added to a URL. The existing signup form also accepts a code directly. Its adult birth-date declaration, privacy/terms consent and email verification are unchanged. No account was created for Katie's new email automatically.

Admission is enforced on `auth.users` insertion by migration `20261116230000_beta_signup_invitations.sql`. A valid code is required even if a caller bypasses the pages and uses the Auth API. The guard runs after existing adult account registration; it atomically consumes one available code use, records the invitation reference on private account controls, and removes the raw code from stored user metadata before tokens can include it. Failed inserts roll back their code use. Existing logins and password resets do not insert users and remain available.

The private `beta_invitations` table stores a hash, label, expiry, revocation timestamp and bounded use counter. Browser users cannot list/read/write it or issue codes. The only anonymous RPC, `bts_check_beta_code`, returns whether the submitted code is currently usable. Random UUID-based codes resist guessing; existing Auth rate limits still apply to actual signup attempts. Frontend validation is convenience only, and the insertion guard rechecks expiry, revocation and remaining uses.

An authorised operator can use the linked Supabase CLI to run SQL such as:

```sql
SELECT public.bts_issue_beta_code('Beta tester invitations',25,30);
```

This returns the raw code once, its ID, capacity and expiry. Share it only with intended beta testers; do not commit it, place it in public HTML or store it in analytics/URLs. The normal defaults allow 25 signups over 30 days. To revoke it, set `revoked_at=now()` on the specific `bts_private.beta_invitations` row using its ID. Revocation blocks future signups; it does not remove existing testers' accounts or roles. The issued invitation is admission only and grants no organisation, household, staff or child-profile access.

Beta mode currently applies to every newly created adult login, including a new person arriving through an organisation or household invitation. Existing invited users can sign in normally; new invited testers need both the beta code and their normal invitation/consent process. Public signup without a code is intentionally unavailable during beta.

Validation:

```sh
node tests/account-security/beta-run.cjs
PLAYWRIGHT_BROWSERS_PATH=/tmp/bts-playwright-browsers node tests/account-security/beta-browser.cjs
```

Fixtures cover direct insert bypass attempts, missing/wrong/expired/revoked/exhausted codes, unchanged adult restrictions, failed/duplicate insert rollback, private grants, admission evidence and removal of secrets from Auth metadata. Browser coverage uses the real home/signup files and synthetic APIs; it covers code entry, direct signup validation, private handoff, consent, email-verification messaging and mobile widths. No test email is sent. The unified browser journey includes the beta field and retains verification-return/invitation parameters.

Deployment requires exact-source hosted rehearsal ending ROLLBACK, atomic migration/history application, generation of an initial code, matching site publication, and live checks of private permissions, trigger installation, fixture cleanup and the clean `/signup` route. Existing unrelated pending migrations must not be blanket-pushed. Original home/signup style blocks and the home popup design are retained.

Follow-up: old signup popups remained on login and pricing after the initial home-page change. All signup entrances now call `BTSBetaSignup.show` from the shared, versioned `SHARED/Components/beta-signup.js`; the existing popup markup/styles are retained in that single component. It preserves login invitation/return parameters while carrying the code in session storage. The unrelated pricing social placeholders keep their own accurate social-page message. A dedicated pricing route preserves `/pricing`. Browser checks cover home, login navigation/footer, pricing navigation/CTA and query handoff; all three existing page style blocks are unchanged. No database or invitation-code change is required.
