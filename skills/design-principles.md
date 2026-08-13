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

---

## State & Backend

- **Never record success state unless something actually succeeded.** Fields like `summaryLastSent` are written only when at least one send returned OK. Writing them unconditionally turns a total failure into a UI that reports success and suppresses the retry — the worst kind of bug, because nobody notices it. Guard every "last done at" write with the result of the operation, and log loudly on total failure.

- **Every setting the backend reads must have a UI that writes it.** `emailConfig` was read by both the app and the Cloud Function but no screen ever saved it, so the feature could only ever fail. When adding a Firestore field a server or scheduled job depends on, add the setter and the form control in the same change.

- **Server-side code is not shipped by the frontend deploy.** `npm run build` + Cloudflare only publishes [src/](../src/). Anything in [functions/](../functions/) needs a separate `firebase deploy --only functions` (Blaze plan required). A committed Cloud Function is not a running Cloud Function — verify with `firebase functions:list`.

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
