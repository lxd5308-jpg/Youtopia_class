import { useState } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import { isApprovedTeacher } from '../config'

export default function PublicPage({ classes = [], onLogin, teacherEmails = [] }) {
  const [showModal, setShowModal] = useState(false)
  const [role,      setRole]      = useState('student')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  function openModal(defaultRole = 'student') {
    setRole(defaultRole)
    setError('')
    setShowModal(true)
  }

  function checkTeacherAccess(email) {
    if (isApprovedTeacher(email)) return true
    return teacherEmails.map(e => e.toLowerCase()).includes((email || '').toLowerCase())
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

        if (role === 'teacher' && !checkTeacherAccess(profile.email)) {
          setError(
            'This account is not registered as a teacher. ' +
            'Please sign in as a Student, or contact the academy to request teacher access.'
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
        setShowModal(false)
      } catch {
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

  // Group classes by category
  const groups = [
    { label: '🧒 Kids Classes',        key: 'kids',        items: classes.filter(c => c.category === 'kids') },
    { label: '💃 Adult Classes',        key: 'adult',       items: classes.filter(c => c.category === 'adult') },
    { label: '🏆 Competition Classes',  key: 'competition', items: classes.filter(c => c.category === 'competition' || c.category === 'comp') },
  ].filter(g => g.items.length > 0)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background-primary)' }}>

      {/* ── Sticky header ─────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border-secondary)',
        padding: '0 var(--sp-lg)', height: 56,
        display: 'flex', alignItems: 'center', gap: 'var(--sp-md)',
      }}>
        {/* Logo */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.5px', lineHeight: 1 }}>
            <span style={{ color: '#E8401A' }}>Y</span>
            <span style={{ color: 'var(--color-text-primary)' }}>ou</span>
            <span style={{ color: '#E8401A' }}>topia</span>
          </span>
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 400 }}>
            Dance Academy
          </span>
        </div>

        {/* Teacher portal link */}
        <button
          className="btn"
          style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}
          onClick={() => openModal('teacher')}
        >
          <i className="ti ti-chalkboard" style={{ marginRight: 5 }} />
          Teacher Portal
        </button>

        {/* Student sign-in */}
        <button
          className="btn btn-p"
          style={{ fontSize: 13 }}
          onClick={() => openModal('student')}
        >
          <i className="ti ti-login" style={{ marginRight: 5 }} />
          Sign In
        </button>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(232,64,26,0.07) 0%, rgba(244,123,32,0.04) 100%)',
        borderBottom: '1px solid var(--color-border-tertiary)',
        padding: 'var(--sp-xl) var(--sp-lg)',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 10, lineHeight: 1.2 }}>
            Welcome to Youtopia Dance Academy
          </div>
          <div style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', marginBottom: 'var(--sp-lg)', lineHeight: 1.7 }}>
            Browse our current class schedule below.{' '}
            Sign in to enroll, make payments, and manage your account.
          </div>
          <button
            className="btn btn-p"
            style={{ fontSize: 15, padding: '10px 30px' }}
            onClick={() => openModal('student')}
          >
            <i className="ti ti-login" style={{ marginRight: 6 }} />
            Sign in to enroll
          </button>
        </div>
      </div>

      {/* ── Class schedule ────────────────────────────────────────── */}
      <div style={{ maxWidth: 920, margin: '0 auto', padding: 'var(--sp-lg)' }}>
        {classes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-xl)', color: 'var(--color-text-secondary)' }}>
            <i className="ti ti-calendar-off" style={{ fontSize: 36, display: 'block', marginBottom: 10, opacity: .4 }} />
            No classes are listed yet.
          </div>
        ) : groups.map(group => (
          <div key={group.key} style={{ marginBottom: 'var(--sp-xl)' }}>
            {/* Group heading */}
            <div style={{
              fontSize: 17, fontWeight: 600,
              marginBottom: 'var(--sp-md)',
              paddingBottom: 10,
              borderBottom: '2px solid var(--color-border-secondary)',
              color: 'var(--color-text-primary)',
            }}>
              {group.label}
            </div>

            {/* Class cards grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 'var(--sp-md)',
            }}>
              {group.items.map(cls => (
                <div key={cls.id} className="card" style={{ margin: 0 }}>
                  {/* Class name + dot */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                    <span
                      className="dot"
                      style={{ background: cls.color || '#E8401A', marginTop: 5, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--fs-body)', lineHeight: 1.3 }}>{cls.name}</div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', marginTop: 3 }}>
                        {cls.days}{cls.time ? ` · ${cls.time}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Details grid */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'auto 1fr',
                    gap: '3px 14px', fontSize: 'var(--fs-xs)',
                    marginBottom: 14,
                  }}>
                    {cls.instructor && <>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Instructor</span>
                      <span style={{ color: 'var(--color-text-primary)' }}>{cls.instructor}</span>
                    </>}
                    {cls.duration && <>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Duration</span>
                      <span style={{ color: 'var(--color-text-primary)' }}>{cls.duration}</span>
                    </>}
                    {cls.fee != null && <>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Fee</span>
                      <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>${cls.fee} / semester</span>
                    </>}
                    {cls.sessions != null && <>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Sessions</span>
                      <span style={{ color: 'var(--color-text-primary)' }}>{cls.sessions}</span>
                    </>}
                  </div>

                  <button
                    className="btn"
                    style={{ width: '100%', fontSize: 12 }}
                    onClick={() => openModal('student')}
                  >
                    <i className="ti ti-login" style={{ marginRight: 5 }} />
                    Sign in to enroll
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Login modal ───────────────────────────────────────────── */}
      {showModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--r-lg)',
            padding: 'var(--sp-xl)',
            width: '100%', maxWidth: 380,
            boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
            position: 'relative',
            margin: 'var(--sp-md)',
          }}>
            {/* Close button */}
            <button
              onClick={() => setShowModal(false)}
              style={{
                position: 'absolute', top: 14, right: 14,
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 20, color: 'var(--color-text-secondary)',
                lineHeight: 1, padding: 4,
              }}
            >
              <i className="ti ti-x" />
            </button>

            {/* Modal logo */}
            <div style={{ textAlign: 'center', marginBottom: 'var(--sp-md)' }}>
              <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.5px' }}>
                <span style={{ color: '#E8401A' }}>Y</span>
                <span style={{ color: 'var(--color-text-primary)' }}>ou</span>
                <span style={{ color: '#E8401A' }}>topia</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>Dance Academy</div>
            </div>

            <div style={{ fontWeight: 600, fontSize: 18, textAlign: 'center', marginBottom: 4 }}>Sign in</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)', textAlign: 'center', marginBottom: 'var(--sp-md)' }}>
              Choose your role to continue
            </div>

            {/* Role toggle */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-md)' }}>
              {[
                { r: 'student', icon: 'ti-user',        name: 'Student',  sub: 'Enroll & track' },
                { r: 'teacher', icon: 'ti-chalkboard',  name: 'Teacher',  sub: 'Manage classes' },
              ].map(({ r, icon, name, sub }) => (
                <button
                  key={r}
                  onClick={() => { setRole(r); setError('') }}
                  style={{
                    padding: 'var(--sp-md)',
                    borderRadius: 'var(--r-md)',
                    border: `2px solid ${role === r ? '#E8401A' : 'var(--color-border-secondary)'}`,
                    background: role === r ? 'rgba(232,64,26,0.06)' : 'var(--color-background-secondary)',
                    cursor: 'pointer', textAlign: 'center',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <i
                    className={`ti ${icon}`}
                    style={{ fontSize: 22, display: 'block', marginBottom: 5, color: role === r ? '#E8401A' : 'var(--color-text-secondary)' }}
                  />
                  <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', color: role === r ? '#E8401A' : 'var(--color-text-primary)' }}>{name}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>{sub}</div>
                </button>
              ))}
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: 'rgba(226,75,74,0.08)', border: '0.5px solid rgba(226,75,74,0.3)',
                borderRadius: 'var(--r-sm)', padding: 'var(--sp-sm) var(--sp-md)',
                fontSize: 'var(--fs-sm)', color: '#791F1F', marginBottom: 'var(--sp-sm)', lineHeight: 1.5,
              }}>
                <i className="ti ti-alert-circle" style={{ marginRight: 5 }} />{error}
              </div>
            )}

            {/* Google button */}
            <button
              onClick={() => { setError(''); googleLogin() }}
              disabled={loading}
              style={{
                width: '100%', padding: '11px 16px',
                borderRadius: 'var(--r-md)',
                border: '1.5px solid var(--color-border-secondary)',
                background: 'var(--color-surface)',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)',
                opacity: loading ? 0.7 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {loading
                ? <><i className="ti ti-loader-2" style={{ animation: 'spin 1s linear infinite' }} /> Signing in…</>
                : <><i className="ti ti-brand-google" style={{ color: '#E8401A', fontSize: 18 }} /> Continue with Google</>
              }
            </button>

            {role === 'teacher' && (
              <p style={{ marginTop: 'var(--sp-sm)', fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
                Teacher access requires an approved account.{' '}
                <a href="mailto:info@youtopiadanceacademy.com" style={{ color: '#E8401A' }}>Request access</a>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
