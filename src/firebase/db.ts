import { getFirestore } from 'firebase/firestore'
import { initFirebaseApp } from './config'

const app = initFirebaseApp()
export const db = getFirestore(app)
