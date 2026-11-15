# Supabase SQL checklist

The live schema was inspected on 2026-11-15 without reading personal records.

## Account security foundation

Migration: `supabase/migrations/20261115103000_account_security_foundation.sql`

Adds private adult-account controls and deletion-request records, server-side signup eligibility, profile guardian declaration fields, ownership protection and two-person ownership transfer, token-scoped invitation RPCs, and private profile-file access.

Also adds service-only production email authorisation and request limits. The matching `send-email` Edge Function must be deployed separately. Public booking and response emails currently need a replacement server-triggered workflow; do not deploy this endpoint in isolation and silently break those messages.

Deploy matching account pages, confirmation route and private-media resolver together with this migration. Test the migration and access boundaries in a transaction ending in ROLLBACK before production application. Retain a schema-only backup of the replaced policies.

Do not run a blanket rollback that restores public access to personal records. A deployment failure should be fixed forward or restored from reviewed schema definitions. No automatic deletion job is introduced; deletion requests require an operator procedure.

Deployment status must be recorded here after verification.

2026-11-15: CLI authenticated. Local tests and a live-schema rehearsal with synthetic accounts pass; the rehearsal ended in ROLLBACK. Schema-only policy/grant/constraint backup saved locally in `/tmp/bts-account-rollout/schema-before-compact.json`. The rehearsal identified an existing slug-check helper lookup issue; the migration fixes its search path, and the local model now includes that dependency. Production application and website release are next. The email function is not yet deployed. This is not a full-product security or legal sign-off.
