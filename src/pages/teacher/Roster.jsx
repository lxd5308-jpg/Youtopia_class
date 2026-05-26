import { useRef } from 'react'
import { CATEGORY_LABELS } from '../../data/mockData'

export default function Roster({ classes=[], enrollments=[], teacherLeaves=[] }) {
  const tableRef = useRef(null)

  // Build flat roster rows
  const rows = enrollments.map(e => {
    const cls      = classes.find(c=>c.id===e.classId)
    const leaves      = teacherLeaves.filter(l=>l.studentEmail===e.studentEmail && l.className===e.className)
    const makeupCount = leaves.filter(l=>l.makeup?.status==='approved').length
    const cat         = cls?.category || 'kids'
    return {
      studentName:  e.studentName,
      studentEmail: e.studentEmail,
      className:    e.className || cls?.name || `Class #${e.classId}`,
      category:     CAT_LABELS[cat] || cat,
      day:          cls?.days || '—',
      time:         cls?.time || '—',
      pkgType:      PKG_LABEL[e.pkgType] || e.pkgType,
      enrolledAt:   e.enrolledAt,
      leavesCount:  leaves.length,
      makeupCount,
    }
  })

  // Sort by class name then student name
  rows.sort((a,b) => a.className.localeCompare(b.className) || a.studentName.localeCompare(b.studentName))

  function downloadCSV() {
    const header = ['Student Name','Email','Class','Category','Day','Time','Package','Enrolled','Leaves','Make Up Classes']
    const csvRows = [header, ...rows.map(r => [
      r.studentName, r.studentEmail, r.className, r.category,
      r.day, r.time, r.pkgType, r.enrolledAt, r.leavesCount, r.makeupCount,
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
        <div className="card-hdr">
          <span className="card-title">Student roster</span>
          <button className="btn btn-p" onClick={downloadCSV}><i className="ti ti-download" /> Download CSV</button>
        </div>

        {rows.length===0 ? (
          <div style={{textAlign:'center',padding:'var(--sp-lg) 0',color:'var(--color-text-secondary)',fontSize:'var(--fs-sm)'}}>
            <i className="ti ti-users" style={{fontSize:28,display:'block',marginBottom:8,opacity:.4}} />
            No enrolled students yet. Students appear here after payment is confirmed.
          </div>
        ) : (
          <div className="att-table-wrap" style={{overflowX:'auto', WebkitOverflowScrolling:'touch'}}>
            <table ref={tableRef} style={{width:'100%',borderCollapse:'collapse',fontSize:'var(--fs-sm)',fontFamily:'var(--font)'}}>
              <thead>
                <tr style={{borderBottom:'1.5px solid var(--color-border-tertiary)'}}>
                  {['Student','Email','Class','Category','Day / Time','Package','Enrolled','Leaves','Make Up Classes'].map(h => (
                    <th key={h} style={{textAlign:'left',padding:'6px 10px',color:'var(--color-text-secondary)',fontWeight:500,whiteSpace:'nowrap',fontSize:'var(--fs-xs)',textTransform:'uppercase',letterSpacing:'.04em'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r,i) => (
                  <tr key={i} style={{borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
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
                        ? <span className="pill pill-warn">{r.leavesCount} leave{r.leavesCount>1?'s':''}</span>
                        : <span style={{color:'var(--color-text-secondary)'}}>—</span>
                      }
                    </td>
                    <td style={{padding:'9px 10px'}}>
                      {r.makeupCount > 0
                        ? <span style={{fontSize:'var(--fs-xs)',padding:'2px 8px',borderRadius:10,background:'rgba(59,109,17,0.1)',color:'#27500A',fontWeight:500}}>
                            {r.makeupCount} makeup{r.makeupCount>1?'s':''}
                          </span>
                        : <span style={{color:'var(--color-text-secondary)'}}>—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
