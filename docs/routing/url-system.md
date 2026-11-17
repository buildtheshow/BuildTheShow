# Website addresses

One canonical address describes each destination. Physical folders are implementation details, never the destination shown to visitors.

| Area | Address |
|---|---|
| My Home | `/member/home` |
| My Activities | `/member/activities` |
| My Profiles | `/member/profiles` |
| Person | `/member/profiles/{profile-id}` |
| Edit person | `/member/profiles/{profile-id}/edit` |
| Add person | `/member/profiles/new` |
| Households | `/member/households` |
| Calendar | `/member/calendar` |
| Settings | `/member/settings` |
| Organisation chooser | `/org` |
| Organisation management | `/org/{abbreviation}` |
| Organisation settings | `/org/{abbreviation}/settings` |
| Organisation productions | `/org/{abbreviation}/productions` |
| Production management | `/org/{abbreviation}/productions/{show}` |
| New production | `/org/{abbreviation}/productions/new` |
| Standalone production tool | `/org/{abbreviation}/productions/{show}/tools/{tool}?id={production-id}` |
| Public organisation | `/{abbreviation}` |
| Public show | `/{abbreviation}/{show}` |
| Auditions | `/{abbreviation}/{show}/auditions` |
| Volunteering | `/{abbreviation}/{show}/volunteer` |

`organizations.slug` is the unique, saved web abbreviation, distinct from the display abbreviation. Setup suggests the display abbreviation first and checks availability. Existing saved slugs are retained; no organisation is silently renamed. The full organisation name still appears on pages. Routes without a selected organisation or readable show slug use the existing ID-based entry, then resolve the authorised context. Missing slugs are not guessed from titles.

## How requests work

`functions/_middleware.js` is the common route boundary. It serves page files through the Pages ASSETS binding and follows HTML filename normalisation internally, preventing internal folder names from escaping into the address bar. Cloudflare documents the [Pages HTML normalisation behaviour](https://developers.cloudflare.com/pages/configuration/serving-pages/) and [Functions redirect precedence](https://developers.cloudflare.com/pages/configuration/redirects/).

The same boundary forwards old `/home`, `/activities`, `/member`, direct source-page addresses (both `.html` and extensionless), and `/{abbreviation}/ORG/Productions/{show}` links. Existing query parameters and opaque invitation codes retain their exact case. Redirects remain temporary/no-store during the migration. POST submission endpoints pass to their existing handlers. Static scripts, images and shared components bypass the routing function.

Existing standalone tool screens retain their original markup and data handling. Their links retain the production ID query parameter because those screens load that exact record; URLs alone never confer access. Explicit tool registries prevent arbitrary file-path lookup.

## Permissions and context

Member profiles keep opaque IDs rather than children's names in addresses. Organisation dashboard selection uses accepted owner/admin memberships and an exact saved slug, not an arbitrary first organisation. New-production setup uses that same explicit context; an old draft from another organisation cannot be resumed there. Production and public-page data remain subject to the existing database policies. Reserved website words are checked by the existing server-side organisation slug validator and unique slug index.

## Verification

`tests/account-security/url-system.test.cjs` checks canonical pages, internal HTML redirects, legacy bookmarks, query/case preservation, reserved roots and POST passthrough. `unified-browser.cjs` runs navigation through the actual middleware with synthetic Auth/database responses, including owner/member separation, profile names, invitations, shifts and mobile widths. `profile-type-browser.cjs` checks type-change confirmations and destinations.

Live checks must verify final browser-visible paths and response content after deployment. These routing checks do not certify that the separate authenticated account-data loading issue is resolved.

The final inventory also covers root landing pages, legacy account entry pages, About, proposal submissions and both self-tape submission screens. Public and account HTML source filenames have compatibility redirects. Email generators were checked against downloaded live source before deploying URL-only changes, preserving their existing JWT and internal authorization settings. No email was sent as part of verification.
