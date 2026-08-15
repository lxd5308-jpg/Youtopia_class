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

## TC-14 · Security: a teacher added from the UI can sign in

**Requirement:** All five permanent teachers (`info@youtopiadanceacademy.com`, `summerli634@`, `yating8697@`, `anniechang0719@`, `feiafei@`) are hard-coded in both `src/config.js` and `rootTeacher()` in `firestore.rules`, so their access does not depend on any Firestore document. Anyone added later in Configuration → Teacher portal access is granted through `settings/private.teacherEmails`, which the rules resolve with `exists()` + `get()` — a path the offline rules tests cannot exercise, because the Rules API has no database access.

**Steps:**
1. Log in as any permanent teacher and open Configuration. (Covered by the
   offline suite, but confirm the portal loads.)
2. In Configuration → Teacher portal access, add a spare Google address you control.
3. Log out, then log in with that address and choose Teacher.
4. Remove it again afterwards.

**Expected:**
- Every permanent teacher reaches the teacher portal; Configuration shows the
  teacher list, semester, and Email settings as "Connected".
- The newly added address also reaches the teacher portal — this is the only
  proof that the `settings/private` allow-list lookup resolves in production.
- If step 3 bounces to the student view, the rules could not read
  `settings/private`; check the document exists and holds `teacherEmails`.
- Permanent teachers show a `config.js` pill in the list and keep access even
  if removed there — revoking one needs a code change and a deploy.

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

---

## TC-15 · Roster: switch a student to a different class

**Requirement:** A teacher can move a student from one class to another from the Roster without touching Firestore directly, and the change is reflected everywhere enrollment data is read from.

**Steps:**
1. Log in as teacher, open Student roster.
2. Find a row for a student enrolled in Class A. Click **Switch**.
3. In the dialog, pick a different class (Class B) from the dropdown — classes the student is already enrolled in must not appear in the list — optionally add a note, then confirm.

**Expected:**
- The dialog closes and the roster row now shows Class B instead of Class A (no full page reload needed).
- The student's `enrolled` list no longer contains Class A's id and now contains Class B's id (check `students/{email}` in Firestore, or have the student reload their Schedule/My Classes page).
- The old `enrollments` record for Class A is gone; a new one exists for Class B with a fresh `enrolledAt` timestamp and the same package type the old enrollment had.
- Any generic 10-hour package hours the student has are untouched — switching classes must not change `sessionsUsed` on any pack.
- Confirm button stays disabled until a target class is chosen.

---

## TC-16 · Roster: drop a student from a class

**Requirement:** A teacher can withdraw a student from a single class from the Roster, removing it from their enrolled classes without affecting unrelated classes or package hours.

**Steps:**
1. Log in as teacher, open Student roster.
2. Find a student enrolled in two different classes. Click **Drop** on one of the two rows.
3. Confirm the drop in the dialog.

**Expected:**
- The dropped class's row disappears from the roster; the student's other class row is untouched.
- The student's `enrolled` list no longer contains the dropped class's id; the other class id remains.
- The `enrollments` record for the dropped class is deleted.
- The student's 10-hour package hours (if any) are unchanged.
- Cancel closes the dialog without writing anything.
- Works at 320px width: the dialog does not overflow horizontally and both buttons stay tappable.

---

## TC-17 · Roster: leave/makeup detail, search, and CSV export

**Requirement:** A teacher can see full leave and makeup detail (date, reason, makeup class, fee) per student directly on the Roster, search the roster, and download it with that detail included.

**Steps:**
1. Log in as teacher, open Student roster. Find a student row with at least one leave request and one makeup request.
2. Click the "leave(s)" pill, the "makeup(s)" pill, or the **Detail** button.
3. Type part of a student's name, email, or class name into the search box.
4. Clear the search, then click **Download CSV**.

**Expected:**
- Step 2 expands an inline panel under that row showing, per leave request: date, status pill, reason, teacher note (if any), and — if a makeup was requested — the makeup class, instructor, date, status, and `+$X fee` when a fee applies. Clicking again collapses it.
- Step 3 narrows the table to only matching rows; a "No students match" message appears if nothing matches.
- Step 4's CSV includes a "Leave Details" and "Makeup Details" column with the same date/reason/fee information as the on-screen panel, for whatever rows were visible at download time.
- No horizontal overflow at 320px width; the search box and Download CSV button wrap onto their own line rather than clipping.

---

## TC-18 · Makeup request: Competition Team excluded, fee for a pricier class

**Requirement:** A student cannot request a makeup class in a Competition Team class. If the makeup class costs more per session than their own class, the flat fee difference is charged; if it costs the same or less, no fee applies.

**Steps:**
1. Log in as a student with an approved leave request for a non-Competition class (e.g. a 2hr, $48/session class).
2. Click "Request makeup class". Check the "Class to attend" dropdown.
3. Select a class that costs more per session than the student's own class (e.g. a 2.5hr, $60/session class).
4. Submit the request.
5. Log in as teacher, find the makeup request (Dashboard's "Leave & Make Up requests" card, or the Roster detail panel from TC-17).
6. Go to teacher Payments page.

**Expected:**
- Step 2: no Competition Team class appears in the dropdown, for any student.
- Step 3: before submitting, a warning shows the additional fee (e.g. "$60 class costs more than $48 class — an additional $12 fee will apply"), computed as the flat difference between the two classes' per-session fee.
- Step 5: the makeup request shows the same `+$12 fee` next to the requested class.
- Step 6: a new pending payment appears for that student, pkgType "Makeup class fee", total $12, with a note naming both classes. Confirming it does **not** enroll the student in the makeup class (Roster enrollment count is unchanged) — it only marks the payment confirmed and adds it to the revenue ledger.
- Repeat with a same-price or cheaper makeup class: no fee warning appears, no pending payment is created, and `makeup.fee` is 0.

---

## TC-19 · Roster: Day/Time shows regardless of how classId was stored

**Requirement:** The Roster's Day/Time column must resolve correctly even if an enrollment record's `classId` was stored as a string while the class list's `id` is a number (or vice versa) — a type mismatch must not silently blank the field.

**Steps:**
1. In Firestore, find or create an `enrollments/{id}` doc where `classId` is stored as a string (e.g. `"9"`) matching a class whose `id` in `settings/main.classes` is the number `9`.
2. Open the teacher Roster page and find that row.
3. Open the Switch dialog for that row and check the "already enrolled in" exclusion works (the student's current class should not appear as a switch target even if its stored `classId` type differs from the class list's).

**Expected:**
- Step 2: Day/Time shows the real values (e.g. "周六 Sat" / "1:00pm–3:30pm"), not "—", and Category shows the real category badge instead of falling back to "kids".
- Step 3: the student's current class is excluded from the "New class" dropdown regardless of the stored type of `classId`.

---

## TC-20 · Enrollment survives a class being edited or deleted later

**Requirement:** An enrollment's Day/Time/Instructor/Category on the Roster must reflect what was true when the student enrolled, and must not go blank just because the class was later edited or removed from Configuration. Deleting a class with active enrollments must warn the teacher first.

**Steps:**
1. As a student, sign up for a class (or as teacher, confirm a class payment, or use Switch on an existing roster row) so a fresh `enrollments` doc is written.
2. As teacher, go to Configuration and edit that class's day/time, or delete it entirely.
3. Go back to Student roster and find that student's row.
4. Separately: try deleting a class that still has enrolled students, without having made any enrollment changes first.

**Expected:**
- Step 3: Day/Time (and Category) still show the values that were true at enrollment time — unaffected by the edit or deletion in step 2. (This relies on `days`/`time`/`instructor`/`category`/`fee` being snapshotted onto the `enrollments` doc when it's written — check the doc in Firestore has these fields.)
- Step 4: the delete confirmation names how many students are currently enrolled in that class and warns that their roster row's schedule will show "—" going forward, instead of the old generic "This cannot be undone" with no mention of affected students.
- A class with zero enrollments still shows the plain confirmation with no warning text.

---

## TC-21 · Class change history survives a Drop, and shows the related payment

**Requirement:** When a teacher drops a student from a class, the class disappears from the Roster table (no more enrollment row to expand), but the teacher must still be able to see that it happened and whether the student had paid for it — without cross-referencing Firestore or hunting through the Payments page unprompted.

**Steps:**
1. As a student, submit a payment for a class (Hub → pay via Zelle/Venmo/cash, e.g. $180 for "Ballet L2"), and as teacher confirm it in Payments so it's linked to that student + class name.
2. As teacher, open Student roster, open the **Drop** dialog for that student's "Ballet L2" row — but don't confirm yet.
3. Check the dialog, then confirm the drop.
4. Scroll down to the new **Class change history** card below the roster table.
5. Type the student's name into the roster search box.
6. Repeat steps 1–3 for a class the student never paid for.

**Expected:**
- Step 2: before confirming, the dialog shows "$180 paid for this class across 1 payment (confirmed)" and a note that dropping doesn't auto-refund it.
- Step 3: after confirming, the "Ballet L2" row disappears from the Student roster table entirely (as before this change).
- Step 4: a new entry appears — student name, a red "Dropped" pill, "Dropped **Ballet L2**", today's date, and a "$180 paid for this class, not yet refunded — go to Payments to refund" line, still visible even though the roster row is gone.
- Step 5: the search box also filters the Class change history card (not just the roster table) — typing the student's name keeps their drop/switch entries visible and hides unrelated ones.
- Step 6: the dialog shows "No payment on file for this class," and the resulting history entry shows "No payment on file for this class" instead of a dollar amount.
- `node tests/rules-test.mjs firestore.rules` passes, including the new `classChangeLog` cases (student denied read/write, teacher allowed).

---

## TC-22 · Drop/Switch works even when the enrollment's classId was stored as a string

**Requirement:** `dropStudentClass`/`switchStudentClass` must resolve the class (for the log entry's name, and for removing the id from `enrolled`/`pendingEnroll`) even when the enrollment doc's `classId` field is a string while `classes[].id` is a number — the same kind of mismatch that caused the Day/Time bug (TC-19), but here on the *write* side.

**Steps:**
1. In Firestore (dev), create or find an `enrollments/{id}` doc where `classId` is a string (e.g. `"7"`) matching a real class whose `id` is the number `7`, and make sure that same number is in the student's `students/{id}.enrolled` array.
2. As teacher, open the Drop dialog for that row and confirm the drop.
3. Check the resulting Class change history entry and the student's own `enrolled` array in Firestore.
4. Repeat with Switch instead of Drop, using a `fromClassId` stored as a string.

**Expected:**
- Step 3: the history entry shows the real class name (not "Dropped a class"), and any matching payment for that class name shows up correctly.
- Step 3: `students/{id}.enrolled` no longer contains the class's numeric id — it was actually removed, not left behind because a string `classId` failed to strictly-equal the number in the array.
- Step 4: same result for switch — `fromClassName` resolves correctly and the old numeric id is actually removed from `enrolled` (with the new class's id added).

---

## TC-23 · Refund a confirmed payment (full and partial)

**Requirement:** A teacher can record that a confirmed payment was refunded — fully or partially — without it changing the student's enrollment, and the record shows up everywhere the payment already did (Payments page, Roster's Class change history and Drop dialog, CSV export).

**Steps:**
1. As teacher, go to Payments → Confirmed tab, find a confirmed payment (e.g. $684 total), click **Refund**.
2. Try clicking "Confirm refund" with the amount field cleared / set to $0.
3. Set the amount to the full $684 and confirm.
4. Find a different confirmed payment, click Refund, set the amount to less than the total (e.g. $200 of $684), add a note, confirm.
5. Check the Payments page stat cards and the Refunded tab.
6. Go to Roster, find the student from step 3, open Class change history (or the Drop dialog if not yet dropped) for that class.
7. Download the Payments CSV.

**Expected:**
- Step 1: the info box explicitly says this only records the refund and does not send money — actually returning it happens outside the app first.
- Step 2: "Confirm refund" stays disabled with an inline error ("Enter an amount between $0.01 and $684").
- Step 3: the payment moves out of Confirmed into the Refunded tab, shows "↩ Refunded" pill, and the enrollment/roster is untouched (confirming this does NOT call `enrollStudent` or change any `enrollments` doc).
- Step 4: the payment also moves to Refunded, shows the $200 amount and note — not the full $684.
- Step 5: "Confirmed payments" stat total no longer includes either refunded payment; the new "Refunded" stat card shows 2 payments and the correct combined $ total; the Refunded tab lists both with their respective amounts and notes.
- Step 6: shows "$X refunded — nothing outstanding" (full refund) or "$684 paid, $200 refunded so far — go to Payments to finish it" (partial), matching the color (green for fully refunded, orange for partial/none).
- Step 7: CSV includes Refunded/Refund Amount/Refund Note columns with the correct values for both rows.
- `node tests/rules-test.mjs firestore.rules` still passes (no rules changes were needed — `payments/{id}` already allows unconditional teacher `update`).

---

## TC-24 · Prior-semester credit or discount: one order-level adjustment, item prices stay at catalog

**Requirement:** A student enrolling in multiple classes with a credit or discount enters it once for the whole order, not per class — item prices always stay at the catalog rate, and it's up to the teacher to decide how the credit is allocated across classes outside the app. A teacher must separately be able to adjust the amount at confirm time via the same kind of delta field.

**Steps:**
1. As a student, go to Schedule, sign up for two classes (e.g. catalog prices $480 and $200 — subtotal $680), go to the cart in Hub.
2. Confirm each class's price shown in the cart is still its plain catalog price (no per-item credit field). Scroll to the bottom, find the single "Credit / discount for this order" field, enter `-80`.
3. Notice "Subtotal $680 - $80" appears above "Order total $600". Fill in the required note (e.g. "returning student credit -$80, teacher to allocate") and a receipt, submit.
4. As teacher, go to Payments → Pending, find that submission.
5. Click Confirm. Leave the Adjustment field at its default (blank/0).
6. Find or submit a different single-class pending payment at full catalog price. Click Confirm, enter `-50` in the Adjustment field, add a reason, confirm.
7. Check Roster for both students' payment amounts (Class change history / Drop dialog), and download the Payments CSV.

**Expected:**
- Step 2: each class item shows its plain catalog price with no adjustment control next to it.
- Step 3: the "Subtotal ... / Order total" breakdown only appears once a non-zero credit is entered; with $0 it just shows "Order total $680".
- Step 4: the pending payment lists total $600 (not $680), with an info line: "Student applied a credit/discount to the whole order: subtotal $680 - $80 = $600. Distributing it across classes is up to you." — each item's own price is still $480/$200 (catalog), not reduced.
- Step 5: confirming with a blank/0 adjustment enrolls the student normally at $600 — `enrollments` docs and `enrolled` array are unaffected by price either way.
- Step 6: after confirming with the adjustment, the payment shows "Confirmed at $X (submitted $Y - $50) — reason", `originalTotal` holds the pre-adjustment submitted amount, and (since it's a single-item payment) that item's own `price` is reduced by $50 to stay in sync with `total`.
- Step 7: Roster's payment lookups (which key off `item.price`) show the catalog price for the multi-item order's classes (the order-level credit isn't attributed to either one), and the discounted price for the single-item teacher-adjusted payment.
- Step 7: CSV includes "Subtotal ($)", "Order Adjustment ($)", "Submitted Total ($)", "Confirm Adjustment ($)", and "Confirm Adjustment Note" columns with correct values.

---

## TC-25 · Makeup class fee shows up on the student's own side, via Hub Payment History — not mixed into "My classes"

**Requirement:** When a makeup-class fee creates a pending payment, the student who owes it must be able to see it on their own side — but "My classes" (Dashboard) is for classes, not payment administrivia, so any pending payment (fee, 10-hour pack, or a bundled multi-class purchase) belongs only in Hub's "Payment History," never mixed into the class list.

**Steps:**
1. As a student, request a makeup class for a class that costs more than the one they're in (triggers a fee — see TC-18), so a pending `payments` doc with `pkgType:'makeupFee'` gets created.
2. As that student, go to Dashboard → "My classes" card.
3. Also check Hub's "Payment History" card.
4. Separately, submit a multi-class cart payment through Hub (several classes in one submission) while it's still pending, and check Dashboard's "My classes" again.
5. As teacher, confirm or reject the makeup fee in Payments.

**Expected:**
- Step 2: no makeup-fee row (or any pending-payment row) appears in "My classes" — that card shows only actually-enrolled classes (plus the older `pendingEnroll`-array mechanism's pending class rows, unrelated to payments). The card's count in the header reflects only `enrolledClasses.length`.
- Step 3: the makeup fee appears in Hub's Payment History with a "⏳ Pending" pill, the fee amount, and no stray "via" text (no payment method has been chosen yet for a fee).
- Step 4: the bundled multi-class payment (e.g. "Ballet L3, Ballet L3, Competition Team 1 · $2746 · Pending") appears in Hub's Payment History as one row, but still does **not** appear anywhere in Dashboard's "My classes."
- Step 5: once confirmed or rejected, the fee's status updates in Hub's Payment History accordingly; Dashboard's "My classes" is unaffected either way since it never showed it.

---

## TC-26 · Leave request session date must match the class's day of week

**Requirement:** The "Session date" field on a leave request must not accept a date that falls on a different day of the week than the class actually meets, to cut down on students accidentally logging leave against the wrong date.

**Steps:**
1. As a student, find an enrolled class that meets on a specific day (e.g. "周二 Tue"). Click "Request leave" (test this on both Dashboard and My Classes — same fix, two files).
2. Pick a date that is NOT a Tuesday (e.g. a Friday).
3. Pick a date that IS a Tuesday.
4. Fill in a reason and submit.
5. Repeat for the Adult "Drop-in (Adult)" class, whose `days` is "Any".
6. Check behavior around a timezone edge case: pick a date and confirm the shown day-of-week error (or lack of one) matches the actual local calendar day, not a day shifted by UTC parsing.

**Expected:**
- Step 2: an inline warning appears ("This class meets 周二 Tue — pick a matching date") and the Submit button is disabled.
- Step 3: the warning disappears and Submit becomes enabled (assuming a reason is also filled in).
- Step 4: the leave request submits normally with the matching date.
- Step 5: no day restriction applies for a class whose `days` is "Any" — any date is accepted, Submit is never blocked by a day mismatch for this class.
- Step 6: the picked date's weekday, as shown by the browser's native date picker, is what the mismatch check uses — no off-by-one from `new Date(isoString)` parsing as UTC midnight.

---

## TC-27 · Makeup request "Preferred date" must match the makeup class's own day, not the missed class's

**Requirement:** Same restriction as TC-26, but for the makeup-request form's optional "Preferred date" — it must match the day the *selected makeup class* meets, not the day of the class the student is making up (those can legitimately differ, e.g. missed a Tuesday class, making it up in a Saturday class).

**Steps:**
1. As a student with an approved leave (whose own class meets, say, Tuesday), click "Request makeup class."
2. In "Class to attend," pick a class that meets on a different day than the missed class (e.g. Saturday).
3. In "Preferred date," pick a date that is NOT a Saturday.
4. Pick a date that IS a Saturday.
5. Leave "Preferred date" blank entirely and submit.
6. Change "Class to attend" to a different class after already picking a valid date for the first one — confirm the mismatch re-evaluates against the newly selected class, not the old one.

**Expected:**
- Step 3: inline warning ("{Class name} meets 周六 Sat — pick a matching date") appears; "Submit request" is disabled. The warning must reference the *makeup* class's day, not the day of the class being missed.
- Step 4: warning clears, Submit becomes enabled (assuming a class is selected).
- Step 5: since "Preferred date" is optional, submitting with it blank is allowed regardless of the selected class's day — the mismatch check only applies once a date is actually entered.
- Step 6: switching the selected class immediately re-checks the existing date against the new class's day — a date valid for the old selection can become invalid (and block Submit) for the new one, and vice versa.

---

## TC-28 · Confirm-time adjustment on a 10-hour pack payment stays in sync with the created sessionPack

**Requirement:** When a teacher applies a confirm-time discount/credit adjustment to a single-item 10-hour-pack payment, the sessionPack record actually created must show the adjusted amount, not the original — same for a student-side cart credit applied to a pack-only purchase.

**Steps:**
1. As a student, submit a pack-only cart purchase (no classes) for $380 with a $-10 order-level credit (total $370). This auto-confirms immediately (no teacher review needed for a pack-only cart).
2. Check the created sessionPack in Packages (teacher) / MyClasses or Dashboard (student) — its "Purchased ... · $X" total.
3. Separately, as a student, submit a pack-only cart purchase for $380 with no credit. As teacher, Confirm it but apply a `-20` Adjustment.
4. Check that sessionPack's total.

**Expected:**
- Step 2: sessionPack total shows $370, matching the payment record's total — not $380.
- Step 4: sessionPack total shows $360 (380-20), matching the confirmed payment's total — not $380. (Before this fix, `enrollStudent` was called with the original unadjusted items, so the sessionPack would silently show the pre-discount amount while the payment record showed the discounted one.)

---

## TC-29 · Rejected/pending payments never count as "paid" in Roster's payment lookups

**Requirement:** Roster's Drop dialog and Class change history only treat `confirmed`/`refunded` payments as money the student actually paid — a rejected payment (teacher declined it) or a still-pending one (not yet confirmed) must not inflate the "$X paid for this class" figure.

**Steps:**
1. Submit a payment for a class, and have the teacher reject it (receipt unclear, etc.).
2. Submit a second payment for the same student+class and leave it pending (don't confirm or reject).
3. Open the Drop dialog for that student's class row.
4. Confirm the second payment, then reopen the Drop dialog.

**Expected:**
- Step 3: shows "No payment on file for this class" — neither the rejected nor the still-pending payment should be counted.
- Step 4: after confirming, the dialog now shows the confirmed amount as paid.
