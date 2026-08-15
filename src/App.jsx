import { useState, useRef, useEffect } from 'react'
import { db, auth } from './config/firebase'
import {
  doc, collection, onSnapshot, setDoc, getDoc, addDoc, deleteDoc,
  query, where,
} from 'firebase/firestore'
import { signOut, onAuthStateChanged } from 'firebase/auth'
import LoginPage from './pages/LoginPage'
import AppShell from './components/AppShell'
import { CLASSES, SEMESTER } from './data/mockData'
import { sendEmailToMany, isEmailConfigured } from './utils/emailService'
import { verifyTeacherAccess } from './utils/teacherAccess'
import { TEACHER_EMAILS } from './config'

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
  classChangeLog:       [],
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
  emailConfig:      { serviceId:'', templateId:'', publicKey:'' },
  semester:         { id: 'sem_initial', name: SEMESTER.name, startDate: '2026-08-10', endDate: '2026-12-20' },
  summarySchedule:     { frequency:'weekly', dayOfWeek:1, dayOfMonth:1 },
  summaryLastSent:     '',

})

export default function App() {
  const [user, setUser]           = useState(null)
  const [td,   setTd]             = useState(defaultTeacher())
  const [sd,   setSd]             = useState(defaultStudent())
  const [studentLoading, setStudentLoading] = useState(false)
  const studentEmailRef = useRef(null)
  const studentUnsubRef = useRef(null)
  const globalUnsubRef  = useRef(null)

  // ── Auto-restore session after mobile reload ──────────────────
  useEffect(() => {
    const savedRole = localStorage.getItem('pendingLoginRole')
    if (!savedRole) return  // no pending restore

    // Only the FIRST auth state emission counts as the post-reload restore.
    // If it resolves to no user, the saved role is stale (e.g. an abandoned or
    // failed sign-in) — clear it so it can't hijack a later, unrelated login.
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      unsub()
      localStorage.removeItem('pendingLoginRole')
      if (!fbUser) return

      // pendingLoginRole comes from localStorage, so never trust it for the
      // teacher role — re-verify against the allow-list before restoring.
      if (savedRole === 'teacher' && !(await verifyTeacherAccess(fbUser.email, td.teacherEmails))) {
        signOut(auth).catch(() => {})
        return
      }

      const initials = fbUser.displayName
        ? fbUser.displayName.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()
        : fbUser.email.slice(0,2).toUpperCase()
      handleLogin({ role: savedRole, name: fbUser.displayName || fbUser.email, initials, email: fbUser.email, avatar: fbUser.photoURL, provider: 'google' })
    })
    return () => unsub()
  }, [])  // eslint-disable-line

  // ── Start global Firestore listeners (called after login) ──────
  // Students only get the shared settings doc and their OWN payments.
  // The teacher-wide collections below carry every student's personal and
  // payment data (including receipt images), so subscribing a student to
  // them would ship the whole academy's records to their browser — and the
  // Firestore rules deny those reads.
  function startGlobalListeners(role, studentEmail) {
    if (globalUnsubRef.current) return  // already running

    const isTeacher = role === 'teacher'

    // settings/main — class list and semester dates. Readable by everyone
    // signed in, because every student page needs it.
    const unsubSettings = onSnapshot(doc(db, 'settings', 'main'), snap => {
      if (snap.exists()) {
        const data = snap.data()
        setTd(prev => ({
          ...prev,
          classes:  data.classes  || prev.classes,
          semester: data.semester || prev.semester,
        }))
      } else if (isTeacher) {
        // Only teachers may write settings/main under the Firestore rules;
        // a student hitting this branch would just log a permission error.
        setDoc(doc(db, 'settings', 'main'), {
          classes:  CLASSES,
          semester: { id: `sem_${Date.now()}`, name: SEMESTER.name, startDate: '2026-08-10', endDate: '2026-12-20' },
        })
      }
    })

    // settings/private — teacher allow-list and EmailJS credentials.
    // Deliberately teacher-only: Firestore rules are per-document, so these
    // fields had to leave settings/main to stop students reading them.
    const unsubPrivate = isTeacher
      ? onSnapshot(doc(db, 'settings', 'private'), snap => {
          if (!snap.exists()) {
            // Never leave this doc missing: the Firestore rules read the
            // allow-list from it, so without it only the hard-coded root
            // teachers can get in.
            setDoc(doc(db, 'settings', 'private'), {
              teacherEmails:   TEACHER_EMAILS,
              emailConfig:     { serviceId:'', templateId:'', publicKey:'' },
              summarySchedule: { frequency:'weekly', dayOfWeek:1, dayOfMonth:1 },
              summaryLastSent: '',
            })
            return
          }
          const data = snap.data()
          setTd(prev => ({
            ...prev,
            teacherEmails:   data.teacherEmails   || prev.teacherEmails,
            emailConfig:     data.emailConfig     || prev.emailConfig,
            summarySchedule: data.summarySchedule ?? prev.summarySchedule,
            summaryLastSent: data.summaryLastSent ?? prev.summaryLastSent,
          }))
        })
      : () => {}

    // Students see only their own payments; teachers see all of them.
    // Student pages (Dashboard, Hub) already filter by studentEmail, so the
    // scoped query returns exactly what they were picking out client-side.
    const paymentsQuery = isTeacher
      ? collection(db, 'payments')
      : query(collection(db, 'payments'), where('studentEmail', '==', studentEmail || '__no_student__'))

    const unsubPayments = onSnapshot(paymentsQuery, snap => {
      const payments = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setTd(prev => ({ ...prev, pendingPayments: payments }))
    })

    // Everything below is teacher-only data. No student page reads it:
    // a student's own leave requests, packs and history come from their
    // students/{email} doc and the scoped leaveRequests query in
    // setupStudentListeners.
    const teacherUnsubs = []
    if (isTeacher) {
      teacherUnsubs.push(onSnapshot(collection(db, 'leaveRequests'), snap => {
        const leaves = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setTd(prev => ({ ...prev, leaveRequests: leaves }))
      }))

      teacherUnsubs.push(onSnapshot(collection(db, 'enrollments'), snap => {
        const enrollments = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setTd(prev => ({ ...prev, enrollments }))
      }))

      teacherUnsubs.push(onSnapshot(collection(db, 'sessionPacks'), snap => {
        const packs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setTd(prev => ({ ...prev, sessionPacks: packs }))
      }))

      teacherUnsubs.push(onSnapshot(collection(db, 'teacherMessages'), snap => {
        const messages = snap.docs.map(d => ({ ...d.data(), id: d.id }))
        setTd(prev => ({ ...prev, sentMessages: messages }))
      }))

      teacherUnsubs.push(onSnapshot(collection(db, 'studentInbox'), snap => {
        const inbox = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setTd(prev => ({ ...prev, studentInbox: inbox }))
      }))

      teacherUnsubs.push(onSnapshot(collection(db, 'paymentHistory'), snap => {
        const hist = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setTd(prev => ({ ...prev, paymentHistory: hist }))
      }))
    }

    globalUnsubRef.current = () => {
      unsubSettings(); unsubPrivate(); unsubPayments()
      teacherUnsubs.forEach(u => u())
    }
  }

  function stopGlobalListeners() {
    if (globalUnsubRef.current) {
      globalUnsubRef.current()
      globalUnsubRef.current = null
    }
    setTd(prev => ({ ...defaultTeacher(), teacherEmails: prev.teacherEmails }))
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
          classChangeLog:       data.classChangeLog       ?? prev.classChangeLog,
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
      setDoc(doc(db, 'settings', 'private'), { teacherEmails }, { merge: true })
      return { ...prev, teacherEmails }
    })
  }

  const setEmailConfig = (v) => {
    setTd(prev => {
      const emailConfig = applyFn(v, prev.emailConfig)
      setDoc(doc(db, 'settings', 'private'), { emailConfig }, { merge: true })
      return { ...prev, emailConfig }
    })
  }

  const setSummarySchedule = (v) => {
    setTd(prev => {
      const summarySchedule = applyFn(v, prev.summarySchedule)
      setDoc(doc(db, 'settings', 'private'), { summarySchedule }, { merge: true })
      return { ...prev, summarySchedule }
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

  // ── addClassToCart — auto-enroll student immediately ──
  // Students are now enrolled directly (no payment approval needed).
  // Classes are immediately added to 'enrolled' instead of 'pendingEnroll'.
  function addClassToCart(cls) {
    updateStudentDoc(d => ({
      ...d,
      cart: [...(d.cart||[]).filter(i => i.classId !== cls.id), { classId: cls.id, packageType: 'full' }],
      enrolled: [...new Set([...(d.enrolled||[]), cls.id])],
    }))

    // Also record a timestamped enrollment document. students/{id}.enrolled is
    // only a list of class ids with no dates, so it cannot answer "who signed
    // up this week" — and the enrollments collection is what the teacher
    // Roster, the Dashboard student count, Messages recipient filtering and
    // the weekly summary all read. Before this, auto-enrolment wrote none of
    // them and every one of those screens was empty.
    // Fee and deposit line items ("Registration Fee", "Team 2 Deposit") live in
    // the same class list but have no schedule. They are payments, not
    // enrolments, and must not show up on the Roster.
    const isRealClass = !!(String(cls.days || '').trim() || String(cls.time || '').trim())

    const email = studentEmailRef.current
    if (email && isRealClass) {
      const enrollId = `${encEmail(email)}_${cls.id}`
      setDoc(doc(db, 'enrollments', enrollId), {
        classId:      cls.id,
        className:    cls.name || '',
        studentEmail: email,
        studentName:  sd.studentName || '',
        pkgType:      'full',
        enrolledAt:   nowStr(),
        // Snapshot the schedule at enrollment time so the Roster still shows
        // it correctly if this class is later edited or deleted — a class
        // deletion has no cascade cleanup, so a live-only lookup would go blank.
        days:         cls.days       || '',
        time:         cls.time       || '',
        instructor:   cls.instructor || '',
        category:     cls.category   || '',
        fee:          cls.fee        ?? null,
      }, { merge: true }).catch(err => console.error('Enrollment record failed:', err))
    }
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

    // Update student Firestore doc (merge: true preserves all other fields)
    await setDoc(studentRef, {
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
      const clsObj   = td.classes.find(c => c.id === item.classId)
      await setDoc(doc(db, 'enrollments', enrollId), {
        classId:      item.classId,
        className:    item.className,
        studentName:  studentInfo.name,
        studentEmail: studentInfo.email,
        pkgType:      item.pkgType,
        enrolledAt:   now,
        days:         clsObj?.days       || '',
        time:         clsObj?.time       || '',
        instructor:   clsObj?.instructor || '',
        category:     clsObj?.category   || '',
        fee:          clsObj?.fee        ?? null,
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

  // ── switchStudentClass (teacher moves a student to a different class) ──
  // Package hours are not tracked per-class in this app (10-hour packs are
  // generic, not tied to a classId), so switching only ever needs to move
  // the enrolled slot itself — `enrolled` on the student doc and the
  // matching `enrollments` record that the Roster / Messages / summary read.
  async function switchStudentClass(studentEmail, studentName, fromClassId, toClassId, note = '') {
    const encoded     = encEmail(studentEmail)
    const studentRef  = doc(db, 'students', encoded)
    const snap        = await getDoc(studentRef)
    const existing    = snap.exists() ? snap.data() : defaultStudent()

    const fromClass   = td.classes.find(c => c.id === fromClassId)
    const toClass     = td.classes.find(c => c.id === toClassId)
    const oldEnrollId = `${encoded}_${fromClassId}`
    const oldSnap     = await getDoc(doc(db, 'enrollments', oldEnrollId))
    const pkgType     = oldSnap.exists() ? (oldSnap.data().pkgType || 'full') : 'full'

    const newEnrolled = [...new Set([...(existing.enrolled||[]).filter(id => id !== fromClassId), toClassId])]
    const newPending  = (existing.pendingEnroll||[]).filter(id => id !== fromClassId)
    const logEntry    = {
      type: 'switch',
      fromClassId, fromClassName: fromClass?.name || '',
      toClassId,   toClassName:   toClass?.name || '',
      date: nowStr(), note: note.trim(),
    }
    const newLog = [...(existing.classChangeLog||[]), logEntry]

    await setDoc(studentRef, {
      enrolled: newEnrolled, pendingEnroll: newPending, classChangeLog: newLog,
    }, { merge: true })

    if (studentEmailRef.current === studentEmail) {
      setSd(prev => ({ ...prev, enrolled: newEnrolled, pendingEnroll: newPending, classChangeLog: newLog }))
    }

    await deleteDoc(doc(db, 'enrollments', oldEnrollId))
    await setDoc(doc(db, 'enrollments', `${encoded}_${toClassId}`), {
      classId: toClassId, className: toClass?.name || '',
      studentEmail, studentName: existing.studentName || studentName || '',
      pkgType, enrolledAt: nowStr(),
      days:       toClass?.days       || '',
      time:       toClass?.time       || '',
      instructor: toClass?.instructor || '',
      category:   toClass?.category   || '',
      fee:        toClass?.fee        ?? null,
    }, { merge: true })
  }

  // ── dropStudentClass (teacher withdraws a student from a class) ────────
  async function dropStudentClass(studentEmail, studentName, classId, note = '') {
    const encoded    = encEmail(studentEmail)
    const studentRef = doc(db, 'students', encoded)
    const snap       = await getDoc(studentRef)
    const existing   = snap.exists() ? snap.data() : defaultStudent()

    const cls        = td.classes.find(c => c.id === classId)
    const newEnrolled = (existing.enrolled||[]).filter(id => id !== classId)
    const newPending  = (existing.pendingEnroll||[]).filter(id => id !== classId)
    const logEntry    = {
      type: 'drop', fromClassId: classId, fromClassName: cls?.name || '',
      date: nowStr(), note: note.trim(),
    }
    const newLog = [...(existing.classChangeLog||[]), logEntry]

    await setDoc(studentRef, {
      enrolled: newEnrolled, pendingEnroll: newPending, classChangeLog: newLog,
    }, { merge: true })

    if (studentEmailRef.current === studentEmail) {
      setSd(prev => ({ ...prev, enrolled: newEnrolled, pendingEnroll: newPending, classChangeLog: newLog }))
    }

    await deleteDoc(doc(db, 'enrollments', `${encoded}_${classId}`))
  }

  // ── editSessionDate ────────────────────────────────────────────
  async function editSessionDate(packId, entryIndex, newDate, studentEmail, newTeacher, newHours) {
    const patch = logs => logs.map((e, i) => {
      if (i !== entryIndex) return e
      const { teacher: _t, ...base } = e
      const entry = { ...base, date: newDate }
      if (newHours != null) entry.hours = newHours
      if (newTeacher) entry.teacher = newTeacher
      return entry
    })

    const patchPack = p => {
      const newLog = patch(p.sessionLog || [])
      if (newHours == null) return { ...p, sessionLog: newLog }
      const oldHours = (p.sessionLog || [])[entryIndex]?.hours ?? 1
      const newSessionsUsed = parseFloat(Math.min(10, Math.max(0, (p.sessionsUsed || 0) - oldHours + newHours)).toFixed(1))
      return { ...p, sessionLog: newLog, sessionsUsed: newSessionsUsed }
    }

    setSd(d => ({ ...d, sessionPacks: d.sessionPacks.map(p =>
      p.id === packId ? patchPack(p) : p
    )}))

    if (studentEmail) {
      const encoded = encEmail(studentEmail)
      const snap    = await getDoc(doc(db, 'students', encoded))
      if (snap.exists()) {
        const data = snap.data()
        const updatedPacks = (data.sessionPacks || []).map(p =>
          p.id === packId ? patchPack(p) : p
        )
        await setDoc(doc(db, 'students', encoded), { sessionPacks: updatedPacks }, { merge: true })
      }
    }

    const packRef  = doc(db, 'sessionPacks', packId)
    const packSnap = await getDoc(packRef)
    if (packSnap.exists()) {
      const pd = packSnap.data()
      await setDoc(packRef, patchPack(pd))
    }
  }

  // ── deleteSession ───────────────────────────────────────────────
  async function deleteSession(packId, entryIndex, studentEmail) {
    const patchPack = p => {
      const oldHours = (p.sessionLog || [])[entryIndex]?.hours ?? 1
      const newLog = (p.sessionLog || []).filter((_, i) => i !== entryIndex)
      const newSessionsUsed = parseFloat(Math.max(0, (p.sessionsUsed || 0) - oldHours).toFixed(1))
      return { ...p, sessionLog: newLog, sessionsUsed: newSessionsUsed }
    }

    setSd(d => ({ ...d, sessionPacks: d.sessionPacks.map(p =>
      p.id === packId ? patchPack(p) : p
    )}))

    if (studentEmail) {
      const encoded = encEmail(studentEmail)
      const snap    = await getDoc(doc(db, 'students', encoded))
      if (snap.exists()) {
        const data = snap.data()
        const updatedPacks = (data.sessionPacks || []).map(p =>
          p.id === packId ? patchPack(p) : p
        )
        await setDoc(doc(db, 'students', encoded), { sessionPacks: updatedPacks }, { merge: true })
      }
    }

    const packRef  = doc(db, 'sessionPacks', packId)
    const packSnap = await getDoc(packRef)
    if (packSnap.exists()) {
      const pd = packSnap.data()
      await setDoc(packRef, patchPack(pd))
    }
  }

  // ── logSession ─────────────────────────────────────────────────
  async function logSession(packId, studentEmail, studentName, hours = 1, teacher = '', date = '') {
    const entry = { date: date || nowStr(), hours, ...(teacher ? { teacher } : {}) }
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
  // Leave requests are now auto-approved (status: 'approved') for immediate effect.
  // Teachers can review the log later for bulk actions.
  async function submitLeave(leaveReq) {
    const req = { ...leaveReq, status: 'approved', autoApprovedAt: nowStr() }
    const lid = String(req.id)
    const { id, ...data } = req

    await setDoc(doc(db, 'leaveRequests', lid), data)
    // onSnapshot listener will update leaveRequests automatically — no optimistic update needed
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
  // Makeup requests are now auto-approved for immediate effect.
  // Teachers can review the log later for bulk actions.
  async function requestMakeup(leaveId, makeupData) {
    const lid       = String(leaveId)
    const leaveSnap = await getDoc(doc(db, 'leaveRequests', lid))
    const leaveData = leaveSnap.exists() ? leaveSnap.data() : {}

    // Fee is the flat difference between the two classes' per-session price —
    // computed here (not trusted from the client) so it can't be spoofed, and
    // zero when the makeup class costs the same or less than the student's own.
    const currentClass = td.classes.find(c => c.name === leaveData.className)
    const newClass      = td.classes.find(c => c.name === makeupData.className)
    const fee = Math.max(0, (newClass?.fee || 0) - (currentClass?.fee || 0))

    const makeup = { ...makeupData, status: 'approved', autoApprovedAt: nowStr(), requestedAt: nowStr(), fee }

    await setDoc(doc(db, 'leaveRequests', lid), { makeup }, { merge: true })

    setSd(d => ({
      ...d,
      leaveRequests: d.leaveRequests.map(r =>
        r.id === leaveId ? { ...r, makeup } : r
      ),
    }))

    // Fee gets filed as a pending payment so it goes through the same
    // Zelle/Venmo/cash confirmation flow as every other charge. classId is
    // deliberately omitted — enrollStudent() only enrolls items that carry a
    // classId, and confirming this fee must never re-enroll the student.
    if (fee > 0 && leaveData.studentEmail) {
      await setDoc(doc(db, 'payments', `makeup_${lid}_${Date.now()}`), {
        studentName:  leaveData.studentName  || makeupData.studentName || '',
        studentEmail: leaveData.studentEmail,
        items:  [{ classId: null, className: makeupData.className, pkgType: 'makeupFee', price: fee }],
        method: '', note: `Makeup class fee: ${leaveData.className || 'current class'} → ${makeupData.className}`,
        total:  fee, status: 'pending', submittedAt: nowStr(),
      })
    }
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

  // ── sendWeeklySummary (manual trigger from Configuration page) ──
  async function sendWeeklySummary() {
    const { emailConfig, teacherEmails: emails, leaveRequests, enrollments: allEnrollments, pendingPayments, sessionPacks } = td

    if (!isEmailConfigured(emailConfig)) throw new Error('EMAIL_NOT_CONFIGURED')
    if (!emails || emails.length === 0) throw new Error('No teacher emails configured')

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // Parse locale date strings used by the app. The app has written two formats
    // over time and both must work:
    //   "Aug 11, 2026 at 11:46 PM"   (current)
    //   "Jun 4, 2026, 08:53 PM"      (older)
    //   "Aug 13, 2026"               (date only, e.g. session logs)
    // The " at " variant used to fall through to Invalid Date, which made
    // isWithinWeek() false for every recent record — so leave requests, make-ups
    // and package purchases silently vanished from the summary.
    function parseAppDate(str) {
      if (!str) return null
      let clean = String(str).trim().replace(/\s+at\s+/i, ', ')
      let d = new Date(clean)
      if (!isNaN(d.getTime())) return d
      // Last resort: drop the time entirely and keep the date.
      clean = clean.replace(/,\s*\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?\s*$/i, '')
      d = new Date(clean)
      return isNaN(d.getTime()) ? null : d
    }
    function isWithinWeek(str) {
      const d = parseAppDate(str)
      return d !== null && d >= weekAgo
    }

    const PKG_LABELS = { full:'Full semester', '10pack':'10-session pack', dropin:'Drop-in' }

    const recentLeaves    = leaveRequests.filter(r => isWithinWeek(r.autoApprovedAt || r.submittedAt))
    const recentMakeups   = leaveRequests.filter(r => r.makeup && isWithinWeek(r.makeup.requestedAt))
    const recentEnrolls   = allEnrollments.filter(e => isWithinWeek(e.enrolledAt))
    const confirmedPacks  = (pendingPayments||[]).filter(p =>
      p.status === 'confirmed' && isWithinWeek(p.submittedAt) && (p.items||[]).some(i => i.pkgType === '10pack')
    )
    const pendingPacks    = (pendingPayments||[]).filter(p =>
      p.status === 'pending' && isWithinWeek(p.submittedAt) && (p.items||[]).some(i => i.pkgType === '10pack')
    )
    const completedPacks  = (sessionPacks||[]).filter(p =>
      (p.sessionsUsed || 0) >= 10 &&
      isWithinWeek((p.sessionLog || []).slice(-1)[0]?.date)
    )

    const weekOf = new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })

    const lines = [
      `Weekly Summary — Week of ${weekOf}`,
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

    lines.push('', `NEW REGISTRATIONS (${recentEnrolls.length})`, '--------------------------------')
    if (recentEnrolls.length === 0) {
      lines.push('No new registrations this week.')
    } else {
      recentEnrolls.forEach(e => {
        lines.push(`• ${e.studentName || 'Unknown'} — ${e.className || ''}`)
        lines.push(`  Type: ${PKG_LABELS[e.pkgType] || e.pkgType || ''}  |  Enrolled: ${e.enrolledAt || ''}`)
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

    const result = await sendEmailToMany(emailConfig, emails.map(email => ({ email, name: 'Teacher' })), {
      fromName: 'Youtopia Dance Academy',
      subject:  `[Youtopia] Weekly Summary — ${weekOf}`,
      message:  lines.join('\n'),
    })
    // Only record the send date if at least one email actually went out —
    // otherwise "Last sent" would report a success that never happened and the
    // Cloud Function would skip its own attempt for the rest of the day.
    if (result.sent > 0) {
      const p = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
      const todayISO = `${p.getFullYear()}-${String(p.getMonth()+1).padStart(2,'0')}-${String(p.getDate()).padStart(2,'0')}`
      await setDoc(doc(db, 'settings', 'private'), { summaryLastSent: todayISO }, { merge: true })
      setTd(prev => ({ ...prev, summaryLastSent: todayISO }))
    }
    return result
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
    const isStudent = loggedInUser.role === 'student'
    const email = loggedInUser.email || loggedInUser.name || 'guest'

    // The student email has to be known before the global listeners start:
    // a student's payments listener is scoped to it.
    if (isStudent) studentEmailRef.current = email

    startGlobalListeners(loggedInUser.role, isStudent ? email : null)
    setUser(loggedInUser)

    if (isStudent) {
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
      switchStudentClass={switchStudentClass}
      dropStudentClass={dropStudentClass}
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
      editSessionDate={editSessionDate}
      deleteSession={deleteSession}
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
      summarySchedule={td.summarySchedule||{}}
      setSummarySchedule={setSummarySchedule}
      summaryLastSent={td.summaryLastSent||''}
      sendWeeklySummary={sendWeeklySummary}

    />
  )
}
