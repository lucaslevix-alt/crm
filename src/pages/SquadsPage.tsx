import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Trash2, UsersRound } from 'lucide-react'
import { listSquads, listUsers, addSquad, updateSquad, deleteSquad, type SquadRow } from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import type { CrmUser } from '../store/useAppStore'
import { useAppStore } from '../store/useAppStore'

function canBeSquadMember(u: CrmUser): boolean {
  return u.cargo === 'sdr' || u.cargo === 'closer' || u.cargo === 'admin'
}

export function SquadsPage() {
  const { showToast } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [squads, setSquads] = useState<SquadRow[]>([])
  const [users, setUsers] = useState<CrmUser[]>([])
  const [error, setError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [fotoUrl, setFotoUrl] = useState('')
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const eligibleUsers = useMemo(() => users.filter(canBeSquadMember).sort((a, b) => a.nome.localeCompare(b.nome)), [users])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, u] = await Promise.all([listSquads(), listUsers()])
      setSquads(s)
      setUsers(u)
    } catch (err) {
      setError(formatFirebaseOrUnknownError(err) || 'Erro ao carregar')
      setSquads([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function resetForm() {
    setEditingId(null)
    setNome('')
    setFotoUrl('')
    setMemberIds(new Set())
  }

  function startEdit(s: SquadRow) {
    setEditingId(s.id)
    setNome(s.nome)
    setFotoUrl(s.fotoUrl)
    setMemberIds(new Set(s.memberIds))
  }

  function toggleMember(id: string) {
    setMemberIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSave() {
    const n = nome.trim()
    if (!n) {
      showToast('Informe o nome do squad.', 'err')
      return
    }
    const ids = [...memberIds]
    setSaving(true)
    try {
      if (editingId) {
        await updateSquad(editingId, { nome: n, fotoUrl, memberIds: ids })
        showToast('Squad atualizado.')
      } else {
        await addSquad({ nome: n, fotoUrl, memberIds: ids })
        showToast('Squad criado.')
      }
      resetForm()
      await load()
    } catch (err) {
      showToast(formatFirebaseOrUnknownError(err) || 'Erro ao salvar', 'err')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(s: SquadRow) {
    if (!window.confirm(`Remover o squad "${s.nome}"?`)) return
    try {
      await deleteSquad(s.id)
      if (editingId === s.id) resetForm()
      showToast('Squad removido.')
      await load()
    } catch (err) {
      showToast(formatFirebaseOrUnknownError(err) || 'Erro ao remover', 'err')
    }
  }

  function memberLabel(uid: string): string {
    const u = users.find((x) => x.id === uid)
    return u ? `${u.nome} (${String(u.cargo).toUpperCase()})` : uid
  }

  return (
    <div className="content">
      <div style={{ marginBottom: 20 }}>
        <Link to="/config" className="config-sub-back">
          ← Configurações
        </Link>
        <h2 className="page-title-row" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, marginTop: 10 }}>
          <UsersRound size={24} strokeWidth={1.65} aria-hidden />
          Squads
        </h2>
        <p style={{ color: 'var(--text2)' }}>
          Configure nome, foto e membros (SDR, Closer ou Admin). As vendas lançadas pelo closer entram no faturamento do squad
          dele. Cada pessoa pode estar em apenas um squad.
        </p>
      </div>

      <div className="card mb" style={{ marginBottom: 18 }}>
        <div className="card-header">
          <span className="card-title">{editingId ? 'Editar squad' : 'Novo squad'}</span>
          {editingId && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetForm}>
              Cancelar edição
            </button>
          )}
        </div>
        <div style={{ padding: '0 4px 8px' }}>
          <div className="fg">
            <label>Nome do squad</label>
            <input className="di" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Squad Alpha" />
          </div>
          <div className="fg">
            <label>URL da foto (opcional)</label>
            <input
              className="di"
              value={fotoUrl}
              onChange={(e) => setFotoUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="fg">
            <label>Membros</label>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
              Marque SDRs e Closers que compõem este squad. Vendas registradas por um closer somam ao faturamento deste squad.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 8,
                maxHeight: 280,
                overflowY: 'auto',
                padding: 4,
                border: '1px solid var(--border2)',
                borderRadius: 10,
                background: 'var(--bg3)'
              }}
            >
              {eligibleUsers.length === 0 && <span style={{ color: 'var(--text3)', fontSize: 13 }}>Nenhum usuário SDR/Closer.</span>}
              {eligibleUsers.map((u) => (
                <label
                  key={u.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13,
                    cursor: 'pointer',
                    padding: '6px 8px',
                    borderRadius: 8
                  }}
                >
                  <input type="checkbox" checked={memberIds.has(u.id)} onChange={() => toggleMember(u.id)} />
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.nome}{' '}
                    <span style={{ color: 'var(--text3)', fontSize: 11 }}>({u.cargo})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <button type="button" className="btn btn-primary" style={{ width: 'auto', marginTop: 8 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Criar squad'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Squads cadastrados</span>
        </div>
        {loading && (
          <div className="loading" style={{ padding: 24 }}>
            <div className="spin" /> Carregando...
          </div>
        )}
        {error && (
          <div className="empty">
            <p>{error}</p>
          </div>
        )}
        {!loading && !error && squads.length === 0 && (
          <div className="empty">
            <p>Nenhum squad ainda. Crie o primeiro acima.</p>
          </div>
        )}
        {!loading &&
          !error &&
          squads.map((s) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 18px',
                borderBottom: '1px solid var(--border2)',
                flexWrap: 'wrap'
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: s.fotoUrl ? `url(${s.fotoUrl}) center/cover` : 'var(--bg3)',
                  border: '1px solid var(--border2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  color: 'var(--text2)',
                  flexShrink: 0
                }}
              >
                {!s.fotoUrl && (s.nome || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700 }}>{s.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                  {s.memberIds.length
                    ? s.memberIds.map((id) => memberLabel(id)).join(' · ')
                    : 'Sem membros — nenhuma venda será atribuída a este squad.'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(s)} title="Editar">
                  <Pencil size={16} strokeWidth={1.65} />
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDelete(s)} title="Remover">
                  <Trash2 size={16} strokeWidth={1.65} style={{ color: 'var(--red)' }} />
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
