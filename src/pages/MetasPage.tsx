import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getRegistrosByRange, getMetasConfig } from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import type { RegistroRow, MetasConfig } from '../firebase/firestore'
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

function fmt(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

const META_ITEMS: Array<{ lb: string; key: keyof MetasConfig; money: boolean }> = [
  { lb: 'Reuniões Agendadas', key: 'meta_reunioes_agendadas', money: false },
  { lb: 'Reuniões Realizadas', key: 'meta_reunioes_realizadas', money: false },
  { lb: 'Reuniões Closer', key: 'meta_reunioes_closer', money: false },
  { lb: 'Vendas', key: 'meta_vendas', money: false },
  { lb: 'Faturamento', key: 'meta_faturamento', money: true },
  { lb: 'Cash Collected', key: 'meta_cash', money: true }
]

export function MetasPage() {
  const [metaMonth, setMetaMonth] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metas, setMetas] = useState<MetasConfig>({})
  const [recs, setRecs] = useState<RegistroRow[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const { start, end } = mRange(metaMonth)
    Promise.all([getMetasConfig(), getRegistrosByRange(start, end)])
      .then(([mt, rows]) => {
        if (!cancelled) {
          setMetas(mt ?? {})
          setRecs(rows)
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
              const tKey = { meta_reunioes_agendadas: 'ag', meta_reunioes_realizadas: 're', meta_reunioes_closer: 'cl', meta_vendas: 'vn', meta_faturamento: 'ft', meta_cash: 'ca' }[it.key]
              const val = t[tKey as keyof typeof t]
              const mp = meta != null && meta > 0 ? metaPctParts(Number(val), meta) : null
              return (
                <div key={it.key} className="card">
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>{it.lb}</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>
                    {it.money ? fmt(Number(val)) : String(val)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    Meta: {meta != null ? (it.money ? fmt(meta) : String(meta)) : '—'}
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
          <div style={{ marginTop: 16 }}>
            <Link to="/config" className="btn btn-primary btn-sm">
              Editar Metas
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
