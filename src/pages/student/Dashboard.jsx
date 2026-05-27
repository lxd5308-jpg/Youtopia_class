import { useState } from 'react'
import { SEMESTER } from '../../data/mockData'

const LEAVE_STATUS = {
  pending:  { pill:'pill-warn', label:'⏳ Pending'  },
  approved: { pill:'pill-ok',   label:'✓ Approved'  },
  denied:   { pill:'pill-no',   label:'✗ Denied'    },
}

const MK_STATUS = {
  pending:  { pill:'pill-warn', label:'⏳ Pending'  },
  approved: { pill:'pill-ok',   label:'✓ Approved'  },
  declined: { pill:'pill-no',   label:'✗ Declined'  },
}

export default function StudentDashboard({
  navigate, classes=[], cart=[], enrolled=[], pendingEnroll=[], sessionPacks=[],
  leaveRequests=[], studentName, setStudentName, user, logSession,
  submitLeave, requestMakeup, studentLoading,
}) {
  const [nameInput, setNameInput] = useState(studentName || '')
  const [editingName, setEditingName] = useState(!studentName)
  const [loggingPack, setLoggingPack] = useState({})

  // Leave request state (keyed by classId)
  const [leaveFormFor,   setLeaveFormFor]   = useState(null)
  const [leaveReason,    setLeaveReason]    = useState('')
  const [leaveSubmitted, setLeaveSubmitted] = useState({})

  // Makeup request state (keyed by leaveId)
  const [makeupFormFor, setMakeupFormFor] = useState(null)
  const [mkClass,       setMkClass]       = useState('')
  const [mkDate,        setMkDate]        = useState('')
  const [mkSubmitted,   setMkSubmitted]   = useState({})

  const enrolledClasses      = classes.filter(c => enrolled.includes(c.id))
  const pendingEnrollClasses = classes.filter(c => pendingEnroll.includes(c.id) && !enrolled.includes(c.id))
  const pendingLeaves        = leaveRequests.filter(r => r.status==='pending')
  const activePacks          = (sessionPacks||[]).filter(p => (p.sessionsUsed||0) < 10)

  function handleLogSession(packId) {
    setLoggingPack(l => ({ ...l, [packId]: true }))
    logSession(packId, user?.email, user?.name)
    setTimeout(() => setLoggingPack(l => ({ ...l, [packId]: false })), 800)
  }

  function saveName() {
    if (!nameInput.trim()) return
    setStudentName(nameInput.trim())
    setEditingName(false)
  }

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

  return (
    <>
      {/* ── Student name prompt (only show after Firestore has loaded) ── */}
      {editingName && !studentLoading && (
        <div className="card" style={{background:'rgba(232,64,26,0.04)', border:'1.5px solid rgba(232,64,26,0.25)'}}>
          <div className="card-hdr">
            <span className="card-title">👋 Welcome! What is your student's name?</span>
          </div>
          <div style={{fontSize:'var(--fs-sm)', color:'var(--color-text-secondary)', marginBottom:'var(--sp-sm)', lineHeight:1.6}}>
            This is the name that will appear in the teacher's portal when you enroll in classes or request leave.
            This should be the <strong>student's name</strong>, not the parent's name.
          </div>
          <div style={{display:'flex', gap:'var(--sp-sm)', alignItems:'center'}}>
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key==='Enter' && saveName()}
              placeholder="e.g. Emma Zhang"
              style={{flex:1}}
              autoFocus
            />
            <button className="btn btn-p" onClick={saveName} disabled={!nameInput.trim()}>
              <i className="ti ti-check" /> Save name
            </button>
          </div>
          {studentName && (
            <button className="btn" style={{marginTop:8, fontSize:'var(--fs-xs)'}} onClick={() => setEditingName(false)}>
              Keep current name: {studentName}
            </button>
          )}
        </div>
      )}

      {/* ── Stats ── */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Student</div>
          <div className="stat-val" style={{fontSize:15, marginTop:2}}>{studentName || '—'}</div>
          <div className="stat-sub" style={{cursor:'pointer', color:'var(--color-text-secondary)'}} onClick={() => setEditingName(true)}>
            {studentName ? 'Edit name' : 'Set name →'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Enrolled classes</div>
          <div className="stat-val">{enrolledClasses.length}</div>
          <div className="stat-sub">{enrolledClasses.length===0 ? 'Sign up below' : 'This semester'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">10-session packs</div>
          <div className="stat-val">{activePacks.length}</div>
          <div className="stat-sub">
            {activePacks.length===0 ? 'None active' : `${activePacks.reduce((s,p)=>s+(10-(p.sessionsUsed||0)),0)} sessions left`}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Leave requests</div>
          <div className="stat-val" style={{color:pendingLeaves.length>0?'#F47B20':'var(--color-text-primary)'}}>{leaveRequests.length}</div>
          <div className="stat-sub">{pendingLeaves.length>0 ? `${pendingLeaves.length} pending` : 'None pending'}</div>
        </div>
      </div>

      {/* Cart prompt */}
      {cart.length>0 && (
        <div onClick={() => navigate('shub')} style={{background:'rgba(232,64,26,0.08)',border:'1px solid rgba(232,64,26,0.25)',borderRadius:'var(--r-md)',padding:'var(--sp-md) var(--sp-lg)',display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
          <i className="ti ti-shopping-cart" style={{fontSize:20,color:'#E8401A'}} />
          <div style={{flex:1}}>
            <div style={{fontWeight:500,color:'#E8401A'}}>{cart.length} class{cart.length>1?'es':''} in your cart</div>
            <div style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)',marginTop:2}}>Upload your receipt to confirm enrollment.</div>
          </div>
          <button className="btn btn-p" style={{fontSize:'var(--fs-sm)'}}>Checkout →</button>
        </div>
      )}

      {/* ── My Classes (with inline leave request) ── */}
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">My classes ({enrolledClasses.length + pendingEnrollClasses.length})</span>
          <button className="btn" onClick={() => navigate('sschedule')}>Browse all</button>
        </div>

        {enrolledClasses.length===0 && pendingEnrollClasses.length===0 ? (
          <div style={{textAlign:'center',padding:'var(--sp-lg) 0',color:'var(--color-text-secondary)',fontSize:'var(--fs-sm)'}}>
            <i className="ti ti-calendar-off" style={{fontSize:28,display:'block',marginBottom:8,opacity:.4}} />
            Not enrolled yet. <span style={{cursor:'pointer',color:'#E8401A',textDecoration:'underline'}} onClick={() => navigate('sschedule')}>Browse classes</span> to sign up.
          </div>
        ) : (
          <>
            {enrolledClasses.map(c => {
              const isFormOpen    = leaveFormFor === c.id
              const justSubmitted = leaveSubmitted[c.id]
              return (
                <div key={c.id} style={{padding:'10px 0', borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                  {/* Class row */}
                  <div style={{display:'flex', alignItems:'flex-start', gap:10}}>
                    <span className="dot" style={{background:c.color, marginTop:4, flexShrink:0}} />
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:'var(--fs-body)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{c.name}</div>
                      <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)'}}>{c.days} · {c.time}</div>
                    </div>
                    <div style={{display:'flex', alignItems:'center', gap:6, flexShrink:0}}>
                      <span className="pill pill-ok">✓ Confirmed</span>
                      {!isFormOpen && (
                        <button className="btn" style={{fontSize:11, padding:'3px 9px'}} onClick={() => openLeaveForm(c.id)}>
                          <i className="ti ti-calendar-minus" /> Request leave
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline leave form */}
                  {isFormOpen && (
                    <div style={{marginTop:10, marginLeft:18, background:'var(--color-background-secondary)', borderRadius:'var(--r-sm)', padding:'var(--sp-sm) var(--sp-md)', display:'flex', flexDirection:'column', gap:'var(--sp-sm)'}}>
                      <div style={{fontSize:'var(--fs-xs)', fontWeight:500, color:'var(--color-text-primary)'}}>
                        <i className="ti ti-calendar-minus" style={{marginRight:4, color:'#E8401A'}}/> Request leave — <em>{c.name}</em>
                      </div>
                      <div>
                        <label className="form-label">Reason *</label>
                        <textarea
                          value={leaveReason}
                          onChange={e => setLeaveReason(e.target.value)}
                          placeholder="e.g. Doctor's appointment, sick, travel…"
                          style={{minHeight:52}}
                          autoFocus
                        />
                      </div>
                      <div style={{display:'flex', gap:'var(--sp-sm)', justifyContent:'flex-end'}}>
                        <button className="btn" style={{fontSize:12}} onClick={() => setLeaveFormFor(null)}>Cancel</button>
                        <button className="btn btn-p" style={{fontSize:12}} disabled={!leaveReason.trim()} onClick={() => handleSubmitLeave(c)}>
                          <i className="ti ti-send" /> Submit
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Flash confirmation */}
                  {justSubmitted && (
                    <div style={{marginTop:6, marginLeft:18, fontSize:'var(--fs-xs)', color:'#27500A'}}>
                      <i className="ti ti-check" style={{marginRight:4}}/> Leave request submitted — awaiting teacher review.
                    </div>
                  )}
                </div>
              )
            })}

            {pendingEnrollClasses.map(c => (
              <div className="row" key={c.id}>
                <span className="dot" style={{background:c.color, opacity:0.5}} />
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:'var(--fs-body)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', opacity:0.75}}>{c.name}</div>
                  <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)'}}>{c.days} · {c.time}</div>
                </div>
                <span className="pill pill-warn">⏳ Pending</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── Leave & Makeup requests (with inline makeup request) ── */}
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">Leave &amp; Make up requests</span>
          {pendingLeaves.length>0 && <span className="pill pill-warn">{pendingLeaves.length} pending</span>}
        </div>

        {leaveRequests.length===0 ? (
          <div style={{textAlign:'center', padding:'var(--sp-lg) 0', color:'var(--color-text-secondary)', fontSize:'var(--fs-sm)'}}>
            <i className="ti ti-calendar-check" style={{fontSize:28, display:'block', marginBottom:8, opacity:.4}} />
            No leave requests yet. Use the "Request leave" button next to any enrolled class above.
          </div>
        ) : leaveRequests.slice().reverse().map((r, i) => {
          const s  = LEAVE_STATUS[r.status] || LEAVE_STATUS.pending
          const mk = r.makeup
          const isMkFormOpen  = makeupFormFor === r.id
          const justMkSubmitted = mkSubmitted[r.id]

          return (
            <div key={r.id||i} style={{padding:'10px 0', borderBottom:'0.5px solid var(--color-border-tertiary)'}}>

              {/* Leave summary row */}
              <div style={{display:'flex', alignItems:'flex-start', gap:8}}>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:'var(--fs-body)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{r.className}</div>
                  <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', marginTop:2}}>
                    {r.reason}{r.date ? ` · ${r.date}` : ''}
                  </div>
                  {r.teacherNote && r.status!=='pending' && (
                    <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', marginTop:3, fontStyle:'italic'}}>
                      <i className="ti ti-message-circle" style={{marginRight:3}}/>"{r.teacherNote}"
                    </div>
                  )}
                </div>
                <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3, flexShrink:0}}>
                  <div style={{display:'flex', alignItems:'center', gap:4}}>
                    <span style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)'}}>Leave</span>
                    <span className={`pill ${s.pill}`} style={{fontSize:10}}>{s.label}</span>
                  </div>
                  {mk && (
                    <div style={{display:'flex', alignItems:'center', gap:4}}>
                      <span style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)'}}>Make up</span>
                      <span className={`pill ${MK_STATUS[mk.status]?.pill||'pill-warn'}`} style={{fontSize:10}}>
                        {MK_STATUS[mk.status]?.label || '⏳ Pending'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Makeup detail (if requested) */}
              {mk && (
                <div style={{marginTop:5, marginLeft:4, paddingLeft:8, borderLeft:'2px solid var(--color-border-secondary)', fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)'}}>
                  <span style={{fontWeight:500, color:'var(--color-text-primary)'}}>Make up:</span> {mk.className}
                  {mk.days ? ` · ${mk.days}` : ''}
                  {mk.date ? ` · ${mk.date}` : ''}
                </div>
              )}

              {/* Makeup action area (only for approved leaves) */}
              {r.status==='approved' && (
                <div style={{marginTop:7, marginLeft:4}}>
                  {justMkSubmitted ? (
                    <div style={{fontSize:'var(--fs-xs)', color:'#0C447C'}}>
                      <i className="ti ti-check" style={{marginRight:4}}/> Makeup request submitted — awaiting teacher approval.
                    </div>
                  ) : !mk ? (
                    isMkFormOpen ? (
                      /* ── Inline makeup form ── */
                      <div style={{background:'rgba(24,95,165,0.05)', border:'0.5px solid rgba(24,95,165,0.2)', borderRadius:'var(--r-sm)', padding:'8px 10px', display:'flex', flexDirection:'column', gap:'var(--sp-sm)'}}>
                        <div style={{fontSize:'var(--fs-xs)', fontWeight:500, color:'#0C447C'}}>
                          <i className="ti ti-school" style={{marginRight:4}}/>Request a makeup class
                        </div>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--sp-sm)'}}>
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
                              Preferred date <span style={{fontWeight:400, color:'var(--color-text-secondary)'}}>(optional)</span>
                            </label>
                            <input type="date" value={mkDate} onChange={e => setMkDate(e.target.value)} />
                          </div>
                        </div>
                        <div style={{display:'flex', gap:'var(--sp-sm)', justifyContent:'flex-end'}}>
                          <button className="btn" style={{fontSize:11}} onClick={() => setMakeupFormFor(null)}>Cancel</button>
                          <button className="btn btn-p" style={{fontSize:11}} disabled={!mkClass} onClick={() => submitMakeupRequest(r.id)}>
                            <i className="ti ti-send"/> Submit request
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button className="btn" style={{fontSize:11, padding:'3px 10px'}} onClick={() => openMakeupForm(r.id)}>
                        <i className="ti ti-school" style={{marginRight:4}}/>Request makeup class
                      </button>
                    )
                  ) : mk.status==='pending' ? (
                    <div style={{fontSize:'var(--fs-xs)', color:'#0C447C'}}>
                      <i className="ti ti-clock" style={{marginRight:4}}/>
                      Makeup pending approval: <strong>{mk.className}</strong>{mk.date ? ` · ${mk.date}` : ''}
                    </div>
                  ) : mk.status==='approved' ? (
                    <div style={{fontSize:'var(--fs-xs)', color:'#27500A'}}>
                      <i className="ti ti-school" style={{marginRight:4}}/>
                      Makeup approved: <strong>{mk.className}</strong>{mk.date ? ` · ${mk.date}` : ''}
                    </div>
                  ) : (
                    /* declined — offer re-request */
                    isMkFormOpen ? (
                      <div style={{background:'rgba(24,95,165,0.05)', border:'0.5px solid rgba(24,95,165,0.2)', borderRadius:'var(--r-sm)', padding:'8px 10px', display:'flex', flexDirection:'column', gap:'var(--sp-sm)'}}>
                        <div style={{fontSize:'var(--fs-xs)', fontWeight:500, color:'#0C447C'}}>
                          <i className="ti ti-school" style={{marginRight:4}}/>Request a new makeup class
                        </div>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--sp-sm)'}}>
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
                              Preferred date <span style={{fontWeight:400, color:'var(--color-text-secondary)'}}>(optional)</span>
                            </label>
                            <input type="date" value={mkDate} onChange={e => setMkDate(e.target.value)} />
                          </div>
                        </div>
                        <div style={{display:'flex', gap:'var(--sp-sm)', justifyContent:'flex-end'}}>
                          <button className="btn" style={{fontSize:11}} onClick={() => setMakeupFormFor(null)}>Cancel</button>
                          <button className="btn btn-p" style={{fontSize:11}} disabled={!mkClass} onClick={() => submitMakeupRequest(r.id)}>
                            <i className="ti ti-send"/> Submit request
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{display:'flex', alignItems:'center', gap:8}}>
                        <span style={{fontSize:'var(--fs-xs)', color:'#791F1F'}}>
                          <i className="ti ti-x" style={{marginRight:3}}/>Makeup request declined.
                        </span>
                        <button className="btn" style={{fontSize:11, padding:'3px 9px'}} onClick={() => openMakeupForm(r.id)}>
                          Try another class
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── 10-session packs ── */}
      {activePacks.length>0 && (
        <div className="card">
          <div className="card-hdr"><span className="card-title">My 10-session packs</span></div>
          {activePacks.map((pack,i) => {
            const used=pack.sessionsUsed||0, left=10-used, pct=Math.round((used/10)*100)
            const color=pct>=90?'#E24B4A':pct>=70?'#F47B20':'#E8401A'
            const done=used>=10
            const log=pack.sessionLog||[]
            return (
              <div key={pack.id||i} style={{padding:'10px 0',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <div>
                    <div style={{fontWeight:500}}>10-session pack</div>
                    <div style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)'}}>Purchased {pack.purchaseDate} · ${pack.total}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:'var(--fs-sm)',fontWeight:500,color}}>{left} left</div>
                    <div style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)'}}>{used}/10 used</div>
                  </div>
                </div>
                <div style={{background:'var(--color-background-secondary)',borderRadius:4,height:6,marginBottom:8}}>
                  <div style={{width:`${pct}%`,height:6,borderRadius:4,background:color,transition:'width 0.3s'}} />
                </div>
                <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>
                  {Array.from({length:10}).map((_,idx) => (
                    <div key={idx} title={log[idx]?.date||''} style={{
                      width:24,height:24,borderRadius:'50%',
                      background:idx<used?color:'var(--color-background-secondary)',
                      border:`1.5px solid ${idx<used?color:'var(--color-border-secondary)'}`,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:9,color:idx<used?'#fff':'var(--color-text-secondary)',fontWeight:500,
                    }}>
                      {idx<used ? <i className="ti ti-check" style={{fontSize:10}} /> : idx+1}
                    </div>
                  ))}
                </div>
                {done ? (
                  <div style={{fontSize:'var(--fs-xs)',color:'#791F1F'}}>All 10 sessions used. Purchase a new pack to continue.</div>
                ) : (
                  <button
                    className="btn btn-p"
                    style={{fontSize:'var(--fs-xs)',padding:'5px 12px'}}
                    disabled={loggingPack[pack.id]}
                    onClick={() => handleLogSession(pack.id)}
                  >
                    {loggingPack[pack.id]
                      ? <><i className="ti ti-loader-2" style={{animation:'spin 1s linear infinite'}} /> Logging…</>
                      : <><i className="ti ti-plus" /> Log a session</>
                    }
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Special dates ── */}
      <div className="card">
        <div className="card-hdr"><span className="card-title">📅 {SEMESTER.name} — Special dates</span></div>
        <div className="three-col">
          {SEMESTER.specialDates.map((d,i) => (
            <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8}}>
              <i className="ti ti-calendar-event" style={{color:'#E8401A',fontSize:15,marginTop:2,flexShrink:0}} />
              <div>
                <div style={{fontSize:'var(--fs-sm)',fontWeight:500}}>{d.label}</div>
                <div style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)'}}>{d.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
