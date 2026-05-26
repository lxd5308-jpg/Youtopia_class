import { useState } from 'react'
import { SEMESTER } from '../../data/mockData'

const METHOD_STYLE = {
  zelle: { icon:'Z', bg:'rgba(107,56,251,0.12)', col:'#6B38FB', label:'Zelle' },
  check: { icon:'✎', bg:'#efefef',               col:'#555',    label:'Check' },
  cash:  { icon:'$', bg:'rgba(15,110,86,0.12)',  col:'#0F6E56', label:'Cash'  },
}
const PMT_PKG = { full:'Full semester', '10pack':'10-session pack', dropin:'Drop-in' }

export default function Dashboard({
  navigate, classes=[], enrollments=[], teacherLeaves=[],
  pendingPayments=[], setPendingPayments, resolveLeave, resolveMakeup,
  enrollStudent, setTeacherPayHist,
}) {
  const leaves          = teacherLeaves || []
  const pendingPayCount = (pendingPayments||[]).filter(p=>p.status==='pending').length

  // Leave & Make-Up tab state
  const shownPending  = leaves.filter(r =>
    r.status === 'pending' || r.makeup?.status === 'pending'
  )
  const shownResolved = leaves.filter(r => r.status !== 'pending')
  const approvedLeaves = leaves.filter(r => r.status === 'approved')
  const makeupApproved = approvedLeaves.filter(r => r.makeup?.status === 'approved').length
  const rolloverCount  = approvedLeaves.length - makeupApproved

  const [leaveTab,   setLeaveTab]   = useState('pending')
  const [expandedId, setExpandedId] = useState(null)
  const [action,     setAction]     = useState({})
  const [notes,      setNotes]      = useState({})
  const [confirmed,  setConfirmed]  = useState({})
  const [mkResolved, setMkResolved] = useState({})
  const shownLeaves = leaveTab === 'pending' ? shownPending : shownResolved

  // Payment request state
  const pendingPmts  = (pendingPayments||[]).filter(p => p.status === 'pending')
  const resolvedPmts = (pendingPayments||[]).filter(p => p.status !== 'pending')

  const [payTab,        setPayTab]        = useState('pending')
  const [payExpandedId, setPayExpandedId] = useState(null)
  const [payAction,     setPayAction]     = useState({})  // { [id]: 'confirm'|'reject' }
  const [payNotes,      setPayNotes]      = useState({})
  const [payFlash,      setPayFlash]      = useState({})
  const shownPmts = payTab === 'pending' ? pendingPmts : resolvedPmts

  // Enrollment stats
  const totalStudents = new Set((enrollments||[]).map(e=>e.studentEmail)).size

  // ── Leave helpers ─────────────────────────────────────────────
  function startAction(leaveId, act) {
    setAction(a => ({ ...a, [leaveId]: act }))
    setExpandedId(leaveId)
  }
  function confirmAction(leave) {
    const act  = action[leave.id]
    const note = notes[leave.id] || ''
    if (!act) return
    if (resolveLeave) resolveLeave(leave.id, act, note)
    setConfirmed(c => ({ ...c, [leave.id]: true }))
    setExpandedId(null)
    setTimeout(() => setConfirmed(c => ({ ...c, [leave.id]: false })), 2500)
  }
  function cancelAction(leaveId) {
    setAction(a => { const n={...a}; delete n[leaveId]; return n })
    setNotes(n  => { const m={...n}; delete m[leaveId]; return m })
    setExpandedId(null)
  }
  function handleResolveMakeup(leaveId, status) {
    if (resolveMakeup) resolveMakeup(leaveId, status)
    setMkResolved(s => ({ ...s, [leaveId]: status }))
    setTimeout(() => setMkResolved(s => { const n={...s}; delete n[leaveId]; return n }), 2500)
  }

  // ── Payment helpers ───────────────────────────────────────────
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
      if (setPendingPayments) setPendingPayments(ps => ps.map(p =>
        p.id === payment.id ? { ...p, status:'confirmed',
          confirmedAt: new Date().toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }),
        } : p
      ))
      if (enrollStudent) enrollStudent(payment.items, { name: payment.studentName, email: payment.studentEmail })
      if (setTeacherPayHist) setTeacherPayHist(h => [...(h||[]), {
        id: payment.id, student: payment.studentName,
        items: payment.items, method: payment.method, total: payment.total,
        date: new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }),
      }])
    } else {
      if (setPendingPayments) setPendingPayments(ps => ps.map(p =>
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
          <div className="stat-label">Total classes</div>
          <div className="stat-val">{classes.length}</div>
          <div className="stat-sub">{SEMESTER.name}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Enrolled students</div>
          <div className="stat-val">{totalStudents}</div>
          <div className="stat-sub">Across all classes</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending leaves</div>
          <div className="stat-val" style={{color: shownPending.length>0?'#E8401A':'var(--color-text-primary)'}}>
            {shownPending.length}
          </div>
          <div className="stat-sub" style={{color: shownPending.length>0?'#E8401A':undefined}}>
            {shownPending.length>0 ? `${shownPending.length} awaiting review` : 'None pending'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending payments</div>
          <div className="stat-val" style={{color: pendingPayCount>0?'#E8401A':'var(--color-text-primary)'}}>
            {pendingPayCount}
          </div>
          <div className="stat-sub"
            style={{cursor:pendingPayCount>0?'pointer':'default', color:pendingPayCount>0?'#E8401A':undefined}}
            onClick={() => pendingPayCount>0 && navigate('tpayments')}>
            {pendingPayCount>0 ? 'See all →' : 'None pending'}
          </div>
        </div>
      </div>

      {/* ── Leave & Make Up requests ─────────────────────────────── */}
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">Leave &amp; Make Up requests</span>
          <div style={{display:'flex', gap:6, alignItems:'center'}}>
            {leaveTab==='resolved' && rolloverCount>0 && (
              <span style={{fontSize:10, padding:'2px 10px', borderRadius:20, background:'rgba(24,95,165,0.1)', color:'#0C447C', fontWeight:500}}>
                <i className="ti ti-rotate-clockwise" style={{marginRight:3}}/>
                {rolloverCount} to roll over
              </span>
            )}
            {[
              { v:'pending',  label:`Pending (${shownPending.length})`   },
              { v:'resolved', label:`Resolved (${shownResolved.length})` },
            ].map(t => (
              <button key={t.v} className="btn" onClick={() => setLeaveTab(t.v)} style={{
                fontSize:'var(--fs-xs)', padding:'3px 8px',
                background:  leaveTab===t.v ? '#E8401A' : 'transparent',
                color:       leaveTab===t.v ? '#fff'    : 'var(--color-text-primary)',
                borderColor: leaveTab===t.v ? '#E8401A' : 'var(--color-border-secondary)',
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {leaveTab==='resolved' && approvedLeaves.length>0 && (
          <div style={{marginBottom:'var(--sp-sm)', background:'rgba(24,95,165,0.06)', border:'0.5px solid rgba(24,95,165,0.2)', borderRadius:'var(--r-sm)', padding:'var(--sp-sm) var(--sp-md)', fontSize:'var(--fs-xs)', color:'#0C447C', lineHeight:1.7}}>
            <i className="ti ti-rotate-clockwise" style={{marginRight:5}}/>
            <strong>Semester rollover:</strong>{' '}
            {approvedLeaves.length} leave{approvedLeaves.length!==1?'s':''} approved
            {makeupApproved>0 && <span> · {makeupApproved} makeup{makeupApproved!==1?'s':''} approved</span>}
            {' · '}<strong>{rolloverCount} class{rolloverCount!==1?'es':''} to roll over</strong> to next semester.
          </div>
        )}

        {shownLeaves.length===0 ? (
          <div style={{textAlign:'center', padding:'var(--sp-lg) 0', color:'var(--color-text-secondary)', fontSize:'var(--fs-sm)'}}>
            <i className="ti ti-checks" style={{fontSize:24, display:'block', marginBottom:8, opacity:.4}}/>
            No {leaveTab==='pending' ? 'pending' : 'resolved'} requests.
          </div>
        ) : shownLeaves.slice().reverse().map(r => {
          const isExpanded   = expandedId===r.id
          const chosenAct    = action[r.id]
          const isConfirmed  = confirmed[r.id]
          const mk           = r.makeup
          const mkFlash      = mkResolved[r.id]
          const isMakeupRow  = r.status==='approved' && mk?.status==='pending'

          return (
            <div key={r.id} style={{borderBottom:'0.5px solid var(--color-border-tertiary)', padding:'12px 0'}}>
              <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:6}}>
                {isMakeupRow ? (
                  <span style={{fontSize:10, padding:'1px 8px', borderRadius:20, background:'rgba(24,95,165,0.1)', color:'#0C447C', fontWeight:500}}>
                    <i className="ti ti-school" style={{marginRight:3}}/>Makeup request
                  </span>
                ) : (
                  <span style={{fontSize:10, padding:'1px 8px', borderRadius:20, background:'rgba(232,64,26,0.08)', color:'#791F1F', fontWeight:500}}>
                    <i className="ti ti-calendar-minus" style={{marginRight:3}}/>Leave request
                  </span>
                )}
              </div>

              <div style={{display:'flex', alignItems:'flex-start', gap:10}}>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:2}}>
                    <span style={{fontSize:'var(--fs-body)', fontWeight:500}}>{r.studentName||'Student'}</span>
                    <span style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)'}}>
                      <i className="ti ti-calendar" style={{marginRight:3}}/>{r.className}
                    </span>
                    {r.date && <span style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)'}}>· {r.date}</span>}
                  </div>
                  <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', lineHeight:1.5}}>{r.reason}</div>
                  {isMakeupRow && mk && (
                    <div style={{fontSize:'var(--fs-xs)', color:'#0C447C', marginTop:3, lineHeight:1.6}}>
                      <i className="ti ti-school" style={{marginRight:4}}/>
                      Wants to attend: <strong>{mk.className}</strong>
                      {mk.instructor && <span> · 👤 {mk.instructor}</span>}
                      {mk.date && <span> · {mk.date}</span>}
                      <span style={{color:'var(--color-text-secondary)', marginLeft:6}}>· Requested {mk.requestedAt}</span>
                    </div>
                  )}
                  {r.status!=='pending' && r.teacherNote && (
                    <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', marginTop:3, fontStyle:'italic'}}>Note: "{r.teacherNote}"</div>
                  )}
                  {isConfirmed && <div style={{fontSize:'var(--fs-xs)', color:'#27500A', marginTop:3}}><i className="ti ti-check"/> Decision saved.</div>}
                  {mkFlash    && <div style={{fontSize:'var(--fs-xs)', color:'#27500A', marginTop:3}}><i className="ti ti-check"/> Saved.</div>}
                </div>

                {isMakeupRow ? (
                  <div style={{display:'flex', gap:4, flexShrink:0}}>
                    <button className="btn" style={{fontSize:11, padding:'3px 8px', borderColor:'#27500A', color:'#27500A'}} onClick={() => handleResolveMakeup(r.id,'approved')}><i className="ti ti-check"/> Approve</button>
                    <button className="btn" style={{fontSize:11, padding:'3px 8px', borderColor:'#791F1F', color:'#791F1F'}} onClick={() => handleResolveMakeup(r.id,'declined')}><i className="ti ti-x"/> Decline</button>
                  </div>
                ) : r.status==='pending' ? (
                  <div style={{display:'flex', gap:4, flexShrink:0}}>
                    <button className="btn" style={{fontSize:11, padding:'3px 8px', borderColor:'#27500A', color:chosenAct==='approved'?'#fff':'#27500A', background:chosenAct==='approved'?'#27500A':'transparent'}} onClick={() => startAction(r.id,'approved')}><i className="ti ti-check"/> Approve</button>
                    <button className="btn" style={{fontSize:11, padding:'3px 8px', borderColor:'#791F1F', color:chosenAct==='denied'?'#fff':'#791F1F', background:chosenAct==='denied'?'#791F1F':'transparent'}} onClick={() => startAction(r.id,'denied')}><i className="ti ti-x"/> Decline</button>
                  </div>
                ) : (
                  <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0}}>
                    <span className={`pill ${r.status==='approved'?'pill-ok':'pill-no'}`}>
                      {r.status==='approved' ? '✓ Leave approved' : '✗ Leave declined'}
                    </span>
                    {r.status==='approved' && mk && (
                      <span className={`pill ${mk.status==='approved'?'pill-ok':mk.status==='declined'?'pill-no':'pill-warn'}`} style={{fontSize:10}}>
                        {mk.status==='approved' ? '✓ Makeup approved' : mk.status==='declined' ? '✗ Makeup declined' : '⏳ Makeup pending'}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {isExpanded && (
                <div style={{marginTop:'var(--sp-sm)', display:'flex', flexDirection:'column', gap:'var(--sp-sm)'}}>
                  <div style={{
                    background: chosenAct==='approved'?'rgba(59,109,17,0.06)':'rgba(163,45,45,0.06)',
                    border:`0.5px solid ${chosenAct==='approved'?'rgba(59,109,17,0.25)':'rgba(163,45,45,0.25)'}`,
                    borderRadius:'var(--r-sm)', padding:'var(--sp-sm) var(--sp-md)',
                    fontSize:'var(--fs-xs)', color:chosenAct==='approved'?'#27500A':'#791F1F',
                  }}>
                    {chosenAct==='approved'
                      ? <><i className="ti ti-check"/> Approving leave for <strong>{r.studentName}</strong> — <em>{r.className}</em></>
                      : <><i className="ti ti-x"/> Declining leave for <strong>{r.studentName}</strong> — <em>{r.className}</em></>}
                  </div>
                  <div>
                    <label className="form-label">Explanation for student <span style={{fontWeight:400, color:'var(--color-text-secondary)'}}>(optional)</span></label>
                    <textarea value={notes[r.id]||''} onChange={e => setNotes(n=>({...n,[r.id]:e.target.value}))}
                      placeholder={chosenAct==='approved' ? "e.g. Approved — this session will roll over to next semester." : "e.g. Declined — please provide a doctor's note."}
                      style={{minHeight:48}} />
                  </div>
                  <div style={{display:'flex', gap:'var(--sp-sm)', justifyContent:'flex-end'}}>
                    <button className="btn" onClick={() => cancelAction(r.id)}>Cancel</button>
                    <button className="btn btn-p" style={chosenAct==='denied'?{background:'#791F1F',borderColor:'#791F1F'}:{}} onClick={() => confirmAction(r)}>
                      <i className="ti ti-send"/> Confirm {chosenAct==='approved'?'approval':'decline'}
                    </button>
                  </div>
                </div>
              )}

              {leaveTab==='resolved' && r.status==='approved' && (
                <div style={{marginTop:8}}>
                  {!mk ? (
                    <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', opacity:.6}}>
                      <i className="ti ti-school" style={{marginRight:4}}/>No makeup requested
                    </div>
                  ) : mk.status==='approved' ? (
                    <div style={{display:'flex', alignItems:'center', gap:6, fontSize:'var(--fs-xs)', color:'#27500A', background:'rgba(59,109,17,0.05)', border:'0.5px solid rgba(59,109,17,0.2)', borderRadius:'var(--r-sm)', padding:'5px 10px', marginTop:4}}>
                      <i className="ti ti-school"/>
                      <span>Makeup approved: <strong>{mk.className}</strong>{mk.instructor && <span> · 👤 {mk.instructor}</span>}{mk.date && <span> · {mk.date}</span>}</span>
                    </div>
                  ) : mk.status==='declined' ? (
                    <div style={{fontSize:'var(--fs-xs)', color:'#791F1F', opacity:.7, marginTop:4}}>
                      <i className="ti ti-school" style={{marginRight:4}}/>Makeup request was declined.
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Payment requests ─────────────────────────────────────── */}
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">Payment requests</span>
          <div style={{display:'flex', gap:6, alignItems:'center'}}>
            <button className="btn" style={{fontSize:'var(--fs-xs)', padding:'3px 8px'}} onClick={() => navigate('tpayments')}>
              <i className="ti ti-list"/> View all
            </button>
            {[
              { v:'pending',  label:`Pending (${pendingPmts.length})`   },
              { v:'resolved', label:`Resolved (${resolvedPmts.length})` },
            ].map(t => (
              <button key={t.v} className="btn" onClick={() => setPayTab(t.v)} style={{
                fontSize:'var(--fs-xs)', padding:'3px 8px',
                background:  payTab===t.v ? '#E8401A' : 'transparent',
                color:       payTab===t.v ? '#fff'    : 'var(--color-text-primary)',
                borderColor: payTab===t.v ? '#E8401A' : 'var(--color-border-secondary)',
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {shownPmts.length===0 ? (
          <div style={{textAlign:'center', padding:'var(--sp-lg) 0', color:'var(--color-text-secondary)', fontSize:'var(--fs-sm)'}}>
            <i className="ti ti-receipt-off" style={{fontSize:24, display:'block', marginBottom:8, opacity:.4}}/>
            No {payTab==='pending' ? 'pending' : 'resolved'} payment requests.
          </div>
        ) : shownPmts.slice().reverse().map(payment => {
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
                    {payment.submittedAt && (
                      <span style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)'}}>· {payment.submittedAt}</span>
                    )}
                  </div>
                  <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', lineHeight:1.5}}>
                    {(payment.items||[]).map(i => `${i.className} (${PMT_PKG[i.pkgType]||i.pkgType})`).join(' · ')}
                  </div>
                  <div style={{fontSize:'var(--fs-sm)', fontWeight:500, marginTop:3}}>${payment.total}</div>
                  {payment.note && (
                    <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', marginTop:3, fontStyle:'italic'}}>
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

                {/* Actions / status pill */}
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
                  <span className={`pill ${payment.status==='confirmed'?'pill-ok':'pill-no'}`}>
                    {payment.status==='confirmed' ? '✓ Confirmed' : '✗ Rejected'}
                  </span>
                )}
              </div>

              {/* Receipt thumbnail */}
              {isExpanded && payment.receiptDataUrl && payment.receiptDataUrl.startsWith('data:image') && (
                <div style={{marginTop:10}}>
                  <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', marginBottom:4}}>
                    <i className="ti ti-file-check" style={{marginRight:4, color:'#0F6E56'}}/>Receipt: {payment.receiptFile}
                  </div>
                  <img src={payment.receiptDataUrl} alt="Receipt" style={{maxWidth:'100%', maxHeight:220, borderRadius:'var(--r-sm)', border:'0.5px solid var(--color-border-secondary)', objectFit:'contain', display:'block', background:'#f9fafb'}} />
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
                    <div style={{background:'rgba(163,45,45,0.06)', border:'0.5px solid rgba(163,45,45,0.25)', borderRadius:'var(--r-sm)', padding:'var(--sp-sm) var(--sp-md)', fontSize:'var(--fs-xs)', color:'#791F1F'}}>
                      <i className="ti ti-x"/> Rejecting payment from <strong>{payment.studentName}</strong>
                    </div>
                  )}

                  {chosenAct==='reject' && (
                    <div>
                      <label className="form-label">Reason for rejection <span style={{fontWeight:400, color:'var(--color-text-secondary)'}}>(optional)</span></label>
                      <textarea value={payNotes[payment.id]||''} onChange={e => setPayNotes(n=>({...n,[payment.id]:e.target.value}))}
                        placeholder="e.g. Receipt is unclear — please resubmit." style={{minHeight:48}} />
                    </div>
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

      {/* ── Special dates ───────────────────────────────────────── */}
      <div className="card">
        <div className="card-hdr"><span className="card-title">📅 Special dates — {SEMESTER.name}</span></div>
        <div style={{display:'flex', gap:'var(--sp-lg)', flexWrap:'wrap'}}>
          {SEMESTER.specialDates.map((d,i) => (
            <div key={i} style={{display:'flex', gap:8, alignItems:'flex-start'}}>
              <i className="ti ti-calendar-event" style={{color:'#E8401A', fontSize:14, marginTop:2}} />
              <div>
                <div style={{fontSize:'var(--fs-body)', fontWeight:500, fontFamily:'var(--font)'}}>{d.label}</div>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)'}}>{d.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
