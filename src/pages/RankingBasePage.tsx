import { useCallback, useEffect, useState } from 'react'
import { getBaseClientesOperacao, getTotalClientesOperacaoMes } from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { labelMesAno, mesAnterior, mesPosterior, NOME_MES } from '../lib/mesesPt'
import { BaseClientesPodium } from '../components/ranking/BaseClientesPodium'

export function RankingBasePage({
  tvMode,
  tvRefreshKey
}: { tvMode?: boolean; tvRefreshKey?: number } = {}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refYear, setRefYear] = useState(() => new Date().getFullYear())
  const [refMonth, setRefMonth] = useState(() => new Date().getMonth() + 1)
  const [anos, setAnos] = useState<Record<string, Record<string, number>>>({})

  const effectiveYear = tvMode ? new Date().getFullYear() : refYear
  const effectiveMonth = tvMode ? new Date().getMonth() + 1 : refMonth

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) setLoading(true)
    setError(null)
    try {
      const d = await getBaseClientesOperacao()
      setAnos(d.anos)
    } catch (err) {
      setError(formatFirebaseOrUnknownError(err) || 'Erro ao carregar')
      setAnos({})
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const silent = tvMode && tvRefreshKey !== undefined && tvRefreshKey > 0
    load(silent ? { silent: true } : undefined)
  }, [load, tvMode, tvRefreshKey])

  const prev = mesAnterior(effectiveYear, effectiveMonth)
  const next = mesPosterior(effectiveYear, effectiveMonth)
  const totalMain = getTotalClientesOperacaoMes(anos, effectiveYear, effectiveMonth)
  const totalLeft = getTotalClientesOperacaoMes(anos, prev.ano, prev.mes)
  const totalRight = getTotalClientesOperacaoMes(anos, next.ano, next.mes)

  return (
    <div style={{ marginTop: tvMode ? 0 : 16 }}>
      {!tvMode && (
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
          <select className="di" style={{ maxWidth: 120 }} value={refYear} onChange={(e) => setRefYear(Number(e.target.value))}>
            {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 3 + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="empty">
          <p>{error}</p>
        </div>
      )}
      {loading && !error && (
        <div className="loading" style={{ padding: 24 }}>
          <div className="spin" /> Carregando...
        </div>
      )}
      {!loading && !error && (
        <BaseClientesPodium
          tvMode={tvMode}
          totalMain={totalMain}
          labelMain={labelMesAno(effectiveMonth, effectiveYear)}
          totalLeft={totalLeft}
          labelLeft={labelMesAno(prev.mes, prev.ano)}
          totalRight={totalRight}
          labelRight={labelMesAno(next.mes, next.ano)}
        />
      )}
      {!tvMode && !loading && !error && (
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 16, textAlign: 'center' }}>
          Os valores são editados em Configurações → Base. O centro mostra o mês escolhido; as laterais mostram o mês anterior e
          o seguinte.
        </p>
      )}
    </div>
  )
}
