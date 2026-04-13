# Build The Show Codebase Rules

This file is the house style for this project.

It turns the coding principles you want into concrete rules for this codebase:
- readable code first
- clean naming
- one source of truth
- stable domain language
- fewer hidden fallbacks
- UI labels that match the data model
- ask questions when anything is not certain

## Core Principles

1. Optimize for readability before cleverness.
2. Use the same word for the same concept everywhere.
3. Prefer one canonical source of truth for each workflow.
4. Make code paths obvious, short, and easy to trace.
5. Avoid silent duplication of logic or meaning.
6. Prefer explicit domain helpers over ad hoc string parsing.
7. UI wording and saved data wording should match whenever possible.
8. If anything is unclear or uncertain, ask before moving on.

## Build The Show Commandments

1. Write code for humans first.
2. Keep one clear source of truth.
3. Use strong domain language everywhere.
4. Build small, composable pieces.
5. Refactor continuously, not only when forced.
6. Reduce hidden coupling and side effects.
7. Let visual structure be intentional and disciplined.
8. Prefer systems that can evolve over systems that are only “done.”
9. Debug the flow, not just the symptom.
10. Treat code quality as part of the product.

## Domain Language

These names should be treated as canonical unless there is a strong reason to change them.

### Production areas

- `Overview`
- `Calendar`
- `Auditions`
- `Casting`
- `Settings`

### Auditions sub-areas

- `Settings`
- `Schedule`
- `Performers`
- `Check-In`
- `In The Room`

Do not casually reintroduce `Applicants` in user-facing audition flows when we mean `Performers`.

### Interaction Patterns

- When a user is choosing between audition rounds, audition days, audition sessions, or schedule-like options, prefer visible button-based selectors over dropdowns.
- Use the existing audition session picker style as the default pattern: clear clickable options, visible active state, and supporting date/context shown in the button itself.
- Do not hide important schedule choices inside selects if the user benefits from comparing the options at a glance.
- Dropdowns are acceptable only when the option list is too large for a clean visible layout.

### Production Visual Language

- Production-facing pages should use the shared subtle purple grid wallpaper as the default background texture.
- The production wallpaper uses `Grid-purple.png` as a repeated background at `4%` opacity.
- Treat this as a light ambient texture, not a featured graphic.
- Do not mix competing page-level wallpapers or glow effects when the shared production wallpaper is in use.
- If a production page needs a different texture for a very specific reason, it should be an intentional exception, not the default.

### Audition Colour System

- Audition UI should use one consistent colour system everywhere across production and public pages.
- `General Audition` uses `#7FAF8B`.
- `Dance Call` uses `#D68CB2`.
- `Callback` uses `#E3A46F`.
- `Other` audition types use `#B8AECF`.
- When a page styles audition cards, schedule buttons, session pickers, badges, footers, tabs, toggles, or note accents by audition type, those colours should be the shared source of truth.
- Do not reintroduce ad hoc purple accents for audition-type controls when a type colour should be shown instead.
- If an audition control is stateful inside a type-specific card, the active state should inherit from that audition type colour before using any generic purple.

### Audition Slot Line Pattern

- Whenever the UI shows a booked audition, audition date, or audition-session summary in a compact row, use the shared audition slot line pattern.
- The pattern is: glowing audition-type dot, audition type label, colon, then the date or booked slot details.
- Match the Clio performer popup booked-slot rows as the visual reference for spacing, bolding, and hierarchy.
- Keep the audition type label bold enough to scan quickly, and keep the detail text lighter but fully readable.
- Do not let this compact line clip text or collapse into cramped pills when there is horizontal room for a row.
- Reuse this pattern in reschedule pickers, performer summaries, and other compact audition-session rows unless there is a clear reason to use a fuller card.

## Shared Project Rules

These rules define how the calendar system should be understood across the codebase:

- `Zeus` is the production calendar.
- Production can add, change, and manage `Zeus` freely.
- `Zeus` is the production point of view and the source of truth for what is happening.
- `Cronus` is the organisation overview calendar.
- `Cronus` shows what all related calendars are doing, including kids and grandkids.
- `Cronus` is primarily for overview, not as the main place to make changes.
- `Apollo` is the public calendar.
- `Apollo` is view-only and cannot be changed.
- `Apollo` shows only the select items that Zeus allows the public to see.

## System Rules

These are non-negotiable platform rules for how the system should be shaped and extended.

### System Structure

1. The platform has three layers only: `Member`, `Organisation`, and `Production` inside `Organisation`.
2. Productions are not standalone.
3. Every page must belong to one of the supported layers.

### Navigation

1. Navigation must match context.
2. Member pages use member navigation.
3. Organisation pages use organisation navigation.
4. Production pages use the shared production navigation.
5. Production pages must not use custom sidebars.
6. Navigation is defined per system level, not per page.

### Pages

1. One page should do one job.
2. Do not build hidden page systems.
3. Do not use tab systems that pretend to be pages.
4. Do not use giant files with toggled sections as a substitute for page structure.
5. If something behaves like a section, it should be a real page.
6. Every page must answer who it is for, what the user does there, and what happens next.

### Data

1. Keep one source of truth.
2. Do not duplicate state.
3. Do not keep UI-only data copies.
4. Do not build parallel systems for the same concept.
5. Data must be owned by the correct domain: `Member`, `Organisation`, `Production`, or a specific production entity such as `Character`, `Role`, or `Audition`.
6. Do not leave data floating as `misc`.
7. If something changes, update it everywhere it is used.
8. Do not rely on manual syncing.
9. Do not allow stale views.

### Features

1. Do not build orphaned features.
2. Every feature must connect to the system.
3. Every feature must be reachable.
4. Every feature must affect something real.
5. Do not duplicate functionality.
6. If two things do the same job, merge or remove one.
7. Do not add "just in case" features.
8. Build what is needed now, cleanly.

### Domain Language

1. Use product language exactly.
2. Do not invent dev-only terminology when product language already exists.
3. If the UI says `Casting Card`, the code should reflect `Casting Card`.
4. Keep system language consistent across UI, code, database, and logic.

### Business Logic

1. Do not hide business rules in UI code.
2. Do not hide business rules inside click handlers, random conditionals, or page scripts.
3. Business logic must be named clearly.
4. Business logic must be centralised.
5. Business logic must be reusable.
6. If a rule matters, it must be visible in the system design.

### UX

1. Reduce chaos at all times.
2. If something adds confusion, it is wrong.
3. First-time users should see one clear next step.
4. Do not overwhelm screens.
5. Show only what matters right now.
6. Important options should be visible before they are chosen whenever space allows.
7. If users need to compare time-based or round-based choices, the choices should be scanable, not hidden.

### Errors and Feedback

1. Do not show technical errors to users.
2. Do not show stack traces.
3. Do not show raw errors.
4. Do not show vague error messages.
5. Every error message must explain what happened, what to do next, and whether the user’s work is safe.

### Code Quality

1. Code must be easy to understand.
2. If code takes effort to read, rewrite it.
3. Functions must do one thing only.
4. Names must be clear and specific.
5. Do not use vague variables.
6. Do not duplicate logic, structure, or data.

### Architecture

1. Structure matters more than shortcuts.
2. Do not hack around the system structure to save time.
3. Everything must connect.
4. Do not leave dead ends in UI, data, or flows.
5. If a feature cannot be placed cleanly in the system, redesign it.
6. Wherever possible, build designs as cross-file shared component systems rather than one-off implementations.
7. Core UI patterns like audition banners, live states, and calendar formats should be created once and reused across files.
8. Shared component systems must favour consistency, maintainability, and easy extension over isolated custom work.

### Development Approach

1. Build in small, complete pieces.
2. Do not ship half-features.
3. Test real behaviour, especially bookings, casting logic, scheduling, and permissions.
4. Refactor continuously.
5. Do not let mess build up.

### Final Filter

If a change does not make the system clearer, more connected, or easier to use, do not build it.

## Core Coding Principles

These rules extend the existing Build The Show standards and are non-negotiable.

### Readability Standard

1. Code must be easy to understand on first pass.
2. A new developer should be able to understand a function quickly without reverse-engineering it.
3. If code requires repeated rereading to understand, rewrite it.

### Control Flow

1. Avoid deep nesting.
2. Prefer early returns over nested conditionals.
3. Do not stack complex boolean logic inline.
4. A reader should not need to track many branches in their head.

### Variables

1. Variables must exist for the shortest scope possible.
2. Prefer constants and write-once values when possible.
3. Do not reuse variables for different meanings.
4. Remove variables that do not improve clarity.

### Clarity

1. Do not require mental translation between concepts.
2. Avoid abbreviations unless universally understood.
3. Code should reflect domain language, not implementation shortcuts.

### Abstraction

1. A function must operate at one level of abstraction only.
2. Do not mix high-level intent with low-level implementation.
3. If a function reads like multiple layers, split it.

### Understanding Rule

1. Do not write or modify code you do not fully understand.
2. Do not rely on "it works" as validation.
3. If behaviour is unclear, trace it before changing it.

### Testing

1. Critical flows must be testable, especially booking, casting, scheduling, and permissions.
2. Tests must be readable and reflect domain language.
3. Every bug must result in a test before or alongside the fix.
4. Do not rely on manual testing for core workflows.

### Cleanliness

1. Leave the code cleaner than you found it.
2. Do not leave temporary fixes in place.
3. If something is confusing, fix it immediately or log it clearly.

### Reversibility

1. Avoid decisions that lock the system into a single path.
2. Prefer flexible structures over rigid assumptions.
3. Workflows must be changeable without rewriting core systems.

### Abstraction Barrier

1. Do not expose internal data structures across layers.
2. UI must not depend directly on database shape.
3. Business logic must not depend on UI structure.
4. Changes inside a layer must not break other layers.

### Developer Errors

1. Silent failures are not allowed in development.
2. Invalid states must throw clear, explicit errors.
3. Do not suppress errors to keep the system running.

### Examples

1. Provide canonical examples of good and bad naming where possible.
2. Provide canonical examples of good and bad functions where possible.
3. Provide canonical examples of correct and incorrect patterns where possible.
4. Developers follow examples more reliably than rules.

## Structure and Abstraction Rules

These rules cover structure, coupling, and composition without repeating the core readability rules.

### One Level of Abstraction

1. A function must operate at one level of abstraction only.
2. Do not mix high-level intent with low-level implementation in the same function.
3. Code should read top-to-bottom as a sequence of steps at the same level.

### Organise Code Into Logical Sections

1. Group related logic into clear sections.
2. Separate different concepts with spacing and structure.
3. Each block of code should represent one coherent idea.

### Keep Interfaces Simple

1. Functions and modules must have simple, clear interfaces.
2. A reader should understand how to use something without knowing how it works.
3. Do not expose unnecessary inputs, outputs, or internal details.

### Reduce Coupling

1. Minimise dependencies between parts of the system.
2. Avoid tightly linking unrelated components.
3. Each unit should be as independent as possible.

### Avoid Unnecessary Code

1. Do not implement features that are not needed.
2. Remove unused or dead code.
3. Keep the codebase as small and focused as possible.

### Organise for Readability

1. Code layout should make relationships obvious.
2. Use consistent ordering of elements.
3. Similar concepts should be structured the same way across the codebase.

### Build With Abstractions

1. Treat functions and modules as black boxes.
2. Focus on what something does, not how it does it.
3. Build systems from composable parts that can be combined cleanly.

## Platform Voice

These rules define the platform voice for all user-facing copy, labels, help text, and system language.

### Core Voice

1. Speak like a real person who has actually run a show.
2. Be clear, direct, practical, and grounded in real experience.
3. Allow a little fun, but never sound corporate or generic.
4. If it sounds like software, it is wrong.
5. If it sounds like someone backstage, it is usually right.

### The Fun Rule

1. Personality is allowed.
2. Fun should feel natural, not forced.
3. Sound like someone backstage, not a marketing team.
4. Never let personality get in the way of clarity.
5. When the user is stressed, clarity wins over personality.

### How It Should Feel

1. Say what something does, not what it enables.
2. Be clear over being clever.
3. Be helpful without over-explaining.
4. Sound like you are talking to another producer.
5. Reduce stress instead of adding to it.

### What To Avoid

1. Avoid corporate language.
2. Avoid buzzwords.
3. Avoid filler phrases.
4. Avoid vague system language.
5. Do not use SaaS homepage language.

### Product Language

1. The words in the UI are the system language.
2. Code, UI, database, and logic must use the same terms.
3. Do not invent alternate labels.
4. Do not rename things casually.
5. If we say `Casting Card`, it is always `Casting Card`.

### Keep It Simple

1. Use the fewest words needed to be clear.
2. Prefer short sentences.
3. Do not stack multiple ideas into one line.
4. If a sentence needs to be read twice, rewrite it.

### Be Honest and Specific

1. Say exactly what will happen.
2. Do not soften or hide behaviour.
3. Do not be vague to sound nice.

### Match The Moment

1. Match tone to the task.
2. Setup should be supportive and clear.
3. Actions should be direct and quick.
4. Errors should be calm and helpful.
5. Success should be simple, with only a touch of personality.

### Respect The User

1. Do not talk down to the user.
2. Do not over-explain basic things.
3. Do not assume confusion when clarity will do.

### If You Are Not Sure

1. Ask whether a backstage person would actually say it.
2. Ask whether it sounds human or like software.
3. Ask whether it is clear on first read.
4. Ask whether the fun is helping or getting in the way.
5. If it is not obvious, rewrite it.

## Visual Design Rules

These rules cover hierarchy, spacing, labels, and how interface elements should compete for attention.

### Hierarchy

1. Not all elements are equal.
2. Use size, weight, spacing, and contrast to show importance.
3. Separate visual hierarchy from document hierarchy when needed.
4. Emphasise by de-emphasising surrounding content.

### Spacing

1. Start with more space than you think you need.
2. Remove space deliberately instead of adding it randomly.
3. Establish a spacing and sizing system and use it consistently.
4. Do not fill the whole screen just because you can.
5. Use dense layouts only when density helps the task.

### Labels and Values

1. Labels are a last resort when the value can already stand on its own.
2. Keep labels secondary when the value is the main thing.
3. Combine labels and values only when that improves clarity.
4. Use a label only when the meaning would otherwise be unclear.

### Contrast and Weight

1. Balance weight and contrast instead of using both at full strength.
2. Use contrast to compensate for lighter weight when needed.
3. Use weight to compensate for weaker contrast when needed.
4. Do not use grey text on coloured backgrounds when clarity matters.

### Semantic Priority

1. Semantics are secondary to clarity in the interface.
2. Use the clearest visual treatment first.
3. Destructive actions should be unmistakable.

## Data Display Rules

These rules cover charts, metrics, timelines, comparisons, and any display of quantitative information.

### Show the Data Clearly

1. Make the data easy to compare.
2. Put the important numbers where the eye can find them quickly.
3. Label what matters and remove what does not.
4. Do not let decoration compete with the data.

### Prefer High-Value Visuals

1. Use visual encodings that improve understanding.
2. Use position, length, and alignment before more decorative encodings.
3. Choose charts and diagrams that fit the question being asked.
4. Do not use a chart type just because it looks familiar.

### Reduce Chart Junk

1. Remove anything that does not help the user read the information.
2. Avoid unnecessary lines, fills, effects, and repeats.
3. Keep labels, axes, and annotations only when they add clarity.

### Preserve Integrity

1. Do not distort scale or proportion.
2. Do not make visual choices that mislead the user.
3. Keep comparisons fair and honest.
4. If the data is uncertain, show the uncertainty clearly.

### Support Comparison

1. Make changes, differences, and trends easy to see.
2. Use small multiples when comparisons across similar views matter.
3. Align related values so the user does not have to mentally calculate them.
4. Group related data so the structure is obvious.

### Data Density

1. Use density when it improves the task.
2. Do not waste space on empty visual gestures.
3. Dense displays should still be readable at a glance.

## Typography Rules

These rules cover how type should support clarity, hierarchy, and reading comfort.

### Readability First

1. Typography must support reading before style.
2. Use type choices that stay clear at the sizes the user actually sees.
3. Avoid type treatments that weaken legibility.

### Establish Hierarchy

1. Use size, weight, spacing, and contrast to show importance.
2. Make headings, labels, body text, and metadata feel intentionally different.
3. Use hierarchy to guide scanning, not to decorate the page.

### Keep Spacing Intentional

1. Use consistent spacing between related and unrelated text.
2. Let the text breathe.
3. Keep line length and line spacing comfortable for the reading task.

### Use Alignment and Rhythm

1. Align text purposefully.
2. Keep repeated typographic patterns consistent.
3. Use a clear rhythm so the page feels organised.

### Handle Emphasis Carefully

1. Emphasis should be used sparingly.
2. Do not overuse bold, colour, or all caps.
3. Reserve strong emphasis for real priority.

### Use Type to Support the Content

1. Choose type treatments that match the tone and task.
2. Make typographic structure reflect the meaning of the content.
3. Keep decorative typography secondary to clarity.

### Casting Terms

- `Casting Board`
- `Callbacks`
- `Cast List`
- `Casting Card`
- `Requested Roles`
- `Role Gender Preferences`
- `Casting Preference`
- `Other Roles`

Avoid mixing these with older labels like:
- `Gender of Roles`
- `Role Interest`
- `Gender Preference`

Those older labels may still exist as fallback keys in saved data, but user-facing code should prefer the canonical names above.

## Source of Truth

### Performer record

For production casting flows, `audition_applications` is the canonical performer record.

That record should be the main source for:
- performer info
- audition info
- custom answers
- producer edits
- casting card rendering

`audition_bookings` supports booking logistics and slot tracking.
It may be used for backfill or migration, but should not become a competing truth source.

### Slot system

The modern audition slot source is `audition_time_slots`.

If a screen needs live audition slot data, prefer:
- `slot_id`
- `slot_date`
- `slot_time`

Only use older slot tables as fallback support, not as the primary label source.

### The Fates schedule

Production > Auditions > Schedule is the canonical audition schedule surface.

All audition session, date, time, slot, and booking edits should write to the shared audition schedule tables first:
- `audition_sessions`
- `audition_time_slots`
- `audition_bookings`

Other audition views may mirror or display that state, but they should not become competing schedule sources.
`production_events` may mirror the schedule for the broader production calendar, but it is not the source of truth for audition booking state.

## Naming

1. Prefer full names over vague abbreviations.
2. Name variables after domain meaning, not implementation detail.
3. A helper name should describe what it returns.
4. A function that mutates state should sound imperative.
5. A function that reads or formats state should sound descriptive.

### Good examples

- `applicantRequestedRoleList`
- `applicantRolePreferenceValue`
- `applicantSlotLabel`
- `mergeApplicantBookingData`
- `persistApplicantPatch`

### Avoid

- `data2`
- `tmp`
- `thing`
- `obj`
- `misc`
- `handleStuff`

## Functions

1. Keep functions focused on one job.
2. Split UI rendering from data shaping when possible.
3. Prefer small helper functions for repeated domain formatting.
4. Avoid giant mixed functions that both fetch, normalize, render, and patch state unless there is a clear reason.
5. If a function needs fallback behavior, isolate that fallback instead of scattering it across multiple branches.

## Conditional and Fallback Rules

1. Fallbacks are allowed when needed for schema drift or older saved data.
2. Fallbacks must be obvious and deliberate.
3. Fallbacks should point toward a canonical field, not create a second permanent path.
4. If a fallback exists, keep the canonical field first in the lookup order.

Example pattern:

```js
const value =
  canonicalValue ||
  customAnswers['Canonical Label'] ||
  legacyValue ||
  null;
```

## UI

1. The same concept should have the same label on:
- public audition page
- production workspace
- performer godsheet
- performer modal
- casting board

2. Use fewer, clearer sections instead of many weakly differentiated ones.
3. Reduce duplicate navigation where one navigation system is enough.
4. Prefer calm interfaces over noisy ones.
5. Use visual emphasis only for truly important states.

## Canadian English

1. User-facing copy should default to Canadian English.
2. Prefer Canadian spelling in labels, help text, and messages:
- `organisation`
- `colour`
- `centre`
- `favourite`
- `cheque-in` should still remain `Check-In` because it is the product's established workflow label
3. Prefer `en-CA` for user-facing date formatting unless a different locale is required for a very specific reason.
4. Do not rename stable database tables, API fields, or other technical identifiers solely for spelling.
5. If a legacy or technical field uses `organization`, the UI may still show `organisation`.

## Editing and Persistence

1. Autosave is preferred for living records when the user is already in an edit surface.
2. Save state feedback should be calm and truthful:
- `Saving...`
- `Saved`
- clear error only when there is a real failure

3. Saving should not depend on unrelated mirror writes succeeding.
4. Canonical record writes should succeed even if a secondary sync path fails.

## Data Shaping

When building a performer object for UI use, normalize once and use the normalized object downstream.

Normalized performer shape should aim to include:
- `name`
- `preferred_name`
- `pronouns`
- `date_of_birth`
- `age`
- `session_id`
- `slot_id`
- `requested_roles`
- `role_preference`
- `gender_preference`
- `custom_answers`
- `headshot_url`
- `guardian_name`
- `guardian_contact`
- `contact_name`
- `email`
- `phone`
- `status`

## Comments

Comments should explain:
- why a non-obvious rule exists
- why a fallback is necessary
- why a certain ordering matters

Comments should not narrate obvious code line by line.

## Refactor Priorities

When cleaning code in this repo, prioritize:

1. domain language consistency
2. source-of-truth consistency
3. small reusable helpers
4. removing duplicate UI wording
5. reducing schema drift damage
6. visual clarity

## Practical Rule for Future Changes

Before adding a field, label, or helper, ask:

1. Do we already have a canonical name for this?
2. Is this the real source of truth, or a fallback?
3. Will this wording match the public page, workspace, and modal?
4. Can this logic live in one helper instead of three places?
5. If the user edits it in the godsheet, will everything downstream follow it?

If the answer to those is not clear, clean that up before adding more layers.
