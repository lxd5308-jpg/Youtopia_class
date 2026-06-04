export default function Packages({ classes=[], enrollments=[], teacherSessionPacks=[], navigate }) {
  const packs = teacherSessionPacks || []

  // Group packs: exhausted (used >= 10) separate for notification banner
  const exhaustedPacks = packs.filter(p => (p.sessionsUsed||0) >= 10)
  const activePacks    = packs.filter(p => (p.sessionsUsed||0) < 10)

  return (
    <>
      {/* ── Exhaustion alert banner ───────────────────────────── */}
      {exhaustedPacks.length > 0 && (
        <div style={{background:'rgba(226,75,74,0.08)',border:'1px solid rgba(226,75,74,0.3)',borderRadius:'var(--r-md)',padding:'var(--sp-md) var(--sp-lg)',display:'flex',alignItems:'flex-start',gap:12}}>
          <i className="ti ti-bell-ringing" style={{fontSize:20,color:'#E24B4A',flexShrink:0,marginTop:2}} />
          <div style={{flex:1}}>
            <div style={{fontWeight:500,color:'#791F1F',marginBottom:4}}>
              {exhaustedPacks.length} student{exhaustedPacks.length!==1?'s have':' has'} used all 10 hours
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {exhaustedPacks.map((p,i) => (
                <span key={p.id||i} style={{fontSize:'var(--fs-xs)',padding:'2px 10px',borderRadius:20,background:'rgba(226,75,74,0.12)',color:'#791F1F',fontFamily:'var(--font)'}}>
                  {p.studentName || p.studentEmail || 'Unknown'} — all 10 hrs used
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 10-Hour Packs ──────────────────────────────── */}
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">10-hour packs</span>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {exhaustedPacks.length > 0 && (
              <span className="pill pill-no" style={{fontSize:10}}>{exhaustedPacks.length} exhausted</span>
            )}
            <span style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)'}}>{packs.length} total</span>
          </div>
        </div>

        {packs.length===0 ? (
          <div style={{textAlign:'center',padding:'var(--sp-lg) 0',color:'var(--color-text-secondary)',fontSize:'var(--fs-sm)'}}>
            <i className="ti ti-package" style={{fontSize:28,display:'block',marginBottom:8,opacity:.4}} />
            No 10-hour packs yet. They appear here once a student purchases one and you confirm payment.
          </div>
        ) : (
          <>
            {/* Active packs first, then exhausted */}
            {[...activePacks, ...exhaustedPacks].map((pack,i) => {
              const used        = parseFloat((pack.sessionsUsed||0).toFixed(1))
              const left        = parseFloat((10-used).toFixed(1))
              const pct         = Math.min(Math.round((used/10)*100), 100)
              const color       = used>=10?'#E24B4A':pct>=80?'#F47B20':'#E8401A'
              const done        = used >= 10
              const log         = pack.sessionLog || []
              const displayName = pack.studentName || pack.studentEmail || 'Unknown student'
              const initials    = displayName.split(' ').map(n=>n[0]||'').join('').slice(0,2).toUpperCase()

              return (
                <div key={pack.id||i} style={{padding:'16px 0',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                    {/* Avatar */}
                    <div style={{width:36,height:36,borderRadius:'50%',background:done?'#E24B4A':'#E8401A',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:600,flexShrink:0}}>
                      {initials}
                    </div>

                    <div style={{flex:1,minWidth:0}}>
                      {/* Name + status badges */}
                      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:2}}>
                        <span style={{fontSize:'var(--fs-body)',fontWeight:600,fontFamily:'var(--font)'}}>{displayName}</span>
                        {done && <span className="pill pill-no" style={{fontSize:10}}>🔔 All 10 hrs used</span>}
                        {!done && left<=2 && <span className="pill pill-warn" style={{fontSize:10}}>⚠ {left} hr{left!==1?'s':''} left</span>}
                      </div>

                      {/* Meta info */}
                      <div style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)',marginBottom:10}}>
                        Purchased {pack.purchaseDate} · ${pack.total} · {used}/10 hrs used
                        {pack.studentEmail && <span> · {pack.studentEmail}</span>}
                      </div>

                      {/* Progress bar */}
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                        <div style={{flex:1,background:'var(--color-background-secondary)',borderRadius:4,height:7,overflow:'hidden'}}>
                          <div style={{width:`${pct}%`,height:7,borderRadius:4,background:color,transition:'width 0.3s'}} />
                        </div>
                        <span style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)',whiteSpace:'nowrap',minWidth:48}}>{used}/10 hrs</span>
                      </div>

                      {/* Hours history table */}
                      {log.length > 0 && (
                        <div style={{background:'var(--color-background-secondary)',borderRadius:'var(--r-sm)',padding:'var(--sp-xs) var(--sp-sm)',marginBottom:8}}>
                          <div style={{fontSize:'var(--fs-xs)',fontWeight:500,color:'var(--color-text-secondary)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:6}}>Hours history</div>
                          <div style={{display:'grid',gridTemplateColumns:'auto 1fr auto auto auto',gap:'4px 10px'}}>
                            {log.map((entry,j) => (
                              <>
                                <div key={`dot-${j}`} style={{width:18,height:18,borderRadius:'50%',background:color,display:'flex',alignItems:'center',justifyContent:'center',alignSelf:'center'}}>
                                  <i className="ti ti-check" style={{fontSize:9,color:'#fff'}} />
                                </div>
                                <span key={`lbl-${j}`} style={{fontSize:'var(--fs-xs)',alignSelf:'center',color:'var(--color-text-primary)'}}>Session {j+1}</span>
                                <span key={`tch-${j}`} style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)',alignSelf:'center',whiteSpace:'nowrap'}}>
                                  {entry.teacher || '—'}
                                </span>
                                <span key={`hrs-${j}`} style={{fontSize:'var(--fs-xs)',color:color,fontWeight:500,whiteSpace:'nowrap',alignSelf:'center'}}>
                                  {entry.hours != null ? `${entry.hours} hr${entry.hours!==1?'s':''}` : '1 hr'}
                                </span>
                                <span key={`dt-${j}`} style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)',whiteSpace:'nowrap',alignSelf:'center'}}>{entry.date}</span>
                              </>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Exhaustion message */}
                      {done && (
                        <div style={{background:'rgba(226,75,74,0.08)',border:'0.5px solid rgba(226,75,74,0.25)',borderRadius:'var(--r-sm)',padding:'var(--sp-xs) var(--sp-md)',fontSize:'var(--fs-xs)',color:'#791F1F',lineHeight:1.6}}>
                          <i className="ti ti-bell" style={{marginRight:5}} />
                          All 10 hours have been used. Please contact the student to purchase a new pack.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

    </>
  )
}
