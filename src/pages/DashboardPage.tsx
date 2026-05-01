import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Banknote,
  BriefcaseBusiness,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  ChevronDown,
  Handshake,
  Package,
  Target,
  TrendingDown,
  TrendingUp,
  UserX,
  Wallet
} from 'lucide-react'
import {
  getRegistrosByRange,
  getMetasFirestoreDoc,
  resolveMetasParaMes,
  getProdutos,
  getLeadsSdrRangeBundle,
  listUsers
} from '../firebase/firestore'
import type { MetasConfig, MetasFirestoreDoc, RegistroRow, ProdutoRow } from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { useAppStore } from '../store/useAppStore'
import { contaParaComissao } from '../lib/registroComissao'
import { DailyActivitySplineChart } from '../components/dashboard/DailyActivitySplineChart'
import { metaPctParts } from '../utils/metaProgress'
import { smoothAreaUnderPath, smoothPathThrough } from '../lib/smooth-chart-path'
import { fetchMetaLeadsCountForRange } from '../lib/meta-ads'

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function isoLastDayOfMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
}

function isoMinDate(a: string, b: string): string {
  return a <= b ? a : b
}

function calendarDaysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function daysInclusiveIso(startIso: string, endIso: string): number {
  const s = new Date(`${startIso}T12:00:00`).getTime()
  const e = new Date(`${endIso}T12:00:00`).getTime()
  return Math.floor((e - s) / 86400000) + 1
}

/** Título do mês para UI (ex.: «Abril de 2026»). */
function monthTitlePtBr(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const raw = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function paceFractionForMonth(ym: string, td: string): { fraction: number; hint: string } {
  const t0 = `${ym}-01`
  const tLast = isoLastDayOfMonth(ym)
  if (t0 > td) {
    return { fraction: 0, hint: 'Mês futuro em relação a hoje — o ritmo começa no dia 1 do mês.' }
  }
  if (tLast < td) {
    return { fraction: 1, hint: 'Mês já terminou — ritmo de 100% da meta de referência.' }
  }
  const dim = calendarDaysInMonth(ym)
  const elapsed = daysInclusiveIso(t0, td)
  const fraction = Math.min(1, elapsed / dim)
  const dNum = parseInt(td.slice(8, 10), 10)
  return {
    fraction,
    hint: `Proporção linear pelo calendário: ${elapsed} de ${dim} dias (${dNum}/${dim}).`
  }
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

function dpRange(dp: Dp, customStart?: string, customEnd?: string): { start: string; end: string } {
  if (dp === 'hoje') return { start: today(), end: today() }
  if (dp === 'semana') return wRange()
  if (dp === 'mes') return mRange()
  if (dp === 'custom' && customStart && customEnd) return { start: customStart, end: customEnd }
  return mRange()
}

function totals(recs: RegistroRow[]) {
  const v = recs.filter(contaParaComissao)
  const vendas = v.filter((r) => r.tipo === 'venda')
  return {
    ag: v.filter((r) => r.tipo === 'reuniao_agendada').length,
    re: v.filter((r) => r.tipo === 'reuniao_realizada').length,
    ns: v.filter((r) => r.tipo === 'reuniao_no_show').length,
    cl: v.filter((r) => r.tipo === 'reuniao_closer').length,
    vn: vendas.length,
    ft: vendas.reduce((s, r) => s + (r.valor || 0), 0),
    ca: vendas.reduce((s, r) => s + (r.cashCollected || 0), 0),
    dc: vendas.reduce((s, r) => s + (r.descontoCloser ?? 0), 0)
  }
}

function fmt(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

/** Símbolo da moeda menor + valor em destaque (layout tipo KPI SaaS). */
function fmtCurrencyParts(v: number): { sym: string; num: string } {
  const parts = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).formatToParts(Number(v) || 0)
  let sym = 'R$'
  let num = ''
  for (const p of parts) {
    if (p.type === 'currency') sym = p.value
    else num += p.value
  }
  return { sym, num: num.trim() }
}

function fmtCountFormatted(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(Math.round(n))
}

function fmtPct(p: number | null): string {
  if (p == null || Number.isNaN(p)) return '—'
  return `${p.toFixed(1)}%`
}

type RecentSortKey = 'titulo' | 'userName' | 'tipo' | 'valor' | 'data'

function tipoLabelRecent(r: RegistroRow): string {
  switch (r.tipo) {
    case 'reuniao_agendada':
      return 'Agendada'
    case 'reuniao_realizada':
      return 'Realizada'
    case 'reuniao_closer':
      return 'Closer'
    case 'reuniao_no_show':
      return 'No show'
    case 'venda':
      return 'Venda'
    default:
      return r.tipo
  }
}

function primaryTitleRecent(r: RegistroRow): string {
  if (r.tipo === 'venda' && r.nomeCliente?.trim()) return r.nomeCliente.trim()
  return tipoLabelRecent(r)
}

function subtitleRecent(r: RegistroRow): string {
  if (r.tipo === 'venda' && r.nomeCliente?.trim()) return r.userName
  const cargo = (r.userCargo || '').trim()
  return cargo && cargo !== '—' ? `${r.userName} · ${cargo}` : r.userName
}

function userInitials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean)
  if (p.length === 0) return '?'
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase()
  return `${p[0][0] ?? ''}${p[p.length - 1][0] ?? ''}`.toUpperCase() || '?'
}

function hueFromString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
  return h
}

function formatRecentDate(iso: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  } catch {
    return iso
  }
}

function RecentSortTh({
  label,
  sortKey,
  current,
  onToggle
}: {
  label: string
  sortKey: RecentSortKey
  current: { key: RecentSortKey; dir: 'asc' | 'desc' }
  onToggle: (k: RecentSortKey) => void
}) {
  const active = current.key === sortKey
  return (
    <th scope="col" className="db-recent-th">
      <button
        type="button"
        className={`db-recent-sort-btn${active ? ' db-recent-sort-btn--active' : ''}`}
        onClick={() => onToggle(sortKey)}
        aria-sort={
          active ? (current.dir === 'asc' ? 'ascending' : 'descending') : 'none'
        }
      >
        <span>{label}</span>
        <ChevronDown
          size={14}
          strokeWidth={2}
          className="db-recent-sort-btn-ic"
          aria-hidden
          style={{
            transform: active && current.dir === 'asc' ? 'rotate(180deg)' : undefined
          }}
        />
      </button>
    </th>
  )
}

/** Filtro SDR/Admin para série de leads no gráfico de atividade. */
function isSdrFunnelRole(cargo: string | undefined): boolean {
  const c = String(cargo ?? '').trim().toLowerCase()
  return c === 'sdr' || c === 'admin'
}

/**
 * KPIs derivados: ticket médio (fat ÷ vendas); conv. vendas (vendas ÷ realizadas).
 * Taxa de show = realizadas ÷ agendadas; no-show = no-show ÷ agendadas; sem desfecho = resto (as três somam 100%).
 * Meta → agendadas = reuniões agendadas (CRM) ÷ leads do período na Meta Ads (conta/modo guardados em Meta Ads).
 */
function derivedRates(recs: RegistroRow[], metaLeadsNoPeriodo: number | null) {
  const t = totals(recs)
  const ticketMedio = t.vn > 0 ? t.ft / t.vn : null
  const leadParaReuniao =
    metaLeadsNoPeriodo != null && metaLeadsNoPeriodo > 0 ? (t.ag / metaLeadsNoPeriodo) * 100 : null
  const taxaShow = t.ag > 0 ? (t.re / t.ag) * 100 : null
  const taxaNoShow = t.ag > 0 ? (t.ns / t.ag) * 100 : null
  const taxaSemDesfecho = t.ag > 0 ? (Math.max(0, t.ag - t.re - t.ns) / t.ag) * 100 : null
  const convVendas = t.re > 0 ? (t.vn / t.re) * 100 : null
  return { ticketMedio, leadParaReuniao, taxaShow, taxaNoShow, taxaSemDesfecho, convVendas }
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
    if (!contaParaComissao(r) || r.tipo !== 'venda' || !r.data) continue
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

const DASHBOARD_META_KEYS: (keyof MetasConfig)[] = [
  'meta_reunioes_agendadas',
  'meta_reunioes_realizadas',
  'meta_reunioes_closer',
  'meta_vendas',
  'meta_faturamento',
  'meta_cash'
]

export function DashboardPage() {
  const { metaConnectedAt } = useAppStore()
  const [dp, setDp] = useState<Dp>('mes')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recs, setRecs] = useState<RegistroRow[]>([])
  const [metasDoc, setMetasDoc] = useState<MetasFirestoreDoc>({})
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [produtos, setProdutos] = useState<ProdutoRow[]>([])
  const [leadsByDay, setLeadsByDay] = useState<Record<string, number>>({})
  const [metaLeadsCount, setMetaLeadsCount] = useState<number | null>(null)
  /** Registos do mês da meta (dia 1 → hoje ou fim do mês), para ritmo vs metas mensais. */
  const [paceMonthRecs, setPaceMonthRecs] = useState<RegistroRow[]>([])
  const [recentSort, setRecentSort] = useState<{ key: RecentSortKey; dir: 'asc' | 'desc' }>({
    key: 'data',
    dir: 'desc'
  })

  const toggleRecentSort = useCallback((key: RecentSortKey) => {
    setRecentSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'data' || key === 'valor' ? 'desc' : 'asc' }
    )
  }, [])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { start, end } = dpRange(dp, customStart, customEnd)
      setPeriodStart(start)
      setPeriodEnd(end)
      const paceYm = start.slice(0, 7)
      const paceMonthStart = `${paceYm}-01`
      const paceMonthLast = isoLastDayOfMonth(paceYm)
      const td = today()
      const paceNeed =
        paceMonthStart <= td ? getRegistrosByRange(paceMonthStart, isoMinDate(td, paceMonthLast)) : Promise.resolve([] as RegistroRow[])
      const [rows, mtDoc, prods, users, paceRows] = await Promise.all([
        getRegistrosByRange(start, end),
        getMetasFirestoreDoc(),
        getProdutos(),
        listUsers(),
        paceNeed
      ])
      const funnelIds = new Set(users.filter((u) => isSdrFunnelRole(u.cargo)).map((u) => u.id))
      const leadsBundle = await getLeadsSdrRangeBundle(start, end, {
        onlyUserIds: funnelIds.size > 0 ? funnelIds : undefined
      })
      const metaLeads = await fetchMetaLeadsCountForRange(start, end).catch(() => null)
      setRecs(rows)
      setMetasDoc(mtDoc)
      setProdutos(prods)
      setLeadsByDay(leadsBundle.byDay)
      setMetaLeadsCount(metaLeads)
      setPaceMonthRecs(paceRows)
    } catch (e) {
      setPaceMonthRecs([])
      setError(formatFirebaseOrUnknownError(e) || 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [dp, customStart, customEnd, metaConnectedAt])

  const metas = useMemo(
    () => (periodStart ? resolveMetasParaMes(periodStart.slice(0, 7), metasDoc) : {}),
    [periodStart, metasDoc]
  )

  const t = totals(recs)

  const paceMonthInfo = useMemo(() => {
    if (!periodStart) return null
    const ym = periodStart.slice(0, 7)
    const { fraction, hint } = paceFractionForMonth(ym, today())
    return { ym, fraction, hint }
  }, [periodStart])

  const paceMetaTable = useMemo(() => {
    if (!paceMonthInfo) return []
    const { fraction } = paceMonthInfo
    const tMtd = totals(paceMonthRecs)
    return STATS.map((s, i) => {
      const mk = DASHBOARD_META_KEYS[i]
      const metaVal = metas[mk] as number | undefined
      const actual = (tMtd as Record<string, number>)[s.key] as number
      const hasMeta = metaVal != null && metaVal > 0
      const expectedRaw = hasMeta ? (metaVal as number) * fraction : null
      const vsPct =
        expectedRaw != null && expectedRaw > 1e-9 ? (Number(actual) / expectedRaw) * 100 : null
      const expectedLabel =
        expectedRaw == null ? '—' : s.money ? fmt(expectedRaw) : fmtCountFormatted(Math.round(expectedRaw))
      const projectedRaw = fraction > 1e-9 ? Number(actual) / fraction : null
      const projectedLabel =
        projectedRaw == null
          ? '—'
          : s.money
            ? fmt(projectedRaw)
            : fmtCountFormatted(Math.round(projectedRaw))
      return {
        key: s.key,
        label: s.label,
        col: s.col,
        money: !!s.money,
        Icon: s.Icon,
        metaVal,
        actual,
        hasMeta,
        expectedLabel,
        vsPct,
        projectedLabel
      }
    })
  }, [paceMonthInfo, paceMonthRecs, metas])

  const sparkFt = useMemo(
    () => dailyFaturamentoSpark(recs, periodStart, periodEnd),
    [recs, periodStart, periodEnd]
  )

  const recentSorted = useMemo(() => {
    const copy = [...recs]
    const { key, dir } = recentSort
    const m = dir === 'asc' ? 1 : -1
    copy.sort((a, b) => {
      switch (key) {
        case 'data':
          return m * a.data.localeCompare(b.data)
        case 'valor':
          return m * ((a.valor || 0) - (b.valor || 0))
        case 'userName':
          return m * a.userName.localeCompare(b.userName, 'pt-BR')
        case 'tipo':
          return m * a.tipo.localeCompare(b.tipo)
        case 'titulo':
          return m * primaryTitleRecent(a).localeCompare(primaryTitleRecent(b), 'pt-BR')
        default:
          return 0
      }
    })
    return copy.slice(0, 14)
  }, [recs, recentSort])

  const rates = useMemo(() => derivedRates(recs, metaLeadsCount), [recs, metaLeadsCount])

  const activityDaily = useMemo(() => {
    if (!periodStart || !periodEnd) return null
    const days: string[] = []
    const d = new Date(periodStart + 'T12:00:00')
    const endD = new Date(periodEnd + 'T12:00:00')
    while (d <= endD) {
      days.push(d.toISOString().split('T')[0])
      d.setDate(d.getDate() + 1)
    }
    const map = new Map<string, { ag: number; re: number; vn: number }>()
    for (const r of recs) {
      if (!contaParaComissao(r)) continue
      const dt = r.data || ''
      if (!dt) continue
      if (!map.has(dt)) map.set(dt, { ag: 0, re: 0, vn: 0 })
      const o = map.get(dt)!
      if (r.tipo === 'reuniao_agendada') o.ag += 1
      else if (r.tipo === 'reuniao_realizada') o.re += 1
      else if (r.tipo === 'venda') o.vn += 1
    }
    return {
      dates: days,
      leads: days.map((dt) => leadsByDay[dt] ?? 0),
      ag: days.map((dt) => map.get(dt)?.ag ?? 0),
      re: days.map((dt) => map.get(dt)?.re ?? 0),
      vn: days.map((dt) => map.get(dt)?.vn ?? 0)
    }
  }, [recs, periodStart, periodEnd, leadsByDay])

  return (
    <div className="content db-page db-page--fin">
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
          <section className="db-bento db-bento--hero db-bento--hero-fin">
            <div className="db-card db-card--hero db-card--fin-hero">
              <div className="db-fin-hero-head">
                <div className="db-card-label db-fin-hero-eyebrow">Faturamento no período</div>
                <div className="db-hero-value db-hero-value--fin">{fmt(t.ft)}</div>
              </div>
              <div className="db-fin-metrics" role="list">
                <div
                  className="db-fin-metric db-fin-metric--orange"
                  role="listitem"
                  title="Ticket médio = faturamento total do período ÷ número de vendas no período (só vendas com valor contam no numerador do faturamento)."
                >
                  <div className="db-fin-metric-val" style={{ color: 'var(--orange)' }}>
                    {rates.ticketMedio != null ? fmt(rates.ticketMedio) : '—'}
                  </div>
                  <div className="db-fin-metric-lbl">Ticket médio</div>
                </div>
                <div
                  className="db-fin-metric db-fin-metric--accent"
                  role="listitem"
                  title={
                    metaLeadsCount != null && metaLeadsCount > 0
                      ? `Reuniões agendadas no CRM (${t.ag}) ÷ leads da Meta Ads no período (${metaLeadsCount}). Conta e modo de conversão vêm da página Meta Ads.`
                      : 'Conecte o token e escolha a conta em Meta Ads para obter o volume de leads do período; sem isso não há denominador Meta.'
                  }
                >
                  <div className="db-fin-metric-val" style={{ color: 'var(--accent2)' }}>
                    {fmtPct(rates.leadParaReuniao)}
                  </div>
                  <div className="db-fin-metric-lbl">Agend. / leads Meta</div>
                </div>
                <div
                  className="db-fin-metric db-fin-metric--green"
                  role="listitem"
                  title="Taxa de show = reuniões realizadas ÷ reuniões agendadas. Soma com no-show e «sem desfecho» = 100% das agendadas."
                >
                  <div className="db-fin-metric-val" style={{ color: 'var(--green)' }}>
                    {fmtPct(rates.taxaShow)}
                  </div>
                  <div className="db-fin-metric-lbl">Taxa de show</div>
                </div>
                <div
                  className="db-fin-metric db-fin-metric--red"
                  role="listitem"
                  title="Taxa de no-show = registos no-show ÷ reuniões agendadas. O que não está em realizada nem no-show fica em «sem desfecho»."
                >
                  <div className="db-fin-metric-val" style={{ color: 'var(--red)' }}>
                    {fmtPct(rates.taxaNoShow)}
                  </div>
                  <div className="db-fin-metric-lbl">Taxa de no-show</div>
                </div>
                <div
                  className="db-fin-metric db-fin-metric--slate"
                  role="listitem"
                  title="Reuniões agendadas que ainda não têm registo de realizada nem de no-show (÷ agendadas). Com show e no-show, soma 100%."
                >
                  <div className="db-fin-metric-val" style={{ color: 'var(--text2)' }}>
                    {fmtPct(rates.taxaSemDesfecho)}
                  </div>
                  <div className="db-fin-metric-lbl">Sem desfecho</div>
                </div>
                <div
                  className="db-fin-metric db-fin-metric--amber"
                  role="listitem"
                  title="Conv. vendas = vendas ÷ reuniões realizadas no período (quantas realizadas viraram venda)."
                >
                  <div className="db-fin-metric-val" style={{ color: 'var(--amber)' }}>
                    {fmtPct(rates.convVendas)}
                  </div>
                  <div className="db-fin-metric-lbl">Conv. vendas (p/ realiz.)</div>
                </div>
              </div>
              <div className="db-spark db-spark--fin">
                <RevenueSparkline points={sparkFt} />
              </div>
            </div>
          </section>

          <div className="db-main-stack">
          <div className="db-section-block">
          <div className="db-section-title">Indicadores do período</div>
          <div className="db-stats-grid">
            {STATS.map((s) => {
              const val = s.money ? (t as Record<string, number>)[s.key] as number : (t as Record<string, number>)[s.key]
              const metaVal = metas[DASHBOARD_META_KEYS[STATS.indexOf(s)] as keyof MetasConfig] as number | undefined
              const metaP =
                metaVal != null && metaVal > 0 ? metaPctParts(Number(val), metaVal) : null
              const cur = fmtCurrencyParts(Number(val))
              const pillClass =
                metaP == null
                  ? 'db-stat-pill db-stat-pill--neutral'
                  : metaP.rawPct >= 100
                    ? 'db-stat-pill db-stat-pill--up'
                    : metaP.rawPct >= 70
                      ? 'db-stat-pill db-stat-pill--mid'
                      : 'db-stat-pill db-stat-pill--down'
              return (
                <div key={s.key} className={`db-stat-card db-stat-card--${s.col}`}>
                  <div className="db-stat-card-inner">
                    <div className="db-stat-ic-wrap" aria-hidden>
                      <s.Icon size={20} strokeWidth={1.65} />
                    </div>
                    <div className="db-stat-body">
                      <div className="db-stat-label">{s.label}</div>
                      <div
                        className="db-stat-value-row"
                        title={s.money ? fmt(Number(val)) : fmtCountFormatted(Number(val))}
                      >
                        {s.money ? (
                          <>
                            <span className="db-stat-currency">{cur.sym}</span>
                            <span className="db-stat-value-num">{cur.num}</span>
                          </>
                        ) : (
                          <span className="db-stat-value-num">{fmtCountFormatted(Number(val))}</span>
                        )}
                      </div>
                      {metaVal != null && metaVal > 0 && (
                        <div
                          className="db-stat-meta-line"
                          title={`Meta: ${s.money ? fmt(metaVal) : String(metaVal)}`}
                        >
                          Meta {s.money ? fmt(metaVal) : metaVal}
                        </div>
                      )}
                    </div>
                    <div className="db-stat-trend">
                      {metaP != null ? (
                        <span
                          className={pillClass}
                          title={metaP.superacaoPct != null ? metaP.labelLong : `Progresso: ${metaP.labelShort}`}
                        >
                          {metaP.rawPct >= 100 ? (
                            <TrendingUp size={14} strokeWidth={2.25} className="db-stat-pill-ic" aria-hidden />
                          ) : (
                            <TrendingDown size={14} strokeWidth={2.25} className="db-stat-pill-ic" aria-hidden />
                          )}
                          <span className="db-stat-pill-txt">{metaP.labelShort}</span>
                        </span>
                      ) : (
                        <span
                          className="db-stat-pill db-stat-pill--neutral"
                          title={metaVal != null && metaVal > 0 ? 'Meta sem percentual válido' : 'Sem meta definida'}
                        >
                          <span className="db-stat-pill-txt">
                            {metaVal != null && metaVal > 0 ? '—' : 'Sem meta'}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {paceMonthInfo && (
            <div className="db-card db-pace-card">
              <div className="db-card-header db-pace-card-head">
                <span className="db-card-title">
                  <Target size={14} strokeWidth={1.65} className="db-card-title-ic" aria-hidden />
                  Ritmo das metas (mês calendário)
                </span>
              </div>
              <div className="db-card-body db-pace-card-body">
                <p className="db-pace-intro">
                  <strong>{monthTitlePtBr(paceMonthInfo.ym)}</strong>
                  <span className="db-pace-intro-sep">·</span>
                  {paceMonthInfo.hint}
                  <span className="db-pace-intro-sep">·</span>
                  «Deveria até agora» = meta do mês × proporção de dias corridos no mês (ritmo linear para bater a meta).
                  <span className="db-pace-intro-sep">·</span>
                  «Proj. fim do mês» = extrapolação linear do real acumulado (mantendo o ritmo até hoje até ao último dia do mês).
                </p>
                <div className="db-pace-table-wrap">
                  <table className="db-pace-table">
                    <thead>
                      <tr>
                        <th scope="col">Métrica</th>
                        <th scope="col">Meta do mês</th>
                        <th scope="col">Deveria até agora</th>
                        <th scope="col">Real acumulado</th>
                        <th scope="col">vs ritmo</th>
                        <th scope="col">Proj. fim do mês</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paceMetaTable.map((row) => {
                        const RowIcon = row.Icon
                        const metaDisp =
                          row.hasMeta && row.metaVal != null
                            ? row.money
                              ? fmt(row.metaVal)
                              : fmtCountFormatted(row.metaVal)
                            : '—'
                        const actualDisp = row.money ? fmt(row.actual) : fmtCountFormatted(row.actual)
                        const vs =
                          row.vsPct != null && row.hasMeta ? (
                            <span
                              className={
                                row.vsPct >= 100
                                  ? 'db-pace-pct db-pace-pct--up'
                                  : row.vsPct >= 70
                                    ? 'db-pace-pct db-pace-pct--mid'
                                    : 'db-pace-pct db-pace-pct--down'
                              }
                              title="Real acumulado no mês ÷ valor esperado pelo calendário até hoje."
                            >
                              {row.vsPct.toFixed(0)}%
                            </span>
                          ) : (
                            <span className="db-pace-pct db-pace-pct--na">—</span>
                          )
                        return (
                          <tr key={row.key}>
                            <td>
                              <span className={`db-pace-metric db-pace-metric--${row.col}`}>
                                <RowIcon size={16} strokeWidth={1.65} aria-hidden />
                                {row.label}
                              </span>
                            </td>
                            <td>{metaDisp}</td>
                            <td>{row.expectedLabel}</td>
                            <td>{actualDisp}</td>
                            <td>{vs}</td>
                            <td
                              title={
                                row.projectedLabel === '—'
                                  ? 'Sem dados no mês ou mês futuro — não há ritmo para extrapolar.'
                                  : 'Real acumulado no mês ÷ proporção de dias corridos (mesma base do gráfico Projeções).'
                              }
                            >
                              {row.projectedLabel}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          </div>

          {/* Produtos mais vendidos no período */}
          <div className="db-card">
            <div className="db-card-header">
              <span className="db-card-title">
                <Package size={14} strokeWidth={1.65} className="db-card-title-ic" />
                Produtos mais vendidos
              </span>
            </div>
            <div className="db-card-body db-card-body--activity-spline">
              {(() => {
                const vendas = recs.filter((r) => contaParaComissao(r) && r.tipo === 'venda')
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
                  <div className="da-spline da-prod-panel">
                    <p className="da-spline-subtitle da-prod-subtitle">
                      Participação por quantidade vendida no período filtrado
                    </p>
                    <div className="da-spline-chart-wrap">
                  <div className="db-prod-bento db-prod-bento--in-chart">
                    <div className="db-donut-wrap db-donut-wrap--soft">
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
                    <div className="db-prod-list db-prod-list--soft">
                      {slices.map((s) => (
                          <div key={s.id} className="db-prod-row">
                            <span className="db-prod-pct">{s.pct}%</span>
                            <div className="db-prod-row-main">
                              <div className="db-prod-name">{s.nome}</div>
                              <div className="db-prod-meta">
                                {s.qtd} unid. · {s.vendas} {s.vendas === 1 ? 'venda' : 'vendas'} · {fmt(s.total)}
                              </div>
                            </div>
                            <span
                              className="db-prod-swatch"
                              style={{
                                background: s.color,
                                boxShadow: `0 0 8px ${s.color}55`
                              }}
                              aria-hidden
                            />
                          </div>
                      ))}
                    </div>
                  </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Atividade diária — spline + filtro por série */}
          <div className="db-card">
            <div className="db-card-header">
              <span className="db-card-title">
                <Activity size={14} strokeWidth={1.65} className="db-card-title-ic" />
                Atividade diária
              </span>
            </div>
            <div className="db-card-body db-card-body--activity-spline">
              {activityDaily && activityDaily.dates.length > 0 ? (
                <DailyActivitySplineChart
                  dates={activityDaily.dates}
                  leads={activityDaily.leads}
                  agendadas={activityDaily.ag}
                  realizadas={activityDaily.re}
                  vendas={activityDaily.vn}
                />
              ) : (
                <div className="db-empty">
                  <p>Sem dados no período</p>
                </div>
              )}
            </div>
          </div>

          <div className="db-card db-card--recent-regs">
            <div className="db-card-header">
              <span className="db-card-title">
                <ClipboardList size={14} strokeWidth={1.65} className="db-card-title-ic" />
                Registros recentes
              </span>
            </div>
            <div className="db-card-body db-recent-body">
              {recs.length === 0 ? (
                <div className="db-empty">
                  <p>Sem registros no período</p>
                </div>
              ) : (
                <div className="db-recent-panel">
                  <div className="db-recent-table-wrap">
                    <table className="db-recent-table">
                      <thead>
                        <tr>
                          <RecentSortTh
                            label="Registro"
                            sortKey="titulo"
                            current={recentSort}
                            onToggle={toggleRecentSort}
                          />
                          <RecentSortTh
                            label="Responsável"
                            sortKey="userName"
                            current={recentSort}
                            onToggle={toggleRecentSort}
                          />
                          <RecentSortTh
                            label="Tipo"
                            sortKey="tipo"
                            current={recentSort}
                            onToggle={toggleRecentSort}
                          />
                          <RecentSortTh
                            label="Valor"
                            sortKey="valor"
                            current={recentSort}
                            onToggle={toggleRecentSort}
                          />
                          <RecentSortTh
                            label="Data"
                            sortKey="data"
                            current={recentSort}
                            onToggle={toggleRecentSort}
                          />
                        </tr>
                      </thead>
                      <tbody>
                        {recentSorted.map((r) => {
                          const RegIcon: LucideIcon =
                            r.tipo === 'reuniao_agendada'
                              ? CalendarPlus
                              : r.tipo === 'reuniao_realizada'
                                ? CalendarCheck
                                : r.tipo === 'reuniao_closer'
                                  ? Handshake
                                  : r.tipo === 'reuniao_no_show'
                                    ? UserX
                                    : CircleDollarSign
                          const hue = hueFromString(r.userId || r.userName)
                          return (
                            <tr key={r.id} className="db-recent-row">
                              <td className="db-recent-td db-recent-td--reg">
                                <div className="db-recent-reg-cell">
                                  <div className="db-recent-type-icon" aria-hidden>
                                    <RegIcon size={17} strokeWidth={1.65} />
                                  </div>
                                  <div className="db-recent-reg-text">
                                    <div className="db-recent-primary">{primaryTitleRecent(r)}</div>
                                    <div className="db-recent-secondary">{subtitleRecent(r)}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="db-recent-td db-recent-td--user">
                                <div className="db-recent-user-cell">
                                  <span
                                    className="db-recent-avatar"
                                    style={{ ['--avatar-h' as string]: String(hue) } as CSSProperties}
                                    aria-hidden
                                  >
                                    {userInitials(r.userName)}
                                  </span>
                                  <span className="db-recent-user-name">{r.userName}</span>
                                </div>
                              </td>
                              <td className="db-recent-td db-recent-td--tipo">
                                <span className="db-recent-tipo-text">{tipoLabelRecent(r)}</span>
                              </td>
                              <td className="db-recent-td db-recent-td--val">
                                {r.tipo === 'venda' ? (
                                  <span className="db-recent-val">{fmt(r.valor)}</span>
                                ) : (
                                  <span className="db-recent-val db-recent-val--empty">—</span>
                                )}
                              </td>
                              <td className="db-recent-td db-recent-td--date">
                                {formatRecentDate(r.data)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        </>
      )}
    </div>
  )
}
