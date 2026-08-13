// ── Teacher access control ────────────────────────────────────
// Only these Google emails can sign in as Teacher.
// Permanent teachers. These must match rootTeacher() in firestore.rules —
// they are granted access by the rules directly, so they keep working even if
// settings/private is unreadable, and they cannot be removed from the UI.
// Anyone added in Configuration → Teacher portal access lives in
// settings/private.teacherEmails instead.
export const TEACHER_EMAILS = [
  'info@youtopiadanceacademy.com',
  'summerli634@gmail.com',
  'yating8697@gmail.com',
  'anniechang0719@gmail.com',
  'feiafei@gmail.com'
]

export function isApprovedTeacher(email) {
  if (!email) return false
  return TEACHER_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase())
}
