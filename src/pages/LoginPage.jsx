import { useState } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import { isApprovedTeacher } from '../config'
import styles from './LoginPage.module.css'

export default function LoginPage({ onLogin, teacherEmails=[] }) {
  const [role, setRole]     = useState('student')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  // Check both hardcoded config emails AND dynamically added emails from teacher portal
  function checkTeacherAccess(email) {
    if (isApprovedTeacher(email)) return true
    return teacherEmails.map(e => e.toLowerCase()).includes((email||'').toLowerCase())
  }

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        if (!res.ok) throw new Error('Failed to fetch profile')
        const profile = await res.json()

        // ── Teacher access control ──────────────────────────
        if (role === 'teacher' && !checkTeacherAccess(profile.email)) {
          setError(
            'This account is not registered as a teacher. ' +
            'Please sign in as a Student, or contact the academy admin to request teacher access.'
          )
          setLoading(false)
          return
        }

        const initials = profile.name
          ? profile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
          : profile.email.slice(0, 2).toUpperCase()

        onLogin({
          role,
          name:     profile.name || profile.email,
          initials,
          email:    profile.email,
          avatar:   profile.picture,
          provider: 'google',
        })
      } catch (err) {
        setError('Could not load your Google profile. Please try again.')
      } finally {
        setLoading(false)
      }
    },
    onError: () => {
      setError('Google sign-in was cancelled or failed. Please try again.')
      setLoading(false)
    },
  })

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
          onClick={() => { setError(''); googleLogin() }}
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
