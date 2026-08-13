import { doc, getDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { isApprovedTeacher } from '../config'

// Verifies an email is allowed to sign in as Teacher.
// Re-fetches the Firestore list so the check uses the current allow-list
// rather than a stale in-memory copy. Must be called AFTER the user is
// authenticated (the settings doc is not publicly readable).
// `fallbackEmails` is used only if the fetch fails.
export async function verifyTeacherAccess(email, fallbackEmails = []) {
  if (!email) return false
  if (isApprovedTeacher(email)) return true

  let currentEmails = fallbackEmails
  try {
    const snap = await getDoc(doc(db, 'settings', 'main'))
    if (snap.exists() && snap.data().teacherEmails?.length) {
      currentEmails = snap.data().teacherEmails
    }
  } catch {}

  return currentEmails.map(e => e.toLowerCase()).includes(email.toLowerCase())
}
