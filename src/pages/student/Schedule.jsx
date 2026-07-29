import { CATEGORY_LABELS } from '../../data/mockData'

const DAY_ORDER = ['周一 Mon','周二 Tue','周三 Wed','周四 Thu','周五 Fri','周六 Sat','周日 Sun','Any']

export default function Schedule({
  classes=[], cart=[], setCart,
  enrolled=[], pendingEnroll=[],
  navigate, user, studentName, signUpForClasses,
  addClassToCart, addPackToCart,
}) {
  const cartIds     = new Set(cart.map(i => i.classId))
  const enrolledIds = new Set(enrolled)
  const pendingIds  = new Set(pendingEnroll || [])

  function addToCart(cls) {
    if (cartIds.has(cls.id) || enrolledIds.has(cls.id) || pendingIds.has(cls.id)) return
    if (addClassToCart) {
      addClassToCart(cls)
    } else {
      // fallback
      setCart(c => [...c, { classId:cls.id, packageType:'full' }])
      if (signUpForClasses) signUpForClasses([cls.id])
    }
  }

  const grouped = {}
  classes.forEach(c => {
    const cat = c.category || 'kids'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(c)
  })
  Object.keys(grouped).forEach(cat =>
    grouped[cat].sort((a, b) => DAY_ORDER.indexOf(a.days) - DAY_ORDER.indexOf(b.days))
  )

  return (
    <>
      {/* ── Available classes ─────────────────────────────── */}
      {classes.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'var(--sp-lg)' }}>
          <i className="ti ti-calendar-off" style={{ fontSize:36, display:'block', marginBottom:'var(--sp-sm)', opacity:.4, color:'var(--color-text-secondary)' }} />
          <div style={{ fontSize:'var(--fs-body)', fontWeight:500, marginBottom:8 }}>No classes available yet</div>
          <div style={{ fontSize:'var(--fs-sm)', color:'var(--color-text-secondary)' }}>Check back soon or contact the studio.</div>
        </div>
      ) : Object.entries(grouped).map(([cat, cls]) => (
        <div className="card" key={cat}>
          <div className="card-hdr">
            <span className="card-title">{CATEGORY_LABELS[cat] || cat}</span>
            <span style={{ fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)' }}>{cls.length} classes</span>
          </div>
          {cls.map(c => {
            const isEnrolled = enrolledIds.has(c.id)
            const inCart     = cartIds.has(c.id)
            const isPending  = pendingIds.has(c.id)
            const cartPkg    = inCart ? (cart.find(i => i.classId === c.id)?.packageType || 'full') : null
            const PKG_LABEL  = { full:'Full semester', '10pack':'10-class pack', dropin:'Drop-in' }
            return (
              <div className="row" key={c.id} style={{ gap:12 }}>
                <span className="dot" style={{ background:c.color }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'var(--fs-body)', fontWeight:500 }}>{c.name}</div>
                  <div style={{ fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', marginTop:2 }}>
                    {c.days} · {c.time} · {c.duration} · 👤 {c.instructor}
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:'var(--fs-sm)', fontWeight:500 }}>${c.fee}<span style={{ fontWeight:400, color:'var(--color-text-secondary)' }}>/session</span></div>
                  <div style={{ fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)' }}>{c.sessions} sessions · ${c.fee * c.sessions} total</div>
                </div>
                {isEnrolled
                  ? <span className="pill pill-ok">Enrolled</span>
                  : isPending
                    ? <span className="pill pill-warn">Pending</span>
                    : inCart
                      ? <button className="btn" style={{ fontSize:11, padding:'4px 10px', color:'#E8401A', borderColor:'#E8401A', lineHeight:1.3 }} onClick={() => navigate('shub')}>
                          <i className="ti ti-shopping-cart" /> In cart
                          <div style={{ fontSize:9, opacity:.8 }}>{PKG_LABEL[cartPkg]}</div>
                        </button>
                      : <button className="btn btn-p" style={{ fontSize:11, padding:'4px 10px' }} onClick={() => addToCart(c)}>
                          <i className="ti ti-plus" /> Sign up
                        </button>
                }
              </div>
            )
          })}
        </div>
      ))}

      {/* ── Packages & Drop-in ───────────────────────────── */}
      <div className="card">
        <div className="card-hdr"><span className="card-title">Packages</span></div>

        {/* 10-session pack */}
        {(() => {
          const inCart = cart.some(i => i.classId === '__10pack__')
          return (
            <div className="row" style={{ gap:12 }}>
              <span className="dot" style={{ background:'#F5B800' }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'var(--fs-body)', fontWeight:500 }}>10-hour pack</div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:'var(--fs-sm)', fontWeight:500 }}>fee × 10</div>
                <div style={{ fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)' }}>e.g. $380 adult</div>
              </div>
              {inCart
                ? <button className="btn" style={{ fontSize:11, padding:'4px 10px', color:'#E8401A', borderColor:'#E8401A' }} onClick={() => navigate('shub')}>
                    <i className="ti ti-shopping-cart" /> In cart
                  </button>
                : <button className="btn btn-p" style={{ fontSize:11, padding:'4px 10px' }} onClick={() => {
                    if (addPackToCart) addPackToCart(); else setCart(c => [...c, { classId:'__10pack__', packageType:'10pack' }])
                    navigate('shub')
                  }}>
                    <i className="ti ti-plus" /> Sign up
                  </button>
              }
            </div>
          )
        })()}

      </div>

      {/* ── Private Lessons ───────────────────────────────── */}
      <div className="card">
        <div className="card-hdr"><span className="card-title">Private lessons</span></div>
        <div className="row"><span style={{ flex:1 }}>1-person private lesson</span><span style={{ fontWeight:500 }}>$120 / hr</span></div>
        <div className="row"><span style={{ flex:1 }}>2-person private lesson</span><span style={{ fontWeight:500 }}>$160 / hr</span></div>
        <div className="row"><span style={{ flex:1 }}>3-person private lesson</span><span style={{ fontWeight:500 }}>$180 / hr</span></div>
        <div className="row"><span style={{ flex:1 }}>Choreography (编舞)</span><span style={{ fontWeight:500 }}>+$300 one-time</span></div>
        <div className="row"><span style={{ flex:1 }}>Studio rental</span><span style={{ fontWeight:500 }}>$70 / hr</span></div>
        <div style={{ marginTop:'var(--sp-sm)', background:'rgba(24,95,165,0.06)', border:'0.5px solid rgba(24,95,165,0.2)', borderRadius:'var(--r-sm)', padding:'var(--sp-sm) var(--sp-md)', fontSize:'var(--fs-xs)', color:'#0C447C', lineHeight:1.6 }}>
          <i className="ti ti-info-circle" /> Contact the studio to book private lessons:{' '}
          <strong>info@youtopiadanceacademy.com</strong>
        </div>
      </div>

      {/* ── Cart bar ──────────────────────────────────────── */}
      {cart.length > 0 && (
        <div
          style={{ position:'sticky', bottom:0, background:'#E8401A', color:'#fff', borderRadius:'var(--r-md)', padding:'var(--sp-md) var(--sp-lg)', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', boxShadow:'0 4px 16px rgba(232,64,26,0.35)' }}
          onClick={() => navigate('shub')}
        >
          <div>
            <div style={{ fontWeight:500 }}>🛒 {cart.length} item{cart.length > 1 ? 's' : ''} in cart</div>
            <div style={{ fontSize:'var(--fs-xs)', opacity:.85 }}>Click to review and checkout</div>
          </div>
          <i className="ti ti-arrow-right" style={{ fontSize:20 }} />
        </div>
      )}
    </>
  )
}
