import { useState } from 'react'

const METHOD_STYLE = {
  zelle: { icon:'Z', bg:'rgba(107,56,251,0.12)', col:'#6B38FB', label:'Zelle' },
  check: { icon:'✎', bg:'#efefef',               col:'#555',    label:'Check' },
  cash:  { icon:'$', bg:'rgba(15,110,86,0.12)',  col:'#0F6E56', label:'Cash'  },
}

const PKG_LABEL = { full:'Full semester', '10pack':'10-session pack', dropin:'Drop-in', makeupFee:'Makeup class fee' }

export default function TeacherPayments({
  pendingPayments, setPendingPayments,
  setTeacherPayHist,
  enrollStudent,
  enrollments = [],
  teacherSessionPacks = [],
}) {
  const [payTab,        setPayTab]        = useState('pending')
  const [payExpandedId, setPayExpandedId] = useState(null)
  const [payAction,     setPayAction]     = useState({})  // { [id]: 'confirm'|'reject'|'refund' }
  const [payNotes,      setPayNotes]      = useState({})
  const [refundAmounts, setRefundAmounts] = useState({})  // { [id]: string } — editable, defaults to payment.total
  const [confirmAdjustments, setConfirmAdjustments] = useState({})  // { [id]: string } — signed delta added to payment.total, defaults to 0
  const [payFlash,      setPayFlash]      = useState({})

  const pending   = (pendingPayments || []).filter(p => p.status === 'pending')
  const confirmed = (pendingPayments || []).filter(p => p.status === 'confirmed')
  const rejected  = (pendingPayments || []).filter(p => p.status === 'rejected')
  const refunded  = (pendingPayments || []).filter(p => p.status === 'refunded')

  const tabs = [
    { v:'pending',   label:`Pending (${pending.length})`     },
    { v:'confirmed', label:`Confirmed (${confirmed.length})` },
    { v:'rejected',  label:`Rejected (${rejected.length})`   },
    { v:'refunded',  label:`Refunded (${refunded.length})`   },
  ]
  const displayed = { pending, confirmed, rejected, refunded }[payTab] || pending

  const totalRevenue   = confirmed.reduce((s, p) => s + p.total, 0)
  const pendingRevenue = pending.reduce((s, p) => s + p.total, 0)
  // A refund does not undo the original payment record — it moves the
  // payment to its own status with the actual amount returned, so a partial
  // refund still shows what was kept rather than zeroing the whole payment.
  const refundedTotal  = refunded.reduce((s, p) => s + (p.refundAmount ?? p.total), 0)

  function exportPaymentsCSV() {
    const all = (pendingPayments || [])
    const rows = all.map(p => ({
      student:    p.studentName,
      email:      p.studentEmail || '',
      items:      (p.items||[]).map(i=>`${i.className} (${PKG_LABEL[i.pkgType]||i.pkgType})`).join('; '),
      method:     p.method,
      subtotal:   p.subtotal ?? '',
      adjustment: p.adjustment ?? '',
      total:      p.total,
      status:     p.status,
      submitted:      p.submittedAt || '',
      confirmed:      p.confirmedAt || '',
      originalTotal:      p.originalTotal ?? '',
      confirmAdjustment:  p.confirmAdjustment ?? '',
      confirmNote:        p.confirmNote   || '',
      rejected:       p.rejectedAt  || '',
      rejectNote:     p.rejectNote  || '',
      refunded:       p.refundedAt  || '',
      refundAmount:   p.refundAmount ?? '',
      refundNote:     p.refundNote  || '',
    }))
    const headers = ['Student','Email','Items','Method','Subtotal ($)','Order Adjustment ($)','Total ($)','Status','Submitted','Confirmed','Submitted Total ($)','Confirm Adjustment ($)','Confirm Adjustment Note','Rejected','Reject Note','Refunded','Refund Amount ($)','Refund Note']
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
    setRefundAmounts(a => { const n={...a}; delete n[id]; return n })
    setConfirmAdjustments(a => { const n={...a}; delete n[id]; return n })
    setPayExpandedId(null)
  }
  function confirmPayAction(payment) {
    const act = payAction[payment.id]
    if (act === 'confirm') {
      // A signed delta, not a replacement amount — the submitted total stays
      // on the record as originalTotal, so a teacher-offered discount or a
      // credit the student didn't enter themselves is visible as an
      // adjustment on top of it, not an overwritten number. For the common
      // single-item payment, the item's own price is kept in sync so
      // Roster/CSV — which read item price, not the payment total — stay
      // consistent.
      const delta    = Number(confirmAdjustments[payment.id]) || 0
      const adjusted = delta !== 0
      const amt      = Math.max(0, payment.total + delta)
      const items    = adjusted && payment.items.length === 1
        ? [{ ...payment.items[0], price: Math.max(0, (payment.items[0].price || 0) + delta) }]
        : payment.items
      setPendingPayments(ps => ps.map(p =>
        p.id === payment.id ? { ...p, status:'confirmed', items, total: amt,
          confirmedAt: new Date().toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }),
          ...(adjusted ? { originalTotal: p.total, confirmAdjustment: delta, confirmNote: payNotes[payment.id] || '' } : {}),
        } : p
      ))
      // Use the (possibly confirm-adjusted) `items`, not the closure's stale
      // `payment.items` — enrollStudent() reads item.price for a 10-hour
      // pack's sessionPack.total, so passing the unadjusted items would
      // silently record the original amount even though the payment record
      // itself (written above) shows the adjusted one.
      enrollStudent(items, { name: payment.studentName, email: payment.studentEmail })
      setTeacherPayHist(h => [...(h||[]), {
        id: payment.id, student: payment.studentName,
        items, method: payment.method, total: amt,
        date: new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }),
      }])
    } else if (act === 'refund') {
      const amt = Math.min(Math.max(0, Number(refundAmounts[payment.id] ?? payment.total) || 0), payment.total)
      setPendingPayments(ps => ps.map(p =>
        p.id === payment.id ? { ...p, status:'refunded',
          refundAmount: amt,
          refundNote:   payNotes[payment.id] || '',
          refundedAt:   new Date().toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }),
        } : p
      ))
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
        <div className="stat-card">
          <div className="stat-label">Refunded</div>
          <div className="stat-val">{refunded.length}</div>
          <div className="stat-sub">{refundedTotal>0 ? `$${refundedTotal} returned` : 'None'}</div>
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
                  {payment.adjustment != null && payment.adjustment !== 0 && (
                    <div style={{fontSize:'var(--fs-xs)', color:'#B25E14', marginTop:2}}>
                      <i className="ti ti-info-circle" style={{marginRight:3}}/>
                      Student applied a credit/discount to the whole order: subtotal ${payment.subtotal ?? (payment.total - payment.adjustment)} {payment.adjustment>0?'+':'-'} ${Math.abs(payment.adjustment)} = ${payment.total}. Distributing it across classes is up to you.
                    </div>
                  )}
                  {payment.originalTotal != null && (
                    <div style={{fontSize:'var(--fs-xs)', color:'#B25E14', marginTop:2}}>
                      <i className="ti ti-info-circle" style={{marginRight:3}}/>
                      Confirmed at ${payment.total} (submitted ${payment.originalTotal} {payment.confirmAdjustment>0?'+':'-'} ${Math.abs(payment.confirmAdjustment)}){payment.confirmNote ? ` — "${payment.confirmNote}"` : ''}
                    </div>
                  )}

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
                  {payment.status==='refunded' && (
                    <div style={{fontSize:'var(--fs-xs)', color:'#B25E14', marginTop:3}}>
                      Refunded ${payment.refundAmount ?? payment.total}{payment.refundedAt ? ` on ${payment.refundedAt}` : ''}{payment.refundNote ? ` — "${payment.refundNote}"` : ''}
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
                    <span className={`pill ${payment.status==='confirmed'?'pill-ok':payment.status==='refunded'?'pill-info':'pill-no'}`}>
                      {payment.status==='confirmed' ? '✓ Confirmed' : payment.status==='refunded' ? '↩ Refunded' : '✗ Rejected'}
                    </span>
                    {payment.status==='confirmed' && (
                      <button className="btn" style={{fontSize:10, padding:'2px 7px', borderColor:'#B25E14', color:'#B25E14'}}
                        onClick={() => startPayAction(payment.id,'refund')}>
                        <i className="ti ti-receipt-refund"/> Refund
                      </button>
                    )}
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
              {isExpanded && (payment.status==='pending' || chosenAct==='refund') && (() => {
                const refundVal    = refundAmounts[payment.id] ?? String(payment.total)
                const refundValid  = Number(refundVal) > 0 && Number(refundVal) <= payment.total
                const confirmDeltaVal = confirmAdjustments[payment.id] ?? ''
                const confirmDelta    = Number(confirmDeltaVal) || 0
                const confirmValid    = confirmDeltaVal === '' || !Number.isNaN(Number(confirmDeltaVal))
                const confirmAdjusted = confirmValid && confirmDelta !== 0
                const confirmTotal    = Math.max(0, payment.total + confirmDelta)
                return (
                <div style={{marginTop:'var(--sp-sm)', display:'flex', flexDirection:'column', gap:'var(--sp-sm)'}}>
                  {chosenAct==='confirm' ? (
                    <>
                      <div style={{display:'flex', gap:'var(--sp-sm)', alignItems:'flex-end', flexWrap:'wrap'}}>
                        <div>
                          <label className="form-label">Adjustment <span style={{fontWeight:400, color:'var(--color-text-secondary)'}}>(negative = discount/credit)</span></label>
                          <input type="number" step="0.01"
                            value={confirmDeltaVal}
                            placeholder="0"
                            onChange={e => setConfirmAdjustments(a => ({...a, [payment.id]: e.target.value}))}
                            style={{width:100}} />
                        </div>
                        <span style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', paddingBottom:8}}>
                          ${payment.total} submitted{confirmAdjusted ? ` → $${confirmTotal} to confirm` : ''}
                        </span>
                      </div>
                      {confirmAdjusted && (
                        <div>
                          <label className="form-label">Reason for adjustment <span style={{fontWeight:400, color:'var(--color-text-secondary)'}}>(optional)</span></label>
                          <textarea value={payNotes[payment.id]||''} onChange={e => setPayNotes(n=>({...n,[payment.id]:e.target.value}))}
                            placeholder="e.g. Returning-student credit applied." style={{minHeight:40}} />
                        </div>
                      )}
                      <div style={{background:'rgba(59,109,17,0.06)', border:'0.5px solid rgba(59,109,17,0.25)', borderRadius:'var(--r-sm)', padding:'var(--sp-sm) var(--sp-md)', fontSize:'var(--fs-xs)', color:'#27500A', lineHeight:1.7}}>
                        <i className="ti ti-info-circle"/> Confirming will:
                        {(payment.items||[]).filter(i=>i.pkgType!=='10pack'&&i.pkgType!=='makeupFee'&&i.classId).length>0 && (
                          <span> enroll <strong>{payment.studentName}</strong> in {(payment.items||[]).filter(i=>i.pkgType!=='10pack'&&i.pkgType!=='makeupFee').map(i=>i.className).join(', ')};</span>
                        )}
                        {(payment.items||[]).filter(i=>i.pkgType==='10pack').length>0 && (
                          <span> activate a 10-session pack for <strong>{payment.studentName}</strong>;</span>
                        )}
                        {(payment.items||[]).filter(i=>i.pkgType==='makeupFee').length>0 && (
                          <span> record a ${confirmAdjusted ? confirmTotal : payment.total} makeup class fee for <strong>{payment.studentName}</strong> — no enrollment change;</span>
                        )}
                        {confirmAdjusted && <span> record ${confirmTotal} (submitted ${payment.total} {confirmDelta>0?'+':'-'} ${Math.abs(confirmDelta)});</span>}
                        <span> update their dashboard and your roster.</span>
                      </div>
                    </>
                  ) : chosenAct==='refund' ? (
                    <>
                      <div style={{background:'rgba(244,123,32,0.08)', border:'0.5px solid rgba(244,123,32,0.25)', borderRadius:'var(--r-sm)', padding:'var(--sp-sm) var(--sp-md)', fontSize:'var(--fs-xs)', color:'#B25E14', lineHeight:1.7}}>
                        <i className="ti ti-info-circle"/> This only records that <strong>{payment.studentName}</strong> was paid back — it
                        does not send money. Actually return it via {METHOD_STYLE[payment.method]?.label || 'the original method'} first,
                        then confirm here. This also does not drop their enrollment — use Roster separately if needed.
                      </div>
                      <div style={{display:'flex', gap:'var(--sp-sm)', alignItems:'flex-end', flexWrap:'wrap'}}>
                        <div>
                          <label className="form-label">Amount refunded</label>
                          <input type="number" min={0} max={payment.total} step="0.01"
                            value={refundVal}
                            onChange={e => setRefundAmounts(a => ({...a, [payment.id]: e.target.value}))}
                            style={{width:100}} />
                        </div>
                        <span style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', paddingBottom:8}}>of ${payment.total} paid</span>
                      </div>
                      {!refundValid && (
                        <div style={{fontSize:'var(--fs-xs)', color:'#791F1F'}}>Enter an amount between $0.01 and ${payment.total}.</div>
                      )}
                      <div>
                        <label className="form-label">Note <span style={{fontWeight:400, color:'var(--color-text-secondary)'}}>(optional)</span></label>
                        <textarea value={payNotes[payment.id]||''} onChange={e => setPayNotes(n=>({...n,[payment.id]:e.target.value}))}
                          placeholder="e.g. Partial refund after dropping Ballet L2 mid-semester." style={{minHeight:48}} />
                      </div>
                    </>
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
                      style={chosenAct==='reject'?{background:'#791F1F',borderColor:'#791F1F'}:chosenAct==='refund'?{background:'#B25E14',borderColor:'#B25E14'}:{}}
                      disabled={(chosenAct==='refund' && !refundValid) || (chosenAct==='confirm' && !confirmValid)}
                      onClick={() => confirmPayAction(payment)}>
                      <i className="ti ti-send"/> {chosenAct==='confirm' ? 'Confirm & enroll student' : chosenAct==='refund' ? 'Confirm refund' : 'Confirm rejection'}
                    </button>
                  </div>
                </div>
                )
              })()}
            </div>
          )
        })}
      </div>
    </>
  )
}
