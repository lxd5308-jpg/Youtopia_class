# Design Principles (Living Document)

This file is updated automatically whenever a correction or improvement is made to the app. Each entry captures the underlying rule so it applies consistently to all similar features — not just the one that was fixed.

---

## How this works

When the user requests a fix or correction, extract the general principle behind it and add it here. Before implementing any UI or code change, check this file and apply any relevant principles proactively.

---

## UI & Layout

- **Inline form controls stay on one row.** Input fields (minutes, teacher name, date, etc.) and their labels must sit on the same flex row. Use `flexWrap: 'wrap'` so they reflow on narrow screens rather than overflow — but do not force items to their own line. Give each input a fixed `width` (e.g. `80px`, `120px`, `140px`) so they fit compactly side by side.

- **Labels for inputs use secondary text style.** Inline labels next to inputs (e.g. "min", "Class date") use `fontSize: 'var(--fs-xs)'` and `color: 'var(--color-text-secondary)'`. Never leave an input without a visible label or placeholder that clearly tells the user what it is.

- **Flex containers with mixed inline elements need a text wrapper.** When a `display: flex` container holds both an icon and text that contains `<strong>` or other inline elements, wrap the text in a `<span>` so the flex layout treats it as a single child. Without this, each inline element becomes its own flex item and the message fragments.

---

## Security

- **Firestore rules are the only real access control — client checks are decoration.** `verifyTeacherAccess`, role flags and hidden UI all run in the user's browser and can be bypassed by talking to Firestore directly (the API key and project ID ship in the public bundle). Any rule of the form `allow read, write: if request.auth != null` means "every signed-in account owns the whole database". Rules live in [firestore.rules](../firestore.rules) and deploy with `firebase deploy --only firestore:rules` — no Blaze plan needed.

- **Never let the client write the document that grants permissions.** `settings/private.teacherEmails` decides who is a teacher, so it is teacher read/write only, and the rules keep a hard-coded root teacher list so a bad write can never lock everyone out. Any "who is an admin" data must be unwritable by the people it would promote.

- **A `match /{document=**}` catch-all silently defeats every specific rule above it.** Rules are permissive-OR: if any match grants access, access is granted. Enumerate collections explicitly and let unlisted paths fall through to denied.

- **Never subscribe a client to a collection it only needs one row of.** Students used to load every payment, receipt and leave request and filter in the browser — everyone's data, in everyone's browser. Scope the query (`where('studentEmail','==',email)`) so the server sends only what that user may see; the rules then enforce the same boundary.

- **Verify rules before deploying them.** The Rules API evaluates a test suite server-side without deploying (`POST firebaserules.googleapis.com/v1/projects/<id>:test`), which works without Java or the emulator — see [tests/rules-test.mjs](../tests/rules-test.mjs). Two traps: it has **no database access**, so `get()`/`exists()` must be supplied via `functionMocks` or they fail as "Function not found" and look like a deny; and it URL-decodes paths once, so a document ID containing a literal `%40` must be written `%2540`.

- **Secrets need their own document, not their own field.** Firestore rules grant per-document, so a field that must stay hidden cannot live beside data everyone reads. `settings/main` holds only the class list and semester (student-readable); `teacherEmails`, `emailConfig` and the summary schedule live in `settings/private` (teacher-only).

- **Check what the code actually does before hardening it.** The "students shouldn't approve their own make-ups" rule would have broken the feature: `requestMakeup` sets `status:'approved'` on purpose. The guard that was actually needed protects the teacher's *decision* (`makeup.resolvedAt`), not the initial request.

- **`payments/{id}` is student-create, teacher-only update/delete.** A student can create a new payment doc (`willOwn()`) but can never update or delete an existing one, even one of their own. Any student-triggered flow that writes a payment record (fees, purchases) must mint a fresh doc ID every time (`` `type_${id}_${Date.now()}` ``) — reusing a deterministic ID and relying on `merge:true` works for the first write and then throws `permission-denied` on the second.

---

## State & Backend

- **Never record success state unless something actually succeeded.** Fields like `summaryLastSent` are written only when at least one send returned OK. Writing them unconditionally turns a total failure into a UI that reports success and suppresses the retry — the worst kind of bug, because nobody notices it. Guard every "last done at" write with the result of the operation, and log loudly on total failure.

- **Every setting the backend reads must have a UI that writes it.** `emailConfig` was read by both the app and the Cloud Function but no screen ever saved it, so the feature could only ever fail. When adding a Firestore field a server or scheduled job depends on, add the setter and the form control in the same change.

- **Server-side code is not shipped by the frontend deploy.** `npm run build` + Cloudflare only publishes [src/](../src/). Anything in [functions/](../functions/) needs a separate `firebase deploy --only functions` (Blaze plan required). A committed Cloud Function is not a running Cloud Function — verify with `firebase functions:list`.

- **Silent zeros are the dangerous failure.** The weekly summary reported "none this week" twice while the data was fine — once when a date format gained " at " and every record failed to parse, once when the collection it reads was never written to. An empty section is indistinguishable from a quiet week, so the Cloud Function now runs data checks (unparseable dates, empty-but-expected collections) and appends a DATA CHECKS block to the email only when something is wrong. When a reader can legitimately return nothing, make "nothing" and "broken" look different.

- **When you change what the app writes, find every reader.** Both summary bugs came from a change whose downstream consumers were missed: a new date format, and auto-enrolment that stopped writing `enrollments` — which the Roster, the Dashboard student count and Messages recipient filtering also read. Grep for the collection or field name before shipping a format or flow change.

- **Fee and deposit line items are not classes.** "Registration Fee" and "Team 2 Deposit" live in the same class list but have empty `days`/`time`/`duration` and `sessions: 1`. Anything that treats the class list as enrolments (Roster, enrollment records) must filter them out with `days || time`.

- **Never compare a stored `classId` to `classes[].id` with a bare `===`.** `classId` reaches Firestore through several paths — some from `cls.id` (already a number), some from a raw `<select>` value (a string) — so a strict `===` can silently fail to match and any field that only exists on the matched class (`days`, `time`, `fee`, `instructor`, …) quietly renders blank, while fields stored directly on the record (like `className`) keep showing fine and mask the bug. Compare with `String(c.id) === String(otherId)`, or explicitly `Number(...)` the value at the point it leaves a `<select>` — both patterns are already used elsewhere in the app (`Messages.jsx`, `App.jsx`'s `sendTeacherMessage`); apply the same guard anywhere a `classId` field gets looked up against the class list, including `Set.has()` checks.

- **A `payments/{id}` item without a `classId` is a charge only, not an enrollment.** `enrollStudent()` (called on payment confirm) treats any item with `pkgType !== '10pack' && classId` as a class to enroll in. A fee that must never grant enrollment (e.g. a makeup-class fee) has to omit `classId` entirely — setting it to a real class id, even "just for reference," will silently enroll the student when the teacher confirms the payment.

- **Deleting a class does not cascade to `enrollments`.** `Configuration.jsx`'s `deleteClass` just filters the class out of `classes` — any student still enrolled in it keeps a `classId` that no longer resolves to anything, permanently losing that class's day/time/instructor/category/fee everywhere those get looked up live (Roster, CSV export). `enrollments` docs now snapshot `days`/`time`/`instructor`/`category`/`fee` at write time (in `addClassToCart`, `enrollStudent`, `switchStudentClass` in App.jsx) precisely so a later edit or deletion of the class can't blank out historical data — the live class lookup is only a fallback for records written before the snapshot existed. `deleteClass` also now warns with the affected student count before deleting. Any new path that writes an `enrollments` doc must include the same snapshot fields, and any new place that mutates or removes an entry from `classes` should consider whether it needs the same enrollment-count warning.

- **Money math belongs in the `App.jsx` action function, not the page component.** Page components may show a live preview to the student, but the value actually written and charged must be recomputed from trusted server-side data (`td.classes`) inside the App.jsx function that performs the write — never accepted as a field on the data the client passed in. This is what lets a fee formula stay correct even if the UI preview has a bug or the client is tampered with.

---

## Cross-platform

- **All UI must work on mobile and desktop.** Every layout change must be reasoned through at both ≥ 320px mobile width and full desktop width before being marked complete. See the Cross-platform requirement in CLAUDE.md.

---

## Auth & Login

- **Use `signInWithPopup` everywhere — do not switch mobile to `signInWithRedirect`.** The app is served from Cloudflare while `authDomain` is `youtopia-3e141.firebaseapp.com`. Since firebase-js-sdk v9.15, `signInWithRedirect` needs cross-origin storage access to the auth domain, which iOS Safari blocks by default — the user completes Google sign-in and returns *not signed in*. Redirect only becomes an option if `/__/auth/*` is reverse-proxied onto the app's own domain and `authDomain` is repointed at it.

- **Any flow that leaves the app must be able to recover when the user comes back.** On mobile `signInWithPopup` opens a real tab; if the user abandons it the promise never settles and the button stays disabled on "Signing in…" forever. Never leave a spinner as the only state — listen for `visibilitychange`/`focus` and reset with a retry message. Assume users will refresh, hit back, and abandon tabs; design for that rather than instructing them not to.

- **Never trust a role or permission read back from `localStorage`.** `pendingLoginRole` survives the mobile post-login reload, but it is user-editable. Any code path that restores a session must re-run the teacher allow-list check (`verifyTeacherAccess`) before granting the teacher role — the check in `LoginPage` does not protect paths that bypass it.

- **Run the teacher allow-list check before any early return in the login flow.** When adding a branch to `handleGoogleLogin`, place it either before sign-in entirely (e.g. the in-app-browser overlay) or after the teacher check. A branch that returns between sign-in and the check silently grants teacher access.

- **WeChat in-app browser cannot do Google OAuth at all.** Detect `MicroMessenger` in the user agent and show a clear "Open in Browser" instruction instead of a broken sign-in attempt. Disable the sign-in button in that context.

---

*Add new entries here whenever a correction reveals a general principle. Keep entries short and actionable.*
