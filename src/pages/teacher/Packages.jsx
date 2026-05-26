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
              {exhaustedPacks.length} student{exhaustedPacks.length!==1?'s have':' has'} used all 10 sessions
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {exhaustedPacks.map((p,i) => (
                <span key={p.id||i} style={{fontSize:'var(--fs-xs)',padding:'2px 10px',borderRadius:20,background:'rgba(226,75,74,0.12)',color:'#791F1F',fontFamily:'var(--font)'}}>
                  {p.studentName || p.studentEmail || 'Unknown'} — all 10 used
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 10-Session Packs ──────────────────────────────── */}
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">10-session packs</span>
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
            No 10-session packs yet. Appear here once a student purchases one and you confirm payment.
          </div>
        ) : (
          <>
            {/* Active packs first, then exhausted */}
            {[...activePacks, ...exhaustedPacks].map((pack,i) => {
              const used       = pack.sessionsUsed||0
              const left       = 10-used
              const pct        = Math.round((used/10)*100)
              const color      = used>=10?'#E24B4A':pct>=80?'#F47B20':'#E8401A'
              const done       = used >= 10
              const log        = pack.sessionLog || []
              // Student name: prefer studentName, fall back to studentEmail (account sign-up name)
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
                        {done && <span className="pill pill-no" style={{fontSize:10}}>🔔 All 10 sessions used</span>}
                        {!done && left<=2 && <span className="pill pill-warn" style={{fontSize:10}}>⚠ {left} session{left!==1?'s':''} left</span>}
                      </div>

                      {/* Meta info */}
                      <div style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)',marginBottom:10}}>
                        Purchased {pack.purchaseDate} · ${pack.total} · {used}/{10} sessions used
                        {pack.studentEmail && <span> · {pack.studentEmail}</span>}
                      </div>

                      {/* Progress bar */}
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                        <div style={{flex:1,background:'var(--color-background-secondary)',borderRadius:4,height:7,overflow:'hidden'}}>
                          <div style={{width:`${pct}%`,height:7,borderRadius:4,background:color,transition:'width 0.3s'}} />
                        </div>
                        <span style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)',whiteSpace:'nowrap',minWidth:30}}>{used}/10</span>
                      </div>

                      {/* Session dots */}
                      <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:10}}>
                        {Array.from({length:10}).map((_,idx) => (
                          <div key={idx} title={log[idx]?.date ? `Session ${idx+1}: ${log[idx].date}` : `Session ${idx+1}`} style={{
                            width:26,height:26,borderRadius:'50%',
                            background:idx<used?color:'var(--color-background-secondary)',
                            border:`1.5px solid ${idx<used?color:'var(--color-border-secondary)'}`,
                            display:'flex',alignItems:'center',justifyContent:'center',
                            fontSize:9,color:idx<used?'#fff':'var(--color-text-secondary)',
                            fontWeight:500,cursor:log[idx]?'help':'default',
                          }}>
                            {idx<used ? <i className="ti ti-check" style={{fontSize:10}} /> : idx+1}
                          </div>
                        ))}
                      </div>

                      {/* Session history table */}
                      {log.length > 0 && (
                        <div style={{background:'var(--color-background-secondary)',borderRadius:'var(--r-sm)',padding:'var(--sp-xs) var(--sp-sm)',marginBottom:8}}>
                          <div style={{fontSize:'var(--fs-xs)',fontWeight:500,color:'var(--color-text-secondary)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:6}}>Session history</div>
                          <div style={{display:'grid',gridTemplateColumns:'auto 1fr auto',gap:'4px 12px'}}>
                            {log.map((entry,j) => (
                              <>
                                <div key={`dot-${j}`} style={{width:18,height:18,borderRadius:'50%',background:color,display:'flex',alignItems:'center',justifyContent:'center',alignSelf:'center'}}>
                                  <i className="ti ti-check" style={{fontSize:9,color:'#fff'}} />
                                </div>
                                <span key={`lbl-${j}`} style={{fontSize:'var(--fs-xs)',alignSelf:'center',color:'var(--color-text-primary)'}}>Session {j+1}</span>
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
                          All 10 sessions have been used. Please contact the student to purchase a new pack.
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
