// ── Teacher access control ────────────────────────────────────
// Only these Google emails can sign in as Teacher.
// Bootstrap list only. Everyone else is managed at runtime in
// Configuration → Teacher portal access (settings/main.teacherEmails).
export const TEACHER_EMAILS = [
  'info@youtopiadanceacademy.com',
  'summerli634@gmail.com',
  'yating8697@gmail.com'
]

export function isApprovedTeacher(email) {
  if (!email) return false
  return TEACHER_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase())
}
