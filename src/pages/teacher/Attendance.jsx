import { useState } from 'react'
import { CATEGORY_LABELS } from '../../data/mockData'

export default function Attendance({ classes = [] }) {
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [attendance, setAttendance] = useState([])
  const [exported, setExported] = useState(false)

  const grouped = {}
  classes.forEach(c => {
    const cat = c.category || 'kids'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(c)
  })

  function exportSheets() {
    setExported(true)
    setTimeout(() => setExported(false), 3000)
    alert('In production this connects to Google Sheets API using your OAuth credentials to export the attendance list.')
  }

  return (
    <div className="card">
      <div className="card-hdr" style={{flexWrap:'nowrap',gap:8}}>
        <span className="card-title" style={{whiteSpace:'nowrap'}}>Attendance</span>
        <div style={{display:'flex',alignItems:'center',gap:7,flexShrink:0}}>
          <select
            className="sel-sm"
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
          >
            <option value="">Select class…</option>
            {Object.entries(grouped).map(([cat, cls]) => (
              <optgroup key={cat} label={CATEGORY_LABELS[cat] || cat}>
                {cls.map(c => <option key={c.id} value={c.id}>{c.name} ({c.days})</option>)}
              </optgroup>
            ))}
            {classes.length === 0 && <option disabled>No classes — upload schedule first</option>}
          </select>
          <input
            type="date"
            className="sel-sm"
            style={{maxWidth:140}}
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          />
          <button className="btn btn-p" style={{fontSize:'var(--fs-sm)',padding:'5px 11px'}} onClick={exportSheets}>
            <i className="ti ti-table-export" /> Export to Sheets
          </button>
        </div>
      </div>

      {exported && (
        <div style={{fontSize:'var(--fs-sm)',color:'#27500A',marginBottom:'var(--sp-sm)',display:'flex',alignItems:'center',gap:6}}>
          <i className="ti ti-check" /> Exported successfully.
        </div>
      )}

      {!selectedClass ? (
        <div style={{textAlign:'center',padding:'var(--sp-lg) 0',color:'var(--color-text-secondary)',fontSize:'var(--fs-sm)'}}>
          <i className="ti ti-checkbox" style={{fontSize:28,display:'block',marginBottom:8,opacity:.4}} />
          Select a class and date above to view attendance.
        </div>
      ) : (
        <>
          <table className="att-table">
            <thead>
              <tr>
                <th style={{width:'28%'}}>Student</th>
                <th style={{width:'28%'}}>Package</th>
                <th style={{width:'22%'}}>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} style={{textAlign:'center',color:'var(--color-text-secondary)',fontSize:'var(--fs-sm)',padding:'var(--sp-lg)'}}>
                  <i className="ti ti-users" style={{fontSize:24,display:'block',marginBottom:8,opacity:.4}} />
                  No students enrolled yet. Students will appear here once they sign up.
                </td>
              </tr>
            </tbody>
          </table>
          <p style={{fontSize:'var(--fs-xs)',color:'var(--color-text-secondary)',marginTop:9,lineHeight:1.5}}>
            <i className="ti ti-info-circle" /> Default status is "checked in" unless the student submits a leave request beforehand.
          </p>
        </>
      )}
    </div>
  )
}
