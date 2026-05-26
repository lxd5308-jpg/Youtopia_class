import { CATEGORY_LABELS } from '../../data/mockData'

const DAY_ORDER = ['周一 Mon','周二 Tue','周三 Wed','周四 Thu','周五 Fri','周六 Sat','周日 Sun','Any']

export default function Schedule({ classes = [], navigate, enrollments = [] }) {
  const enrollCountByClass = {}
  const studentsByClass = {}
  ;(enrollments || []).forEach(e => {
    enrollCountByClass[e.classId] = (enrollCountByClass[e.classId] || 0) + 1
    if (!studentsByClass[e.classId]) studentsByClass[e.classId] = []
    studentsByClass[e.classId].push(e.studentName)
  })

  if (classes.length === 0) {
    return (
      <div className="card" style={{textAlign:'center', padding:'var(--sp-lg)'}}>
        <i className="ti ti-calendar-off" style={{fontSize:36, color:'var(--color-text-secondary)', display:'block', marginBottom:'var(--sp-sm)', opacity:.4}} />
        <div style={{fontSize:'var(--fs-body)', fontWeight:500, marginBottom:8}}>No classes scheduled yet</div>
        <button className="btn btn-p" onClick={() => navigate('tupload')}><i className="ti ti-upload" /> Upload schedule</button>
      </div>
    )
  }

  const grouped = {}
  classes.forEach(c => {
    const cat = c.category || 'kids'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(c)
  })
  Object.keys(grouped).forEach(cat =>
    grouped[cat].sort((a, b) => DAY_ORDER.indexOf(a.days) - DAY_ORDER.indexOf(b.days))
  )

  return (
    <>
      {Object.entries(grouped).map(([cat, cls]) => (
        <div className="card" key={cat}>
          <div className="card-hdr">
            <span className="card-title">{CATEGORY_LABELS[cat] || cat}</span>
            <span style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)'}}>{cls.length} classes</span>
          </div>
          {cls.map(c => {
            const count = enrollCountByClass[c.id] || 0
            const students = studentsByClass[c.id] || []
            return (
              <div key={c.id} style={{padding:'10px 0', borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                <div style={{display:'flex', alignItems:'center', gap:12}}>
                  <span className="dot" style={{background:c.color}} />
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:'var(--fs-body)', fontWeight:500, fontFamily:'var(--font)'}}>{c.name}</div>
                    <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)', marginTop:2}}>
                      {c.days} · {c.time} · {c.duration}
                      {c.instructor ? ` · 👤 ${c.instructor}` : ''}
                    </div>
                  </div>
                  <div style={{textAlign:'right', flexShrink:0}}>
                    <div style={{fontSize:'var(--fs-sm)', fontWeight:500}}>${c.fee}<span style={{fontWeight:400, color:'var(--color-text-secondary)'}}>/session</span></div>
                    <div style={{fontSize:'var(--fs-xs)', color:'var(--color-text-secondary)'}}>{c.sessions} sessions · ${c.fee * c.sessions} total</div>
                  </div>
                  <div style={{textAlign:'right', flexShrink:0, minWidth:80}}>
                    <div style={{fontSize:'var(--fs-sm)', fontWeight:500, color: count > 0 ? '#27500A' : 'var(--color-text-secondary)'}}>
                      {count} student{count !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                {students.length > 0 && (
                  <div style={{paddingLeft:20, marginTop:6, display:'flex', flexWrap:'wrap', gap:4}}>
                    {students.map((name, i) => (
                      <span key={i} style={{fontSize:10, background:'rgba(59,109,17,0.1)', color:'#27500A', padding:'2px 8px', borderRadius:10, fontFamily:'var(--font)'}}>
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}

      <div className="card">
        <div className="card-hdr"><span className="card-title">Private lessons</span></div>
        <div className="row"><span style={{flex:1}}>1-person private lesson</span><span style={{fontWeight:500}}>$120 / hr</span></div>
        <div className="row"><span style={{flex:1}}>2-person private lesson</span><span style={{fontWeight:500}}>$160 / hr</span></div>
        <div className="row"><span style={{flex:1}}>3-person private lesson</span><span style={{fontWeight:500}}>$180 / hr</span></div>
        <div className="row"><span style={{flex:1}}>Choreography (编舞)</span><span style={{fontWeight:500}}>+$300 one-time</span></div>
        <div className="row"><span style={{flex:1}}>Studio rental</span><span style={{fontWeight:500}}>$70 / hr</span></div>
        <div style={{marginTop:'var(--sp-sm)',background:'rgba(24,95,165,0.06)',border:'0.5px solid rgba(24,95,165,0.2)',borderRadius:'var(--r-sm)',padding:'var(--sp-sm) var(--sp-md)',fontSize:'var(--fs-xs)',color:'#0C447C',lineHeight:1.6}}>
          <i className="ti ti-info-circle" /> Contact the studio to purchase private lessons: <strong>info@youtopiadanceacademy.com</strong>
        </div>
      </div>
    </>
  )
}
