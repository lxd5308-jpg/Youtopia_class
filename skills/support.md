# Support

What to do when a live user reports a problem. The app has 10+ real users and
no error tracking — **a user's report is the only signal we get**, so treat
every report as the tip of something larger.

---

## 1. Intake — ask for these five things

Most reports arrive as "it doesn't work". Before touching code, get:

1. **Who** — email address and role (teacher or student). Behavior is
   role-specific; the same page differs between `src/pages/teacher/*` and
   `src/pages/student/*`.
2. **When** — date and rough time, so it can be matched against a deploy or a
   `weeklyTeacherSummary` run.
3. **Where** — which page or button.
4. **Expected vs. actual** — what they thought would happen, what happened.
5. **Device** — phone or computer, which browser. Layout and touch bugs only
   show on one of them.

A screenshot covers 2–5 at once. Ask for one.

## 2. Triage — fix now or batch it

| Severity | Examples | Response |
| --- | --- | --- |
| **Critical** | Data loss or wrong data, can't log in, payment/package hours wrong, class schedule wrong before a class | Fix and ship the same day |
| **Blocking** | A whole flow unusable (enrollment, leave request, attendance export) | Fix next |
| **Cosmetic** | Layout, wording, spacing | Batch with the next change |

Anything touching student data, money, or hours counts as Critical even if only
one user noticed. Check whether other records were hit the same way — a bad
write usually is not a single row.

## 3. Diagnose

- **Reproduce first.** `npm run dev`, sign in as the same role, follow their
  steps. If it only happens on mobile, use the browser's device emulation, then
  a real phone.
- **Permission errors** (`permission-denied`, data that silently never loads)
  point at `firestore.rules`. Verify with
  `node tests/rules-test.mjs firestore.rules` — server-side, no deploy needed.
- **Missing or wrong emails** point at `functions/index.js`. Read the logs:
  `firebase functions:log --only weeklyTeacherSummary`.
- **"My data is gone."** Check what the database actually holds before assuming
  a UI bug — the latest dump in `backups/` shows the state at backup time.
- **Started after a deploy?** `git log` since the last known-good build, and
  compare against the Cloudflare deployment history.

## 4. Fix

Follow [Review & Modification](review-and-modification.md) and
[Design Principles](design-principles.md). Two rules specific to support work:

- **Fix the class, not the instance.** If one page mishandles this, grep for the
  same pattern in the sibling teacher/student pages and fix them all.
- **Write the test case.** Add the report to `tests/test-cases.md` as a new TC
  before shipping, phrased as the requirement it violated. That is what stops
  the same bug coming back.

## 5. Ship

1. `npm run build` — the only automated check this project has. It must pass.
2. Walk the new test case plus the surrounding flow in `dist/`.
3. Deploy the app (Cloudflare — ships `src/` only).
4. **If `functions/` or `firestore.rules` changed, deploy them separately**:
   `firebase deploy --only functions` / `--only firestore:rules`. The Cloudflare
   deploy does not carry them.

## 6. Roll back

Faster than a forward fix when a deploy broke something live:

- **Frontend** — roll back to the previous deployment in the Cloudflare Pages
  dashboard. Then `git revert` the commit so the repo matches what is live.
- **Rules / functions** — `git revert`, then redeploy that piece with the
  `firebase deploy --only …` command above.
- **Data** — restore from the newest file in `backups/`, or use Firestore PITR
  in the Google console. Take a fresh backup *before* restoring anything, so the
  broken state is still recoverable.

## 7. Close the loop

Tell the reporter it is fixed and what they need to do — usually a hard refresh,
since a cached bundle keeps serving the old app. Ask them to confirm. A report
is not closed until the person who filed it says it works.

---

## Known gap

There is no client-side error reporting and no error boundary: when a Firestore
write fails, the user typically sees nothing at all and assumes it saved. Until
that changes, silent failures are invisible to us and under-reported. Worth
adding an error boundary plus visible save-failure toasts — a separate change,
tested on its own.
