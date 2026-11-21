# Circle connections and approved page

`/member/circles` uses the approved compact layout: one-sentence purpose with expandable help, circle cards, Members/Admins tabs, explicit Add a member and Request access buttons, and incoming invitation notices naming the circle and inviter. Creating a circle refreshes and selects its new card. Role and profile permissions stay independent of production participation.

## Routes and compatibility

The canonical Circle page is `SYSTEM/Members/Households/households.html`, using `ASSETS/scripts/households/circles.js`. `/member/access?profile=...` preserves the existing member access/payment tracker and review workflows. Older `/member/circles?profile=...` links redirect there. Existing email-only adult consent and email-preference links also continue through that page. Duplicate review is not part of the Circle UI.

Shared activities reuse `/member/activities?circle=...`; the existing authorised profile filter controls the circle calendar and production list. Circle membership never creates a production registration or role.

## Backend

Migration `20261121120000_circle_connections.sql` reuses `bts_circle`, existing profile keys, recipient-bound invitations, contacts and the durable family-mail queue. Its new private `circle_access_requests` table stores the workflow, not another copy of person/profile information. The prior Circle implementation is a private helper with no browser execution privilege.

- Creating or connecting a profile uses the existing ownership/guardian checks. Connecting a profile shares no additional access with existing admins.
- Admin invitations use the selected profile IDs and the recipient’s email. Recipient acceptance rechecks existing Circle authority and requires guardian name/confirmation where children are included. Names never grant access.
- Account notices list only invitations for the signed-in email. Notices expose no raw tokens. Accepting by notice ID performs the same acceptance path as an email link in one transaction. Expired, revoked, wrong-account or replayed invitations fail.
- Request access sends a generic email to the named adult without searching or exposing their profiles. Only the recipient sees the request. They select profiles whose sharing they control; approval sends the requester ordinary permission invitations and grants nothing immediately. After recipient acceptance, the selected profile connects to the requester’s owned circle. Siblings, the manager’s own adult profile and unrelated circles remain inaccessible.
- Requests are rate-limited and expire after seven days. The requester can cancel pending requests. Outstanding queue jobs are cancelled when a pending request is resolved or cancelled.
- Member-access summaries contain names and access roles, not parent email addresses, emergency contacts or medical details.
- Adults retain independent logins. Leaving a circle does not revoke independently granted guardian/profile permissions.

Sensitive contact/safety field redesign in My Profile remains the separate follow-up discussed with Katie. This release does not add a medical-data section or claim that all existing profile fields now have separate visibility controls.

## Email and signup

The existing `household-mail` Edge Function delivers escaped HTML and plain-text messages through the existing provider, with durable job state, retries and idempotency keys. Circle invitations use Katie’s approved branded layout with the existing white logo and Home icon, a purple header, named inviter/circle, selected member list, plain-language permission explanation and gold Review invitation button. HTML and plain text contain equivalent instructions; all dynamic text is escaped. The Home asset is a PNG rendering of the existing SVG for mail-client compatibility. Access-request emails contain the request link and do not enumerate a recipient’s children.

Invitation tokens stay in fragments and session storage, survive login/signup, and are removed from the address bar before rendering. A same-page hash change is also handled. A valid pending invitation can admit only its matching email through beta signup; the normal adult/consent/email-verification checks still apply. The raw token is removed from Auth metadata, and signup alone never grants profile access. Normal beta codes retain their expiry/use limits.

## Verification

- `circle-connections-run.cjs`: real SQL approval/acceptance, sibling scope, inbox isolation, wrong recipient, replay, decline, ordinary beta admission and invitation-bound signup.
- `circle-page-browser.cjs`: create failure/success, immediate circle card, new/existing member, selected invitation scope, access requests, guardian confirmation, incoming notices, email fragment resume, responsive layout.
- Existing Circle boundary, family access/payment/consent, Home, unified navigation, email rendering and canonical URL tests.
- The exact migration was rehearsed against the linked database in a rolled-back transaction. Only this Circle migration was applied and recorded; the pending booking migration was not applied.
- Katie explicitly authorised one live test invitation to `info@ClarksonPhotography.com`, using **Build The Show email test** and **Email Connection Test (test profile)**. The queue recorded provider acceptance without an error, and Katie confirmed inbox receipt. This clearly labelled test circle is retained so the recipient can accept or decline the invitation; it contains no real family information.

Publication verified: frontend commit `e885af50` is on main. Live canonical Circle/access pages and script markers matched, and the published assets passed the synthetic Circle browser journey. The email icon uses a versioned URL to avoid a cached fallback response. The approved email output passed 320px/600px layout and link checks; matching household-mail was deployed. The earlier email confirmed inbox delivery, not a second send of the revised design.
