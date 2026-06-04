import { useState } from 'react'
import { auth } from '../config/firebase'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { isApprovedTeacher } from '../config'
import styles from './LoginPage.module.css'

export default function LoginPage({ onLogin, teacherEmails=[] }) {
  const [role, setRole]       = useState('student')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  function checkTeacherAccess(email) {
    if (isApprovedTeacher(email)) return true
    return teacherEmails.map(e => e.toLowerCase()).includes((email||'').toLowerCase())
  }

  async function handleGoogleLogin() {
    setLoading(true)
    setError('')
    try {
      const provider = new GoogleAuthProvider()
      const result   = await signInWithPopup(auth, provider)
      const fbUser   = result.user

      if (role === 'teacher' && !checkTeacherAccess(fbUser.email)) {
        await auth.signOut()
        setError(
          'This account is not registered as a teacher. ' +
          'Please sign in as a Student, or contact the academy admin to request teacher access.'
        )
        setLoading(false)
        return
      }

      const initials = fbUser.displayName
        ? fbUser.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
        : fbUser.email.slice(0, 2).toUpperCase()

      onLogin({
        role,
        name:     fbUser.displayName || fbUser.email,
        initials,
        email:    fbUser.email,
        avatar:   fbUser.photoURL,
        provider: 'google',
      })
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setError('Sign-in failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <div className={styles.logoMark}>
            <span className={styles.ly}>Y</span>
            <span className={styles.lou}>ou</span>
            <span className={styles.lt}>topia</span>
          </div>
          <div className={styles.logoSub}>Dance Academy</div>
        </div>

        <h1 className={styles.heading}>Welcome back</h1>
        <p className={styles.sub}>Sign in to manage your classes</p>

        <div className={styles.roleSection}>
          <div className={styles.roleLabel}>I am signing in as a:</div>
          <div className={styles.roleRow}>
            <button
              className={`${styles.roleCard} ${role === 'teacher' ? styles.roleSel : ''}`}
              onClick={() => { setRole('teacher'); setError('') }}
            >
              <i className="ti ti-chalkboard" aria-hidden="true" />
              <div className={styles.roleName}>Teacher</div>
              <div className={styles.roleSub}>Manage classes</div>
            </button>
            <button
              className={`${styles.roleCard} ${role === 'student' ? styles.roleSel : ''}`}
              onClick={() => { setRole('student'); setError('') }}
            >
              <i className="ti ti-user" aria-hidden="true" />
              <div className={styles.roleName}>Student</div>
              <div className={styles.roleSub}>Enroll &amp; track</div>
            </button>
          </div>
        </div>

        {error && (
          <div className={styles.errorMsg}>
            <i className="ti ti-alert-circle" /> {error}
          </div>
        )}

        <button
          className={styles.authBtn}
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          {loading
            ? <><i className="ti ti-loader-2" style={{animation:'spin 1s linear infinite'}} /> Signing in…</>
            : <><i className="ti ti-brand-google" style={{color:'#E8401A'}} aria-hidden="true" /> Continue with Google</>
          }
        </button>

        <p className={styles.footer}>
          Teacher access requires an approved account.{' '}
          <a href="mailto:info@youtopiadanceacademy.com">Request teacher access</a>
        </p>
      </div>
    </div>
  )
}
