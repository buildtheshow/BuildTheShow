# Account screen presentation

The account-confirmation, ownership-handover and old-link fallback pages initially used independent minimal layouts. They now reuse the existing login/signup form treatment through `ASSETS/styles/account-forms.css`: the purple logo header, light grid, white card, padded controls, consent rows, action buttons and footer. This consolidates those added pages; it does not redesign the existing login/signup pages or organisation dashboard.

Copy follows **Platform Voice** in `SHARED/CODEBASE_RULES.md`: direct, practical and supportive; shorter instructions, no forced theatre jokes and no raw backend errors. The confirmation page says “Confirm your details”, explains that logins are for adults, tells a guardian to enter their own details, and keeps the private birth-date explanation. The full policies remain linked and consent is still explicit.

| Screen | Purpose | Unchanged authority |
|---|---|---|
| `/member/account/confirm` | Confirm adult details and accept the current privacy notice/terms for an older login | Auth session, verified email, active/closed/underage status and `bts_confirm_adult_account` |
| `/member/account/transfer` | Review and explicitly accept an organisation handover | Recipient-bound invitation preview, active adult check, consent and `bts_accept_ownership_transfer` |
| Old production/account links | Find the correct organisation or member destination | Session and canonical memberships in the existing entry helper |
| `/member/households` | Manage profiles, household membership and existing invitations | Existing family RPCs, profile keys, consent and payment-read permissions |

The household page keeps its sections, form IDs and actions. The pass aligns its header, field colours, heading sizes and spacing with existing brand patterns, and replaces technical explanatory wording with plain instructions. Dynamic copy changes are labels only; invitation kinds, permission checks, record links, amounts and request payloads are unchanged. Compatibility portal wrappers use the same presentation as the canonical old-link entry page. Every shared script consumer has a matching updated cache version.

Validation uses synthetic APIs only:

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/bts-playwright-browsers node tests/account-security/account-screens-browser.cjs
PLAYWRIGHT_BROWSERS_PATH=/tmp/bts-playwright-browsers node tests/account-security/family-browser.cjs
```

Checks cover 320/768/1280 widths, card appearance and logo loading, adult-only confirmation, blocked closed/underage/unverified states, return links, explicit ownership consent and recipient restrictions, household creation, child guardian confirmation, payment display, no-login consent and booking selection. Screenshots are reviewed before publication. No real birth date, permission, ownership, password or account record is changed by these checks. This presentation pass is not a claim that the entire site's legal or functional audit is finished.
