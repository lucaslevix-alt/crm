import { useState, useEffect } from 'react'
import { Pencil, User } from 'lucide-react'
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { initFirebaseApp } from '../../firebase/config'
import { addUser, updateUser } from '../../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../../lib/firebaseUserFacingError'
import { useAppStore } from '../../store/useAppStore'

export function UserFormModal() {
  const { closeModal, showToast, editingUser, setEditingUser, currentUser } = useAppStore()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [cargo, setCargo] = useState<string>('sdr')
  const [password, setPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const isEdit = editingUser != null
  const isEditingSelf = isEdit && currentUser != null && currentUser.id === editingUser?.id
  const isAdmin = currentUser?.cargo === 'admin'
  const canEditPassword = isEdit && (isAdmin || isEditingSelf)
  const hasPasswordAlready = Boolean(editingUser?.hasPassword)
  const requireCurrentPassword = isEditingSelf && hasPasswordAlready

  useEffect(() => {
    if (editingUser) {
      setNome(editingUser.nome)
      setEmail(editingUser.email)
      setCargo(editingUser.cargo)
      setPassword('')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } else {
      setNome('')
      setEmail('')
      setCargo('sdr')
      setPassword('')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }, [editingUser])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const n = nome.trim()
    if (!n || !cargo) {
      showToast('Preencha nome e cargo', 'err')
      return
    }
    if (!isEdit && !email.trim()) {
      showToast('E-mail obrigatório', 'err')
      return
    }
    if (!isEdit && !password.trim()) {
      showToast('Senha obrigatória para novos usuários', 'err')
      return
    }
    if (canEditPassword && (newPassword || confirmPassword)) {
      if (newPassword !== confirmPassword) {
        showToast('Nova senha e confirmação não conferem', 'err')
        return
      }
      if (newPassword.length > 0 && newPassword.length < 6) {
        showToast('A nova senha deve ter no mínimo 6 caracteres', 'err')
        return
      }
      if (requireCurrentPassword && newPassword && !currentPassword.trim()) {
        showToast('Informe a senha atual para alterar', 'err')
        return
      }
    }
    setLoading(true)
    try {
      if (isEdit && editingUser) {
        let nextHasPassword = editingUser.hasPassword ?? false
        if (canEditPassword && newPassword) {
          if (isEditingSelf && currentUser) {
            const auth = getAuth(initFirebaseApp())
            if (!auth.currentUser) {
              showToast('Faça login novamente para alterar sua senha', 'err')
              setLoading(false)
              return
            }
            if (requireCurrentPassword) {
              const cred = EmailAuthProvider.credential(currentUser.email, currentPassword)
              await reauthenticateWithCredential(auth.currentUser, cred)
            }
            await updatePassword(auth.currentUser, newPassword)
            nextHasPassword = true
          } else if (isAdmin) {
            nextHasPassword = true
          }
        }
        await updateUser(editingUser.id, {
          nome: n,
          email: email.trim().toLowerCase(),
          cargo,
          hasPassword: nextHasPassword
        })
        showToast(`${n} atualizado`)
        if (canEditPassword && newPassword && isAdmin && !isEditingSelf) {
          showToast('Usuário marcado com senha. Para aplicar no login use o Console do Firebase (Authentication) ou uma Cloud Function.')
        }
      } else {
        await addUser({ nome: n, email: email.trim().toLowerCase(), cargo, hasPassword: true })
        showToast(`${n} cadastrado`)
      }
      setEditingUser(null)
      closeModal()
      useAppStore.getState().incrementUsersVersion()
    } catch (err) {
      showToast(`Erro: ${formatFirebaseOrUnknownError(err)}`, 'err')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setEditingUser(null)
    closeModal()
  }

  return (
    <div style={{ padding: 24 }}>
      <div className="mh" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="mt modal-title-ic" style={{ fontSize: 18, fontWeight: 700 }}>
          {isEdit ? <Pencil size={22} strokeWidth={1.65} aria-hidden /> : <User size={22} strokeWidth={1.65} aria-hidden />}
          {isEdit ? 'Editar Usuário' : 'Novo Usuário'}
        </div>
        <button type="button" className="mc" onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text2)' }}>
          ✕
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="fg">
          <label htmlFor="u-nome">Nome completo *</label>
          <input id="u-nome" type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: João Silva" />
        </div>
        <div className="fg">
          <label htmlFor="u-email">E-mail</label>
          <input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="joao@empresa.com" />
        </div>
        {!isEdit && (
          <div className="fg">
            <label htmlFor="u-pass">Senha inicial *</label>
            <input
              id="u-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Defina a senha deste usuário"
            />
          </div>
        )}
        {canEditPassword && (
          <>
            {requireCurrentPassword && (
              <div className="fg">
                <label htmlFor="u-current-pass">Senha atual *</label>
                <input
                  id="u-current-pass"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Necessária para alterar a senha"
                  autoComplete="current-password"
                />
              </div>
            )}
            <div className="fg">
              <label htmlFor="u-new-pass">
                {isEditingSelf ? (hasPasswordAlready ? 'Nova senha' : 'Definir senha (opcional)') : 'Nova senha (opcional)'}
              </label>
              <input
                id="u-new-pass"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mín. 6 caracteres"
                autoComplete="new-password"
              />
            </div>
            <div className="fg">
              <label htmlFor="u-confirm-pass">Confirmar nova senha</label>
              <input
                id="u-confirm-pass"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                autoComplete="new-password"
              />
            </div>
          </>
        )}
        <div className="fg">
          <label htmlFor="u-cargo">Cargo *</label>
          <select id="u-cargo" value={cargo} onChange={(e) => setCargo(e.target.value)}>
            <option value="sdr">SDR</option>
            <option value="closer">Closer</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" className="btn btn-ghost" onClick={handleClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 28px' }} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}
