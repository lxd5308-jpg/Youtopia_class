import { useState } from 'react'
import { CATEGORY_LABELS } from '../../data/mockData'
import { sendEmailToMany, isEmailConfigured } from '../../utils/emailService'

export default function Messages({ classes=[], teacherLeaves=[], resolveLeave, enrollments=[], sendTeacherMessage, sentMessages=[], studentInbox=[], emailConfig={} }) {
  const [msg, setMsg]         = useState('')
  const [selClass, setSelClass] = useState('all')
  const [msgType, setMsgType] = useState('Cancellation notice')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)  // { sent, failed[] } | null
  const [leaveTab, setLeaveTab] = useState('pending')
  const [mainTab, setMainTab] = useState('compose')

  const grouped = {}
  classes.forEach(c => {
    const cat = c.category||'kids'
    if (!grouped[cat]) grouped[cat]=[]
    grouped[cat].push(c)
  })

  // Who will receive this message
  const targetEnrollments = selClass==='all'
    ? enrollments
    : enrollments.filter(e => e.classId===Number(selClass))
  const recipientEmails = [...new Set(targetEnrollments.map(e => e.studentEmail))].filter(Boolean)
  const recipientNames  = [...new Set(targetEnrollments.map(e => e.studentName))].filter(Boolean)

  // Unique recipients with name for EmailJS
  const recipientList = [...new Map(
    targetEnrollments.filter(e=>e.studentEmail).map(e=>[e.studentEmail, {email:e.studentEmail, name:e.studentName}])
  ).values()]

  const pending  = (teacherLeaves||[]).filter(r => r.status==='pending')
  const resolved = (teacherLeaves||[]).filter(r => r.status!=='pending')
  const leavesDisplayed = leaveTab==='pending' ? pending : resolved

  const emailReady = isEmailConfigured(emailConfig) && recipientList.length > 0

  async function handleSend() {
    if (!msg.trim()) return
    setSending(true); setSendResult(null)

    // Always record in the portal
    sendTeacherMessage({
      toClass:    selClass,
      type:       msgType,
      body:       msg.trim(),
      recipients: recipientEmails,
    })

    // Send via EmailJS if configured
    if (isEmailConfigured(emailConfig) && recipientList.length > 0) {
      const clsLabel = selClass === 'all' ? 'All Students' : (classes.find(c=>c.id===Number(selClass))?.name || 'Class')
      const result = await sendEmailToMany(emailConfig, recipientList, {
        fromName: 'Youtopia Dance Academy',
        subject:  `[${msgType}] ${clsLabel}`,
        message:  msg.trim(),
      })
      setSendResult(result)
    }

    setMsg('')
    setSending(false)
    setTimeout(() => setSendResult(null), 6000)
  }

  const selectedCls = selClass!=='all' ? classes.find(c=>c.id===Number(selClass)) : null

  return (
    <>
      {/* Main tab bar */}
      <div style={{display:'flex', gap:6, marginBottom:0}}>
        {[
          {v:'compose', label:'Send message',    icon:'ti-send'},
          {v:'leaves',  label:`Leave requests ${pending.length>0?`(${pending.length})`:''}`, icon:'ti-calendar-minus'},
          {v:'student', label:`From students${studentInbox.length>0?` (${studentInbox.length})`:''}`, icon:'ti-message-circle-2'},
          {v:'sent',    label:`Sent (${sentMessages.length})`, icon:'ti-inbox'},
        ].map(t => (
          <button key={t.v} className="btn" onClick={() => setMainTab(t.v)} style={{
            background:  mainTab===t.v?'#E8401A':'transparent',
            color:       mainTab===t.v?'#fff':'var(--color-text-primary)',
            borderColor: mainTab===t.v?'#E8401A':'var(--color-border-secondary)',
          }}>
            <i className={`ti ${t.icon}`} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── COMPOSE ─────────────────────────────────────────── */}
      {mainTab==='compose' && (
        <div className="card">
          <div className="card-hdr"><span className="card-title">Send message to students</span></div>

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--sp-sm)', marginBottom:'var(--sp-sm)'}}>
            <div>
              <label className="form-label">Class</label>
              <select value={selClass} onChange={e => setSelClass(e.target.value)}>
                <option value="all">All enrolled students</option>
                {Object.entries(grouped).map(([cat,cls]) => (
                  <optgroup key={cat} label={CATEGORY_LABELS[cat]||cat}>
                    {cls.map(c => <option key={c.id} value={c.id}>{c.name} ({c.days})</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Type</label>
              <select value={msgType} onChange={e => setMsgType(e.target.value)}>
                <option>Cancellation notice</option>
                <option>Rescheduled class</option>
                <option>Reminder</option>
                <option>Announcement</option>
              </select>
            </div>
          </div>

          {/* Recipient preview */}
          <div style={{background:'var(--color-background-secondary)', borderRadius:'var(--r-sm)', padding:'var(--sp-sm) var(--sp-md)', marginBottom:'var(--sp-sm)', fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', lineHeight:1.6}}>
            {recipientEmails.length===0 ? (
              <span><i className="ti ti-info-circle" /> No enrolled students{selClass!=='all'?' in this class':''} yet — message won't be delivered.</span>
            ) : (
              <><i className="ti ti-users" /> <strong style={{color:'var(--color-text-primary)'}}>{recipientEmails.length} student{recipientEmails.length>1?'s':''}</strong>: {recipientNames.join(', ')}</>
            )}
          </div>

          {/* Email service status */}
          {!isEmailConfigured(emailConfig) && recipientEmails.length > 0 && (
            <div style={{background:'rgba(245,184,0,0.08)',border:'0.5px solid rgba(245,184,0,0.4)',borderRadius:'var(--r-sm)',padding:'var(--sp-xs) var(--sp-md)',marginBottom:'var(--sp-sm)',fontSize:'var(--fs-xs)',color:'#633806',lineHeight:1.6}}>
              <i className="ti ti-alert-triangle" style={{marginRight:5}} />
              Email service not configured — message will be saved to the student portal but <strong>no email will be sent</strong>. Set up EmailJS in <strong>Configuration</strong> to enable direct email delivery.
            </div>
          )}

          <div style={{marginBottom:'var(--sp-sm)'}}>
            <label className="form-label">Message</label>
            <textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder="e.g. Level 3 C3 on Tuesday is cancelled this week. See you next week!" />
          </div>

          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'var(--sp-sm)'}}>
            <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', display:'flex', alignItems:'center', gap:6}}>
              <i className="ti ti-mail" style={{color:'#E8401A'}} />
              {isEmailConfigured(emailConfig) ? 'Sends directly to student email inboxes' : 'Appears in student portal only'}
            </div>
            <button className="btn btn-p" onClick={handleSend} disabled={sending || !msg.trim() || recipientEmails.length===0}>
              {sending
                ? <><i className="ti ti-loader-2" style={{animation:'spin 1s linear infinite'}} /> Sending…</>
                : <><i className="ti ti-send" /> Send to {recipientEmails.length} student{recipientEmails.length!==1?'s':''}</>
              }
            </button>
          </div>

          {sendResult && (
            <div style={{marginTop:'var(--sp-sm)', fontSize:'var(--fs-sm)', borderRadius:'var(--r-sm)', padding:'var(--sp-sm) var(--sp-md)',
              background: sendResult.failed.length===0 ? 'rgba(59,109,17,0.08)' : 'rgba(245,184,0,0.08)',
              color:      sendResult.failed.length===0 ? '#27500A' : '#633806',
              border:     `0.5px solid ${sendResult.failed.length===0 ? 'rgba(59,109,17,0.25)' : 'rgba(245,184,0,0.4)'}`,
            }}>
              {sendResult.failed.length === 0
                ? <><i className="ti ti-check" /> Email delivered to {sendResult.sent} student{sendResult.sent!==1?'s':''}. Also saved in their portal.</>
                : <><i className="ti ti-alert-triangle" /> Sent: {sendResult.sent} · Failed: {sendResult.failed.map(f=>f.email).join(', ')}</>
              }
            </div>
          )}
        </div>
      )}

      {/* ── LEAVE REQUESTS ──────────────────────────────────── */}
      {mainTab==='leaves' && (
        <div className="card">
          <div className="card-hdr">
            <span className="card-title">Student leave requests</span>
            <div style={{display:'flex', gap:6}}>
              {[{v:'pending',label:`Pending (${pending.length})`},{v:'resolved',label:`Resolved (${resolved.length})`}].map(t => (
                <button key={t.v} className="btn" onClick={() => setLeaveTab(t.v)} style={{
                  fontSize:'var(--fs-xs)', padding:'4px 10px',
                  background: leaveTab===t.v?'#E8401A':'transparent',
                  color:      leaveTab===t.v?'#fff':'var(--color-text-primary)',
                  borderColor:leaveTab===t.v?'#E8401A':'var(--color-border-secondary)',
                }}>{t.label}</button>
              ))}
            </div>
          </div>
          {leavesDisplayed.length===0 ? (
            <div style={{textAlign:'center', padding:'var(--sp-lg) 0', color:'var(--color-text-secondary)', fontSize:'var(--fs-sm)'}}>
              <i className="ti ti-checks" style={{fontSize:24, display:'block', marginBottom:8, opacity:.4}} />
              No {leaveTab} leave requests.
            </div>
          ) : leavesDisplayed.slice().reverse().map(r => (
            <div className="row" key={r.id} style={{gap:10, alignItems:'flex-start', padding:'10px 0'}}>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:'var(--fs-body)', fontWeight:500}}>{r.studentName||'Student'} — {r.className}</div>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', marginTop:2}}>
                  {r.reason}{r.date?` · ${r.date}`:''}
                </div>
              </div>
              {r.status==='pending' ? (
                <div style={{display:'flex', gap:5, flexShrink:0}}>
                  <button className="btn" style={{fontSize:11, padding:'3px 8px', borderColor:'#27500A', color:'#27500A'}} onClick={() => resolveLeave(r.id,'approved')}>Approve</button>
                  <button className="btn" style={{fontSize:11, padding:'3px 8px', color:'#791F1F', borderColor:'#791F1F'}} onClick={() => resolveLeave(r.id,'denied')}>Deny</button>
                </div>
              ) : (
                <span className={`pill ${r.status==='approved'?'pill-ok':'pill-no'}`}>{r.status==='approved'?'✓ Approved':'✗ Denied'}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── STUDENT MESSAGES ────────────────────────────────── */}
      {mainTab==='student' && (
        <div className="card">
          <div className="card-hdr">
            <span className="card-title">Messages from students</span>
            {studentInbox.length>0 && <span style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)'}}>{studentInbox.length} message{studentInbox.length!==1?'s':''}</span>}
          </div>
          {studentInbox.length===0 ? (
            <div style={{textAlign:'center', padding:'var(--sp-lg) 0', color:'var(--color-text-secondary)', fontSize:'var(--fs-sm)'}}>
              <i className="ti ti-message-circle-off" style={{fontSize:24, display:'block', marginBottom:8, opacity:.4}} />
              No messages from students yet.
            </div>
          ) : studentInbox.slice().reverse().map(m => (
            <div key={m.id} style={{padding:'12px 0', borderBottom:'0.5px solid var(--color-border-tertiary)', display:'flex', gap:12, alignItems:'flex-start'}}>
              <div style={{width:36,height:36,borderRadius:'50%',background:'rgba(232,64,26,0.08)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <i className="ti ti-user" style={{color:'#E8401A',fontSize:16}} />
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    <span style={{fontWeight:500,fontSize:'var(--fs-body)'}}>{m.studentName||'Student'}</span>
                    {m.className && (
                      <span style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)'}}>
                        <i className="ti ti-calendar" style={{marginRight:3}} />{m.className}
                      </span>
                    )}
                  </div>
                  <span style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)',whiteSpace:'nowrap'}}>{m.sentAt}</span>
                </div>
                <div style={{fontSize:'var(--fs-body)',lineHeight:1.6,color:'var(--color-text-primary)'}}>{m.body}</div>
                {m.studentEmail && (
                  <div style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)',marginTop:4}}>{m.studentEmail}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SENT MESSAGES ───────────────────────────────────── */}
      {mainTab==='sent' && (
        <div className="card">
          <div className="card-hdr"><span className="card-title">Sent messages</span></div>
          {sentMessages.length===0 ? (
            <div style={{textAlign:'center', padding:'var(--sp-lg) 0', color:'var(--color-text-secondary)', fontSize:'var(--fs-sm)'}}>
              <i className="ti ti-inbox" style={{fontSize:24, display:'block', marginBottom:8, opacity:.4}} />
              No messages sent yet.
            </div>
          ) : sentMessages.slice().reverse().map(m => (
            <div key={m.id} style={{padding:'12px 0', borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4}}>
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  <span className="pill pill-info" style={{fontSize:10}}>{m.type}</span>
                  <span style={{fontSize:'var(--fs-sm)', color:'var(--color-text-secondary)'}}>
                    → {m.recipients?.length||0} student{(m.recipients?.length||0)!==1?'s':''}
                  </span>
                </div>
                <span style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)'}}>{m.sentAt}</span>
              </div>
              <div style={{fontSize:'var(--fs-body)', fontFamily:'var(--font)'}}>{m.body}</div>
            </div>
          ))}
        </div>
      )}

    </>
  )
}
