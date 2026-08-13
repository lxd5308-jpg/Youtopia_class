#!/usr/bin/env node
/**
 * Off-site backup: dumps every Firestore collection to a timestamped JSON file
 * on this machine.
 *
 * Why this exists: Firestore's own PITR and scheduled backups both live inside
 * the same Google project. They cover accidental deletion and bad writes, but
 * not losing access to the project itself. This gives you a copy that is not
 * Google's to lose.
 *
 * Usage:
 *   node scripts/backup-local.mjs              # writes ./backups/<timestamp>.json
 *   node scripts/backup-local.mjs --out ~/Dropbox/youtopia-backups
 *
 * Auth comes from the Firebase CLI login on this machine (`firebase login`).
 * If it fails with 401, run any firebase command to refresh the token.
 *
 * NOTE: the output contains student names, emails, payment receipt images AND
 * settings/private (the teacher allow-list and the EmailJS service/template/
 * public keys — not the private key, which lives in Secret Manager).
 * Treat it like the database itself — ./backups/ is gitignored; if you move
 * these files somewhere else, keep them somewhere private.
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'

const PROJECT = 'youtopia-3e141'
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

const outIdx = process.argv.indexOf('--out')
const OUT_DIR = resolve(outIdx > -1 ? process.argv[outIdx + 1] : 'backups')

let TOKEN
try {
  TOKEN = JSON.parse(readFileSync(join(homedir(), '.config/configstore/firebase-tools.json'), 'utf8')).tokens.access_token
} catch {
  console.error('Could not read the Firebase CLI credentials. Run `firebase login` first.')
  process.exit(1)
}
const hdr = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }

// Firestore REST value -> plain JS, so the dump is readable rather than
// wrapped in {stringValue: ...} noise.
const decode = (v) => {
  if (v == null) return null
  if ('nullValue' in v) return null
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('timestampValue' in v) return v.timestampValue
  if ('bytesValue' in v) return { __bytes: v.bytesValue }
  if ('referenceValue' in v) return { __ref: v.referenceValue }
  if ('geoPointValue' in v) return { __geo: v.geoPointValue }
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode)
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, decode(x)]))
  return null
}

const api = async (url, init) => {
  const res = await fetch(url, { headers: hdr, ...init })
  const body = await res.json()
  if (body.error) throw new Error(`${body.error.status || res.status}: ${body.error.message}`)
  return body
}

// Every root collection, so a collection added later is picked up automatically.
const { collectionIds = [] } = await api(`${BASE}:listCollectionIds`, { method: 'POST', body: JSON.stringify({ pageSize: 300 }) })
if (!collectionIds.length) { console.error('No collections found — is the project right?'); process.exit(1) }

const dump = { project: PROJECT, takenAt: new Date().toISOString(), collections: {} }
let totalDocs = 0

for (const name of collectionIds.sort()) {
  const docs = {}
  let pageToken
  do {
    const url = new URL(`${BASE}/${encodeURIComponent(name)}`)
    url.searchParams.set('pageSize', '300')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const page = await api(url.toString())
    for (const d of page.documents || []) {
      docs[d.name.split('/').pop()] = {
        ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, decode(v)])),
        __createTime: d.createTime,
        __updateTime: d.updateTime,
      }
    }
    pageToken = page.nextPageToken
  } while (pageToken)

  dump.collections[name] = docs
  const n = Object.keys(docs).length
  totalDocs += n
  console.log(`  ${name.padEnd(18)} ${n} document(s)`)
}

mkdirSync(OUT_DIR, { recursive: true })
const file = join(OUT_DIR, `youtopia-${dump.takenAt.replace(/[:.]/g, '-')}.json`)
const json = JSON.stringify(dump, null, 2)
writeFileSync(file, json)

// A dump that silently wrote nothing is worse than no dump at all.
const check = JSON.parse(readFileSync(file, 'utf8'))
const readBack = Object.values(check.collections).reduce((n, c) => n + Object.keys(c).length, 0)
if (readBack !== totalDocs) {
  console.error(`\nVERIFY FAILED: wrote ${totalDocs} documents but read back ${readBack}`)
  process.exit(1)
}

console.log(`\n${totalDocs} documents across ${collectionIds.length} collections`)
console.log(`${(json.length / 1024).toFixed(0)} KB -> ${file}`)
console.log('verified: re-read from disk and the document count matches')
