import { useCallback, useEffect, useState } from 'react'
import { getRegistrosByRange, getLeadsSdrByRange, listUsers } from '../firebase/firestore'
import { today, mRange, wRange } from '../lib/dates'
import { useAppStore } from '../store/useAppStore'
import type { CrmUser } from '../store/useAppStore'

type RpPeriod = 'mes' | 'semana' | 'hoje'

function getRange(p: RpPeriod): { start: string; end: string } {
  if (p === 'mes') return mRange()
  if (p === 'semana') return wRange()
  return { start: today(), end: today() }
}

interface SdrStat {
  id: string
  nome: string
  ag: number
  re: number
  leads: number
  photoUrl?: string
}

const MEDALS = ['🥇', '🥈', '🥉'] as const

function RankingItem({
  index,
  name,
  sub,
  val
}: {
  index: number
  name: React.ReactNode
  sub: React.ReactNode
  val: string | number
}) {
  const medalClass = index < 3 ? (['gold', 'silver', 'bronze'] as const)[index] : ''
  return (
    <div className="ri">
      <div className={`rn ${medalClass}`}>{MEDALS[index] ?? index + 1}</div>
      <div className="ri-info">
        <div className="ri-name">{name}</div>
        <div className="ri-sub">{sub}</div>
      </div>
      <div className="ri-val">{typeof val === 'string' && val.includes('R$') ? val : val}</div>
    </div>
  )
}

export function RankingSDRPage() {
  const { openModal } = useAppStore()
  const [period, setPeriod] = useState<RpPeriod>('mes')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [byAg, setByAg] = useState<SdrStat[]>([])
  const [byRe, setByRe] = useState<SdrStat[]>([])
  const [byLeads, setByLeads] = useState<SdrStat[]>([])
  const [view, setView] = useState<'lista' | 'podio'>('lista')

  const loadRanking = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { start, end } = getRange(period)
    try {
      const [recs, leadsRows, users] = await Promise.all([
        getRegistrosByRange(start, end),
        getLeadsSdrByRange(start, end),
        listUsers()
      ])
      const usersById = new Map<string, CrmUser>()
      users.forEach((u) => usersById.set(u.id, u))
      const m = new Map<string, SdrStat>()
      recs
        .filter((r) => r.tipo === 'reuniao_agendada' || r.tipo === 'reuniao_realizada')
        .forEach((r) => {
          const u = usersById.get(r.userId)
          if (!m.has(r.userId)) {
            m.set(r.userId, {
              id: r.userId,
              nome: u?.nome ?? r.userName,
              ag: 0,
              re: 0,
              leads: 0,
              photoUrl: u?.photoUrl
            })
          }
          const s = m.get(r.userId)!
          if (r.tipo === 'reuniao_agendada') s.ag++
          else s.re++
        })
      leadsRows.forEach((l) => {
        const u = usersById.get(l.userId)
        if (!m.has(l.userId)) {
          m.set(l.userId, {
            id: l.userId,
            nome: u?.nome ?? l.userName,
            ag: 0,
            re: 0,
            leads: 0,
            photoUrl: u?.photoUrl
          })
        }
        m.get(l.userId)!.leads += l.quantidade
      })
      const list = Array.from(m.values())
      setByAg([...list].sort((a, b) => b.ag - a.ag))
      setByRe([...list].sort((a, b) => b.re - a.re))
      setByLeads(
        [...list]
          .filter((s) => s.leads > 0 || s.ag > 0)
          .sort((a, b) => {
            const ra = a.leads > 0 ? a.ag / a.leads : 0
            const rb = b.leads > 0 ? b.ag / b.leads : 0
            return rb - ra
          })
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
      setByAg([])
      setByRe([])
      setByLeads([])
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    loadRanking()
  }, [loadRanking])

  function noShowBadge(ag: number, re: number): React.ReactNode {
    const ns = ag > 0 ? Math.round(((ag - re) / ag) * 100) : null
    if (ns === null) return null
    const col = ns <= 10 ? 'var(--green)' : ns <= 25 ? 'var(--amber)' : 'var(--red)'
    return (
      <span
        style={{
          fontSize: 10,
          padding: '2px 6px',
          borderRadius: 4,
          background: 'rgba(128,128,128,.1)',
          color: col,
          fontWeight: 700,
          marginLeft: 4
        }}
      >
        {ns}% no-show
      </span>
    )
  }

  return (
    <div className="content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>🏆 Ranking SDR</h2>
          <p style={{ color: 'var(--text2)' }}>Performance individual da equipe de SDR</p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          style={{ width: 'auto', padding: '8px 16px' }}
          onClick={() => openModal('modal-leads')}
        >
          🎯 Registrar Leads
        </button>
      </div>
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
        <div className="g3" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">📅 Reuniões Agendadas</span>
            </div>
            <div>
              {byAg.length ? (
                byAg.slice(0, 10).map((s, i) => (
                  <RankingItem
                    key={s.nome + i}
                    index={i}
                    name={
                      <>
                        {s.nome}
                        {noShowBadge(s.ag, s.re)}
                      </>
                    }
                    sub={`${s.re} realizadas`}
                    val={`${s.ag} ag.`}
                  />
                ))
              ) : (
                <div className="empty">
                  <p>Sem dados</p>
                </div>
              )}
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">✅ Realizadas + No-show</span>
            </div>
            <div>
              {byRe.length ? (
                byRe.slice(0, 10).map((s, i) => (
                  <RankingItem
                    key={s.nome + i}
                    index={i}
                    name={
                      <>
                        {s.nome}
                        {noShowBadge(s.ag, s.re)}
                      </>
                    }
                    sub={`${s.ag} agendadas`}
                    val={`${s.re} real.`}
                  />
                ))
              ) : (
                <div className="empty">
                  <p>Sem dados</p>
                </div>
              )}
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">🎯 Aproveitamento de Leads</span>
            </div>
            <div>
              {!byLeads.length ? (
                <div className="empty">
                  <p>
                    Nenhum lead registrado
                    <br />
                    <small style={{ color: 'var(--text3)' }}>Use o botão &quot;Registrar Leads&quot; para começar</small>
                  </p>
                </div>
              ) : (
                byLeads.slice(0, 10).map((s, i) => {
                  const taxa = s.leads > 0 ? Math.round((s.ag / s.leads) * 100) : null
                  const col = taxa === null ? 'var(--text3)' : taxa >= 30 ? 'var(--green)' : taxa >= 15 ? 'var(--amber)' : 'var(--red)'
                  const txLabel = taxa !== null ? `${taxa}% conv.` : 'sem leads'
                  const sub = s.leads > 0 ? `${s.leads} leads → ${s.ag} agendadas` : 'registre leads para calcular'
                  return (
                    <RankingItem
                      key={s.nome + i}
                      index={i}
                      name={
                        <>
                          {s.nome}
                          <span
                            style={{
                              fontSize: 10,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: 'rgba(128,128,128,.1)',
                              color: col,
                              fontWeight: 700,
                              marginLeft: 4
                            }}
                          >
                            {txLabel}
                          </span>
                        </>
                      }
                      sub={sub}
                      val={`${s.ag} ag.`}
                    />
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
      {!loading && !error && view === 'podio' && (
        <div style={{ marginTop: 16 }}>
          <div className="card mb">
            <div className="card-header">
              <span className="card-title">🏆 Pódio SDR — Leads & Conversão</span>
            </div>
            <div style={{ padding: 16 }}>
              {byLeads.length === 0 ? (
                <div className="empty">
                  <p>Nenhum lead registrado</p>
                </div>
              ) : (
                <>
                  {(() => {
                    const podium = [...byLeads]
                      .filter((s) => s.leads > 0 || s.ag > 0)
                      .slice(0, 3)
                    const getConv = (s: SdrStat) =>
                      s.leads > 0 ? Math.round((s.ag / s.leads) * 100) : 0
                    const renderCircle = (s: SdrStat, rank: number) => {
                      const conv = getConv(s)
                      const size = rank === 1 ? 80 : 64
                      const borderColor = rank === 1 ? 'var(--green)' : rank === 2 ? 'var(--amber)' : 'var(--purple)'
                      const bg = '#111827'
                      return (
                        <div
                          key={s.id}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            flex: 1,
                            transform: rank === 1 ? 'translateY(-8px)' : 'translateY(6px)'
                          }}
                        >
                          <div
                            style={{
                              width: size,
                              height: size,
                              borderRadius: '50%',
                              border: `3px solid ${borderColor}`,
                              background: s.photoUrl ? 'center/cover no-repeat' : bg,
                              backgroundImage: s.photoUrl ? `url(${s.photoUrl})` : undefined,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              fontWeight: 700,
                              boxShadow: '0 0 0 2px rgba(15,23,42,0.6)'
                            }}
                          >
                            {!s.photoUrl && (s.nome || '?').charAt(0).toUpperCase()}
                          </div>
                          <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>{s.nome}</div>
                          <div style={{ marginTop: 2, fontSize: 11, color: 'var(--text3)' }}>
                            {s.leads} leads · {s.ag} agendadas
                          </div>
                          <div style={{ marginTop: 2, fontSize: 11, color: 'var(--green)' }}>
                            {conv}% conv.
                          </div>
                          <div
                            style={{
                              marginTop: 8,
                              padding: '4px 12px',
                              borderRadius: 999,
                              background:
                                rank === 1
                                  ? 'linear-gradient(135deg,#22c55e,#16a34a)'
                                  : 'rgba(31,41,55,.9)',
                              color: '#fff',
                              fontSize: 12,
                              fontWeight: 700,
                              boxShadow: rank === 1 ? '0 10px 30px rgba(16,185,129,.5)' : undefined
                            }}
                          >
                            {rank}º lugar
                          </div>
                        </div>
                      )
                    }
                    return (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'space-between',
                          gap: 16,
                          marginBottom: 24
                        }}
                      >
                        {podium[1] && renderCircle(podium[1], 2)}
                        {podium[0] && renderCircle(podium[0], 1)}
                        {podium[2] && renderCircle(podium[2], 3)}
                      </div>
                    )
                  })()}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.5fr repeat(4, 0.7fr)',
                        fontSize: 11,
                        color: 'var(--text3)',
                        marginBottom: 4
                      }}
                    >
                      <span>Nome</span>
                      <span style={{ textAlign: 'right' }}>Leads</span>
                      <span style={{ textAlign: 'right' }}>Conv. Leads → Ag.</span>
                      <span style={{ textAlign: 'right' }}>Agendadas</span>
                      <span style={{ textAlign: 'right' }}>Realizadas</span>
                    </div>
                    {byLeads.map((s, idx) => {
                      const conv = s.leads > 0 ? Math.round((s.ag / s.leads) * 100) : 0
                      const convColor =
                        s.leads === 0 ? 'var(--text3)' : conv >= 30 ? 'var(--green)' : conv >= 15 ? 'var(--amber)' : 'var(--red)'
                      return (
                        <div
                          key={s.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1.5fr repeat(4, 0.7fr)',
                            fontSize: 12,
                            padding: '4px 0',
                            borderTop: idx === 0 ? '1px solid var(--border2)' : '1px solid rgba(148,163,184,.2)'
                          }}
                        >
                          <span>{s.nome}</span>
                          <span style={{ textAlign: 'right' }}>{s.leads}</span>
                          <span style={{ textAlign: 'right', color: convColor }}>
                            {s.leads > 0 ? `${conv}%` : '—'}
                          </span>
                          <span style={{ textAlign: 'right' }}>{s.ag}</span>
                          <span style={{ textAlign: 'right' }}>{s.re}</span>
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
    </div>
  )
}
