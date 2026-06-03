import { useCallback, useEffect, useMemo, useState } from 'react'
import { getGtsVendasAtual, getVendasGtAtual, listUsers } from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { labelPeriodYm } from '../lib/mesesPt'
import { Trophy } from 'lucide-react'
import { RankingPodiumThree } from '../components/ranking/RankingPodium'
import { RankMarker } from '../components/ui/RankMarker'

function isGtCargo(cargo: string | undefined): boolean {
  return String(cargo ?? '').trim().toLowerCase() === 'gt'
}

interface GtRankingRow {
  id: string
  nome: string
  vendas: number
  photoUrl?: string
}

function GtRankingTable({ rows, dense }: { rows: GtRankingRow[]; dense?: boolean }) {
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
            <th className="rank-perf-th rank-perf-th--num">Vendas</th>
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
              <td className={`rank-perf-td rank-perf-td--num${d}`} style={{ fontWeight: 700 }}>
                {s.vendas}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function sortGtRows(rows: GtRankingRow[]): GtRankingRow[] {
  return [...rows].sort((a, b) => b.vendas - a.vendas || a.nome.localeCompare(b.nome, 'pt-BR'))
}

export function RankingGTsPage({
  tvMode,
  tvRefreshKey
}: { tvMode?: boolean; tvRefreshKey?: number } = {}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<GtRankingRow[]>([])
  const [periodYm, setPeriodYm] = useState('')
  const [view, setView] = useState<'lista' | 'podio'>(() => (tvMode ? 'podio' : 'lista'))

  useEffect(() => {
    if (tvMode) setView('podio')
  }, [tvMode])

  const sorted = useMemo(() => sortGtRows(rows), [rows])
  const periodLabel = periodYm ? labelPeriodYm(periodYm) : '—'

  const loadRanking = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) setLoading(true)
    setError(null)
    try {
        const [vendasDoc, users] = await Promise.all([
          getGtsVendasAtual({ fromServer: true }),
          listUsers()
        ])
      const gtUsers = users.filter((u) => isGtCargo(u.cargo))
      const list: GtRankingRow[] = gtUsers.map((u) => ({
        id: u.id,
        nome: u.nome,
        vendas: getVendasGtAtual(vendasDoc, u.id),
        photoUrl: u.photoUrl
      }))
      setPeriodYm(vendasDoc.periodYm)
      setRows(sortGtRows(list))
    } catch (err) {
      setError(formatFirebaseOrUnknownError(err) || 'Erro ao carregar')
      setRows([])
      setPeriodYm('')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const silent = tvMode && tvRefreshKey !== undefined && tvRefreshKey > 0
    loadRanking(silent ? { silent: true } : undefined)
  }, [loadRanking, tvRefreshKey, tvMode])

  return (
    <>
      {!tvMode && (
        <div
          className="ctrl-row"
          style={{ flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'center' }}
        >
          <span className="ctrl-label">Disputa:</span>
          <span style={{ fontWeight: 700 }}>{periodLabel}</span>
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
            <h3 className="rank-perf-card-title">GTs — vendas ({periodLabel})</h3>
            <p className="rank-perf-card-hint">
              Contagem em Configurações → GTs (+1 / −1). Mais vendas = melhor posição. Reset no início do mês.
            </p>
          </div>
          <GtRankingTable rows={sorted} />
        </div>
      )}
      {!loading && !error && view === 'podio' && (
        <div style={{ marginTop: 16 }}>
          <div className="card mb rank-perf-card">
            <div className="card-header">
              <span className="card-title card-title--ic">
                <Trophy size={16} strokeWidth={1.65} aria-hidden />
                Pódio GTs — {periodLabel}
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
                    const toPerson = (s: GtRankingRow) => ({
                      id: s.id,
                      nome: s.nome,
                      photoUrl: s.photoUrl,
                      valueMain: String(s.vendas),
                      valueLabel: 'vendas',
                      sub: 'carteira do gestor'
                    })
                    return (
                      <RankingPodiumThree
                        first={podium[0] ? toPerson(podium[0]) : null}
                        second={podium[1] ? toPerson(podium[1]) : null}
                        third={podium[2] ? toPerson(podium[2]) : null}
                      />
                    )
                  })()}
                  <GtRankingTable rows={sorted} dense />
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {!tvMode && !loading && !error && (
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 16, textAlign: 'center' }}>
          Contabilize em Configurações → GTs. Resetar disputa zera todos para o novo mês.
        </p>
      )}
    </>
  )
}
