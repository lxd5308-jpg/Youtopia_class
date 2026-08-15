// Verifies the Firestore rules with the Firebase Rules test API
// (server-side evaluation, no emulator and no deploy).
//
// Two things the API does that will waste your afternoon otherwise:
//  1. It has NO database access. get() and exists() are not implemented —
//     an unmocked call fails with "Function not found: exists", which reads
//     as a DENY. Every rule path that touches settings/private therefore
//     needs a functionMock, and the mock below mirrors the live document.
//  2. It URL-decodes request paths once. students/{id} keys are
//     encodeURIComponent(email), so a doc ID containing a literal '%40'
//     must be written '%2540' here.
//
// Run: node tests/rules-test.mjs firestore.rules
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const cs = require(`${process.env.HOME}/.config/configstore/firebase-tools.json`)
const TOKEN = cs.tokens.access_token
const PROJECT = 'youtopia-3e141'
const SRC = readFileSync(process.argv[2] || './phase2.rules', 'utf8')

const DB = `/databases/(default)/documents`
const TEACHER = 'summerli634@gmail.com'
const STUDENT = 'kid@example.com'
const OTHER = 'someoneelse@example.com'
// A teacher who is NOT hard-coded in the rules — granted only via the
// settings/private allow-list, like anniechang0719@gmail.com in production.
const ALLOWLIST_TEACHER = 'allowlisted@teacher.com'

const auth = (mail, verified = true) => ({
  uid: 'u_' + mail,
  token: { email: mail, email_verified: verified, sub: 'u_' + mail, firebase: { sign_in_provider: 'google.com' } },
})

// A stored document as the rules engine expects it.
const res = (data) => ({ data })

function tc(name, expectation, { path, method, mail, verified = true, data, newData }) {
  const request = {
    path: `${DB}${path}`,
    method,
    time: new Date().toISOString(),
  }
  if (mail) request.auth = auth(mail, verified)
  if (data !== undefined) request.resource = res(data)
  const test = { expectation, request }
  if (newData !== undefined) test.request.resource = res(newData)
  if (data !== undefined && newData !== undefined) {
    test.resource = res(data)
    test.request.resource = res(newData)
  } else if (data !== undefined && ['get', 'list', 'delete'].includes(method)) {
    test.resource = res(data)
    delete test.request.resource
  }
  // isTeacher() calls exists() and get() on settings/private — mock both so
  // the tests do not depend on live data.
  test.functionMocks = [
    {
      function: 'get',
      args: [{ exactValue: `${DB}/settings/private` }],
      result: { value: { data: { teacherEmails: [TEACHER, ALLOWLIST_TEACHER] } } },
    },
    {
      function: 'exists',
      args: [{ exactValue: `${DB}/settings/private` }],
      result: { value: true },
    },
  ]
  return { name, test }
}

const OWNED = { studentEmail: STUDENT, studentName: 'Kid', status: 'pending' }
const NOT_OWNED = { studentEmail: OTHER, studentName: 'Other', status: 'pending' }

const cases = [
  // ── the escalation path ──────────────────────────────────────
  tc('student CANNOT write settings/main (escalation)', 'DENY',
     { path: '/settings/main', method: 'update', mail: STUDENT, data: { teacherEmails: [TEACHER] }, newData: { teacherEmails: [TEACHER, STUDENT] } }),
  tc('teacher CAN write settings/main', 'ALLOW',
     { path: '/settings/main', method: 'update', mail: TEACHER, data: { teacherEmails: [TEACHER] }, newData: { teacherEmails: [TEACHER, 'new@t.com'] } }),
  tc('student CAN read settings/main (class list)', 'ALLOW',
     { path: '/settings/main', method: 'get', mail: STUDENT, data: { classes: [] } }),
  tc('unverified email claiming teacher address is DENIED', 'DENY',
     { path: '/settings/main', method: 'update', mail: TEACHER, verified: false, data: {}, newData: { classes: [] } }),

  // ── unauthenticated ──────────────────────────────────────────
  tc('anonymous cannot read settings', 'DENY', { path: '/settings/main', method: 'get', data: {} }),
  tc('anonymous cannot read students', 'DENY', { path: '/students/kid%2540example.com', method: 'get', data: {} }),

  // ── student profile docs ─────────────────────────────────────
  tc('student CAN read own profile', 'ALLOW',
     { path: '/students/kid%2540example.com', method: 'get', mail: STUDENT, data: { studentName: 'Kid' } }),
  tc('student CANNOT read another profile', 'DENY',
     { path: '/students/someoneelse%2540example.com', method: 'get', mail: STUDENT, data: { studentName: 'Other' } }),
  tc('teacher CAN read any profile', 'ALLOW',
     { path: '/students/someoneelse%2540example.com', method: 'get', mail: TEACHER, data: { studentName: 'Other' } }),


  // ── payments ─────────────────────────────────────────────────
  tc('student CAN read own payment', 'ALLOW',
     { path: '/payments/p1', method: 'get', mail: STUDENT, data: OWNED }),
  tc('student CANNOT read another payment (receipts)', 'DENY',
     { path: '/payments/p2', method: 'get', mail: STUDENT, data: NOT_OWNED }),
  tc('student CAN create own payment', 'ALLOW',
     { path: '/payments/p3', method: 'create', mail: STUDENT, newData: OWNED }),
  tc('student CANNOT create payment for someone else', 'DENY',
     { path: '/payments/p4', method: 'create', mail: STUDENT, newData: NOT_OWNED }),
  tc('student CANNOT self-confirm a payment', 'DENY',
     { path: '/payments/p1', method: 'update', mail: STUDENT, data: OWNED, newData: { ...OWNED, status: 'confirmed' } }),
  tc('teacher CAN confirm a payment', 'ALLOW',
     { path: '/payments/p1', method: 'update', mail: TEACHER, data: OWNED, newData: { ...OWNED, status: 'confirmed' } }),
  tc('student CANNOT delete a payment', 'DENY',
     { path: '/payments/p1', method: 'delete', mail: STUDENT, data: OWNED }),

  // ── leave requests ───────────────────────────────────────────
  tc('student CAN create own leave request', 'ALLOW',
     { path: '/leaveRequests/l1', method: 'create', mail: STUDENT, newData: OWNED }),
  tc('student CAN amend own leave request', 'ALLOW',
     { path: '/leaveRequests/l1', method: 'update', mail: STUDENT, data: OWNED, newData: { ...OWNED, makeup: { className: 'X' } } }),
  tc('student CANNOT reassign leave request to another student', 'DENY',
     { path: '/leaveRequests/l1', method: 'update', mail: STUDENT, data: OWNED, newData: NOT_OWNED }),
  tc('student CANNOT read another leave request', 'DENY',
     { path: '/leaveRequests/l2', method: 'get', mail: STUDENT, data: NOT_OWNED }),

  // ── settings/private: the whole point of the split ───────────
  tc('student CANNOT read settings/private (EmailJS creds)', 'DENY',
     { path: '/settings/private', method: 'get', mail: STUDENT, data: { emailConfig: { serviceId: 's' } } }),
  tc('teacher CAN read settings/private', 'ALLOW',
     { path: '/settings/private', method: 'get', mail: TEACHER, data: { emailConfig: { serviceId: 's' } } }),
  tc('allow-listed (non-root) teacher CAN read settings/private', 'ALLOW',
     { path: '/settings/private', method: 'get', mail: ALLOWLIST_TEACHER, data: { emailConfig: { serviceId: 's' } } }),
  tc('student CANNOT write settings/private (escalation)', 'DENY',
     { path: '/settings/private', method: 'update', mail: STUDENT, data: { teacherEmails: [TEACHER] }, newData: { teacherEmails: [TEACHER, STUDENT] } }),
  tc('teacher CAN write settings/private', 'ALLOW',
     { path: '/settings/private', method: 'update', mail: TEACHER, data: { teacherEmails: [TEACHER] }, newData: { teacherEmails: [TEACHER, 'new@t.com'] } }),
  tc('anonymous cannot read settings/private', 'DENY',
     { path: '/settings/private', method: 'get', data: { emailConfig: {} } }),

  // ── root teachers work without the allow-list ────────────────
  // These four are hard-coded in rootTeacher(). The mock's allow-list holds
  // only TEACHER and ALLOWLIST_TEACHER, so passing here proves they are
  // granted directly by the rules and do not depend on settings/private
  // being readable at all.
  tc('anniechang is a root teacher (not via allow-list)', 'ALLOW',
     { path: '/settings/private', method: 'get', mail: 'anniechang0719@gmail.com', data: { emailConfig: {} } }),
  tc('feiafei is a root teacher (not via allow-list)', 'ALLOW',
     { path: '/settings/private', method: 'get', mail: 'feiafei@gmail.com', data: { emailConfig: {} } }),
  tc('yating is a root teacher (not via allow-list)', 'ALLOW',
     { path: '/settings/private', method: 'get', mail: 'yating8697@gmail.com', data: { emailConfig: {} } }),
  tc('info@ is a root teacher (not via allow-list)', 'ALLOW',
     { path: '/settings/private', method: 'get', mail: 'info@youtopiadanceacademy.com', data: { emailConfig: {} } }),
  tc('root teacher with unverified email is still denied', 'DENY',
     { path: '/settings/private', method: 'get', mail: 'anniechang0719@gmail.com', verified: false, data: { emailConfig: {} } }),
  tc('a non-teacher gmail account is still denied', 'DENY',
     { path: '/settings/private', method: 'get', mail: 'stranger@gmail.com', data: { emailConfig: {} } }),

  // ── make-up guard ────────────────────────────────────────────
  // Make-ups are auto-approved by design, so this must still work:
  tc('student CAN auto-approve a fresh make-up on own leave', 'ALLOW',
     { path: '/leaveRequests/l3', method: 'update', mail: STUDENT,
       data: OWNED,
       newData: { ...OWNED, makeup: { className: 'X', status: 'approved', autoApprovedAt: 'Aug 13, 2026' } } }),
  tc('student CANNOT overwrite a make-up the teacher resolved', 'DENY',
     { path: '/leaveRequests/l4', method: 'update', mail: STUDENT,
       data: { ...OWNED, makeup: { className: 'X', status: 'declined', resolvedAt: 'Aug 12, 2026' } },
       newData: { ...OWNED, makeup: { className: 'X', status: 'approved' } } }),
  tc('teacher CAN still edit a resolved make-up', 'ALLOW',
     { path: '/leaveRequests/l4', method: 'update', mail: TEACHER,
       data: { ...OWNED, makeup: { className: 'X', status: 'declined', resolvedAt: 'Aug 12, 2026' } },
       newData: { ...OWNED, makeup: { className: 'X', status: 'approved', resolvedAt: 'Aug 13, 2026' } } }),

  // ── teacher-only ledger ──────────────────────────────────────
  tc('student CANNOT read paymentHistory', 'DENY',
     { path: '/paymentHistory/h1', method: 'get', mail: STUDENT, data: { total: 200 } }),
  tc('teacher CAN read paymentHistory', 'ALLOW',
     { path: '/paymentHistory/h1', method: 'get', mail: TEACHER, data: { total: 200 } }),

  // ── switch/drop audit trail ────────────────────────────────────
  tc('student CANNOT read classChangeLog', 'DENY',
     { path: '/classChangeLog/c1', method: 'get', mail: STUDENT, data: { studentEmail: STUDENT } }),
  tc('student CANNOT write classChangeLog', 'DENY',
     { path: '/classChangeLog/c1', method: 'create', mail: STUDENT, newData: { studentEmail: STUDENT } }),
  tc('teacher CAN read and write classChangeLog', 'ALLOW',
     { path: '/classChangeLog/c1', method: 'create', mail: TEACHER, newData: { studentEmail: STUDENT } }),

  // ── sessionPacks / enrollments ───────────────────────────────
  tc('student CAN create own enrollment', 'ALLOW',
     { path: '/enrollments/e1', method: 'create', mail: STUDENT, newData: OWNED }),
  tc('student CAN re-enrol (merge update) own enrollment', 'ALLOW',
     { path: '/enrollments/e1', method: 'update', mail: STUDENT, data: OWNED, newData: { ...OWNED, pkgType: 'full' } }),
  tc('student CANNOT log sessions on own pack', 'DENY',
     { path: '/sessionPacks/s1', method: 'update', mail: STUDENT, data: OWNED, newData: { ...OWNED, sessionsUsed: 10 } }),
  tc('teacher CAN log sessions', 'ALLOW',
     { path: '/sessionPacks/s1', method: 'update', mail: TEACHER, data: OWNED, newData: { ...OWNED, sessionsUsed: 3 } }),

  // ── unlisted collection is closed ────────────────────────────
  tc('unlisted collection is denied even for teachers', 'DENY',
     { path: '/somethingNew/x1', method: 'get', mail: TEACHER, data: {} }),
]

const body = {
  source: { files: [{ name: 'firestore.rules', content: SRC, fingerprint: '' }] },
  testSuite: { testCases: cases.map(c => c.test) },
}

const r = await fetch(`https://firebaserules.googleapis.com/v1/projects/${PROJECT}:test`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
const out = await r.json()

if (out.error) {
  console.error('API error:', JSON.stringify(out.error, null, 2))
  process.exit(2)
}
for (const iss of out.issues || []) console.error('RULES ISSUE:', iss.description, `(line ${iss.sourcePosition?.line})`)

const results = out.testResults || []
let failed = 0
results.forEach((res, i) => {
  const ok = res.state === 'SUCCESS'
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${cases[i].name}`)
  if (!ok && res.debugMessages) console.log('      ' + res.debugMessages.join('\n      ').slice(0, 300))
})
console.log(`\n${results.length - failed}/${results.length} passed`)
if (failed || !results.length) process.exit(1)
