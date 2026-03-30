import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import type { FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { initFirebaseApp } from '../firebase/config'
import { findUserByEmail } from '../firebase/firestore'
import { useAppStore } from '../store/useAppStore'

const MSG_LOGIN_GENERIC =
  'E-mail ou senha incorretos. Tente novamente ou contacte o administrador se precisar de acesso.'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const navigate = useNavigate()
  const { setCurrentUser, showToast, themeMode, setThemeMode, authSessionReady, currentUser } = useAppStore()

  if (!authSessionReady) {
    return (
      <div id="login-screen" className="loading" style={{ minHeight: '100vh', justifyContent: 'center' }}>
        <div className="spin" />
      </div>
    )
  }

  if (currentUser) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = email.trim()
    const pwd = password.trim()
    if (!trimmed || !pwd) {
      setError('Digite seu e-mail corporativo e senha.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const fbApp = initFirebaseApp()
      const auth = getAuth(fbApp)

      await signInWithEmailAndPassword(auth, trimmed, pwd)

      const fbUser = auth.currentUser
      if (!fbUser?.email) {
        await signOut(auth)
        setError(MSG_LOGIN_GENERIC)
        return
      }

      const user = await findUserByEmail({ email: fbUser.email })
      if (!user || !user.hasPassword) {
        await signOut(auth)
        setError(MSG_LOGIN_GENERIC)
        return
      }

      setCurrentUser(user)
      showToast(`Bem-vindo(a), ${user.nome}!`)
      navigate('/dashboard')
    } catch {
      setError(MSG_LOGIN_GENERIC)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div id="login-screen">
      <button
        type="button"
        className="login-theme-btn"
        onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
        title={themeMode === 'dark' ? 'Modo claro' : 'Modo escuro'}
        aria-label={themeMode === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
      >
        {themeMode === 'dark' ? <Sun size={20} strokeWidth={1.75} /> : <Moon size={20} strokeWidth={1.75} />}
      </button>
      <div className="login-box">
        <div className="login-logo">
          <span>PRO</span>
          <span>CRM</span>
        </div>

        <h1 className="login-title">Comercial CRM — Pro Performance</h1>
        <p className="login-subtitle">Faça login com o e-mail corporativo e senha para acessar seu painel.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="fg">
            <label htmlFor="login-email">E-mail</label>
            <input
              id="login-email"
              type="email"
              className="di"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seuemail@empresa.com"
              autoComplete="email"
            />
          </div>
          <div className="fg">
            <label htmlFor="login-password">Senha</label>
            <input
              id="login-password"
              type="password"
              className="di"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Sua senha"
              autoComplete="current-password"
            />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary login-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

