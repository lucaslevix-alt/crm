import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { AgendamentoRow } from '../../firebase/firestore'
import { AGENDAMENTO_STATUS_CAL_CLASS, AGENDAMENTO_STATUS_LABEL } from '../../lib/agendaConstants'
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

const MAX_EVENTS_MONTH = 4

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
  const [subView, setSubView] = useState<'mes' | 'semana'>('semana')
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

  function renderEvent(a: AgendamentoRow, compact?: boolean) {
    const sel = selectedId === a.id
    const label = compact ? a.grupoWpp : a.grupoWpp
    return (
      <button
        key={a.id}
        type="button"
        className={`agenda-gcal-ev ${AGENDAMENTO_STATUS_CAL_CLASS[a.status]}${sel ? ' is-selected' : ''}`}
        title={`${a.grupoWpp} · ${AGENDAMENTO_STATUS_LABEL[a.status]}${a.closerUserName ? ` · ${a.closerUserName}` : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          onEventClick(a, (e.currentTarget as HTMLElement).getBoundingClientRect())
        }}
      >
        <span className="agenda-gcal-ev-text">{label}</span>
        {!compact && a.closerUserName && (
          <span className="agenda-gcal-ev-sub">{a.closerUserName}</span>
        )}
      </button>
    )
  }

  return (
    <div className="agenda-gcal">
      <header className="agenda-gcal-header">
        <div className="agenda-gcal-header-left">
          <button type="button" className="agenda-gcal-icon-btn" onClick={navPrev} aria-label="Anterior">
            <ChevronLeft size={20} strokeWidth={2} />
          </button>
          <button type="button" className="agenda-gcal-icon-btn" onClick={navNext} aria-label="Seguinte">
            <ChevronRight size={20} strokeWidth={2} />
          </button>
          <button type="button" className="agenda-gcal-today" onClick={goToday}>
            Hoje
          </button>
          <h2 className="agenda-gcal-period">{headerTitle}</h2>
        </div>
        <div className="agenda-gcal-seg">
          <button
            type="button"
            className={`agenda-gcal-seg-btn${subView === 'semana' ? ' is-on' : ''}`}
            onClick={() => {
              setSubView('semana')
              setWeekStart(mondayWeekStart(`${calendarYm}-15`))
            }}
          >
            Semana
          </button>
          <button
            type="button"
            className={`agenda-gcal-seg-btn${subView === 'mes' ? ' is-on' : ''}`}
            onClick={() => setSubView('mes')}
          >
            Mês
          </button>
        </div>
      </header>

      {subView === 'mes' ? (
        <div className="agenda-gcal-month">
          <div className="agenda-gcal-month-head">
            {weekdayLabels().map((w) => (
              <div key={w} className="agenda-gcal-month-wd">
                {w}
              </div>
            ))}
          </div>
          <div className="agenda-gcal-month-grid">
            {monthCells.map((cell) => {
              const dayItems = byDate.get(cell.iso) ?? []
              const visible = dayItems.slice(0, MAX_EVENTS_MONTH)
              const more = dayItems.length - visible.length
              const dayNum = parseInt(cell.iso.split('-')[2], 10)
              return (
                <div
                  key={cell.iso}
                  className={`agenda-gcal-month-cell${cell.inMonth ? '' : ' is-other'}${cell.isToday ? ' is-today' : ''}`}
                  onClick={() => onClearSelection()}
                >
                  <span className={`agenda-gcal-month-num${cell.isToday ? ' is-today' : ''}`}>{dayNum}</span>
                  <div className="agenda-gcal-month-evs">
                    {visible.map((a) => renderEvent(a, true))}
                    {more > 0 && <span className="agenda-gcal-more">mais {more}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="agenda-gcal-week">
          {weekDays.map((iso) => {
            const dayItems = byDate.get(iso) ?? []
            const isToday = iso === todayIso()
            const [, , d] = iso.split('-')
            const wd = new Date(`${iso}T12:00:00`)
              .toLocaleDateString('pt-BR', { weekday: 'short' })
              .replace('.', '')
              .slice(0, 3)
              .toUpperCase()
            return (
              <div
                key={iso}
                className={`agenda-gcal-week-col${isToday ? ' is-today' : ''}`}
                onClick={() => onClearSelection()}
              >
                <div className="agenda-gcal-dayhead">
                  <span className="agenda-gcal-daywd">{wd}</span>
                  <span className={`agenda-gcal-daynum${isToday ? ' is-today' : ''}`}>{d}</span>
                </div>
                <div className="agenda-gcal-daybody">
                  {dayItems.length === 0 ? (
                    <div className="agenda-gcal-dayempty" />
                  ) : (
                    dayItems.map((a) => renderEvent(a))
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
