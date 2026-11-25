# Member calendar

The approved Apple Calendar-style preview is implemented at `/member/calendar`, using the existing member sidebar and a left drawer on mobile. Month days are square. Event labels and full start/end times stay on one line inside the colour strip. Week and List include authorized member headshots with space reserved for text. Day, Week, Month and List stay available on mobile. The new `my-circle.svg` is used for circles across navigation, cards and selectors.

The pinned FullCalendar 6.1.15 vendor bundle retains its MIT notice. Production event colours match the existing Zeus map. No example profiles or events ship in the live calendar.

## Data and access

`bts_member_calendar` accepts up to 100 explicitly manageable profile IDs, an exclusive-end date range of up to 93 days, and an optional production ID. It creates no storage. It reads actual booked audition slots and durations, volunteer shift dates and times, and production events. Historical navigation queries its own range. Production timestamps retain their timezone; audition/shift wall-clock times retain their existing date/time semantics. Missing times are labelled as unconfirmed rather than invented. Early and late calls extend the visible time grid.

A Circle selects only member profiles already shared with the signed-in account. It does not grant access by itself. Staff access belongs only to the caller's account-bound team profile. Cast call lists remain filtered by accepted assignments. Public production events are marked as information rather than a confirmed personal call. Responses contain allowlisted instructions, without private notes, family contacts, files, staff tokens or directory data.

The browser validates response scope again, uses the existing private signed-media helper, clears stale events on failures/scope changes, and supports retry. Periodic reads recheck server access. No calendar editing or email is performed.

## Validation

- `node tests/account-security/member-calendar-run.cjs`: synthetic SQL privacy, historical range, real 15-minute audition duration, repeated volunteer dates, scope and anonymous denial; rolls back.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/bts-playwright-browsers node tests/account-security/member-calendar-browser.cjs`: real page with synthetic API data; square month cells, complete fitted time labels, Week/List headshots, private-profile suppression, profile/Circle switching, error/retry, mobile widths and left drawer.
- Existing member Activities, unified navigation and canonical route checks.
- Exact-source hosted migration rehearsal in a rollback transaction before applying only this migration. Unrelated booking work is excluded.

Applied and recorded `20261122150000_member_calendar` after the hosted rehearsal passed. Recorded source MD5: `997ef9e53cd761c2016bacac01fe742b`. Authenticated execution is granted; anonymous execution is denied.
