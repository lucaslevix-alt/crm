import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Award,
  Banknote,
  BriefcaseBusiness,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Handshake,
  Package,
  Target,
  Trophy,
  Wallet,
  Percent
} from 'lucide-react'
import { getRegistrosByRange, getMetasConfig, getProdutos } from '../firebase/firestore'
import type { RegistroRow, MetasConfig, ProdutoRow } from '../firebase/firestore'
import { ProjectionChart } from '../components/dashboard/ProjectionChart'
import { metaPctParts } from '../utils/metaProgress'
import { icLg } from '../lib/icon-sizes'
import { smoothAreaUnderPath, smoothPathThrough } from '../lib/smooth-chart-path'

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
  const vendas = recs.filter((r) => r.tipo === 'venda')
  return {
    ag: recs.filter((r) => r.tipo === 'reuniao_agendada').length,
    re: recs.filter((r) => r.tipo === 'reuniao_realizada').length,
    cl: recs.filter((r) => r.tipo === 'reuniao_closer').length,
    vn: vendas.length,
    ft: vendas.reduce((s, r) => s + (r.valor || 0), 0),
    ca: vendas.reduce((s, r) => s + (r.cashCollected || 0), 0),
    dc: vendas.reduce((s, r) => s + (r.descontoCloser ?? 0), 0)
  }
}

function fmt(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function dailyFaturamentoSpark(recs: RegistroRow[], start: string, end: string): number[] {
  if (!start || !end) return []
  const map = new Map<string, number>()
  const days: string[] = []
  const d = new Date(start + 'T12:00:00')
  const endD = new Date(end + 'T12:00:00')
  while (d <= endD) {
    const ds = d.toISOString().split('T')[0]
    days.push(ds)
    map.set(ds, 0)
    d.setDate(d.getDate() + 1)
  }
  for (const r of recs) {
    if (r.tipo !== 'venda' || !r.data) continue
    if (!map.has(r.data)) continue
    map.set(r.data, (map.get(r.data) ?? 0) + (r.valor || 0))
  }
  const last = days.slice(-14)
  return last.map((dt) => map.get(dt) ?? 0)
}

function RevenueSparkline({ points }: { points: number[] }) {
  const w = 520
  const h = 76
  const padY = 8
  if (!points.length) {
    return (
      <div style={{ height: h, display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--text3)' }}>
        Sem faturamento diário neste recorte
      </div>
    )
  }
  const max = Math.max(...points, 1)
  const innerH = h - padY * 2
  const step = points.length > 1 ? (w - 4) / (points.length - 1) : 0
  const coords = points.map((v, i) => {
    const x = 2 + i * step
    const y = padY + innerH * (1 - v / max)
    return [x, y] as const
  })
  const pts: [number, number][] = coords.map(([x, y]) => [x, y])
  const areaD = smoothAreaUnderPath(pts, h)
  const lineD = smoothPathThrough(pts)

  return (
    <svg
      className="db-spark-svg"
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="db-spark-area" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.02" />
          <stop offset="55%" stopColor="var(--accent)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--accent2)" stopOpacity="0.26" />
        </linearGradient>
        <linearGradient id="db-spark-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--accent2)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#db-spark-area)" className="db-spark-area-path" />
      <path
        d={lineD}
        fill="none"
        stroke="url(#db-spark-line)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="db-spark-line-path"
      />
    </svg>
  )
}

const PIE_COLORS = [
  'rgba(34,197,94,.95)',
  'rgba(22,163,74,.95)',
  'rgba(132,204,22,.92)',
  'rgba(5,150,105,.9)',
  'rgba(234,179,8,.95)'
]

function dbRankBadgeMod(idx: number): string {
  if (idx === 0) return 'db-rank-badge--gold'
  if (idx === 1) return 'db-rank-badge--silver'
  if (idx === 2) return 'db-rank-badge--bronze'
  return ''
}

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

const STATS: Array<{
  key: keyof ReturnType<typeof totals>
  Icon: LucideIcon
  label: string
  col: string
  money?: boolean
}> = [
  { key: 'ag', Icon: CalendarClock, label: 'Reuniões Agendadas', col: 'orange' },
  { key: 're', Icon: CheckCircle2, label: 'Reuniões Realizadas', col: 'green' },
  { key: 'cl', Icon: Handshake, label: 'Reuniões Closer', col: 'purple' },
  { key: 'vn', Icon: BriefcaseBusiness, label: 'Vendas', col: 'amber' },
  { key: 'ft', Icon: Wallet, label: 'Faturamento', col: 'orange', money: true },
  { key: 'ca', Icon: Banknote, label: 'Cash Collected', col: 'cyan', money: true }
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

  const sparkFt = useMemo(
    () => dailyFaturamentoSpark(recs, periodStart, periodEnd),
    [recs, periodStart, periodEnd]
  )

  return (
    <div className="content db-page">
      <header className="db-head">
        <div>
          <h1 className="db-title">Dashboard</h1>
          <p className="db-sub">Visão geral comercial · escolha o período</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          <div className="db-pill-wrap">
            <button
              type="button"
              className={`db-pill ${dp === 'hoje' ? 'active' : ''}`}
              onClick={() => setDp('hoje')}
            >
              Hoje
            </button>
            <button
              type="button"
              className={`db-pill ${dp === 'semana' ? 'active' : ''}`}
              onClick={() => setDp('semana')}
            >
              Semana
            </button>
            <button
              type="button"
              className={`db-pill ${dp === 'mes' ? 'active' : ''}`}
              onClick={() => setDp('mes')}
            >
              Mês
            </button>
            <button
              type="button"
              className={`db-pill ${dp === 'custom' ? 'active' : ''}`}
              onClick={() => setDp('custom')}
            >
              Personalizado
            </button>
          </div>
          {dp === 'custom' && (
            <div className="db-pill-dates">
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
      </header>

      {loading && (
        <div className="db-loading">
          <div className="db-loading-spin" aria-hidden />
          <span>Sincronizando métricas…</span>
        </div>
      )}

      {error && <div className="db-error">Erro: {error}</div>}

      {!loading && !error && (
        <>
          <section className="db-bento db-bento--hero">
            <div className="db-card db-card--hero">
              <div className="db-card-label">Faturamento no período</div>
              <div className="db-hero-value">{fmt(t.ft)}</div>
              <div className="db-hero-meta">
                <span className="db-hero-chip">
                  <strong>{t.vn}</strong> vendas
                </span>
                <span className="db-hero-chip">
                  Cash <strong>{fmt(t.ca)}</strong>
                </span>
                <span className="db-hero-chip">
                  Reun. realiz. <strong>{t.re}</strong>
                </span>
                <span
                  className="db-hero-chip"
                  title="Soma do desconto: na venda à vista compara preços à vista das linhas; no parcelado compara totais parcelados"
                >
                  Desc. closer <strong>{fmt(t.dc)}</strong>
                </span>
              </div>
              <div className="db-spark">
                <RevenueSparkline points={sparkFt} />
              </div>
            </div>
            <div className="db-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 210 }}>
              <div className="db-kpi-strip-title">Pipeline rápido</div>
              <div className="db-kpi-grid">
                <div className="db-kpi-mini">
                  <div className="db-kpi-mini-val" style={{ color: 'var(--accent2)' }}>
                    {t.ag}
                  </div>
                  <div className="db-kpi-mini-lbl">Agendadas</div>
                </div>
                <div className="db-kpi-mini">
                  <div className="db-kpi-mini-val" style={{ color: 'var(--green)' }}>
                    {t.re}
                  </div>
                  <div className="db-kpi-mini-lbl">Realizadas</div>
                </div>
                <div className="db-kpi-mini">
                  <div className="db-kpi-mini-val" style={{ color: 'var(--purple)' }}>
                    {t.cl}
                  </div>
                  <div className="db-kpi-mini-lbl">Closer</div>
                </div>
                <div className="db-kpi-mini">
                  <div className="db-kpi-mini-val" style={{ color: 'var(--amber)' }}>
                    {t.vn}
                  </div>
                  <div className="db-kpi-mini-lbl">Vendas</div>
                </div>
              </div>
            </div>
          </section>

          <div className="db-section-title">Indicadores do período</div>
          <div className="db-stats-grid">
            {STATS.map((s) => {
              const val = s.money ? (t as Record<string, number>)[s.key] as number : (t as Record<string, number>)[s.key]
              const metaVal = metas[metaKeys[STATS.indexOf(s)] as keyof MetasConfig] as number | undefined
              const metaP =
                metaVal != null && metaVal > 0 ? metaPctParts(Number(val), metaVal) : null
              const display = s.money ? fmt(val) : String(val)
              return (
                <div key={s.key} className={`stat-card ${s.col}`}>
                  <div className="glow-dot" />
                  <div className="stat-icon" aria-hidden>
                    <s.Icon {...icLg} />
                  </div>
                  <div className={`stat-value${s.col === 'orange' ? ' v-orange' : ''}`}>
                    {display}
                  </div>
                  <div className="stat-label">{s.label}</div>
                  {metaVal != null && (
                    <div className="stat-sub" style={{ marginTop: 4 }}>
                      <span style={{ color: 'var(--text3)', fontSize: 11 }}>
                        Meta: {s.money ? fmt(metaVal) : metaVal}
                      </span>
                      {metaP != null && (
                        <div className="prog-wrap">
                          <div className="prog-label">
                            <span>Progresso</span>
                            <span title={metaP.superacaoPct != null ? metaP.labelLong : undefined}>{metaP.labelShort}</span>
                          </div>
                          <div className="prog-bar">
                            <div
                              className={`prog-fill ${metaP.rawPct >= 100 ? 'green' : metaP.rawPct >= 70 ? 'orange' : metaP.rawPct >= 40 ? 'amber' : 'red'}`}
                              style={{ width: `${metaP.barPct}%` }}
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
            <>
              <div className="db-section-title" style={{ marginTop: 8 }}>
                Projeções
              </div>
              <div className="db-proj-grid mb">
              {(() => {
                const totalDays = daysBetweenInclusive(periodStart, periodEnd)
                const todayStr = today()
                const elapsedDays = Math.max(1, Math.min(daysBetweenInclusive(periodStart, todayStr), totalDays))
                const factor = totalDays / elapsedDays

                const projItems: Array<{
                  key: string
                  title: string
                  TitleIcon: LucideIcon
                  color: string
                  tipos: string[]
                  money?: boolean
                  field?: 'valor' | 'cashCollected'
                }> = [
                  {
                    key: 'ag',
                    title: 'Projeção — Reuniões agendadas',
                    TitleIcon: CalendarClock,
                    color: 'var(--accent)',
                    tipos: ['reuniao_agendada']
                  },
                  {
                    key: 're',
                    title: 'Projeção — Reuniões realizadas',
                    TitleIcon: CheckCircle2,
                    color: '#22c55e',
                    tipos: ['reuniao_realizada']
                  },
                  {
                    key: 'cl',
                    title: 'Projeção — Reuniões closer',
                    TitleIcon: Handshake,
                    color: '#a855f7',
                    tipos: ['reuniao_closer']
                  },
                  {
                    key: 'vn',
                    title: 'Projeção — Vendas',
                    TitleIcon: BriefcaseBusiness,
                    color: '#fbbf24',
                    tipos: ['venda']
                  },
                  {
                    key: 'ft',
                    title: 'Projeção — Faturamento',
                    TitleIcon: Wallet,
                    color: '#22c55e',
                    tipos: ['venda'],
                    money: true,
                    field: 'valor'
                  },
                  {
                    key: 'ca',
                    title: 'Projeção — Cash Collected',
                    TitleIcon: Banknote,
                    color: '#06b6d4',
                    tipos: ['venda'],
                    money: true,
                    field: 'cashCollected'
                  }
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
                    pi.key === 'ag'
                      ? 'meta_reunioes_agendadas'
                      : pi.key === 're'
                        ? 'meta_reunioes_realizadas'
                        : pi.key === 'cl'
                          ? 'meta_reunioes_closer'
                          : pi.key === 'vn'
                            ? 'meta_vendas'
                            : pi.key === 'ft'
                              ? 'meta_faturamento'
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
                      TitleIcon={pi.TitleIcon}
                      color={pi.color}
                      realPoints={realPoints}
                      projectedCumulative={projectedCumulative}
                      allDates={allDates}
                      projected={projected}
                      fmtVal={fmtVal}
                      fmtShort={fmtShort}
                      metaVal={metaVal}
                      money={pi.money}
                    />
                  )
                })
              })()}
            </div>
            </>
          )}

          {/* Quadro de progresso de todas as metas */}
          <div className="db-card mb">
            <div className="db-card-header">
              <span className="db-card-title">
                <Target size={14} strokeWidth={1.65} className="db-card-title-ic" />
                Progresso de metas
              </span>
            </div>
            <div className="db-card-body">
              {metaKeys.length === 0 ? (
                <div className="db-empty">
                  <p>Sem metas configuradas</p>
                </div>
              ) : (
                <div className="db-meta-list">
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
                    const mp = metaPctParts(Number(atual), alvo)
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
                      <div key={k} className="db-meta-item">
                        <div className="db-meta-head">
                          <span className="db-meta-label">{label}</span>
                          <span className="db-meta-vals">
                            {isMoney ? fmt(atual) : atual} / {isMoney ? fmt(alvo) : alvo}
                            <br />
                            <span title={mp.superacaoPct != null ? mp.labelLong : undefined}>{mp.labelShort}</span>
                          </span>
                        </div>
                        <div className="db-prog-track">
                          <div
                            className={`prog-fill ${mp.rawPct >= 100 ? 'green' : mp.rawPct >= 70 ? 'orange' : mp.rawPct >= 40 ? 'amber' : 'red'}`}
                            style={{ width: `${mp.barPct}%` }}
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
          <div className="db-card mb">
            <div className="db-card-header">
              <span className="db-card-title">
                <Package size={14} strokeWidth={1.65} className="db-card-title-ic" />
                Produtos mais vendidos
              </span>
            </div>
            <div className="db-card-body">
              {(() => {
                const vendas = recs.filter((r) => r.tipo === 'venda')
                if (!vendas.length) {
                  return (
                    <div className="db-empty">
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
                    <div className="db-empty">
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
                  <div className="db-prod-bento">
                    <div className="db-donut-wrap">
                    <svg
                      viewBox="0 0 180 180"
                      width={176}
                      height={176}
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
                    </div>
                    <div className="db-prod-list">
                      {slices.map((s, i) => {
                        const tagCl = ['db-tag--orange', 'db-tag--green', 'db-tag--purple', 'db-tag--amber'][i % 4]
                        return (
                          <div key={s.id} className="db-list-row" style={{ marginBottom: 0 }}>
                            <span className={`db-tag ${tagCl}`}>{s.pct}%</span>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: 700, lineHeight: 1.3, fontSize: 13 }}>{s.nome}</div>
                              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.45, marginTop: 4 }}>
                                {s.qtd} unid. · {s.vendas} {s.vendas === 1 ? 'venda' : 'vendas'} · {fmt(s.total)}
                              </div>
                            </div>
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 99,
                                background: s.color,
                                flexShrink: 0,
                                boxShadow: `0 0 10px ${s.color}`
                              }}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Atividade diária por data, separando agendadas, realizadas e vendas */}
          <div className="db-card mb">
            <div className="db-card-header">
              <span className="db-card-title">
                <Activity size={14} strokeWidth={1.65} className="db-card-title-ic" />
                Atividade diária
              </span>
              <div className="db-legend">
                <span className="db-legend-item">
                  <span className="db-legend-dot db-legend-dot--ag" /> Agendadas
                </span>
                <span className="db-legend-item">
                  <span className="db-legend-dot db-legend-dot--re" /> Realizadas
                </span>
                <span className="db-legend-item">
                  <span className="db-legend-dot db-legend-dot--vn" /> Vendas
                </span>
              </div>
            </div>
            <div className="db-card-body">
              {(() => {
                if (!recs.length) {
                  return (
                    <div className="db-empty">
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
                  <div className="db-activity-wrap">
                    <div className="db-activity-chart">
                      {rows.map(([d, v]) => {
                        const label = d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : ''
                        const hAg = (v.ag / maxVal) * 100
                        const hRe = (v.re / maxVal) * 100
                        const hVn = (v.vn / maxVal) * 100
                        return (
                          <div key={d} className="db-activity-col">
                            <div className="db-activity-bars">
                              <div
                                className="db-activity-bar db-activity-bar--ag"
                                style={{ height: `${hAg}%` }}
                                title={`${v.ag} agendadas`}
                              />
                              <div
                                className="db-activity-bar db-activity-bar--re"
                                style={{ height: `${hRe}%` }}
                                title={`${v.re} realizadas`}
                              />
                              <div
                                className="db-activity-bar db-activity-bar--vn"
                                style={{ height: `${hVn}%` }}
                                title={`${v.vn} vendas`}
                              />
                            </div>
                            <span className="db-activity-label">{label}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Top SDRs, Closers e desconto por closer */}
          <div className="db-split db-split--3col mb">
            <div className="db-card">
              <div className="db-card-header">
                <span className="db-card-title">
                  <Trophy size={14} strokeWidth={1.65} className="db-card-title-ic" />
                  Top SDRs — Realizadas
                </span>
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
                    <div className="db-empty">
                      <p>Sem dados de SDR no período</p>
                    </div>
                  )
                }
                return (
                  <div className="db-rank-list">
                    {rows.map((u, idx) => (
                      <div key={u.id} className={`db-rank-row${idx === 0 ? ' db-rank-row--lead' : ''}`}>
                        <span className={`db-rank-badge ${dbRankBadgeMod(idx)}`}>{idx + 1}</span>
                        <div className="db-rank-main">
                          <div className="db-rank-name">{u.nome}</div>
                          {(() => {
                            const noShowPct = u.ag > 0 ? Math.round(((u.ag - u.re) / u.ag) * 100) : null
                            return (
                              <div className="db-rank-meta">
                                {u.re} realizadas · {u.ag} agendadas
                                {noShowPct != null && <> · {noShowPct}% no-show</>}
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

            <div className="db-card">
              <div className="db-card-header">
                <span className="db-card-title">
                  <Award size={14} strokeWidth={1.65} className="db-card-title-ic" />
                  Top Closers
                </span>
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
                    <div className="db-empty">
                      <p>Sem dados de Closers no período</p>
                    </div>
                  )
                }
                return (
                  <div className="db-rank-list">
                    {rows.map((u, idx) => (
                      <div key={u.id} className={`db-rank-row${idx === 0 ? ' db-rank-row--lead' : ''}`}>
                        <span className={`db-rank-badge ${dbRankBadgeMod(idx)}`}>{idx + 1}</span>
                        <div className="db-rank-main">
                          <div className="db-rank-name">{u.nome}</div>
                          {(() => {
                            const convPct =
                              u.cl > 0 ? Math.round((u.vn / u.cl) * 100) : null
                            const ticket = u.vn > 0 ? u.ft / u.vn : 0
                            return (
                              <div className="db-rank-meta">
                                {u.vn} vendas · {u.cl} reuniões · {convPct != null ? `${convPct}% conv.` : '—'}
                                {u.vn > 0 && <> · TM: {fmt(ticket)}</>}
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

            <div className="db-card">
              <div className="db-card-header">
                <span className="db-card-title">
                  <Percent size={14} strokeWidth={1.65} className="db-card-title-ic" />
                  Desconto por closer
                </span>
              </div>
              {(() => {
                const byUser = new Map<
                  string,
                  { id: string; nome: string; cargo: string; dc: number; vn: number }
                >()
                for (const r of recs) {
                  if (r.tipo !== 'venda') continue
                  const id = r.userId || r.userName
                  if (!id) continue
                  if (!byUser.has(id)) {
                    byUser.set(id, {
                      id,
                      nome: r.userName || '—',
                      cargo: r.userCargo || '',
                      dc: 0,
                      vn: 0
                    })
                  }
                  const u = byUser.get(id)!
                  u.vn += 1
                  u.dc += r.descontoCloser ?? 0
                }
                const rows = Array.from(byUser.values())
                  .filter((u) => (u.cargo || '').toLowerCase() === 'closer' && (u.dc > 0 || u.vn > 0))
                  .sort((a, b) => (b.dc - a.dc) || (b.vn - a.vn))
                  .slice(0, 5)
                if (!rows.length) {
                  return (
                    <div className="db-empty">
                      <p>Sem desconto registrado no período</p>
                    </div>
                  )
                }
                return (
                  <div className="db-rank-list">
                    {rows.map((u, idx) => (
                      <div key={u.id} className={`db-rank-row${idx === 0 ? ' db-rank-row--lead' : ''}`}>
                        <span className={`db-rank-badge ${dbRankBadgeMod(idx)}`}>{idx + 1}</span>
                        <div className="db-rank-main">
                          <div className="db-rank-name">{u.nome}</div>
                          <div className="db-rank-meta">
                            {fmt(u.dc)} em desconto · {u.vn} {u.vn === 1 ? 'venda' : 'vendas'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>

          <div className="db-card mb" style={{ marginTop: 8 }}>
            <div className="db-card-header">
              <span className="db-card-title">
                <ClipboardList size={14} strokeWidth={1.65} className="db-card-title-ic" />
                Registros recentes
              </span>
            </div>
            <div className="db-card-body" style={{ padding: '8px 4px 16px' }}>
              {recs.length === 0 ? (
                <div className="db-empty">
                  <p>Sem registros no período</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {recs.slice(0, 8).map((r) => {
                    const tipoLabel =
                      r.tipo === 'reuniao_agendada'
                        ? 'Agendada'
                        : r.tipo === 'reuniao_realizada'
                          ? 'Realizada'
                          : r.tipo === 'reuniao_closer'
                            ? 'Closer'
                            : 'Venda'
                    const tagCl =
                      r.tipo === 'reuniao_agendada'
                        ? 'db-tag--orange'
                        : r.tipo === 'reuniao_realizada'
                          ? 'db-tag--green'
                          : r.tipo === 'reuniao_closer'
                            ? 'db-tag--purple'
                            : 'db-tag--amber'
                    const RegIcon: LucideIcon =
                      r.tipo === 'reuniao_agendada'
                        ? CalendarPlus
                        : r.tipo === 'reuniao_realizada'
                          ? CalendarCheck
                          : r.tipo === 'reuniao_closer'
                            ? Handshake
                            : CircleDollarSign
                    return (
                      <div key={r.id} className="db-list-row">
                        <div className="db-reg-icon" aria-hidden>
                          <RegIcon size={18} strokeWidth={1.65} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 14, fontWeight: 700 }}>{r.userName}</span>
                            <span className={`db-tag ${tagCl}`} style={{ fontSize: 9, padding: '3px 8px' }}>
                              {tipoLabel}
                            </span>
                          </div>
                          {r.tipo === 'venda' && r.nomeCliente ? (
                            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{r.nomeCliente}</div>
                          ) : null}
                        </div>
                        {r.tipo === 'venda' && <span className="db-reg-val">{fmt(r.valor)}</span>}
                        <span className="db-reg-date">
                          {r.data ? `${r.data.slice(8, 10)}/${r.data.slice(5, 7)}/${r.data.slice(0, 4)}` : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
