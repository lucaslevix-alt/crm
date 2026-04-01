import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Target } from 'lucide-react'
import {
  getMetasFirestoreDoc,
  getRegistrosByRange,
  listSquads,
  resolveMetasSquadsParaMes,
  type MetasConfig,
  type MetasFirestoreDoc,
  type MetasPorSquad,
  type RegistroRow,
  type SquadRow
} from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { useAppStore } from '../store/useAppStore'
import { SquadMetaAggregateCard, userHasIndivMeta } from '../components/metas/IndividualMetaCard'

function mRangeCal(ym: string): { start: string; end: string } {
  const [y, m] = ym.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const end = new Date(y, m, 0).toISOString().split('T')[0]
  return { start, end }
}

export function RankingMetasPage() {
  const { currentUser } = useAppStore()
  const isAdmin = currentUser?.cargo === 'admin'

  const [metaMonth, setMetaMonth] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metasDoc, setMetasDoc] = useState<MetasFirestoreDoc | null>(null)
  const [recs, setRecs] = useState<RegistroRow[]>([])
  const [squads, setSquads] = useState<SquadRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { start, end } = mRangeCal(metaMonth)
    try {
      const [doc, rows, sq] = await Promise.all([
        getMetasFirestoreDoc(),
        getRegistrosByRange(start, end),
        listSquads()
      ])
      setMetasDoc(doc)
      setRecs(rows)
      setSquads(sq)
    } catch (e) {
      setError(formatFirebaseOrUnknownError(e) || 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [metaMonth])

  useEffect(() => {
    load()
  }, [load])

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

  const [y, mo] = metaMonth.split('-').map(Number)
  const monthLabel = new Date(y, mo - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  })

  function setMonthToday() {
    const n = new Date()
    setMetaMonth(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>Mês das metas:</span>
        <input
          type="month"
          value={metaMonth}
          onChange={(e) => setMetaMonth(e.target.value)}
          style={{ width: 180 }}
          className="di"
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={setMonthToday}>
          Mês atual
        </button>
      </div>

      {loading && (
        <div className="loading">
          <div className="spin" />
          Carregando...
        </div>
      )}
      {error && <div style={{ color: 'var(--red)', padding: 12 }}>{error}</div>}

      {!loading && !error && (
        <>
          <div style={{ marginBottom: 16 }}>
            <h3
              style={{
                fontSize: 15,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4
              }}
            >
              <CalendarDays size={18} strokeWidth={1.65} aria-hidden style={{ color: 'var(--accent)' }} />
              {monthLabel}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0, lineHeight: 1.5 }}>
              Meta de cada squad definida manualmente pela administração. O realizado é a soma dos registos dos membros do
              squad neste mês.
            </p>
          </div>

          {squadCards.length === 0 ? (
            <p style={{ color: 'var(--text2)', fontSize: 14 }}>
              {isAdmin
                ? 'Nenhum squad com metas definidas para este mês.'
                : 'Sem metas de squad para ti neste mês ou não estás em nenhum squad com cota definida.'}
            </p>
          ) : (
            <div className="g2">
              {squadCards.map(({ squad, partial }) => (
                <SquadMetaAggregateCard
                  key={squad.id}
                  titulo={squad.nome}
                  subtitulo="Cota do squad · realizado agregado dos membros"
                  partial={partial}
                  recs={recs}
                  memberIds={squad.memberIds}
                />
              ))}
            </div>
          )}

          <div
            style={{
              marginTop: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              fontSize: 12,
              color: 'var(--text3)'
            }}
          >
            <Target size={14} strokeWidth={1.75} aria-hidden />
            <span>Meta global da empresa: menu Metas. Cotas por squad: Configurações → Metas (admin).</span>
          </div>
        </>
      )}
    </div>
  )
}
