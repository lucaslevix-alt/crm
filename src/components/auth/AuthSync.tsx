import { useEffect } from 'react'
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth'
import { initFirebaseApp } from '../../firebase/config'
import { findUserByEmail } from '../../firebase/firestore'
import { useAppStore } from '../../store/useAppStore'
import type { CrmUser } from '../../store/useAppStore'

const CRM_USER_KEY = 'crm_user'

function parseStoredCrmUser(): CrmUser | null {
  try {
    const raw = window.localStorage.getItem(CRM_USER_KEY)
    if (!raw) return null
    const u = JSON.parse(raw) as CrmUser
    if (u && typeof u.id === 'string' && typeof u.email === 'string' && typeof u.nome === 'string') {
      return u
    }
    return null
  } catch {
    return null
  }
}

/**
 * Mantém sessão alinhada com Firebase Auth e perfil em `usuarios`.
 * Persistência em localStorage (crm_user) para voltar ao painel sem atrito; se o Firestore falhar
 * temporariamente mas o Auth ainda for válido, reutiliza o perfil guardado (mesmo e-mail).
 */
export function AuthSync() {
  const setCurrentUser = useAppStore((s) => s.setCurrentUser)
  const setAuthSessionReady = useAppStore((s) => s.setAuthSessionReady)

  useEffect(() => {
    const app = initFirebaseApp()
    const auth = getAuth(app)

    return onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (!fbUser?.email) {
          setCurrentUser(null)
          return
        }
        const email = fbUser.email.trim().toLowerCase()
        try {
          const crm = await findUserByEmail({ email })
          if (!crm) {
            setCurrentUser(null)
            await signOut(auth)
            return
          }
          setCurrentUser(crm)
        } catch {
          const saved = parseStoredCrmUser()
          if (saved && saved.email.trim().toLowerCase() === email) {
            setCurrentUser(saved)
          } else {
            setCurrentUser(null)
            try {
              await signOut(auth)
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
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
  }, [setCurrentUser, setAuthSessionReady])

  return null
}
