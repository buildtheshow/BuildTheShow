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

- Preserve Katie's existing design. For the canonical brand palette, approved icon mappings, visual rules, and platform voice, follow `SHARED/CODEBASE_RULES.md` as the single source of truth.
- Reuse established layouts, visual components, colours, and styling. Use judgement for small matching adjustments; explain and ask Katie before major visual or layout edits.
- **Grid and row containment is mandatory across the entire product.** Every card, field, chip, icon, label, and other child must stay inside its assigned grid column, flex row, and parent bounds at every supported screen size. Use `minmax(0, 1fr)` for shrinkable tracks, `min-width: 0`/`min-height: 0` for shrinkable children, and wrapping or responsive stacking for long content. Never solve overflow by shrinking text until it is unreadable or by clipping meaningful content. Check narrow and wide layouts whenever changing a grid or row.

## Git

- Commit and push directly — no confirmation needed
- Always bump CSS/JS `?v=` query strings when changing shared files
