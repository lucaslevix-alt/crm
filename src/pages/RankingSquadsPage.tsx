import { useCallback, useEffect, useState } from 'react'
import { getRegistrosByRange, listSquads, type RegistroRow, type SquadRow } from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { today, mRange, wRange } from '../lib/dates'
import { contaParaComissao } from '../lib/registroComissao'
import { Trophy } from 'lucide-react'
import { RankingPodiumThree } from '../components/ranking/RankingPodium'
import { RankMarker } from '../components/ui/RankMarker'

type RpPeriod = 'mes' | 'semana' | 'hoje'

function getRange(p: RpPeriod): { start: string; end: string } {
  if (p === 'mes') return mRange()
  if (p === 'semana') return wRange()
  return { start: today(), end: today() }
}

function fmt(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function fmtTaxaConv(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return '—'
  return `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 0 })}%`
}

/** Colunas: # | Squad | Faturamento | Vendas | Reuniões realiz. | Taxa conv. | Ticket médio */
const R_SQUAD_PODIUM_GRID =
  '32px minmax(96px, 1.25fr) minmax(80px, 1fr) minmax(48px, 0.65fr) minmax(72px, 0.95fr) minmax(64px, 0.85fr) minmax(80px, 1fr)'

interface SquadStat {
  id: string
  nome: string
  fotoUrl: string
  vn: number
  ft: number
  cc: number
  /** Reuniões realizadas (SDR do squad) */
  re: number
}

function aggregateSquadsFromRecs(recs: RegistroRow[], squads: SquadRow[]): SquadStat[] {
  const userIdToSquadId = new Map<string, string>()
  squads.forEach((s) => {
    s.memberIds.forEach((uid) => {
      userIdToSquadId.set(uid, s.id)
    })
  })

  const bySquad = new Map<string, SquadStat>()
  squads.forEach((s) => {
    bySquad.set(s.id, { id: s.id, nome: s.nome, fotoUrl: s.fotoUrl, vn: 0, ft: 0, cc: 0, re: 0 })
  })

  for (const r of recs) {
    const sid = userIdToSquadId.get(r.userId)
    if (!sid) continue
    const st = bySquad.get(sid)
    if (!st) continue
    if (r.tipo === 'venda') {
      st.vn++
      st.ft += r.valor || 0
      st.cc += r.cashCollected || 0
    } else if (r.tipo === 'reuniao_realizada') {
      st.re++
    }
  }

  return Array.from(bySquad.values()).sort((a, b) => b.ft - a.ft || a.nome.localeCompare(b.nome))
}

function RankingItem({
  index,
  name,
  sub,
  val
}: {
  index: number
  name: React.ReactNode
  sub: React.ReactNode
  val: string
}) {
  return (
    <div className="ri">
      <div className="rn">
        <RankMarker index={index} />
      </div>
      <div className="ri-info">
        <div className="ri-name">{name}</div>
        <div className="ri-sub">{sub}</div>
      </div>
      <div className="ri-val">{val}</div>
    </div>
  )
}

export function RankingSquadsPage({
  tvMode,
  tvRefreshKey
}: { tvMode?: boolean; tvRefreshKey?: number } = {}) {
  const [period, setPeriod] = useState<RpPeriod>('mes')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [list, setList] = useState<SquadStat[]>([])
  const [ticketMedio, setTicketMedio] = useState(0)
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
      const [recs, squads] = await Promise.all([getRegistrosByRange(start, end), listSquads()])
      const stats = aggregateSquadsFromRecs(recs.filter(contaParaComissao), squads)
      setList(stats)
      const withSales = stats.filter((s) => s.vn > 0)
      const totalVn = withSales.reduce((sum, x) => sum + x.vn, 0)
      const totalFt = withSales.reduce((sum, x) => sum + x.ft, 0)
      setTicketMedio(totalVn > 0 ? totalFt / totalVn : 0)
    } catch (err) {
      setError(formatFirebaseOrUnknownError(err) || 'Erro ao carregar')
      setList([])
      setTicketMedio(0)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [period])

  useEffect(() => {
    const silent = tvMode && tvRefreshKey !== undefined && tvRefreshKey > 0
    loadRanking(silent ? { silent: true } : undefined)
  }, [loadRanking, tvRefreshKey, tvMode])

  const listDisplay = [...list].sort((a, b) => b.ft - a.ft)

  return (
    <>
      {!tvMode && (
        <div className="ctrl-row" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <span className="ctrl-label">Período:</span>
          {(['mes', 'semana', 'hoje'] as const).map((p) => (
            <button key={p} type="button" className={`prd-btn ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
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
              Lista
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
        <div style={{ marginTop: 16 }}>
          <div className="card mb">
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span className="card-title card-title--ic">
                <Trophy size={16} strokeWidth={1.65} aria-hidden />
                Por faturamento (vendas)
              </span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>Ticket médio (squads com venda): {fmt(ticketMedio)}</span>
            </div>
            <div>
              {listDisplay.length ? (
                listDisplay.map((x, i) => {
                  const tm = x.vn > 0 ? x.ft / x.vn : 0
                  const sub = (
                    <>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                        {x.vn} venda{x.vn !== 1 ? 's' : ''}
                        {x.vn > 0 && <> · TM: {fmt(tm)}</>}
                      </span>
                    </>
                  )
                  return (
                    <RankingItem
                      key={x.id}
                      index={i}
                      name={
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              background: x.fotoUrl ? `url(${x.fotoUrl}) center/cover` : 'var(--bg3)',
                              border: '1px solid var(--border2)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11,
                              fontWeight: 800,
                              color: 'var(--text3)',
                              flexShrink: 0
                            }}
                          >
                            {!x.fotoUrl && x.nome.charAt(0).toUpperCase()}
                          </span>
                          {x.nome}
                        </span>
                      }
                      sub={sub}
                      val={fmt(x.ft)}
                    />
                  )
                })
              ) : (
                <div className="empty">
                  <p>Nenhum squad cadastrado. Peça ao admin para configurar em Squads.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && !error && view === 'podio' && (
        <div style={{ marginTop: 16 }}>
          <div className="card mb">
            <div className="card-header">
              <span className="card-title card-title--ic">
                <Trophy size={16} strokeWidth={1.65} aria-hidden />
                Pódio Squads — Faturamento
              </span>
            </div>
            <div style={{ padding: 16 }}>
              {listDisplay.length === 0 ? (
                <div className="empty">
                  <p>Sem squads cadastrados</p>
                </div>
              ) : (
                <>
                  {(() => {
                    const withSales = listDisplay.filter((s) => s.vn > 0)
                    const podium = withSales.slice(0, 3)
                    const toPerson = (s: SquadStat) => ({
                      id: s.id,
                      nome: s.nome,
                      photoUrl: s.fotoUrl || undefined,
                      valueMain: fmt(s.ft),
                      valueLabel: 'faturamento',
                      sub: `${s.vn} venda${s.vn !== 1 ? 's' : ''}`
                    })
                    return (
                      <RankingPodiumThree
                        first={podium[0] ? toPerson(podium[0]) : null}
                        second={podium[1] ? toPerson(podium[1]) : null}
                        third={podium[2] ? toPerson(podium[2]) : null}
                      />
                    )
                  })()}
                  <div className="rpodium-table">
                    <div className="rpodium-table-head" style={{ gridTemplateColumns: R_SQUAD_PODIUM_GRID }}>
                      <span className="rpodium-medal-col">#</span>
                      <span>Squad</span>
                      <span style={{ textAlign: 'right' }} title="Faturamento no período">
                        Faturamento
                      </span>
                      <span style={{ textAlign: 'right' }}>Vendas</span>
                      <span style={{ textAlign: 'right' }} title="Reuniões realizadas pelos membros do squad">
                        Reuniões realiz.
                      </span>
                      <span style={{ textAlign: 'right' }} title="Vendas ÷ reuniões realizadas">
                        Taxa conv. vendas
                      </span>
                      <span style={{ textAlign: 'right' }} title="Faturamento ÷ vendas">
                        Ticket médio
                      </span>
                    </div>
                    {listDisplay.map((s, idx) => {
                      const ticket = s.vn > 0 ? s.ft / s.vn : null
                      const taxaConv = s.re > 0 ? (s.vn / s.re) * 100 : null
                      return (
                        <div
                          key={s.id}
                          className={`rpodium-table-row ${idx === 0 && s.vn > 0 ? 'rpodium-table-row--first' : ''}`}
                          style={{ gridTemplateColumns: R_SQUAD_PODIUM_GRID }}
                        >
                          <span className="rpodium-medal-col">
                            <RankMarker index={idx} />
                          </span>
                          <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 8,
                                background: s.fotoUrl ? `url(${s.fotoUrl}) center/cover` : 'var(--bg3)',
                                border: '1px solid var(--border2)',
                                flexShrink: 0,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                fontWeight: 800,
                                color: 'var(--text3)'
                              }}
                            >
                              {!s.fotoUrl && s.nome.charAt(0).toUpperCase()}
                            </span>
                            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.nome}
                            </span>
                          </span>
                          <span
                            style={{
                              textAlign: 'right',
                              fontWeight: idx === 0 && s.vn > 0 ? 800 : 600,
                              color: idx === 0 && s.vn > 0 ? 'var(--green)' : undefined
                            }}
                          >
                            {fmt(s.ft)}
                          </span>
                          <span style={{ textAlign: 'right' }}>{s.vn}</span>
                          <span style={{ textAlign: 'right' }}>{s.re}</span>
                          <span style={{ textAlign: 'right' }}>{fmtTaxaConv(taxaConv)}</span>
                          <span style={{ textAlign: 'right' }}>{ticket != null ? fmt(ticket) : '—'}</span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
