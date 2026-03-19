import { useEffect, useState } from 'react'
import { getRegistrosByRange, getMetasConfig, getProdutos } from '../firebase/firestore'
import type { RegistroRow, MetasConfig, ProdutoRow } from '../firebase/firestore'
import { ProjectionChart } from '../components/dashboard/ProjectionChart'

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function mRange(mv?: string): { start: string; end: string } {
  const now = new Date()
  const y = mv ? parseInt(mv.slice(0, 4), 10) : now.getFullYear()
  const m = mv ? parseInt(mv.slice(5, 7), 10) : now.getMonth() + 1
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const end = new Date(y, m, 0).toISOString().split('T')[0]
  return { start, end }
}

function wRange(): { start: string; end: string } {
  const n = new Date()
  const dy = n.getDay()
  const diff = n.getDate() - dy + (dy === 0 ? -6 : 1)
  const s = new Date(n)
  s.setDate(diff)
  const e = new Date(s)
  e.setDate(diff + 6)
  return { start: s.toISOString().split('T')[0], end: e.toISOString().split('T')[0] }
}

type Dp = 'hoje' | 'semana' | 'mes' | 'custom'

function daysBetweenInclusive(start: string, end: string): number {
  const s = new Date(start)
  const e = new Date(end)
  const diff = e.getTime() - s.getTime()
  return diff >= 0 ? Math.floor(diff / (1000 * 60 * 60 * 24)) + 1 : 0
}

function dpRange(dp: Dp, customStart?: string, customEnd?: string): { start: string; end: string } {
  if (dp === 'hoje') return { start: today(), end: today() }
  if (dp === 'semana') return wRange()
  if (dp === 'mes') return mRange()
  if (dp === 'custom' && customStart && customEnd) return { start: customStart, end: customEnd }
  return mRange()
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

const PIE_COLORS = [
  'rgba(34,197,94,.95)',
  'rgba(22,163,74,.95)',
  'rgba(132,204,22,.92)',
  'rgba(5,150,105,.9)',
  'rgba(234,179,8,.95)'
]

function pieSlicePath(cx: number, cy: number, r: number, startFrac: number, endFrac: number): string {
  const tau = 2 * Math.PI
  const startRad = startFrac * tau - Math.PI / 2
  const endRad = endFrac * tau - Math.PI / 2
  const x1 = cx + r * Math.cos(startRad)
  const y1 = cy + r * Math.sin(startRad)
  const x2 = cx + r * Math.cos(endRad)
  const y2 = cy + r * Math.sin(endRad)
  const sweepDeg = (endFrac - startFrac) * 360
  const largeArc = sweepDeg > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
}

const STATS: Array<{ key: keyof ReturnType<typeof totals>; icon: string; label: string; col: string; money?: boolean }> = [
  { key: 'ag', icon: '📅', label: 'Reuniões Agendadas', col: 'orange' },
  { key: 're', icon: '✅', label: 'Reuniões Realizadas', col: 'green' },
  { key: 'cl', icon: '🤝', label: 'Reuniões Closer', col: 'purple' },
  { key: 'vn', icon: '💼', label: 'Vendas', col: 'amber' },
  { key: 'ft', icon: '💰', label: 'Faturamento', col: 'orange', money: true },
  { key: 'ca', icon: '💵', label: 'Cash Collected', col: 'cyan', money: true }
]

export function DashboardPage() {
  const [dp, setDp] = useState<Dp>('mes')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recs, setRecs] = useState<RegistroRow[]>([])
  const [metas, setMetas] = useState<MetasConfig>({})
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [produtos, setProdutos] = useState<ProdutoRow[]>([])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { start, end } = dpRange(dp, customStart, customEnd)
      setPeriodStart(start)
      setPeriodEnd(end)
      const [rows, mt, prods] = await Promise.all([
        getRegistrosByRange(start, end),
        getMetasConfig(),
        getProdutos()
      ])
      setRecs(rows)
      setMetas(mt ?? {})
      setProdutos(prods)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [dp, customStart, customEnd])

  const t = totals(recs)
  const metaKeys: (keyof MetasConfig)[] = [
    'meta_reunioes_agendadas',
    'meta_reunioes_realizadas',
    'meta_reunioes_closer',
    'meta_vendas',
    'meta_faturamento',
    'meta_cash'
  ]

  return (
    <div className="content">
      <div className="ctrl-row">
        <span className="ctrl-label">📅 Período:</span>
        <button
          type="button"
          className={`prd-btn ${dp === 'hoje' ? 'active' : ''}`}
          onClick={() => setDp('hoje')}
        >
          Hoje
        </button>
        <button
          type="button"
          className={`prd-btn ${dp === 'semana' ? 'active' : ''}`}
          onClick={() => setDp('semana')}
        >
          Semana
        </button>
        <button
          type="button"
          className={`prd-btn ${dp === 'mes' ? 'active' : ''}`}
          onClick={() => setDp('mes')}
        >
          Mês
        </button>
        <button
          type="button"
          className={`prd-btn ${dp === 'custom' ? 'active' : ''}`}
          onClick={() => setDp('custom')}
        >
          Personalizado
        </button>
        {dp === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="date"
              className="di"
              style={{ width: 140 }}
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <span style={{ color: 'var(--text3)', fontSize: 12 }}>até</span>
            <input
              type="date"
              className="di"
              style={{ width: 140 }}
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </div>
        )}
      </div>

      {loading && (
        <div className="loading">
          <div className="spin" />
          Carregando...
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--red)', padding: 16 }}>
          Erro: {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="stats-grid">
            {STATS.map((s) => {
              const val = s.money ? (t as Record<string, number>)[s.key] as number : (t as Record<string, number>)[s.key]
              const metaVal = metas[metaKeys[STATS.indexOf(s)] as keyof MetasConfig] as number | undefined
              const pct = metaVal != null && metaVal > 0
                ? Math.min(100, Math.round((Number(val) / metaVal) * 100))
                : null
              const display = s.money ? fmt(val) : String(val)
              return (
                <div key={s.key} className={`stat-card ${s.col}`}>
                  <div className="glow-dot" />
                  <div className="stat-icon">{s.icon}</div>
                  <div className={`stat-value${s.col === 'orange' ? ' v-orange' : ''}`}>
                    {display}
                  </div>
                  <div className="stat-label">{s.label}</div>
                  {metaVal != null && (
                    <div className="stat-sub" style={{ marginTop: 4 }}>
                      <span style={{ color: 'var(--text3)', fontSize: 11 }}>
                        Meta: {s.money ? fmt(metaVal) : metaVal}
                      </span>
                      {pct != null && (
                        <div className="prog-wrap">
                          <div className="prog-label">
                            <span>Progresso</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="prog-bar">
                            <div
                              className={`prog-fill ${pct >= 100 ? 'green' : pct >= 70 ? 'orange' : pct >= 40 ? 'amber' : 'red'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Projeções — gráficos de linha com acumulado diário + projeção tracejada */}
          {periodStart && periodEnd && (
            <div className="g4 mb" style={{ marginTop: 24 }}>
              {(() => {
                const totalDays = daysBetweenInclusive(periodStart, periodEnd)
                const todayStr = today()
                const elapsedDays = Math.max(1, Math.min(daysBetweenInclusive(periodStart, todayStr), totalDays))
                const factor = totalDays / elapsedDays

                const projItems: Array<{
                  key: string
                  title: string
                  icon: string
                  color: string
                  tipos: string[]
                  money?: boolean
                  field?: 'valor' | 'cashCollected'
                }> = [
                  { key: 'ag', title: 'Projeção — Reuniões', icon: '📅', color: '#f84a08', tipos: ['reuniao_agendada'] },
                  { key: 'vn', title: 'Projeção — Vendas', icon: '💼', color: '#fbbf24', tipos: ['venda'] },
                  { key: 'ft', title: 'Projeção — Faturamento', icon: '💰', color: '#22c55e', tipos: ['venda'], money: true, field: 'valor' },
                  { key: 'ca', title: 'Projeção — Cash Collected', icon: '💵', color: '#06b6d4', tipos: ['venda'], money: true, field: 'cashCollected' }
                ]

                const allDates: string[] = []
                const d = new Date(periodStart + 'T12:00:00')
                const endD = new Date(periodEnd + 'T12:00:00')
                while (d <= endD) {
                  allDates.push(d.toISOString().split('T')[0])
                  d.setDate(d.getDate() + 1)
                }

                return projItems.map((pi) => {
                  const metaKey =
                    pi.key === 'ag' ? 'meta_reunioes_agendadas'
                    : pi.key === 'vn' ? 'meta_vendas'
                    : pi.key === 'ft' ? 'meta_faturamento'
                    : 'meta_cash'
                  const metaVal = metas[metaKey as keyof MetasConfig] as number | undefined

                  const dailyMap = new Map<string, number>()
                  for (const dt of allDates) dailyMap.set(dt, 0)
                  for (const r of recs) {
                    if (!pi.tipos.includes(r.tipo)) continue
                    if (!dailyMap.has(r.data)) continue
                    dailyMap.set(r.data, (dailyMap.get(r.data) ?? 0) + (pi.field ? (r[pi.field] || 0) : 1))
                  }

                  const cumulative: number[] = []
                  let runSum = 0
                  const realPoints: number[] = []
                  for (let i = 0; i < allDates.length; i++) {
                    runSum += dailyMap.get(allDates[i]) ?? 0
                    cumulative.push(runSum)
                    if (allDates[i] <= todayStr) realPoints.push(runSum)
                  }

                  const lastReal = realPoints.length > 0 ? realPoints[realPoints.length - 1] : 0
                  const projected = Math.round(lastReal * factor)
                  const projPct = metaVal && metaVal > 0 ? Math.min(200, Math.round((projected / metaVal) * 100)) : null
                  const fmtVal = (v: number) => pi.money ? fmt(v) : String(v)
                  const fmtShort = (v: number) => {
                    if (!pi.money) return String(v)
                    if (v >= 1000) return `R$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`
                    return `R$${v}`
                  }

                  const dailyRate = realPoints.length > 0 ? lastReal / realPoints.length : 0
                  const projectedCumulative = cumulative.map((v, i) => {
                    if (i < realPoints.length) return v
                    return Math.round(lastReal + dailyRate * (i - realPoints.length + 1))
                  })

                  return (
                    <ProjectionChart
                      key={pi.key}
                      chartKey={pi.key}
                      title={pi.title}
                      icon={pi.icon}
                      color={pi.color}
                      realPoints={realPoints}
                      projectedCumulative={projectedCumulative}
                      allDates={allDates}
                      projected={projected}
                      projPct={projPct}
                      fmtVal={fmtVal}
                      fmtShort={fmtShort}
                      metaVal={metaVal}
                      money={pi.money}
                    />
                  )
                })
              })()}
            </div>
          )}

          {/* Quadro de progresso de todas as metas */}
          <div className="card mb">
            <div className="card-header">
              <span className="card-title">🎯 Progresso de metas</span>
            </div>
            <div style={{ paddingTop: 8 }}>
              {metaKeys.length === 0 ? (
                <div className="empty">
                  <p>Sem metas configuradas</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {metaKeys.map((k) => {
                    const alvo = metas[k] as number | undefined
                    if (alvo == null || alvo <= 0) return null
                    const atual =
                      k === 'meta_reunioes_agendadas'
                        ? t.ag
                        : k === 'meta_reunioes_realizadas'
                          ? t.re
                          : k === 'meta_reunioes_closer'
                            ? t.cl
                            : k === 'meta_vendas'
                              ? t.vn
                              : k === 'meta_faturamento'
                                ? t.ft
                                : t.ca
                    const pct = Math.min(150, Math.round((Number(atual) / alvo) * 100))
                    const label =
                      k === 'meta_reunioes_agendadas'
                        ? 'Reuniões agendadas'
                        : k === 'meta_reunioes_realizadas'
                          ? 'Reuniões realizadas'
                          : k === 'meta_reunioes_closer'
                            ? 'Reuniões closer'
                            : k === 'meta_vendas'
                              ? 'Vendas'
                              : k === 'meta_faturamento'
                                ? 'Faturamento'
                                : 'Cash collected'
                    const isMoney = k === 'meta_faturamento' || k === 'meta_cash'
                    return (
                      <div key={k} style={{ fontSize: 13 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span>{label}</span>
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                            {isMoney ? fmt(atual) : atual} / {isMoney ? fmt(alvo) : alvo} ({pct}%)
                          </span>
                        </div>
                        <div className="prog-bar">
                          <div
                            className={`prog-fill ${pct >= 100 ? 'green' : pct >= 70 ? 'orange' : pct >= 40 ? 'amber' : 'red'}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Produtos mais vendidos no período */}
          <div className="card mb">
            <div className="card-header">
              <span className="card-title">📦 Produtos mais vendidos</span>
            </div>
            <div style={{ paddingTop: 8 }}>
              {(() => {
                const vendas = recs.filter((r) => r.tipo === 'venda')
                if (!vendas.length) {
                  return (
                    <div className="empty">
                      <p>Sem vendas no período</p>
                    </div>
                  )
                }
                const map = new Map<string, { qtd: number; total: number; vendas: number }>()
                for (const r of vendas) {
                  const any = (r as unknown as { produtosDetalhes?: { produtoId: string; quantidade: number }[]; produtosIds?: string[] })
                  if (Array.isArray(any.produtosDetalhes) && any.produtosDetalhes.length) {
                    const jaContouVenda = new Set<string>()
                    any.produtosDetalhes.forEach((pd) => {
                      const cur = map.get(pd.produtoId) ?? { qtd: 0, total: 0, vendas: 0 }
                      cur.qtd += pd.quantidade || 0
                      cur.total += (r.valor || 0) * (pd.quantidade || 0)
                      if (!jaContouVenda.has(pd.produtoId)) {
                        jaContouVenda.add(pd.produtoId)
                        cur.vendas += 1
                      }
                      map.set(pd.produtoId, cur)
                    })
                  } else if (Array.isArray(any.produtosIds) && any.produtosIds.length) {
                    const jaContouVenda = new Set<string>()
                    any.produtosIds.forEach((pid) => {
                      const cur = map.get(pid) ?? { qtd: 0, total: 0, vendas: 0 }
                      cur.qtd += 1
                      cur.total += r.valor || 0
                      if (!jaContouVenda.has(pid)) {
                        jaContouVenda.add(pid)
                        cur.vendas += 1
                      }
                      map.set(pid, cur)
                    })
                  }
                }
                if (!map.size) {
                  return (
                    <div className="empty">
                      <p>Sem produtos vinculados às vendas</p>
                    </div>
                  )
                }
                const rows = Array.from(map.entries())
                  .map(([produtoId, v]) => {
                    const p = produtos.find((x) => x.id === produtoId)
                    return {
                      id: produtoId,
                      nome: p?.nome ?? 'Produto',
                      qtd: v.qtd,
                      total: v.total,
                      vendas: v.vendas
                    }
                  })
                  .sort((a, b) => b.qtd - a.qtd || b.total - a.total)
                  .slice(0, 5)
                const totalQtd = rows.reduce((s, r) => s + r.qtd, 0) || 1
                const cx = 90
                const cy = 90
                const pr = 72
                let acc = 0
                const slices = rows.map((r, i) => {
                  const frac = r.qtd / totalQtd
                  const start = acc
                  acc += frac
                  return {
                    ...r,
                    startFrac: start,
                    endFrac: acc,
                    color: PIE_COLORS[i % PIE_COLORS.length],
                    pct: Math.round(frac * 1000) / 10
                  }
                })
                return (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 16,
                      justifyContent: 'center'
                    }}
                  >
                    <svg
                      viewBox="0 0 180 180"
                      width={180}
                      height={180}
                      style={{ flexShrink: 0 }}
                      aria-label="Distribuição por quantidade vendida"
                    >
                      {rows.length === 1 ? (
                        <circle cx={cx} cy={cy} r={pr} fill={PIE_COLORS[0]}>
                          <title>
                            {slices[0].nome}: {slices[0].qtd} unid. · {slices[0].vendas}{' '}
                            {slices[0].vendas === 1 ? 'venda' : 'vendas'} · {fmt(slices[0].total)} (
                            {slices[0].pct}%)
                          </title>
                        </circle>
                      ) : (
                        slices.map((s) => (
                          <path
                            key={s.id}
                            d={pieSlicePath(cx, cy, pr, s.startFrac, s.endFrac)}
                            fill={s.color}
                            stroke="var(--border2)"
                            strokeWidth={1}
                          >
                            <title>
                              {s.nome}: {s.qtd} unid. · {s.vendas}{' '}
                              {s.vendas === 1 ? 'venda' : 'vendas'} · {fmt(s.total)} ({s.pct}%)
                            </title>
                          </path>
                        ))
                      )}
                    </svg>
                    <div style={{ flex: '1 1 160px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {slices.map((s) => (
                        <div
                          key={s.id}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}
                        >
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 2,
                              background: s.color,
                              marginTop: 3,
                              flexShrink: 0
                            }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{s.nome}</div>
                            <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.45 }}>
                              {s.qtd} unid. · {s.pct}%
                              <br />
                              {s.vendas} {s.vendas === 1 ? 'venda' : 'vendas'} · faturamento {fmt(s.total)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Atividade diária por data, separando agendadas, realizadas e vendas */}
          <div className="card mb">
            <div className="card-header">
              <span className="card-title">⚡ Atividade diária</span>
              <span style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: 'rgba(248,74,8,.7)' }} />{' '}
                  <span style={{ fontSize: 10 }}>Agendadas</span>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: 'rgba(34,197,94,.8)' }} />{' '}
                  <span style={{ fontSize: 10 }}>Realizadas</span>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: 'rgba(251,191,36,.9)' }} />{' '}
                  <span style={{ fontSize: 10 }}>Vendas</span>
                </span>
              </span>
            </div>
            <div style={{ paddingTop: 8 }}>
              {(() => {
                if (!recs.length) {
                  return (
                    <div className="empty">
                      <p>Sem atividade no período</p>
                    </div>
                  )
                }
                const map = new Map<string, { ag: number; re: number; cl: number; vn: number }>()
                for (const r of recs) {
                  const d = r.data || ''
                  if (!d) continue
                  if (!map.has(d)) map.set(d, { ag: 0, re: 0, cl: 0, vn: 0 })
                  const obj = map.get(d)!
                  if (r.tipo === 'reuniao_agendada') obj.ag += 1
                  else if (r.tipo === 'reuniao_realizada') obj.re += 1
                  else if (r.tipo === 'reuniao_closer') obj.cl += 1
                  else if (r.tipo === 'venda') obj.vn += 1
                }
                const rows = Array.from(map.entries())
                  .sort((a, b) => (a[0] < b[0] ? -1 : 1))
                  .slice(-14)
                const maxVal = rows.length
                  ? Math.max(
                      ...rows.map(([, v]) => Math.max(v.ag, v.re, v.vn, 1)),
                      1
                    )
                  : 1
                return (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', padding: '0 4px 4px' }}>
                    {rows.map(([d, v]) => {
                      const label = d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : ''
                      return (
                        <div key={d} style={{ flex: 1, minWidth: 16, textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', justifyContent: 'center', marginBottom: 4 }}>
                            <div
                              style={{
                                width: 6,
                                height: (v.ag / maxVal) * 120,
                                borderRadius: 4,
                                background: 'rgba(248,74,8,.7)',
                                transition: 'height .2s'
                              }}
                              title={`${v.ag} agendadas`}
                            />
                            <div
                              style={{
                                width: 6,
                                height: (v.re / maxVal) * 120,
                                borderRadius: 4,
                                background: 'rgba(34,197,94,.8)',
                                transition: 'height .2s'
                              }}
                              title={`${v.re} realizadas`}
                            />
                            <div
                              style={{
                                width: 6,
                                height: (v.vn / maxVal) * 120,
                                borderRadius: 4,
                                background: 'rgba(251,191,36,.9)',
                                transition: 'height .2s'
                              }}
                              title={`${v.vn} vendas`}
                            />
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--text3)' }}>{label}</div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Top SDRs e Closers no período */}
          <div className="g2 mb">
            <div className="card">
              <div className="card-header">
                <span className="card-title">🏆 Top SDRs — Realizadas</span>
              </div>
              {(() => {
                const byUser = new Map<
                  string,
                  { id: string; nome: string; cargo: string; ag: number; re: number; vn: number }
                >()
                for (const r of recs) {
                  const id = r.userId || r.userName
                  if (!id) continue
                  if (!byUser.has(id)) {
                    byUser.set(id, {
                      id,
                      nome: r.userName || '—',
                      cargo: r.userCargo || '',
                      ag: 0,
                      re: 0,
                      vn: 0
                    })
                  }
                  const u = byUser.get(id)!
                  if (r.tipo === 'reuniao_agendada') u.ag += 1
                  if (r.tipo === 'reuniao_realizada') u.re += 1
                  if (r.tipo === 'venda') u.vn += 1
                }
                const rows = Array.from(byUser.values())
                  .filter((u) => (u.cargo || '').toLowerCase() === 'sdr' && (u.re > 0 || u.ag > 0))
                  .sort((a, b) => (b.re - a.re) || (b.ag - a.ag))
                  .slice(0, 5)
                if (!rows.length) {
                  return (
                    <div className="empty">
                      <p>Sem dados de SDR no período</p>
                    </div>
                  )
                }
                return (
                  <div style={{ paddingTop: 4 }}>
                    {rows.map((u, idx) => (
                      <div key={u.id} className="ri">
                        <div className={`rn ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}`}>
                          #{idx + 1}
                        </div>
                        <div className="ri-info">
                          <div className="ri-name">{u.nome}</div>
                          {(() => {
                            const noShowPct = u.ag > 0 ? Math.round(((u.ag - u.re) / u.ag) * 100) : null
                            return (
                              <div className="ri-sub">
                                {u.re} realizadas · {u.ag} agendadas
                                {noShowPct != null && (
                                  <>
                                    {' '}
                                    · {noShowPct}% no-show
                                  </>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">💰 Top Closers</span>
              </div>
              {(() => {
                const byUser = new Map<
                  string,
                  { id: string; nome: string; cargo: string; vn: number; ft: number; cl: number }
                >()
                for (const r of recs) {
                  const id = r.userId || r.userName
                  if (!id) continue
                  if (!byUser.has(id)) {
                    byUser.set(id, {
                      id,
                      nome: r.userName || '—',
                      cargo: r.userCargo || '',
                      vn: 0,
                      ft: 0,
                      cl: 0
                    })
                  }
                  const u = byUser.get(id)!
                  if (r.tipo === 'reuniao_closer') {
                    u.cl += 1
                  }
                  if (r.tipo === 'venda') {
                    u.vn += 1
                    u.ft += r.valor || 0
                  }
                }
                const rows = Array.from(byUser.values())
                  .filter((u) => (u.cargo || '').toLowerCase() === 'closer' && (u.vn > 0 || u.ft > 0))
                  .sort((a, b) => (b.ft - a.ft) || (b.vn - a.vn))
                  .slice(0, 5)
                if (!rows.length) {
                  return (
                    <div className="empty">
                      <p>Sem dados de Closers no período</p>
                    </div>
                  )
                }
                return (
                  <div style={{ paddingTop: 4 }}>
                    {rows.map((u, idx) => (
                      <div key={u.id} className="ri">
                        <div className={`rn ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}`}>
                          #{idx + 1}
                        </div>
                        <div className="ri-info">
                          <div className="ri-name">{u.nome}</div>
                          {(() => {
                            const convPct =
                              u.cl > 0 ? Math.round((u.vn / u.cl) * 100) : null
                            const ticket = u.vn > 0 ? u.ft / u.vn : 0
                            return (
                              <div className="ri-sub">
                                {u.vn} vendas · {u.cl} reuniões ·{' '}
                                {convPct != null ? `${convPct}% conv.` : '—'}
                                {u.vn > 0 && (
                                  <>
                                    {' '}
                                    · TM: {fmt(ticket)}
                                  </>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>

          <div className="card mb" style={{ marginTop: 8 }}>
            <div className="card-header">
              <span className="card-title">📋 Registros recentes</span>
            </div>
            <div style={{ padding: 16 }}>
              {recs.length === 0 ? (
                <div className="empty">
                  <p>Sem registros no período</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {recs.slice(0, 8).map((r) => (
                    <div
                      key={r.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 0',
                        borderBottom: '1px solid var(--border)'
                      }}
                    >
                      <span>
                        {r.tipo === 'reuniao_agendada' ? '📅' : r.tipo === 'reuniao_realizada' ? '✅' : r.tipo === 'reuniao_closer' ? '🤝' : '💰'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{r.userName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                          {r.tipo === 'reuniao_agendada' ? 'Agendada' : r.tipo === 'reuniao_realizada' ? 'Realizada' : r.tipo === 'reuniao_closer' ? 'Closer' : 'Venda'}
                        </div>
                      </div>
                      {r.tipo === 'venda' && (
                        <span style={{ color: 'var(--green)', fontWeight: 700 }}>
                          {fmt(r.valor)}
                        </span>
                      )}
                      <span className="mono" style={{ fontSize: 10, color: 'var(--text3)' }}>
                        {r.data ? `${r.data.slice(8, 10)}/${r.data.slice(5, 7)}/${r.data.slice(0, 4)}` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
