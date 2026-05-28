import { useState } from 'react'

export default function MyClasses({
  classes=[], enrolled=[], pendingEnroll=[],
  sessionPacks=[], logSession,
  leaveRequests=[],
  navigate, user, studentName, submitLeave, requestMakeup,
}) {
  const enrolledIds = new Set(enrolled)
  const pendingIds  = new Set(pendingEnroll||[])

  // Leave request state — keyed by classId
  const [leaveFormFor,   setLeaveFormFor]   = useState(null)  // classId with form open
  const [leaveReason,    setLeaveReason]    = useState('')
  const [leaveSubmitted, setLeaveSubmitted] = useState({})    // { [classId]: true }

  // Makeup request state — keyed by leaveId
  const [makeupFormFor,  setMakeupFormFor]  = useState(null)
  const [mkClass,        setMkClass]        = useState('')
  const [mkDate,         setMkDate]         = useState('')
  const [mkSubmitted,    setMkSubmitted]    = useState({})

  // Session pack logging state
  const [loggingPack,    setLoggingPack]    = useState({})
  const [selHours,       setSelHours]       = useState({})

  const myClasses  = classes.filter(c => enrolledIds.has(c.id))
  const pendingCls = classes.filter(c => pendingIds.has(c.id) && !enrolledIds.has(c.id))
  const allPacks   = sessionPacks || []

  // ── Leave helpers ─────────────────────────────────────────────
  function openLeaveForm(classId) {
    setLeaveFormFor(classId)
    setLeaveReason('')
  }

  function handleSubmitLeave(cls) {
    if (!leaveReason.trim()) return
    const req = {
      id:           Date.now(),
      studentName:  studentName || user?.name || 'Student',
      studentEmail: user?.email || '',
      className:    cls.name,
      reason:       leaveReason.trim(),
      date:         new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }),
      status:       'pending',
    }
    if (submitLeave) submitLeave(req)
    setLeaveFormFor(null)
    setLeaveReason('')
    setLeaveSubmitted(s => ({ ...s, [cls.id]: true }))
    setTimeout(() => setLeaveSubmitted(s => { const n={...s}; delete n[cls.id]; return n }), 3000)
  }

  // ── Makeup helpers ────────────────────────────────────────────
  function openMakeupForm(leaveId) {
    setMakeupFormFor(leaveId)
    setMkClass('')
    setMkDate('')
  }

  function submitMakeupRequest(leaveId) {
    if (!mkClass) return
    const cls = classes.find(c => c.name === mkClass)
    if (requestMakeup) requestMakeup(leaveId, {
      className:  mkClass,
      classId:    cls?.id,
      instructor: cls?.instructor || '',
      days:       cls?.days || '',
      date:       mkDate || '',
    })
    setMakeupFormFor(null)
    setMkSubmitted(s => ({ ...s, [leaveId]: true }))
    setTimeout(() => setMkSubmitted(s => { const n={...s}; delete n[leaveId]; return n }), 3000)
  }

  // ── Session pack helpers ──────────────────────────────────────
  function handleLogSession(packId) {
    const hours = Number(selHours[packId] || 1)
    setLoggingPack(l => ({ ...l, [packId]: true }))
    logSession(packId, user?.email, user?.name, hours)
    setTimeout(() => setLoggingPack(l => ({ ...l, [packId]: false })), 800)
  }

  // ── Makeup form (reusable block) ──────────────────────────────
  function MakeupForm({ leaveId, isRedo }) {
    return (
      <div style={{ background:'rgba(24,95,165,0.05)', border:'0.5px solid rgba(24,95,165,0.2)', borderRadius:'var(--r-sm)', padding:'8px 10px', display:'flex', flexDirection:'column', gap:'var(--sp-sm)', marginTop:4 }}>
        <div style={{ fontSize:'var(--fs-xs)', fontWeight:500, color:'#0C447C' }}>
          <i className="ti ti-school" style={{ marginRight:4 }}/>
          {isRedo ? 'Request a new makeup class' : 'Request a makeup class'}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--sp-sm)' }}>
          <div>
            <label className="form-label">Class to attend *</label>
            <select value={mkClass} onChange={e => setMkClass(e.target.value)}>
              <option value="">— Select class —</option>
              {classes.map(c => (
                <option key={c.id} value={c.name}>{c.name} ({c.days})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">
              Preferred date <span style={{ fontWeight:400, color:'var(--color-text-secondary)' }}>(optional)</span>
            </label>
            <input type="date" value={mkDate} onChange={e => setMkDate(e.target.value)} />
          </div>
        </div>
        <div style={{ display:'flex', gap:'var(--sp-sm)', justifyContent:'flex-end' }}>
          <button className="btn" style={{ fontSize:11 }} onClick={() => setMakeupFormFor(null)}>Cancel</button>
          <button className="btn btn-p" style={{ fontSize:11 }} disabled={!mkClass} onClick={() => submitMakeupRequest(leaveId)}>
            <i className="ti ti-send"/> Submit request
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* ── My enrolled classes ──────────────────────────────── */}
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">My enrolled classes</span>
        </div>

        {/* Pending payment notice */}
        {pendingCls.length > 0 && (
          <div style={{ marginBottom:'var(--sp-sm)', background:'rgba(245,184,0,0.08)', border:'0.5px solid rgba(245,184,0,0.35)', borderRadius:'var(--r-sm)', padding:'var(--sp-sm) var(--sp-md)' }}>
            <div style={{ fontSize:'var(--fs-xs)', fontWeight:500, color:'#633806', marginBottom:4 }}>
              <i className="ti ti-clock" /> Awaiting payment confirmation:
            </div>
            {pendingCls.map(c => (
              <div key={c.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'3px 0' }}>
                <span className="dot" style={{ background:c.color }} />
                <span style={{ fontSize:'var(--fs-sm)', fontFamily:'var(--font)' }}>{c.name}</span>
                <span className="pill pill-warn" style={{ fontSize:10 }}>Pending</span>
              </div>
            ))}
            <div style={{ fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', marginTop:4 }}>
              Complete checkout in{' '}
              <span style={{ cursor:'pointer', color:'#E8401A', textDecoration:'underline' }} onClick={() => navigate('shub')}>
                Classes &amp; Payments
              </span>
            </div>
          </div>
        )}

        {myClasses.length === 0 && pendingCls.length === 0 ? (
          <div style={{ textAlign:'center', padding:'var(--sp-lg) 0', color:'var(--color-text-secondary)', fontSize:'var(--fs-sm)' }}>
            <i className="ti ti-clipboard-list" style={{ fontSize:28, display:'block', marginBottom:8, opacity:.4 }} />
            Not enrolled yet.{' '}
            <span style={{ cursor:'pointer', color:'#E8401A', textDecoration:'underline' }} onClick={() => navigate('sschedule')}>
              Browse the schedule
            </span>{' '}
            to sign up.
          </div>
        ) : myClasses.map(c => {
          const classLeaves = leaveRequests.filter(r => r.className === c.name)
          const approved    = classLeaves.filter(r => r.status === 'approved').length
          const pending     = classLeaves.filter(r => r.status === 'pending').length
          const denied      = classLeaves.filter(r => r.status === 'denied').length
          const isFormOpen  = leaveFormFor === c.id
          const justSubmitted = leaveSubmitted[c.id]

          return (
            <div key={c.id} style={{ padding:'12px 0', borderBottom:'0.5px solid var(--color-border-tertiary)' }}>
              {/* ── Class header row ── */}
              <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                <span className="dot" style={{ background:c.color, marginTop:4, flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'var(--fs-body)', fontWeight:500 }}>{c.name}</div>
                  <div style={{ fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', marginTop:2 }}>
                    {c.days} · {c.time} · 👤 {c.instructor}
                  </div>
                  {/* Count pills */}
                  {classLeaves.length > 0 && (
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:5 }}>
                      {approved > 0 && (
                        <span style={{ fontSize:10, padding:'1px 7px', borderRadius:20, background:'rgba(59,109,17,0.1)', color:'#27500A', fontWeight:500 }}>✓ {approved} approved</span>
                      )}
                      {pending > 0 && (
                        <span style={{ fontSize:10, padding:'1px 7px', borderRadius:20, background:'rgba(245,184,0,0.12)', color:'#633806', fontWeight:500 }}>⏳ {pending} pending</span>
                      )}
                      {denied > 0 && (
                        <span style={{ fontSize:10, padding:'1px 7px', borderRadius:20, background:'rgba(163,45,45,0.08)', color:'#791F1F', fontWeight:500 }}>✗ {denied} declined</span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                  <span className="pill pill-ok">Enrolled</span>
                  {!isFormOpen && (
                    <button
                      className="btn"
                      style={{ fontSize:11, padding:'3px 9px' }}
                      onClick={() => openLeaveForm(c.id)}
                    >
                      <i className="ti ti-calendar-minus" /> Request leave
                    </button>
                  )}
                </div>
              </div>

              {/* ── Inline leave request form ── */}
              {isFormOpen && (
                <div style={{ marginTop:10, marginLeft:20, background:'var(--color-background-secondary)', borderRadius:'var(--r-sm)', padding:'var(--sp-sm) var(--sp-md)', display:'flex', flexDirection:'column', gap:'var(--sp-sm)' }}>
                  <div style={{ fontSize:'var(--fs-xs)', fontWeight:500, color:'var(--color-text-primary)' }}>
                    <i className="ti ti-calendar-minus" style={{ marginRight:4, color:'#E8401A' }}/> Request leave — <em>{c.name}</em>
                  </div>
                  <div>
                    <label className="form-label">Reason *</label>
                    <textarea
                      value={leaveReason}
                      onChange={e => setLeaveReason(e.target.value)}
                      placeholder="e.g. Doctor's appointment, sick, travel…"
                      style={{ minHeight:52 }}
                      autoFocus
                    />
                  </div>
                  <div style={{ display:'flex', gap:'var(--sp-sm)', justifyContent:'flex-end' }}>
                    <button className="btn" style={{ fontSize:12 }} onClick={() => setLeaveFormFor(null)}>Cancel</button>
                    <button className="btn btn-p" style={{ fontSize:12 }} disabled={!leaveReason.trim()} onClick={() => handleSubmitLeave(c)}>
                      <i className="ti ti-send" /> Submit
                    </button>
                  </div>
                </div>
              )}

              {/* ── Submitted flash ── */}
              {justSubmitted && (
                <div style={{ marginTop:8, marginLeft:20, fontSize:'var(--fs-xs)', color:'#27500A' }}>
                  <i className="ti ti-check" style={{ marginRight:4 }}/> Leave request submitted — awaiting teacher review.
                </div>
              )}

              {/* ── Individual leave history ── */}
              {classLeaves.length > 0 && (
                <div style={{ marginTop:8, marginLeft:20, display:'flex', flexDirection:'column', gap:4 }}>
                  {classLeaves.map(lr => (
                    <div key={lr.id} style={{
                      background: lr.status==='approved' ? 'rgba(59,109,17,0.05)' : lr.status==='denied' ? 'rgba(163,45,45,0.05)' : 'rgba(245,184,0,0.05)',
                      border: `0.5px solid ${lr.status==='approved' ? 'rgba(59,109,17,0.2)' : lr.status==='denied' ? 'rgba(163,45,45,0.2)' : 'rgba(245,184,0,0.25)'}`,
                      borderRadius:'var(--r-sm)', padding:'7px 10px',
                    }}>
                      {/* Leave header */}
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        {lr.date && (
                          <span style={{ fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)' }}>{lr.date}</span>
                        )}
                        <span style={{
                          fontSize:10, padding:'1px 7px', borderRadius:20, fontWeight:500,
                          background: lr.status==='approved' ? 'rgba(59,109,17,0.12)' : lr.status==='denied' ? 'rgba(163,45,45,0.1)' : 'rgba(245,184,0,0.15)',
                          color: lr.status==='approved' ? '#27500A' : lr.status==='denied' ? '#791F1F' : '#633806',
                        }}>
                          {lr.status==='approved' ? '✓ Approved' : lr.status==='denied' ? '✗ Declined' : '⏳ Pending'}
                        </span>
                      </div>

                      {/* Reason */}
                      {lr.reason && (
                        <div style={{ fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', marginTop:3, lineHeight:1.5 }}>
                          {lr.reason}
                        </div>
                      )}

                      {/* Teacher note */}
                      {lr.teacherNote && (
                        <div style={{ marginTop:4, fontSize:'var(--fs-xs)', lineHeight:1.5, fontStyle:'italic', color: lr.status==='approved' ? '#27500A' : '#791F1F' }}>
                          <i className="ti ti-message-circle" style={{ marginRight:4, fontStyle:'normal' }} />
                          {lr.teacherNote}
                        </div>
                      )}

                      {/* Makeup section for approved leaves */}
                      {lr.status==='approved' && (
                        <div style={{ marginTop:6 }}>
                          {mkSubmitted[lr.id] ? (
                            <div style={{ fontSize:'var(--fs-xs)', color:'#0C447C' }}>
                              <i className="ti ti-check" style={{ marginRight:4 }}/> Makeup request submitted — awaiting teacher approval.
                            </div>
                          ) : !lr.makeup ? (
                            makeupFormFor===lr.id ? (
                              <MakeupForm leaveId={lr.id} isRedo={false} />
                            ) : (
                              <button className="btn" style={{ fontSize:10, padding:'2px 10px' }} onClick={() => openMakeupForm(lr.id)}>
                                <i className="ti ti-school" style={{ marginRight:4 }}/>Request makeup class
                              </button>
                            )
                          ) : lr.makeup.status==='pending' ? (
                            <div style={{ fontSize:'var(--fs-xs)', color:'#0C447C' }}>
                              <i className="ti ti-clock" style={{ marginRight:4 }}/>
                              Makeup pending approval: <strong>{lr.makeup.className}</strong>
                              {lr.makeup.date && ` · ${lr.makeup.date}`}
                            </div>
                          ) : lr.makeup.status==='approved' ? (
                            <div style={{ fontSize:'var(--fs-xs)', color:'#27500A' }}>
                              <i className="ti ti-school" style={{ marginRight:4 }}/>
                              Makeup approved: <strong>{lr.makeup.className}</strong>
                              {lr.makeup.date && ` · ${lr.makeup.date}`}
                            </div>
                          ) : (
                            makeupFormFor===lr.id ? (
                              <MakeupForm leaveId={lr.id} isRedo={true} />
                            ) : (
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <span style={{ fontSize:'var(--fs-xs)', color:'#791F1F' }}>
                                  <i className="ti ti-x" style={{ marginRight:3 }}/>Makeup request declined.
                                </span>
                                <button className="btn" style={{ fontSize:10, padding:'2px 8px' }} onClick={() => openMakeupForm(lr.id)}>
                                  Try another class
                                </button>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* ── Rollover summary ─── */}
        {(() => {
          const approvedLeaves = leaveRequests.filter(r =>
            r.status === 'approved' && myClasses.some(c => c.name === r.className)
          )
          const totalPending = leaveRequests.filter(r =>
            r.status === 'pending' && myClasses.some(c => c.name === r.className)
          ).length
          const makeupApproved = approvedLeaves.filter(r => r.makeup?.status==='approved').length
          const rollover       = approvedLeaves.length - makeupApproved
          if (approvedLeaves.length === 0 && totalPending === 0) return null
          return (
            <div style={{ marginTop:'var(--sp-md)', background:'rgba(24,95,165,0.06)', border:'0.5px solid rgba(24,95,165,0.2)', borderRadius:'var(--r-sm)', padding:'var(--sp-sm) var(--sp-md)', fontSize:'var(--fs-xs)', color:'#0C447C', lineHeight:1.8 }}>
              <i className="ti ti-rotate-clockwise" style={{ marginRight:5 }} />
              <strong>Rollover estimate:</strong>{' '}
              {approvedLeaves.length > 0 && (
                <span>
                  <strong>{approvedLeaves.length}</strong> approved leave{approvedLeaves.length !== 1 ? 's' : ''}
                  {makeupApproved > 0 && <span> · <strong>{makeupApproved}</strong> makeup{makeupApproved !== 1 ? 's' : ''} approved</span>}
                  {' → '}
                  <strong>{rollover}</strong> class{rollover !== 1 ? 'es' : ''} eligible to roll over.{' '}
                </span>
              )}
              {totalPending > 0 && (
                <span><strong>{totalPending}</strong> leave{totalPending !== 1 ? 's' : ''} still awaiting teacher approval. </span>
              )}
              Contact the studio to confirm your rollover classes.
            </div>
          )
        })()}
      </div>

      {/* ── 10-session packs ────────────────────────────────── */}
      {allPacks.length > 0 && allPacks.map((pack, i) => {
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
              <span style={{ fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)' }}>
                Purchased {pack.purchaseDate} · ${pack.total}
              </span>
            </div>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ fontSize:'var(--fs-body)' }}>
                <span style={{ fontWeight:500, color }}>{left} hr{left !== 1 ? 's' : ''}</span>
                <span style={{ color:'var(--color-text-secondary)' }}> remaining</span>
              </div>
              <div style={{ fontSize:'var(--fs-sm)', color:'var(--color-text-secondary)' }}>{used} / 10 hrs used</div>
            </div>

            <div style={{ background:'var(--color-background-secondary)', borderRadius:4, height:10, marginBottom:'var(--sp-md)', overflow:'hidden' }}>
              <div style={{ width:`${pct}%`, height:10, borderRadius:4, background:color, transition:'width 0.3s' }} />
            </div>

            {log.length > 0 && (
              <div style={{ marginBottom:'var(--sp-md)' }}>
                <div style={{ fontSize:'var(--fs-xs)', fontWeight:500, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:6 }}>
                  Hour log
                </div>
                <div style={{ background:'var(--color-background-secondary)', borderRadius:'var(--r-sm)', padding:'var(--sp-sm) var(--sp-md)' }}>
                  {log.map((entry, j) => (
                    <div key={j} style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 0', borderBottom: j < log.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none' }}>
                      <div style={{ width:20, height:20, borderRadius:'50%', background:color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <i className="ti ti-clock" style={{ fontSize:10, color:'#fff' }} />
                      </div>
                      <span style={{ fontSize:'var(--fs-sm)' }}>{entry.hours || 1} hr{(entry.hours||1) !== 1 ? 's' : ''}</span>
                      <span style={{ marginLeft:'auto', fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', whiteSpace:'nowrap' }}>{entry.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {done ? (
              <div style={{ background:'rgba(163,45,45,0.08)', border:'0.5px solid rgba(163,45,45,0.25)', borderRadius:'var(--r-sm)', padding:'var(--sp-sm) var(--sp-md)', fontSize:'var(--fs-sm)', color:'#791F1F', lineHeight:1.6 }}>
                <i className="ti ti-package-off" style={{ marginRight:6 }} />
                All 10 hours used. Purchase a new pack to continue.
              </div>
            ) : (
              <div style={{ display:'flex', gap:'var(--sp-sm)', alignItems:'center', flexWrap:'wrap' }}>
                <select className="sel-sm" value={selHours[pack.id] || 1}
                  onChange={e => setSelHours(h => ({...h, [pack.id]: e.target.value}))}>
                  <option value={0.5}>0.5 hr</option>
                  <option value={1}>1 hr</option>
                  <option value={1.5}>1.5 hr</option>
                  <option value={2}>2 hr</option>
                </select>
                <button className="btn btn-p" disabled={loggingPack[pack.id]} onClick={() => handleLogSession(pack.id)}>
                  {loggingPack[pack.id]
                    ? <><i className="ti ti-loader-2" style={{ animation:'spin 1s linear infinite' }} /> Logging…</>
                    : <><i className="ti ti-clock" /> Log hours</>
                  }
                </button>
                <div style={{ fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', lineHeight:1.5 }}>
                  Log hours after each class to track toward 10 hrs.
                </div>
              </div>
            )}
          </div>
        )
      })}

      {myClasses.length === 0 && pendingCls.length === 0 && allPacks.length === 0 && (
        <div className="card" style={{ textAlign:'center', padding:'var(--sp-lg)' }}>
          <i className="ti ti-package" style={{ fontSize:36, display:'block', marginBottom:'var(--sp-sm)', opacity:.4, color:'var(--color-text-secondary)' }} />
          <div style={{ fontSize:'var(--fs-body)', fontWeight:500, marginBottom:8 }}>No active 10-session packs</div>
          <div style={{ fontSize:'var(--fs-sm)', color:'var(--color-text-secondary)', lineHeight:1.6 }}>
            Purchase a pack from{' '}
            <span style={{ cursor:'pointer', color:'#E8401A', textDecoration:'underline' }} onClick={() => navigate('shub')}>
              Classes &amp; Payments
            </span>
            {' '}and the teacher will activate it once payment is confirmed.
          </div>
        </div>
      )}
    </>
  )
}
