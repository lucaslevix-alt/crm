import admin from 'firebase-admin'

let initialized = false

/** Inicializa Admin SDK (Netlify: `FIREBASE_SERVICE_ACCOUNT_JSON`; Firebase Functions: credencial padrão). */
export function ensureFirebaseAdmin(): void {
  if (initialized || admin.apps.length > 0) {
    initialized = true
    return
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  if (raw) {
    const cred = JSON.parse(raw) as admin.ServiceAccount
    admin.initializeApp({ credential: admin.credential.cert(cred) })
  } else {
    admin.initializeApp()
  }
  initialized = true
}

export function getFirestoreDb(): admin.firestore.Firestore {
  ensureFirebaseAdmin()
  return admin.firestore()
}

export { admin }
