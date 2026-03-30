import { useEffect } from 'react'
import { FirebaseError } from 'firebase/app'
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth'
import { initFirebaseApp } from '../../firebase/config'
import { findUserByEmail } from '../../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../../lib/firebaseUserFacingError'
import { useAppStore } from '../../store/useAppStore'

const CRM_USER_KEY = 'crm_user'

/**
 * Sincroniza o perfil CRM com Firebase Auth. O cargo e o utilizador não podem vir só do localStorage
 * (isso permitia escalar privilégios no cliente sem sessão válida).
 */
export function AuthSync() {
  const setCurrentUser = useAppStore((s) => s.setCurrentUser)
  const setAuthSessionReady = useAppStore((s) => s.setAuthSessionReady)
  const showToast = useAppStore((s) => s.showToast)

  useEffect(() => {
    try {
      window.localStorage.removeItem(CRM_USER_KEY)
    } catch {
      /* ignore */
    }

    const app = initFirebaseApp()
    const auth = getAuth(app)

    return onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (!fbUser?.email) {
          setCurrentUser(null)
          return
        }
        const email = fbUser.email.trim().toLowerCase()
        const crm = await findUserByEmail({ email })
        if (!crm) {
          setCurrentUser(null)
          await signOut(auth)
          return
        }
        setCurrentUser(crm)
      } catch (e) {
        const isFirestorePermission =
          (e instanceof FirebaseError && e.code === 'permission-denied') ||
          (e instanceof Error && e.message.includes('Missing or insufficient permissions'))
        if (isFirestorePermission) {
          showToast(formatFirebaseOrUnknownError(e), 'err')
        }
        setCurrentUser(null)
        try {
          await signOut(auth)
        } catch {
          /* ignore */
        }
      } finally {
        setAuthSessionReady(true)
      }
    })
  }, [setCurrentUser, setAuthSessionReady, showToast])

  return null
}
