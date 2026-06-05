import { useState } from 'react'
import { SEMESTER, CATEGORY_LABELS } from '../../data/mockData'

// ── Pricing helpers ───────────────────────────────────────────
function calcPrice(cls, pkgType) {
  if (!cls) return 0
  if (pkgType === 'full')   return cls.fee * cls.sessions
  if (pkgType === '10pack') return cls.fee * 10
  if (pkgType === 'dropin') return cls.category === 'adult' ? 40 : cls.fee
  return 0
}

const PKG_LABELS = { full:'Full semester', '10pack':'10-hour pack', dropin:'Drop-in' }

const PAY_METHODS = [
  { value:'zelle', label:'Zelle', sub:'Youtopia Dance Academy, LLC',       icon:'Z', bg:'#6B38FB22', col:'#6B38FB' },
  { value:'check', label:'Check', sub:'Payable to: Youtopia Dance Academy', icon:'✎', bg:'#f0f0f0',  col:'#555'   },
  { value:'cash',  label:'Cash',  sub:'Pay in person at the studio',        icon:'$', bg:'#E1F5EE',  col:'#0F6E56'},
]


// Compress image to max 800px wide at 70% quality — keeps well under Firestore's 1MB doc limit
function compressImage(file) {
  return new Promise((resolve) => {
    // PDFs can't be compressed — read as-is (teacher sees filename only)
    if (file.type === 'application/pdf') {
      resolve({ name: file.name, dataUrl: null, type: file.type })
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const MAX = 800
        const scale  = img.width > MAX ? MAX / img.width : 1
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve({ name: file.name, dataUrl: canvas.toDataURL('image/jpeg', 0.7), type: 'image/jpeg' })
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}
// ─────────────────────────────────────────────────────────────
export default function Hub({
  user, navigate,
  classes = [],
  cart, setCart,
  enrolled = [],
  sessionPacks = [],
  logSession,
  paymentHistory = [],
  pendingPayments = [],
  setPendingPayments,
  setPaymentHistory,
  studentName,
  setPendingEnroll,
}) {
  const myPending = (pendingPayments || []).filter(p =>
    p.studentEmail === (user?.email || '') || p.studentName === (user?.name || '')
  )

  return (
    <CartTab user={user} studentName={studentName} cart={cart} setCart={setCart} classes={classes} myPending={myPending} setPendingPayments={setPendingPayments} setPaymentHistory={setPaymentHistory} navigate={navigate} setTab={() => {}} />
  )
}

// ─────────────────────────────────────────────────────────────
// CART TAB
// ─────────────────────────────────────────────────────────────
function CartTab({ user, studentName, cart, setCart, classes, myPending, setPendingPayments, setPaymentHistory, navigate, setTab }) {
  const [pkgTypes, setPkgTypes]     = useState(() => Object.fromEntries(cart.map(i => [i.classId, i.packageType || 'full'])))
  const [packAmount, setPackAmount] = useState('')   // custom amount for 10-hour pack
  const [payMethod, setPayMethod]   = useState('zelle')
  const [note, setNote]             = useState('')
  const [receiptFile, setReceiptFile] = useState(null)
  const [errors, setErrors]         = useState({})
  const [submitted, setSubmitted]   = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const has10Pack   = cart.some(i => i.classId === '__10pack__')
  const cartClasses = cart.map(item => ({
    ...item,
    cls:     classes.find(c => c.id === item.classId),
    pkgType: pkgTypes[item.classId] || 'full',
  })).filter(i => i.cls)

  const packAmountNum = has10Pack ? (Number(packAmount) || 0) : 0
  const total = cartClasses.reduce((s, i) => s + calcPrice(i.cls, i.pkgType), 0) + packAmountNum
  const cartEmpty = cartClasses.length === 0 && !has10Pack

  function updatePkg(classId, val) {
    setPkgTypes(p => ({ ...p, [classId]: val }))
    setCart(c => c.map(i => i.classId === classId ? { ...i, packageType: val } : i))
  }

  function removeItem(classId) {
    setCart(c => c.filter(i => i.classId !== classId))
    setPkgTypes(p => { const n = { ...p }; delete n[classId]; return n })
  }

  function validate() {
    const e = {}
    if (has10Pack && !packAmount) e.packAmount = 'Please enter the amount for the 10-hour pack.'
    if (!receiptFile) e.receipt = 'Please upload your payment receipt screenshot.'
    if (!note.trim()) e.note    = 'Please add a note with your name and class.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submitPayment() {
    if (submitting) return
    if (!validate()) return
    setSubmitting(true)
    try {
      const packItems = has10Pack ? [{ classId: '__10pack__', className: '10-hour pack', pkgType: '10pack', price: packAmountNum }] : []
      const submission = {
        id:           Date.now(),
        studentName:  studentName || user?.name  || 'Student',
        studentEmail: user?.email || '',
        items: [
          ...cartClasses.map(i => ({
            classId:   i.classId,
            className: i.cls.name,
            pkgType:   i.pkgType,
            price:     calcPrice(i.cls, i.pkgType),
          })),
          ...packItems,
        ],
        method:         payMethod,
        note:           note.trim(),
        receiptFile:    receiptFile?.name     || null,
        receiptDataUrl: receiptFile?.dataUrl  || null,
        total,
        status:      'pending',
        submittedAt: new Date().toLocaleString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' }),
      }
      setPendingPayments(p => [...p, submission])
      setCart([])
      setSubmitted(true)
    } catch (err) {
      console.error('Payment submission failed:', err)
      setErrors(e => ({ ...e, submit: 'Submission failed. Please try again.' }))
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="card" style={{textAlign:'center', padding:'var(--sp-lg)'}}>
        <div style={{fontSize:48, marginBottom:'var(--sp-md)'}}>📬</div>
        <div style={{fontSize:16, fontWeight:500, marginBottom:8}}>Payment submitted!</div>
        <div style={{fontSize:'var(--fs-sm)', color:'var(--color-text-secondary)', lineHeight:1.7, maxWidth:360, margin:'0 auto var(--sp-lg)'}}>
          Your payment is pending teacher confirmation. Once confirmed, your purchase will be activated.
        </div>
        <div style={{background:'var(--color-background-secondary)', borderRadius:'var(--r-sm)', padding:'var(--sp-md)', maxWidth:340, margin:'0 auto var(--sp-md)', textAlign:'left', fontSize:'var(--fs-sm)'}}>
          <div style={{fontWeight:500, marginBottom:'var(--sp-xs)'}}>What happens next:</div>
          <div style={{display:'flex', flexDirection:'column', gap:6, color:'var(--color-text-secondary)'}}>
            <div><i className="ti ti-check" style={{color:'#E8401A', marginRight:6}} />Receipt received</div>
            <div><i className="ti ti-clock" style={{color:'#F47B20', marginRight:6}} />Teacher reviews (usually within 24 hours)</div>
            <div><i className="ti ti-calendar" style={{color:'#0F6E56', marginRight:6}} />Purchase activated on your dashboard</div>
          </div>
        </div>
        <div style={{display:'flex', gap:'var(--sp-sm)', justifyContent:'center'}}>
          <button className="btn btn-p" onClick={() => navigate('sdash')}><i className="ti ti-home" /> Dashboard</button>
          <button className="btn" onClick={() => setSubmitted(false)}><i className="ti ti-receipt" /> View history</button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Cart items */}
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">{cartEmpty ? 'Cart is empty' : `Cart — ${cart.length} item${cart.length > 1 ? 's' : ''}`}</span>
          <button className="btn" onClick={() => navigate('sschedule')}><i className="ti ti-plus" /> Add classes</button>
        </div>

        {cartEmpty ? (
          <div style={{textAlign:'center', padding:'var(--sp-lg) 0', color:'var(--color-text-secondary)', fontSize:'var(--fs-sm)'}}>
            <i className="ti ti-shopping-cart-off" style={{fontSize:28, display:'block', marginBottom:8, opacity:.4}} />
            Your cart is empty. Go to <span style={{cursor:'pointer', color:'#E8401A', textDecoration:'underline'}} onClick={() => navigate('sschedule')}>Classes</span> to sign up.
          </div>
        ) : (
          <>
            {/* 10-hour pack item */}
            {has10Pack && (
              <div style={{padding:'var(--sp-md) 0', borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                <div style={{display:'flex', alignItems:'flex-start', gap:10, marginBottom:'var(--sp-sm)'}}>
                  <span className="dot" style={{background:'#F5B800', marginTop:5, flexShrink:0}} />
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:'var(--fs-body)', fontWeight:500}}>10-hour pack</div>
                    <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', marginTop:2}}>Enter the amount based on your class fee × 10</div>
                  </div>
                  <button onClick={() => { setCart(c => c.filter(i => i.classId !== '__10pack__')); setPackAmount('') }} style={{background:'none', border:'none', cursor:'pointer', color:'var(--color-text-secondary)', padding:'2px 4px', flexShrink:0}}>
                    <i className="ti ti-x" style={{fontSize:13}} />
                  </button>
                </div>
                <div style={{paddingLeft:17}}>
                  <label className="form-label">Amount <span style={{color:'#E8401A'}}>*</span></label>
                  <div style={{display:'flex', alignItems:'center', gap:'var(--sp-sm)'}}>
                    <div style={{position:'relative', width:140}}>
                      <span style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--color-text-secondary)'}}>$</span>
                      <input
                        type="number" min="0" value={packAmount}
                        onChange={e => { setPackAmount(e.target.value); setErrors(er => ({...er, packAmount:null})) }}
                        placeholder="e.g. 380"
                        style={{paddingLeft:22}}
                      />
                    </div>
                  </div>
                  {errors.packAmount && <div style={{fontSize:'var(--fs-xs)', color:'#E8401A', marginTop:4}}>{errors.packAmount}</div>}
                </div>
              </div>
            )}

            {cartClasses.map(item => {
              const p = calcPrice(item.cls, item.pkgType)
              return (
                <div key={item.classId} style={{padding:'var(--sp-md) 0', borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                  <div style={{display:'flex', alignItems:'flex-start', gap:10, marginBottom:'var(--sp-sm)'}}>
                    <span className="dot" style={{background:item.cls.color, marginTop:5, flexShrink:0}} />
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:'var(--fs-body)', fontWeight:500}}>{item.cls.name}</div>
                      <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', marginTop:2}}>
                        {item.cls.days} · {item.cls.time} · 👤 {item.cls.instructor}
                      </div>
                    </div>
                    <div style={{textAlign:'right', flexShrink:0}}>
                      <div style={{fontSize:15, fontWeight:500}}>${p}</div>
                      <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)'}}>{PKG_LABELS[item.pkgType]}</div>
                    </div>
                    <button onClick={() => removeItem(item.classId)} style={{background:'none', border:'none', cursor:'pointer', color:'var(--color-text-secondary)', padding:'2px 4px', flexShrink:0}}>
                      <i className="ti ti-x" style={{fontSize:13}} />
                    </button>
                  </div>
                  {/* Package type picker */}
                  <div style={{display:'flex', gap:'var(--sp-xs)', flexWrap:'wrap', paddingLeft:17}}>
                    {[{v:'full', l:'Full semester'}, ...(item.cls.category === 'adult' ? [{v:'dropin', l:'Drop-in'}] : [])].map(pt => {
                      const pp = calcPrice(item.cls, pt.v), sel = item.pkgType === pt.v
                      return (
                        <button key={pt.v} onClick={() => updatePkg(item.classId, pt.v)} style={{
                          border: sel ? '1.5px solid #E8401A' : '0.5px solid var(--color-border-secondary)',
                          background: sel ? 'rgba(232,64,26,0.06)' : 'transparent',
                          borderRadius:'var(--r-sm)', padding:'5px 10px', cursor:'pointer',
                          fontFamily:'var(--font)', fontSize:'var(--fs-xs)',
                          color: sel ? '#E8401A' : 'var(--color-text-primary)',
                          display:'flex', flexDirection:'column', gap:1,
                        }}>
                          <span style={{fontWeight:500}}>{pt.l}</span>
                          <span style={{color: sel ? '#E8401A' : 'var(--color-text-secondary)'}}>${pp}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            <div style={{display:'flex', justifyContent:'flex-end', paddingTop:'var(--sp-md)', gap:'var(--sp-md)'}}>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)'}}>Order total</div>
                <div style={{fontSize:20, fontWeight:500}}>{has10Pack && !packAmount ? '—' : `$${total}`}</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Payment section — only show if cart has items */}
      {!cartEmpty && (
        <div className="card">
          <div className="card-hdr"><span className="card-title">Payment</span></div>

          {/* Method */}
          <div style={{marginBottom:'var(--sp-md)'}}>
            <label className="form-label">Pay via</label>
            <div style={{display:'flex', gap:'var(--sp-sm)', marginTop:6, flexWrap:'wrap'}}>
              {PAY_METHODS.map(m => {
                const sel = payMethod === m.value
                return (
                  <button key={m.value} onClick={() => setPayMethod(m.value)} style={{
                    flex:'1 1 130px', border: sel ? '1.5px solid #E8401A' : '0.5px solid var(--color-border-secondary)',
                    background: sel ? 'rgba(232,64,26,0.04)' : 'transparent',
                    borderRadius:'var(--r-md)', padding:'var(--sp-sm)', cursor:'pointer', textAlign:'left', fontFamily:'var(--font)',
                  }}>
                    <div style={{display:'flex', alignItems:'center', gap:7, marginBottom:3}}>
                      <div style={{width:26, height:26, borderRadius:6, background:m.bg, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:500, color:m.col, fontSize:12, flexShrink:0}}>{m.icon}</div>
                      <span style={{fontWeight:500, color: sel ? '#E8401A' : 'var(--color-text-primary)'}}>{m.label}</span>
                    </div>
                    <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', paddingLeft:33}}>{m.sub}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Receipt upload */}
          <div style={{marginBottom:'var(--sp-md)'}}>
            <label className="form-label">Receipt screenshot <span style={{color:'#E8401A'}}>*</span></label>
            <div onClick={() => document.getElementById('receipt-up').click()} style={{
              border: errors.receipt ? '1.5px solid #E8401A' : '1.5px dashed var(--color-border-secondary)',
              borderRadius:'var(--r-sm)', padding:'var(--sp-lg)', textAlign:'center',
              cursor:'pointer', background: receiptFile ? 'rgba(15,110,86,0.05)' : 'transparent',
            }}>
              {receiptFile ? (
                <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:8, color:'#0F6E56'}}>
                  <i className="ti ti-file-check" style={{fontSize:22}} />
                  <div><div style={{fontWeight:500}}>{receiptFile.name || receiptFile}</div><div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', marginTop:2}}>Click to replace</div></div>
                </div>
              ) : (
                <><i className="ti ti-upload" style={{fontSize:22, color:'#E8401A', display:'block', marginBottom:5}} />
                <div style={{fontSize:'var(--fs-body)'}}>Click to upload receipt</div>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', marginTop:4}}>JPG, PNG, PDF · max 10 MB</div></>
              )}
            </div>
            <input id="receipt-up" type="file" accept=".jpg,.jpeg,.png,.pdf" style={{display:'none'}}
              onChange={async e => { const f=e.target.files[0]; if(!f) return; const r=await compressImage(f); setReceiptFile(r); setErrors(er=>({...er,receipt:null})) }} />
            {errors.receipt && <div style={{fontSize:'var(--fs-xs)', color:'#E8401A', marginTop:4}}>{errors.receipt}</div>}
          </div>

          {/* Note */}
          <div style={{marginBottom:'var(--sp-md)'}}>
            <label className="form-label">Payment note — include your name and class <span style={{color:'#E8401A'}}>*</span></label>
            <textarea value={note} onChange={e => { setNote(e.target.value); setErrors(er => ({...er, note:null})) }}
              placeholder={`e.g. ${payMethod} $${total||'___'} — ${user?.name || 'Your name'}, ${cartClasses[0]?.cls?.name || (has10Pack ? '10-hour pack' : 'class name')}`} style={{minHeight:56}} />
            {errors.note && <div style={{fontSize:'var(--fs-xs)', color:'#E8401A', marginTop:4}}>{errors.note}</div>}
          </div>

          <div style={{background:'var(--color-background-secondary)', borderRadius:'var(--r-sm)', padding:'var(--sp-sm) var(--sp-md)', fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', lineHeight:1.6, marginBottom:'var(--sp-md)'}}>
            <i className="ti ti-lock" /> {SEMESTER.packagePolicy}
          </div>

          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
            <div>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)'}}>Total</div>
              <div style={{fontSize:18, fontWeight:500}}>${total}</div>
            </div>
            <button className="btn btn-p" style={{fontSize:14, padding:'10px 24px'}} onClick={submitPayment} disabled={submitting}>
              <i className="ti ti-send" /> Submit payment
            </button>
          </div>
        </div>
      )}

      {/* Payment History */}
      {myPending.length > 0 && (
        <div className="card">
          <div className="card-hdr"><span className="card-title">Payment History</span></div>
          {myPending.map(p => (
            <div className="row" key={p.id} style={{gap:12, alignItems:'flex-start', padding:'10px 0'}}>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:'var(--fs-sm)', fontWeight:500}}>{p.items.map(i => i.className).join(', ')}</div>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', marginTop:2}}>
                  ${p.total} via {p.method} · {p.submittedAt}
                </div>
              </div>
              <span className={`pill ${p.status === 'confirmed' ? 'pill-ok' : p.status === 'rejected' ? 'pill-no' : 'pill-warn'}`} style={{fontSize:10}}>
                {p.status === 'confirmed' ? '✓ Confirmed' : p.status === 'rejected' ? 'Rejected' : '⏳ Pending'}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// PURCHASE TAB — direct purchase (bypasses cart)
// ─────────────────────────────────────────────────────────────
function PurchaseTab({ user, studentName, classes, setPendingPayments }) {
  const [purchaseType, setPurchaseType] = useState('class')
  const [selectedClass, setSelectedClass] = useState('')
  const [customAmount, setCustomAmount]  = useState('')
  const [payMethod, setPayMethod]        = useState('zelle')
  const [note, setNote]                  = useState('')
  const [receiptFile, setReceiptFile]    = useState(null)
  const [errors, setErrors]              = useState({})
  const [submitted, setSubmitted]        = useState(false)

  const grouped = {}
  classes.forEach(c => {
    const cat = c.category || 'kids'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(c)
  })

  const selCls = classes.find(c => c.id === Number(selectedClass))
  const price  = purchaseType === 'class'  ? (selCls ? selCls.fee * selCls.sessions : 0)
               : purchaseType === '10pack' ? (customAmount ? Number(customAmount) : selCls ? selCls.fee * 10 : 380)
               : 40  // dropin

  const canSubmit = purchaseType === 'class' ? !!selCls : true

  function validate() {
    const e = {}
    if (purchaseType === 'class' && !selCls) e.cls = 'Please select a class.'
    if (!receiptFile) e.receipt = 'Please upload your payment receipt.'
    if (!note.trim()) e.note    = 'Please add a payment note.'
    setErrors(e); return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    try {
      const className = purchaseType === 'class' ? selCls?.name
                      : purchaseType === '10pack' ? '10-hour pack'
                      : 'Drop-in (Adult)'
      const submission = {
        id:             Date.now(),
        studentName:    studentName || user?.name || 'Student',
        studentEmail:   user?.email || '',
        items: [{ classId: selCls?.id || null, className, pkgType: purchaseType, price }],
        method:         payMethod,
        note:           note.trim(),
        receiptFile:    receiptFile?.name    || null,
        receiptDataUrl: receiptFile?.dataUrl || null,
        total:          price,
        status:         'pending',
        submittedAt: new Date().toLocaleString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' }),
      }
      setPendingPayments(p => [...p, submission])
      setSubmitted(true)
      setSelectedClass(''); setCustomAmount(''); setNote(''); setReceiptFile(null); setErrors({})
    } catch (err) {
      console.error('Payment submission failed:', err)
      setErrors(e => ({ ...e, submit: 'Submission failed. Please try again.' }))
    }
  }

  if (submitted) return (
    <div className="card" style={{textAlign:'center', padding:'var(--sp-lg)'}}>
      <div style={{fontSize:48, marginBottom:'var(--sp-md)'}}>📬</div>
      <div style={{fontSize:16, fontWeight:500, marginBottom:8}}>Submitted!</div>
      <div style={{fontSize:'var(--fs-sm)', color:'var(--color-text-secondary)', marginBottom:'var(--sp-md)'}}>Your payment is pending teacher confirmation.</div>
      <button className="btn btn-p" onClick={() => setSubmitted(false)}><i className="ti ti-plus" /> Submit another</button>
    </div>
  )

  return (
    <div className="card">
      <div className="card-hdr"><span className="card-title">Purchase a class or package</span></div>

      {/* Type picker */}
      <div style={{marginBottom:'var(--sp-md)'}}>
        <label className="form-label">What would you like to purchase?</label>
        <div style={{display:'flex', gap:'var(--sp-sm)', marginTop:6, flexWrap:'wrap'}}>
          {[
            { v:'class',  l:'Sign up for a class',  d:'Full semester — all sessions', i:'ti-calendar' },
            { v:'10pack', l:'10-hour pack',       d:'No class needed · valid 3 months', i:'ti-package' },
            { v:'dropin', l:'Drop-in',               d:'$40 · Adult class · confirm day before', i:'ti-ticket' },
          ].map(pt => {
            const sel = purchaseType === pt.v
            return (
              <button key={pt.v} onClick={() => { setPurchaseType(pt.v); setSelectedClass(''); setCustomAmount('') }} style={{
                flex:'1 1 150px', border: sel ? '1.5px solid #E8401A' : '0.5px solid var(--color-border-secondary)',
                background: sel ? 'rgba(232,64,26,0.05)' : 'transparent',
                borderRadius:'var(--r-md)', padding:'var(--sp-sm) var(--sp-md)', cursor:'pointer', textAlign:'left', fontFamily:'var(--font)',
              }}>
                <div style={{display:'flex', alignItems:'center', gap:7, marginBottom:4}}>
                  <i className={`ti ${pt.i}`} style={{color: sel ? '#E8401A' : 'var(--color-text-secondary)'}} />
                  <span style={{fontWeight:500, color: sel ? '#E8401A' : 'var(--color-text-primary)'}}>{pt.l}</span>
                </div>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', paddingLeft:22, lineHeight:1.5}}>{pt.d}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Class selector (only for 'class' type) */}
      {purchaseType === 'class' && (
        <div style={{marginBottom:'var(--sp-md)'}}>
          <label className="form-label">Select class</label>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
            <option value="">— Choose a class —</option>
            {Object.entries(grouped).map(([cat, cls]) => (
              <optgroup key={cat} label={CATEGORY_LABELS[cat] || cat}>
                {cls.map(c => <option key={c.id} value={c.id}>{c.name} — {c.days} {c.time} · ${c.fee * c.sessions} total</option>)}
              </optgroup>
            ))}
          </select>
          {errors.cls && <div style={{fontSize:'var(--fs-xs)', color:'#E8401A', marginTop:4}}>{errors.cls}</div>}
        </div>
      )}

      {/* Amount input for 10-pack */}
      {purchaseType === '10pack' && (
        <div style={{marginBottom:'var(--sp-md)'}}>
          <label className="form-label">Total amount — enter your class fee × 10</label>
          <div style={{display:'flex', alignItems:'center', gap:'var(--sp-sm)'}}>
            <div style={{position:'relative', flex:1}}>
              <span style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--color-text-secondary)'}}>$</span>
              <input type="number" min="0" value={customAmount} onChange={e => setCustomAmount(e.target.value)} placeholder="380" style={{paddingLeft:22}} />
            </div>
            <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', maxWidth:200, lineHeight:1.5}}>
              e.g. $380 adult · $480 kids ($48×10) · $600 ($60×10)
            </div>
          </div>
        </div>
      )}

      {/* Drop-in info */}
      {purchaseType === 'dropin' && (
        <div style={{background:'var(--color-background-secondary)', borderRadius:'var(--r-sm)', padding:'var(--sp-sm) var(--sp-md)', fontSize:'var(--fs-sm)', marginBottom:'var(--sp-md)', lineHeight:1.7}}>
          <strong>$40 drop-in</strong> — Adult class. Contact admin at least one day before to confirm availability.
        </div>
      )}

      {/* Pay method */}
      <div style={{marginBottom:'var(--sp-md)'}}>
        <label className="form-label">Pay via</label>
        <div style={{display:'flex', gap:'var(--sp-sm)', marginTop:6, flexWrap:'wrap'}}>
          {PAY_METHODS.map(m => {
            const sel = payMethod === m.value
            return (
              <button key={m.value} onClick={() => setPayMethod(m.value)} style={{
                flex:'1 1 120px', border: sel ? '1.5px solid #E8401A' : '0.5px solid var(--color-border-secondary)',
                background: sel ? 'rgba(232,64,26,0.04)' : 'transparent',
                borderRadius:'var(--r-md)', padding:'var(--sp-sm)', cursor:'pointer', textAlign:'left', fontFamily:'var(--font)',
              }}>
                <div style={{display:'flex', alignItems:'center', gap:7, marginBottom:3}}>
                  <div style={{width:24, height:24, borderRadius:6, background:m.bg, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:500, color:m.col, fontSize:11, flexShrink:0}}>{m.icon}</div>
                  <span style={{fontWeight:500, color: sel ? '#E8401A' : 'var(--color-text-primary)'}}>{m.label}</span>
                </div>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', paddingLeft:31}}>{m.sub}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Receipt + note */}
      <div style={{marginBottom:'var(--sp-sm)'}}>
        <label className="form-label">Receipt screenshot <span style={{color:'#E8401A'}}>*</span></label>
        <div onClick={() => document.getElementById('pur-receipt').click()} style={{border: errors.receipt ? '1.5px solid #E8401A' : '1.5px dashed var(--color-border-secondary)', borderRadius:'var(--r-sm)', padding:'var(--sp-md)', textAlign:'center', cursor:'pointer', background: receiptFile ? 'rgba(15,110,86,0.05)' : 'transparent'}}>
          {receiptFile
            ? <div style={{color:'#0F6E56', display:'flex', alignItems:'center', justifyContent:'center', gap:8}}><i className="ti ti-file-check" style={{fontSize:20}} />{receiptFile.name||receiptFile}</div>
            : <><i className="ti ti-upload" style={{fontSize:20, color:'#E8401A', display:'block', marginBottom:4}} /><div style={{fontSize:'var(--fs-body)'}}>Upload receipt</div></>
          }
        </div>
        <input id="pur-receipt" type="file" accept=".jpg,.jpeg,.png,.pdf" style={{display:'none'}} onChange={async e => { const f=e.target.files[0]; if(!f) return; const r=await compressImage(f); setReceiptFile(r); setErrors(er=>({...er,receipt:null})) }} />
        {errors.receipt && <div style={{fontSize:'var(--fs-xs)', color:'#E8401A', marginTop:4}}>{errors.receipt}</div>}
      </div>
      <div style={{marginBottom:'var(--sp-md)'}}>
        <label className="form-label">Payment note <span style={{color:'#E8401A'}}>*</span></label>
        <textarea value={note} onChange={e => { setNote(e.target.value); setErrors(er=>({...er,note:null})) }} placeholder="e.g. Your name and what you are paying for" style={{minHeight:56}} />
        {errors.note && <div style={{fontSize:'var(--fs-xs)', color:'#E8401A', marginTop:4}}>{errors.note}</div>}
      </div>

      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <div>
          {price > 0 && <><div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)'}}>Total</div><div style={{fontSize:18, fontWeight:500}}>${price}</div></>}
        </div>
        <button className="btn btn-p" style={{fontSize:14, padding:'10px 22px'}} onClick={handleSubmit} disabled={!canSubmit} style2={{opacity: canSubmit ? 1 : 0.4}}>
          <i className="ti ti-send" /> Submit payment
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 10-SESSION PACKS TAB
// ─────────────────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().slice(0, 10)
function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function PacksTab({ sessionPacks, logSession, user, enrolledClasses }) {
  const [logging,    setLogging]    = useState({})
  const [selMins,    setSelMins]    = useState({})
  const [selTeacher, setSelTeacher] = useState({})
  const [selDate,    setSelDate]    = useState({})

  function handleLog(packId) {
    const mins    = Number(selMins[packId] || 60)
    const hours   = parseFloat((mins / 60).toFixed(2))
    const teacher = (selTeacher[packId] || '').trim()
    const date    = fmtDate(selDate[packId] || todayISO())
    setLogging(l => ({ ...l, [packId]: true }))
    logSession(packId, user?.email, user?.name, hours, teacher, date)
    setTimeout(() => {
      setLogging(l => ({ ...l, [packId]: false }))
      setSelMins(m => ({ ...m, [packId]: '' }))
      setSelTeacher(t => ({ ...t, [packId]: '' }))
      setSelDate(d => ({ ...d, [packId]: '' }))
    }, 800)
  }

  if (sessionPacks.length === 0) return (
    <div className="card" style={{textAlign:'center', padding:'var(--sp-lg)'}}>
      <i className="ti ti-package" style={{fontSize:36, display:'block', marginBottom:'var(--sp-sm)', opacity:.4, color:'var(--color-text-secondary)'}} />
      <div style={{fontSize:'var(--fs-body)', fontWeight:500, marginBottom:8}}>No active 10-hour packs</div>
      <div style={{fontSize:'var(--fs-sm)', color:'var(--color-text-secondary)', marginBottom:'var(--sp-md)', lineHeight:1.6}}>
        Purchase a 10-hour pack from the <strong>Purchase</strong> tab and the teacher will activate it once payment is confirmed.
      </div>
      <div style={{background:'var(--color-background-secondary)', borderRadius:'var(--r-sm)', padding:'var(--sp-sm) var(--sp-md)', fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', lineHeight:1.6}}>
        <i className="ti ti-info-circle" /> {SEMESTER.packagePolicy}
      </div>
    </div>
  )

  return (
    <>
      {sessionPacks.map((pack, i) => {
        const used  = parseFloat((pack.sessionsUsed || 0).toFixed(1))
        const left  = parseFloat(Math.max(0, 10 - used).toFixed(1))
        const pct   = Math.min(Math.round((used / 10) * 100), 100)
        const color = pct >= 90 ? '#E24B4A' : pct >= 70 ? '#F47B20' : '#E8401A'
        const done  = used >= 10
        const log   = pack.sessionLog || []

        return (
          <div className="card" key={pack.id || i}>
            <div className="card-hdr">
              <span className="card-title">10-hour pack</span>
              <span style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)'}}>Purchased {pack.purchaseDate} · ${pack.total}</span>
            </div>

            {/* Progress summary */}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
              <div style={{fontSize:'var(--fs-body)'}}>
                <span style={{fontWeight:500, color}}>{left} hr{left !== 1 ? 's' : ''}</span>
                <span style={{color:'var(--color-text-secondary)'}}> remaining</span>
              </div>
              <div style={{fontSize:'var(--fs-sm)', color:'var(--color-text-secondary)'}}>{used} / 10 hrs used</div>
            </div>

            {/* Progress bar */}
            <div style={{background:'var(--color-background-secondary)', borderRadius:4, height:10, marginBottom:'var(--sp-md)', overflow:'hidden'}}>
              <div style={{width:`${pct}%`, height:10, borderRadius:4, background:color, transition:'width 0.3s'}} />
            </div>

            {/* Hour history */}
            {log.length > 0 && (
              <div style={{marginBottom:'var(--sp-md)'}}>
                <div style={{fontSize:'var(--fs-xs)', fontWeight:500, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:6}}>Hour log</div>
                <div style={{background:'var(--color-background-secondary)', borderRadius:'var(--r-sm)', padding:'var(--sp-sm) var(--sp-md)'}}>
                  {log.map((entry, j) => (
                    <div key={j} style={{display:'flex', alignItems:'center', gap:10, padding:'4px 0', borderBottom: j < log.length-1 ? '0.5px solid var(--color-border-tertiary)' : 'none'}}>
                      <div style={{width:20, height:20, borderRadius:'50%', background:color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                        <i className="ti ti-clock" style={{fontSize:10, color:'#fff'}} />
                      </div>
                      <span style={{fontSize:'var(--fs-sm)'}}>{entry.hours || 1} hr{(entry.hours||1) !== 1 ? 's' : ''}</span>
                      {entry.teacher && (
                        <span style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)'}}>· {entry.teacher}</span>
                      )}
                      <span style={{marginLeft:'auto', fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', whiteSpace:'nowrap'}}>{entry.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Log button */}
            {done ? (
              <div style={{background:'rgba(163,45,45,0.08)', border:'0.5px solid rgba(163,45,45,0.25)', borderRadius:'var(--r-sm)', padding:'var(--sp-sm) var(--sp-md)', fontSize:'var(--fs-sm)', color:'#791F1F', lineHeight:1.6}}>
                <i className="ti ti-package-off" style={{marginRight:6}} />
                All 10 hours used. Purchase a new pack to continue.
              </div>
            ) : (
              <div style={{display:'flex', gap:'var(--sp-sm)', alignItems:'center', flexWrap:'wrap'}}>
                <input
                  type="number"
                  min={1}
                  max={600}
                  placeholder="60"
                  value={selMins[pack.id] ?? ''}
                  onChange={e => setSelMins(m => ({...m, [pack.id]: e.target.value}))}
                  style={{width:80, fontSize:'var(--fs-xs)', padding:'4px 8px'}}
                />
                <span style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)'}}>min</span>
                <input
                  type="text"
                  placeholder="Teacher (optional)"
                  value={selTeacher[pack.id] ?? ''}
                  onChange={e => setSelTeacher(t => ({...t, [pack.id]: e.target.value}))}
                  style={{width:140, fontSize:'var(--fs-xs)', padding:'4px 8px'}}
                />
                <span style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)'}}>Class date</span>
                <input
                  type="date"
                  value={selDate[pack.id] || todayISO()}
                  max={todayISO()}
                  onChange={e => setSelDate(d => ({...d, [pack.id]: e.target.value}))}
                  style={{width:120, fontSize:'var(--fs-xs)', padding:'4px 8px'}}
                />
                <button
                  className="btn btn-p"
                  disabled={logging[pack.id]}
                  onClick={() => handleLog(pack.id)}
                >
                  {logging[pack.id]
                    ? <><i className="ti ti-loader-2" style={{animation:'spin 1s linear infinite'}} /> Logging…</>
                    : <><i className="ti ti-clock" /> Log hours</>
                  }
                </button>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', lineHeight:1.5}}>
                  Log your hours after each class. Your teacher can also see your usage.
                </div>
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// HISTORY TAB

// ─────────────────────────────────────────────────────────────
function HistoryTab({ paymentHistory, myPending }) {
  const all = [
    ...(myPending || []).map(p => ({ ...p, _type:'pending' })),
    ...(paymentHistory || []).map(p => ({ ...p, _type:'history' })),
  ].sort((a, b) => (b.id || 0) - (a.id || 0))

  return (
    <div className="card">
      <div className="card-hdr"><span className="card-title">Payment history</span></div>
      {all.length === 0 ? (
        <div style={{textAlign:'center', padding:'var(--sp-lg) 0', color:'var(--color-text-secondary)', fontSize:'var(--fs-sm)'}}>
          <i className="ti ti-receipt" style={{fontSize:28, display:'block', marginBottom:8, opacity:.4}} />
          No payment history yet.
        </div>
      ) : all.map((p, i) => (
        <div className="row" key={p.id || i} style={{gap:12, alignItems:'flex-start', padding:'10px 0'}}>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:'var(--fs-sm)', fontWeight:500}}>
              {(p.items || []).map(i => i.className).join(', ') || p.item || '—'}
            </div>
            <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', marginTop:2}}>
              ${p.total || p.amount} via {p.method} · {p.submittedAt || p.date}
            </div>
          </div>
          <span className={`pill ${p.status === 'confirmed' ? 'pill-ok' : p.status === 'rejected' ? 'pill-no' : p._type === 'history' ? 'pill-ok' : 'pill-warn'}`} style={{fontSize:10}}>
            {p.status === 'confirmed' ? '✓ Confirmed' : p.status === 'rejected' ? 'Rejected' : p._type === 'history' ? '✓ Confirmed' : '⏳ Pending'}
          </span>
        </div>
      ))}
    </div>
  )
}
