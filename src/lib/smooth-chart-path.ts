/** Caminho SVG suave (Catmull-Rom → cubics) para linhas estilo dashboard SaaS */

export function smoothPathThrough(points: [number, number][]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`
  if (points.length === 2) {
    return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`
  }
  const p = (i: number): [number, number] => {
    const k = Math.max(0, Math.min(points.length - 1, i))
    return points[k]
  }
  let d = `M ${points[0][0]} ${points[0][1]}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = p(i - 1)
    const p1 = p(i)
    const p2 = p(i + 1)
    const p3 = p(i + 2)
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2[0]} ${p2[1]}`
  }
  return d
}

/** Fecha a área sob a curva até a linha de base (y fixo). */
export function smoothAreaUnderPath(points: [number, number][], baseY: number): string {
  if (points.length === 0) return ''
  if (points.length === 1) {
    const x = points[0][0]
    const y = points[0][1]
    return `M ${x} ${baseY} L ${x} ${y} L ${x} ${baseY} Z`
  }
  const top = smoothPathThrough(points)
  const last = points[points.length - 1]
  const first = points[0]
  return `${top} L ${last[0]} ${baseY} L ${first[0]} ${baseY} Z`
}
