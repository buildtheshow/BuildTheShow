# Account settings

`/member/settings` is an account-wide page using the approved compact layout and existing sidebar/icon assets. It never uses the selected profile to choose the account being edited. The signed-in adult's name and verified login email stay visible even with a child selected.

## Controls

- Account: separate expandable email and password sections. Email change uses Supabase Auth and the existing `/login` confirmation return; the displayed login email does not change on submission. The user follows email confirmation instructions. Passwords require twelve characters and matching confirmation; inputs clear only after successful update.
- Notifications: production news, reminders, optional Circle updates and existing marketing consent. Saving merges the existing notification object with these explicit choices using the current Auth user, preserves unrelated metadata and reports errors instead of announcing success. Each adult controls only their own account preferences.
- Privacy & data: account/profile explanation, existing privacy and terms pages, a download of account details and only profiles returned as manageable by the Circle API, and a separate email link for a complete personal-information request. The download is not advertised as a full production-record export. Query failures prevent a misleading partial-success download.
- Closure: reuses the reviewed four-step deletion-request flow. The current adult reauthenticates before `bts_request_account_deletion`; submitting records a reference and deletes nothing immediately. Circle/organisation ownership and linked profiles remain subject to review. Passwords are cleared after submitting. Dialog focus is contained and restored.

Circle creation/joining and profile editing, positions, archiving and conversion are removed from Account settings. Profile controls are a collapsed section within the selected profile editor. Access/payment links carry that exact profile ID; archive uses the existing guarded API and blocks unsaved edits. Conversion is offered only for a selected adult subject and its options are restricted to that selected source. Existing organisation contexts retain their original behaviour. Contact/emergency-field redesign remains separate follow-up work.

## Notification delivery

Migration `20261121150000_account_notification_preferences.sql` adds one service-only mail policy function, reusing Auth metadata and the existing private queue. No new account/profile/preference table is created. The worker checks the confirmed recipient account before delivering a leased job. Optional mail disabled by that recipient is cancelled, not marked as delivered. Failure to check preferences fails/retries delivery rather than ignoring the preference.

Existing eligibility, contact unsubscribe and queue guards still apply. Essential invitations, access/consent changes, booking/casting/registration/payment confirmations and volunteer assignment updates remain deliverable. Optional production-template categories are explicitly classified; unknown categories remain essential by default. Newsletter mail requires explicit marketing consent. Existing email-only contacts keep their separate contact preferences. This release does not add a reminder scheduler or newsletter campaign sender.

## Verification

`settings-browser.cjs` exercises a selected child alongside the adult account, pending email confirmation, password validation/save, preference failure/success and metadata preservation, scoped downloads/failures, reauthenticated closure and responsive widths using synthetic APIs without sending email. `settings-notifications.test.cjs` exercises the actual SQL policy, recipient isolation, essential messages, opt-in defaults and browser execution denial. Existing profile-editor, canonical URL and email-rendering checks remain required. Hosted exact-source rollback rehearsal uses only the labelled synthetic Circle email account; metadata and queue changes roll back, and no messages are sent.

Deployment: exact-source hosted rollback rehearsal passed, migration `20261121150000` was applied and recorded atomically, and the matching household-mail function was deployed. No emails were sent by the settings tests and no real account email/password was changed.
