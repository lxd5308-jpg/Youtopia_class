import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyDkLndkXCIkjIcu7qmZ150tThhZX66kObo",
  authDomain: "youtopia-3e141.firebaseapp.com",
  projectId: "youtopia-3e141",
  storageBucket: "youtopia-3e141.firebasestorage.app",
  messagingSenderId: "208433872548",
  appId: "1:208433872548:web:24c4accb6b79bd369db031",
  measurementId: "G-9F7JQCVJ4M"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
