import { useCallback, useId, useMemo, useState, type MouseEvent } from 'react'
import { smoothAreaUnderPath, smoothPathThrough } from '../../lib/smooth-chart-path'

export type ActivityViewFilter = 'all' | 'leads' | 'ag' | 're' | 'vn'

type SeriesKey = 'leads' | 'ag' | 're' | 'vn'

const SERIES: { key: SeriesKey; label: string; strokeVar: string }[] = [
  { key: 'leads', label: 'Leads', strokeVar: 'var(--cyan)' },
  { key: 'ag', label: 'Agendadas', strokeVar: 'var(--accent)' },
  { key: 're', label: 'Realizadas', strokeVar: 'var(--green)' },
  { key: 'vn', label: 'Vendas', strokeVar: 'var(--amber)' }
]

/** ViewBox mais largo para curvas respirarem */
const W = 720
const H = 252
const pad = { t: 16, r: 14, b: 34, l: 52 }
const gW = W - pad.l - pad.r
const gH = H - pad.t - pad.b
const baseY = pad.t + gH

function fmtAxisY(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`
  return String(Math.round(v))
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(Math.round(n))
}

interface DailyActivitySplineChartProps {
  dates: string[]
  leads: number[]
  agendadas: number[]
  realizadas: number[]
  vendas: number[]
}

export function DailyActivitySplineChart({
  dates,
  leads,
  agendadas,
  realizadas,
  vendas
}: DailyActivitySplineChartProps) {
  const uid = useId().replace(/:/g, '')
  const [filter, setFilter] = useState<ActivityViewFilter>('all')
  const [hovered, setHovered] = useState<{ i: number } | null>(null)

  const valuesByKey = useMemo(
    () =>
      ({
        leads,
        ag: agendadas,
        re: realizadas,
        vn: vendas
      }) as Record<SeriesKey, number[]>,
    [leads, agendadas, realizadas, vendas]
  )

  const visibleKeys = useMemo((): SeriesKey[] => {
    if (filter === 'all') return ['leads', 'ag', 're', 'vn']
    if (filter === 'leads' || filter === 'ag' || filter === 're' || filter === 'vn') return [filter]
    return ['leads', 'ag', 're', 'vn']
  }, [filter])

  const maxY = useMemo(() => {
    let m = 1
    for (const k of visibleKeys) {
      const arr = valuesByKey[k]
      for (let i = 0; i < arr.length; i++) m = Math.max(m, arr[i])
    }
    return m * 1.06
  }, [visibleKeys, valuesByKey])

  const xAt = useCallback(
    (i: number) => {
      const n = dates.length
      if (n <= 1) return pad.l + gW / 2
      return pad.l + (i / (n - 1)) * gW
    },
    [dates.length]
  )

  const yAt = useCallback((v: number) => pad.t + gH - (v / maxY) * gH, [maxY])

  const pathsByKey = useMemo(() => {
    const out = new Map<SeriesKey, { line: string; area: string; pts: [number, number][] }>()
    const n = dates.length
    for (const k of SERIES.map((s) => s.key)) {
      const arr = valuesByKey[k]
      const pts: [number, number][] = arr.map((v, i) => [xAt(i), yAt(v)])
      let line = ''
      let area = ''
      if (n === 1 && pts.length === 1) {
        const y0 = pts[0][1]
        line = `M ${pad.l} ${y0} L ${W - pad.r} ${y0}`
        area = smoothAreaUnderPath(
          [
            [pad.l, y0],
            [W - pad.r, y0]
          ],
          baseY
        )
      } else if (pts.length >= 2) {
        line = smoothPathThrough(pts)
        area = smoothAreaUnderPath(pts, baseY)
      } else if (pts.length === 1) {
        const p = pts[0]
        line = `M ${p[0]} ${p[1]} L ${p[0]} ${p[1]}`
        area = smoothAreaUnderPath(
          [
            [p[0], p[1]],
            [p[0], p[1]]
          ],
          baseY
        )
      }
      out.set(k, { line, area, pts })
    }
    return out
  }, [valuesByKey, xAt, yAt, dates.length])

  const yTicks: number[] = useMemo(() => {
    const ticks: number[] = []
    const rawStep = maxY > 0 ? Math.pow(10, Math.floor(Math.log10(maxY))) / 2 : 1
    let step = rawStep > 0 ? rawStep : 1
    for (let v = 0; v <= maxY; v += step) ticks.push(v)
    if (ticks.length > 7) {
      ticks.length = 0
      step = step * 2
      for (let v = 0; v <= maxY; v += step) ticks.push(v)
    }
    if (ticks.length === 0 || ticks[ticks.length - 1] < maxY * 0.99) {
      const last = ticks[ticks.length - 1] ?? 0
      if (last < maxY) ticks.push(Math.ceil(maxY))
    }
    return ticks
  }, [maxY])

  const xLabels = useMemo(() => {
    const n = dates.length
    const step = Math.max(1, Math.floor(n / 9))
    const items: { i: number; label: string }[] = []
    for (let i = 0; i < n; i += step) {
      const d = dates[i]
      items.push({ i, label: d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '' })
    }
    if (n > 0 && items[items.length - 1]?.i !== n - 1) {
      const d = dates[n - 1]
      items.push({ i: n - 1, label: d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '' })
    }
    return items
  }, [dates])

  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    const n = dates.length
    if (n === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * W
    const idx = Math.round(((svgX - pad.l) / gW) * Math.max(n - 1, 0))
    const clamped = Math.max(0, Math.min(idx, n - 1))
    setHovered({ i: clamped })
  }

  const handleMouseLeave = () => setHovered(null)

  const singleMode = filter !== 'all'
  const hi = hovered?.i

  const tipLines = useMemo(() => {
    if (hi == null) return []
    const lines: { label: string; val: string; color: string }[] = []
    for (const sk of visibleKeys) {
      const meta = SERIES.find((s) => s.key === sk)!
      const v = valuesByKey[sk][hi] ?? 0
      lines.push({ label: meta.label, val: fmtInt(v), color: meta.strokeVar })
    }
    return lines
  }, [hi, visibleKeys, valuesByKey])

  const tipW = 176
  const tipLineH = 16
  const tipPad = 14
  const tipH = tipPad * 2 + 16 + tipLines.length * tipLineH

  const tipX =
    hi != null
      ? Math.min(Math.max(xAt(hi) - tipW / 2, pad.l), W - pad.r - tipW)
      : 0
  const tipY =
    hi != null
      ? Math.max(
          pad.t + 6,
          yAt(Math.max(...visibleKeys.map((k) => valuesByKey[k][hi] ?? 0))) - tipH - 14
        )
      : 0

  const dayLabel =
    hi != null && dates[hi]
      ? new Date(dates[hi] + 'T12:00:00').toLocaleDateString('pt-BR', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        })
      : ''

  if (!dates.length) {
    return (
      <div className="da-spline-empty">Sem dias no período</div>
    )
  }

  const filterTipId = `da-tip-${uid}`
  const showAreaForKey = (k: SeriesKey) => {
    if (!singleMode && visibleKeys.includes(k)) return true
    return singleMode && visibleKeys[0] === k
  }

  return (
    <div className="da-spline">
      <div className="da-spline-head">
        <p className="da-spline-subtitle">Volume por dia no período</p>
        <div className="da-spline-segment" role="tablist" aria-label="Filtrar série do gráfico">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            className={`da-spline-segment__btn${filter === 'all' ? ' da-spline-segment__btn--on' : ''}`}
            onClick={() => setFilter('all')}
          >
            Todos
          </button>
          {SERIES.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={filter === s.key}
              className={`da-spline-segment__btn${filter === s.key ? ' da-spline-segment__btn--on' : ''}`}
              onClick={() => setFilter(s.key)}
            >
              {s.label}
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
          aria-label="Gráfico de atividade diária"
        >
          <defs>
            {SERIES.map((s) => (
              <linearGradient key={`g1-${s.key}`} id={`${uid}-area-soft-${s.key}`} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={s.strokeVar} stopOpacity={0} />
                <stop offset="28%" stopColor={s.strokeVar} stopOpacity={0.045} />
                <stop offset="62%" stopColor={s.strokeVar} stopOpacity={0.1} />
                <stop offset="100%" stopColor={s.strokeVar} stopOpacity={0.16} />
              </linearGradient>
            ))}
            {SERIES.map((s) => (
              <linearGradient key={`g2-${s.key}`} id={`${uid}-area-rich-${s.key}`} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={s.strokeVar} stopOpacity={0} />
                <stop offset="22%" stopColor={s.strokeVar} stopOpacity={0.07} />
                <stop offset="55%" stopColor={s.strokeVar} stopOpacity={0.18} />
                <stop offset="100%" stopColor={s.strokeVar} stopOpacity={0.38} />
              </linearGradient>
            ))}
            <filter id={filterTipId} x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="8" stdDeviation="12" floodOpacity="0.12" />
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
                y1={yAt(v)}
                x2={W - pad.r}
                y2={yAt(v)}
              />
              <text className="da-spline-axis da-spline-axis--y" x={pad.l - 10} y={yAt(v) + 4} textAnchor="end">
                {fmtAxisY(v)}
              </text>
            </g>
          ))}

          {visibleKeys.map((k) => {
            const meta = SERIES.find((s) => s.key === k)!
            const { line, area } = pathsByKey.get(k)!
            const fillGrad = singleMode ? `${uid}-area-rich-${k}` : `${uid}-area-soft-${k}`
            const showFill = showAreaForKey(k) && Boolean(area)
            return (
              <g key={k} className="da-spline-series">
                {showFill && area ? (
                  <path
                    d={area}
                    fill={`url(#${fillGrad})`}
                    className={singleMode ? 'da-spline-area da-spline-area--single' : 'da-spline-area da-spline-area--multi'}
                  />
                ) : null}
                {line ? (
                  <path
                    d={line}
                    fill="none"
                    stroke={meta.strokeVar}
                    strokeWidth={singleMode ? 2.4 : 1.55}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={singleMode ? 'da-spline-line da-spline-line--single' : 'da-spline-line da-spline-line--multi'}
                    strokeOpacity={singleMode ? 1 : 0.82}
                  />
                ) : null}
              </g>
            )
          })}

          {xLabels.map(({ i: xi, label }) => (
            <text key={xi} className="da-spline-axis da-spline-axis--x" x={xAt(xi)} y={H - 8} textAnchor="middle">
              {label}
            </text>
          ))}

          {hi != null && (
            <line
              className="da-spline-cursor"
              x1={xAt(hi)}
              y1={pad.t}
              x2={xAt(hi)}
              y2={baseY}
            />
          )}

          {hi != null &&
            visibleKeys.map((k) => {
              const meta = SERIES.find((s) => s.key === k)!
              const arr = valuesByKey[k]
              const v = arr[hi] ?? 0
              return (
                <g key={`dot-${k}`} className="da-spline-marker">
                  <circle
                    cx={xAt(hi)}
                    cy={yAt(v)}
                    r={8}
                    fill={meta.strokeVar}
                    fillOpacity={0.14}
                    className="da-spline-marker-halo"
                  />
                  <circle
                    cx={xAt(hi)}
                    cy={yAt(v)}
                    r={3.5}
                    className="da-spline-marker-core"
                    fill="var(--bg2)"
                    stroke={meta.strokeVar}
                    strokeWidth={1.65}
                  />
                </g>
              )
            })}

          {hi != null && tipLines.length > 0 && (
            <g filter={`url(#${filterTipId})`} className="da-spline-tooltip-g">
              <rect className="da-spline-tooltip-bg" x={tipX} y={tipY} width={tipW} height={tipH} rx={14} ry={14} />
              <text className="da-spline-tooltip-date" x={tipX + tipW / 2} y={tipY + tipPad + 12} textAnchor="middle">
                {dayLabel}
              </text>
              {tipLines.map((ln, j) => (
                <text
                  key={ln.label}
                  className="da-spline-tooltip-row"
                  x={tipX + tipPad}
                  y={tipY + tipPad + 30 + j * tipLineH}
                >
                  <tspan className="da-spline-tooltip-label">{ln.label}</tspan>
                  <tspan className="da-spline-tooltip-num" fill={ln.color}>
                    {' '}
                    {ln.val}
                  </tspan>
                </text>
              ))}
            </g>
          )}
        </svg>
      </div>
    </div>
  )
}
