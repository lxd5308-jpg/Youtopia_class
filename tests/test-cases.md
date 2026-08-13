# Test Cases

Run `npm run build` first. All cases below are manual UI tests.
Mark each ✅ pass / ❌ fail before deploying to Cloudflare.

---

## TC-01 · 10-hour pack: log hours cap

**Requirement:** If logging the selected minutes would exceed the remaining hours in a pack, show a warning and cap the logged amount to the remaining hours. Do not allow logging beyond 10 hrs total.

**Steps:**
1. Log in as a student with an active 10-hour pack that has < 10 hrs remaining (e.g. 9.5 hrs used).
2. On Dashboard → active pack, set the minutes input to 60 (1 hr).
3. Observe the Log button and the area above it.

**Expected:**
- A yellow warning banner appears stating only X hrs remain.
- The Log button turns orange and reads "Log X hrs only" (not "Log 1 hr").
- Clicking the button logs only the remaining hours, not the full requested amount.
- After logging, the pack shows 10/10 hrs used and the pack disappears from active packs.

---

## TC-02 · 10-hour pack: edit session date

**Requirement:** After logging a session, the student can correct the date if the wrong date was entered.

**Steps:**
1. Log in as a student with at least one logged session in an active pack.
2. On Dashboard → pack history, locate a logged entry.
3. Click the pencil icon on the right of the entry.
4. Change the date using the date picker and click Save.

**Expected:**
- The entry updates immediately to show the new date.
- Cancelling returns the entry to its original date without changes.
- The date picker does not allow future dates.
- The change persists after a page reload.

---

## TC-03 · 10-hour pack: edit session teacher

**Requirement:** After logging a session, the student can add or correct the teacher name (e.g. if it was accidentally left blank).

**Steps:**
1. Log in as a student with at least one logged session.
2. Click the pencil icon on a session entry.
3. Edit the Teacher input field (add a name, change it, or clear it) and click Save.

**Expected:**
- The entry updates to show the new teacher name inline (e.g. "Session 1 · Ms. Smith").
- Clearing the teacher field removes the teacher name from the entry entirely.
- The change persists after a page reload.

---

## TC-04 · 10-hour pack: auto-approval on purchase

**Requirement:** When a student submits a payment for a 10-hour pack only (no regular classes in the cart), the pack is activated immediately without teacher review.

**Steps:**
1. Log in as a student.
2. Add a 10-hour pack to the cart (no other classes).
3. Go to Payments → Cart, fill in amount, payment method, note, and upload a receipt.
4. Click Submit.

**Expected:**
- Success screen shows "10-hour pack activated!" (not "Payment submitted!").
- The payment appears in the teacher's Payments → Confirmed tab (not Pending).
- The pack appears immediately on the student's Dashboard as an active pack.
- The cart badge in the nav bar drops to 0.

---

## TC-05 · Cart badge clears after pack submission

**Requirement:** After submitting a 10-hour pack payment, the cart count badge in the nav bar must show 0 (not 1).

**Steps:**
1. Add a 10-hour pack to the cart.
2. Submit the payment (see TC-04).

**Expected:**
- Immediately after the success screen appears, the Payments nav badge shows no number.
- Navigating away and back does not restore the badge.

---

## TC-07 · Weekly summary email — manual send

**Requirement:** Teacher can send a weekly summary email manually from the Configuration page. The email covers leave requests, make-up requests, and new registrations from the past 7 days.

**Steps:**
1. Log in as a teacher.
2. Go to Configuration → Email settings. Confirm EmailJS credentials are saved (Connected badge).
3. Scroll to "Weekly summary email" card.
4. Click "Send weekly summary now".

**Expected:**
- Button shows "Sending…" spinner while in progress.
- On success: "Sent to N teachers" confirmation appears for ~6 seconds.
- All teacher emails receive a message with subject "[Youtopia] Weekly Summary — <date>".
- Email body has three sections: LEAVE REQUESTS, MAKE-UP REQUESTS, NEW REGISTRATIONS, each listing items from the last 7 days (or "No … this week." if empty).
- If EmailJS is not configured, button is disabled and a hint is shown.

---

## TC-08 · Weekly summary email — EmailJS config save

**Requirement:** Teacher can save EmailJS credentials in Configuration → Email settings.

**Steps:**
1. Log in as a teacher. Go to Configuration → Email settings.
2. Click Edit. Enter Service ID, Template ID, and Public Key.
3. Click Save.

**Expected:**
- Status badge changes from "Not configured" to "Connected".
- Service and Template IDs are shown below the badge.
- Credentials persist after page reload (stored in Firestore at `settings/main.emailConfig`).
- On mobile (≤ 480px) the three credential fields stack full-width; on desktop they sit on one row.

---

## TC-09 · Summary email — failed send must not record a success

**Requirement:** `summaryLastSent` is only written when at least one email was actually delivered. A total failure must not display "Last sent" or suppress the next scheduled attempt.

**Steps:**
1. Log in as a teacher. Go to Configuration → Email settings.
2. Click Edit and change the Service ID to an invalid value (e.g. `service_broken`). Save.
3. Scroll to Summary email → click "Send summary now".

**Expected:**
- An error is shown ("N failed — …" or "Failed — check EmailJS settings").
- The "Last sent" date does **not** change (still shows the previous value, or nothing).
- Restore the correct Service ID and send again — "Last sent" updates to today.
- Same rule applies to the scheduled Cloud Function: if every recipient fails it logs
  "Summary FAILED for all N teachers" and leaves `summaryLastSent` untouched.

---

## TC-10 · Summary email — scheduled send is actually deployed

**Requirement:** The automated summary depends on the `weeklyTeacherSummary` Cloud Function existing in the Firebase project. Shipping the frontend alone does not deliver it.

**Steps:**
1. Run `firebase functions:list`.
2. Confirm `weeklyTeacherSummary` is listed for project `youtopia-3e141`.
3. In the Firebase console, check the function's logs after the next scheduled 9 AM Pacific run.

**Expected:**
- The function is listed (requires the Blaze plan and the Cloud Functions API enabled).
- Logs show either "Summary sent to N/N teachers" or a skip reason
  ("Not scheduled for this hour", "EmailJS not configured", "No teacher emails").
- Teachers receive the email on the configured day.

---

## TC-11 · Security: a student cannot see another student's data

**Requirement:** A signed-in student may read only their own records. Payment receipts, leave requests and profiles belonging to other students must be unreachable — from the UI and from the Firestore API directly.

**Steps:**
1. Log in as a student. Open the browser devtools console.
2. Confirm the Dashboard and Hub show that student's own pending payments.
3. In the console, attempt a direct read of another student's document, e.g.
   `getDoc(doc(db,'students','someoneelse%40example.com'))`.

**Expected:**
- Own payments and classes render exactly as before.
- The direct read of another student's document fails with `permission-denied`.
- The network tab shows the student subscribing only to `settings/main` and a
  `payments` query filtered by their own `studentEmail` — not whole collections.

---

## TC-12 · Security: a student cannot grant themselves teacher access

**Requirement:** `teacherEmails` lives in `settings/private`, which is teacher read/write only. It is the list `verifyTeacherAccess` consults, so any student access to it would be a full privilege escalation.

**Steps:**
1. Log in as a student. In the console, attempt
   `getDoc(doc(db,'settings','private'))` and then
   `setDoc(doc(db,'settings','private'),{teacherEmails:['me@example.com']},{merge:true})`.
2. Attempt both as a teacher.

**Expected:**
- Both student operations fail with `permission-denied` — a student cannot even
  read the document, so the EmailJS credentials are not exposed either.
- Both teacher operations succeed.
- Reading `settings/main` still works as a student (the class list and semester
  dates come from it and every student page needs them), and it no longer
  contains `teacherEmails` or `emailConfig`.

---

## TC-13 · Security: a student cannot confirm their own payment

**Requirement:** Payment status decisions are teacher-only. A student may create a payment but never update one.

**Steps:**
1. Log in as a student and submit a package purchase.
2. In the console, attempt to update that payment document, setting `status` to `confirmed`.

**Expected:**
- Creation succeeds and the payment appears as Pending.
- The status update fails with `permission-denied`.
- A teacher confirming the same payment from the Payments page succeeds.

---

## TC-14 · Security: a teacher granted only via the allow-list can still sign in

**Requirement:** Teachers who are NOT hard-coded in `config.js` / the rules' root list — currently `anniechang0719@gmail.com` and `feiafei@gmail.com` — get their access from `settings/private.teacherEmails`. The Firestore rules resolve that list with `exists()` + `get()`, which cannot be exercised by the offline rules tests (the Rules API has no database access), so this path is only provable in production.

**Steps:**
1. Log in as `anniechang0719@gmail.com` (or `feiafei@gmail.com`) and choose Teacher.
2. Open Configuration.
3. Log in as a root teacher (`summerli634@gmail.com`) and confirm the same.

**Expected:**
- The allow-listed teacher reaches the teacher portal, and Configuration shows the
  full teacher list, the semester, and Email settings as "Connected".
- If instead they are bounced to the student view, the rules could not read
  `settings/private` — re-check that the document exists and holds `teacherEmails`.
- Root teachers bypass the allow-list via the hard-coded list, so testing only
  with them does **not** cover this case.

---

## TC-06 · Teacher: view receipt after decision

**Requirement:** After a teacher confirms or rejects a payment, they can still view the uploaded receipt image.

**Steps:**
1. Log in as a teacher.
2. Go to Payments → Confirmed (or Rejected) tab.
3. Find a payment that had a receipt uploaded.
4. Click the Receipt button.

**Expected:**
- The receipt image expands inline below the payment row.
- Clicking Hide (or Receipt again) collapses it.
- The button is not shown if no receipt was uploaded.

---

## TC-09 · Mobile login: unauthorised account cannot get teacher access

**Requirement:** The teacher allow-list check must run on every login path, including mobile, before the teacher role is granted.

**Steps:**
1. On a mobile browser (or desktop DevTools device emulation with an iPhone/Android user agent), open the login page.
2. Select **Teacher**.
3. Sign in with a Google account that is NOT in `TEACHER_EMAILS` (src/config.js) and NOT in `settings/main.teacherEmails`.

**Expected:**
- Sign-in is rejected with "This account is not registered as a teacher…".
- The account is signed out; the app stays on the login page.
- `localStorage.pendingLoginRole` is NOT set, and the page does NOT reload into the teacher console.

---

## TC-10 · Mobile login: approved teacher signs in successfully

**Requirement:** An approved teacher can still log in on mobile after the popup reload workaround.

**Steps:**
1. On a mobile browser, select **Teacher** and sign in with an approved teacher account.
2. Allow the page to reload.

**Expected:**
- Google sign-in uses a popup (not a full-page redirect away from the app).
- After the automatic reload, the teacher console is shown, still signed in.
- `localStorage.pendingLoginRole` is cleared after restore.

---

## TC-11 · Tampered pendingLoginRole is rejected

**Requirement:** The role restored after the mobile reload must be re-verified, not trusted from localStorage.

**Steps:**
1. Log in as a **student** on any browser.
2. In DevTools console, run `localStorage.setItem('pendingLoginRole','teacher')`.
3. Reload the page.

**Expected:**
- The student is NOT restored into the teacher console.
- The session is signed out and the login page is shown.

---

## TC-12 · In-app browser shows "open in browser" overlay immediately

**Requirement:** WeChat and other in-app browsers show the instruction overlay without attempting a sign-in.

**Steps:**
1. Open the app with a user agent containing `MicroMessenger` (or Instagram/FBAV).
2. Tap **Continue with Google**.

**Expected:**
- The overlay appears immediately; no Google popup is attempted and no error flashes first.
- Overlay renders without horizontal overflow at 320px width.

---

## TC-13 · Stale pendingLoginRole does not hijack a later login

**Requirement:** A `pendingLoginRole` left over from an abandoned or failed sign-in must be discarded, not applied to the next login.

**Steps:**
1. With no user signed in, run `localStorage.setItem('pendingLoginRole','teacher')` in DevTools.
2. Reload the page (login page should appear).
3. Now log in normally as a **student**.

**Expected:**
- Step 2 clears `pendingLoginRole` immediately (verify it is gone in Application → Local Storage).
- Step 3 logs in as a student normally — no forced sign-out, no teacher console.

---

## TC-14 · Abandoned sign-in tab does not lock the login button

**Requirement:** If the user leaves or abandons the Google sign-in tab, the login page must recover instead of spinning forever.

**Steps:**
1. On mobile (or desktop), tap **Continue with Google**.
2. When the Google tab opens, do NOT sign in — close that tab (or press back) and return to the app.
3. Wait ~3 seconds.

**Expected:**
- The button stops showing "Signing in…" and becomes tappable again.
- "Sign-in didn't finish. Please try again." is shown.
- Tapping the button again starts a fresh sign-in that completes normally.
- A *successful* sign-in is NOT interrupted by this recovery (verify a normal login still works end to end).
