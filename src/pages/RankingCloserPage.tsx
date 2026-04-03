import { useCallback, useEffect, useState } from 'react'
import { getRegistrosByRange, listUsers } from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { contaParaComissao } from '../lib/registroComissao'
import { today, mRange, wRange } from '../lib/dates'
import type { CrmUser } from '../store/useAppStore'
import { Briefcase, Trophy } from 'lucide-react'
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

interface CloserStat {
  id: string
  nome: string
  cl: number
  vn: number
  ft: number
  cc: number
  photoUrl?: string
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

export function RankingCloserPage({
  tvMode,
  tvRefreshKey
}: { tvMode?: boolean; tvRefreshKey?: number } = {}) {
  const [period, setPeriod] = useState<RpPeriod>('mes')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [list, setList] = useState<CloserStat[]>([])
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
      const [recs, users] = await Promise.all([
        getRegistrosByRange(start, end),
        listUsers()
      ])
      const validRecs = recs.filter(contaParaComissao)
      const usersById = new Map<string, CrmUser>()
      users.forEach((u) => usersById.set(u.id, u))

      const m = new Map<string, CloserStat>()
      validRecs.filter((r) => r.tipo === 'reuniao_closer').forEach((r) => {
        const u = usersById.get(r.userId)
        if (!m.has(r.userId))
          m.set(r.userId, { id: r.userId, nome: u?.nome ?? r.userName, cl: 0, vn: 0, ft: 0, cc: 0, photoUrl: u?.photoUrl })
        m.get(r.userId)!.cl++
      })
      validRecs.filter((r) => r.tipo === 'venda').forEach((r) => {
        const u = usersById.get(r.userId)
        if (!m.has(r.userId))
          m.set(r.userId, { id: r.userId, nome: u?.nome ?? r.userName, cl: 0, vn: 0, ft: 0, cc: 0, photoUrl: u?.photoUrl })
        const s = m.get(r.userId)!
        s.vn++
        s.ft += r.valor || 0
        s.cc += r.cashCollected || 0
      })
      const sorted = Array.from(m.values()).sort((a, b) => b.ft - a.ft)
      setList(sorted)
      const totalVn = sorted.reduce((sum, x) => sum + x.vn, 0)
      const totalFt = sorted.reduce((sum, x) => sum + x.ft, 0)
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
                <Briefcase size={16} strokeWidth={1.65} aria-hidden />
                Ranking Individual
              </span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                Ticket médio geral: {fmt(ticketMedio)}
              </span>
            </div>
            <div>
              {list.length ? (
                list.slice(0, 10).map((x, i) => {
                  const conv = x.cl > 0 ? Math.round((x.vn / x.cl) * 100) : 0
                  const tm = x.vn > 0 ? x.ft / x.vn : 0
                  const convCol = conv >= 40 ? 'var(--green)' : conv >= 20 ? 'var(--amber)' : 'var(--red)'
                  const sub = (
                    <>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                        {x.vn} vendas · {x.cl} reun.
                      </span>{' '}
                      <span
                        style={{
                          fontSize: 10,
                          padding: '2px 5px',
                          borderRadius: 4,
                          background: 'rgba(128,128,128,.1)',
                          color: convCol,
                          fontWeight: 700
                        }}
                      >
                        {conv}% conv.
                      </span>
                      {x.vn > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--text3)' }}> · TM: {fmt(tm)}</span>
                      )}
                    </>
                  )
                  return (
                    <RankingItem
                      key={x.nome + i}
                      index={i}
                      name={x.nome}
                      sub={sub}
                      val={fmt(x.ft)}
                    />
                  )
                })
              ) : (
                <div className="empty">
                  <p>Sem dados</p>
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
                Pódio Closer — Faturamento
              </span>
            </div>
            <div style={{ padding: 16 }}>
              {list.length === 0 ? (
                <div className="empty">
                  <p>Sem dados para o período</p>
                </div>
              ) : (
                <>
                  {(() => {
                    const podium = list.slice(0, 3)
                    const toPerson = (s: CloserStat) => ({
                      id: s.id,
                      nome: s.nome,
                      photoUrl: s.photoUrl,
                      valueMain: fmt(s.ft),
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
                  <div className="rpodium-table">
                    <div
                      className="rpodium-table-head"
                      style={{ gridTemplateColumns: '32px 1.15fr repeat(4, minmax(0, 0.68fr))' }}
                    >
                      <span className="rpodium-medal-col">#</span>
                      <span>Nome</span>
                      <span style={{ textAlign: 'right' }}>Reun.</span>
                      <span style={{ textAlign: 'right' }}>Conv.</span>
                      <span style={{ textAlign: 'right' }}>Vendas</span>
                      <span style={{ textAlign: 'right' }}>Faturamento</span>
                    </div>
                    {list.map((s, idx) => {
                      const conv = s.cl > 0 ? Math.round((s.vn / s.cl) * 100) : 0
                      const convColor =
                        s.cl === 0 ? 'var(--text3)' : conv >= 40 ? 'var(--green)' : conv >= 20 ? 'var(--amber)' : 'var(--red)'
                      return (
                        <div
                          key={s.id}
                          className={`rpodium-table-row ${idx === 0 ? 'rpodium-table-row--first' : ''}`}
                          style={{ gridTemplateColumns: '32px 1.15fr repeat(4, minmax(0, 0.68fr))' }}
                        >
                          <span className="rpodium-medal-col">
                            <RankMarker index={idx} />
                          </span>
                          <span style={{ fontWeight: 600 }}>{s.nome}</span>
                          <span style={{ textAlign: 'right' }}>{s.cl}</span>
                          <span style={{ textAlign: 'right', color: convColor }}>
                            {s.cl > 0 ? `${conv}%` : '—'}
                          </span>
                          <span style={{ textAlign: 'right' }}>{s.vn}</span>
                          <span
                            style={{
                              textAlign: 'right',
                              fontWeight: idx === 0 ? 800 : 600,
                              color: idx === 0 ? 'var(--green)' : undefined
                            }}
                          >
                            {fmt(s.ft)}
                          </span>
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
