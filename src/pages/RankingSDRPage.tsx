import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getRegistrosByRange,
  getLeadsSdrByRange,
  listUsers,
  listAgendamentosByRegistroVendaIds
} from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { contaParaComissao } from '../lib/registroComissao'
import { today, mRange, wRange } from '../lib/dates'
import { useAppStore } from '../store/useAppStore'
import type { CrmUser } from '../store/useAppStore'
import { Target, Trophy } from 'lucide-react'
import { RankingPodiumThree } from '../components/ranking/RankingPodium'
import { RankMarker } from '../components/ui/RankMarker'

type RpPeriod = 'mes' | 'semana' | 'hoje'

function getRange(p: RpPeriod): { start: string; end: string } {
  if (p === 'mes') return mRange()
  if (p === 'semana') return wRange()
  return { start: today(), end: today() }
}

function isSdrCargo(cargo: string | undefined): boolean {
  const c = String(cargo ?? '').trim().toLowerCase()
  return c === 'sdr' || c === 'admin'
}

function fmtBrl(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

interface SdrPerfRow {
  id: string
  nome: string
  ag: number
  re: number
  ns: number
  vn: number
  ft: number
  cc: number
  leads: number
  photoUrl?: string
}

function SdrPerfTable({ rows, dense }: { rows: SdrPerfRow[]; dense?: boolean }) {
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
            <th className="rank-perf-th rank-perf-th--num">Agendamentos</th>
            <th className="rank-perf-th rank-perf-th--num">Realizadas</th>
            <th className="rank-perf-th rank-perf-th--num">No show</th>
            <th className="rank-perf-th rank-perf-th--num">Vendas</th>
            <th className="rank-perf-th rank-perf-th--num">Faturamento</th>
            <th className="rank-perf-th rank-perf-th--num">Cash collected</th>
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
              <td className={`rank-perf-td rank-perf-td--num${d}`}>{s.ag}</td>
              <td className={`rank-perf-td rank-perf-td--num${d}`}>{s.re}</td>
              <td className={`rank-perf-td rank-perf-td--num${d}`}>{s.ns}</td>
              <td className={`rank-perf-td rank-perf-td--num${d}`}>{s.vn}</td>
              <td className={`rank-perf-td rank-perf-td--num rank-perf-td--money${d}`}>{fmtBrl(s.ft)}</td>
              <td className={`rank-perf-td rank-perf-td--num rank-perf-td--money${d}`}>{fmtBrl(s.cc)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function RankingSDRPage({
  tvMode,
  tvRefreshKey
}: { tvMode?: boolean; tvRefreshKey?: number } = {}) {
  const { openModal } = useAppStore()
  const [period, setPeriod] = useState<RpPeriod>('mes')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<SdrPerfRow[]>([])
  const [view, setView] = useState<'lista' | 'podio'>(() => (tvMode ? 'podio' : 'lista'))

  useEffect(() => {
    if (tvMode) setView('podio')
  }, [tvMode])

  const byRe = useMemo(() => [...rows].sort((a, b) => b.re - a.re || b.ft - a.ft), [rows])

  const loadRanking = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) setLoading(true)
    setError(null)
    const { start, end } = getRange(period)
    try {
      const [recs, leadsRows, users] = await Promise.all([
        getRegistrosByRange(start, end),
        getLeadsSdrByRange(start, end),
        listUsers()
      ])
      const validRecs = recs.filter(contaParaComissao)
      const usersById = new Map<string, CrmUser>()
      users.forEach((u) => usersById.set(u.id, u))

      const sdrUsers = users.filter((u) => isSdrCargo(u.cargo))
      const sdrIdSet = new Set(sdrUsers.map((u) => u.id))

      const m = new Map<string, SdrPerfRow>()
      for (const u of sdrUsers) {
        m.set(u.id, {
          id: u.id,
          nome: u.nome,
          ag: 0,
          re: 0,
          ns: 0,
          vn: 0,
          ft: 0,
          cc: 0,
          leads: 0,
          photoUrl: u.photoUrl
        })
      }

      validRecs
        .filter(
          (r) =>
            sdrIdSet.has(r.userId) &&
            (r.tipo === 'reuniao_agendada' || r.tipo === 'reuniao_realizada' || r.tipo === 'reuniao_no_show')
        )
        .forEach((r) => {
          if (!m.has(r.userId)) {
            const u = usersById.get(r.userId)
            m.set(r.userId, {
              id: r.userId,
              nome: u?.nome ?? r.userName,
              ag: 0,
              re: 0,
              ns: 0,
              vn: 0,
              ft: 0,
              cc: 0,
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
        if (!sdrIdSet.has(l.userId)) return
        if (!m.has(l.userId)) {
          const u = usersById.get(l.userId)
          m.set(l.userId, {
            id: l.userId,
            nome: u?.nome ?? l.userName,
            ag: 0,
            re: 0,
            ns: 0,
            vn: 0,
            ft: 0,
            cc: 0,
            leads: 0,
            photoUrl: u?.photoUrl
          })
        }
        m.get(l.userId)!.leads += l.quantidade
      })

      const vendas = validRecs.filter((r) => r.tipo === 'venda')
      const ags = await listAgendamentosByRegistroVendaIds(vendas.map((r) => r.id))
      const vendaIdToSdr = new Map<string, string>()
      for (const ag of ags) {
        const vid = (ag.registroVendaId ?? '').trim()
        if (vid) vendaIdToSdr.set(vid, ag.sdrUserId)
      }
      for (const r of vendas) {
        const sdrId = vendaIdToSdr.get(r.id)
        if (!sdrId || !sdrIdSet.has(sdrId)) continue
        if (!m.has(sdrId)) {
          const u = usersById.get(sdrId)
          m.set(sdrId, {
            id: sdrId,
            nome: u?.nome ?? '—',
            ag: 0,
            re: 0,
            ns: 0,
            vn: 0,
            ft: 0,
            cc: 0,
            leads: 0,
            photoUrl: u?.photoUrl
          })
        }
        const s = m.get(sdrId)!
        s.vn++
        s.ft += r.valor || 0
        s.cc += r.cashCollected || 0
      }

      const list = Array.from(m.values()).filter(
        (s) => s.ag + s.re + s.ns + s.vn + s.leads > 0
      )
      list.sort((a, b) => b.ft - a.ft || b.re - a.re || b.ag - a.ag || a.nome.localeCompare(b.nome))
      setRows(list)
    } catch (err) {
      setError(formatFirebaseOrUnknownError(err) || 'Erro ao carregar')
      setRows([])
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
            <h3 className="rank-perf-card-title">Desempenho dos SDRs</h3>
            <p className="rank-perf-card-hint">
              Vendas e valores atribuídos ao SDR quando a venda está ligada à agenda do squad (campo na agenda).
            </p>
          </div>
          <SdrPerfTable rows={rows} />
        </div>
      )}
      {!loading && !error && view === 'podio' && (
        <div style={{ marginTop: 16 }}>
          <div className="card mb rank-perf-card">
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
                    const toPerson = (s: SdrPerfRow) => ({
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
                  <SdrPerfTable rows={byRe} dense />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
