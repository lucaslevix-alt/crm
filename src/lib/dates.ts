export function today(): string {
  return new Date().toISOString().split('T')[0]
}

export function mRange(mv?: string): { start: string; end: string } {
  const now = new Date()
  const y = mv ? parseInt(mv.slice(0, 4), 10) : now.getFullYear()
  const m = mv ? parseInt(mv.slice(5, 7), 10) : now.getMonth() + 1
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const end = new Date(y, m, 0).toISOString().split('T')[0]
  return { start, end }
}

export function wRange(): { start: string; end: string } {
  const n = new Date()
  const dy = n.getDay()
  const diff = n.getDate() - dy + (dy === 0 ? -6 : 1)
  const s = new Date(n)
  s.setDate(diff)
  const e = new Date(s)
  e.setDate(diff + 6)
  return { start: s.toISOString().split('T')[0], end: e.toISOString().split('T')[0] }
}

export function formatPeriodLabel(since: string, until: string): string {
  const [sy, sm, sd] = since.split('-')
  const [uy, um, ud] = until.split('-')
  return `${sd}/${sm}/${sy} → ${ud}/${um}/${uy}`
}
