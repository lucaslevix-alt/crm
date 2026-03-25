import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Trash2, Users } from 'lucide-react'
import { listUsers, deleteUser, updateUser } from '../firebase/firestore'
import type { CrmUser } from '../store/useAppStore'
import { useAppStore } from '../store/useAppStore'

const CARGO_BADGE: Record<string, string> = {
  sdr: 'b-sdr',
  closer: 'b-closer',
  admin: 'b-admin'
}

interface SignupUserWithRestParams {
  email: string
  password: string
}

async function signupUserWithRest(params: SignupUserWithRestParams): Promise<void> {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined
  if (!apiKey?.trim()) throw new Error('VITE_FIREBASE_API_KEY ausente para migration')

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: params.email,
        password: params.password,
        returnSecureToken: false
      })
    }
  )

  if (!response.ok) {
    try {
      const data = (await response.json()) as { error?: { message?: string } }
      const code = data.error?.message ?? `HTTP_${response.status}`
      throw new Error(code)
    } catch (err) {
      if (err instanceof Error) throw err
      throw new Error(`HTTP_${response.status}`)
    }
  }
}

export function UsuariosPage() {
  const { openModal, showToast, currentUser } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<CrmUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationSummary, setMigrationSummary] = useState<string | null>(null)

  const { usersVersion } = useAppStore()

  const canRunMigration = currentUser?.cargo === 'admin'

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await listUsers()
      setUsers(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers, usersVersion])

  function handleNewUser() {
    useAppStore.getState().setEditingUser(null)
    openModal('modal-usuario')
  }

  function handleEdit(u: CrmUser) {
    useAppStore.getState().setEditingUser(u)
    openModal('modal-usuario')
  }

  async function handleDelete(u: CrmUser) {
    if (!window.confirm(`Remover ${u.nome}?`)) return
    try {
      await deleteUser(u.id)
      showToast(`${u.nome} removido`)
      loadUsers()
    } catch (err) {
      showToast(`Erro: ${err instanceof Error ? err.message : 'Erro'}`, 'err')
    }
  }

  async function handleAuthMigration() {
    if (!canRunMigration) return
    if (!window.confirm('Isso irá criar/atualizar contas no Auth para todos os usuários com senha padrão "lvxdigital". Deseja continuar?')) return

    setIsMigrating(true)
    setMigrationSummary(null)

    try {
      const list = await listUsers()
      let createdOrUpdated = 0
      let alreadyExisted = 0
      let failed = 0

      for (const u of list) {
        const email = (u.email ?? '').trim().toLowerCase()
        if (!email) {
          alreadyExisted++
          continue
        }

        try {
          await signupUserWithRest({ email, password: 'lvxdigital' })
          await updateUser(u.id, {
            nome: u.nome,
            email,
            cargo: u.cargo,
            hasPassword: true
          })
          createdOrUpdated++
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)

          if (message.includes('EMAIL_EXISTS')) {
            await updateUser(u.id, {
              nome: u.nome,
              email,
              cargo: u.cargo,
              hasPassword: true
            })
            alreadyExisted++
          } else {
            failed++
          }
        }
      }

      setMigrationSummary(
        `Concluído. Criados/atualizados: ${createdOrUpdated}, já existiam: ${alreadyExisted}, falharam: ${failed}.`
      )
      showToast('Migration de usuários para Auth concluída.')
      loadUsers()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao executar migration'
      setMigrationSummary(`Erro geral: ${message}`)
      showToast('Erro ao executar migration de usuários.', 'err')
    } finally {
      setIsMigrating(false)
    }
  }

  return (
    <div className="content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <Link to="/config" className="config-sub-back">
            ← Configurações
          </Link>
          <h2 className="page-title-row" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, marginTop: 10 }}>
            <Users size={24} strokeWidth={1.65} aria-hidden />
            Usuários
          </h2>
          <p style={{ color: 'var(--text2)' }}>Equipe comercial</p>
          {canRunMigration && (
            <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>
              Botão temporário para migração de usuários para Auth (senha padrão &quot;lvxdigital&quot;).
            </p>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          {canRunMigration && (
            <button
              type="button"
              className="btn btn-danger"
              style={{ width: 'auto', padding: '8px 16px', fontSize: 12 }}
              onClick={handleAuthMigration}
              disabled={isMigrating}
            >
              {isMigrating ? 'Migrando usuários...' : 'Migrar usuários para Auth'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: 'auto', padding: '10px 20px' }}
            onClick={handleNewUser}
          >
            + Novo Usuário
          </button>
        </div>
      </div>
      <div className="card">
        {loading && (
          <div className="loading">
            <div className="spin" /> Carregando...
          </div>
        )}
        {error && (
          <div className="empty">
            <p>{error}</p>
          </div>
        )}
        {!loading && !error && !users.length && (
          <div className="empty">
            <div className="empty-icon" aria-hidden>
              <Users size={40} strokeWidth={1.4} />
            </div>
            <p>Nenhum usuário</p>
          </div>
        )}
        {migrationSummary && (
          <div className="empty" style={{ marginTop: 12 }}>
            <p style={{ fontSize: 12, color: 'var(--text2)' }}>{migrationSummary}</p>
          </div>
        )}
        {!loading && !error && users.length > 0 && (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Cargo</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.nome}</strong></td>
                    <td style={{ color: 'var(--text2)' }}>{u.email || '—'}</td>
                    <td>
                      <span className={`badge ${CARGO_BADGE[u.cargo] ?? 'b-sdr'}`}>{(u.cargo || '').toUpperCase()}</span>
                    </td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        onClick={() => handleEdit(u)}
                      >
                        <Pencil size={14} strokeWidth={1.65} aria-hidden />
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        title="Excluir"
                        aria-label="Excluir"
                        onClick={() => handleDelete(u)}
                      >
                        <Trash2 size={14} strokeWidth={1.65} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
