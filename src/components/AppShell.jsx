import { useState } from 'react'
import styles from './AppShell.module.css'

import Dashboard       from '../pages/teacher/Dashboard'
import Schedule        from '../pages/teacher/Schedule'
import Packages        from '../pages/teacher/Packages'
import Roster          from '../pages/teacher/Roster'
import Configuration   from '../pages/teacher/Configuration'
import TeacherPayments from '../pages/teacher/Payments'

import StudentDashboard  from '../pages/student/Dashboard'
import StudentSchedule   from '../pages/student/Schedule'
import StudentMyClasses  from '../pages/student/MyClasses'
import StudentHub        from '../pages/student/Hub'

const TEACHER_NAV = [
  { section:'Overview' },
  { id:'tdash',     label:'Dashboard',       shortLabel:'Home',     icon:'ti-layout-dashboard' },
  { id:'tschedule', label:'Schedule',         shortLabel:'Schedule', icon:'ti-calendar' },
  { id:'troster',   label:'Student roster',   shortLabel:'Roster',   icon:'ti-users' },
  { section:'Students' },
  { id:'tpackages', label:'Student packages', shortLabel:'Packages', icon:'ti-package' },
  { section:'Admin' },
  { id:'tpayments', label:'Payments',         shortLabel:'Payments', icon:'ti-credit-card' },
  { id:'tconfig',   label:'Configuration',    shortLabel:'Config',   icon:'ti-settings' },
]

const PAGE_TITLES = {
  tdash:'Dashboard', tschedule:'Schedule',
  troster:'Student roster', tpackages:'Student packages',
  tpayments:'Payments', tconfig:'Configuration',
  sdash:'Dashboard', sschedule:'Schedule', smyclasses:'My classes', shub:'Payments',
}

export default function AppShell(props) {
  const { user, onLogout, pendingPayments, teacherLeaves, cart } = props
  const isTeacher = user.role==='teacher'
  const [page, setPageRaw] = useState(isTeacher ? 'tdash' : 'sdash')
  function setPage(p) { setPageRaw(p); window.scrollTo({ top: 0, behavior: 'instant' }) }

  const pendingPay = (pendingPayments||[]).filter(p=>p.status==='pending').length
  const cartLen    = (cart||[]).length

  const teacherNav = TEACHER_NAV.map(item => {
    if (item.id==='tpayments' && pendingPay>0) return {...item, badge:pendingPay}
    return item
  })
  const studentNav = [
    { section:'Main' },
    { id:'sdash',      label:'Dashboard',         shortLabel:'Home',     icon:'ti-layout-dashboard' },
    { id:'sschedule',  label:'Schedule',   shortLabel:'Schedule',  icon:'ti-calendar' },
    { id:'smyclasses', label:'My classes', shortLabel:'Classes',  icon:'ti-clipboard-list' },
    { section:'My Account' },
    { id:'shub',       label:'Payments',  shortLabel:'Payments', icon:'ti-credit-card', badge:cartLen||null },
  ]

  const nav = isTeacher ? teacherNav : studentNav
  // Bottom nav only shows actual page items (no section headers)
  const navItems = nav.filter(item => item.id)

  const TEACHER_PAGES = {
    tdash:Dashboard, tschedule:Schedule,
    tpackages:Packages, troster:Roster,
    tconfig:Configuration, tpayments:TeacherPayments,
  }
  const STUDENT_PAGES = {
    sdash:StudentDashboard, sschedule:StudentSchedule,
    smyclasses:StudentMyClasses, shub:StudentHub,
  }

  const PageComponent = (isTeacher ? TEACHER_PAGES : STUDENT_PAGES)[page]
  const pageProps = { ...props, navigate:setPage }

  return (
    <div className={styles.shell}>
      {/* ── Desktop sidebar ──────────────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <div className={styles.logoMark}>
            <span className={styles.ly}>Y</span><span className={styles.lou}>ou</span><span className={styles.lt}>topia</span>
          </div>
          <div className={styles.logoSub}>Dance Academy</div>
        </div>
        <nav className={styles.nav}>
          {nav.map((item,i) => item.section
            ? <div key={i} className={styles.navSection}>{item.section}</div>
            : <button key={item.id} className={`${styles.navItem} ${page===item.id?styles.navActive:''}`} onClick={()=>setPage(item.id)}>
                <i className={`ti ${item.icon}`} />
                {item.label}
                {item.badge ? <span className={styles.navBadge}>{item.badge}</span> : null}
              </button>
          )}
        </nav>
        <div className={styles.navBottom}>
          <button className={styles.navItem} onClick={onLogout}><i className="ti ti-logout" /> Sign out</button>
        </div>
      </aside>

      <div className={styles.main}>
        {/* ── Top bar ──────────────────────────────────────── */}
        <header className={styles.topbar}>
          {/* Mobile: logo; Desktop: page title */}
          <div className={styles.topbarLogo}>
            <span className={styles.topbarLogoY}>Y</span>
            <span className={styles.topbarLogoOu}>ou</span>
            <span className={styles.topbarLogoT}>topia</span>
          </div>
          <span className={styles.pageTitle}>{PAGE_TITLES[page]||''}</span>

          <div className={styles.topbarRight}>
            {!isTeacher && cartLen>0 && (
              <button onClick={()=>setPage('shub')} style={{display:'flex',alignItems:'center',gap:6,background:'#E8401A',color:'#fff',border:'none',borderRadius:20,padding:'4px 12px',fontSize:12,cursor:'pointer',fontFamily:'var(--font)'}}>
                <i className="ti ti-shopping-cart" /> {cartLen}
              </button>
            )}
            {isTeacher && pendingPay>0 && (
              <button onClick={()=>setPage('tpayments')} style={{display:'flex',alignItems:'center',gap:6,background:'rgba(232,64,26,0.1)',color:'#c93515',border:'1px solid rgba(232,64,26,0.3)',borderRadius:20,padding:'4px 12px',fontSize:12,cursor:'pointer',fontFamily:'var(--font)'}}>
                <i className="ti ti-bell" /> {pendingPay}
              </button>
            )}
            <span className={`${styles.roleBadge} ${isTeacher?styles.roleTeacher:styles.roleStudent}`}>
              {isTeacher?'Teacher':'Student'}
            </span>
            {user.avatar
              ? <img src={user.avatar} alt={user.name} className={styles.avatar} style={{objectFit:'cover'}} />
              : <div className={styles.avatar} style={{background:isTeacher?'#E8401A':'#F5B800'}}>{user.initials}</div>
            }
            {/* Mobile sign out via avatar long-press area */}
            <button
              className={styles.navItem}
              onClick={onLogout}
              style={{display:'none'}}
              id="mobile-signout"
            />
          </div>
        </header>

        {/* ── Page content ─────────────────────────────────── */}
        <main className={styles.content}>
          {PageComponent ? <PageComponent {...pageProps} /> : null}
        </main>
      </div>

      {/* ── Mobile bottom tab bar ────────────────────────────── */}
      <nav className={styles.bottomNav}>
        <div className={styles.bottomNavInner}>
          {navItems.map(item => (
            <button
              key={item.id}
              className={`${styles.bottomNavItem} ${page===item.id ? styles.bottomNavActive : ''}`}
              onClick={() => setPage(item.id)}
            >
              <i className={`ti ${item.icon}`} />
              <span>{item.shortLabel || item.label}</span>
              {item.badge ? <span className={styles.bottomNavBadge}>{item.badge}</span> : null}
            </button>
          ))}
          <button className={styles.bottomNavItem} onClick={onLogout}>
            <i className="ti ti-logout" />
            <span>Sign out</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
