# Step 1: private-data route coverage

Scope: access to records, API functions and stored files in the current non-ticket website. This is a finite access-control checkpoint, not a whole-product security or legal certification. Ticket orders, tickets, scanning, seat holds and seating inventory remain excluded by the user's instruction.

## Route checks

| Route family | Enforced boundary |
| --- | --- |
| Personal profiles and family audition portals | Active adult Auth user owns the profile/application/booking; copied codes do not transfer ownership |
| Casting and offer responses | Filtered own-account read model; dedicated yes/no response RPC; immutable applicant and production links |
| Registration | Filtered own-account contact/answer updates; no internal cast notes or decisions |
| Registration payments | Own-account, read-only totals/status; unrelated payments and mixed-family household logs excluded |
| Staff finance | Current account-bound session and explicit finance page permission; view cannot write; finance edit cannot make casting decisions |
| Self-tapes and callbacks | Owned applicant and matching production; callback files require a staff-issued callback state or callback permission |
| Volunteer portals | Owned account; staff-only approvals/hours; inherited delete/insert grants removed |
| Production and organisation discovery | Read-only projections; draft/private JSON, household rosters, invitation credentials and owner details masked separately from publication |
| Calendars and venue discovery | Published events and explicitly published venues only; private check-in/call data stays in scoped staff records |
| Production/organisation working records | Production or organisation scope and appropriate read/edit/manage permission |
| Sponsor/proposal submissions | Adult sign-in; server-stamped submitter ownership; cannot finalise another account's submission or self-certify payment |
| Historical privileged RPCs | Guarded wrappers or execution revoked; no anonymous email lookup, staff removal, observation writes or cast synchronisation |
| File downloads and uploads | Bucket/path permission checked by Storage RLS; private buckets; page-only signed links expire after five minutes |
| Older HTML pages and alternate clean routes | Same database rules; compatibility queries use the same filtered projections |

Public audition material requires an explicitly tagged/typed material file and a published character reference. Approved programme artwork can be served publicly; draft artwork stays private. Logos, banners and public posters remain public branding assets. A signed link issued before access is removed remains usable until its expiry; it is not an instantly revocable login session. See [Supabase bucket access](https://supabase.com/docs/guides/storage/buckets/fundamentals) and [signed-link expiry](https://supabase.com/kb/troubleshooting/storage-private-bucket-files-still-accessible-after-remove-access-or-logout).

## Table inventory

The preflight contains 86 public base tables: 76 covered and 10 explicitly excluded ticket/seating tables. Read-only views are separately checked for inherited INSERT/UPDATE/DELETE grants; Supabase's existing defaults grant more than SELECT, so every projection has an explicit revoke-and-grant block.

| Table | Access source |
| --- | --- |
| `applications` | Explicit scoped policy / filtered public or participant projection |
| `audition_applications` | Existing account/session boundary, with anonymous and view-write grants checked |
| `audition_bookings` | Existing account/session boundary, with anonymous and view-write grants checked |
| `audition_configs` | Scoped page: `auditions.general` |
| `audition_custom_questions` | Scoped page: `auditions.general` |
| `audition_sessions` | Scoped page: `auditions.schedule` |
| `audition_slots` | Scoped page: `auditions.schedule` |
| `audition_time_slots` | Explicit scoped policy / filtered public or participant projection |
| `auditions` | Explicit scoped policy / filtered public or participant projection |
| `budget_categories` | Scoped page: `budget.breakdown` |
| `budget_items` | Scoped page: `budget.breakdown` |
| `budget_receipts` | Scoped page: `budget.receipts` |
| `budget_settings` | Scoped page: `budget.collect` |
| `callback_groups` | Scoped page: `auditions.callback` |
| `cast_members` | Scoped page: `cast_list` |
| `casting_assignments` | Scoped page: `auditions.casting_board` |
| `castings` | Explicit scoped policy / filtered public or participant projection |
| `checklist_items` | Scoped page: `overview` |
| `costume_assignments` | Scoped page: `cast_list` |
| `costume_groups` | Scoped page: `cast_list` |
| `daily_checkins` | Scoped page: `cast_list` |
| `email_templates` | Scoped page: `email_templates` |
| `household_payment_logs` | Scoped page: `registration.payments` |
| `member_ids` | Existing account/session boundary, with anonymous and view-write grants checked |
| `opportunities` | Explicit scoped policy / filtered public or participant projection |
| `org_files` | Organisation role; public projection only where intentional |
| `org_folders` | Organisation role; public projection only where intentional |
| `org_invitations` | Existing account/session boundary, with anonymous and view-write grants checked |
| `org_members` | Existing account/session boundary, with anonymous and view-write grants checked |
| `org_team_templates` | Organisation role; public projection only where intentional |
| `organization_planning_events` | Organisation role; public projection only where intentional |
| `organizations` | Explicit scoped policy / filtered public or participant projection |
| `past_shows` | Organisation role; public projection only where intentional |
| `performance_seat_inventory` | Excluded: ticketing/seating |
| `portal_permissions` | Scoped page: `production_team` |
| `producer_tasks` | Scoped page: `overview` |
| `production_access_audit_log` | Scoped page: `production_team` |
| `production_acts` | Scoped page: `script_breakdown` |
| `production_audition_live_events` | Existing account/session boundary, with anonymous and view-write grants checked |
| `production_audition_live_state` | Existing account/session boundary, with anonymous and view-write grants checked |
| `production_audition_notes` | Existing account/session boundary, with anonymous and view-write grants checked |
| `production_audition_observations` | Existing account/session boundary, with anonymous and view-write grants checked |
| `production_audition_room_states` | Existing account/session boundary, with anonymous and view-write grants checked |
| `production_characters` | Scoped page: `auditions.general` |
| `production_crew` | Scoped page: `production_team` |
| `production_events` | Scoped page: `production_calendar` |
| `production_files` | Scoped page: `overview` |
| `production_folders` | Scoped page: `overview` |
| `production_permission_pages` | Existing account/session boundary, with anonymous and view-write grants checked |
| `production_proposal_intakes` | Organisation role; public projection only where intentional |
| `production_proposals` | Organisation role; public projection only where intentional |
| `production_props` | Scoped page: `overview` |
| `production_roles` | Scoped page: `cast_list` |
| `production_room_next_signals` | Existing account/session boundary, with anonymous and view-write grants checked |
| `production_scenes` | Scoped page: `script_breakdown` |
| `production_script_import_items` | Scoped page: `script_breakdown` |
| `production_team_member_page_permissions` | Existing account/session boundary, with anonymous and view-write grants checked |
| `production_team_member_sessions` | Existing account/session boundary, with anonymous and view-write grants checked |
| `production_team_member_special_permissions` | Existing account/session boundary, with anonymous and view-write grants checked |
| `production_team_members` | Existing account/session boundary, with anonymous and view-write grants checked |
| `productions` | Explicit scoped policy / filtered public or participant projection |
| `profiles` | Existing account/session boundary, with anonymous and view-write grants checked |
| `programme_ads` | Scoped page: `marketing.programme` |
| `registration_payment_records` | Scoped page: `registration.payments` |
| `roles` | Explicit scoped policy / filtered public or participant projection |
| `scan_events` | Excluded: ticketing/seating |
| `scene_characters` | Scoped page: `script_breakdown` |
| `scene_groups` | Scoped page: `script_breakdown` |
| `scene_notes` | Scoped page: `script_breakdown` |
| `seat_holds` | Excluded: ticketing/seating |
| `self_tape_submissions` | Scoped page: `auditions.general` |
| `sponsor_businesses` | Scoped page: `marketing.sponsors` |
| `sponsor_deliverables` | Scoped page: `marketing.sponsors` |
| `sponsor_files` | Scoped page: `marketing.sponsors` |
| `sponsor_packages` | Scoped page: `marketing.sponsors` |
| `sponsor_settings` | Scoped page: `marketing.sponsors` |
| `team_notes` | Existing account/session boundary, with anonymous and view-write grants checked |
| `ticket_orders` | Excluded: ticketing/seating |
| `ticket_types` | Excluded: ticketing/seating |
| `tickets` | Excluded: ticketing/seating |
| `venue_layouts` | Excluded: ticketing/seating |
| `venue_rows` | Excluded: ticketing/seating |
| `venue_seats` | Excluded: ticketing/seating |
| `venue_sections` | Excluded: ticketing/seating |
| `venues` | Organisation role; public projection only where intentional |
| `volunteer_signups` | Existing account/session boundary, with anonymous and view-write grants checked |

## Function inventory

The preflight reviewed 77 existing public function signatures, including overloads. New helper functions bind checks to `auth.uid()`; they do not take a caller-selected account identity. Private implementations cannot be called directly by browser roles.

| Function | Classification |
| --- | --- |
| `bts_accept_org_invitation(text)` | Account/self-scoped or active-session permission helper; existing boundary tests plus route tests |
| `bts_accept_ownership_transfer(text)` | Account/self-scoped or active-session permission helper; existing boundary tests plus route tests |
| `bts_account_is_active()` | Account/self-scoped or active-session permission helper; existing boundary tests plus route tests |
| `bts_audition_record_permission(uuid,text,integer)` | Account/self-scoped or active-session permission helper; existing boundary tests plus route tests |
| `bts_authorize_email_send(uuid,uuid,boolean)` | Account/self-scoped or active-session permission helper; existing boundary tests plus route tests |
| `bts_can_access_production(uuid)` | Account/self-scoped or active-session permission helper; existing boundary tests plus route tests |
| `bts_can_read_profile_file(text)` | Account/self-scoped or active-session permission helper; existing boundary tests plus route tests |
| `bts_cast_member_touch_updated_at()` | Trusted trigger/synchronisation only; direct browser execution revoked |
| `bts_confirm_adult_account(date,boolean,boolean)` | Account/self-scoped or active-session permission helper; existing boundary tests plus route tests |
| `bts_get_account_status()` | Account/self-scoped or active-session permission helper; existing boundary tests plus route tests |
| `bts_organisation_role(uuid)` | Account/self-scoped or active-session permission helper; existing boundary tests plus route tests |
| `bts_ownership_transfer_candidates(uuid)` | Account/self-scoped or active-session permission helper; existing boundary tests plus route tests |
| `bts_parse_performer_birth_date(text)` | Account/self-scoped or active-session permission helper; existing boundary tests plus route tests |
| `bts_preview_org_invitation(text)` | Account/self-scoped or active-session permission helper; existing boundary tests plus route tests |
| `bts_preview_ownership_transfer(text)` | Account/self-scoped or active-session permission helper; existing boundary tests plus route tests |
| `bts_production_page_permission(uuid,text,integer)` | Account/self-scoped or active-session permission helper; existing boundary tests plus route tests |
| `bts_public_audition_availability(uuid)` | Account/self-scoped or active-session permission helper; existing boundary tests plus route tests |
| `bts_public_volunteer_availability(uuid)` | Account/self-scoped or active-session permission helper; existing boundary tests plus route tests |
| `bts_refresh_cast_members_from_application()` | Trusted trigger/synchronisation only; direct browser execution revoked |
| `bts_refresh_cast_members_from_booking()` | Trusted trigger/synchronisation only; direct browser execution revoked |
| `bts_refresh_cast_members_from_character()` | Trusted trigger/synchronisation only; direct browser execution revoked |
| `bts_request_account_deletion(boolean)` | Account/self-scoped or active-session permission helper; existing boundary tests plus route tests |
| `bts_request_volunteer_shifts(uuid,jsonb,text,boolean)` | Account/self-scoped or active-session permission helper; existing boundary tests plus route tests |
| `bts_save_profile(jsonb,uuid,boolean)` | Account/self-scoped or active-session permission helper; existing boundary tests plus route tests |
| `bts_script_breakdown_touch_updated_at()` | Trusted trigger/synchronisation only; direct browser execution revoked |
| `bts_start_ownership_transfer(uuid,uuid)` | Account/self-scoped or active-session permission helper; existing boundary tests plus route tests |
| `bts_sync_cast_member_assignment_trigger()` | Trusted trigger/synchronisation only; direct browser execution revoked |
| `bts_upsert_cast_member_from_assignment(uuid)` | Trusted trigger/synchronisation only; direct browser execution revoked |
| `can_manage_sponsor_production(uuid)` | Slug/type/configuration helper; no private row payload; underlying file permissions remain required |
| `can_public_upload_programme_ad_asset(uuid)` | Slug/type/configuration helper; no private row payload; underlying file permissions remain required |
| `finalize_sponsor_submission(uuid,uuid,text,text,text,text,jsonb)` | Adult-account submission wrapper; owner/financial checks as applicable |
| `finalize_sponsor_submission(uuid,uuid,text,text,text,text,jsonb,jsonb,text)` | Adult-account submission wrapper; owner/financial checks as applicable |
| `get_public_proposal_page(text,text)` | Restricted public configuration/count/contact response; no private record directory |
| `get_public_sponsor_page(uuid)` | Restricted public configuration/count/contact response; no private record directory |
| `get_slot_booked_counts(uuid)` | Restricted public configuration/count/contact response; no private record directory |
| `is_blocked_organization_slug(text)` | Slug/type/configuration helper; no private row payload; underlying file permissions remain required |
| `is_reserved_organization_slug(text)` | Slug/type/configuration helper; no private row payload; underlying file permissions remain required |
| `lock_organization_slug()` | Trusted trigger/synchronisation only; direct browser execution revoked |
| `lookup_email_by_bts_id(text)` | Authenticated own-account lookup only |
| `normalize_slug_for_blocklist(text)` | Slug/type/configuration helper; no private row payload; underlying file permissions remain required |
| `organisation_observation_delete(uuid,uuid)` | Staff permission wrapper and matching production references |
| `organisation_observation_upsert(uuid,uuid,uuid,uuid,text,text,text,text,text,jsonb,text,text,text)` | Staff permission wrapper and matching production references |
| `organization_slug_available(text,uuid)` | Slug/type/configuration helper; no private row payload; underlying file permissions remain required |
| `production_proposal_intakes_set_updated_at()` | Trusted trigger/synchronisation only; direct browser execution revoked |
| `production_proposals_set_updated_at()` | Trusted trigger/synchronisation only; direct browser execution revoked |
| `public_production_contact(uuid)` | Restricted public configuration/count/contact response; no private record directory |
| `remove_production_team_member(uuid,uuid)` | Staff permission wrapper and matching production references |
| `resolve_team_portal(text,text)` | Slug/type/configuration helper; no private row payload; underlying file permissions remain required |
| `rls_auto_enable()` | Slug/type/configuration helper; no private row payload; underlying file permissions remain required |
| `set_production_audition_observations_updated_at()` | Trusted trigger/synchronisation only; direct browser execution revoked |
| `submit_public_production_proposal(text,text,jsonb)` | Adult-account submission wrapper; owner/financial checks as applicable |
| `submit_public_production_proposal(text,text,text,jsonb)` | Adult-account submission wrapper; owner/financial checks as applicable |
| `submit_sponsor_interest(uuid,text,text,text,text,text,text,text,text,integer,text)` | Adult-account submission wrapper; owner/financial checks as applicable |
| `team_audition_live_event_apply_for_session(uuid,text,uuid,uuid,text,text,jsonb,text,text,text)` | Existing account-bound session guard |
| `team_audition_live_state_list_for_session(uuid,text)` | Existing account-bound session guard |
| `team_authored_notes_for_production(uuid,text)` | Existing account-bound session guard |
| `team_member_colour_list_for_session(uuid,text)` | Existing account-bound session guard |
| `team_member_manage_page_access_for_session(uuid,text,uuid,jsonb,boolean)` | Existing account-bound session guard |
| `team_member_page_access_for_session(uuid,text)` | Existing account-bound session guard |
| `team_member_resume_session(uuid,text)` | Existing account-bound session guard |
| `team_member_revoke_session(uuid,text)` | Existing account-bound session guard |
| `team_member_start_session(uuid,text,text,text)` | Existing account-bound session guard |
| `team_member_update_profile_for_session(uuid,text,text,text,text,text,text,text,text)` | Existing account-bound session guard |
| `team_members_for_session(uuid,text)` | Existing account-bound session guard |
| `team_next_signal_list_for_session(uuid,text)` | Existing account-bound session guard |
| `team_next_signal_upsert_for_session(uuid,text,uuid,text,text,text,text,uuid,text,text,uuid[],uuid,text,text,uuid[],text)` | Existing account-bound session guard |
| `team_note_add_for_session(uuid,text,uuid,uuid,uuid,text,text,text,integer)` | Existing account-bound session guard |
| `team_note_delete_for_session(uuid,text,uuid)` | Existing account-bound session guard |
| `team_note_update_for_session(uuid,text,uuid,text)` | Existing account-bound session guard |
| `team_observation_delete_for_session(uuid,text,uuid)` | Existing account-bound session guard |
| `team_observation_upsert_for_session(uuid,text,uuid,uuid,uuid,text,text,text,text,text,jsonb)` | Existing account-bound session guard |
| `team_observations_for_production(uuid,text)` | Existing account-bound session guard |
| `team_room_state_list_for_session(uuid,text)` | Existing account-bound session guard |
| `team_room_state_upsert_for_session(uuid,text,uuid,text,text,text,text,text,uuid,text,text,uuid[],uuid,text,text,uuid[])` | Existing account-bound session guard |
| `touch_updated_at()` | Trusted trigger/synchronisation only; direct browser execution revoked |
| `try_uuid(text)` | Slug/type/configuration helper; no private row payload; underlying file permissions remain required |
| `unlock_public_proposal_page(text,text,text)` | Restricted public configuration/count/contact response; no private record directory |

## Validation and remaining steps

`npm test --prefix tests/account-security` includes the route suite against a synthetic schema with the hosted default-grant behaviour enabled. It checks anonymous denial, cross-family reads and writes, protected staff fields, offer decisions, self-tapes, payment forgery, mixed-household isolation, finance viewer/editor separation, staff revocation, cross-production references, file paths and inherited view grants. The same SQL fixtures are rehearsed against the hosted schema in a transaction ending in ROLLBACK. JavaScript/inline-script parsing and public zero-row API checks complement these tests. No personal record retrieval or test email is required.

Step 1 does not claim that historical records are linked, identity/guardianship is verified, booking capacity is transactional, attendance proves hours, email workflows are completed, legal requirements are satisfied, or full browser account journeys and operational recovery drills have passed. Those remain steps 2–10 from the agreed checklist. Browser slot holds are no longer permitted to mutate shared slot rows directly; capacity and hold replacement belong to step 5.

Step 1 deployed on 2026-11-16 as release `256a3a25`, with migration `20261116120000`. All boundary suites, the hosted rollback rehearsal and 27 live zero-row API/query checks passed. Postflight found no anonymous private-table reads, inherited projection write/delete grants, publicly marked private buckets or remaining fixtures. Deployment details are recorded in `reference_supabase_sql_checklist.md`.
