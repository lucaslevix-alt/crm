import { useCallback, useEffect, useState } from 'react'
import { getRegistrosByRange, getLeadsSdrByRange, listUsers } from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { today, mRange, wRange } from '../lib/dates'
import { useAppStore } from '../store/useAppStore'
import type { CrmUser } from '../store/useAppStore'
import { BarChart3, CalendarCheck, CalendarClock, Target, Trophy } from 'lucide-react'
import { RankingPodiumThree } from '../components/ranking/RankingPodium'
import { RankMarker } from '../components/ui/RankMarker'

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
  ns: number
  leads: number
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
  val: string | number
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
        .filter(
          (r) =>
            r.tipo === 'reuniao_agendada' || r.tipo === 'reuniao_realizada' || r.tipo === 'reuniao_no_show'
        )
        .forEach((r) => {
          const u = usersById.get(r.userId)
          if (!m.has(r.userId)) {
            m.set(r.userId, {
              id: r.userId,
              nome: u?.nome ?? r.userName,
              ag: 0,
              re: 0,
              ns: 0,
              leads: 0,
              photoUrl: u?.photoUrl
            })
          }
          const s = m.get(r.userId)!
          if (r.tipo === 'reuniao_agendada') s.ag++
          else if (r.tipo === 'reuniao_realizada') s.re++
          else s.ns++
        })
      leadsRows.forEach((l) => {
        const u = usersById.get(l.userId)
        if (!m.has(l.userId)) {
          m.set(l.userId, {
            id: l.userId,
            nome: u?.nome ?? l.userName,
            ag: 0,
            re: 0,
            ns: 0,
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
      setError(formatFirebaseOrUnknownError(err) || 'Erro ao carregar')
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

  function noShowBadge(ag: number, nsCount: number): React.ReactNode {
    const ns = ag > 0 ? Math.round((nsCount / ag) * 100) : null
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
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          style={{ width: 'auto', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          onClick={() => openModal('modal-leads')}
        >
          <Target size={16} strokeWidth={1.65} aria-hidden />
          Registrar Leads
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
              <span className="card-title card-title--ic">
                <CalendarClock size={16} strokeWidth={1.65} aria-hidden />
                Reuniões Agendadas
              </span>
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
                        {noShowBadge(s.ag, s.ns)}
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
              <span className="card-title card-title--ic">
                <CalendarCheck size={16} strokeWidth={1.65} aria-hidden />
                Realizadas
              </span>
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
                        {noShowBadge(s.ag, s.ns)}
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
              <span className="card-title card-title--ic">
                <BarChart3 size={16} strokeWidth={1.65} aria-hidden />
                Aproveitamento de Leads
              </span>
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
              <span className="card-title card-title--ic">
                <Trophy size={16} strokeWidth={1.65} aria-hidden />
                Pódio SDR — Reuniões realizadas
              </span>
            </div>
            <div style={{ padding: 16 }}>
              {byRe.length === 0 ? (
                <div className="empty">
                  <p>Sem dados para o período</p>
                </div>
              ) : (
                <>
                  {(() => {
                    const podium = byRe.filter((s) => s.re > 0).slice(0, 3)
                    if (podium.length === 0) {
                      return (
                        <div className="empty" style={{ marginBottom: 16 }}>
                          <p>Nenhuma reunião realizada no período</p>
                        </div>
                      )
                    }
                    const toPerson = (s: SdrStat) => ({
                      id: s.id,
                      nome: s.nome,
                      photoUrl: s.photoUrl,
                      valueMain: String(s.re),
                      valueLabel: 'reun. realizadas',
                      sub: `${s.ag} agend.`
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
                      style={{ gridTemplateColumns: '32px 1.2fr repeat(5, minmax(0, 0.62fr))' }}
                    >
                      <span className="rpodium-medal-col">#</span>
                      <span>Nome</span>
                      <span style={{ textAlign: 'right' }}>Reun.</span>
                      <span style={{ textAlign: 'right' }}>Cmp.</span>
                      <span style={{ textAlign: 'right' }}>Ag.</span>
                      <span style={{ textAlign: 'right' }}>L→A</span>
                      <span style={{ textAlign: 'right' }}>Leads</span>
                    </div>
                    {byRe.map((s, idx) => {
                      const convLeadAg = s.leads > 0 ? Math.round((s.ag / s.leads) * 100) : 0
                      const convLeadColor =
                        s.leads === 0
                          ? 'var(--text3)'
                          : convLeadAg >= 30
                            ? 'var(--green)'
                            : convLeadAg >= 15
                              ? 'var(--amber)'
                              : 'var(--red)'
                      const cmp = s.ag > 0 ? Math.round((s.re / s.ag) * 100) : 0
                      const cmpColor =
                        s.ag === 0 ? 'var(--text3)' : cmp >= 50 ? 'var(--green)' : cmp >= 30 ? 'var(--amber)' : 'var(--red)'
                      return (
                        <div
                          key={s.id}
                          className={`rpodium-table-row ${idx === 0 ? 'rpodium-table-row--first' : ''}`}
                          style={{ gridTemplateColumns: '32px 1.2fr repeat(5, minmax(0, 0.62fr))' }}
                        >
                          <span className="rpodium-medal-col">
                            <RankMarker index={idx} />
                          </span>
                          <span style={{ fontWeight: 600 }}>{s.nome}</span>
                          <span style={{ textAlign: 'right', fontWeight: idx === 0 ? 700 : undefined }}>{s.re}</span>
                          <span style={{ textAlign: 'right', color: cmpColor }}>
                            {s.ag > 0 ? `${cmp}%` : '—'}
                          </span>
                          <span style={{ textAlign: 'right' }}>{s.ag}</span>
                          <span style={{ textAlign: 'right', color: convLeadColor }}>
                            {s.leads > 0 ? `${convLeadAg}%` : '—'}
                          </span>
                          <span style={{ textAlign: 'right' }}>{s.leads}</span>
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
