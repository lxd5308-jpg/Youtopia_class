import { useState } from 'react'
import { CATEGORY_LABELS } from '../../data/mockData'
import { sendEmail, isEmailConfigured } from '../../utils/emailService'

const TYPE_ICON = {
  'Cancellation notice':'ti-calendar-x',
  'Rescheduled class':  'ti-calendar-event',
  'Reminder':           'ti-bell',
  'Announcement':       'ti-speakerphone',
}

export default function StudentMessages({
  classes=[], studentMessages=[], readMessageIds=[], markMessageRead,
  leaveRequests=[], enrolled=[], user, studentName, sendStudentMessage,
  teacherEmails=[], emailConfig={},
}) {
  const [msg, setMsg]         = useState('')
  const [selClass, setSelClass] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)  // { ok, text } | null

  const enrolledClasses = classes.filter(c=>enrolled.includes(c.id))
  const grouped = {}
  enrolledClasses.forEach(c=>{
    const cat=c.category||'kids'
    if(!grouped[cat]) grouped[cat]=[]
    grouped[cat].push(c)
  })

  // Find the class name associated with a message (by toClass id)
  function getClassName(m) {
    if (!m.toClass || m.toClass==='all') return 'All classes'
    const cls = classes.find(c=>c.id===Number(m.toClass))
    return cls?.name || 'Class announcement'
  }

  async function handleSend() {
    if (!msg.trim()||!selClass) return
    const cls        = classes.find(c=>c.id===Number(selClass))
    const senderName = studentName || user?.name || 'Student'
    const className  = cls?.name || ''
    const msgBody    = msg.trim()

    setSending(true); setSendResult(null)

    // Store in teacher portal inbox
    if (sendStudentMessage) {
      sendStudentMessage({
        studentName:  senderName,
        studentEmail: user?.email || '',
        classId:      Number(selClass),
        className,
        body:         msgBody,
      })
    }

    // Send directly to teacher email via EmailJS (no email client required)
    const toEmail = teacherEmails.length > 0 ? teacherEmails[0] : 'info@youtopiadanceacademy.com'
    if (isEmailConfigured(emailConfig)) {
      try {
        await sendEmail(emailConfig, {
          to:       toEmail,
          toName:   'Youtopia Dance Academy',
          fromName: senderName,
          subject:  `Message from ${senderName} — ${className}`,
          message:  `From: ${senderName} (${user?.email || ''})\nClass: ${className}\n\n${msgBody}`,
          replyTo:  user?.email || '',
        })
        setSendResult({ ok: true, text: `Message sent to the teacher at ${toEmail}.` })
      } catch (err) {
        setSendResult({ ok: false, text: 'Saved to teacher portal, but email delivery failed. The teacher can still see your message.' })
      }
    } else {
      setSendResult({ ok: true, text: 'Message saved to the teacher portal.' })
    }

    setMsg('')
    setSending(false)
    setTimeout(() => setSendResult(null), 5000)
  }

  function handleOpenMsg(msgId) {
    if (!readMessageIds.includes(msgId)) markMessageRead(msgId)
  }

  const unreadCount = studentMessages.filter(m=>!readMessageIds.includes(m.id)).length

  return (
    <>
      {/* ── Inbox ─────────────────────────────────────── */}
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">Messages from teacher</span>
          {unreadCount>0
            ? <span className="pill pill-info">{unreadCount} unread</span>
            : studentMessages.length>0 ? <span style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)'}}>All read</span> : null
          }
        </div>

        {studentMessages.length===0 ? (
          <div style={{textAlign:'center',padding:'var(--sp-lg) 0',color:'var(--color-text-secondary)',fontSize:'var(--fs-sm)'}}>
            <i className="ti ti-inbox" style={{fontSize:28,display:'block',marginBottom:8,opacity:.4}} />
            No messages yet. Class announcements will appear here.
          </div>
        ) : studentMessages.slice().reverse().map(m=>{
          const isRead  = readMessageIds.includes(m.id)
          const icon    = TYPE_ICON[m.type]||'ti-mail'
          const clsName = getClassName(m)
          return (
            <div key={m.id}
              onClick={()=>handleOpenMsg(m.id)}
              style={{
                padding:'12px 0',borderBottom:'0.5px solid var(--color-border-tertiary)',
                display:'flex',gap:12,alignItems:'flex-start',cursor:'pointer',
                opacity: isRead ? 0.75 : 1,
              }}
            >
              <div style={{width:34,height:34,borderRadius:'50%',background:isRead?'var(--color-background-secondary)':'rgba(232,64,26,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,position:'relative'}}>
                <i className={`ti ${icon}`} style={{color:isRead?'var(--color-text-secondary)':'#E8401A',fontSize:16}} />
                {!isRead && (
                  <span style={{position:'absolute',top:0,right:0,width:8,height:8,background:'#E8401A',borderRadius:'50%',border:'1.5px solid white'}} />
                )}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:4}}>
                  <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                    <span className="pill pill-info" style={{fontSize:10}}>{m.type}</span>
                    <span style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)'}}>
                      <i className="ti ti-calendar" style={{marginRight:3}} />{clsName}
                    </span>
                    {isRead && <span style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)'}}>· Read</span>}
                  </div>
                  <span style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)',whiteSpace:'nowrap'}}>{m.sentAt}</span>
                </div>
                <div style={{fontSize:'var(--fs-body)',lineHeight:1.6,fontWeight:isRead?400:500}}>{m.body}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Message teacher ──────────────────────────── */}
      <div className="card">
        <div className="card-hdr"><span className="card-title">Message your teacher</span></div>
        {enrolledClasses.length===0 ? (
          <div style={{fontSize:'var(--fs-sm)',color:'var(--color-text-secondary)',padding:'var(--sp-sm) 0'}}>
            <i className="ti ti-info-circle" style={{color:'#F47B20',marginRight:6}} />
            Enroll in a class first to message the teacher.
          </div>
        ) : (
          <>
            <div style={{marginBottom:'var(--sp-sm)'}}>
              <label className="form-label">Class *</label>
              <select value={selClass} onChange={e=>setSelClass(e.target.value)}>
                <option value="">— Select class —</option>
                {Object.entries(grouped).map(([cat,cls])=>(
                  <optgroup key={cat} label={CATEGORY_LABELS[cat]||cat}>
                    {cls.map(c=><option key={c.id} value={c.id}>{c.name} ({c.days})</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div style={{marginBottom:'var(--sp-sm)'}}>
              <label className="form-label">Message</label>
              <textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder="e.g. My child won't be able to attend this week." />
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:'var(--sp-sm)'}}>
              <button className="btn btn-p" onClick={handleSend} disabled={sending||!msg.trim()||!selClass}>
                {sending
                  ? <><i className="ti ti-loader-2" style={{animation:'spin 1s linear infinite'}} /> Sending…</>
                  : <><i className="ti ti-send" /> Send</>
                }
              </button>
            </div>
            {sendResult && (
              <div style={{marginTop:'var(--sp-sm)',fontSize:'var(--fs-sm)',padding:'var(--sp-xs) var(--sp-md)',borderRadius:'var(--r-sm)',
                background: sendResult.ok ? 'rgba(59,109,17,0.08)' : 'rgba(245,184,0,0.08)',
                color:      sendResult.ok ? '#27500A' : '#633806',
                border:     `0.5px solid ${sendResult.ok ? 'rgba(59,109,17,0.25)' : 'rgba(245,184,0,0.35)'}`,
              }}>
                <i className={`ti ${sendResult.ok ? 'ti-check' : 'ti-alert-triangle'}`} style={{marginRight:5}} />
                {sendResult.text}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Leave request status ─────────────────────── */}
      {leaveRequests.length>0 && (
        <div className="card">
          <div className="card-hdr">
            <span className="card-title">My leave requests</span>
            <span className="pill pill-warn">{leaveRequests.filter(r=>r.status==='pending').length} pending</span>
          </div>
          {leaveRequests.slice().reverse().map((r,i)=>(
            <div className="row" key={r.id||i} style={{gap:12}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.className}</div>
                <div style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)',marginTop:2}}>{r.reason}{r.date?` · ${r.date}`:''}</div>
              </div>
              <span className={`pill ${r.status==='approved'?'pill-ok':r.status==='denied'?'pill-no':'pill-warn'}`}>
                {r.status==='approved'?'✓ Approved':r.status==='denied'?'✗ Denied':'⏳ Pending'}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
