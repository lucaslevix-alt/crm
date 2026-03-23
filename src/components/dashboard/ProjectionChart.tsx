import { useState, useCallback, type CSSProperties, type MouseEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Target } from 'lucide-react'
import { icSm } from '../../lib/icon-sizes'
import { projMetaBadge } from '../../utils/metaProgress'

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

const W = 200
const H = 120
const pad = { t: 6, r: 6, b: 20, l: 40 }
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

  const maxY = Math.max(
    ...projectedCumulative,
    metaVal ?? 0,
    ...realPoints,
    1
  ) * 1.1

  const x = useCallback((i: number) => pad.l + (i / Math.max(allDates.length - 1, 1)) * gW, [allDates.length])
  const y = useCallback((v: number) => pad.t + gH - (v / maxY) * gH, [maxY])

  const realLinePoints = realPoints.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const projStartIdx = Math.max(0, realPoints.length - 1)
  const projLinePoints = projectedCumulative
    .slice(projStartIdx)
    .map((v, i) => `${x(i + projStartIdx)},${y(v)}`)
    .join(' ')

  const areaPoints = realPoints.length > 0
    ? `${x(0)},${pad.t + gH} ${realPoints.map((v, i) => `${x(i)},${y(v)}`).join(' ')} ${x(realPoints.length - 1)},${pad.t + gH}`
    : ''

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
  const projBadge = projMetaBadge(projected, metaVal)

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
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="auto"
          style={{ display: 'block' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={pad.l}
                y1={y(v)}
                x2={W - pad.r}
                y2={y(v)}
                stroke="rgba(148,163,184,.1)"
                strokeWidth="0.5"
              />
              <text
                x={pad.l - 4}
                y={y(v) + 1}
                textAnchor="end"
                fontSize="6"
                fill="rgba(148,163,184,.5)"
              >
                {fmtShort(v)}
              </text>
            </g>
          ))}
          {Array.from({ length: Math.ceil(allDates.length / 4) }, (_, k) => k * 4).map((xi) => (
            xi < allDates.length && (
              <line
                key={xi}
                x1={x(xi)}
                y1={pad.t}
                x2={x(xi)}
                y2={pad.t + gH}
                stroke="rgba(148,163,184,.08)"
                strokeWidth="0.5"
              />
            )
          ))}
          {metaVal != null && metaVal > 0 && metaVal < maxY && (
            <line
              x1={pad.l}
              y1={y(metaVal)}
              x2={W - pad.r}
              y2={y(metaVal)}
              stroke="rgba(148,163,184,.25)"
              strokeWidth="0.8"
              strokeDasharray="4,3"
            />
          )}
          {xLabels.map(({ i: xi, label }) => (
            <text
              key={xi}
              x={x(xi)}
              y={H - 6}
              textAnchor="middle"
              fontSize="5"
              fill="rgba(148,163,184,.5)"
              transform={`rotate(-35, ${x(xi)}, ${H - 6})`}
            >
              {label}
            </text>
          ))}
          {areaPoints && (
            <polygon
              points={areaPoints}
              fill={`url(#${gradientId})`}
            />
          )}
          {projLinePoints && (
            <polyline
              points={projLinePoints}
              fill="none"
              stroke={color}
              strokeWidth="1.2"
              strokeDasharray="4,3"
              opacity="0.7"
            />
          )}
          {realLinePoints && (
            <polyline
              points={realLinePoints}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {realPoints.map((v, i) => (
            <circle
              key={i}
              cx={x(i)}
              cy={y(v)}
              r={hovered?.i === i ? 3 : 1.8}
              fill={hovered?.i === i ? 'transparent' : color}
              stroke={color}
              strokeWidth={hovered?.i === i ? 1.5 : 0}
              style={{ cursor: 'pointer' }}
            />
          ))}
          {hovered && (
            <g>
              <rect
                x={x(hovered.i) - 24}
                y={y(hovered.val) - 22}
                width={48}
                height={28}
                rx={6}
                fill="rgba(15,15,18,.95)"
                stroke="rgba(148,163,184,.2)"
                strokeWidth="0.5"
              />
              <text
                x={x(hovered.i)}
                y={y(hovered.val) - 14}
                textAnchor="middle"
                fontSize="7"
                fill="#fff"
                fontWeight="bold"
              >
                {hovered.day.slice(8, 10)}
              </text>
              <text
                x={x(hovered.i)}
                y={y(hovered.val) - 5}
                textAnchor="middle"
                fontSize="5"
                fill={color}
              >
                ■
              </text>
              <text
                x={x(hovered.i) + 6}
                y={y(hovered.val) - 5}
                textAnchor="start"
                fontSize="5"
                fill="#fff"
              >
                Realizado: {money ? fmtVal(hovered.val) : hovered.val}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  )
}
