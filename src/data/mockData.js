// ── Semester (parsed from 8月-12月 2026舞蹈课堂.pdf) ─────────────
export const SEMESTER = {
  name:  '8月–12月 2026',
  start: 'Aug 10, 2026',
  end:   'Dec 20, 2026',
  specialDates: [
    { date: 'Sep 7, 2026',        label: "Labor Day — no class" },
    { date: 'Nov 25–29, 2026',    label: 'Thanksgiving — no class' },
    { date: 'Dec 21, 2026',       label: 'Winter break (last day of season)' },
  ],
  makeUpPolicy: '3 free make-up classes per semester. Same level/type only. Cannot carry over to next semester. Classes with no same-level option: 3 sessions can transfer to next semester tuition.',
  packagePolicy: '10-class packs expire 3 months from purchase. Unused sessions cannot carry over.',
  paymentNote: 'Zelle: Youtopia Dance Academy, LLC · Check: Youtopia Dance Academy · Please note student name and class. Send receipt screenshot to WeChat to confirm.',
  registrationFee: 20,
  studioRental: 70,
}

// ── Full class list from PDF ─────────────────────────────────
export const CLASSES = [
  // 少儿部 — Kids
  { id: 1,  name: 'Ballet L3 (Tue)',          category: 'kids',  days: '周二 Tue', time: '4:30pm–6:30pm',   duration: '2hr',   fee: 48,  sessions: 19, instructor: '叶老师',   color: '#E8401A' },
  { id: 2,  name: 'Level 6 A1',               category: 'kids',  days: '周四 Thu', time: '4:30pm–7:00pm',   duration: '2.5hr', fee: 60,  sessions: 18, instructor: 'Lara',    color: '#F47B20' },
  { id: 3,  name: 'Level 4 B1',               category: 'kids',  days: '周五 Fri', time: '3:30pm–5:30pm',   duration: '2hr',   fee: 48,  sessions: 18, instructor: 'Annie',   color: '#F5B800' },
  { id: 4,  name: 'Level 3 B3',               category: 'kids',  days: '周五 Fri', time: '5:40pm–7:40pm',   duration: '2hr',   fee: 48,  sessions: 18, instructor: 'Annie',   color: '#C94A8B' },
  { id: 5,  name: 'Age 9 & up (Hip Hop)',     category: 'kids',  days: '周五 Fri', time: '7:40pm–9:10pm',   duration: '1.5hr', fee: 38,  sessions: 18, instructor: 'Yi Ning', color: '#185FA5' },
  { id: 6,  name: 'Contemporary Level 5 A2',  category: 'kids',  days: '周六 Sat', time: '9:00am–11:30am',  duration: '2.5hr', fee: 60,  sessions: 18, instructor: 'Lara',    color: '#0F6E56' },
  { id: 7,  name: 'Dance Technique',          category: 'kids',  days: '周六 Sat', time: '11:30am–1:00pm',  duration: '1.5hr', fee: 38,  sessions: 18, instructor: 'Lara',    color: '#6B38FB' },
  { id: 8,  name: 'Level 6 A3',               category: 'kids',  days: '周六 Sat', time: '1:00pm–3:30pm',   duration: '2.5hr', fee: 60,  sessions: 16, instructor: '雅婷',    color: '#E8401A' },
  { id: 9,  name: 'Ballet L2 (Sat)',          category: 'kids',  days: '周六 Sat', time: '7:00pm–9:00pm',   duration: '2hr',   fee: 48,  sessions: 18, instructor: '叶老师',   color: '#F47B20' },
  { id: 10, name: 'Level 1 C2',               category: 'kids',  days: '周日 Sun', time: '9:30am–10:30am',  duration: '1hr',   fee: 30,  sessions: 16, instructor: '雅婷',    color: '#F5B800' },
  { id: 11, name: 'Level 2 C1',               category: 'kids',  days: '周日 Sun', time: '10:30am–12:00pm', duration: '1.5hr', fee: 38,  sessions: 16, instructor: '雅婷',    color: '#C94A8B' },
  { id: 12, name: 'Tumbling',                 category: 'kids',  days: '周日 Sun', time: '1:00pm–2:30pm',   duration: '1.5hr', fee: 38,  sessions: 18, instructor: 'Leo',     color: '#185FA5' },
  { id: 13, name: 'Level 4 B2',               category: 'kids',  days: '周日 Sun', time: '3:00pm–5:00pm',   duration: '2hr',   fee: 48,  sessions: 16, instructor: '雅婷',    color: '#0F6E56' },
  { id: 14, name: 'Ballet L3 (Sun)',          category: 'kids',  days: '周日 Sun', time: '6:00pm–8:00pm',   duration: '2hr',   fee: 48,  sessions: 18, instructor: 'Lara',    color: '#6B38FB' },
  // 成人部 — Adult
  { id: 15, name: '成人班 Adult Class',       category: 'adult', days: '周四 Thu', time: '10:15am–11:45am', duration: '1.5hr', fee: 38,  sessions: 10, instructor: 'Lara',    color: '#185FA5' },
  { id: 16, name: 'Drop-in (Adult)',          category: 'adult', days: 'Any',      time: 'Confirm day before',duration:'1.5hr', fee: 40,  sessions: 1,  instructor: 'Lara',    color: '#0F6E56' },
  // Competition Team
  { id: 17, name: 'Competition Team 1 (Age 9+)',  category: 'comp', days: '周一 Mon', time: '4:00pm–6:30pm', duration: '2.5hr', fee: 65, sessions: 18, instructor: 'Lara',   color: '#F47B20' },
  { id: 18, name: 'Competition Team 2 (Age 6-8)', category: 'comp', days: '周一 Mon', time: '6:30pm–8:30pm', duration: '2hr',   fee: 55, sessions: 18, instructor: 'Lara',   color: '#C94A8B' },
]

export const CATEGORY_LABELS = {
  kids:  '少儿部 — Kids',
  adult: '成人部 — Adult',
  comp:  'Competition Team',
}

// ── Empty state defaults (no fake student data) ──────────────
export const LEAVE_REQUESTS   = []
export const STUDENTS         = []
export const ATTENDANCE       = []
export const PAYMENTS         = []
export const NOTIFICATIONS    = []
export const STUDENT_PACKAGE  = null
export const DROP_IN_CLASSES  = []
export const STUDENT_UPCOMING = []
export const STUDENT_PAYMENTS = []
export const TODAY_CLASSES    = []
