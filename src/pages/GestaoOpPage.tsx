import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Factory, Pencil, Trash2 } from 'lucide-react'
import {
  listSquadsOperacao,
  listUsers,
  addSquadOperacao,
  updateSquadOperacao,
  deleteSquadOperacao,
  abaterBonusOperacao,
  type SquadOperacaoRow
} from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import type { CrmUser } from '../store/useAppStore'
import { useAppStore } from '../store/useAppStore'

function canBeSquadMember(u: CrmUser): boolean {
  return u.cargo === 'sdr' || u.cargo === 'closer' || u.cargo === 'admin'
}

function fmt(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function parseMoney(raw: string): number {
  const t = raw.trim().replace(/\s/g, '').replace(/R\$\s?/i, '').replace(/\./g, '').replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

export function GestaoOpPage() {
  const { showToast } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [squads, setSquads] = useState<SquadOperacaoRow[]>([])
  const [users, setUsers] = useState<CrmUser[]>([])
  const [error, setError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [fotoUrl, setFotoUrl] = useState('')
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set())
  const [bonusInicialStr, setBonusInicialStr] = useState('')
  const [bonusSaldoStr, setBonusSaldoStr] = useState('')
  const [saving, setSaving] = useState(false)

  const [abaterById, setAbaterById] = useState<Record<string, string>>({})
  const [abaterBusy, setAbaterBusy] = useState<string | null>(null)

  const eligibleUsers = useMemo(() => users.filter(canBeSquadMember).sort((a, b) => a.nome.localeCompare(b.nome)), [users])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, u] = await Promise.all([listSquadsOperacao(), listUsers()])
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
    setBonusInicialStr('')
    setBonusSaldoStr('')
  }

  function startEdit(s: SquadOperacaoRow) {
    setEditingId(s.id)
    setNome(s.nome)
    setFotoUrl(s.fotoUrl)
    setMemberIds(new Set(s.memberIds))
    setBonusInicialStr(String(s.bonusInicial))
    setBonusSaldoStr(String(s.bonusSaldo))
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
    const bi = parseMoney(bonusInicialStr)
    if (!editingId && bi <= 0) {
      showToast('Informe o valor inicial do bônus (maior que zero).', 'err')
      return
    }
    const ids = [...memberIds]
    setSaving(true)
    try {
      if (editingId) {
        const bs = parseMoney(bonusSaldoStr)
        await updateSquadOperacao(editingId, {
          nome: n,
          fotoUrl,
          memberIds: ids,
          bonusInicial: bi,
          bonusSaldo: bs
        })
        showToast('Squad operacional atualizado.')
      } else {
        await addSquadOperacao({ nome: n, fotoUrl, memberIds: ids, bonusInicial: bi })
        showToast('Squad operacional criado.')
      }
      resetForm()
      await load()
    } catch (err) {
      showToast(formatFirebaseOrUnknownError(err) || 'Erro ao salvar', 'err')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(s: SquadOperacaoRow) {
    if (!window.confirm(`Remover o squad operacional "${s.nome}"?`)) return
    try {
      await deleteSquadOperacao(s.id)
      if (editingId === s.id) resetForm()
      showToast('Squad operacional removido.')
      await load()
    } catch (err) {
      showToast(formatFirebaseOrUnknownError(err) || 'Erro ao remover', 'err')
    }
  }

  async function handleAbater(s: SquadOperacaoRow) {
    const raw = (abaterById[s.id] ?? '').trim()
    const val = parseMoney(raw)
    if (val <= 0) {
      showToast('Informe um valor positivo para abater.', 'err')
      return
    }
    setAbaterBusy(s.id)
    try {
      await abaterBonusOperacao(s.id, val)
      setAbaterById((prev) => ({ ...prev, [s.id]: '' }))
      showToast(`Abatido ${fmt(val)} do bônus de "${s.nome}".`)
      await load()
    } catch (err) {
      showToast(formatFirebaseOrUnknownError(err) || 'Erro ao abater', 'err')
    } finally {
      setAbaterBusy(null)
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
          <Factory size={24} strokeWidth={1.65} aria-hidden />
          Gestão OP
        </h2>
        <p style={{ color: 'var(--text2)' }}>
          Cadastre squads operacionais (nome, foto, membros) e o bônus inicial. Use o saldo para acompanhar o que ainda resta e
          abata valores quando as regras internas exigirem. Estes squads são independentes dos squads comerciais.
        </p>
      </div>

      <div className="card mb" style={{ marginBottom: 18 }}>
        <div className="card-header">
          <span className="card-title">{editingId ? 'Editar squad operacional' : 'Novo squad operacional'}</span>
          {editingId && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetForm}>
              Cancelar edição
            </button>
          )}
        </div>
        <div style={{ padding: '0 4px 8px' }}>
          <div className="fg">
            <label>Nome do squad</label>
            <input className="di" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Squad Logística" />
          </div>
          <div className="fg">
            <label>URL da foto (opcional)</label>
            <input className="di" value={fotoUrl} onChange={(e) => setFotoUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="fg">
            <label>{editingId ? 'Bônus inicial (referência)' : 'Bônus inicial'}</label>
            <input
              className="di"
              inputMode="decimal"
              value={bonusInicialStr}
              onChange={(e) => setBonusInicialStr(e.target.value)}
              placeholder="Ex.: 5000"
            />
            <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
              Valor com que o squad entra na disputa; o % mantido e o perdido usam este montante como base.
            </p>
          </div>
          {editingId && (
            <div className="fg">
              <label>Saldo atual do bônus</label>
              <input
                className="di"
                inputMode="decimal"
                value={bonusSaldoStr}
                onChange={(e) => setBonusSaldoStr(e.target.value)}
                placeholder="Saldo após abatimentos"
              />
            </div>
          )}
          <div className="fg">
            <label>Membros</label>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
              Os mesmos perfis que nos squads comerciais (SDR, Closer ou Admin). Cada pessoa pode estar em apenas um squad
              operacional.
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
            {saving ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Criar squad operacional'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Squads operacionais</span>
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
            <p>Nenhum squad operacional ainda. Crie o primeiro acima.</p>
          </div>
        )}
        {!loading &&
          !error &&
          squads.map((s) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
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
                  Inicial: {fmt(s.bonusInicial)} · Saldo: {fmt(s.bonusSaldo)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
                  {s.memberIds.length
                    ? s.memberIds.map((id) => memberLabel(id)).join(' · ')
                    : 'Sem membros.'}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 10
                  }}
                >
                  <input
                    className="di"
                    style={{ maxWidth: 140, margin: 0 }}
                    inputMode="decimal"
                    placeholder="Abater R$"
                    value={abaterById[s.id] ?? ''}
                    onChange={(e) => setAbaterById((prev) => ({ ...prev, [s.id]: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleAbater(s)}
                    disabled={abaterBusy === s.id}
                  >
                    {abaterBusy === s.id ? 'Aplicando…' : 'Abater do bônus'}
                  </button>
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
