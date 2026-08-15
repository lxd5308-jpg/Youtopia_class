import { useState, useEffect } from 'react'
import { SEMESTER } from '../../data/mockData'

function localeToISO(str) {
  const d = new Date(str)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m-1, d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
}

const DAY_ABBR = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }

// classes[].days is a free-text field like "周二 Tue" (or "Any" for the
// drop-in class) — pull out the recognizable weekday abbreviation(s) so a
// leave request's session date can be checked against it. Returns null when
// the field doesn't name a specific day (e.g. "Any"), meaning don't restrict.
function classDayIndices(days) {
  const matches = String(days || '').match(/Sun|Mon|Tue|Wed|Thu|Fri|Sat/gi)
  return matches ? matches.map(m => DAY_ABBR[m[0].toUpperCase() + m.slice(1).toLowerCase()]) : null
}

// iso is a "YYYY-MM-DD" string from <input type="date">. Parsing that with
// `new Date(iso)` reads it as UTC midnight, which getDay() can then report as
// the *previous* day in any timezone behind UTC — construct from parts instead.
function isoDayIndex(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

// True only when the class names specific day(s) and the picked date lands on
// none of them — a class with no specific day ("Any") is never restricted.
function leaveDateMismatch(days, iso) {
  if (!iso) return false
  const allowed = classDayIndices(days)
  return allowed !== null && !allowed.includes(isoDayIndex(iso))
}

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

// Competition Team classes are never a valid makeup target, and fee/deposit
// line items (no days/time) aren't real classes.
function makeupOptions(classes) {
  return classes.filter(c => (c.days || c.time) && c.category !== 'comp')
}
function makeupFee(classes, currentClassName, newClassName) {
  const cur = classes.find(c => c.name === currentClassName)
  const nw  = classes.find(c => c.name === newClassName)
  return (cur && nw) ? Math.max(0, (nw.fee || 0) - (cur.fee || 0)) : 0
}

function MakeupForm({ leaveId, currentClassName, isRedo, mkClass, mkDate, classes, setMkClass, setMkDate, setMakeupFormFor, submitMakeupRequest }) {
  const fee = mkClass ? makeupFee(classes, currentClassName, mkClass) : 0
  // Preferred date is for the *makeup* class's own schedule, not the class
  // being missed — look up its days, not currentClassName's.
  const selectedClass = mkClass ? classes.find(c => c.name === mkClass) : null
  const dateMismatch   = !!mkDate && leaveDateMismatch(selectedClass?.days, mkDate)
  return (
    <div style={{background:'rgba(24,95,165,0.05)', border:'0.5px solid rgba(24,95,165,0.2)', borderRadius:'var(--r-sm)', padding:'8px 10px', display:'flex', flexDirection:'column', gap:'var(--sp-sm)'}}>
      <div style={{fontSize:'var(--fs-xs)', fontWeight:500, color:'#0C447C'}}>
        <i className="ti ti-school" style={{marginRight:4}}/>{isRedo ? 'Request a new makeup class' : 'Request a makeup class'}
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--sp-sm)'}}>
        <div>
          <label className="form-label">Class to attend *</label>
          <select value={mkClass} onChange={e => setMkClass(e.target.value)}>
            <option value="">— Select class —</option>
            {makeupOptions(classes).map(c => (
              <option key={c.id} value={c.name}>{c.name} ({c.days})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">
            Preferred date <span style={{fontWeight:400, color:'var(--color-text-secondary)'}}>(optional)</span>
          </label>
          <input type="date" value={mkDate} onChange={e => setMkDate(e.target.value)} />
          {dateMismatch && (
            <div style={{fontSize:'var(--fs-xs)', color:'#E8401A', marginTop:4}}>
              <i className="ti ti-alert-triangle" style={{marginRight:3}}/>{mkClass} meets {selectedClass?.days} — pick a matching date.
            </div>
          )}
        </div>
      </div>
      {fee > 0 && (
        <div style={{fontSize:'var(--fs-xs)', color:'#B25E14', background:'rgba(244,123,32,0.08)', border:'0.5px solid rgba(244,123,32,0.25)', borderRadius:'var(--r-sm)', padding:'6px 10px', lineHeight:1.5}}>
          <i className="ti ti-alert-triangle" style={{marginRight:4}}/>
          {mkClass} costs more than {currentClassName || 'your current class'} — an additional <strong>${fee}</strong> fee will apply.
        </div>
      )}
      <div style={{display:'flex', gap:'var(--sp-sm)', justifyContent:'flex-end'}}>
        <button className="btn" style={{fontSize:11}} onClick={() => setMakeupFormFor(null)}>Cancel</button>
        <button className="btn btn-p" style={{fontSize:11}} disabled={!mkClass || dateMismatch} onClick={() => submitMakeupRequest(leaveId)}>
          <i className="ti ti-send"/> Submit request
        </button>
      </div>
    </div>
  )
}

export default function StudentDashboard({
  navigate, classes=[], cart=[], enrolled=[], pendingEnroll=[], sessionPacks=[],
  leaveRequests=[], studentName, setStudentName, user, logSession, editSessionDate, deleteSession,
  submitLeave, requestMakeup, studentLoading,
}) {
  const [nameInput, setNameInput] = useState(studentName || '')
  const [editingName, setEditingName] = useState(false)

  // Only prompt for name if loading finishes and no name is set yet
  useEffect(() => {
    if (!studentLoading && !studentName) setEditingName(true)
  }, [studentLoading, studentName])

  // Sync input when name loads from Firestore
  useEffect(() => {
    if (studentName) setNameInput(studentName)
  }, [studentName])
  const [loggingPack, setLoggingPack] = useState({})
  const [selMins, setSelMins]         = useState({})
  const [selTeacher, setSelTeacher]   = useState({})
  const [selDate, setSelDate]         = useState({})
  const [editingEntry,   setEditingEntry]   = useState(null)  // {packId, index}
  const [editEntryDate,  setEditEntryDate]  = useState('')    // ISO string
  const [editEntryTeacher, setEditEntryTeacher] = useState('')
  const [editEntryMins,  setEditEntryMins]  = useState('')
  const [deletingEntry,  setDeletingEntry]  = useState(null)  // {packId, index}

  function openEditEntry(packId, index, currentDate, currentTeacher, currentHours) {
    setEditingEntry({ packId, index })
    setEditEntryDate(localeToISO(currentDate))
    setEditEntryTeacher(currentTeacher || '')
    setEditEntryMins(String(Math.round((currentHours ?? 1) * 60)))
  }
  function saveEditEntry() {
    if (!editingEntry || !editEntryDate) return
    const newHours = parseFloat((Number(editEntryMins || 60) / 60).toFixed(2))
    editSessionDate(editingEntry.packId, editingEntry.index, fmtDate(editEntryDate), user?.email, editEntryTeacher.trim(), newHours)
    setEditingEntry(null)
  }

  // Leave request state (keyed by classId)
  const [leaveFormFor,   setLeaveFormFor]   = useState(null)
  const [leaveReason,    setLeaveReason]    = useState('')
  const [leaveDate,      setLeaveDate]      = useState('')
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
  const today                = new Date().toISOString().slice(0, 10)

  function handleLogSession(packId) {
    const pack      = activePacks.find(p => p.id === packId)
    const used      = parseFloat((pack?.sessionsUsed || 0).toFixed(2))
    const remaining = parseFloat(Math.max(0, 10 - used).toFixed(2))
    const mins      = Number(selMins[packId] || 60)
    const requested = parseFloat((mins / 60).toFixed(2))
    const hours     = parseFloat(Math.min(requested, remaining).toFixed(2))
    const teacher   = (selTeacher[packId] || '').trim()
    const date      = fmtDate(selDate[packId] || today)
    setLoggingPack(l => ({ ...l, [packId]: true }))
    logSession(packId, user?.email, user?.name, hours, teacher, date)
    setTimeout(() => {
      setLoggingPack(l => ({ ...l, [packId]: false }))
      setSelMins(m => ({ ...m, [packId]: '' }))
      setSelTeacher(t => ({ ...t, [packId]: '' }))
      setSelDate(dd => ({ ...dd, [packId]: '' }))
    }, 800)
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
    setLeaveDate('')
  }

  function handleSubmitLeave(cls) {
    if (!leaveReason.trim()) return
    const req = {
      id:           Date.now(),
      studentName:  studentName || user?.name || 'Student',
      studentEmail: user?.email || '',
      className:    cls.name,
      reason:       leaveReason.trim(),
      sessionDate:  leaveDate || '',
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
      {editingName && (
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
          <div className="stat-label">10-hour packs</div>
          <div className="stat-val">{activePacks.length}</div>
          <div className="stat-sub">
            {activePacks.length===0 ? 'None active' : `${parseFloat(activePacks.reduce((s,p)=>s+(10-(p.sessionsUsed||0)),0).toFixed(1))} hrs left`}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Leave requests</div>
          <div className="stat-val" style={{color:leaveRequests.length>0?'#F47B20':'var(--color-text-primary)'}}>{leaveRequests.length}</div>
          <div className="stat-sub">{leaveRequests.length>0 ? `${leaveRequests.length} logged` : 'None logged'}</div>
        </div>
      </div>

      {/* Cart prompt */}
      {cart.length>0 && (
        <div onClick={() => navigate('shub')} style={{background:'rgba(232,64,26,0.08)',border:'1px solid rgba(232,64,26,0.25)',borderRadius:'var(--r-md)',padding:'var(--sp-md) var(--sp-lg)',display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
          <i className="ti ti-shopping-cart" style={{fontSize:20,color:'#E8401A'}} />
          <div style={{flex:1}}>
            <div style={{fontWeight:500,color:'#E8401A'}}>{cart.length} item{cart.length>1?'s':''} in your cart</div>
            <div style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)',marginTop:2}}>Upload your receipt to confirm your purchase.</div>
          </div>
          <button className="btn btn-p" style={{fontSize:'var(--fs-sm)'}}>Checkout →</button>
        </div>
      )}

      {/* ── My Classes (with inline leave request) ── */}
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">My classes ({enrolledClasses.length})</span>
          <button className="btn" onClick={() => navigate('sschedule')}>Browse classes</button>
        </div>

        {enrolledClasses.length===0 ? (
          <div style={{textAlign:'center',padding:'var(--sp-lg) 0',color:'var(--color-text-secondary)',fontSize:'var(--fs-sm)'}}>
            <i className="ti ti-calendar-off" style={{fontSize:28,display:'block',marginBottom:8,opacity:.4}} />
            Not enrolled yet. <span style={{cursor:'pointer',color:'#E8401A',textDecoration:'underline'}} onClick={() => navigate('sschedule')}>Browse classes</span> to sign up.
          </div>
        ) : (
          <>
            {enrolledClasses.map(c => {
              const isFormOpen    = leaveFormFor === c.id
              const justSubmitted = leaveSubmitted[c.id]
              const dateMismatch  = isFormOpen && leaveDateMismatch(c.days, leaveDate)
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
                    <div style={{marginTop:10, marginLeft:18, background:'var(--color-background-secondary)', borderRadius:'var(--r-sm)', padding:'var(--sp-sm) var(--sp-md)', display:'flex', flexDirection:'column', gap:8}}>
                      <div style={{fontSize:'var(--fs-xs)', fontWeight:500, color:'var(--color-text-primary)'}}>
                        <i className="ti ti-calendar-minus" style={{marginRight:4, color:'#E8401A'}}/> Request leave — <em>{c.name}</em>
                      </div>
                      <div>
                        <label className="form-label">Session date *</label>
                        <input type="date" value={leaveDate} onChange={e => setLeaveDate(e.target.value)} style={{maxWidth:180}} />
                        {dateMismatch && (
                          <div style={{fontSize:'var(--fs-xs)', color:'#E8401A', marginTop:4}}>
                            <i className="ti ti-alert-triangle" style={{marginRight:3}}/>This class meets {c.days} — pick a matching date.
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="form-label">Reason *</label>
                        <textarea
                          value={leaveReason}
                          onChange={e => setLeaveReason(e.target.value)}
                          placeholder="e.g. Doctor's appointment, sick, travel…"
                          rows={2}
                          style={{minHeight:'unset', resize:'none'}}
                        />
                      </div>
                      <div style={{display:'flex', gap:'var(--sp-sm)', justifyContent:'flex-end'}}>
                        <button className="btn" style={{fontSize:12}} onClick={() => setLeaveFormFor(null)}>Cancel</button>
                        <button className="btn btn-p" style={{fontSize:12}} disabled={!leaveReason.trim() || !leaveDate || dateMismatch} onClick={() => handleSubmitLeave(c)}>
                          <i className="ti ti-send" /> Submit
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Flash confirmation */}
                  {justSubmitted && (
                    <div style={{marginTop:6, marginLeft:18, fontSize:'var(--fs-xs)', color:'#27500A'}}>
                      <i className="ti ti-check" style={{marginRight:4}}/> Leave logged.
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
                  {mk.fee > 0 ? ` · +$${mk.fee} fee` : ''}
                </div>
              )}

              {/* Makeup action area (only for approved leaves) */}
              {r.status==='approved' && (
                <div style={{marginTop:7, marginLeft:4}}>
                  {justMkSubmitted ? (
                    <div style={{fontSize:'var(--fs-xs)', color:'#27500A'}}>
                      <i className="ti ti-check" style={{marginRight:4}}/> Makeup class requested.
                    </div>
                  ) : !mk ? (
                    isMkFormOpen ? (
                      <MakeupForm leaveId={r.id} currentClassName={r.className} isRedo={false}
                        mkClass={mkClass} mkDate={mkDate} classes={classes}
                        setMkClass={setMkClass} setMkDate={setMkDate}
                        setMakeupFormFor={setMakeupFormFor}
                        submitMakeupRequest={submitMakeupRequest}
                      />
                    ) : (
                      <button className="btn" style={{fontSize:11, padding:'3px 10px'}} onClick={() => openMakeupForm(r.id)}>
                        <i className="ti ti-school" style={{marginRight:4}}/>Request makeup class
                      </button>
                    )
                  ) : mk.status==='pending' ? (
                    <div style={{fontSize:'var(--fs-xs)', color:'#0C447C'}}>
                      <i className="ti ti-clock" style={{marginRight:4}}/>
                      Makeup pending approval: <strong>{mk.className}</strong>{mk.date ? ` · ${mk.date}` : ''}{mk.fee > 0 && <span> · +${mk.fee} fee</span>}
                    </div>
                  ) : mk.status==='approved' ? (
                    <div style={{fontSize:'var(--fs-xs)', color:'#27500A'}}>
                      <i className="ti ti-school" style={{marginRight:4}}/>
                      Makeup approved: <strong>{mk.className}</strong>{mk.date ? ` · ${mk.date}` : ''}{mk.fee > 0 && <span> · +${mk.fee} fee</span>}
                    </div>
                  ) : (
                    /* declined — offer re-request */
                    isMkFormOpen ? (
                      <MakeupForm leaveId={r.id} currentClassName={r.className} isRedo={true}
                        mkClass={mkClass} mkDate={mkDate} classes={classes}
                        setMkClass={setMkClass} setMkDate={setMkDate}
                        setMakeupFormFor={setMakeupFormFor}
                        submitMakeupRequest={submitMakeupRequest}
                      />
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

      {/* ── 10-hour packs ── */}
      {activePacks.length>0 && (
        <div className="card">
          <div className="card-hdr"><span className="card-title">My 10-hour packs</span></div>
          {activePacks.map((pack,i) => {
            const used = parseFloat((pack.sessionsUsed||0).toFixed(1))
            const left = parseFloat((10-used).toFixed(1))
            const pct  = Math.min(Math.round((used/10)*100), 100)
            const color = pct>=90?'#E24B4A':pct>=70?'#F47B20':'#E8401A'
            const done        = used >= 10
            const log         = pack.sessionLog || []
            const inputMins   = Number(selMins[pack.id] || 60)
            const requested   = parseFloat((inputMins / 60).toFixed(2))
            const wouldExceed = !done && requested > left
            const overflow    = wouldExceed ? parseFloat((requested - left).toFixed(2)) : 0
            return (
              <div key={pack.id||i} style={{padding:'10px 0',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <div>
                    <div style={{fontWeight:500}}>10-hour pack</div>
                    <div style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)'}}>Purchased {pack.purchaseDate} · ${pack.total}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:'var(--fs-sm)',fontWeight:500,color}}>{left} hrs left</div>
                    <div style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)'}}>{used}/10 hrs used</div>
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{background:'var(--color-background-secondary)',borderRadius:4,height:6,marginBottom:8}}>
                  <div style={{width:`${pct}%`,height:6,borderRadius:4,background:color,transition:'width 0.3s'}} />
                </div>
                {/* Session history */}
                {log.length > 0 && (
                  <div style={{background:'var(--color-background-secondary)',borderRadius:'var(--r-sm)',padding:'var(--sp-xs) var(--sp-sm)',marginBottom:8}}>
                    <div style={{fontSize:'var(--fs-xs)',fontWeight:500,color:'var(--color-text-secondary)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>History</div>
                    {log.map((entry,j) => {
                      const isEditingThis = editingEntry?.packId === pack.id && editingEntry?.index === j
                      return (
                        <div key={j} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)',padding:'3px 0',gap:6}}>
                          <span style={{color:'var(--color-text-primary)'}}>
                            Session {j+1}{entry.teacher ? <span style={{fontWeight:400,color:'var(--color-text-secondary)'}}> · {entry.teacher}</span> : ''}
                          </span>
                          <span style={{display:'flex',alignItems:'center',gap:4,flexWrap:'wrap',justifyContent:'flex-end'}}>
                            {isEditingThis ? (
                              <>
                                <input
                                  type="number"
                                  min={1}
                                  max={600}
                                  value={editEntryMins}
                                  onChange={e => setEditEntryMins(e.target.value)}
                                  style={{fontSize:'var(--fs-xs)',padding:'1px 4px',width:52}}
                                />
                                <span style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)'}}>min</span>
                                <input
                                  type="date"
                                  value={editEntryDate}
                                  max={new Date().toISOString().slice(0,10)}
                                  onChange={e => setEditEntryDate(e.target.value)}
                                  style={{fontSize:'var(--fs-xs)',padding:'1px 4px',width:110}}
                                />
                                <input
                                  type="text"
                                  placeholder="Teacher"
                                  value={editEntryTeacher}
                                  onChange={e => setEditEntryTeacher(e.target.value)}
                                  style={{fontSize:'var(--fs-xs)',padding:'1px 4px',width:90}}
                                />
                                <button onClick={saveEditEntry} style={{fontSize:'var(--fs-xs)',padding:'1px 6px',background:'#27500A',color:'#fff',border:'none',borderRadius:3,cursor:'pointer'}}>Save</button>
                                <button onClick={() => setEditingEntry(null)} style={{fontSize:'var(--fs-xs)',padding:'1px 6px',background:'none',border:'0.5px solid var(--color-border-tertiary)',borderRadius:3,cursor:'pointer'}}>Cancel</button>
                              </>
                            ) : deletingEntry?.packId === pack.id && deletingEntry?.index === j ? (
                              <>
                                <span style={{fontSize:'var(--fs-xs)',color:'#791F1F'}}>Delete?</span>
                                <button onClick={() => { deleteSession(pack.id, j, user?.email); setDeletingEntry(null) }} style={{fontSize:'var(--fs-xs)',padding:'1px 6px',background:'#791F1F',color:'#fff',border:'none',borderRadius:3,cursor:'pointer'}}>Yes</button>
                                <button onClick={() => setDeletingEntry(null)} style={{fontSize:'var(--fs-xs)',padding:'1px 6px',background:'none',border:'0.5px solid var(--color-border-tertiary)',borderRadius:3,cursor:'pointer'}}>No</button>
                              </>
                            ) : (
                              <>
                                {entry.hours != null ? `${entry.hours} hr${entry.hours!==1?'s':''}` : '1 hr'} · {entry.date}
                                <button onClick={() => openEditEntry(pack.id, j, entry.date, entry.teacher, entry.hours)} style={{background:'none',border:'none',cursor:'pointer',padding:'0 2px',color:'var(--color-text-secondary)',lineHeight:1}} title="Edit">
                                  <i className="ti ti-pencil" style={{fontSize:11}} />
                                </button>
                                <button onClick={() => setDeletingEntry({ packId: pack.id, index: j })} style={{background:'none',border:'none',cursor:'pointer',padding:'0 2px',color:'var(--color-text-secondary)',lineHeight:1}} title="Delete">
                                  <i className="ti ti-trash" style={{fontSize:11}} />
                                </button>
                              </>
                            )}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
                {done ? (
                  <div style={{fontSize:'var(--fs-xs)',color:'#791F1F'}}>All 10 hours used. Purchase a new pack to continue.</div>
                ) : (
                  <>
                    {wouldExceed && (
                      <div style={{background:'rgba(245,184,0,0.1)',border:'0.5px solid rgba(245,184,0,0.5)',borderRadius:'var(--r-sm)',padding:'6px 10px',marginBottom:6,fontSize:'var(--fs-xs)',color:'#633806',lineHeight:1.6}}>
                        <i className="ti ti-alert-triangle" style={{marginRight:4}}/>
                        Only <strong>{left} hr{left!==1?'s':''}</strong> left in this pack — the button will log {left} hr{left!==1?'s':''} to complete it.
                        Purchase a new pack to log the remaining <strong>{overflow} hr{overflow!==1?'s':''}</strong>.
                      </div>
                    )}
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <input
                        type="number"
                        min={1}
                        max={600}
                        placeholder="60"
                        value={selMins[pack.id] ?? ''}
                        onChange={e => setSelMins(m => ({...m, [pack.id]: e.target.value}))}
                        style={{width:80,fontSize:'var(--fs-xs)',padding:'4px 8px'}}
                      />
                      <span style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)'}}>min</span>
                      <input
                        type="text"
                        placeholder="Teacher (optional)"
                        value={selTeacher[pack.id] ?? ''}
                        onChange={e => setSelTeacher(t => ({...t, [pack.id]: e.target.value}))}
                        style={{width:140,fontSize:'var(--fs-xs)',padding:'4px 8px'}}
                      />
                      <span style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)'}}>Class date</span>
                      <input
                        type="date"
                        value={selDate[pack.id] || today}
                        max={today}
                        onChange={e => setSelDate(d => ({...d, [pack.id]: e.target.value}))}
                        style={{width:120, fontSize:'var(--fs-xs)',padding:'4px 8px'}}
                      />
                      <button
                        className="btn btn-p"
                        style={{fontSize:'var(--fs-xs)',padding:'5px 12px', ...(wouldExceed ? {background:'#F47B20',borderColor:'#F47B20'} : {})}}
                        disabled={loggingPack[pack.id]}
                        onClick={() => handleLogSession(pack.id)}
                      >
                        {loggingPack[pack.id]
                          ? <><i className="ti ti-loader-2" style={{animation:'spin 1s linear infinite'}} /> Logging…</>
                          : wouldExceed
                            ? <><i className="ti ti-alert-triangle" /> Log {left} hr{left!==1?'s':''} only</>
                            : <><i className="ti ti-plus" /> Log hours</>
                        }
                      </button>
                    </div>
                  </>
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
