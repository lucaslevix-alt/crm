import { useState, useEffect } from 'react'
import { User } from 'lucide-react'
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { initFirebaseApp } from '../../firebase/config'
import { updateUser } from '../../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../../lib/firebaseUserFacingError'
import { useAppStore } from '../../store/useAppStore'

export function ProfileModal() {
  const { closeModal, showToast, currentUser, setCurrentUser } = useAppStore()
  const [nome, setNome] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const hasPasswordAlready = Boolean(currentUser?.hasPassword)

  useEffect(() => {
    if (currentUser) {
      setNome(currentUser.nome)
      setPhotoUrl((currentUser.photoUrl ?? '').trim())
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }, [currentUser])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!currentUser) return
    const n = nome.trim()
    if (!n) {
      showToast('Nome é obrigatório', 'err')
      return
    }
    if (newPassword || confirmPassword) {
      if (newPassword !== confirmPassword) {
        showToast('Nova senha e confirmação não conferem', 'err')
        return
      }
      if (newPassword.length < 6) {
        showToast('A nova senha deve ter no mínimo 6 caracteres', 'err')
        return
      }
      if (hasPasswordAlready && newPassword && !currentPassword.trim()) {
        showToast('Informe a senha atual para alterar', 'err')
        return
      }
    }
    setLoading(true)
    try {
      let nextHasPassword = currentUser.hasPassword ?? false
      if (newPassword) {
        const auth = getAuth(initFirebaseApp())
        if (!auth.currentUser) {
          showToast('Faça login novamente para alterar sua senha', 'err')
          setLoading(false)
          return
        }
        if (hasPasswordAlready) {
          const cred = EmailAuthProvider.credential(currentUser.email, currentPassword)
          await reauthenticateWithCredential(auth.currentUser, cred)
        }
        await updatePassword(auth.currentUser, newPassword)
        nextHasPassword = true
      }
      const pic = photoUrl.trim()
      await updateUser(currentUser.id, {
        nome: n,
        email: currentUser.email,
        cargo: currentUser.cargo,
        hasPassword: nextHasPassword,
        photoUrl: pic
      })
      setCurrentUser({
        ...currentUser,
        nome: n,
        hasPassword: nextHasPassword,
        ...(pic ? { photoUrl: pic } : { photoUrl: undefined })
      })
      showToast('Perfil atualizado')
      closeModal()
    } catch (err) {
      showToast(`Erro: ${formatFirebaseOrUnknownError(err)}`, 'err')
    } finally {
      setLoading(false)
    }
  }

  if (!currentUser) return null

  return (
    <div style={{ padding: 24 }}>
      <div className="mh" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="mt modal-title-ic" style={{ fontSize: 18, fontWeight: 700 }}>
          <User size={22} strokeWidth={1.65} aria-hidden />
          Meu perfil
        </div>
        <button type="button" className="mc" onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text2)' }}>
          ✕
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="fg">
          <label htmlFor="p-nome">Nome completo *</label>
          <input id="p-nome" type="text" value={nome} readOnly disabled style={{ opacity: 0.8, cursor: 'not-allowed' }} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
        </div>
        <div className="fg">
          <label>E-mail</label>
          <input type="text" value={currentUser.email} readOnly disabled style={{ opacity: 0.8, cursor: 'not-allowed' }} />
        </div>
        <div className="fg">
          <label htmlFor="p-foto">URL da foto (opcional)</label>
          <input
            id="p-foto"
            type="url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://..."
          />
          <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, marginBottom: 0 }}>
            Link direto para a imagem, como nos squads.
          </p>
        </div>
        <div style={{ marginTop: 16, marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>Alterar senha</div>
        {hasPasswordAlready && (
          <div className="fg">
            <label htmlFor="p-current-pass">Senha atual</label>
            <input
              id="p-current-pass"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Necessária para alterar a senha"
              autoComplete="current-password"
            />
          </div>
        )}
        <div className="fg">
          <label htmlFor="p-new-pass">{hasPasswordAlready ? 'Nova senha' : 'Definir senha (opcional)'}</label>
          <input
            id="p-new-pass"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mín. 6 caracteres"
            autoComplete="new-password"
          />
        </div>
        <div className="fg">
          <label htmlFor="p-confirm-pass">Confirmar nova senha</label>
          <input
            id="p-confirm-pass"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repita a nova senha"
            autoComplete="new-password"
          />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancelar</button>
          <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 28px' }} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}
