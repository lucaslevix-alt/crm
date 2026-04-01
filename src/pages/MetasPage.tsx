import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  getRegistrosByRange,
  getMetasFirestoreDoc,
  listSquads,
  resolveMetasParaMes,
  resolveMetasSquadsParaMes,
  type MetasFirestoreDoc,
  type MetasPorSquad,
  type RegistroRow,
  type MetasConfig,
  type SquadRow
} from '../firebase/firestore'
import {
  formatMetaBrl,
  META_ITEMS,
  SquadMetaAggregateCard,
  TKEY,
  userHasIndivMeta
} from '../components/metas/IndividualMetaCard'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { useAppStore } from '../store/useAppStore'
import { metaPctParts } from '../utils/metaProgress'

function mRange(mv: string): { start: string; end: string } {
  const [y, m] = mv.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const end = new Date(y, m, 0).toISOString().split('T')[0]
  return { start, end }
}

function totals(recs: RegistroRow[]) {
  return {
    ag: recs.filter((r) => r.tipo === 'reuniao_agendada').length,
    re: recs.filter((r) => r.tipo === 'reuniao_realizada').length,
    cl: recs.filter((r) => r.tipo === 'reuniao_closer').length,
    vn: recs.filter((r) => r.tipo === 'venda').length,
    ft: recs.filter((r) => r.tipo === 'venda').reduce((s, r) => s + (r.valor || 0), 0),
    ca: recs.filter((r) => r.tipo === 'venda').reduce((s, r) => s + (r.cashCollected || 0), 0)
  }
}

export function MetasPage() {
  const { currentUser } = useAppStore()
  const isAdmin = currentUser?.cargo === 'admin'

  const [metaMonth, setMetaMonth] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metas, setMetas] = useState<MetasConfig>({})
  const [metasDoc, setMetasDoc] = useState<MetasFirestoreDoc | null>(null)
  const [recs, setRecs] = useState<RegistroRow[]>([])
  const [squads, setSquads] = useState<SquadRow[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const { start, end } = mRange(metaMonth)
    Promise.all([getMetasFirestoreDoc(), getRegistrosByRange(start, end), listSquads()])
      .then(([doc, rows, sq]) => {
        if (!cancelled) {
          setMetasDoc(doc)
          setMetas(resolveMetasParaMes(metaMonth, doc))
          setRecs(rows)
          setSquads(sq)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(formatFirebaseOrUnknownError(e) || 'Erro ao carregar')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [metaMonth])

  const t = totals(recs)
  const [year, month] = metaMonth.split('-').map(Number)
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  })

  const metasSquads: MetasPorSquad = useMemo(
    () => (metasDoc ? resolveMetasSquadsParaMes(metaMonth, metasDoc) : {}),
    [metasDoc, metaMonth]
  )

  const squadCards = useMemo(() => {
    const uid = currentUser?.id
    let list = squads
    if (!isAdmin && uid) {
      list = squads.filter((s) => s.memberIds.includes(uid))
    }
    return list
      .map((s) => {
        const partial = metasSquads[s.id]
        if (!userHasIndivMeta(partial)) return null
        return { squad: s, partial: partial! }
      })
      .filter(Boolean) as Array<{ squad: SquadRow; partial: Partial<MetasConfig> }>
  }, [squads, metasSquads, isAdmin, currentUser?.id])

  const temAlgumSquad = squadCards.length > 0

  function setMonthToday() {
    const n = new Date()
    setMetaMonth(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="content">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Metas & Histórico</h2>
        <p style={{ color: 'var(--text2)' }}>Consulte o progresso por mês</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>Mês/Ano:</span>
        <input
          type="month"
          value={metaMonth}
          onChange={(e) => setMetaMonth(e.target.value)}
          style={{ width: 180 }}
          className="di"
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={setMonthToday}>
          Mês Atual
        </button>
      </div>

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
        <>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarDays size={20} strokeWidth={1.65} aria-hidden style={{ color: 'var(--accent)' }} />
              {monthLabel}
            </h3>
          </div>
          <div className="g2">
            {META_ITEMS.map((it) => {
              const meta = metas[it.key]
              const tKey = TKEY[it.key]
              const val = t[tKey]
              const mp = meta != null && meta > 0 ? metaPctParts(Number(val), meta) : null
              return (
                <div key={it.key} className="card">
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>{it.lb}</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>
                    {it.money ? formatMetaBrl(Number(val)) : String(val)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    Meta: {meta != null ? (it.money ? formatMetaBrl(meta) : String(meta)) : '—'}
                  </div>
                  {meta != null && mp != null && (
                    <>
                      <div className="prog-bar" style={{ height: 6, marginTop: 8 }}>
                        <div
                          className={`prog-fill ${mp.rawPct >= 100 ? 'green' : mp.rawPct >= 70 ? 'orange' : 'amber'}`}
                          style={{ width: `${mp.barPct}%` }}
                        />
                      </div>
                      <div style={{ fontSize: 11, marginTop: 4 }} title={mp.superacaoPct != null ? mp.labelLong : undefined}>
                        {mp.labelShort}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {temAlgumSquad && (
            <div style={{ marginTop: 32 }}>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 16
                }}
              >
                <Users size={20} strokeWidth={1.65} aria-hidden style={{ color: 'var(--accent)' }} />
                Progresso por squad
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: -8, marginBottom: 16 }}>
                Cotas por squad definidas manualmente em Configurações → Metas. Realizado agregado dos membros no mês.
              </p>
              <div className="g2">
                {squadCards.map(({ squad, partial }) => (
                  <SquadMetaAggregateCard
                    key={squad.id}
                    titulo={squad.nome}
                    subtitulo="Cota do squad · realizado agregado"
                    partial={partial}
                    recs={recs}
                    memberIds={squad.memberIds}
                  />
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <Link to="/config/metas" className="btn btn-primary btn-sm">
              Editar Metas
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
