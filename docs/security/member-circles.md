# Member profiles and circles

Member-facing language is My Profile, My Circle, Create a circle, Join a circle, Add a member and Invite an admin. Owner is the original circle creator; Admin is an adult who accepted a circle invitation; Member is a participant profile. Adults keep their own logins. A circle is optional and is never inferred from a surname, address, signup hint or profile count.

The underlying household tables and existing family API remain for compatibility. `public.bts_circle` wraps them, adds circle role labels, includes a verified existing self profile on explicit creation, and performs member creation/attachment in one transaction. `/member/circles` is canonical; old household links forward with their query parameters and invitation fragments retained.

Admin invitations record selected profile IDs on the existing private invitation row. Only the circle owner can send one, only for attached profiles whose sharing they control. Another adult shares their own profile. A single email and invitation preview list the exact members. Accepting requires the invited adult email, a live one-use token and explicit confirmation. Child access also requires the recipient’s name and parental/legal-guardian declaration. Existing self keys remain self keys; no owner role is granted. New members are never automatically shared with existing admins. Adult volunteer signup help is a separate opt-in.

Joining a circle does not merge accounts or profiles. Leaving a circle removes group membership; independently granted profile/guardian rights remain until their own revocation or reviewed removal. The UI explains this and exposes the existing member access controls. Circle ownership transfer and guardian removal continue to require protected review.

The main member menu is My Home, My Activities, My Profile and Settings, with My Circle added after actual circle membership exists. Performer/Creative Team/Volunteer tools sit inside My Activities. Organisation controls are outside this member menu. Home offers Create a circle and Join a circle until there is a real circle. Signup’s existing household hint now displays Circle and only opens explicit setup; it does not create a group.

Verification: `circle-run.cjs` checks actual SQL scope, recipient binding, replay/outsider/admin denial, independent guardians and explicit adult volunteer consent. `circle-browser.cjs` checks individual/circle states, create/add/invite/join flows, scope preview, invalid external invitation links and phone/tablet/desktop layouts. Existing account, consent, payment-tracker, signup and booking-picker checks remain in place. All fixtures use synthetic data and no live emails.

Create a circle uses the approved dedicated form at `/member/circles?action=create`: name, verified own-profile preview and Owner role. Only a successful server response replaces the form with confirmation. The success actions use the created circle ID; adding a member refreshes ownership before selecting the circle. A failed post-creation refresh cannot reopen the submitted form. Cancel returns to My Circle without writing.

Member navigation uses the existing named icon assets. Calendar is a tab inside My Activities and uses `navproductioncalendar.svg`; existing calendar bookmarks still lead there. Both views use the same account activity response.
