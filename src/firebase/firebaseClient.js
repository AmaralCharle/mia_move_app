import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, setLogLevel } from 'firebase/firestore'

let app = null
let db = null
let auth = null

// firebaseConfig can be injected via a global variable (like the original single-file app did)
// If not provided, we fallback to a developer-provided config (from user). Replace/secure this if you prefer env vars.
let firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null
const appId = typeof __app_id !== 'undefined' ? __app_id : 'mia-move-app'

// fallback to explicit config (provided by the user in the workspace). Update if you need a different project.
if (!firebaseConfig) {
  firebaseConfig = {
    apiKey: "AIzaSyDkiLiR8QI7XDLkQ3S4R7psfSiAhL8Ds7U",
    authDomain: "mia-move-dev.firebaseapp.com",
    projectId: "mia-move-dev",
    storageBucket: "mia-move-dev.firebasestorage.app",
    messagingSenderId: "539510852507",
    appId: "1:539510852507:web:0d2293397af8756a2f6f3e",
    measurementId: "G-JRW1F0E3K8"
  }
}

if (firebaseConfig) {
  try {
    setLogLevel && setLogLevel('debug')
  } catch (e) {
    // ignore if not available
  }
  app = initializeApp(firebaseConfig)
  db = getFirestore(app)
  auth = getAuth(app)
}

export { app, db, auth, appId, firebaseConfig }
