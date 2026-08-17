import { useRef, useState, Fragment } from 'react'
import { CATEGORY_LABELS } from '../../data/mockData'

export default function Roster({ classes=[], enrollments=[], teacherLeaves=[], switchStudentClass, dropStudentClass, classChangeLog=[], pendingPayments=[] }) {
  const tableRef = useRef(null)
  const [action,   setAction]   = useState(null)  // { type:'switch'|'drop', studentEmail, studentName, classId, className }
  const [target,   setTarget]   = useState('')    // selected new classId (switch only)
  const [note,     setNote]     = useState('')
  const [busy,     setBusy]     = useState(false)
  const [search,   setSearch]   = useState('')
  const [expanded, setExpanded] = useState(null)  // "studentEmail__classId" of the row showing leave/makeup detail

  // Build flat roster rows, keeping the underlying leave/makeup records (not
  // just counts) so the detail panel and CSV export can show date + reason.
  const rows = enrollments.map(e => {
    // String() guards a classId type mismatch (number vs string). But the
    // deeper issue: a class can be deleted from Configuration while students
    // are still enrolled in it (deleteClass does no such check), which
    // orphans the classId forever — there is no live class left to find.
    // Newer enrollment docs carry their own days/time/instructor/category/fee
    // snapshot (written at enrollment time) so the Roster survives later
    // edits or deletion of the class; the live lookup is only a fallback for
    // enrollment docs written before that snapshot existed.
    const cls      = classes.find(c=>String(c.id)===String(e.classId))
    const leaves      = teacherLeaves.filter(l=>l.studentEmail===e.studentEmail && l.className===e.className)
    const makeupCount = leaves.filter(l=>l.makeup?.status==='approved').length
    const cat         = e.category || cls?.category || 'kids'
    return {
      key:          `${e.studentEmail}__${e.classId}`,
      studentName:  e.studentName,
      studentEmail: e.studentEmail,
      classId:      e.classId,
      className:    e.className || cls?.name || `Class #${e.classId}`,
      category:     CAT_LABELS[cat] || cat,
      day:          e.days || cls?.days || '—',
      time:         e.time || cls?.time || '—',
      pkgType:      PKG_LABEL[e.pkgType] || e.pkgType,
      fee:          e.fee ?? cls?.fee ?? null,
      enrolledAt:   e.enrolledAt,
      leaves,
      leavesCount:  leaves.length,
      makeupCount,
    }
  })

  // Sort by class name then student name
  rows.sort((a,b) => a.className.localeCompare(b.className) || a.studentName.localeCompare(b.studentName))

  const q = search.trim().toLowerCase()
  const filteredRows = !q ? rows : rows.filter(r =>
    r.studentName.toLowerCase().includes(q) ||
    r.studentEmail.toLowerCase().includes(q) ||
    r.className.toLowerCase().includes(q)
  )

  // A dropped class has no enrollment row left to expand, so its history
  // (and any payment made for it) has to live somewhere that survives the
  // row disappearing — this list, independent of current enrollment state.
  const historyRows = (!q ? classChangeLog : classChangeLog.filter(h =>
    (h.studentName||'').toLowerCase().includes(q) ||
    (h.studentEmail||'').toLowerCase().includes(q) ||
    (h.fromClassName||'').toLowerCase().includes(q) ||
    (h.toClassName||'').toLowerCase().includes(q)
  )).slice().reverse()

  // Payments aren't linked to an enrollment by ID — match by studentEmail +
  // the item's className, the same key the CSV/Roster join already uses.
  // Only 'confirmed'/'refunded' actually represent money that changed hands —
  // a 'rejected' payment never happened, and a 'pending' one hasn't been
  // confirmed yet, so neither belongs in a "$X paid for this class" total.
  function paymentsFor(studentEmail, className) {
    const matches = []
    for (const p of pendingPayments) {
      if (p.studentEmail !== studentEmail) continue
      if (p.status !== 'confirmed' && p.status !== 'refunded') continue
      for (const item of (p.items||[])) {
        if (item.className === className) {
          matches.push({
            price: item.price || 0, status: p.status, submittedAt: p.submittedAt,
            refundAmount: p.refundAmount, refundedAt: p.refundedAt,
          })
        }
      }
    }
    return matches
  }

  function toggleExpanded(key) {
    setExpanded(prev => prev === key ? null : key)
  }

  // Classes the student isn't already enrolled in, for the "switch to" picker.
  // Fee/deposit line items (no days/time) are not real classes and never show here.
  function switchOptions(row) {
    const theirClassIds = new Set(
      enrollments.filter(e => e.studentEmail === row.studentEmail).map(e => String(e.classId))
    )
    return classes.filter(c => (c.days || c.time) && !theirClassIds.has(String(c.id)))
  }

  function openSwitch(row) {
    setAction({ type:'switch', ...row })
    setTarget('')
    setNote('')
  }
  function openDrop(row) {
    setAction({ type:'drop', ...row })
    setTarget('')
    setNote('')
  }
  function closeAction() {
    if (busy) return
    setAction(null)
  }

  async function confirmAction() {
    if (!action) return
    setBusy(true)
    try {
      if (action.type === 'switch') {
        if (!target) return
        await switchStudentClass(action.studentEmail, action.studentName, action.classId, Number(target), note)
      } else {
        await dropStudentClass(action.studentEmail, action.studentName, action.classId, note)
      }
      setAction(null)
    } finally {
      setBusy(false)
    }
  }

  function downloadCSV() {
    const header = ['Student Name','Email','Class','Category','Day','Time','Package','Enrolled','Leaves','Make Up Classes','Leave Details','Makeup Details']
    const csvRows = [header, ...filteredRows.map(r => [
      r.studentName, r.studentEmail, r.className, r.category,
      r.day, r.time, r.pkgType, r.enrolledAt, r.leavesCount, r.makeupCount,
      r.leaves.map(l => `${l.date||''}: ${l.reason||''} [${l.status}]`).join('; '),
      r.leaves.filter(l => l.makeup).map(l =>
        `${l.makeup.className||''}${l.makeup.date?` on ${l.makeup.date}`:''} [${l.makeup.status}]${l.makeup.fee>0?` +$${l.makeup.fee}`:''}`
      ).join('; '),
    ])]
    const csv = csvRows.map(r => r.map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], {type:'text/csv'})
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href=url; a.download='youtopia-roster.csv'; a.click()
    URL.revokeObjectURL(url)
  }


  const uniqueStudents = new Set(enrollments.map(e=>e.studentEmail)).size

  return (
    <>
      <div className="stat-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        <div className="stat-card"><div className="stat-label">Total students</div><div className="stat-val">{uniqueStudents}</div><div className="stat-sub">Unique accounts</div></div>
        <div className="stat-card"><div className="stat-label">Total enrollments</div><div className="stat-val">{enrollments.length}</div><div className="stat-sub">Class slots filled</div></div>
        <div className="stat-card"><div className="stat-label">Classes with students</div><div className="stat-val">{new Set(enrollments.map(e=>e.classId)).size}</div><div className="stat-sub">of {classes.length} total</div></div>
      </div>

      <div className="card">
        <div className="card-hdr" style={{flexWrap:'wrap',gap:'var(--sp-sm)'}}>
          <span className="card-title">Student roster</span>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search student, email or class…"
              style={{padding:'6px 10px',fontSize:'var(--fs-sm)',borderRadius:'var(--r-sm)',border:'1px solid var(--color-border-tertiary)',background:'var(--color-background)',fontFamily:'var(--font)',width:220,maxWidth:'100%'}}
            />
            <button className="btn btn-p" onClick={downloadCSV}><i className="ti ti-download" /> Download CSV</button>
          </div>
        </div>

        {rows.length===0 ? (
          <div style={{textAlign:'center',padding:'var(--sp-lg) 0',color:'var(--color-text-secondary)',fontSize:'var(--fs-sm)'}}>
            <i className="ti ti-users" style={{fontSize:28,display:'block',marginBottom:8,opacity:.4}} />
            No enrolled students yet. Students appear here after payment is confirmed.
          </div>
        ) : filteredRows.length===0 ? (
          <div style={{textAlign:'center',padding:'var(--sp-lg) 0',color:'var(--color-text-secondary)',fontSize:'var(--fs-sm)'}}>
            <i className="ti ti-search-off" style={{fontSize:28,display:'block',marginBottom:8,opacity:.4}} />
            No students match "{search}".
          </div>
        ) : (
          <div className="att-table-wrap" style={{overflowX:'auto', WebkitOverflowScrolling:'touch'}}>
            <table ref={tableRef} style={{width:'100%',borderCollapse:'collapse',fontSize:'var(--fs-sm)',fontFamily:'var(--font)'}}>
              <thead>
                <tr style={{borderBottom:'1.5px solid var(--color-border-tertiary)'}}>
                  {['Student','Email','Class','Category','Day / Time','Package','Enrolled','Leaves','Make Up Classes','Actions'].map(h => (
                    <th key={h} style={{textAlign:'left',padding:'6px 10px',color:'var(--color-text-secondary)',fontWeight:500,whiteSpace:'nowrap',fontSize:'var(--fs-xs)',textTransform:'uppercase',letterSpacing:'.04em'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(r => {
                  const isExpanded = expanded === r.key
                  const hasDetail  = r.leavesCount > 0
                  return (
                  <Fragment key={r.key}>
                    <tr style={{borderBottom: isExpanded ? 'none' : '0.5px solid var(--color-border-tertiary)'}}>
                      <td style={{padding:'9px 10px',fontWeight:500}}>{r.studentName}</td>
                      <td style={{padding:'9px 10px',color:'var(--color-text-secondary)'}}>{r.studentEmail}</td>
                      <td style={{padding:'9px 10px'}}>{r.className}</td>
                      <td style={{padding:'9px 10px'}}>
                        <span style={{fontSize:'var(--fs-xs)',padding:'2px 8px',borderRadius:10,...CAT_STYLE[r.category]}}>{r.category}</span>
                      </td>
                      <td style={{padding:'9px 10px',color:'var(--color-text-secondary)',whiteSpace:'nowrap'}}>{r.day}<br/><span style={{fontSize:'var(--fs-xs)'}}>{r.time}</span></td>
                      <td style={{padding:'9px 10px'}}>{r.pkgType}</td>
                      <td style={{padding:'9px 10px',color:'var(--color-text-secondary)',whiteSpace:'nowrap'}}>{r.enrolledAt}</td>
                      <td style={{padding:'9px 10px'}}>
                        {r.leavesCount > 0
                          ? <span className="pill pill-warn" style={{cursor:'pointer'}} onClick={() => toggleExpanded(r.key)}>
                              {r.leavesCount} leave{r.leavesCount>1?'s':''} {isExpanded ? '▲' : '▼'}
                            </span>
                          : <span style={{color:'var(--color-text-secondary)'}}>—</span>
                        }
                      </td>
                      <td style={{padding:'9px 10px'}}>
                        {r.makeupCount > 0
                          ? <span style={{fontSize:'var(--fs-xs)',padding:'2px 8px',borderRadius:10,background:'rgba(59,109,17,0.1)',color:'#27500A',fontWeight:500,cursor:'pointer'}} onClick={() => toggleExpanded(r.key)}>
                              {r.makeupCount} makeup{r.makeupCount>1?'s':''}
                            </span>
                          : <span style={{color:'var(--color-text-secondary)'}}>—</span>
                        }
                      </td>
                      <td style={{padding:'9px 10px',whiteSpace:'nowrap'}}>
                        <div style={{display:'flex',gap:6,flexWrap:'nowrap'}}>
                          {hasDetail && (
                            <button className="btn" style={{padding:'4px 10px',fontSize:'var(--fs-xs)',flexShrink:0}} onClick={() => toggleExpanded(r.key)}>
                              <i className={`ti ti-${isExpanded ? 'chevron-up' : 'chevron-down'}`} /> Detail
                            </button>
                          )}
                          <button className="btn" style={{padding:'4px 10px',fontSize:'var(--fs-xs)',flexShrink:0}} onClick={() => openSwitch(r)}>
                            <i className="ti ti-transfer" /> Switch
                          </button>
                          <button className="btn btn-warn" style={{padding:'4px 10px',fontSize:'var(--fs-xs)',flexShrink:0}} onClick={() => openDrop(r)}>
                            <i className="ti ti-user-minus" /> Drop
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                        <td colSpan={10} style={{padding:'0 10px 12px', background:'var(--color-background-secondary)'}}>
                          <div style={{display:'flex',flexDirection:'column',gap:8,paddingTop:8}}>
                            {r.leaves.map(l => (
                              <div key={l.id} style={{background:'var(--color-background)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--r-sm)',padding:'8px 10px'}}>
                                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                                  {l.date && <span style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)'}}>{l.date}</span>}
                                  <span className={`pill ${l.status==='approved'?'pill-ok':l.status==='denied'?'pill-no':'pill-warn'}`} style={{fontSize:10}}>
                                    {l.status==='approved' ? '✓ Approved' : l.status==='denied' ? '✗ Declined' : '⏳ Pending'}
                                  </span>
                                </div>
                                {l.reason && (
                                  <div style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)',marginTop:4,lineHeight:1.5}}>{l.reason}</div>
                                )}
                                {l.teacherNote && (
                                  <div style={{fontSize:'var(--fs-xs)',fontStyle:'italic',marginTop:3,lineHeight:1.5}}>Note: "{l.teacherNote}"</div>
                                )}
                                {l.makeup && (
                                  <div style={{fontSize:'var(--fs-xs)',color:'#0C447C',marginTop:5,paddingTop:5,borderTop:'0.5px solid var(--color-border-tertiary)',lineHeight:1.6}}>
                                    <i className="ti ti-school" style={{marginRight:4}}/>
                                    Makeup: <strong>{l.makeup.className}</strong>
                                    {l.makeup.instructor && <span> · 👤 {l.makeup.instructor}</span>}
                                    {l.makeup.date && <span> · {l.makeup.date}</span>}
                                    {l.makeup.fee > 0 && <span style={{color:'#B25E14',fontWeight:500}}> · +${l.makeup.fee} fee</span>}
                                    <span style={{color:'var(--color-text-secondary)'}}> · {l.makeup.status}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-hdr">
          <span className="card-title">Class change history</span>
          <span style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)'}}>{historyRows.length} of {classChangeLog.length}</span>
        </div>

        {classChangeLog.length===0 ? (
          <div style={{textAlign:'center',padding:'var(--sp-lg) 0',color:'var(--color-text-secondary)',fontSize:'var(--fs-sm)'}}>
            <i className="ti ti-history" style={{fontSize:28,display:'block',marginBottom:8,opacity:.4}} />
            No class switches or drops yet. When you use Switch or Drop above, it shows up here —
            including for a dropped class after its roster row is gone.
          </div>
        ) : historyRows.length===0 ? (
          <div style={{textAlign:'center',padding:'var(--sp-lg) 0',color:'var(--color-text-secondary)',fontSize:'var(--fs-sm)'}}>
            <i className="ti ti-search-off" style={{fontSize:28,display:'block',marginBottom:8,opacity:.4}} />
            No history matches "{search}".
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {historyRows.map(h => {
              const payMatches = h.type==='drop' ? paymentsFor(h.studentEmail, h.fromClassName) : []
              const payTotal   = payMatches.reduce((s,m)=>s+m.price, 0)
              return (
                <div key={h.id} style={{border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--r-sm)',padding:'8px 10px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    <span style={{fontWeight:500}}>{h.studentName}</span>
                    <span className={`pill ${h.type==='drop'?'pill-no':'pill-info'}`} style={{fontSize:10}}>
                      {h.type==='drop' ? 'Dropped' : 'Switched'}
                    </span>
                    {h.date && <span style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)'}}>{h.date}</span>}
                  </div>
                  <div style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)',marginTop:4}}>
                    {h.type==='drop'
                      ? <>Dropped <strong>{h.fromClassName || 'a class'}</strong></>
                      : <><strong>{h.fromClassName || 'a class'}</strong> → <strong>{h.toClassName || 'a class'}</strong></>
                    }
                  </div>
                  {h.note && (
                    <div style={{fontSize:'var(--fs-xs)',fontStyle:'italic',marginTop:3}}>Note: "{h.note}"</div>
                  )}
                  {h.type==='drop' && (() => {
                    const allRefunded = payMatches.length>0 && payMatches.every(m=>m.status==='refunded')
                    const anyRefunded = payMatches.some(m=>m.status==='refunded')
                    const refundedAmt = payMatches.filter(m=>m.status==='refunded').reduce((s,m)=>s+(m.refundAmount??m.price),0)
                    const color = payMatches.length===0 ? 'var(--color-text-secondary)' : allRefunded ? '#27500A' : '#B25E14'
                    return (
                      <div style={{fontSize:'var(--fs-xs)',color,marginTop:5,paddingTop:5,borderTop:'0.5px solid var(--color-border-tertiary)'}}>
                        <i className={`ti ti-${allRefunded ? 'circle-check' : 'cash'}`} style={{marginRight:4}}/>
                        {payMatches.length===0
                          ? 'No payment on file for this class'
                          : allRefunded
                            ? <>${refundedAmt} refunded — nothing outstanding</>
                            : anyRefunded
                              ? <>${payTotal} paid, ${refundedAmt} refunded so far — go to Payments to finish it</>
                              : <>${payTotal} paid for this class, not yet refunded — go to Payments to refund</>
                        }
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {action && (
        <div
          role="dialog" aria-modal="true"
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',padding:'var(--sp-md)',zIndex:1000}}
          onClick={closeAction}
        >
          <div
            className="card"
            style={{width:'92%',maxWidth:420,margin:0}}
            onClick={e => e.stopPropagation()}
          >
            <div className="card-hdr">
              <span className="card-title">
                {action.type === 'switch' ? 'Switch class' : 'Drop from class'}
              </span>
            </div>

            <div style={{fontSize:'var(--fs-sm)',marginBottom:'var(--sp-md)',lineHeight:1.6}}>
              <span><strong>{action.studentName}</strong> — {action.className}</span>
            </div>

            {action.type === 'switch' ? (
              <div style={{marginBottom:'var(--sp-md)'}}>
                <label style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)',display:'block',marginBottom:4}}>
                  New class
                </label>
                <select
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                  style={{width:'100%',padding:'8px 10px',fontSize:'var(--fs-sm)',borderRadius:'var(--r-sm)',border:'1px solid var(--color-border-tertiary)',background:'var(--color-background)',fontFamily:'var(--font)'}}
                >
                  <option value="">Select a class…</option>
                  {switchOptions(action).map(c => (
                    <option key={c.id} value={c.id}>{c.name} — {c.days} {c.time}</option>
                  ))}
                </select>
                {target && (() => {
                  const toClass  = classes.find(c => String(c.id) === String(target))
                  const fromFee  = action.fee
                  const toFee    = toClass?.fee ?? null
                  const feeDiff  = (fromFee != null && toFee != null) ? toFee - fromFee : null
                  const payMatches = paymentsFor(action.studentEmail, action.className)
                  const payTotal    = payMatches.reduce((s,m)=>s+m.price, 0)
                  if (feeDiff == null && payTotal === 0) return null
                  return (
                    <div style={{fontSize:'var(--fs-xs)',color: feeDiff ? '#B25E14' : 'var(--color-text-secondary)',background: feeDiff ? 'rgba(244,123,32,0.08)' : 'var(--color-background-secondary)',border:`0.5px solid ${feeDiff ? 'rgba(244,123,32,0.25)' : 'var(--color-border-tertiary)'}`,borderRadius:'var(--r-sm)',padding:'8px 10px',marginTop:8,lineHeight:1.6}}>
                      <i className="ti ti-cash" style={{marginRight:4}}/>
                      {feeDiff != null && (
                        <span>${fromFee}/session → ${toFee}/session{feeDiff !== 0 ? <strong> ({feeDiff>0?'+':''}${feeDiff}/session)</strong> : ' (same price)'}. </span>
                      )}
                      {payTotal > 0 && (
                        <span>${payTotal} already paid for {action.className} — switching doesn't adjust this automatically; reconcile any difference in Payments.</span>
                      )}
                    </div>
                  )
                })()}
              </div>
            ) : (
              <div style={{marginBottom:'var(--sp-md)'}}>
                <div style={{fontSize:'var(--fs-sm)',color:'var(--color-text-secondary)',lineHeight:1.6,marginBottom:8}}>
                  This removes the student from the class roster and their enrolled list. This does not
                  affect any separate 10-hour package hours, which aren't tied to a specific class.
                </div>
                {(() => {
                  const payMatches  = paymentsFor(action.studentEmail, action.className)
                  const payTotal    = payMatches.reduce((s,m)=>s+m.price, 0)
                  const allRefunded = payMatches.length>0 && payMatches.every(m=>m.status==='refunded')
                  const anyRefunded = payMatches.some(m=>m.status==='refunded')
                  return payMatches.length > 0 ? (
                    <div style={{fontSize:'var(--fs-xs)',color: allRefunded ? '#27500A' : '#B25E14',background: allRefunded ? 'rgba(59,109,17,0.06)' : 'rgba(244,123,32,0.08)',border: `0.5px solid ${allRefunded ? 'rgba(59,109,17,0.25)' : 'rgba(244,123,32,0.25)'}`,borderRadius:'var(--r-sm)',padding:'8px 10px',lineHeight:1.6}}>
                      <i className={`ti ti-${allRefunded ? 'circle-check' : 'cash'}`} style={{marginRight:4}}/>
                      ${payTotal} paid for this class across {payMatches.length} payment{payMatches.length>1?'s':''}
                      ({payMatches.map(m=>m.status).join(', ')}).{' '}
                      {allRefunded
                        ? 'Already fully refunded.'
                        : anyRefunded
                          ? 'Partially refunded — dropping does not refund the rest automatically, handle it in Payments.'
                          : 'Dropping does not refund it automatically — handle any refund separately in Payments.'
                      }
                    </div>
                  ) : (
                    <div style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)'}}>
                      <i className="ti ti-cash-off" style={{marginRight:4}}/>No payment on file for this class.
                    </div>
                  )
                })()}
              </div>
            )}

            <div style={{marginBottom:'var(--sp-md)'}}>
              <label style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)',display:'block',marginBottom:4}}>
                Note (optional)
              </label>
              <input
                type="text" value={note} onChange={e => setNote(e.target.value)}
                placeholder="e.g. reason for the change"
                style={{width:'100%',padding:'8px 10px',fontSize:'var(--fs-sm)',borderRadius:'var(--r-sm)',border:'1px solid var(--color-border-tertiary)',background:'var(--color-background)',fontFamily:'var(--font)'}}
              />
            </div>

            <div style={{display:'flex',gap:8,justifyContent:'flex-end',flexWrap:'wrap'}}>
              <button className="btn" onClick={closeAction} disabled={busy}>Cancel</button>
              <button
                className="btn btn-p"
                onClick={confirmAction}
                disabled={busy || (action.type === 'switch' && !target)}
              >
                {busy ? 'Saving…' : action.type === 'switch' ? 'Switch class' : 'Drop student'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const CAT_LABELS = { kids:'少儿部', adult:'成人部', comp:'Competition' }
const PKG_LABEL  = { full:'Full semester', dropin:'Drop-in', '10pack':'10-session pack' }
const CAT_STYLE  = {
  '少儿部':      {background:'#FAE0D9',color:'#712B13'},
  '成人部':      {background:'#E6F1FB',color:'#042C53'},
  'Competition': {background:'#FEF2DD',color:'#412402'},
}
