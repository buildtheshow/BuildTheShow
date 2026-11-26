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

- Preserve Katie's existing design throughout. Reuse established layouts, visual components, colours and styling. Use judgement for small matching adjustments; explain and ask Katie before major visual or layout edits.

- Before writing user-facing copy, read the Platform Voice section in `SHARED/CODEBASE_RULES.md` and use it as the source of truth.

- My Circle uses `my-circle.svg` in navigation, circle cards, and circle selectors.

- Signup icons chosen by Katie: Organisation uses `organisation-members.svg`, Member uses `performer2.svg`, Household uses `Home.svg`. Preserve these mappings.

- Brand colours ONLY — 10 official colours: `#000000 #572e88 #efab45 #efefef #769e7b #dd8233 #d1523d #74a2b4 #476aaa #ca7ea7`
- Branded surfaces use solid fills only: no gradients, glass, frosted, or translucent colour treatments; avoid pastel/lavender tints.
- Use black text on white or neutral `#efefef` surfaces, and white text on every coloured brand surface.
- Audition selection accents follow type: General audition `#476aaa`; Dance call `#dd8233`; Callback `#769e7b`; Another audition `#d1523d`.
- Selected cards and radio/checkbox controls use the current audition highlight; selected card text and icons turn white, while unselected card text stays black and icons use the highlight colour.
- Selected multi-select cards may show a compact outlined circular `✓` at the upper-right; use a white outline and check on the filled highlight colour.
- Keep option cards in the same set equal in size, with consistent icon sizing and aligned title/description positions.
- Approved audition method icons: In person `Department-production-and-rehearsal-support.svg`; Video call `VideoCall.svg`; Self-tape `SelfTape.svg`. “Another audition” uses `CreativeTeam-Director.svg`.
- No horizontal scroll — ever
- No left border accent bars
- No em dashes
- Canadian English

## Git

- Commit and push directly — no confirmation needed
- Always bump CSS/JS `?v=` query strings when changing shared files
