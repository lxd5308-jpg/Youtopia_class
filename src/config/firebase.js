import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

// ── Production database (youtopia-3e141) ──────────────────────
const prodConfig = {
  apiKey:            "AIzaSyDkLndkXCIkjIcu7qmZ150tThhZX66kObo",
  authDomain:        "youtopia-3e141.firebaseapp.com",
  projectId:         "youtopia-3e141",
  storageBucket:     "youtopia-3e141.firebasestorage.app",
  messagingSenderId: "208433872548",
  appId:             "1:208433872548:web:24c4accb6b79bd369db031",
  measurementId:     "G-9F7JQCVJ4M",
}

// ── Development database (youtopia-dev-ea207) ─────────────────
const devConfig = {
  apiKey:            "AIzaSyCSuiC-Zq5PIvjJqGQZxiQCr0Jwa-O1B_E",
  authDomain:        "youtopia-dev-ea207.firebaseapp.com",
  projectId:         "youtopia-dev-ea207",
  storageBucket:     "youtopia-dev-ea207.firebasestorage.app",
  messagingSenderId: "464853062255",
  appId:             "1:464853062255:web:af70b17aba576b7aa5f39a",
  measurementId:     "G-ET22NWY85G",
}

// Automatically uses dev when running locally, prod when deployed
const config = import.meta.env.DEV ? devConfig : prodConfig

const app = initializeApp(config)
export const db   = getFirestore(app)
export const auth = getAuth(app)
