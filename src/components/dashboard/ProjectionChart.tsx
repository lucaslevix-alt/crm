import { useState, useCallback, type CSSProperties, type MouseEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Target } from 'lucide-react'
import { icSm } from '../../lib/icon-sizes'
import { projMetaBadge } from '../../utils/metaProgress'
import { smoothAreaUnderPath, smoothPathThrough } from '../../lib/smooth-chart-path'

interface ProjectionChartProps {
  chartKey: string
  title: string
  TitleIcon: LucideIcon
  color: string
  realPoints: number[]
  projectedCumulative: number[]
  allDates: string[]
  projected: number
  fmtVal: (v: number) => string
  fmtShort: (v: number) => string
  metaVal?: number
  money?: boolean
}

const W = 268
const H = 136
const pad = { t: 8, r: 8, b: 22, l: 44 }
const gW = W - pad.l - pad.r
const gH = H - pad.t - pad.b

function mutedColorStyle(color: string): CSSProperties {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return { color: `${color}99` }
  return { color, opacity: 0.62 }
}

export function ProjectionChart({
  chartKey,
  title,
  TitleIcon,
  color,
  realPoints,
  projectedCumulative,
  allDates,
  projected,
  fmtVal,
  fmtShort,
  metaVal,
  money
}: ProjectionChartProps) {
  const [hovered, setHovered] = useState<{ i: number; val: number; day: string } | null>(null)

  const maxY =
    Math.max(...projectedCumulative, metaVal ?? 0, ...realPoints, 1) * 1.08

  const x = useCallback((i: number) => pad.l + (i / Math.max(allDates.length - 1, 1)) * gW, [allDates.length])
  const y = useCallback((v: number) => pad.t + gH - (v / maxY) * gH, [maxY])

  const baseY = pad.t + gH

  const realPts: [number, number][] = realPoints.map((v, i) => [x(i), y(v)])
  const projStartIdx = Math.max(0, realPoints.length - 1)
  const projPts: [number, number][] = projectedCumulative
    .slice(projStartIdx)
    .map((v, i) => [x(i + projStartIdx), y(v)])

  const realPath = realPts.length >= 2 ? smoothPathThrough(realPts) : ''
  const projPath = projPts.length >= 2 ? smoothPathThrough(projPts) : ''
  const areaPath = realPts.length > 0 ? smoothAreaUnderPath(realPts, baseY) : ''

  const yTicks: number[] = []
  const step = maxY > 0 ? Math.pow(10, Math.floor(Math.log10(maxY))) / 2 : 1
  for (let v = 0; v <= maxY; v += step || 1) yTicks.push(v)
  if (yTicks.length > 6) {
    const bigStep = step * 2
    yTicks.length = 0
    for (let v = 0; v <= maxY; v += bigStep || 1) yTicks.push(v)
  }

  const xLabels: Array<{ i: number; label: string }> = []
  const labelStep = Math.max(1, Math.floor(allDates.length / 8))
  for (let i = 0; i < allDates.length; i += labelStep) {
    xLabels.push({ i, label: allDates[i].slice(8, 10) })
  }

  function handleMouseMove(e: MouseEvent<SVGSVGElement>) {
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

  function handleMouseLeave() {
    setHovered(null)
  }

  const gradientId = `proj-grad-${chartKey}`
  const filterTipId = `proj-tip-${chartKey}`
  const projBadge = projMetaBadge(projected, metaVal)

  const tipW = 112
  const tipH = 40
  const tipX = hovered ? Math.min(Math.max(x(hovered.i) - tipW / 2, pad.l), W - pad.r - tipW) : 0
  const tipY = hovered ? Math.max(pad.t + 2, y(hovered.val) - tipH - 10) : 0

  return (
    <div className="proj-card proj-card--dashboard">
      <div className="proj-card-header">
        <span className="proj-card-title">
          <span className="proj-card-icon" aria-hidden>
            <TitleIcon {...icSm} />
          </span>
          {title}
        </span>
        <span className="proj-card-badge">
          <span className="proj-badge-icon" aria-hidden>
            <Target size={12} strokeWidth={1.65} />
          </span>
          <span className="proj-badge-text">
            Proj:{' '}
            <span className="proj-badge-pct" style={{ color }} title={metaVal != null && metaVal > 0 ? `Meta: ${fmtVal(metaVal)}` : undefined}>
              {projBadge}
            </span>
            <span className="proj-badge-val" style={mutedColorStyle(color)}>
              {' '}({fmtVal(projected)})
            </span>
          </span>
        </span>
      </div>
      <div className="proj-card-chart">
        <svg
          className="proj-chart-svg"
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="auto"
          style={{ display: 'block', maxHeight: 200 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          aria-hidden={true}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity="0.03" />
              <stop offset="40%" stopColor={color} stopOpacity="0.12" />
              <stop offset="100%" stopColor={color} stopOpacity="0.28" />
            </linearGradient>
            <filter id={filterTipId} x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="3" stdDeviation="5" floodOpacity="0.07" />
            </filter>
          </defs>
          {yTicks.map((v) => (
            <g key={v}>
              <line
                className="proj-chart-grid-line proj-chart-grid-line--h"
                x1={pad.l}
                y1={y(v)}
                x2={W - pad.r}
                y2={y(v)}
              />
              <text className="proj-chart-axis-text" x={pad.l - 6} y={y(v) + 3} textAnchor="end" fontSize="9">
                {fmtShort(v)}
              </text>
            </g>
          ))}
          {Array.from({ length: Math.ceil(allDates.length / 4) }, (_, k) => k * 4).map(
            (xi) =>
              xi < allDates.length && (
                <line
                  key={xi}
                  className="proj-chart-grid-line proj-chart-grid-line--v"
                  x1={x(xi)}
                  y1={pad.t}
                  x2={x(xi)}
                  y2={baseY}
                />
              )
          )}
          {metaVal != null && metaVal > 0 && metaVal < maxY && (
            <line
              className="proj-chart-meta-line"
              x1={pad.l}
              y1={y(metaVal)}
              x2={W - pad.r}
              y2={y(metaVal)}
            />
          )}
          {xLabels.map(({ i: xi, label }) => (
            <text key={xi} className="proj-chart-axis-text proj-chart-axis-text--x" x={x(xi)} y={H - 5} textAnchor="middle">
              {label}
            </text>
          ))}
          {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} className="proj-chart-area" />}
          {projPath && (
            <path
              d={projPath}
              fill="none"
              stroke={color}
              strokeWidth="1.35"
              strokeDasharray="5 4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="proj-chart-line proj-chart-line--proj"
            />
          )}
          {realPath && (
            <path
              d={realPath}
              fill="none"
              stroke={color}
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="proj-chart-line proj-chart-line--real"
            />
          )}
          {hovered && (
            <line
              className="proj-chart-cursor-line"
              x1={x(hovered.i)}
              y1={pad.t}
              x2={x(hovered.i)}
              y2={baseY}
            />
          )}
          {realPoints.map((v, i) => (
            <circle
              key={i}
              cx={x(i)}
              cy={y(v)}
              r={hovered?.i === i ? 3.5 : 2}
              className={hovered?.i === i ? 'proj-chart-dot proj-chart-dot--hover' : 'proj-chart-dot'}
              fill={color}
              style={{ cursor: 'pointer' }}
            />
          ))}
          {hovered && (
            <g filter={`url(#${filterTipId})`}>
              <rect
                className="proj-tooltip-bg"
                x={tipX}
                y={tipY}
                width={tipW}
                height={tipH}
                rx={10}
                ry={10}
              />
              <text className="proj-tooltip-date" x={tipX + tipW / 2} y={tipY + 15} textAnchor="middle" fontSize="9" fontWeight="600">
                {hovered.day.slice(8, 10)}/{hovered.day.slice(5, 7)}
              </text>
              <text className="proj-tooltip-val" x={tipX + tipW / 2} y={tipY + 30} textAnchor="middle" fontSize="10" fontWeight="600">
                {money ? fmtVal(hovered.val) : hovered.val}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  )
}
