import { useState, useEffect } from 'react'
import { auth } from '../config/firebase'
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth'
import { isApprovedTeacher } from '../config'
import styles from './LoginPage.module.css'

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

function isWeChat() {
  return /MicroMessenger/i.test(navigator.userAgent)
}

export default function LoginPage({ onLogin, teacherEmails=[] }) {
  const [role, setRole]       = useState(() => localStorage.getItem('pendingLoginRole') || 'student')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  function checkTeacherAccess(email) {
    if (isApprovedTeacher(email)) return true
    return teacherEmails.map(e => e.toLowerCase()).includes((email||'').toLowerCase())
  }

  function processRedirectUser(fbUser, loginRole) {
    if (loginRole === 'teacher' && !checkTeacherAccess(fbUser.email)) {
      auth.signOut()
      setError(
        'This account is not registered as a teacher. ' +
        'Please sign in as a Student, or contact the academy admin to request teacher access.'
      )
      return
    }
    const initials = fbUser.displayName
      ? fbUser.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
      : fbUser.email.slice(0, 2).toUpperCase()
    onLogin({ role: loginRole, name: fbUser.displayName || fbUser.email, initials, email: fbUser.email, avatar: fbUser.photoURL, provider: 'google' })
  }

  // Handle the result when Google redirects back to the app (mobile flow)
  useEffect(() => {
    getRedirectResult(auth)
      .then(result => {
        if (!result) return
        const savedRole = localStorage.getItem('pendingLoginRole') || 'student'
        localStorage.removeItem('pendingLoginRole')
        processRedirectUser(result.user, savedRole)
      })
      .catch(() => setError('Sign-in failed. Please try again.'))
  }, []) // eslint-disable-line

  async function handleGoogleLogin() {
    setLoading(true)
    setError('')
    try {
      const provider = new GoogleAuthProvider()
      if (isMobile()) {
        localStorage.setItem('pendingLoginRole', role)
        await signInWithRedirect(auth, provider)
        return  // browser navigates away; code below won't run
      }
      const result = await signInWithPopup(auth, provider)
      const fbUser = result.user

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

        {isWeChat() && (
          <div className={styles.errorMsg}>
            <i className="ti ti-alert-circle" /> Google sign-in is not supported in WeChat.
            Please tap <strong>···</strong> (top-right) and choose <strong>Open in Browser</strong>.
          </div>
        )}

        {!isWeChat() && error && (
          <div className={styles.errorMsg}>
            <i className="ti ti-alert-circle" /> {error}
          </div>
        )}

        <button
          className={styles.authBtn}
          onClick={handleGoogleLogin}
          disabled={loading || isWeChat()}
        >
          {loading
            ? <><i className="ti ti-loader-2" style={{animation:'spin 1s linear infinite'}} /> Signing in…</>
            : <><i className="ti ti-brand-google" style={{color:'#E8401A'}} aria-hidden="true" /> Continue with Google</>
          }
        </button>

        <p className={styles.footer}>
          Teacher access requires an approved account.{' '}
          <a href="mailto:yating8697@gmail.com">Request teacher access</a>
        </p>
      </div>
    </div>
  )
}
