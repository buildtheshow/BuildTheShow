# Build The Show — Claude Rules

## Templates — MOST IMPORTANT RULE

Before writing ANY rendering code, READ the template test page first.

- Template test page: `SYSTEM/Organisations/Productions/Workspace/template-test.html`
- In The Show cards, casting cards, volunteer cards, brand tiles — ALL have existing render functions
- **Workflow: find the exact function call in the template test → copy it verbatim → only change the data**
- Never build custom HTML for something a template already covers
- If output looks wrong, the bug is in the DATA, not the template structure

## Data Sources — Pull From What Exists

- Performer names: `audition_bookings.name`
- Casting assignments: `casting_assignments` (applicant_id may point to either `audition_applications.id` or `audition_bookings.id` — check both)
- Characters/roles: `production_characters`
- Do NOT create new tables to hold data that already exists elsewhere

## Supabase

- Always check `reference_supabase_sql_checklist.md` before assuming a table exists
- Never create a separate table just to cache data from an existing table
- When a feature needs new DB storage, add it to the SQL checklist AND tell Katie to run it

## Navigation / Sidebar

- Sidebar is shared: `SHARED/Navigation/production-sidebar.html`
- Nav JS: `SHARED/Navigation/production-sidebar-nav.js`
- Always bump the `?v=` version number when changing the nav JS
- All sidebar cache keys must stay unified (`bts-prod-sidebar-v20`)

## Design Rules

- Brand colours ONLY — 10 official colours: `#000000 #572e88 #efab45 #efefef #769e7b #dd8233 #d1523d #78bbd4 #476aaa #ca7ea7`
- No horizontal scroll — ever
- No left border accent bars
- No em dashes
- Canadian English

## Git

- Commit and push directly — no confirmation needed
- Always bump CSS/JS `?v=` query strings when changing shared files
