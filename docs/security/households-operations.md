# Household implementation and operations

Migration: `20261116150000_households_and_profile_keys.sql`. Website entry: `/member/households`.

## Canonical storage

All new relationship storage is in the non-exposed `bts_private` schema. `households`, `household_members` and `household_profiles` organise people. `profile_controls` records creator, primary manager and adult subject; `profile_keys` records explicit self, guardian or delegate access. `profile_contacts` is a separate confirmed notification directory. `family_invites`, `family_reviews`, `family_audit` and `family_mail` implement capabilities, protected decisions, change history and a durable email outbox. `profile_file_keys` binds an exact private object to its canonical profile so creator-folder access cannot bypass a revoked key.

Existing `profiles`, audition applications/bookings, casting assignments, production settings and registration payment records remain authoritative. No duplicate performer, casting, payment or volunteer database is introduced.

`bts_family` is the narrow browser gateway. Anonymous callers can only use private emailed capability links for preview, acceptance/decline, email preferences and delegated-adult permission. Guardian/household/login activation acceptance requires the matching active adult account. Invitation secrets are hashed in the invitation directory; raw delivery links live only in the private outbox. Senders see status, not recipient capability tokens. Requests are rate-limited; invitations expire after seven days and are single-use.

`bts_profile_access`, `bts_owns_audition` and related helpers use the real signed-in account. They control row policies, participant projections, offer responses, registration declarations and file signing. Linked records cannot fall back to their original creator after a key is revoked. Authorised production staff keep their existing scoped permissions. A DOB correction cannot extend guardian access through an ordinary browser form.

Household payment access covers a production billing group's financial totals, not its other performers' private profiles, names, birth dates or medical information. Current registration records are counted once; legacy household logs are separately labelled for reconciliation. Existing discount eligibility is projected as a boolean without exposing volunteer identity. The wider attendance-proof issue remains outside this feature.

## Operator reviews

There is intentionally no browser super-admin switch. A family submits a pending request from the household page. An authorised operator uses the existing privileged Supabase CLI session:

```sh
python3 tools/household-review.py --list --apply
```

Verify the requester, receiving adults, relevant authority and actual identity outside the automated application before approving anything. A matching surname/email, an adult checkbox or being the creator is insufficient proof of legal custody. Follow the organisation's reviewed safeguarding procedure for disputed guardianship; do not contact another adult in a way that could expose a protected address or family situation. Store a minimal decision summary, not copies of identity documents, in the reason file.

Prepare an exact decision first; without `--apply` the tool prints SQL only:

```sh
python3 tools/household-review.py --request REQUEST_UUID --approve \
  --verified-user REQUESTER_UUID --verified-user RECEIVING_ADULT_UUID \
  --reason-file /private/tmp/review-reason.txt
```

After checking the prepared decision, repeat with `--apply`. Use `--decline` for a refusal. The database checks required verified users, protects the primary manager, preserves audition references and records the decision. The tool checks that the linked project is `tkmaiktxpwqfbgeojbnf`. It never deletes Auth users. Conflicting self profiles require choosing the retained profile and a deliberate review, rather than merging by a name/email match.

The available review types are guardian removal, primary-manager handover, record linking, duplicate performer, duplicate login, birth-date correction and adult activation. A guardian removal request comes from the primary manager; a disputed exceptional case requires operator investigation, not a generic automatic override. Reviewed duplicate-profile handling preserves linked audition/casting/payment history by moving the audition profile reference, carries deliberately verified keys/contacts and file bindings, moves the audit history and archives the source. It does not combine organisations, Auth credentials or unrelated adult profiles.

## Email delivery

`household-mail` is a public, empty-body queue pump. It accepts no caller-chosen recipient, content or job ID. Only service-role RPCs claim/finish jobs. A global claim lock, ten attempts per minute, 90-second leases, three attempts and provider idempotency keys bound retries. Recipient eligibility is rechecked before queued production updates are claimed. Separate copies avoid revealing other guardians' email addresses through CC.

The worker uses existing `RESEND_API_KEY` and `FROM_EMAIL` environment secrets. No provider secret is stored in SQL. `pg_cron` runs the private tick every minute using `pg_net`; the tick calls only the fixed queue pump. Turning 18 revokes access immediately via the permission helper, independent of the scheduler; the scheduler adds one transition notice.

Booking inserts queue server-side template rendering. The retired `on-audition-booked` webhook pointed to an absent function and is removed. `send-email` authorises staff/limited participant confirmations and queues canonical recipient copies. A queued response is not a delivered response. Registration delivery metadata advances only after successful provider acknowledgement. A provider acknowledgement means accepted by the provider, not proven inbox delivery.

Inspect queue aggregates without dumping private tokens/content:

```sql
SELECT kind,state,count(*) FROM bts_private.family_mail GROUP BY kind,state;
```

Investigate persistent failures using minimal metadata and the relevant production template. A failed job after three attempts needs operator attention; do not bulk-replay old notifications or expired invitation tokens. If repairing a failed, still-relevant job, retain its UUID/payload and provider idempotency key. Do not clear/rewrite already delivered jobs. Check mail capacity before broad launch.

## Verification and deployment

`npm test --prefix tests/account-security` includes the household database and pure client/delivery suites. `npm run test:browser --prefix tests/account-security` requires the installed Playwright Chromium test browser; `PLAYWRIGHT_BROWSERS_PATH` may point to a temporary installation. Browser tests use synthetic API responses and never production login credentials. They cover household/profile creation, the balance, no-login adult confirmation, fragment removal, canonical performer selection and widths 320/768/1280. The hosted SQL rehearsal uses the exact migration plus synthetic fixtures and ends in ROLLBACK. Automated email checks use a fake provider.

Apply the single migration transaction and record the exact source in migration history; do not blanket-push an unrelated migration history. Deploy `supabase/functions/household-mail` with `--use-api --no-verify-jwt`; its empty-body behaviour is the intended protection. Package `BACKEND/SupaBase/functions/send-email/{index,authorization}.ts` as the matching `send-email` function and deploy through the API. Push the matching website files, then verify HTTPS assets/routes, scheduler, grants, anonymous denials and zero synthetic survivors.

Before rollback, stop the scheduler and assess new live household relationships. Do not drop relationship/audit tables or revert to creator-only rules after families have accepted keys. Use a forward repair preserving relationships; retain a schema-only preflight and exact migration source. Production email/provider receipt and real two-account recovery/browser journeys require an authorised controlled launch test and are not simulated by these suites.

## Release record, 2026-11-16

- Website implementation: `f577b9a5`, pushed to `main`; ten HTTPS route/asset markers verified, including the hosted 308 canonical redirects.
- Database: `20261116150000`, exact source recorded atomically after the hosted rollback rehearsal.
- Functions: `send-email` v34 and `household-mail` v1 active.
- All local account-security suites and the isolated household browser suite pass; 336 website script blocks parse without errors.
- Eleven live anonymous/zero-row HTTP checks pass. The relationship schema remains unexposed; browser roles cannot execute operator/mail service RPCs. Private file buckets remain private. No synthetic accounts survive.
- The minute scheduler has completed successful runs. The live household outbox was empty at postflight; no verification email was sent.
- Existing payment counts remain 44 current registration records and ten legacy household-log rows. Relevant legacy rows require staff reconciliation and are visibly flagged.
- A real invited second adult's inbox delivery, personal agreement/recovery journey and the wider international privacy/account launch checklist are not certified by these checks.
