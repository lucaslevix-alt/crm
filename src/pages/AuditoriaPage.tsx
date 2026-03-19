import { useCallback, useEffect, useState } from 'react'
import { getAuditoriaLogs, listUsers, type AuditLogRow } from '../firebase/firestore'
import type { CrmUser } from '../store/useAppStore'

const ACAO_LABEL: Record<string, string> = {
  criar: '✅ Criou',
  editar: '✏️ Editou',
  deletar: '🗑 Deletou'
}
const ACAO_CLS: Record<string, string> = {
  criar: 'b-green',
  editar: 'b-sdr',
  deletar: 'b-danger'
}
const TIPO_LABEL: Record<string, string> = {
  reuniao_agendada: 'Agendada',
  reuniao_realizada: 'Realizada',
  reuniao_closer: 'Closer',
  venda: 'Venda'
}

function fmtMoney(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function fmtVal(f: string, v: unknown): string {
  if (v == null) return '—'
  if (f === 'valor' || f === 'cashCollected') return fmtMoney(Number(v))
  if (f === 'tipo') return TIPO_LABEL[String(v)] ?? String(v)
  return String(v)
}

function diffView(antes: Record<string, unknown> | null, depois: Record<string, unknown> | null): React.ReactNode {
  if (!antes && !depois) return null
  if (!antes) return <span style={{ color: 'var(--green)', fontSize: 11 }}>Novo registro</span>
  if (!depois) return <span style={{ color: 'var(--red)', fontSize: 11 }}>Registro excluído</span>
  const fields = ['data', 'tipo', 'valor', 'cashCollected', 'anuncio', 'obs', 'userName']
  const lbs: Record<string, string> = { data: 'Data', tipo: 'Tipo', valor: 'Valor', cashCollected: 'Cash', anuncio: 'Campanha', obs: 'Obs', userName: 'Profissional' }
  const diffs = fields.filter((f) => JSON.stringify(antes[f]) !== JSON.stringify(depois[f]))
  if (!diffs.length) return <span style={{ color: 'var(--text3)', fontSize: 11 }}>sem alterações</span>
  return (
    <div style={{ fontSize: 11 }}>
      {diffs.map((f) => (
        <div key={f} style={{ marginTop: 2 }}>
          <span style={{ color: 'var(--text3)' }}>{lbs[f] ?? f}: </span>
          <span style={{ color: 'var(--red)', textDecoration: 'line-through' }}>{fmtVal(f, antes[f])}</span>
          {' → '}
          <span style={{ color: 'var(--green)' }}>{fmtVal(f, depois[f])}</span>
        </div>
      ))}
    </div>
  )
}

export function AuditoriaPage() {
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<AuditLogRow[]>([])
  const [users, setUsers] = useState<CrmUser[]>([])
  const [filterAcao, setFilterAcao] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [uList, logList] = await Promise.all([
        listUsers(),
        getAuditoriaLogs({ limitCount: 500, acao: filterAcao || undefined, userId: filterUser || undefined })
      ])
      setUsers(uList)
      setLogs(logList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [filterAcao, filterUser])

  useEffect(() => {
    load()
  }, [load])

  function formatTs(ts: { seconds: number } | null): string {
    if (!ts) return '—'
    const d = new Date(ts.seconds * 1000)
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>🔍 Log de Auditoria</h2>
          <p style={{ color: 'var(--text2)' }}>Histórico completo de criações, edições e exclusões</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={filterAcao} onChange={(e) => setFilterAcao(e.target.value)} className="di" style={{ width: 150 }}>
            <option value="">Todas as ações</option>
            <option value="criar">✅ Criar</option>
            <option value="editar">✏️ Editar</option>
            <option value="deletar">🗑 Deletar</option>
          </select>
          <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="di" style={{ width: 170 }}>
            <option value="">Todos os usuários</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => load()}>
            ↺ Atualizar
          </button>
        </div>
      </div>
      <div className="card">
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
        {!loading && !error && !logs.length && (
          <div className="empty">
            <div className="empty-icon">🔍</div>
            <p>Nenhum evento encontrado</p>
          </div>
        )}
        {!loading && !error && logs.length > 0 && (
          <>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Data/Hora</th>
                    <th>Usuário</th>
                    <th>Ação</th>
                    <th>Registro</th>
                    <th>Alterações</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => {
                    const rec = l.depois ?? l.antes ?? {}
                    const recTipo = rec.tipo as string
                    const recLabel = recTipo ? (TIPO_LABEL[recTipo] ?? recTipo) + (rec.userName ? ` — ${rec.userName}` : '') : '—'
                    return (
                      <tr key={l.id}>
                        <td className="mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{formatTs(l.ts)}</td>
                        <td>
                          <strong style={{ fontSize: 13 }}>{l.userName || '—'}</strong>
                          <br />
                          <span style={{ fontSize: 10, color: 'var(--text3)' }}>{(l.userCargo || '').toUpperCase()}</span>
                        </td>
                        <td>
                          <span className={`badge ${ACAO_CLS[l.acao] ?? 'b-sdr'}`}>{ACAO_LABEL[l.acao] ?? l.acao}</span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text2)', ...(l.acao === 'deletar' ? { textDecoration: 'line-through', opacity: 0.6 } : {}) }}>
                          {recLabel}
                        </td>
                        <td>{diffView(l.antes, l.depois)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '10px 16px', fontSize: 11, color: 'var(--text3)' }}>
              {logs.length} evento{logs.length !== 1 ? 's' : ''} encontrado{logs.length !== 1 ? 's' : ''}
              {(filterAcao || filterUser) && ' (filtrado)'}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
