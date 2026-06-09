import { useState } from 'react'

const METHOD_STYLE = {
  zelle: { icon:'Z', bg:'rgba(107,56,251,0.12)', col:'#6B38FB', label:'Zelle' },
  check: { icon:'✎', bg:'#efefef',               col:'#555',    label:'Check' },
  cash:  { icon:'$', bg:'rgba(15,110,86,0.12)',  col:'#0F6E56', label:'Cash'  },
}

const PKG_LABEL = { full:'Full semester', '10pack':'10-session pack', dropin:'Drop-in' }

export default function TeacherPayments({
  pendingPayments, setPendingPayments,
  setTeacherPayHist,
  enrollStudent,
  enrollments = [],
  teacherSessionPacks = [],
}) {
  const [payTab,        setPayTab]        = useState('pending')
  const [payExpandedId, setPayExpandedId] = useState(null)
  const [payAction,     setPayAction]     = useState({})  // { [id]: 'confirm'|'reject' }
  const [payNotes,      setPayNotes]      = useState({})
  const [payFlash,      setPayFlash]      = useState({})

  const pending   = (pendingPayments || []).filter(p => p.status === 'pending')
  const confirmed = (pendingPayments || []).filter(p => p.status === 'confirmed')
  const rejected  = (pendingPayments || []).filter(p => p.status === 'rejected')

  const tabs = [
    { v:'pending',   label:`Pending (${pending.length})`     },
    { v:'confirmed', label:`Confirmed (${confirmed.length})` },
    { v:'rejected',  label:`Rejected (${rejected.length})`   },
  ]
  const displayed = payTab === 'pending' ? pending : payTab === 'confirmed' ? confirmed : rejected

  const totalRevenue   = confirmed.reduce((s, p) => s + p.total, 0)
  const pendingRevenue = pending.reduce((s, p) => s + p.total, 0)

  function exportPaymentsCSV() {
    const all = (pendingPayments || [])
    const rows = all.map(p => ({
      student:    p.studentName,
      email:      p.studentEmail || '',
      items:      (p.items||[]).map(i=>`${i.className} (${PKG_LABEL[i.pkgType]||i.pkgType})`).join('; '),
      method:     p.method,
      total:      p.total,
      status:     p.status,
      submitted:  p.submittedAt || '',
      confirmed:  p.confirmedAt || '',
      rejected:   p.rejectedAt  || '',
      rejectNote: p.rejectNote  || '',
    }))
    const headers = ['Student','Email','Items','Method','Total ($)','Status','Submitted','Confirmed','Rejected','Reject Note']
    const csvRows = [headers, ...rows.map(r => Object.values(r))]
    const csv = csvRows.map(r => r.map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], {type:'text/csv'})
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href=url; a.download='youtopia-payments.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Helpers ───────────────────────────────────────────────────
  function startPayAction(id, act) {
    setPayAction(a => ({ ...a, [id]: act }))
    setPayExpandedId(id)
  }
  function cancelPayAction(id) {
    setPayAction(a => { const n={...a}; delete n[id]; return n })
    setPayNotes(n  => { const m={...n}; delete m[id]; return m })
    setPayExpandedId(null)
  }
  function confirmPayAction(payment) {
    const act = payAction[payment.id]
    if (act === 'confirm') {
      setPendingPayments(ps => ps.map(p =>
        p.id === payment.id ? { ...p, status:'confirmed',
          confirmedAt: new Date().toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }),
        } : p
      ))
      enrollStudent(payment.items, { name: payment.studentName, email: payment.studentEmail })
      setTeacherPayHist(h => [...(h||[]), {
        id: payment.id, student: payment.studentName,
        items: payment.items, method: payment.method, total: payment.total,
        date: new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }),
      }])
    } else {
      setPendingPayments(ps => ps.map(p =>
        p.id === payment.id ? { ...p, status:'rejected',
          rejectNote: payNotes[payment.id] || '',
          rejectedAt: new Date().toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }),
        } : p
      ))
    }
    setPayExpandedId(null)
    setPayFlash(f => ({ ...f, [payment.id]: true }))
    setTimeout(() => setPayFlash(f => { const n={...f}; delete n[payment.id]; return n }), 2500)
  }

  return (
    <>
      {/* ── Stat cards ─────────────────────────────────────────── */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Pending confirmation</div>
          <div className="stat-val" style={{color: pending.length>0?'#E8401A':'var(--color-text-primary)'}}>{pending.length}</div>
          <div className="stat-sub">{pendingRevenue>0 ? `$${pendingRevenue} awaiting` : 'None'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Confirmed payments</div>
          <div className="stat-val">{confirmed.length}</div>
          <div className="stat-sub">${totalRevenue} total</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Class enrollments</div>
          <div className="stat-val">{enrollments.length}</div>
          <div className="stat-sub">Across all classes</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">10-session packs</div>
          <div className="stat-val">{teacherSessionPacks.length}</div>
          <div className="stat-sub">Active packs</div>
        </div>
      </div>

      {/* ── Payment submissions ───────────────────────────────── */}
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">Payment submissions</span>
          <div style={{display:'flex', gap:6, alignItems:'center', flexWrap:'wrap'}}>
            <button className="btn" onClick={exportPaymentsCSV} style={{fontSize:'var(--fs-xs)', padding:'3px 8px'}}>
              <i className="ti ti-download"/> Export CSV
            </button>
            {tabs.map(t => (
              <button key={t.v} className="btn" onClick={() => setPayTab(t.v)} style={{
                fontSize:'var(--fs-xs)', padding:'3px 8px',
                background:  payTab===t.v ? '#E8401A' : 'transparent',
                color:       payTab===t.v ? '#fff'    : 'var(--color-text-primary)',
                borderColor: payTab===t.v ? '#E8401A' : 'var(--color-border-secondary)',
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {displayed.length===0 ? (
          <div style={{textAlign:'center', padding:'var(--sp-lg) 0', color:'var(--color-text-secondary)', fontSize:'var(--fs-sm)'}}>
            <i className="ti ti-receipt-off" style={{fontSize:28, display:'block', marginBottom:8, opacity:.4}}/>
            No {payTab} payments.
          </div>
        ) : displayed.slice().reverse().map(payment => {
          const m          = METHOD_STYLE[payment.method] || METHOD_STYLE.cash
          const isExpanded = payExpandedId === payment.id
          const chosenAct  = payAction[payment.id]
          const flash      = payFlash[payment.id]

          return (
            <div key={payment.id} style={{borderBottom:'0.5px solid var(--color-border-tertiary)', padding:'12px 0'}}>

              {/* Method badge */}
              <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:6}}>
                <span style={{fontSize:10, padding:'1px 8px', borderRadius:20, background:m.bg, color:m.col, fontWeight:500, display:'flex', alignItems:'center', gap:4}}>
                  <span style={{fontWeight:700}}>{m.icon}</span>{m.label} payment
                </span>
              </div>

              {/* Main row */}
              <div style={{display:'flex', alignItems:'flex-start', gap:10}}>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:2}}>
                    <span style={{fontSize:'var(--fs-body)', fontWeight:500}}>{payment.studentName}</span>
                    {payment.studentEmail && (
                      <span style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)'}}>{payment.studentEmail}</span>
                    )}
                    {payment.submittedAt && (
                      <span style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)'}}>· {payment.submittedAt}</span>
                    )}
                  </div>
                  <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', lineHeight:1.5}}>
                    {(payment.items||[]).map(i => `${i.className} (${PKG_LABEL[i.pkgType]||i.pkgType})`).join(' · ')}
                  </div>
                  <div style={{fontSize:'var(--fs-sm)', fontWeight:500, marginTop:3}}>${payment.total}</div>

                  {payment.note && (
                    <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', marginTop:4, fontStyle:'italic'}}>
                      <i className="ti ti-message-circle" style={{marginRight:3}}/>"{payment.note}"
                    </div>
                  )}
                  {flash && <div style={{fontSize:'var(--fs-xs)', color:'#27500A', marginTop:3}}><i className="ti ti-check"/> Decision saved.</div>}
                  {payment.status==='confirmed' && payment.confirmedAt && (
                    <div style={{fontSize:'var(--fs-xs)', color:'#27500A', marginTop:3}}>
                      Confirmed {payment.confirmedAt} — student enrolled.
                    </div>
                  )}
                  {payment.status==='rejected' && (
                    <div style={{fontSize:'var(--fs-xs)', color:'#791F1F', marginTop:3}}>
                      Rejected{payment.rejectedAt ? ` ${payment.rejectedAt}` : ''}{payment.rejectNote ? ` — "${payment.rejectNote}"` : ''}
                    </div>
                  )}
                </div>

                {/* Actions / status */}
                {payment.status==='pending' ? (
                  <div style={{display:'flex', gap:4, flexShrink:0}}>
                    <button className="btn" style={{fontSize:11, padding:'3px 8px', borderColor:'#27500A', color:chosenAct==='confirm'?'#fff':'#27500A', background:chosenAct==='confirm'?'#27500A':'transparent'}}
                      onClick={() => startPayAction(payment.id,'confirm')}>
                      <i className="ti ti-check"/> Confirm
                    </button>
                    <button className="btn" style={{fontSize:11, padding:'3px 8px', borderColor:'#791F1F', color:chosenAct==='reject'?'#fff':'#791F1F', background:chosenAct==='reject'?'#791F1F':'transparent'}}
                      onClick={() => startPayAction(payment.id,'reject')}>
                      <i className="ti ti-x"/> Reject
                    </button>
                  </div>
                ) : (
                  <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0}}>
                    <span className={`pill ${payment.status==='confirmed'?'pill-ok':'pill-no'}`}>
                      {payment.status==='confirmed' ? '✓ Confirmed' : '✗ Rejected'}
                    </span>
                    {payment.receiptFile && (
                      <button className="btn" style={{fontSize:10, padding:'2px 7px'}}
                        onClick={() => setPayExpandedId(isExpanded ? null : payment.id)}>
                        <i className={`ti ti-${isExpanded ? 'eye-off' : 'receipt'}`}/> {isExpanded ? 'Hide' : 'Receipt'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Receipt (shown when expanded) */}
              {isExpanded && payment.receiptFile && (
                <div style={{marginTop:10}}>
                  <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', marginBottom:4}}>
                    <i className="ti ti-file-check" style={{marginRight:4, color:'#0F6E56'}}/>Receipt: {payment.receiptFile}
                  </div>
                  {payment.receiptDataUrl ? (
                    <img src={payment.receiptDataUrl} alt="Receipt"
                      style={{maxWidth:'100%', maxHeight:280, borderRadius:'var(--r-sm)', border:'0.5px solid var(--color-border-secondary)', objectFit:'contain', display:'block', background:'#f9fafb'}} />
                  ) : (
                    <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', fontStyle:'italic'}}>
                      {payment.receiptFile?.toLowerCase().endsWith('.pdf') ? 'PDF receipt on file.' : 'Receipt on file (no preview).'}
                    </div>
                  )}
                </div>
              )}

              {/* Inline action form */}
              {isExpanded && payment.status==='pending' && (
                <div style={{marginTop:'var(--sp-sm)', display:'flex', flexDirection:'column', gap:'var(--sp-sm)'}}>
                  {chosenAct==='confirm' ? (
                    <div style={{background:'rgba(59,109,17,0.06)', border:'0.5px solid rgba(59,109,17,0.25)', borderRadius:'var(--r-sm)', padding:'var(--sp-sm) var(--sp-md)', fontSize:'var(--fs-xs)', color:'#27500A', lineHeight:1.7}}>
                      <i className="ti ti-info-circle"/> Confirming will:
                      {(payment.items||[]).filter(i=>i.pkgType!=='10pack'&&i.classId).length>0 && (
                        <span> enroll <strong>{payment.studentName}</strong> in {(payment.items||[]).filter(i=>i.pkgType!=='10pack').map(i=>i.className).join(', ')};</span>
                      )}
                      {(payment.items||[]).filter(i=>i.pkgType==='10pack').length>0 && (
                        <span> activate a 10-session pack for <strong>{payment.studentName}</strong>;</span>
                      )}
                      <span> update their dashboard and your roster.</span>
                    </div>
                  ) : (
                    <>
                      <div style={{background:'rgba(163,45,45,0.06)', border:'0.5px solid rgba(163,45,45,0.25)', borderRadius:'var(--r-sm)', padding:'var(--sp-sm) var(--sp-md)', fontSize:'var(--fs-xs)', color:'#791F1F'}}>
                        <i className="ti ti-x"/> Rejecting payment from <strong>{payment.studentName}</strong>
                      </div>
                      <div>
                        <label className="form-label">Reason for rejection <span style={{fontWeight:400, color:'var(--color-text-secondary)'}}>(optional)</span></label>
                        <textarea value={payNotes[payment.id]||''} onChange={e => setPayNotes(n=>({...n,[payment.id]:e.target.value}))}
                          placeholder="e.g. Receipt is unclear — please resubmit." style={{minHeight:48}} />
                      </div>
                    </>
                  )}
                  <div style={{display:'flex', gap:'var(--sp-sm)', justifyContent:'flex-end'}}>
                    <button className="btn" onClick={() => cancelPayAction(payment.id)}>Cancel</button>
                    <button className="btn btn-p"
                      style={chosenAct==='reject'?{background:'#791F1F',borderColor:'#791F1F'}:{}}
                      onClick={() => confirmPayAction(payment)}>
                      <i className="ti ti-send"/> {chosenAct==='confirm' ? 'Confirm & enroll student' : 'Confirm rejection'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
