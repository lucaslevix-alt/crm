import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { AgendamentoRow, AgendamentoStatus } from '../../firebase/firestore'
import {
  AGENDAMENTO_STATUS_CAL_CLASS,
  AGENDAMENTO_STATUS_LABEL
} from '../../lib/agendaConstants'
import {
  addMonthsYm,
  buildMonthGrid,
  dayLabelShort,
  formatMonthTitle,
  isoLocal,
  mondayWeekStart,
  todayIso,
  weekdayLabels,
  weekDaysFromStart,
  ymFromIso
} from '../../lib/agendaCalendar'

const MAX_EVENTS_MONTH = 3

export interface AgendaCalendarViewProps {
  items: AgendamentoRow[]
  calendarYm: string
  onCalendarYmChange: (ym: string) => void
  selectedId: string | null
  onEventClick: (row: AgendamentoRow, anchor: DOMRect) => void
  onClearSelection: () => void
}

export function AgendaCalendarView({
  items,
  calendarYm,
  onCalendarYmChange,
  selectedId,
  onEventClick,
  onClearSelection
}: AgendaCalendarViewProps) {
  const [subView, setSubView] = useState<'mes' | 'semana'>('mes')
  const [weekStart, setWeekStart] = useState(() => mondayWeekStart(todayIso()))

  const byDate = useMemo(() => {
    const m = new Map<string, AgendamentoRow[]>()
    for (const a of items) {
      const list = m.get(a.data) ?? []
      list.push(a)
      m.set(a.data, list)
    }
    for (const list of m.values()) {
      list.sort((x, y) => x.grupoWpp.localeCompare(y.grupoWpp, 'pt-BR'))
    }
    return m
  }, [items])

  const monthCells = useMemo(() => buildMonthGrid(calendarYm), [calendarYm])
  const weekDays = useMemo(() => weekDaysFromStart(weekStart), [weekStart])

  function goToday() {
    const td = todayIso()
    onCalendarYmChange(ymFromIso(td))
    setWeekStart(mondayWeekStart(td))
  }

  function navPrev() {
    if (subView === 'mes') onCalendarYmChange(addMonthsYm(calendarYm, -1))
    else {
      const d = weekDays[0]
      const [y, m, day] = d.split('-').map(Number)
      const dt = new Date(y, m - 1, day - 7)
      setWeekStart(isoLocal(dt))
      onCalendarYmChange(ymFromIso(isoLocal(dt)))
    }
  }

  function navNext() {
    if (subView === 'mes') onCalendarYmChange(addMonthsYm(calendarYm, 1))
    else {
      const d = weekDays[0]
      const [y, m, day] = d.split('-').map(Number)
      const dt = new Date(y, m - 1, day + 7)
      setWeekStart(isoLocal(dt))
      onCalendarYmChange(ymFromIso(isoLocal(dt)))
    }
  }

  const headerTitle =
    subView === 'mes'
      ? formatMonthTitle(calendarYm)
      : `${dayLabelShort(weekDays[0])} – ${dayLabelShort(weekDays[6])}`

  function renderEventChip(a: AgendamentoRow, compact?: boolean) {
    const sel = selectedId === a.id
    const closer = a.closerUserName ? ` · ${a.closerUserName}` : ''
    return (
      <button
        key={a.id}
        type="button"
        className={`agenda-cal-ev ${AGENDAMENTO_STATUS_CAL_CLASS[a.status]}${sel ? ' agenda-cal-ev--selected' : ''}`}
        title={`${a.grupoWpp} · ${AGENDAMENTO_STATUS_LABEL[a.status]}${closer}`}
        onClick={(e) => {
          e.stopPropagation()
          onEventClick(a, (e.currentTarget as HTMLElement).getBoundingClientRect())
        }}
      >
        <span className="agenda-cal-ev-title">{a.grupoWpp}</span>
        {!compact && a.closerUserName && <span className="agenda-cal-ev-meta">{a.closerUserName}</span>}
      </button>
    )
  }

  return (
    <div className="agenda-cal">
      <div className="agenda-cal-toolbar">
        <div className="agenda-cal-nav">
          <button type="button" className="agenda-cal-nav-btn" onClick={navPrev} aria-label="Anterior">
            <ChevronLeft size={18} strokeWidth={2} />
          </button>
          <button type="button" className="agenda-cal-nav-btn" onClick={navNext} aria-label="Seguinte">
            <ChevronRight size={18} strokeWidth={2} />
          </button>
          <button type="button" className="agenda-cal-today-btn" onClick={goToday}>
            Hoje
          </button>
          <h2 className="agenda-cal-title">{headerTitle}</h2>
        </div>
        <div className="agenda-cal-view-tabs">
          <button
            type="button"
            className={`agenda-cal-view-tab${subView === 'mes' ? ' active' : ''}`}
            onClick={() => setSubView('mes')}
          >
            Mês
          </button>
          <button
            type="button"
            className={`agenda-cal-view-tab${subView === 'semana' ? ' active' : ''}`}
            onClick={() => {
              setSubView('semana')
              setWeekStart(mondayWeekStart(`${calendarYm}-15`))
            }}
          >
            Semana
          </button>
        </div>
      </div>

      <div className="agenda-cal-legend">
        {(Object.keys(AGENDAMENTO_STATUS_LABEL) as AgendamentoStatus[]).map((st) => (
          <span key={st} className="agenda-cal-legend-item">
            <span className={`agenda-cal-legend-dot ${AGENDAMENTO_STATUS_CAL_CLASS[st]}`} />
            {AGENDAMENTO_STATUS_LABEL[st]}
          </span>
        ))}
      </div>

      {subView === 'mes' ? (
        <div className="agenda-cal-month">
          <div className="agenda-cal-weekdays">
            {weekdayLabels().map((w) => (
              <div key={w} className="agenda-cal-weekday">
                {w}
              </div>
            ))}
          </div>
          <div className="agenda-cal-grid">
            {monthCells.map((cell) => {
              const dayItems = byDate.get(cell.iso) ?? []
              const visible = dayItems.slice(0, MAX_EVENTS_MONTH)
              const more = dayItems.length - visible.length
              return (
                <div
                  key={cell.iso}
                  className={`agenda-cal-cell${cell.inMonth ? '' : ' agenda-cal-cell--muted'}${cell.isToday ? ' agenda-cal-cell--today' : ''}`}
                  onClick={() => onClearSelection()}
                >
                  <div className="agenda-cal-cell-num">{parseInt(cell.iso.split('-')[2], 10)}</div>
                  <div className="agenda-cal-cell-events">
                    {visible.map((a) => renderEventChip(a, true))}
                    {more > 0 && <span className="agenda-cal-more">+{more} mais</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="agenda-cal-week">
          {weekDays.map((iso) => {
            const dayItems = byDate.get(iso) ?? []
            const isToday = iso === todayIso()
            const [, , d] = iso.split('-')
            const wd = new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' })
            return (
              <div
                key={iso}
                className={`agenda-cal-week-col${isToday ? ' agenda-cal-week-col--today' : ''}`}
                onClick={() => onClearSelection()}
              >
                <div className="agenda-cal-week-head">
                  <span className="agenda-cal-week-wd">{wd}</span>
                  <span className="agenda-cal-week-d">{d}</span>
                </div>
                <div className="agenda-cal-week-body">
                  {dayItems.length === 0 ? (
                    <span className="agenda-cal-week-empty">—</span>
                  ) : (
                    dayItems.map((a) => renderEventChip(a))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
