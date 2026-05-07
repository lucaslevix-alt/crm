import { getFunctions, httpsCallable } from 'firebase/functions'
import { initFirebaseApp } from './config'

export function getCallable<TReq extends object, TRes>(name: string) {
  const fn = httpsCallable<TReq, TRes>(getFunctions(initFirebaseApp(), 'us-central1'), name)
  return fn
}

