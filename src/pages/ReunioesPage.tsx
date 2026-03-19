import { useCallback, useEffect, useState } from 'react'
import { getRegistrosCloserByRange, type AgendaReuniaoRow } from '../firebase/firestore'
import { today, wRange } from '../lib/dates'
import { useAppStore } from '../store/useAppStore'

type AgendaPeriod = 'hoje' | 'semana' | 'pendentes' | 'todas'

function getAgendaRange(period: AgendaPeriod): { start: string; end: string } {
  if (period === 'hoje') {
    const td = today()
    return { start: td, end: td }
  }
  if (period === 'semana') return wRange()
  return { start: '2020-01-01', end: '2099-12-31' }
}

function fdt(s: string): string {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

export function ReunioesPage() {
  const { currentUser } = useAppStore()
  const [period, setPeriod] = useState<AgendaPeriod>('hoje')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recs, setRecs] = useState<AgendaReuniaoRow[]>([])

  const loadAgenda = useCallback(async () => {
    if (!currentUser || (currentUser.cargo !== 'closer' && currentUser.cargo !== 'admin')) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { start, end } = getAgendaRange(period)
    try {
      let rows = await getRegistrosCloserByRange(start, end)
      if (period === 'pendentes') rows = rows.filter((r) => r.data >= today())
      setRecs(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
      setRecs([])
    } finally {
      setLoading(false)
    }
  }, [period, currentUser])

  useEffect(() => {
    loadAgenda()
  }, [loadAgenda])

  if (!currentUser || (currentUser.cargo !== 'closer' && currentUser.cargo !== 'admin')) {
    return (
      <div className="content">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>🤝 Minhas Reuniões</h2>
          <p style={{ color: 'var(--text2)' }}>Confirme realizadas e converta em vendas</p>
        </div>
        <div className="agenda-empty">
          <div className="agenda-empty-icon">🤝</div>
          <p>Área exclusiva para Closers.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>🤝 Minhas Reuniões</h2>
          <p style={{ color: 'var(--text2)' }}>Confirme realizadas e converta em vendas</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => loadAgenda()}>
          ↺ Atualizar
        </button>
      </div>
      <div className="agenda-tabs">
        {(['hoje', 'semana', 'pendentes', 'todas'] as const).map((p) => (
          <button
            key={p}
            type="button"
            className={`agenda-tab ${period === p ? 'active' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {p === 'hoje' ? 'Hoje' : p === 'semana' ? 'Esta Semana' : p === 'pendentes' ? 'Pendentes' : 'Todas'}
          </button>
        ))}
      </div>
      {error && (
        <div className="agenda-empty">
          <p>{error}</p>
        </div>
      )}
      {loading && (
        <div className="loading" style={{ padding: 24 }}>
          <div className="spin" /> Carregando...
        </div>
      )}
      {!loading && !error && !recs.length && (
        <div className="agenda-empty">
          <div className="agenda-empty-icon">📅</div>
          <p>Nenhuma reunião encontrada</p>
        </div>
      )}
      {!loading && !error && recs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {recs.map((r) => (
            <div key={r.id} className="reunion-card">
              <div className="rc-header">
                <span className="rc-date">{fdt(r.data)}</span>
                <span className="rc-hora">{r.hora || '—'}</span>
              </div>
              <div className="rc-nome">{r.userName || '—'}</div>
              <div className="rc-sdr">SDR: {r.userName || '—'}</div>
              {r.obs && <div className="rc-obs">{r.obs}</div>}
              <div className="rc-actions">
                <span className="rc-status pendente">Pendente</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
