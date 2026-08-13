// Copies the private fields out of settings/main into settings/private.
// Step 2 (removing them from settings/main) is a separate run with --purge,
// so the copy can be verified while old clients still work.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const cs = require(`${process.env.HOME}/.config/configstore/firebase-tools.json`)
const TOKEN = cs.tokens.access_token
const BASE = 'https://firestore.googleapis.com/v1/projects/youtopia-3e141/databases/(default)/documents'
const PRIVATE_FIELDS = ['teacherEmails', 'emailConfig', 'summarySchedule', 'summaryLastSent']
const PURGE = process.argv.includes('--purge')

const hdr = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const get = async (p) => (await fetch(`${BASE}/${p}`, { headers: hdr })).json()

// Summarise without dumping secrets.
const describe = (fields = {}) => Object.entries(fields).map(([k, v]) => {
  if (v.arrayValue) return `${k}[${(v.arrayValue.values || []).length}]`
  if (v.mapValue) return `${k}{${Object.keys(v.mapValue.fields || {}).join(',')}}`
  return `${k}=${(v.stringValue ?? '').length ? 'set' : 'empty'}`
}).join(' ')

const canon = (v) => {
  if (Array.isArray(v)) return v.map(canon)
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])]))
  return v
}
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b))

const main = await get('settings/main')
if (main.error) { console.error('read failed:', main.error.message); process.exit(1) }
console.log('settings/main  :', describe(main.fields))

if (!PURGE) {
  const fields = {}
  for (const f of PRIVATE_FIELDS) if (main.fields?.[f] !== undefined) fields[f] = main.fields[f]
  const missing = PRIVATE_FIELDS.filter(f => !(f in fields))
  if (missing.length) console.log('note: not present in main, skipping:', missing.join(', '))

  const mask = Object.keys(fields).map(f => `updateMask.fieldPaths=${f}`).join('&')
  const r = await fetch(`${BASE}/settings/private?${mask}`, {
    method: 'PATCH', headers: hdr, body: JSON.stringify({ fields }),
  })
  const out = await r.json()
  if (out.error) { console.error('write failed:', out.error.message); process.exit(1) }
  console.log('settings/private:', describe(out.fields))

  // Prove the copy is faithful before anything is deleted.
  const priv = await get('settings/private')
  let ok = true
  for (const f of Object.keys(fields)) {
    if (!same(priv.fields[f], main.fields[f])) { ok = false; console.error(`MISMATCH on ${f}`) }
  }
  console.log(ok ? '\nverified: every copied field is byte-identical to the original' : '\nVERIFY FAILED')
  process.exit(ok ? 0 : 1)
}

// --purge: delete the copied fields from settings/main.
const priv = await get('settings/private')
if (priv.error) { console.error('settings/private missing — refusing to purge'); process.exit(1) }
const copied = PRIVATE_FIELDS.filter(f => priv.fields?.[f] !== undefined)
for (const f of copied) {
  if (main.fields?.[f] !== undefined && !same(priv.fields[f], main.fields[f])) {
    console.error(`refusing to purge: ${f} differs between main and private`); process.exit(1)
  }
}
const mask = copied.map(f => `updateMask.fieldPaths=${f}`).join('&')
const r = await fetch(`${BASE}/settings/main?${mask}`, {
  method: 'PATCH', headers: hdr, body: JSON.stringify({ fields: {} }),
})
const out = await r.json()
if (out.error) { console.error('purge failed:', out.error.message); process.exit(1) }
console.log('settings/main after purge:', describe(out.fields))
console.log('purged:', copied.join(', '))
