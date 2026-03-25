import { useEffect, useState } from 'react'
import { ClipboardList, Pencil, Trash2 } from 'lucide-react'
import {
  getRegistrosByRange,
  listUsers,
  deleteRegistro,
  labelFormaPagamento,
  type RegistroRow
} from '../firebase/firestore'
import type { CrmUser } from '../store/useAppStore'
import { useAppStore } from '../store/useAppStore'

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function mRange(): { start: string; end: string } {
  const n = new Date()
  const y = n.getFullYear()
  const m = n.getMonth() + 1
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const end = new Date(y, m, 0).toISOString().split('T')[0]
  return { start, end }
}

type RegPeriod = '7d' | '14d' | 'mes' | 'todos' | 'custom'

function getRegRange(period: RegPeriod, customDate?: string): { start: string; end: string } {
  const td = today()
  if (period === '7d') {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return { start: d.toISOString().split('T')[0], end: td }
  }
  if (period === '14d') {
    const d = new Date()
    d.setDate(d.getDate() - 13)
    return { start: d.toISOString().split('T')[0], end: td }
  }
  if (period === 'mes') return mRange()
  if (period === 'custom' && customDate) return { start: customDate, end: customDate }
  return { start: '2020-01-01', end: '2099-12-31' }
}

function fmt(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function fdt(s: string): string {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

const TIPO_LABEL: Record<string, string> = {
  reuniao_agendada: 'Agendada',
  reuniao_realizada: 'Realizada',
  reuniao_closer: 'Closer',
  venda: 'Venda'
}

const TIPO_BADGE: Record<string, string> = {
  reuniao_agendada: 'b-sdr',
  reuniao_realizada: 'b-green',
  reuniao_closer: 'b-closer',
  venda: 'b-amber'
}

export function RegistrosPage() {
  const { registrosVersion, openModal, setEditingRegistro, showToast, incrementRegistrosVersion } = useAppStore()
  const [regPeriod, setRegPeriod] = useState<RegPeriod>('14d')
  const [customDate, setCustomDate] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fUser, setFUser] = useState('')
  const [busca, setBusca] = useState('')
  const [users, setUsers] = useState<CrmUser[]>([])
  const [recs, setRecs] = useState<RegistroRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { start, end } = getRegRange(regPeriod, customDate)
      const [rows, userList] = await Promise.all([
        getRegistrosByRange(start, end),
        listUsers()
      ])
      setRecs(rows)
      setUsers(userList)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [regPeriod, customDate, registrosVersion])

  const filtered = recs.filter((r) => {
    if (fTipo && r.tipo !== fTipo) return false
    if (fUser && r.userId !== fUser) return false
    const q = busca.trim().toLowerCase()
    if (q) {
      const match =
        (r.anuncio ?? '').toLowerCase().includes(q) ||
        (r.userName ?? '').toLowerCase().includes(q) ||
        (r.obs ?? '').toLowerCase().includes(q) ||
        (r.nomeCliente ?? '').toLowerCase().includes(q) ||
        labelFormaPagamento(r.formaPagamento).toLowerCase().includes(q)
      if (!match) return false
    }
    return true
  })

  function handleEdit(rec: RegistroRow) {
    setEditingRegistro({
      id: rec.id,
      data: rec.data,
      tipo: rec.tipo,
      userId: rec.userId,
      userName: rec.userName,
      userCargo: rec.userCargo,
      anuncio: rec.anuncio,
      valor: rec.valor,
      cashCollected: rec.cashCollected,
      obs: rec.obs,
      formaPagamento: rec.formaPagamento ?? null,
      produtosIds: rec.produtosIds ?? [],
      produtosDetalhes: rec.produtosDetalhes ?? [],
      valorReferenciaVenda: rec.valorReferenciaVenda,
      descontoCloser: rec.descontoCloser,
      nomeCliente: rec.nomeCliente ?? null
    })
    openModal('modal-edit-reg')
  }

  async function handleDelete(rec: RegistroRow) {
    if (!window.confirm('Deletar este registro?')) return
    try {
      await deleteRegistro(rec.id)
      showToast('Deletado')
      incrementRegistrosVersion()
    } catch (e) {
      showToast('Erro: ' + (e instanceof Error ? e.message : String(e)), 'err')
    }
  }

  return (
    <div className="content">
      <div className="ctrl-row" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <span className="ctrl-label">Período:</span>
        <button
          type="button"
          className={`prd-btn ${regPeriod === '7d' ? 'active' : ''}`}
          onClick={() => setRegPeriod('7d')}
        >
          7 dias
        </button>
        <button
          type="button"
          className={`prd-btn ${regPeriod === '14d' ? 'active' : ''}`}
          onClick={() => setRegPeriod('14d')}
        >
          14 dias
        </button>
        <button
          type="button"
          className={`prd-btn ${regPeriod === 'mes' ? 'active' : ''}`}
          onClick={() => setRegPeriod('mes')}
        >
          Mês
        </button>
        <button
          type="button"
          className={`prd-btn ${regPeriod === 'todos' ? 'active' : ''}`}
          onClick={() => setRegPeriod('todos')}
        >
          Todos
        </button>
        <input
          type="date"
          className="di"
          style={{ width: 140 }}
          value={customDate}
          onChange={(e) => {
            setCustomDate(e.target.value)
            if (e.target.value) setRegPeriod('custom')
          }}
          title="Data específica"
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div className="fg" style={{ margin: 0 }}>
            <label>Tipo</label>
            <select className="di" value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
              <option value="">Todos</option>
              <option value="reuniao_agendada">Reunião Agendada</option>
              <option value="reuniao_realizada">Reunião Realizada</option>
              <option value="reuniao_closer">Reunião Closer</option>
              <option value="venda">Venda</option>
            </select>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div className="fg" style={{ margin: 0 }}>
            <label>Profissional</label>
            <select className="di" value={fUser} onChange={(e) => setFUser(e.target.value)}>
              <option value="">Todos</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome} ({(u.cargo || '').toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="fg" style={{ margin: 0 }}>
            <label>Busca rápida</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="di"
                style={{ width: '100%', paddingRight: 28 }}
                placeholder="Campanha, profissional, obs..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              {busca && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => setBusca('')}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    cursor: 'pointer',
                    color: 'var(--text3)',
                    fontSize: 14
                  }}
                >
                  ✕
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        {loading && (
          <div className="loading">
            <div className="spin" />
            Carregando...
          </div>
        )}
        {error && (
          <div style={{ color: 'var(--red)', padding: 16 }}>Erro: {error}</div>
        )}
        {!loading && !error && (
          <div className="tw">
            {filtered.length === 0 ? (
              <div className="empty">
                <div className="empty-icon" aria-hidden>
                  <ClipboardList size={40} strokeWidth={1.4} />
                </div>
                <p>{busca || fTipo || fUser ? 'Nenhum registro encontrado para os filtros.' : 'Nenhum registro encontrado.'}</p>
              </div>
            ) : (
              <>
                {busca && (
                  <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--text3)' }}>
                    {filtered.length} de {recs.length} registros
                  </div>
                )}
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Profissional</th>
                      <th>Anúncio</th>
                      <th>Cliente</th>
                      <th>Valor</th>
                      <th>Pagamento</th>
                      <th>Obs</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id}>
                        <td className="mono" style={{ fontSize: 12 }}>
                          {fdt(r.data)}
                        </td>
                        <td>
                          <span className={`badge ${TIPO_BADGE[r.tipo] || 'b-sdr'}`}>
                            {TIPO_LABEL[r.tipo] || r.tipo}
                          </span>
                        </td>
                        <td>
                          <strong>{r.userName}</strong>
                          <br />
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                            {(r.userCargo || '').toUpperCase()}
                          </span>
                        </td>
                        <td>
                          {r.anuncio ? (
                            <span className="chip" title={r.anuncio}>
                              {r.anuncio}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text3)' }}>—</span>
                          )}
                        </td>
                        <td style={{ fontSize: 13, maxWidth: 140 }}>
                          {r.tipo === 'venda' && r.nomeCliente ? (
                            <span title={r.nomeCliente}>{r.nomeCliente}</span>
                          ) : (
                            <span style={{ color: 'var(--text3)' }}>—</span>
                          )}
                        </td>
                        <td>{r.tipo === 'venda' ? fmt(r.valor) : '—'}</td>
                        <td style={{ fontSize: 12 }}>
                          {r.tipo === 'venda' ? labelFormaPagamento(r.formaPagamento) : '—'}
                        </td>
                        <td
                          style={{
                            color: 'var(--text2)',
                            fontSize: 12,
                            maxWidth: 120,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {r.obs || '—'}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleEdit(r)}
                            title="Editar"
                            aria-label="Editar"
                          >
                            <Pencil size={16} strokeWidth={1.65} />
                          </button>{' '}
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(r)}
                            title="Excluir"
                            aria-label="Excluir"
                          >
                            <Trash2 size={16} strokeWidth={1.65} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
