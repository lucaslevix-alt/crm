/** Utilitários para grelha de calendário da Agenda (estilo Google Agenda). */

export type AgendaCalendarCell = {
  iso: string
  inMonth: boolean
  isToday: boolean
}

const WEEKDAY_LABELS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'] as const

export function weekdayLabels(): readonly string[] {
  return WEEKDAY_LABELS
}

export function isoLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayIso(): string {
  return isoLocal(new Date())
}

export function ymFromIso(iso: string): string {
  return iso.slice(0, 7)
}

export function addMonthsYm(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthRange(ym: string): { start: string; end: string } {
  const [y, m] = ym.split('-').map(Number)
  const start = `${ym}-01`
  const end = new Date(y, m, 0).toISOString().split('T')[0]
  return { start, end }
}

export function formatMonthTitle(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Segunda-feira como primeiro dia da semana. */
export function mondayWeekStart(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = dt.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  dt.setDate(dt.getDate() + diff)
  return isoLocal(dt)
}

export function weekDaysFromStart(weekStartIso: string): string[] {
  const [y, m, d] = weekStartIso.split('-').map(Number)
  const out: string[] = []
  const cur = new Date(y, m - 1, d)
  for (let i = 0; i < 7; i++) {
    out.push(isoLocal(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

export function buildMonthGrid(ym: string): AgendaCalendarCell[] {
  const [y, m] = ym.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const daysInMonth = new Date(y, m, 0).getDate()
  let pad = first.getDay() - 1
  if (pad < 0) pad = 6
  const td = todayIso()
  const cells: AgendaCalendarCell[] = []
  const startPadDate = new Date(y, m - 1, 1 - pad)
  const total = Math.ceil((pad + daysInMonth) / 7) * 7
  for (let i = 0; i < total; i++) {
    const d = new Date(startPadDate)
    d.setDate(startPadDate.getDate() + i)
    const iso = isoLocal(d)
    cells.push({
      iso,
      inMonth: d.getMonth() === m - 1,
      isToday: iso === td
    })
  }
  return cells
}

export function dayLabelShort(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}
