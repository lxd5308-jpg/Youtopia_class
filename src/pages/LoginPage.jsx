import { useState, useEffect, useRef } from 'react'
import { auth } from '../config/firebase'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}
import { isApprovedTeacher } from '../config'
import { verifyTeacherAccess } from '../utils/teacherAccess'
import styles from './LoginPage.module.css'

function isWeChat() {
  return /MicroMessenger/i.test(navigator.userAgent)
}

function isInAppBrowser() {
  const ua = navigator.userAgent
  return /MicroMessenger|FBAV|FBAN|Instagram|Line|Snapchat|Twitter|TikTok/i.test(ua)
}

// ── Full-screen WeChat overlay ────────────────────────────────
function WeChatOverlay() {
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
  return (
    <div style={{
      position:'fixed', inset:0, background:'#fff',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:'32px 24px', zIndex:9999, textAlign:'center', fontFamily:'system-ui, sans-serif',
    }}>
      {/* Logo */}
      <div style={{fontSize:28, fontWeight:800, color:'#E8401A', marginBottom:4, letterSpacing:'-0.5px'}}>
        Youtopia
      </div>
      <div style={{fontSize:13, color:'#888', marginBottom:32}}>Dance Academy</div>

      {/* Icon */}
      <div style={{width:64, height:64, borderRadius:'50%', background:'#FFF0ED', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20}}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#E8401A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </div>

      <div style={{fontSize:17, fontWeight:700, color:'#1a1a1a', marginBottom:8}}>
        请在浏览器中打开
      </div>
      <div style={{fontSize:13, color:'#555', marginBottom:28, lineHeight:1.7}}>
        微信内不支持 Google 登录。<br/>请按以下步骤用手机浏览器打开：
      </div>

      {/* Steps */}
      <div style={{width:'100%', maxWidth:300, textAlign:'left', display:'flex', flexDirection:'column', gap:14, marginBottom:32}}>
        <div style={{display:'flex', gap:12, alignItems:'flex-start'}}>
          <div style={{width:26, height:26, borderRadius:'50%', background:'#E8401A', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0}}>1</div>
          <div style={{fontSize:14, color:'#333', lineHeight:1.6}}>
            点击右上角 <strong style={{background:'#f0f0f0', padding:'1px 6px', borderRadius:4}}>···</strong> 按钮
          </div>
        </div>
        <div style={{display:'flex', gap:12, alignItems:'flex-start'}}>
          <div style={{width:26, height:26, borderRadius:'50%', background:'#E8401A', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0}}>2</div>
          <div style={{fontSize:14, color:'#333', lineHeight:1.6}}>
            选择 <strong>「在浏览器打开」</strong>
            {isIOS ? '（Safari）' : '（系统浏览器）'}
          </div>
        </div>
        <div style={{display:'flex', gap:12, alignItems:'flex-start'}}>
          <div style={{width:26, height:26, borderRadius:'50%', background:'#E8401A', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0}}>3</div>
          <div style={{fontSize:14, color:'#333', lineHeight:1.6}}>
            在浏览器中用 Google 账号登录即可 ✓
          </div>
        </div>
      </div>

      <div style={{fontSize:12, color:'#aaa', lineHeight:1.6}}>
        Open in browser · then sign in with Google
      </div>
    </div>
  )
}

export default function LoginPage({ onLogin, teacherEmails=[] }) {
  const [role, setRole]       = useState('student')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [showInAppOverlay, setShowInAppOverlay] = useState(false)

  const loadingRef = useRef(false)
  const settledRef = useRef(true)
  useEffect(() => { loadingRef.current = loading }, [loading])

  // ── Recover from an abandoned sign-in tab ──────────────────────
  // On iOS Safari signInWithPopup opens a real tab, not a floating popup.
  // If the user abandons it (closes it, hits back, or gets stranded on a
  // Google error page) the popup promise never settles, leaving the button
  // stuck on "Signing in…" forever. When the app regains focus with the
  // sign-in still unsettled and nobody authenticated, reset so they can retry.
  useEffect(() => {
    let timer = null
    function onReturn() {
      if (document.visibilityState !== 'visible') return
      if (!loadingRef.current || settledRef.current) return
      clearTimeout(timer)
      // Grace period: a successful popup can regain focus a moment before
      // its promise resolves. Only declare failure if nothing lands.
      timer = setTimeout(() => {
        if (!loadingRef.current || settledRef.current || auth.currentUser) return
        setLoading(false)
        setError('Sign-in didn’t finish. Please try again.')
      }, 2500)
    }
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('focus', onReturn)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onReturn)
      window.removeEventListener('focus', onReturn)
    }
  }, [])

  function checkTeacherAccess(email) {
    if (isApprovedTeacher(email)) return true
    return teacherEmails.map(e => e.toLowerCase()).includes((email||'').toLowerCase())
  }

  async function handleGoogleLogin() {
    setLoading(true)
    setError('')
    try {
      // In-app browsers (WeChat, Instagram, …) can't complete Google sign-in
      // at all, so show the "open in browser" overlay before even trying.
      if (isWeChat() || isInAppBrowser()) {
        setShowInAppOverlay(true)
        setLoading(false)
        return
      }

      const provider = new GoogleAuthProvider()
      settledRef.current = false   // armed for the recovery effect above
      const result   = await signInWithPopup(auth, provider)
      const fbUser   = result.user

      if (role === 'teacher' && !(await verifyTeacherAccess(fbUser.email, teacherEmails))) {
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

      if (isMobile()) {
        // Reload to clear any ghost overlay left by the Google popup.
        // Role is only stored AFTER the teacher check above has passed.
        localStorage.setItem('pendingLoginRole', role)
        window.location.reload()
        return
      }

      onLogin({
        role,
        name:     fbUser.displayName || fbUser.email,
        initials,
        email:    fbUser.email,
        avatar:   fbUser.photoURL,
        provider: 'google',
      })
    } catch (err) {
      if (err.code === 'auth/popup-blocked' || isInAppBrowser()) {
        setShowInAppOverlay(true)
        setLoading(false)
        return
      }
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setError('Sign-in failed (' + (err.code || 'unknown') + '). Please try again.')
      }
    } finally {
      settledRef.current = true
      setLoading(false)
    }
  }

  if (isWeChat() || showInAppOverlay) return <WeChatOverlay />

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
          <a href="mailto:yating8697@gmail.com">Request teacher access</a>
        </p>
      </div>
    </div>
  )
}
