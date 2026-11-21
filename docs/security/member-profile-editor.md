# Member profile editor

The approved editor is `/member/profiles/:id/edit`. My Profile in the shared member navigation opens the selected person's editor. The existing `/member/profiles/:id` preview and profile picker remain available.

## Layout and storage

Four fixed tabs: Audition Profile, Volunteer, Creative Team, Headshots. Sections expand in place, one at a time per tab. There are no section reordering controls. Headshots belong to the person across all roles.

All data stays in the existing `public.profiles` record. No schema migration or new table is required. Existing fields hold names, pronouns, bio, birth date and headshots. Existing `sections` JSONB stores performer details, volunteer history/skills/training/preferences and creative history/training/skills/portfolio. History entries contain `title`, `organisation`, `role`, `year`; volunteer entries also contain `description`. A creative role is free text, allowing directing, choreography, producing, design and other disciplines.

The editor merges into the loaded `sections` value rather than reconstructing it. Older skill ratings, comfort preferences, creative role descriptions, existing Resume / CV references and unknown fields survive unrelated edits. Older creative descriptions are editable within Creative History. Date of birth remains read-only because the existing protected identity workflow owns it. Delegated editors cannot change another adult's credit name.

## Save behaviour

Saving is explicit. Unsaved changes trigger the browser's leave-page warning. No profile text or photo data is copied to persistent browser storage. Existing sidebar session keys hold only identity/display context and role-enabled flags.

Saves check `bts_profile_access` again and use the existing row-level policies. Updates return the matched ID; a silent zero-row update is never reported as success. Original sections, bio, primary/gallery photos and editable identity fields are compared before writing, so conflicting edits are refused instead of overwriting another person's save. Unsaved fields stay on screen on failure. A fresh reload is required after a concurrent-edit conflict.

New uploads use immutable, random paths under the uploading adult's account and selected profile. Photos accept JPG/PNG/WebP and Resume / CV accepts PDF, up to 5 MB each. Up to five photos. Each upload must succeed and bind through `bts_bind_profile_file` before saving the reference. Failed uploads/bindings stop the record update and display an error. A successfully uploaded file can be retried without overwriting a prior application attachment. Removing a file from the editor removes the current profile reference; it does not delete files used by previous applications.

## Privacy boundary

The editor requires an active adult session and explicit management permission before loading the record. The existing `profile_key_read` and `profile_key_update` policies protect the record; anonymous visitors and unrelated adults cannot read it. Profile access is never inferred from a production, organisation name or circle name.

`profile-headshots` remains a private bucket. Canonical `/object/public/` strings are the existing record-reference format, not public access grants. Every displayed private photo and PDF is resolved using the established private-media helper with short-lived signed URLs. Profile images are signed before setting `src`. Uploads also bind to the individual profile so a second authorised guardian can view the correct files without gaining access to siblings.

Saving sets no publication, visibility, application or production fields. It sends no email and creates no public profile link. It does not update previously submitted applications. A later explicit application/sharing step controls what the production receives; public publication requires its own consented workflow. External portfolio/media links remain subject to the hosting provider's privacy settings, and the editor does not embed or request their contents.

## Verification

- `node tests/account-security/profile-data.test.cjs`
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/bts-playwright-browsers node tests/account-security/profile-editor-browser.cjs`
- `node tests/account-security/family-run.cjs` checks independent guardian access, anonymous/unrelated isolation, private file scope and revocation against the actual SQL policies.
- `node tests/account-security/private-media.test.cjs` checks signing and denial.
- Existing member navigation/Home/Activities and canonical URL checks.

Browser tests use synthetic records and mocked account/storage APIs. They exercise save/reload, preserved old fields, both histories, private headshots, immutable PDF paths, upload/binding failures, conflicting saves, revoked access, preview and narrow layouts. They do not write live member records or send mail.
