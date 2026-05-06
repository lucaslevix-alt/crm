import { useCallback, useEffect, useMemo, useState } from 'react'
import { getChurnGtOperacaoMes, getGtsChurnOperacao, listUsers } from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { NOME_MES } from '../lib/mesesPt'
import { Trophy } from 'lucide-react'
import { RankingPodiumThree } from '../components/ranking/RankingPodium'
import { RankMarker } from '../components/ui/RankMarker'

function isGtCargo(cargo: string | undefined): boolean {
  return String(cargo ?? '').trim().toLowerCase() === 'gt'
}

interface GtChurnRow {
  id: string
  nome: string
  churn: number
  photoUrl?: string
}

function GtChurnTable({ rows, dense }: { rows: GtChurnRow[]; dense?: boolean }) {
  if (!rows.length) {
    return (
      <div className="empty">
        <p>Nenhum usuário com cargo GT</p>
      </div>
    )
  }
  const d = dense ? ' rank-perf-td--dense' : ''
  return (
    <div className={dense ? 'rank-perf-scroll' : 'rank-perf-scroll rank-perf-scroll--padded'}>
      <table className={`rank-perf-table${dense ? ' rank-perf-table--dense' : ''}`}>
        <thead>
          <tr>
            <th className="rank-perf-th rank-perf-th--num">#</th>
            <th className="rank-perf-th">Nome</th>
            <th className="rank-perf-th rank-perf-th--num">Churn (qtd.)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, idx) => (
            <tr key={s.id} className={idx === 0 ? 'rank-perf-tr--top' : undefined}>
              <td className={`rank-perf-td rank-perf-td--num${d}`}>
                <span className="rank-perf-rankcell">
                  <RankMarker index={idx} />
                </span>
              </td>
              <td className={`rank-perf-td${d}`}>
                <span className="rank-perf-name">{s.nome}</span>
              </td>
              <td className={`rank-perf-td rank-perf-td--num${d}`}>{s.churn}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function RankingGTsPage({
  tvMode,
  tvRefreshKey
}: { tvMode?: boolean; tvRefreshKey?: number } = {}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<GtChurnRow[]>([])
  const [refYear, setRefYear] = useState(() => new Date().getFullYear())
  const [refMonth, setRefMonth] = useState(() => new Date().getMonth() + 1)
  const [view, setView] = useState<'lista' | 'podio'>(() => (tvMode ? 'podio' : 'lista'))

  const effectiveYear = tvMode ? new Date().getFullYear() : refYear
  const effectiveMonth = tvMode ? new Date().getMonth() + 1 : refMonth

  useEffect(() => {
    if (tvMode) setView('podio')
  }, [tvMode])

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.churn - b.churn || a.nome.localeCompare(b.nome)),
    [rows]
  )

  const loadRanking = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true
      if (!silent) setLoading(true)
      setError(null)
      try {
        const [churnDoc, users] = await Promise.all([getGtsChurnOperacao(), listUsers()])
        const gtUsers = users.filter((u) => isGtCargo(u.cargo))
        const list: GtChurnRow[] = gtUsers.map((u) => ({
          id: u.id,
          nome: u.nome,
          churn: getChurnGtOperacaoMes(churnDoc.anos, effectiveYear, effectiveMonth, u.id),
          photoUrl: u.photoUrl
        }))
        list.sort((a, b) => a.churn - b.churn || a.nome.localeCompare(b.nome))
        setRows(list)
      } catch (err) {
        setError(formatFirebaseOrUnknownError(err) || 'Erro ao carregar')
        setRows([])
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [effectiveYear, effectiveMonth]
  )

  useEffect(() => {
    const silent = tvMode && tvRefreshKey !== undefined && tvRefreshKey > 0
    loadRanking(silent ? { silent: true } : undefined)
  }, [loadRanking, tvRefreshKey, tvMode])

  const mesLabel = `${NOME_MES[effectiveMonth - 1]} ${effectiveYear}`

  return (
    <>
      {!tvMode && (
        <>
          <div className="ctrl-row" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <span className="ctrl-label">Mês de referência:</span>
            <select
              className="di"
              style={{ maxWidth: 160 }}
              value={refMonth}
              onChange={(e) => setRefMonth(Number(e.target.value))}
            >
              {NOME_MES.map((n, i) => (
                <option key={n} value={i + 1}>
                  {n}
                </option>
              ))}
            </select>
            <select
              className="di"
              style={{ maxWidth: 120 }}
              value={refYear}
              onChange={(e) => setRefYear(Number(e.target.value))}
            >
              {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 3 + i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <span style={{ flex: 1 }} />
            <div
              style={{
                display: 'inline-flex',
                borderRadius: 999,
                border: '1px solid var(--border2)',
                overflow: 'hidden'
              }}
            >
              <button
                type="button"
                className="prd-btn"
                style={{
                  borderRadius: 0,
                  border: 'none',
                  background: view === 'lista' ? 'var(--btn-bg)' : 'transparent',
                  color: view === 'lista' ? 'var(--btn-fg)' : 'var(--text2)',
                  padding: '4px 12px',
                  fontSize: 12
                }}
                onClick={() => setView('lista')}
              >
                Tabela
              </button>
              <button
                type="button"
                className="prd-btn"
                style={{
                  borderRadius: 0,
                  border: 'none',
                  background: view === 'podio' ? 'var(--btn-bg)' : 'transparent',
                  color: view === 'podio' ? 'var(--btn-fg)' : 'var(--text2)',
                  padding: '4px 12px',
                  fontSize: 12
                }}
                onClick={() => setView('podio')}
              >
                Pódio
              </button>
            </div>
          </div>
        </>
      )}
      {error && (
        <div className="empty">
          <p>{error}</p>
        </div>
      )}
      {loading && (
        <div className="loading" style={{ padding: 24 }}>
          <div className="spin" /> Carregando...
        </div>
      )}
      {!loading && !error && view === 'lista' && (
        <div className="card rank-perf-card" style={{ marginTop: 16 }}>
          <div className="rank-perf-card-head">
            <h3 className="rank-perf-card-title">GTs — churn ({mesLabel})</h3>
            <p className="rank-perf-card-hint">
              Quantidade de churn por gestor (inteiro), cadastrada em Configurações → GTs — igual à Base, não usa valores em R$ da
              Gestão OP. Menos churn = melhor posição.
            </p>
          </div>
          <GtChurnTable rows={rows} />
        </div>
      )}
      {!loading && !error && view === 'podio' && (
        <div style={{ marginTop: 16 }}>
          <div className="card mb rank-perf-card">
            <div className="card-header">
              <span className="card-title card-title--ic">
                <Trophy size={16} strokeWidth={1.65} aria-hidden />
                Pódio GTs — menos churn ({mesLabel})
              </span>
            </div>
            <div style={{ padding: 16 }}>
              {sorted.length === 0 ? (
                <div className="empty">
                  <p>Nenhum usuário com cargo GT. Crie em Configurações → Usuários.</p>
                </div>
              ) : (
                <>
                  {(() => {
                    const podium = sorted.slice(0, 3)
                    const toPerson = (s: GtChurnRow) => ({
                      id: s.id,
                      nome: s.nome,
                      photoUrl: s.photoUrl,
                      valueMain: String(s.churn),
                      valueLabel: 'churn (qtd.)',
                      sub: 'quanto menor, melhor'
                    })
                    return (
                      <RankingPodiumThree
                        first={podium[0] ? toPerson(podium[0]) : null}
                        second={podium[1] ? toPerson(podium[1]) : null}
                        third={podium[2] ? toPerson(podium[2]) : null}
                      />
                    )
                  })()}
                  <GtChurnTable rows={sorted} dense />
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {!tvMode && !loading && !error && (
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 16, textAlign: 'center' }}>
          Os números são editados em Configurações → GTs, por mês e por gestor.
        </p>
      )}
    </>
  )
}
