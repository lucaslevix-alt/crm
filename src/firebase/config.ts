import { initializeApp, type FirebaseOptions, getApps } from 'firebase/app'
import type { FirebaseConfig } from '../store/useAppStore'

const FB_CFG_KEY = 'fb_cfg'

function loadConfigFromLocalStorage(): FirebaseConfig | null {
  try {
    const raw = window.localStorage.getItem(FB_CFG_KEY)
    if (!raw) return null
    return JSON.parse(raw) as FirebaseConfig
  } catch {
    return null
  }
}

function buildConfig(): FirebaseOptions {
  if (typeof window !== 'undefined') {
    const stored = loadConfigFromLocalStorage()
    if (stored && stored.apiKey && stored.projectId) {
      return stored
    }
  }

  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined

  const missing: string[] = []
  if (!apiKey?.trim()) missing.push('VITE_FIREBASE_API_KEY')
  if (!authDomain?.trim()) missing.push('VITE_FIREBASE_AUTH_DOMAIN')
  if (!projectId?.trim()) missing.push('VITE_FIREBASE_PROJECT_ID')

  if (missing.length > 0) {
    throw new Error(
      `Configuração Firebase ausente no .env: ${missing.join(', ')}. Reinicie o servidor (yarn dev) após alterar.`
    )
  }

  const options: FirebaseOptions = {
    apiKey,
    authDomain,
    projectId
  }
  return options
}

export function initFirebaseApp() {
  const apps = getApps()
  if (apps.length) return apps[0]
  return initializeApp(buildConfig())
}

