import { useEffect, useId, useMemo, useState, useCallback, type MouseEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Banknote,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Handshake,
  Target,
  Wallet
} from 'lucide-react'
import { icSm } from '../../lib/icon-sizes'
import { projMetaBadge } from '../../utils/metaProgress'
import { smoothAreaUnderPath, smoothPathThrough } from '../../lib/smooth-chart-path'
import type { RegistroRow, MetasConfig } from '../../firebase/firestore'

export type ProjectionKey = 'ag' | 're' | 'cl' | 'vn' | 'ft' | 'ca'

export interface ProjectionSeriesItem {
  key: ProjectionKey
  shortLabel: string
  title: string
  TitleIcon: LucideIcon
  color: string
  realPoints: number[]
  projectedCumulative: number[]
  allDates: string[]
  projected: number
  metaVal?: number
  money?: boolean
}

function fmtMoney(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function daysBetweenInclusive(start: string, end: string): number {
  const s = new Date(start + 'T12:00:00')
  const e = new Date(end + 'T12:00:00')
  const diff = e.getTime() - s.getTime()
  return diff >= 0 ? Math.floor(diff / (1000 * 60 * 60 * 24)) + 1 : 0
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

const PROJ_DEFS: Array<{
  key: ProjectionKey
  shortLabel: string
  title: string
  TitleIcon: LucideIcon
  color: string
  tipos: string[]
  money?: boolean
  field?: 'valor' | 'cashCollected'
}> = [
  {
    key: 'ag',
    shortLabel: 'Agendadas',
    title: 'Reuniões agendadas',
    TitleIcon: CalendarClock,
    color: 'var(--accent)',
    tipos: ['reuniao_agendada']
  },
  {
    key: 're',
    shortLabel: 'Realizadas',
    title: 'Reuniões realizadas',
    TitleIcon: CheckCircle2,
    color: 'var(--green)',
    tipos: ['reuniao_realizada']
  },
  {
    key: 'cl',
    shortLabel: 'Closer',
    title: 'Reuniões closer',
    TitleIcon: Handshake,
    color: 'var(--purple)',
    tipos: ['reuniao_closer']
  },
  {
    key: 'vn',
    shortLabel: 'Vendas',
    title: 'Vendas',
    TitleIcon: BriefcaseBusiness,
    color: 'var(--amber)',
    tipos: ['venda']
  },
  {
    key: 'ft',
    shortLabel: 'Faturamento',
    title: 'Faturamento',
    TitleIcon: Wallet,
    color: 'var(--green)',
    tipos: ['venda'],
    money: true,
    field: 'valor'
  },
  {
    key: 'ca',
    shortLabel: 'Cash',
    title: 'Cash collected',
    TitleIcon: Banknote,
    color: 'var(--cyan)',
    tipos: ['venda'],
    money: true,
    field: 'cashCollected'
  }
]

function metaKeyFor(piKey: ProjectionKey): keyof MetasConfig {
  switch (piKey) {
    case 'ag':
      return 'meta_reunioes_agendadas'
    case 're':
      return 'meta_reunioes_realizadas'
    case 'cl':
      return 'meta_reunioes_closer'
    case 'vn':
      return 'meta_vendas'
    case 'ft':
      return 'meta_faturamento'
    default:
      return 'meta_cash'
  }
}

/** Monta as séries de projeção para o período (mesma lógica do dashboard anterior). */
export function buildProjectionSeries(
  periodStart: string,
  periodEnd: string,
  recs: RegistroRow[],
  metas: MetasConfig
): ProjectionSeriesItem[] {
  const totalDays = daysBetweenInclusive(periodStart, periodEnd)
  const today = todayStr()
  const elapsedDays = Math.max(1, Math.min(daysBetweenInclusive(periodStart, today), totalDays))
  const factor = totalDays / elapsedDays

  const allDates: string[] = []
  const d = new Date(periodStart + 'T12:00:00')
  const endD = new Date(periodEnd + 'T12:00:00')
  while (d <= endD) {
    allDates.push(d.toISOString().split('T')[0])
    d.setDate(d.getDate() + 1)
  }

  return PROJ_DEFS.map((pi) => {
    const metaVal = metas[metaKeyFor(pi.key)] as number | undefined

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
      if (allDates[i] <= today) realPoints.push(runSum)
    }

    const lastReal = realPoints.length > 0 ? realPoints[realPoints.length - 1] : 0
    const projected = Math.round(lastReal * factor)

    const dailyRate = realPoints.length > 0 ? lastReal / realPoints.length : 0
    const projectedCumulative = cumulative.map((v, i) => {
      if (i < realPoints.length) return v
      return Math.round(lastReal + dailyRate * (i - realPoints.length + 1))
    })

    return {
      key: pi.key,
      shortLabel: pi.shortLabel,
      title: pi.title,
      TitleIcon: pi.TitleIcon,
      color: pi.color,
      realPoints,
      projectedCumulative,
      allDates,
      projected,
      metaVal,
      money: pi.money
    }
  })
}

const W = 720
const H = 252
const pad = { t: 16, r: 14, b: 34, l: 52 }
const gW = W - pad.l - pad.r
const gH = H - pad.t - pad.b
const baseY = pad.t + gH

interface UnifiedProjectionsChartProps {
  items: ProjectionSeriesItem[]
}

function formatAxisShort(v: number, money?: boolean): string {
  if (!money) return String(Math.round(v))
  if (v >= 1000) return `R$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`
  return `R$${Math.round(v)}`
}

function formatDisplay(v: number, money?: boolean): string {
  if (!money) return String(Math.round(v))
  return fmtMoney(v)
}

export function UnifiedProjectionsChart({ items }: UnifiedProjectionsChartProps) {
  const uid = useId().replace(/:/g, '')
  const [activeKey, setActiveKey] = useState<ProjectionKey>(items[0]?.key ?? 'ag')
  const [hovered, setHovered] = useState<{ i: number; val: number; day: string } | null>(null)

  useEffect(() => {
    setActiveKey((k) => (items.some((it) => it.key === k) ? k : items[0]?.key ?? 'ag'))
  }, [items])

  const active = useMemo(() => items.find((it) => it.key === activeKey) ?? items[0], [items, activeKey])

  const {
    color,
    realPoints,
    projectedCumulative,
    allDates,
    projected,
    metaVal,
    money,
    TitleIcon,
    title,
    shortLabel
  } = active

  const maxY = useMemo(
    () => Math.max(...projectedCumulative, metaVal ?? 0, ...realPoints, 1) * 1.06,
    [projectedCumulative, metaVal, realPoints]
  )

  const x = useCallback(
    (i: number) => {
      const n = allDates.length
      if (n <= 1) return pad.l + gW / 2
      return pad.l + (i / (n - 1)) * gW
    },
    [allDates.length]
  )

  const y = useCallback((v: number) => pad.t + gH - (v / maxY) * gH, [maxY])

  const realPts: [number, number][] = useMemo(
    () => realPoints.map((v, i) => [x(i), y(v)]),
    [realPoints, x, y]
  )

  const projStartIdx = Math.max(0, realPoints.length - 1)
  const projPts: [number, number][] = useMemo(
    () =>
      projectedCumulative.slice(projStartIdx).map((v, i) => [x(i + projStartIdx), y(v)]),
    [projectedCumulative, projStartIdx, x, y]
  )

  const realPath = realPts.length >= 2 ? smoothPathThrough(realPts) : ''
  const projPath = projPts.length >= 2 ? smoothPathThrough(projPts) : ''
  const areaPath = realPts.length > 0 ? smoothAreaUnderPath(realPts, baseY) : ''

  const yTicks: number[] = useMemo(() => {
    const ticks: number[] = []
    const step = maxY > 0 ? Math.pow(10, Math.floor(Math.log10(maxY))) / 2 : 1
    let s = step > 0 ? step : 1
    for (let v = 0; v <= maxY; v += s) ticks.push(v)
    if (ticks.length > 7) {
      ticks.length = 0
      s = s * 2
      for (let v = 0; v <= maxY; v += s) ticks.push(v)
    }
    if (!ticks.length || ticks[ticks.length - 1] < maxY * 0.99) {
      const last = ticks[ticks.length - 1] ?? 0
      if (last < maxY) ticks.push(Math.ceil(maxY))
    }
    return ticks
  }, [maxY])

  const xLabels = useMemo(() => {
    const n = allDates.length
    const step = Math.max(1, Math.floor(n / 9))
    const out: { i: number; label: string }[] = []
    for (let i = 0; i < n; i += step) {
      const ds = allDates[i]
      out.push({ i, label: ds ? `${ds.slice(8, 10)}/${ds.slice(5, 7)}` : '' })
    }
    if (n > 0 && out[out.length - 1]?.i !== n - 1) {
      const ds = allDates[n - 1]
      out.push({ i: n - 1, label: ds ? `${ds.slice(8, 10)}/${ds.slice(5, 7)}` : '' })
    }
    return out
  }, [allDates])

  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * W
    const idx = Math.round(((svgX - pad.l) / gW) * (allDates.length - 1))
    const clampedIdx = Math.max(0, Math.min(idx, realPoints.length - 1))
    if (realPoints.length > 0 && clampedIdx < realPoints.length) {
      setHovered({
        i: clampedIdx,
        val: realPoints[clampedIdx],
        day: allDates[clampedIdx]
      })
    } else {
      setHovered(null)
    }
  }

  const handleMouseLeave = () => setHovered(null)

  const gradientId = `${uid}-proj-area`
  const filterTipId = `${uid}-proj-tip`
  const projBadge = projMetaBadge(projected, metaVal)

  const tipW = 168
  const tipH = 72
  const tipX = hovered
    ? Math.min(Math.max(x(hovered.i) - tipW / 2, pad.l), W - pad.r - tipW)
    : 0
  const tipY = hovered ? Math.max(pad.t + 6, y(hovered.val) - tipH - 12) : 0

  const dayLabelHover =
    hovered && hovered.day
      ? new Date(hovered.day + 'T12:00:00').toLocaleDateString('pt-BR', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        })
      : ''

  if (!items.length || !active) {
    return (
      <div className="da-spline-empty">Sem dados para projeção neste período</div>
    )
  }

  return (
    <div className="da-spline da-proj-unified">
      <p className="da-spline-subtitle da-proj-subtitle">
        Acumulado real até hoje e tendência linear até o fim do período filtrado
      </p>
      <div className="da-proj-toolbar">
        <div className="da-proj-active-row">
          <span className="da-proj-active-title">
            <span className="da-proj-active-ic" aria-hidden>
              <TitleIcon {...icSm} />
            </span>
            {title}
          </span>
          <span className="da-proj-badge">
            <Target size={13} strokeWidth={1.65} className="da-proj-badge-ic" aria-hidden />
            <span className="da-proj-badge-txt">
              Proj.{' '}
              <strong style={{ color }} title={metaVal != null && metaVal > 0 ? `Meta: ${formatDisplay(metaVal, money)}` : undefined}>
                {projBadge}
              </strong>
              <span className="da-proj-badge-paren"> ({formatDisplay(projected, money)} no fechamento)</span>
            </span>
          </span>
        </div>
        <div className="da-spline-segment da-proj-segment" role="tablist" aria-label="Métrica de projeção">
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="tab"
              aria-selected={activeKey === it.key}
              className={`da-spline-segment__btn${activeKey === it.key ? ' da-spline-segment__btn--on' : ''}`}
              onClick={() => setActiveKey(it.key)}
            >
              {it.shortLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="da-spline-chart-wrap">
        <svg
          className="da-spline-svg"
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="auto"
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          aria-label={`Projeção: ${shortLabel}`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity={0} />
              <stop offset="28%" stopColor={color} stopOpacity={0.06} />
              <stop offset="62%" stopColor={color} stopOpacity={0.16} />
              <stop offset="100%" stopColor={color} stopOpacity={0.34} />
            </linearGradient>
            <filter id={filterTipId} x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="8" stdDeviation="12" floodOpacity={0.12} />
            </filter>
          </defs>

          <rect
            x={pad.l}
            y={pad.t}
            width={W - pad.l - pad.r}
            height={gH}
            rx={14}
            ry={14}
            className="da-spline-plot-bg"
            aria-hidden
          />

          {yTicks.map((v) => (
            <g key={v}>
              <line
                className="da-spline-grid-h"
                x1={pad.l}
                y1={y(v)}
                x2={W - pad.r}
                y2={y(v)}
              />
              <text className="da-spline-axis da-spline-axis--y" x={pad.l - 10} y={y(v) + 4} textAnchor="end">
                {formatAxisShort(v, money)}
              </text>
            </g>
          ))}

          {metaVal != null && metaVal > 0 && metaVal < maxY && (
            <line
              className="proj-chart-meta-line"
              x1={pad.l}
              y1={y(metaVal)}
              x2={W - pad.r}
              y2={y(metaVal)}
            />
          )}

          {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} className="da-spline-area da-spline-area--single" /> : null}

          {projPath ? (
            <path
              d={projPath}
              fill="none"
              stroke={color}
              strokeWidth={1.65}
              strokeDasharray="6 5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="da-proj-line da-proj-line--proj"
              strokeOpacity={0.85}
            />
          ) : null}

          {realPath ? (
            <path
              d={realPath}
              fill="none"
              stroke={color}
              strokeWidth={2.35}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="da-spline-line da-spline-line--single da-proj-line--real"
            />
          ) : null}

          {xLabels.map(({ i: xi, label }) => (
            <text key={xi} className="da-spline-axis da-spline-axis--x" x={x(xi)} y={H - 8} textAnchor="middle">
              {label}
            </text>
          ))}

          {hovered && (
            <line className="da-spline-cursor" x1={x(hovered.i)} y1={pad.t} x2={x(hovered.i)} y2={baseY} />
          )}

          {realPoints.map((v, i) => (
            <circle
              key={i}
              cx={x(i)}
              cy={y(v)}
              r={hovered?.i === i ? 4 : 2.5}
              fill={color}
              fillOpacity={hovered?.i === i ? 1 : 0.45}
              className="da-proj-dot"
            />
          ))}

          {hovered && (
            <g filter={`url(#${filterTipId})`}>
              <rect className="da-spline-tooltip-bg" x={tipX} y={tipY} width={tipW} height={tipH} rx={14} ry={14} />
              <text className="da-spline-tooltip-date" x={tipX + tipW / 2} y={tipY + 14} textAnchor="middle">
                {dayLabelHover}
              </text>
              <text className="da-proj-tip-ac" x={tipX + tipW / 2} y={tipY + 34} textAnchor="middle">
                Acum.: {formatDisplay(hovered.val, money)}
              </text>
              <text className="da-proj-tip-meta" x={tipX + tipW / 2} y={tipY + 54} textAnchor="middle">
                Meta período:{' '}
                {metaVal != null && metaVal > 0 ? formatDisplay(metaVal, money) : '—'}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  )
}
