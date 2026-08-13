import { onSchedule } from 'firebase-functions/v2/scheduler'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp()

const EMAILJS_URL = 'https://api.emailjs.com/api/v1.0/email/send'

const PKG_LABELS = {
  full:    'Full semester',
  '10pack':'10-session pack',
  dropin:  'Drop-in',
}

async function sendEmail(cfg, { to, toName, subject, message }) {
  const res = await fetch(EMAILJS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id:  cfg.serviceId,
      template_id: cfg.templateId,
      user_id:     cfg.publicKey,
      template_params: {
        to_email:  to,
        to_name:   toName || to,
        from_name: 'Youtopia Dance Academy',
        subject,
        message,
        reply_to:  'info@youtopiadanceacademy.com',
      },
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => String(res.status))
    throw new Error(`Email failed (${res.status}): ${body}`)
  }
}

// Parse locale date strings used by the app ("Jun 8, 2026" or "Jun 8, 2026, 10:30 AM")
function parseAppDate(str) {
  if (!str) return null
  const clean = str.replace(/,\s*\d{1,2}:\d{2}\s*(AM|PM)/i, '')
  const d = new Date(clean)
  return isNaN(d.getTime()) ? null : d
}

function isWithinWeek(dateStr) {
  const d = parseAppDate(dateStr)
  if (!d) return false
  return d >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
}

function pacificNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
}

function getPacificDateISO() {
  const p = pacificNow()
  return `${p.getFullYear()}-${String(p.getMonth()+1).padStart(2,'0')}-${String(p.getDate()).padStart(2,'0')}`
}

function getPacificDay()        { return pacificNow().getDay() }
function getPacificDayOfMonth() { return pacificNow().getDate() }

function shouldSendToday(schedule, lastSentISO) {
  const todayISO = getPacificDateISO()
  const { frequency = 'weekly', dayOfWeek = 1, dayOfMonth = 1 } = schedule

  // Don't send twice on the same day
  if (lastSentISO === todayISO) return false

  if (frequency === 'daily') {
    return true
  }

  if (frequency === 'weekly') {
    return getPacificDay() === dayOfWeek
  }

  if (frequency === 'biweekly') {
    if (getPacificDay() !== dayOfWeek) return false
    if (!lastSentISO) return true
    const daysDiff = (new Date(todayISO) - new Date(lastSentISO)) / (1000 * 60 * 60 * 24)
    return daysDiff >= 14
  }

  if (frequency === 'monthly') {
    return getPacificDayOfMonth() === dayOfMonth
  }

  return false
}

async function buildAndSendSummary(db) {
  // Load settings
  const settingsSnap = await db.collection('settings').doc('main').get()
  if (!settingsSnap.exists) { console.log('No settings — aborting.'); return }

  const data = settingsSnap.data()
  const { emailConfig, teacherEmails = [], summarySchedule = {}, summaryLastSent = '' } = data

  if (!emailConfig?.serviceId || !emailConfig?.templateId || !emailConfig?.publicKey) {
    console.log('EmailJS not configured — aborting.'); return
  }
  if (teacherEmails.length === 0) { console.log('No teacher emails — aborting.'); return }

  if (!shouldSendToday(summarySchedule, summaryLastSent)) {
    console.log('Not scheduled for this hour — skipping.')
    return
  }

  // Fetch all collections in parallel
  const [leavesSnap, enrollSnap, paymentsSnap, packsSnap] = await Promise.all([
    db.collection('leaveRequests').get(),
    db.collection('enrollments').get(),
    db.collection('payments').get(),
    db.collection('sessionPacks').get(),
  ])

  const allLeaves      = leavesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  const recentLeaves   = allLeaves.filter(r => isWithinWeek(r.autoApprovedAt || r.submittedAt))
  const recentMakeups  = allLeaves.filter(r => r.makeup && isWithinWeek(r.makeup.requestedAt))

  const recentEnrollments = enrollSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(e => isWithinWeek(e.enrolledAt))

  const allPayments    = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  const confirmedPacks = allPayments.filter(p =>
    p.status === 'confirmed' && isWithinWeek(p.submittedAt) && (p.items||[]).some(i => i.pkgType === '10pack')
  )
  const pendingPacks   = allPayments.filter(p =>
    p.status === 'pending' && isWithinWeek(p.submittedAt) && (p.items||[]).some(i => i.pkgType === '10pack')
  )

  const completedPacks = packsSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => (p.sessionsUsed || 0) >= 10 && isWithinWeek((p.sessionLog || []).slice(-1)[0]?.date))

  // Build summary text
  const weekOf = new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })

  const lines = [
    `Summary — Week of ${weekOf}`,
    '',
    `LEAVE REQUESTS (${recentLeaves.length})`,
    '--------------------------------',
  ]
  if (recentLeaves.length === 0) {
    lines.push('No leave requests this week.')
  } else {
    recentLeaves.forEach(r => {
      lines.push(`• ${r.studentName || 'Unknown'} — ${r.className || ''}`)
      lines.push(`  Submitted: ${r.autoApprovedAt || r.submittedAt || ''}  |  Status: ${r.status}`)
    })
  }

  lines.push('', `MAKE-UP REQUESTS (${recentMakeups.length})`, '--------------------------------')
  if (recentMakeups.length === 0) {
    lines.push('No make-up requests this week.')
  } else {
    recentMakeups.forEach(r => {
      lines.push(`• ${r.studentName || 'Unknown'} — wants makeup in: ${r.makeup.className || ''}`)
      lines.push(`  Requested: ${r.makeup.requestedAt || ''}  |  Status: ${r.makeup.status}`)
    })
  }

  lines.push('', `NEW REGISTRATIONS (${recentEnrollments.length})`, '--------------------------------')
  if (recentEnrollments.length === 0) {
    lines.push('No new registrations this week.')
  } else {
    recentEnrollments.forEach(e => {
      const pkg = PKG_LABELS[e.pkgType] || e.pkgType || ''
      lines.push(`• ${e.studentName || 'Unknown'} — ${e.className || ''}`)
      lines.push(`  Type: ${pkg}  |  Enrolled: ${e.enrolledAt || ''}`)
    })
  }

  const totalPacks = confirmedPacks.length + pendingPacks.length
  lines.push('', `PACKAGE PURCHASES (${totalPacks})`, '--------------------------------')
  if (totalPacks === 0) {
    lines.push('No package purchases this week.')
  } else {
    confirmedPacks.forEach(p => {
      lines.push(`• ${p.studentName || 'Unknown'} — 10-session pack`)
      lines.push(`  Total: $${p.total || ''}  |  Method: ${p.method || ''}  |  Status: Confirmed  |  ${p.submittedAt || ''}`)
    })
    pendingPacks.forEach(p => {
      lines.push(`• ${p.studentName || 'Unknown'} — 10-session pack`)
      lines.push(`  Total: $${p.total || ''}  |  Method: ${p.method || ''}  |  Status: Pending  |  ${p.submittedAt || ''}`)
    })
  }

  lines.push('', `COMPLETED PACKAGES (${completedPacks.length})`, '--------------------------------')
  if (completedPacks.length === 0) {
    lines.push('No completed packages this week.')
  } else {
    completedPacks.forEach(p => {
      const lastSession = (p.sessionLog || []).slice(-1)[0]?.date || ''
      lines.push(`• ${p.studentName || 'Unknown'} — 10-session pack fully used`)
      lines.push(`  Hours used: ${p.sessionsUsed}/10  |  Last session: ${lastSession}`)
    })
  }

  const message = lines.join('\n')
  const subject = `[Youtopia] Weekly Summary — ${weekOf}`

  let sent = 0
  for (const email of teacherEmails) {
    try {
      await sendEmail(emailConfig, { to: email, toName: 'Teacher', subject, message })
      sent++
      console.log(`Sent to ${email}`)
    } catch (err) {
      console.error(`Failed for ${email}:`, err.message)
    }
  }

  // Record the send date so we don't double-send — but only if at least one
  // email actually went out. Writing it unconditionally makes a total failure
  // look like a success in the Configuration page ("Last sent: <today>") and
  // suppresses any retry.
  if (sent > 0) {
    await db.collection('settings').doc('main').set({ summaryLastSent: getPacificDateISO() }, { merge: true })
    console.log(`Summary sent to ${sent}/${teacherEmails.length} teachers.`)
  } else {
    console.error(`Summary FAILED for all ${teacherEmails.length} teachers — summaryLastSent not updated.`)
  }
}

// Runs once daily at 9 AM Pacific and checks the configured schedule
export const weeklyTeacherSummary = onSchedule(
  { schedule: '0 9 * * *', timeZone: 'America/Los_Angeles' },
  async (_event) => { await buildAndSendSummary(getFirestore()) }
)
