import { useState, useRef, useEffect } from 'react'
import { db, auth } from './config/firebase'
import {
  doc, collection, onSnapshot, setDoc, getDoc, addDoc,
  query, where,
} from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import LoginPage from './pages/LoginPage'
import AppShell from './components/AppShell'
import { CLASSES, SEMESTER } from './data/mockData'

const applyFn  = (v, prev) => typeof v === 'function' ? v(prev) : v
const nowStr   = () => new Date().toLocaleString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' })
const dateStr  = () => new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
const encEmail = (email) => encodeURIComponent(email)

const defaultStudent = () => ({
  studentName:          '',
  cart:                 [],
  enrolled:             [],
  pendingEnroll:        [],
  sessionPacks:         [],
  leaveRequests:        [],
  paymentHistory:       [],
  messages:             [],
  readMessageIds:       [],
  enrolledSemesterId:   '',
  enrolledSemesterName: '',
  enrolledSemesterEnd:  '',
  enrollmentHistory:    [],
})

const defaultTeacher = () => ({
  classes:        CLASSES,
  teacherEmails:  ['summerli634@gmail.com', 'info@youtopiadanceacademy.com'],
  pendingPayments:[],
  leaveRequests:  [],
  enrollments:    [],
  sessionPacks:   [],
  paymentHistory: [],
  sentMessages:   [],
  studentInbox:   [],
  emailConfig:    { serviceId:'', templateId:'', publicKey:'' },
  semester:       { id: 'sem_initial', name: SEMESTER.name, startDate: '2026-01-05', endDate: '2026-06-14' },
})

export default function App() {
  const [user, setUser]           = useState(null)
  const [td,   setTd]             = useState(defaultTeacher())
  const [sd,   setSd]             = useState(defaultStudent())
  const [studentLoading, setStudentLoading] = useState(false)
  const studentEmailRef = useRef(null)
  const studentUnsubRef = useRef(null)
  const globalUnsubRef  = useRef(null)

  // ── Start global Firestore listeners (called after login) ──────
  function startGlobalListeners() {
    if (globalUnsubRef.current) return  // already running

    const unsubSettings = onSnapshot(doc(db, 'settings', 'main'), snap => {
      if (snap.exists()) {
        const data = snap.data()
        setTd(prev => ({
          ...prev,
          classes:       data.classes       || prev.classes,
          teacherEmails: data.teacherEmails || prev.teacherEmails,
          emailConfig:   data.emailConfig   || prev.emailConfig,
          semester:      data.semester      || prev.semester,
        }))
      } else {
        setDoc(doc(db, 'settings', 'main'), {
          classes:       CLASSES,
          teacherEmails: ['summerli634@gmail.com', 'info@youtopiadanceacademy.com'],
          emailConfig:   { serviceId:'', templateId:'', publicKey:'' },
          semester:      { id: `sem_${Date.now()}`, name: SEMESTER.name, startDate: '2026-01-05', endDate: '2026-06-14' },
        })
      }
    })

    const unsubPayments = onSnapshot(collection(db, 'payments'), snap => {
      const payments = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setTd(prev => ({ ...prev, pendingPayments: payments }))
    })

    const unsubLeaves = onSnapshot(collection(db, 'leaveRequests'), snap => {
      const leaves = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setTd(prev => ({ ...prev, leaveRequests: leaves }))
    })

    const unsubEnrollments = onSnapshot(collection(db, 'enrollments'), snap => {
      const enrollments = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setTd(prev => ({ ...prev, enrollments }))
    })

    const unsubPacks = onSnapshot(collection(db, 'sessionPacks'), snap => {
      const packs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setTd(prev => ({ ...prev, sessionPacks: packs }))
    })

    const unsubMessages = onSnapshot(collection(db, 'teacherMessages'), snap => {
      const messages = snap.docs.map(d => ({ ...d.data(), id: d.id }))
      setTd(prev => ({ ...prev, sentMessages: messages }))
    })

    const unsubInbox = onSnapshot(collection(db, 'studentInbox'), snap => {
      const inbox = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setTd(prev => ({ ...prev, studentInbox: inbox }))
    })

    const unsubPayHist = onSnapshot(collection(db, 'paymentHistory'), snap => {
      const hist = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setTd(prev => ({ ...prev, paymentHistory: hist }))
    })

    globalUnsubRef.current = () => {
      unsubSettings(); unsubPayments(); unsubLeaves()
      unsubEnrollments(); unsubPacks(); unsubMessages()
      unsubInbox(); unsubPayHist()
    }
  }

  function stopGlobalListeners() {
    if (globalUnsubRef.current) {
      globalUnsubRef.current()
      globalUnsubRef.current = null
    }
    setTd(defaultTeacher())
  }

  // ── Auto-archive: move old semester enrollments to history on login ──
  useEffect(() => {
    const currentSemId = td.semester?.id
    if (!studentEmailRef.current) return   // no student logged in
    if (!currentSemId) return              // settings not loaded yet
    if (studentLoading) return             // student data still loading

    if (!sd.enrolledSemesterId) {
      // Brand-new student — just stamp their record with the current semester ID
      if ((sd.enrolled?.length ?? 0) > 0 || (sd.pendingEnroll?.length ?? 0) > 0) {
        updateStudentDoc(d => ({
          ...d,
          enrolledSemesterId:   currentSemId,
          enrolledSemesterName: td.semester?.name    || '',
          enrolledSemesterEnd:  td.semester?.endDate || '',
        }))
      }
      return
    }

    if (sd.enrolledSemesterId === currentSemId) return  // same semester — nothing to do

    // Semester has changed → archive old enrolled classes into history
    const oldClasses = (td.classes || [])
      .filter(c => (sd.enrolled || []).includes(c.id))
      .map(({ id, name, days, time, duration, instructor, fee, color }) =>
        ({ id, name, days, time, duration, instructor, fee, color }))

    const historyEntry = {
      semesterId:   sd.enrolledSemesterId,
      semesterName: sd.enrolledSemesterName || 'Past Semester',
      semesterEnd:  sd.enrolledSemesterEnd  || '',
      classes:      oldClasses,
      archivedAt:   dateStr(),
    }

    updateStudentDoc(d => ({
      ...d,
      enrolled:             [],
      pendingEnroll:        [],
      enrolledSemesterId:   currentSemId,
      enrolledSemesterName: td.semester?.name    || '',
      enrolledSemesterEnd:  td.semester?.endDate || '',
      enrollmentHistory:    [...(d.enrollmentHistory || []), historyEntry],
    }))
  }, [td.semester?.id, sd.enrolledSemesterId, studentLoading])  // eslint-disable-line

  // ── Student Firestore listeners (active while student is logged in) ─
  function setupStudentListeners(email) {
    const encoded = encEmail(email)

    const unsubProfile = onSnapshot(doc(db, 'students', encoded), snap => {
      if (snap.exists()) {
        const data = snap.data()
        setSd(prev => ({
          ...prev,
          studentName:          data.studentName          ?? prev.studentName,
          cart:                 data.cart                 ?? prev.cart,
          enrolled:             data.enrolled             ?? prev.enrolled,
          pendingEnroll:        data.pendingEnroll        ?? prev.pendingEnroll,
          sessionPacks:         data.sessionPacks         ?? prev.sessionPacks,
          paymentHistory:       data.paymentHistory       ?? prev.paymentHistory,
          messages:             data.messages             ?? prev.messages,
          readMessageIds:       data.readMessageIds       ?? prev.readMessageIds,
          enrolledSemesterId:   data.enrolledSemesterId   ?? prev.enrolledSemesterId,
          enrolledSemesterName: data.enrolledSemesterName ?? prev.enrolledSemesterName,
          enrolledSemesterEnd:  data.enrolledSemesterEnd  ?? prev.enrolledSemesterEnd,
          enrollmentHistory:    data.enrollmentHistory    ?? prev.enrollmentHistory,
        }))
      }
      // Mark profile as loaded (whether doc exists or not)
      setStudentLoading(false)
    })

    const unsubLeaves = onSnapshot(
      query(collection(db, 'leaveRequests'), where('studentEmail', '==', email)),
      snap => {
        const leaves = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setSd(prev => ({ ...prev, leaveRequests: leaves }))
      }
    )

    return () => { unsubProfile(); unsubLeaves() }
  }

  // ── Teacher setters → Firestore ────────────────────────────────
  const setClasses = (v) => {
    setTd(prev => {
      const classes = applyFn(v, prev.classes)
      setDoc(doc(db, 'settings', 'main'), { classes }, { merge: true })
      return { ...prev, classes }
    })
  }

  const setTeacherEmails = (v) => {
    setTd(prev => {
      const teacherEmails = applyFn(v, prev.teacherEmails)
      setDoc(doc(db, 'settings', 'main'), { teacherEmails }, { merge: true })
      return { ...prev, teacherEmails }
    })
  }

  const setEmailConfig = (v) => {
    setTd(prev => {
      const emailConfig = applyFn(v, prev.emailConfig)
      setDoc(doc(db, 'settings', 'main'), { emailConfig }, { merge: true })
      return { ...prev, emailConfig }
    })
  }

  const setSemester = (v) => {
    setTd(prev => {
      const semester = applyFn(v, prev.semester)
      setDoc(doc(db, 'settings', 'main'), { semester }, { merge: true })
      return { ...prev, semester }
    })
  }

  // Teacher starts a new semester: give it a fresh ID so students auto-archive on next login
  const archiveSemester = (newSemData) => {
    setSemester({ id: `sem_${Date.now()}`, ...newSemData })
  }

  // Handles both student adds (new payment) and teacher status updates
  const setPendingPayments = (v) => {
    setTd(prev => {
      const newPayments = applyFn(v, prev.pendingPayments)
      const oldMap = Object.fromEntries(prev.pendingPayments.map(p => [String(p.id), p]))

      newPayments.forEach(p => {
        const pid = String(p.id)
        const { id, ...data } = p
        if (!oldMap[pid]) {
          // New payment submitted by student
          setDoc(doc(db, 'payments', pid), data)
        } else if (JSON.stringify(oldMap[pid]) !== JSON.stringify(p)) {
          // Teacher updated status (confirm/reject)
          setDoc(doc(db, 'payments', pid), data, { merge: true })
        }
      })

      return { ...prev, pendingPayments: newPayments }
    })
  }

  // Handles both student adds (new leave) and teacher updates (resolve/makeup)
  const setTeacherLeaves = (v) => {
    setTd(prev => {
      const newLeaves = applyFn(v, prev.leaveRequests)
      const oldMap = Object.fromEntries(prev.leaveRequests.map(l => [String(l.id), l]))

      newLeaves.forEach(l => {
        const lid = String(l.id)
        const { id, ...data } = l
        if (!oldMap[lid]) {
          setDoc(doc(db, 'leaveRequests', lid), data)
        } else if (JSON.stringify(oldMap[lid]) !== JSON.stringify(l)) {
          setDoc(doc(db, 'leaveRequests', lid), data, { merge: true })
        }
      })

      return { ...prev, leaveRequests: newLeaves }
    })
  }

  const setTeacherPayHist = (v) => {
    setTd(prev => {
      const newHist = applyFn(v, prev.paymentHistory)
      // Write only newly added entries
      const oldIds = new Set(prev.paymentHistory.map(h => String(h.id)))
      newHist.forEach(h => {
        if (!oldIds.has(String(h.id))) {
          const { id, ...data } = h
          setDoc(doc(db, 'paymentHistory', String(id)), data)
        }
      })
      return { ...prev, paymentHistory: newHist }
    })
  }

  // These are written via their specific action functions:
  const setEnrollments  = () => {}
  const setTeacherPacks = () => {}
  const setSentMessages = () => {}
  const setStudentInbox = () => {}

  // ── Student setters → Firestore (student doc, excluding leaveRequests) ─
  function updateStudentDoc(updater) {
    setSd(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      // Write to Firestore outside React's render cycle using a microtask
      if (studentEmailRef.current) {
        const encoded = encEmail(studentEmailRef.current)
        const { leaveRequests, ...toStore } = next
        Promise.resolve().then(() => {
          setDoc(doc(db, 'students', encoded), toStore, { merge: true })
            .catch(err => console.error('Firestore student write failed:', err))
        })
      }
      return next
    })
  }

  const setStudentName    = (v) => updateStudentDoc(d => ({ ...d, studentName:    applyFn(v, d.studentName) }))
  const setCart           = (v) => updateStudentDoc(d => ({ ...d, cart:           applyFn(v, d.cart) }))
  const setEnrolled       = (v) => updateStudentDoc(d => ({ ...d, enrolled:       applyFn(v, d.enrolled) }))
  const setPendingEnroll  = (v) => updateStudentDoc(d => ({ ...d, pendingEnroll:  applyFn(v, d.pendingEnroll) }))
  const setSessionPacks   = (v) => updateStudentDoc(d => ({ ...d, sessionPacks:   applyFn(v, d.sessionPacks) }))
  const setLeaveRequests  = () => {}  // managed via submitLeave/resolveLeave
  const setPaymentHistory = (v) => updateStudentDoc(d => ({ ...d, paymentHistory: applyFn(v, d.paymentHistory) }))
  const setStudentMessages= (v) => updateStudentDoc(d => ({ ...d, messages:       applyFn(v, d.messages) }))
  const setReadMessageIds = (v) => updateStudentDoc(d => ({ ...d, readMessageIds: applyFn(v, d.readMessageIds) }))

  // ── signUpForClasses ────────────────────────────────────────────
  function signUpForClasses(classIds) {
    updateStudentDoc(d => ({
      ...d,
      pendingEnroll: [...new Set([...(d.pendingEnroll||[]), ...classIds])]
    }))
  }

  // ── addClassToCart — atomically adds to cart AND pendingEnroll ──
  // Replaces the two-call pattern (setCart + signUpForClasses) to prevent
  // the race condition where two rapid Firestore writes could leave
  // pendingEnroll empty if logout happens between them.
  function addClassToCart(cls) {
    updateStudentDoc(d => ({
      ...d,
      cart: [...(d.cart||[]).filter(i => i.classId !== cls.id), { classId: cls.id, packageType: 'full' }],
      pendingEnroll: [...new Set([...(d.pendingEnroll||[]), cls.id])],
    }))
  }

  // ── addPackToCart — atomically adds 10-hour pack to cart ───────
  function addPackToCart() {
    updateStudentDoc(d => ({
      ...d,
      cart: d.cart?.some(i => i.classId === '__10pack__')
        ? d.cart
        : [...(d.cart||[]), { classId: '__10pack__', packageType: '10pack' }],
    }))
  }

  // ── enrollStudent (teacher confirms payment) ────────────────────
  async function enrollStudent(paymentItems, studentInfo) {
    const now        = dateStr()
    const encoded    = encEmail(studentInfo.email)
    const studentRef = doc(db, 'students', encoded)

    const classItems = paymentItems.filter(i => i.pkgType !== '10pack' && i.classId)
    const packItems  = paymentItems.filter(i => i.pkgType === '10pack')

    // Read current student doc to merge correctly
    const snap     = await getDoc(studentRef)
    const existing = snap.exists() ? snap.data() : defaultStudent()

    const addedIds     = classItems.map(i => i.classId)
    const newEnrolled  = [...new Set([...(existing.enrolled||[]), ...addedIds])]
    const newPending   = (existing.pendingEnroll||[]).filter(id => !addedIds.includes(id))

    let newPacks = []
    if (packItems.length > 0) {
      newPacks = packItems.map(item => ({
        id:           `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        sessionsUsed: 0,
        sessionLog:   [],
        total:        item.price,
        purchaseDate: now,
      }))
    }
    const newSessionPacks = [...(existing.sessionPacks||[]), ...newPacks]

    // Update student Firestore doc (tag with current semester)
    await setDoc(studentRef, {
      ...existing,
      enrolled:             newEnrolled,
      pendingEnroll:        newPending,
      sessionPacks:         newSessionPacks,
      enrolledSemesterId:   td.semester?.id      || existing.enrolledSemesterId || '',
      enrolledSemesterName: td.semester?.name    || existing.enrolledSemesterName || '',
      enrolledSemesterEnd:  td.semester?.endDate || existing.enrolledSemesterEnd  || '',
    }, { merge: true })

    // Reflect in local student state if they're currently logged in
    if (studentEmailRef.current === studentInfo.email) {
      setSd(prev => ({
        ...prev,
        enrolled:      newEnrolled,
        pendingEnroll: newPending,
        sessionPacks:  newSessionPacks,
      }))
    }

    // Add enrollment records (unique ID prevents duplicates)
    for (const item of classItems) {
      const enrollId = `${encoded}_${item.classId}`
      await setDoc(doc(db, 'enrollments', enrollId), {
        classId:      item.classId,
        className:    item.className,
        studentName:  studentInfo.name,
        studentEmail: studentInfo.email,
        pkgType:      item.pkgType,
        enrolledAt:   now,
      }, { merge: true })
    }

    // Add session pack records to teacher collection
    for (const pack of newPacks) {
      await setDoc(doc(db, 'sessionPacks', pack.id), {
        ...pack,
        studentName:  studentInfo.name,
        studentEmail: studentInfo.email,
      })
    }
  }

  // ── logSession ─────────────────────────────────────────────────
  async function logSession(packId, studentEmail, studentName, hours = 1, teacher = '') {
    const entry = { date: nowStr(), hours, ...(teacher ? { teacher } : {}) }
    const addHours = (prev) => parseFloat(Math.min((prev||0) + hours, 10).toFixed(1))

    // Optimistic update for the logged-in student
    setSd(d => ({ ...d, sessionPacks: d.sessionPacks.map(p =>
      p.id === packId ? {
        ...p,
        sessionsUsed: addHours(p.sessionsUsed),
        sessionLog:   [...(p.sessionLog||[]), entry],
      } : p
    )}))

    // Update student Firestore doc
    if (studentEmail) {
      const encoded  = encEmail(studentEmail)
      const snap     = await getDoc(doc(db, 'students', encoded))
      if (snap.exists()) {
        const data = snap.data()
        const updatedPacks = (data.sessionPacks||[]).map(p =>
          p.id === packId ? {
            ...p,
            sessionsUsed: addHours(p.sessionsUsed),
            sessionLog:   [...(p.sessionLog||[]), entry],
          } : p
        )
        await setDoc(doc(db, 'students', encoded), { sessionPacks: updatedPacks }, { merge: true })
      }
    }

    // Update teacher session pack in Firestore
    const packRef  = doc(db, 'sessionPacks', packId)
    const packSnap = await getDoc(packRef)
    if (packSnap.exists()) {
      const pd = packSnap.data()
      await setDoc(packRef, {
        ...pd,
        sessionsUsed: addHours(pd.sessionsUsed),
        sessionLog:   [...(pd.sessionLog||[]), { date: entry.date, hours, studentName: studentName||studentEmail, ...(teacher ? { teacher } : {}) }],
      })
    }
  }

  // ── submitLeave (student submits a leave request) ──────────────
  async function submitLeave(leaveReq) {
    const req = { ...leaveReq, status: 'pending' }
    const lid = String(req.id)
    const { id, ...data } = req

    await setDoc(doc(db, 'leaveRequests', lid), data)

    // Optimistic update for the currently logged-in student
    setSd(d => ({
      ...d,
      leaveRequests: d.leaveRequests.find(r => r.id === req.id)
        ? d.leaveRequests
        : [...d.leaveRequests, req]
    }))
  }

  // ── resolveLeave (teacher approves / declines) ─────────────────
  async function resolveLeave(leaveId, status, note='') {
    const lid = String(leaveId)
    await setDoc(doc(db, 'leaveRequests', lid), {
      status,
      teacherNote: note.trim(),
    }, { merge: true })

    // Update local student state if they're logged in
    if (studentEmailRef.current) {
      setSd(d => ({
        ...d,
        leaveRequests: d.leaveRequests.map(r =>
          r.id === leaveId ? { ...r, status, teacherNote: note.trim() } : r
        ),
      }))
    }
  }

  // ── requestMakeup (student requests a makeup class) ────────────
  async function requestMakeup(leaveId, makeupData) {
    const makeup = { ...makeupData, status: 'pending', requestedAt: nowStr() }
    const lid    = String(leaveId)

    await setDoc(doc(db, 'leaveRequests', lid), { makeup }, { merge: true })

    setSd(d => ({
      ...d,
      leaveRequests: d.leaveRequests.map(r =>
        r.id === leaveId ? { ...r, makeup } : r
      ),
    }))
  }

  // ── resolveMakeup (teacher approves / declines makeup) ─────────
  async function resolveMakeup(leaveId, status) {
    const resolvedAt = nowStr()
    const lid        = String(leaveId)

    const snap = await getDoc(doc(db, 'leaveRequests', lid))
    if (snap.exists()) {
      const current = snap.data()
      await setDoc(doc(db, 'leaveRequests', lid), {
        makeup: { ...current.makeup, status, resolvedAt },
      }, { merge: true })
    }

    if (studentEmailRef.current) {
      setSd(d => ({
        ...d,
        leaveRequests: d.leaveRequests.map(r =>
          r.id === leaveId && r.makeup
            ? { ...r, makeup: { ...r.makeup, status, resolvedAt } }
            : r
        ),
      }))
    }
  }

  // ── sendTeacherMessage ─────────────────────────────────────────
  async function sendTeacherMessage(msgObj) {
    const record = { ...msgObj, id: Date.now(), sentAt: nowStr() }
    const { id, ...data } = record

    // Store in sentMessages collection
    await setDoc(doc(db, 'teacherMessages', String(id)), data)

    // Deliver to each target student
    const targets = msgObj.toClass === 'all'
      ? td.enrollments
      : td.enrollments.filter(e => e.classId === Number(msgObj.toClass))

    const seen = new Set()
    for (const e of targets) {
      if (seen.has(e.studentEmail)) continue
      seen.add(e.studentEmail)

      const encoded = encEmail(e.studentEmail)
      const snap    = await getDoc(doc(db, 'students', encoded))
      const sData   = snap.exists() ? snap.data() : defaultStudent()

      await setDoc(doc(db, 'students', encoded), {
        messages: [...(sData.messages||[]), record],
      }, { merge: true })

      if (studentEmailRef.current === e.studentEmail) {
        setSd(d => ({ ...d, messages: [...(d.messages||[]), record] }))
      }
    }
  }

  // ── sendStudentMessage ─────────────────────────────────────────
  async function sendStudentMessage(msgObj) {
    const record = { ...msgObj, id: Date.now(), sentAt: nowStr() }
    const { id, ...data } = record
    await setDoc(doc(db, 'studentInbox', String(id)), data)
  }

  // ── markMessageRead ────────────────────────────────────────────
  function markMessageRead(msgId) {
    updateStudentDoc(d => ({
      ...d,
      readMessageIds: d.readMessageIds.includes(msgId)
        ? d.readMessageIds
        : [...d.readMessageIds, msgId],
    }))
  }

  // ── handleLogin ────────────────────────────────────────────────
  function handleLogin(loggedInUser) {
    startGlobalListeners()
    setUser(loggedInUser)
    if (loggedInUser.role === 'student') {
      const email = loggedInUser.email || loggedInUser.name || 'guest'
      studentEmailRef.current = email
      setSd(defaultStudent())
      setStudentLoading(true)
      const cleanup = setupStudentListeners(email)
      studentUnsubRef.current = cleanup
    }
  }

  // ── handleLogout ───────────────────────────────────────────────
  function handleLogout() {
    if (studentUnsubRef.current) {
      studentUnsubRef.current()
      studentUnsubRef.current = null
    }
    stopGlobalListeners()
    setUser(null)
    studentEmailRef.current = null
    setSd(defaultStudent())
    signOut(auth).catch(() => {})
  }

  // ── Render ─────────────────────────────────────────────────────
  if (!user) return <LoginPage onLogin={handleLogin} teacherEmails={td.teacherEmails} />

  return (
    <AppShell
      user={user} onLogout={handleLogout}
      classes={td.classes}               setClasses={setClasses}
      semester={td.semester}             setSemester={setSemester}  archiveSemester={archiveSemester}
      teacherEmails={td.teacherEmails}   setTeacherEmails={setTeacherEmails}
      pendingPayments={td.pendingPayments}   setPendingPayments={setPendingPayments}
      teacherLeaves={td.leaveRequests}       setTeacherLeaves={setTeacherLeaves}
      enrollments={td.enrollments}
      teacherSessionPacks={td.sessionPacks}
      teacherPayHistory={td.paymentHistory}  setTeacherPayHist={setTeacherPayHist}
      sentMessages={td.sentMessages}
      studentLoading={studentLoading}
      studentName={sd.studentName}           setStudentName={setStudentName}
      cart={sd.cart}                         setCart={setCart}
      enrolled={sd.enrolled}                 setEnrolled={setEnrolled}
      pendingEnroll={sd.pendingEnroll||[]}   setPendingEnroll={setPendingEnroll}
      sessionPacks={sd.sessionPacks}         setSessionPacks={setSessionPacks}
      enrollmentHistory={sd.enrollmentHistory||[]}
      leaveRequests={sd.leaveRequests}       setLeaveRequests={setLeaveRequests}
      paymentHistory={sd.paymentHistory}     setPaymentHistory={setPaymentHistory}
      studentMessages={sd.messages}
      readMessageIds={sd.readMessageIds||[]}
      enrollStudent={enrollStudent}
      signUpForClasses={signUpForClasses}
      addClassToCart={addClassToCart}
      addPackToCart={addPackToCart}
      logSession={logSession}
      submitLeave={submitLeave}
      resolveLeave={resolveLeave}
      requestMakeup={requestMakeup}
      resolveMakeup={resolveMakeup}
      sendTeacherMessage={sendTeacherMessage}
      studentInbox={td.studentInbox||[]}
      sendStudentMessage={sendStudentMessage}
      markMessageRead={markMessageRead}
      emailConfig={td.emailConfig||{}}
      setEmailConfig={setEmailConfig}
    />
  )
}
