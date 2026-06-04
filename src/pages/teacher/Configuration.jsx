import { useState } from 'react'
import { isApprovedTeacher } from '../../config'
import * as XLSX from 'xlsx'

// ── Colour palette for auto-assigning class colours ──────────
const COLORS = ['#E8401A','#F47B20','#F5B800','#C94A8B','#185FA5','#0F6E56','#6B38FB','#E8401A','#F47B20','#F5B800']

// ── Parse a CSV string into class objects ─────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return null
  const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim().toLowerCase())
  return lines.slice(1).map((line, i) => {
    const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) || line.split(',')
    const obj = {}
    headers.forEach((h, j) => { obj[h] = (vals[j]||'').replace(/^"|"$/g,'').trim() })
    return {
      id:         Date.now() + i,
      name:       obj.name || obj['class name'] || obj['class'] || `Class ${i+1}`,
      category:   normCategory(obj.category || obj.type || ''),
      days:       obj.day  || obj.days || obj.schedule || '',
      time:       obj.time || '',
      duration:   obj.duration || obj.hours || '',
      fee:        Number(obj.fee || obj['fee/session'] || obj.price || 0),
      sessions:   Number(obj.sessions || obj['# sessions'] || obj.count || 0),
      instructor: obj.instructor || obj.teacher || '',
      color:      COLORS[i % COLORS.length],
    }
  }).filter(c => c.name)
}

function normCategory(s) {
  const v = s.toLowerCase()
  if (v.includes('adult') || v.includes('成人')) return 'adult'
  if (v.includes('comp')  || v.includes('team'))  return 'comp'
  return 'kids'
}

// ── Parse an Excel (.xlsx / .xls) file ───────────────────────
function parseExcel(buffer) {
  const wb   = XLSX.read(buffer, { type: 'array' })
  const ws   = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
  if (!rows || rows.length === 0) return null
  return rows.map((row, i) => {
    // Normalise keys to lowercase without spaces
    const r = {}
    Object.keys(row).forEach(k => { r[k.toLowerCase().replace(/\s+/g,'_')] = String(row[k]).trim() })
    return {
      id:         Date.now() + i,
      name:       r.name || r.class_name || r.class || `Class ${i+1}`,
      category:   normCategory(r.category || r.type || ''),
      days:       r.day  || r.days || r.schedule || '',
      time:       r.time || '',
      duration:   r.duration || r.hours || '',
      fee:        Number(r.fee || r['fee/session'] || r.price || 0),
      sessions:   Number(r.sessions || r['#_sessions'] || r.count || 0),
      instructor: r.instructor || r.teacher || '',
      color:      COLORS[i % COLORS.length],
    }
  }).filter(c => c.name)
}


const CAT_LABEL = { kids:'少儿部 — Kids', adult:'成人部 — Adult', comp:'Competition Team' }

const BLANK_CLASS = () => ({
  id: Date.now() + Math.random(),
  name:'', category:'kids', days:'', time:'', duration:'', fee:0, sessions:0, instructor:'', color: COLORS[0],
})

// ─────────────────────────────────────────────────────────────
const fmtDate = (s) => {
  if (!s) return '—'
  try { return new Date(s).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) }
  catch { return s }
}

export default function Configuration({ classes, setClasses, teacherEmails=[], setTeacherEmails, semester={}, setSemester, archiveSemester }) {
  // ── Semester state ──────────────────────────────────────────
  const [semDraft,    setSemDraft]    = useState(null)   // null=view, object=editing
  const [semFlash,    setSemFlash]    = useState(false)
  const [newSemForm,  setNewSemForm]  = useState(false)
  const [newSemDraft, setNewSemDraft] = useState({ name:'', startDate:'', endDate:'' })

  const [newEmail, setNewEmail]   = useState('')
  const [emailErr, setEmailErr]   = useState('')
  const [emailSaved, setEmailSaved] = useState(false)

  // ── Class management state ──────────────────────────────────
  const [editingId,  setEditingId]    = useState(null)   // id of class being edited
  const [editDraft,  setEditDraft]    = useState({})     // draft fields while editing
  const [addingNew,  setAddingNew]    = useState(false)
  const [newClass,   setNewClass]     = useState(BLANK_CLASS())
  const [clsFlash,   setClsFlash]     = useState(null)   // id of recently saved class

  function startEdit(cls) {
    setEditingId(cls.id)
    setEditDraft({ ...cls })
  }
  function cancelEdit() { setEditingId(null); setEditDraft({}) }
  function saveEdit() {
    setClasses(prev => prev.map(c => c.id === editingId ? { ...c, ...editDraft } : c))
    setClsFlash(editingId)
    setTimeout(() => setClsFlash(null), 2000)
    setEditingId(null); setEditDraft({})
  }
  function deleteClass(id) {
    if (!window.confirm('Delete this class? This cannot be undone.')) return
    setClasses(prev => prev.filter(c => c.id !== id))
  }
  function saveNewClass() {
    if (!newClass.name.trim()) return
    const cls = { ...newClass, id: Date.now(), color: COLORS[classes.length % COLORS.length] }
    setClasses(prev => [...prev, cls])
    setNewClass(BLANK_CLASS())
    setAddingNew(false)
  }

  const [dragging, setDragging]       = useState(false)
  const [gsUrl, setGsUrl]             = useState('')
  const [gsParsing, setGsParsing]     = useState(false)
  const [uploadName, setUploadName]   = useState(null)
  const [parsing, setParsing]         = useState(false)
  const [parseError, setParseError]   = useState(null)
  const [parsedClasses, setParsedClasses] = useState(null)  // editable preview
  const [confirmed, setConfirmed]     = useState(false)

  // ── Email management ────────────────────────────────────────
  function addEmail() {
    const e = newEmail.trim().toLowerCase()
    if (!e.includes('@')) { setEmailErr('Please enter a valid email.'); return }
    if (teacherEmails.includes(e)) { setEmailErr('Already added.'); return }
    setTeacherEmails(prev => [...prev, e])
    setNewEmail(''); setEmailErr(''); setEmailSaved(true)
    setTimeout(() => setEmailSaved(false), 3000)
  }

  // ── File handling ───────────────────────────────────────────
  function handleDrop(ev) {
    ev.preventDefault(); setDragging(false)
    const file = ev.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function handleFile(file) {
    setUploadName(file.name)
    setParsing(true)
    setParseError(null)
    setParsedClasses(null)
    setConfirmed(false)

    try {
      let parsed = null
      const ext = file.name.split('.').pop().toLowerCase()

      if (ext === 'csv') {
        const text = await file.text()
        parsed = parseCSV(text)
        if (!parsed || parsed.length === 0) throw new Error('Could not read CSV. Make sure it has columns: name, category, days, time, duration, fee, sessions, instructor')
      } else if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer()
        parsed = parseExcel(new Uint8Array(buffer))
        if (!parsed || parsed.length === 0) throw new Error('Could not read Excel file. Make sure the first sheet has columns: name, category, days, time, duration, fee, sessions, instructor')
      } else {
        throw new Error('Unsupported file type. Please upload a CSV or Excel (.xlsx) file.')
      }

      setParsedClasses(parsed)
    } catch (err) {
      setParseError(err.message || 'Failed to parse file.')
    } finally {
      setParsing(false)
    }
  }

  async function handleGoogleSheet() {
    if (!gsUrl.trim()) return
    setGsParsing(true); setParseError(null); setParsedClasses(null); setConfirmed(false)
    try {
      // Convert Google Sheets URL to CSV export URL
      let csvUrl = gsUrl.trim()
      // Handle /edit#gid=... and /pub?... forms
      const sheetId = csvUrl.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1]
      const gid     = csvUrl.match(/[?&]gid=(\d+)/)?.[1] || '0'
      if (!sheetId) throw new Error('Could not extract Sheet ID. Copy the URL directly from the browser address bar.')
      csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`

      const res  = await fetch(csvUrl)
      if (!res.ok) throw new Error('Could not fetch sheet. Make sure it is shared as "Anyone with the link can view".')
      const text = await res.text()
      const parsed = parseCSV(text)
      if (!parsed || parsed.length === 0) throw new Error('No classes found. Check that your sheet has the correct column headers.')

      setUploadName('Google Sheet')
      setParsedClasses(parsed)
    } catch (err) {
      setParseError(err.message || 'Failed to load Google Sheet.')
    } finally {
      setGsParsing(false)
    }
  }

  // ── Editable preview ─────────────────────────────────────────
  function updateParsed(idx, field, val) {
    setParsedClasses(prev => prev.map((c,i) => i===idx ? {...c, [field]: val} : c))
  }

  function removeParsed(idx) {
    setParsedClasses(prev => prev.filter((_,i) => i!==idx))
  }

  function confirmUpdate() {
    if (!parsedClasses || parsedClasses.length === 0) return
    setClasses(parsedClasses)
    setConfirmed(true)
    setParsedClasses(null)
  }

  function resetUpload() {
    setUploadName(null); setParsing(false); setParseError(null)
    setParsedClasses(null); setConfirmed(false)
  }

  return (
    <>
      {/* ── Semester / Term ────────────────────────────────── */}
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">📅 Current semester</span>
          {!semDraft && !newSemForm && (
            <button className="btn" style={{fontSize:'var(--fs-xs)'}} onClick={() => setSemDraft({...semester})}>
              <i className="ti ti-pencil" /> Edit dates
            </button>
          )}
        </div>

        {semDraft ? (
          /* ── Edit mode ── */
          <div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'var(--sp-sm)',marginBottom:'var(--sp-md)'}}>
              <div>
                <label className="form-label">Semester name</label>
                <input value={semDraft.name||''} onChange={e=>setSemDraft(d=>({...d,name:e.target.value}))} placeholder="e.g. Jan–Jun 2026" />
              </div>
              <div>
                <label className="form-label">Start date</label>
                <input type="date" value={semDraft.startDate||''} onChange={e=>setSemDraft(d=>({...d,startDate:e.target.value}))} />
              </div>
              <div>
                <label className="form-label">End date</label>
                <input type="date" value={semDraft.endDate||''} onChange={e=>setSemDraft(d=>({...d,endDate:e.target.value}))} />
              </div>
            </div>
            <div style={{display:'flex',gap:'var(--sp-sm)'}}>
              <button className="btn" onClick={() => setSemDraft(null)}>Cancel</button>
              <button className="btn btn-p" onClick={() => {
                setSemester({...semester,...semDraft})
                setSemDraft(null)
                setSemFlash(true)
                setTimeout(() => setSemFlash(false), 2500)
              }}>
                <i className="ti ti-check" /> Save
              </button>
            </div>
          </div>
        ) : (
          /* ── View mode ── */
          <div>
            <div style={{display:'flex',alignItems:'baseline',gap:12,marginBottom:6}}>
              <div style={{fontSize:16,fontWeight:600}}>{semester?.name || '—'}</div>
              {semFlash && <span style={{fontSize:'var(--fs-xs)',color:'#27500A'}}><i className="ti ti-check" /> Saved</span>}
            </div>
            <div style={{fontSize:'var(--fs-sm)',color:'var(--color-text-secondary)'}}>
              {fmtDate(semester?.startDate)} → {fmtDate(semester?.endDate)}
            </div>
          </div>
        )}

        {/* ── Start new semester ── */}
        {!semDraft && (
          <div style={{marginTop:'var(--sp-lg)',paddingTop:'var(--sp-md)',borderTop:'0.5px solid var(--color-border-tertiary)'}}>
            <div style={{fontWeight:500,fontSize:'var(--fs-body)',marginBottom:4}}>Start a new semester</div>
            <div style={{fontSize:'var(--fs-sm)',color:'var(--color-text-secondary)',marginBottom:'var(--sp-md)',lineHeight:1.6}}>
              When a new semester begins, students' current enrollments are automatically archived and they can re-enroll in new classes.
            </div>
            {!newSemForm ? (
              <button className="btn btn-p" style={{fontSize:'var(--fs-xs)'}} onClick={() => setNewSemForm(true)}>
                <i className="ti ti-player-skip-forward" /> Start new semester →
              </button>
            ) : (
              <div style={{background:'rgba(232,64,26,0.04)',border:'0.5px solid rgba(232,64,26,0.25)',borderRadius:'var(--r-sm)',padding:'var(--sp-md)'}}>
                <div style={{fontWeight:500,marginBottom:'var(--sp-sm)'}}>New semester details</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'var(--sp-sm)',marginBottom:'var(--sp-sm)'}}>
                  <div>
                    <label className="form-label">Semester name *</label>
                    <input value={newSemDraft.name} onChange={e=>setNewSemDraft(d=>({...d,name:e.target.value}))} placeholder="e.g. Sep–Dec 2026" />
                  </div>
                  <div>
                    <label className="form-label">Start date *</label>
                    <input type="date" value={newSemDraft.startDate} onChange={e=>setNewSemDraft(d=>({...d,startDate:e.target.value}))} />
                  </div>
                  <div>
                    <label className="form-label">End date *</label>
                    <input type="date" value={newSemDraft.endDate} onChange={e=>setNewSemDraft(d=>({...d,endDate:e.target.value}))} />
                  </div>
                </div>
                <div style={{background:'rgba(245,184,0,0.1)',border:'0.5px solid rgba(245,184,0,0.4)',borderRadius:'var(--r-sm)',padding:'var(--sp-sm) var(--sp-md)',fontSize:'var(--fs-xs)',color:'#633806',marginBottom:'var(--sp-sm)',lineHeight:1.6}}>
                  <i className="ti ti-alert-triangle" style={{marginRight:5}} />
                  This will archive all students' current enrollments. Students will need to re-enroll for the new semester. This cannot be undone.
                </div>
                <div style={{display:'flex',gap:'var(--sp-sm)'}}>
                  <button className="btn" onClick={() => { setNewSemForm(false); setNewSemDraft({name:'',startDate:'',endDate:''}) }}>Cancel</button>
                  <button className="btn btn-p"
                    disabled={!newSemDraft.name.trim() || !newSemDraft.startDate || !newSemDraft.endDate}
                    onClick={() => {
                      archiveSemester(newSemDraft)
                      setNewSemForm(false)
                      setNewSemDraft({name:'',startDate:'',endDate:''})
                    }}>
                    <i className="ti ti-check" /> Confirm new semester
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Manage classes ─────────────────────────────────── */}
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">Manage classes</span>
          <button className="btn btn-p" onClick={() => { setAddingNew(true); setEditingId(null) }}
            style={{fontSize:'var(--fs-xs)'}}>
            <i className="ti ti-plus" /> Add class
          </button>
        </div>

        {/* Add new class form */}
        {addingNew && (
          <div style={{background:'rgba(232,64,26,0.04)',border:'0.5px solid rgba(232,64,26,0.2)',borderRadius:'var(--r-sm)',padding:'var(--sp-md)',marginBottom:'var(--sp-md)'}}>
            <div style={{fontWeight:500,fontSize:'var(--fs-body)',marginBottom:'var(--sp-sm)'}}>New class</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--sp-sm)',marginBottom:'var(--sp-sm)'}}>
              <div className="form-grp">
                <label className="form-label">Class name *</label>
                <input type="text" value={newClass.name} onChange={e=>setNewClass(p=>({...p,name:e.target.value}))} placeholder="e.g. Level 3 C3" />
              </div>
              <div className="form-grp">
                <label className="form-label">Category</label>
                <select value={newClass.category} onChange={e=>setNewClass(p=>({...p,category:e.target.value}))}>
                  <option value="kids">少儿部 — Kids</option>
                  <option value="adult">成人部 — Adult</option>
                  <option value="comp">Competition Team</option>
                </select>
              </div>
              <div className="form-grp">
                <label className="form-label">Day(s)</label>
                <input type="text" value={newClass.days} onChange={e=>setNewClass(p=>({...p,days:e.target.value}))} placeholder="e.g. 周二 Tue" />
              </div>
              <div className="form-grp">
                <label className="form-label">Time</label>
                <input type="text" value={newClass.time} onChange={e=>setNewClass(p=>({...p,time:e.target.value}))} placeholder="e.g. 6:00pm–8:00pm" />
              </div>
              <div className="form-grp">
                <label className="form-label">Fee per session ($)</label>
                <input type="number" value={newClass.fee} onChange={e=>setNewClass(p=>({...p,fee:Number(e.target.value)}))} min="0" />
              </div>
              <div className="form-grp">
                <label className="form-label">Total sessions</label>
                <input type="number" value={newClass.sessions} onChange={e=>setNewClass(p=>({...p,sessions:Number(e.target.value)}))} min="0" />
              </div>
              <div className="form-grp">
                <label className="form-label">Instructor</label>
                <input type="text" value={newClass.instructor} onChange={e=>setNewClass(p=>({...p,instructor:e.target.value}))} placeholder="e.g. 楚濛" />
              </div>
              <div className="form-grp">
                <label className="form-label">Duration</label>
                <input type="text" value={newClass.duration} onChange={e=>setNewClass(p=>({...p,duration:e.target.value}))} placeholder="e.g. 2hr" />
              </div>
            </div>
            <div style={{display:'flex',gap:'var(--sp-sm)',justifyContent:'flex-end'}}>
              <button className="btn" onClick={() => { setAddingNew(false); setNewClass(BLANK_CLASS()) }}>Cancel</button>
              <button className="btn btn-p" onClick={saveNewClass} disabled={!newClass.name.trim()}>
                <i className="ti ti-check" /> Save class
              </button>
            </div>
          </div>
        )}

        {/* Class list grouped by category */}
        {classes.length === 0 ? (
          <div style={{textAlign:'center',padding:'var(--sp-lg) 0',color:'var(--color-text-secondary)',fontSize:'var(--fs-sm)'}}>
            No classes yet. Click "Add class" or upload a schedule below.
          </div>
        ) : ['kids','adult','comp'].map(cat => {
          const catClasses = classes.filter(c => c.category === cat)
          if (!catClasses.length) return null
          return (
            <div key={cat} style={{marginBottom:'var(--sp-md)'}}>
              <div style={{fontSize:'var(--fs-xs)',fontWeight:500,textTransform:'uppercase',letterSpacing:'.05em',color:'var(--color-text-secondary)',padding:'var(--sp-sm) 0 4px',borderBottom:'0.5px solid var(--color-border-tertiary)',marginBottom:4}}>
                {CAT_LABEL[cat]}
              </div>
              {catClasses.map(cls => {
                const isEditing = editingId === cls.id
                const d = isEditing ? editDraft : cls
                return (
                  <div key={cls.id} style={{padding:'10px 0',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                    {isEditing ? (
                      <>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'var(--sp-sm)',marginBottom:'var(--sp-sm)'}}>
                          <div>
                            <label className="form-label">Class name</label>
                            <input type="text" value={d.name} onChange={e=>setEditDraft(p=>({...p,name:e.target.value}))} />
                          </div>
                          <div>
                            <label className="form-label">Day(s)</label>
                            <input type="text" value={d.days} onChange={e=>setEditDraft(p=>({...p,days:e.target.value}))} />
                          </div>
                          <div>
                            <label className="form-label">Time</label>
                            <input type="text" value={d.time} onChange={e=>setEditDraft(p=>({...p,time:e.target.value}))} />
                          </div>
                          <div>
                            <label className="form-label">Instructor</label>
                            <input type="text" value={d.instructor} onChange={e=>setEditDraft(p=>({...p,instructor:e.target.value}))} />
                          </div>
                          <div>
                            <label className="form-label">Fee ($)</label>
                            <input type="number" value={d.fee} onChange={e=>setEditDraft(p=>({...p,fee:Number(e.target.value)}))} min="0" />
                          </div>
                          <div>
                            <label className="form-label">Sessions</label>
                            <input type="number" value={d.sessions} onChange={e=>setEditDraft(p=>({...p,sessions:Number(e.target.value)}))} min="0" />
                          </div>
                          <div>
                            <label className="form-label">Duration</label>
                            <input type="text" value={d.duration} onChange={e=>setEditDraft(p=>({...p,duration:e.target.value}))} />
                          </div>
                          <div>
                            <label className="form-label">Category</label>
                            <select value={d.category} onChange={e=>setEditDraft(p=>({...p,category:e.target.value}))}>
                              <option value="kids">少儿部 — Kids</option>
                              <option value="adult">成人部 — Adult</option>
                              <option value="comp">Competition Team</option>
                            </select>
                          </div>
                        </div>
                        <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                          <button className="btn" onClick={cancelEdit}>Cancel</button>
                          <button className="btn btn-p" onClick={saveEdit}>
                            <i className="ti ti-check" /> Save changes
                          </button>
                        </div>
                      </>
                    ) : (
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:8,height:8,borderRadius:'50%',background:cls.color,flexShrink:0}} />
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:500,fontSize:'var(--fs-body)'}}>{cls.name}</div>
                          <div style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)',marginTop:2}}>
                            {cls.days}{cls.time ? ` · ${cls.time}` : ''}{cls.instructor ? ` · ${cls.instructor}` : ''}
                            {cls.fee ? ` · $${cls.fee}/session` : ''}{cls.sessions ? ` · ${cls.sessions} sessions` : ''}
                          </div>
                        </div>
                        {clsFlash === cls.id && (
                          <span style={{fontSize:'var(--fs-xs)',color:'#27500A'}}><i className="ti ti-check" /> Saved</span>
                        )}
                        <button className="btn" style={{fontSize:11,padding:'3px 8px'}} onClick={() => startEdit(cls)}>
                          <i className="ti ti-pencil" /> Edit
                        </button>
                        <button className="btn" style={{fontSize:11,padding:'3px 8px',color:'#791F1F',borderColor:'#791F1F'}}
                          onClick={() => deleteClass(cls.id)}>
                          <i className="ti ti-trash" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* ── Teacher access ─────────────────────────────────── */}
      <div className="card">
        <div className="card-hdr"><span className="card-title">Teacher portal access</span></div>
        <div style={{fontSize:'var(--fs-sm)',color:'var(--color-text-secondary)',marginBottom:'var(--sp-md)',lineHeight:1.6}}>
          Only the Google accounts listed here can sign in as <strong>Teacher</strong>.
        </div>

        <div style={{marginBottom:'var(--sp-md)'}}>
          {teacherEmails.map(e => (
            <div className="row" key={e} style={{gap:10}}>
              <i className="ti ti-mail" style={{color:'#E8401A',fontSize:15,flexShrink:0}} />
              <span style={{flex:1,fontFamily:'var(--font)',fontSize:'var(--fs-sm)'}}>{e}</span>
              {isApprovedTeacher(e) && <span className="pill pill-info" style={{fontSize:10}}>config.js</span>}
              <button className="btn" style={{fontSize:11,padding:'3px 8px',color:'#791F1F',borderColor:'#791F1F'}}
                onClick={() => setTeacherEmails(prev=>prev.filter(x=>x!==e))}>
                <i className="ti ti-x" /> Remove
              </button>
            </div>
          ))}
        </div>

        <div style={{display:'flex',gap:'var(--sp-sm)',alignItems:'flex-start'}}>
          <div style={{flex:1}}>
            <label className="form-label">Add teacher email</label>
            <input type="email" value={newEmail} onChange={e=>{setNewEmail(e.target.value);setEmailErr('')}}
              onKeyDown={e=>e.key==='Enter'&&addEmail()} placeholder="e.g. teacher@gmail.com" />
            {emailErr && <div style={{fontSize:'var(--fs-xs)',color:'#E8401A',marginTop:4}}>{emailErr}</div>}
          </div>
          <div style={{paddingTop:22}}>
            <button className="btn btn-p" onClick={addEmail} disabled={!newEmail.trim()}>
              <i className="ti ti-plus" /> Add
            </button>
          </div>
        </div>

        {emailSaved && (
          <div style={{fontSize:'var(--fs-sm)',color:'#27500A',marginTop:'var(--sp-sm)',display:'flex',alignItems:'center',gap:6}}>
            <i className="ti ti-check" /> Email added.
          </div>
        )}
        <div style={{marginTop:'var(--sp-md)',background:'var(--color-background-secondary)',borderRadius:'var(--r-sm)',padding:'var(--sp-sm) var(--sp-md)',fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)',lineHeight:1.6}}>
          <i className="ti ti-info-circle" /> Emails added here take effect immediately — no code changes needed.
        </div>
      </div>

      {/* ── Schedule upload ─────────────────────────────────── */}
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">Upload class schedule</span>
          {(uploadName||confirmed) && (
            <button className="btn" style={{fontSize:'var(--fs-xs)'}} onClick={resetUpload}>
              <i className="ti ti-refresh" /> Start over
            </button>
          )}
        </div>

        <div style={{fontSize:'var(--fs-sm)',color:'var(--color-text-secondary)',marginBottom:'var(--sp-md)',lineHeight:1.6}}>
          Upload your schedule and all classes in both the teacher and student portals will be updated automatically.
          Supported formats: <strong>Excel (.xlsx) or CSV</strong>, or paste a Google Sheets link.
          <br/>Use columns: <code>name, category, days, time, duration, fee, sessions, instructor</code>
        </div>

        {/* ── Google Sheets URL input ─── */}
        {!confirmed && !parsedClasses && (
          <div style={{marginBottom:'var(--sp-md)',background:'var(--color-background-secondary)',borderRadius:'var(--r-sm)',padding:'var(--sp-sm) var(--sp-md)'}}>
            <label className="form-label" style={{marginBottom:6}}>
              <i className="ti ti-brand-google" style={{marginRight:4,color:'#185FA5'}} /> Google Sheets URL
            </label>
            <div style={{display:'flex',gap:'var(--sp-sm)'}}>
              <input
                type="url"
                value={gsUrl}
                onChange={e=>setGsUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/…"
                style={{flex:1}}
              />
              <button className="btn btn-p" onClick={handleGoogleSheet} disabled={!gsUrl.trim()||gsParsing}>
                {gsParsing
                  ? <><i className="ti ti-loader-2" style={{animation:'spin 1s linear infinite'}} /> Loading…</>
                  : <><i className="ti ti-download" /> Import</>
                }
              </button>
            </div>
            <div style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)',marginTop:4}}>
              Sheet must be shared as "Anyone with the link can view". Copy the URL from your browser address bar.
            </div>
          </div>
        )}


        {/* Confirmed success */}
        {confirmed && (
          <div style={{background:'rgba(59,109,17,0.08)',border:'0.5px solid rgba(59,109,17,0.3)',borderRadius:'var(--r-sm)',padding:'var(--sp-md)',textAlign:'center'}}>
            <i className="ti ti-check" style={{fontSize:32,color:'#27500A',display:'block',marginBottom:8}} />
            <div style={{fontWeight:500,fontSize:'var(--fs-body)',color:'#27500A'}}>Schedule updated!</div>
            <div style={{fontSize:'var(--fs-sm)',color:'var(--color-text-secondary)',marginTop:4}}>
              All classes in the teacher and student portals have been updated from {uploadName}.
            </div>
          </div>
        )}

        {/* Upload zone */}
        {!confirmed && !parsedClasses && (
          <>
            <div
              className="upload-zone"
              style={{background:dragging?'rgba(232,64,26,0.04)':'transparent',cursor:parsing?'wait':'pointer'}}
              onDragOver={e=>{e.preventDefault();setDragging(true)}}
              onDragLeave={()=>setDragging(false)}
              onDrop={handleDrop}
              onClick={()=>!parsing&&document.getElementById('sched-file').click()}
            >
              {parsing ? (
                <>
                  <i className="ti ti-loader-2" style={{fontSize:28,color:'#E8401A',display:'block',marginBottom:8,animation:'spin 1s linear infinite'}} />
                  <div style={{fontWeight:500}}>Reading {uploadName}…</div>
                </>
              ) : uploadName && parseError ? (
                <>
                  <i className="ti ti-alert-circle" style={{fontSize:28,color:'#E8401A',display:'block',marginBottom:8}} />
                  <div style={{fontWeight:500}}>Could not parse file</div>
                </>
              ) : (
                <>
                  <i className="ti ti-upload" style={{fontSize:28,color:'#E8401A',display:'block',marginBottom:8}} />
                  <div>Drag & drop your schedule here, or click to browse</div>
                  <div style={{fontSize:'var(--fs-xs)',marginTop:4,color:'var(--color-text-secondary)'}}>Excel (.xlsx) or CSV · max 20 MB</div>
                </>
              )}
            </div>
            <input id="sched-file" type="file" accept=".csv,.xlsx,.xls"
              style={{display:'none'}} onChange={e=>{if(e.target.files[0]) handleFile(e.target.files[0])}} />

            {parseError && (
              <div style={{marginTop:'var(--sp-sm)',background:'rgba(232,64,26,0.06)',border:'0.5px solid rgba(232,64,26,0.25)',borderRadius:'var(--r-sm)',padding:'var(--sp-sm) var(--sp-md)',fontSize:'var(--fs-sm)',color:'#791F1F',lineHeight:1.6}}>
                <i className="ti ti-alert-circle" /> {parseError}
                <br/><span style={{fontSize:'var(--fs-xs)'}}>Try a clearer image, or use a CSV file instead.</span>
              </div>
            )}
          </>
        )}

        {/* Editable parsed preview */}
        {parsedClasses && !confirmed && (
          <div style={{marginTop:'var(--sp-md)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'var(--sp-sm)'}}>
              <div>
                <div style={{fontSize:14,fontWeight:500,fontFamily:'var(--font)'}}>
                  {parsedClasses.length} classes extracted from {uploadName}
                </div>
                <div style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)',marginTop:2}}>
                  Review and edit before confirming. This will replace all current classes.
                </div>
              </div>
              <div style={{display:'flex',gap:6}}>
                <button className="btn" onClick={resetUpload}>Cancel</button>
                <button className="btn btn-p" onClick={confirmUpdate}>
                  <i className="ti ti-check" /> Confirm — update all classes
                </button>
              </div>
            </div>

            {/* Group by category */}
            {['kids','adult','comp'].map(cat => {
              const cls = parsedClasses.filter(c=>c.category===cat)
              if (!cls.length) return null
              return (
                <div key={cat} style={{marginBottom:'var(--sp-md)'}}>
                  <div style={{fontSize:'var(--fs-xs)',fontWeight:500,textTransform:'uppercase',letterSpacing:'.05em',color:'var(--color-text-secondary)',padding:'var(--sp-sm) 0 4px',borderBottom:'0.5px solid var(--color-border-tertiary)',marginBottom:4}}>
                    {CAT_LABEL[cat]}
                  </div>
                  {cls.map((c, globalIdx) => {
                    const idx = parsedClasses.indexOf(c)
                    return (
                      <div key={idx} style={{padding:'10px 0',borderBottom:'0.5px solid var(--color-border-tertiary)',display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr auto',gap:'var(--sp-sm)',alignItems:'center'}}>
                        <div>
                          <label className="form-label">Class name</label>
                          <input type="text" value={c.name} onChange={e=>updateParsed(idx,'name',e.target.value)} />
                        </div>
                        <div>
                          <label className="form-label">Day</label>
                          <input type="text" value={c.days} onChange={e=>updateParsed(idx,'days',e.target.value)} />
                        </div>
                        <div>
                          <label className="form-label">Time</label>
                          <input type="text" value={c.time} onChange={e=>updateParsed(idx,'time',e.target.value)} />
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
                          <div>
                            <label className="form-label">Fee ($)</label>
                            <input type="number" value={c.fee} onChange={e=>updateParsed(idx,'fee',Number(e.target.value))} />
                          </div>
                          <div>
                            <label className="form-label">Sessions</label>
                            <input type="number" value={c.sessions} onChange={e=>updateParsed(idx,'sessions',Number(e.target.value))} />
                          </div>
                        </div>
                        <button className="btn" style={{fontSize:11,padding:'3px 8px',color:'#791F1F',borderColor:'#791F1F',alignSelf:'flex-end'}}
                          onClick={()=>removeParsed(idx)}>
                          <i className="ti ti-x" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )
            })}

            <div style={{display:'flex',gap:6,justifyContent:'flex-end',marginTop:'var(--sp-md)'}}>
              <button className="btn" onClick={resetUpload}>Cancel</button>
              <button className="btn btn-p" onClick={confirmUpdate}>
                <i className="ti ti-check" /> Confirm — update all {parsedClasses.length} classes
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
