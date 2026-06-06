// ── Teacher access control ────────────────────────────────────
// Only these Google emails can sign in as Teacher.
export const TEACHER_EMAILS = [
  'info@youtopiadanceacademy.com',
  'summerli634@gmail.com',
  'yating8697@gmail.com',
  'feiafei@gmail.com' // temp testing — remove before production
]

export function isApprovedTeacher(email) {
  if (!email) return false
  return TEACHER_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase())
}
