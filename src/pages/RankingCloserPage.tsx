import { useCallback, useEffect, useState } from 'react'
import { getRegistrosByRange, listUsers } from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { contaParaComissao } from '../lib/registroComissao'
import { today, mRange, wRange } from '../lib/dates'
import type { CrmUser } from '../store/useAppStore'
import { Trophy } from 'lucide-react'
import { RankingPodiumThree } from '../components/ranking/RankingPodium'
import { RankMarker } from '../components/ui/RankMarker'

type RpPeriod = 'mes' | 'semana' | 'hoje'

function getRange(p: RpPeriod): { start: string; end: string } {
  if (p === 'mes') return mRange()
  if (p === 'semana') return wRange()
  return { start: today(), end: today() }
}

function isCloserCargo(cargo: string | undefined): boolean {
  const c = String(cargo ?? '').trim().toLowerCase()
  return c === 'closer' || c === 'admin'
}

function fmtBrl(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function fmtPct(p: number | null): string {
  if (p == null || Number.isNaN(p)) return '—'
  return `${p.toFixed(1)}%`
}

interface CloserPerfRow {
  id: string
  nome: string
  cl: number
  vn: number
  ft: number
  cc: number
  photoUrl?: string
}

function CloserPerfTable({ rows, dense }: { rows: CloserPerfRow[]; dense?: boolean }) {
  if (!rows.length) {
    return (
      <div className="empty">
        <p>Sem dados para o período</p>
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
            <th className="rank-perf-th rank-perf-th--num">Reuniões realizadas</th>
            <th className="rank-perf-th rank-perf-th--num">Vendas</th>
            <th className="rank-perf-th rank-perf-th--num">Taxa de conversão</th>
            <th className="rank-perf-th rank-perf-th--num">Faturamento</th>
            <th className="rank-perf-th rank-perf-th--num">Cash collected</th>
            <th className="rank-perf-th rank-perf-th--num">Ticket médio</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, idx) => {
            const conv: number | null = s.cl > 0 ? (s.vn / s.cl) * 100 : null
            const convColor =
              conv === null ? 'var(--text3)' : conv >= 40 ? 'var(--green)' : conv >= 20 ? 'var(--amber)' : 'var(--red)'
            const tm = s.vn > 0 ? s.ft / s.vn : null
            return (
              <tr key={s.id} className={idx === 0 ? 'rank-perf-tr--top' : undefined}>
                <td className={`rank-perf-td rank-perf-td--num${d}`}>
                  <span className="rank-perf-rankcell">
                    <RankMarker index={idx} />
                  </span>
                </td>
                <td className={`rank-perf-td${d}`}>
                  <span className="rank-perf-name">{s.nome}</span>
                </td>
                <td className={`rank-perf-td rank-perf-td--num${d}`}>{s.cl}</td>
                <td className={`rank-perf-td rank-perf-td--num${d}`}>{s.vn}</td>
                <td className={`rank-perf-td rank-perf-td--num${d}`} style={{ color: convColor, fontWeight: 600 }}>
                  {fmtPct(conv)}
                </td>
                <td className={`rank-perf-td rank-perf-td--num rank-perf-td--money${d}`}>{fmtBrl(s.ft)}</td>
                <td className={`rank-perf-td rank-perf-td--num rank-perf-td--money${d}`}>{fmtBrl(s.cc)}</td>
                <td className={`rank-perf-td rank-perf-td--num rank-perf-td--money${d}`}>{tm != null ? fmtBrl(tm) : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function RankingCloserPage({
  tvMode,
  tvRefreshKey
}: { tvMode?: boolean; tvRefreshKey?: number } = {}) {
  const [period, setPeriod] = useState<RpPeriod>('mes')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<CloserPerfRow[]>([])
  const [ticketMedioEquipe, setTicketMedioEquipe] = useState(0)
  const [view, setView] = useState<'lista' | 'podio'>(() => (tvMode ? 'podio' : 'lista'))

  useEffect(() => {
    if (tvMode) setView('podio')
  }, [tvMode])

  const loadRanking = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) setLoading(true)
    setError(null)
    const { start, end } = getRange(period)
    try {
      const [recs, users] = await Promise.all([getRegistrosByRange(start, end), listUsers()])
      const validRecs = recs.filter(contaParaComissao)
      const usersById = new Map<string, CrmUser>()
      users.forEach((u) => usersById.set(u.id, u))

      const closerUsers = users.filter((u) => isCloserCargo(u.cargo))
      const closerIdSet = new Set(closerUsers.map((u) => u.id))

      const m = new Map<string, CloserPerfRow>()
      for (const u of closerUsers) {
        m.set(u.id, { id: u.id, nome: u.nome, cl: 0, vn: 0, ft: 0, cc: 0, photoUrl: u.photoUrl })
      }

      validRecs
        .filter((r) => closerIdSet.has(r.userId) && r.tipo === 'reuniao_closer')
        .forEach((r) => {
          if (!m.has(r.userId)) {
            const u = usersById.get(r.userId)
            m.set(r.userId, {
              id: r.userId,
              nome: u?.nome ?? r.userName,
              cl: 0,
              vn: 0,
              ft: 0,
              cc: 0,
              photoUrl: u?.photoUrl
            })
          }
          m.get(r.userId)!.cl++
        })

      validRecs
        .filter((r) => closerIdSet.has(r.userId) && r.tipo === 'venda')
        .forEach((r) => {
          if (!m.has(r.userId)) {
            const u = usersById.get(r.userId)
            m.set(r.userId, {
              id: r.userId,
              nome: u?.nome ?? r.userName,
              cl: 0,
              vn: 0,
              ft: 0,
              cc: 0,
              photoUrl: u?.photoUrl
            })
          }
          const s = m.get(r.userId)!
          s.vn++
          s.ft += r.valor || 0
          s.cc += r.cashCollected || 0
        })

      const sorted = Array.from(m.values())
        .filter((x) => x.cl + x.vn > 0)
        .sort((a, b) => b.ft - a.ft || b.vn - a.vn || a.nome.localeCompare(b.nome))
      setRows(sorted)
      const totalVn = sorted.reduce((sum, x) => sum + x.vn, 0)
      const totalFt = sorted.reduce((sum, x) => sum + x.ft, 0)
      setTicketMedioEquipe(totalVn > 0 ? totalFt / totalVn : 0)
    } catch (err) {
      setError(formatFirebaseOrUnknownError(err) || 'Erro ao carregar')
      setRows([])
      setTicketMedioEquipe(0)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [period])

  useEffect(() => {
    const silent = tvMode && tvRefreshKey !== undefined && tvRefreshKey > 0
    loadRanking(silent ? { silent: true } : undefined)
  }, [loadRanking, tvRefreshKey, tvMode])

  return (
    <>
      {!tvMode && (
        <div className="ctrl-row" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <span className="ctrl-label">Período:</span>
          {(['mes', 'semana', 'hoje'] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={`prd-btn ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p === 'mes' ? 'Este mês' : p === 'semana' ? 'Esta semana' : 'Hoje'}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <div style={{ display: 'inline-flex', borderRadius: 999, border: '1px solid var(--border2)', overflow: 'hidden' }}>
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
            <h3 className="rank-perf-card-title">Desempenho dos Closers</h3>
            <p className="rank-perf-card-hint">
              Taxa de conversão = vendas ÷ reuniões closer no período. Ticket médio = faturamento ÷ n.º de vendas.
              {ticketMedioEquipe > 0 && (
                <>
                  {' '}
                  <strong>Ticket médio da equipa:</strong> {fmtBrl(ticketMedioEquipe)}.
                </>
              )}
            </p>
          </div>
          <CloserPerfTable rows={rows} />
        </div>
      )}

      {!loading && !error && view === 'podio' && (
        <div style={{ marginTop: 16 }}>
          <div className="card mb rank-perf-card">
            <div className="card-header">
              <span className="card-title card-title--ic">
                <Trophy size={16} strokeWidth={1.65} aria-hidden />
                Pódio Closer — Faturamento
              </span>
            </div>
            <div style={{ padding: 16 }}>
              {rows.length === 0 ? (
                <div className="empty">
                  <p>Sem dados para o período</p>
                </div>
              ) : (
                <>
                  {(() => {
                    const podium = rows.slice(0, 3)
                    const toPerson = (s: CloserPerfRow) => ({
                      id: s.id,
                      nome: s.nome,
                      photoUrl: s.photoUrl,
                      valueMain: fmtBrl(s.ft),
                      valueLabel: 'faturamento',
                      sub: `${s.vn} vendas`
                    })
                    return (
                      <RankingPodiumThree
                        first={podium[0] ? toPerson(podium[0]) : null}
                        second={podium[1] ? toPerson(podium[1]) : null}
                        third={podium[2] ? toPerson(podium[2]) : null}
                      />
                    )
                  })()}
                  <CloserPerfTable rows={rows} dense />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
