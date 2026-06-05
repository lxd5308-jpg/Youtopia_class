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
  const [role, setRole]           = useState(() => localStorage.getItem('pendingLoginRole') || 'student')
  const [loading, setLoading]     = useState(false)
  const [redirecting, setRedirecting] = useState(!!localStorage.getItem('pendingLoginRole'))
  const [error, setError]         = useState('')

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
        if (!result) { setRedirecting(false); return }
        const savedRole = localStorage.getItem('pendingLoginRole') || 'student'
        localStorage.removeItem('pendingLoginRole')
        processRedirectUser(result.user, savedRole)
      })
      .catch(err => {
        setRedirecting(false)
        if (err.code === 'auth/unauthorized-domain') {
          setError('This domain is not authorized for sign-in. Please contact the admin.')
        } else {
          setError('Sign-in failed (' + (err.code || err.message) + '). Please try again.')
        }
      })
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

  if (isWeChat()) return <WeChatOverlay />

  if (redirecting) return (
    <div style={{position:'fixed',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#fff',gap:16,fontFamily:'system-ui,sans-serif'}}>
      <div style={{fontSize:28,fontWeight:800,color:'#E8401A'}}>Youtopia</div>
      <div style={{fontSize:13,color:'#888',marginBottom:8}}>Dance Academy</div>
      <svg style={{animation:'spin 1s linear infinite'}} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E8401A" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 1 0 10 10" /></svg>
      <div style={{fontSize:14,color:'#555'}}>Completing sign-in…</div>
    </div>
  )

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
