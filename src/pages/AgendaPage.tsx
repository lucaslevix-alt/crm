import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { CalendarClock, LayoutGrid, List, Search } from 'lucide-react'
import {
  listAgendamentos,
  marcarAgendamentoNoShow,
  redefinirDesfechoAgendamentoAdmin,
  resolveSquadForUserId,
  type AgendamentoRow,
  type AgendamentoStatus
} from '../firebase/firestore'
import { AgendaCalEventPopover } from '../components/agenda/AgendaCalEventPopover'
import { AgendaCalendarView } from '../components/agenda/AgendaCalendarView'
import { AgendaRowActions } from '../components/agenda/AgendaRowActions'
import { AgendaVendaModal } from '../components/agenda/AgendaVendaModal'
import { AgendaRealizadaModal } from '../components/agenda/AgendaRealizadaModal'
import { AgendaReagendarModal } from '../components/agenda/AgendaReagendarModal'
import {
  AGENDAMENTO_QUAL_BADGE,
  AGENDAMENTO_STATUS_BADGE,
  AGENDAMENTO_STATUS_CAL_CLASS,
  AGENDAMENTO_STATUS_COLOR,
  AGENDAMENTO_STATUS_LABEL,
  QUALIFICACAO_SDR_LABELS
} from '../lib/agendaConstants'
import { monthRange, todayIso, ymFromIso } from '../lib/agendaCalendar'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { useAppStore } from '../store/useAppStore'

type ViewMode = 'lista' | 'calendario'

const STATUS_SUMMARY_ORDER: AgendamentoStatus[] = [
  'agendada',
  'reagendada',
  'realizada',
  'venda',
  'no_show'
]

function mRange(): { start: string; end: string } {
  const n = new Date()
  const y = n.getFullYear()
  const m = n.getMonth() + 1
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const end = new Date(y, m, 0).toISOString().split('T')[0]
  return { start, end }
}

type RegPeriod = '7d' | '14d' | 'mes' | 'todos' | 'custom'

function getRegRange(period: RegPeriod, customDate?: string): { start: string; end: string } {
  const td = todayIso()
  if (period === '7d') {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return { start: d.toISOString().split('T')[0], end: td }
  }
  if (period === '14d') {
    const d = new Date()
    d.setDate(d.getDate() - 13)
    return { start: d.toISOString().split('T')[0], end: td }
  }
  if (period === 'mes') return mRange()
  if (period === 'custom' && customDate) return { start: customDate, end: customDate }
  return { start: '2020-01-01', end: '2099-12-31' }
}

function fdt(s: string): string {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

export function AgendaPage() {
  const { currentUser, registrosVersion, showToast, incrementRegistrosVersion } = useAppStore()
  const [regPeriod, setRegPeriod] = useState<RegPeriod>('14d')
  const [customDate, setCustomDate] = useState('')
  const [fStatus, setFStatus] = useState<AgendamentoStatus | ''>('')
  const [busca, setBusca] = useState('')
  const [rows, setRows] = useState<AgendamentoRow[]>([])
  const [mySquadId, setMySquadId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vendaPara, setVendaPara] = useState<AgendamentoRow | null>(null)
  const [realizadaPara, setRealizadaPara] = useState<AgendamentoRow | null>(null)
  const [reagendarPara, setReagendarPara] = useState<AgendamentoRow | null>(null)
  const [marcandoId, setMarcandoId] = useState<string | null>(null)
  const [adminDesfechoEdit, setAdminDesfechoEdit] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('calendario')
  const [calendarYm, setCalendarYm] = useState(() => ymFromIso(todayIso()))
  const [selectedAgendamento, setSelectedAgendamento] = useState<AgendamentoRow | null>(null)
  const [calPopoverAnchor, setCalPopoverAnchor] = useState<DOMRect | null>(null)

  const isAdmin = currentUser?.cargo === 'admin'
  const isCloser = currentUser?.cargo === 'closer'
  const isSdrRole = currentUser?.cargo === 'sdr'

  const hasLoadedOnceRef = useRef(false)

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!currentUser) return
      const silent = opts?.silent === true && hasLoadedOnceRef.current
      if (!silent) {
        setLoading(true)
        setError(null)
      }
      try {
        const squad = await resolveSquadForUserId(currentUser.id)
        setMySquadId(squad?.squadId ?? null)
        const list = await listAgendamentos({
          squadId: squad?.squadId ?? null,
          admin: isAdmin
        })
        setRows(list)
        setSelectedAgendamento((prev) => {
          if (!prev) return null
          return list.find((r) => r.id === prev.id) ?? null
        })
      } catch (e) {
        if (!silent) {
          setError(formatFirebaseOrUnknownError(e) || 'Erro ao carregar')
          setRows([])
        }
      } finally {
        hasLoadedOnceRef.current = true
        setLoading(false)
      }
    },
    [currentUser, isAdmin]
  )

  useEffect(() => {
    void load({ silent: hasLoadedOnceRef.current })
  }, [load, registrosVersion])

  const { start, end } = getRegRange(regPeriod, customDate)
  const calRange = monthRange(calendarYm)

  const matchesFilters = useCallback(
    (r: AgendamentoRow) => {
      if (fStatus && r.status !== fStatus) return false
      const q = busca.trim().toLowerCase()
      if (q) {
        const match =
          r.grupoWpp.toLowerCase().includes(q) ||
          (r.origemLead ?? '').toLowerCase().includes(q) ||
          r.sdrUserName.toLowerCase().includes(q) ||
          r.squadNome.toLowerCase().includes(q) ||
          (r.closerUserName ?? '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    },
    [fStatus, busca]
  )

  const filteredLista = useMemo(
    () => rows.filter((r) => r.data >= start && r.data <= end && matchesFilters(r)),
    [rows, start, end, matchesFilters]
  )

  const filteredCalendario = useMemo(
    () => rows.filter((r) => r.data >= calRange.start && r.data <= calRange.end && matchesFilters(r)),
    [rows, calRange.start, calRange.end, matchesFilters]
  )

  const summarySource = viewMode === 'calendario' ? filteredCalendario : filteredLista

  const statusCounts = useMemo(() => {
    const counts: Record<AgendamentoStatus, number> = {
      agendada: 0,
      reagendada: 0,
      realizada: 0,
      venda: 0,
      no_show: 0
    }
    for (const r of summarySource) counts[r.status] += 1
    return counts
  }, [summarySource])

  const summaryTotal = summarySource.length

  function toggleStatusFilter(st: AgendamentoStatus) {
    setFStatus((prev) => (prev === st ? '' : st))
  }

  function podeAgirNoItem(a: AgendamentoRow): boolean {
    if (!currentUser) return false
    if (isAdmin) return true
    if (!isCloser) return false
    if (a.closerUserId && a.closerUserId === currentUser.id) return true
    return a.squadId === mySquadId
  }

  const closeCalPopover = useCallback(() => {
    setCalPopoverAnchor(null)
    setSelectedAgendamento(null)
  }, [])

  const handleCalendarEventClick = useCallback(
    (row: AgendamentoRow, anchor: DOMRect) => {
      const fresh = rows.find((r) => r.id === row.id) ?? row
      if (selectedAgendamento?.id === fresh.id && calPopoverAnchor) {
        closeCalPopover()
        return
      }
      setSelectedAgendamento(fresh)
      setCalPopoverAnchor(anchor)
    },
    [rows, selectedAgendamento?.id, calPopoverAnchor, closeCalPopover]
  )

  useEffect(() => {
    if (viewMode !== 'calendario') closeCalPopover()
  }, [viewMode, closeCalPopover])

  async function handleNoShow(a: AgendamentoRow, adminOverride = false) {
    if (!currentUser) return
    const msg = adminOverride
      ? 'Alterar o desfecho para no show? Os registos do desfecho anterior serão substituídos.'
      : 'Marcar como no show? O lead não compareceu — será criado um registo para métricas (SDR).'
    if (!window.confirm(msg)) return
    setMarcandoId(a.id)
    try {
      const closer = { id: currentUser.id, nome: currentUser.nome, cargo: currentUser.cargo }
      if (adminOverride) {
        await redefinirDesfechoAgendamentoAdmin({
          agendamentoId: a.id,
          novoStatus: 'no_show',
          closer
        })
      } else {
        await marcarAgendamentoNoShow({ agendamentoId: a.id, closer })
      }
      showToast(adminOverride ? 'Desfecho atualizado para no show.' : 'Marcado como no show.')
      incrementRegistrosVersion()
    } catch (e) {
      showToast('Erro: ' + formatFirebaseOrUnknownError(e), 'err')
    } finally {
      setMarcandoId(null)
    }
  }

  function abrirDesfechoAdmin(a: AgendamentoRow, action: 'realizada' | 'no_show' | 'venda', closePopover = false) {
    if (closePopover) closeCalPopover()
    if (action === 'no_show') {
      if (a.status === 'no_show') return
      void handleNoShow(a, true)
      return
    }
    setAdminDesfechoEdit(true)
    if (action === 'realizada') setRealizadaPara(a)
    else setVendaPara(a)
  }

  function renderActions(a: AgendamentoRow) {
    if (!currentUser) return null
    return (
      <AgendaRowActions
        a={a}
        podeAgir={podeAgirNoItem(a)}
        isAdmin={isAdmin}
        disabled={marcandoId === a.id}
        onRealizada={() => setRealizadaPara(a)}
        onNoShow={() => void handleNoShow(a)}
        onVenda={() => setVendaPara(a)}
        onReagendar={() => setReagendarPara(a)}
        onAdminDesfecho={(action) => abrirDesfechoAdmin(a, action)}
      />
    )
  }

  return (
    <div className="content">
      <div className="page-title-row" style={{ marginBottom: 16 }}>
        <CalendarClock size={26} strokeWidth={1.65} aria-hidden />
        <h1 className="page-title">Agenda do squad</h1>
      </div>
      {isSdrRole && (
        <div
          className="card"
          style={{
            padding: 14,
            marginBottom: 16,
            maxWidth: 720,
            borderColor: 'rgba(34,197,94,.28)',
            color: 'var(--text2)',
            fontSize: 13,
            lineHeight: 1.5
          }}
        >
          <p style={{ margin: 0 }}>
            Use a barra rápida <strong>«Agendei reunião»</strong> para colocar o lead na agenda do squad.{' '}
            <strong>Não precisa cadastrar «reunião realizada»</strong>: quando o closer marcar o desfecho aqui
            (realizada, no show ou venda), o seu registro de realizada é criado automaticamente em{' '}
            <strong>Registros</strong>, com qualificação para comissão.
          </p>
          <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text3)' }}>
            Acompanhe abaixo o status de cada lead que você agendou.
          </p>
        </div>
      )}

      {!isAdmin && !mySquadId && (
        <div className="card" style={{ padding: 14, marginBottom: 16, borderColor: 'rgba(234,179,8,.35)', color: 'var(--text2)' }}>
          Ainda não está num squad: a lista fica vazia até um administrador o associar a um squad.
        </div>
      )}

      <div className="agenda-topbar">
        <div className="agenda-topbar-search">
          <Search size={18} strokeWidth={2} className="agenda-topbar-search-icon" aria-hidden />
          <input
            type="text"
            className="agenda-topbar-input"
            placeholder="Pesquisar"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        {viewMode === 'calendario' && summaryTotal > 0 && (
          <div className="agenda-topbar-filters" role="group" aria-label="Filtrar por status">
            <button
              type="button"
              className={`agenda-gcal-chip${!fStatus ? ' is-on' : ''}`}
              onClick={() => setFStatus('')}
            >
              Todos
            </button>
            {STATUS_SUMMARY_ORDER.map((st) => {
              const n = statusCounts[st]
              if (n === 0 && fStatus !== st) return null
              return (
                <button
                  key={st}
                  type="button"
                  className={`agenda-gcal-chip ${AGENDAMENTO_STATUS_CAL_CLASS[st]}${fStatus === st ? ' is-on' : ''}`}
                  style={{ '--ev-color': AGENDAMENTO_STATUS_COLOR[st] } as CSSProperties}
                  onClick={() => toggleStatusFilter(st)}
                >
                  <span className="agenda-gcal-chip-dot" aria-hidden />
                  {AGENDAMENTO_STATUS_LABEL[st]}
                  {n > 0 && <span className="agenda-gcal-chip-n">{n}</span>}
                </button>
              )
            })}
          </div>
        )}
        <div className="agenda-view-toggle">
          <button
            type="button"
            className={`agenda-tab${viewMode === 'calendario' ? ' active' : ''}`}
            onClick={() => setViewMode('calendario')}
            title="Calendário"
          >
            <LayoutGrid size={16} strokeWidth={2} aria-hidden />
            Calendário
          </button>
          <button
            type="button"
            className={`agenda-tab${viewMode === 'lista' ? ' active' : ''}`}
            onClick={() => setViewMode('lista')}
            title="Lista"
          >
            <List size={16} strokeWidth={2} aria-hidden />
            Lista
          </button>
        </div>
      </div>

      {viewMode === 'lista' && (
      <div className="ctrl-row" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <span className="ctrl-label">Período:</span>
        <button type="button" className={`prd-btn ${regPeriod === '7d' ? 'active' : ''}`} onClick={() => setRegPeriod('7d')}>
          7 dias
        </button>
        <button type="button" className={`prd-btn ${regPeriod === '14d' ? 'active' : ''}`} onClick={() => setRegPeriod('14d')}>
          14 dias
        </button>
        <button type="button" className={`prd-btn ${regPeriod === 'mes' ? 'active' : ''}`} onClick={() => { setRegPeriod('mes'); setCalendarYm(ymFromIso(todayIso())) }}>
          Mês
        </button>
        <button type="button" className={`prd-btn ${regPeriod === 'todos' ? 'active' : ''}`} onClick={() => setRegPeriod('todos')}>
          Todos
        </button>
        <input
          type="date"
          className="di"
          style={{ width: 140 }}
          value={customDate}
          onChange={(e) => {
            setCustomDate(e.target.value)
            if (e.target.value) {
              setRegPeriod('custom')
              setCalendarYm(ymFromIso(e.target.value))
            }
          }}
          title="Data específica"
        />
      </div>
      )}

      <div className={`card${viewMode === 'calendario' ? ' agenda-gcal-card' : ''}`}>
        {loading && rows.length === 0 && (
          <div className="loading">
            <div className="spin" />
            A carregar…
          </div>
        )}
        {error && <div style={{ color: 'var(--red)', padding: 16 }}>Erro: {error}</div>}
        {!error && viewMode === 'calendario' && (rows.length > 0 || !loading) && (
          <div className="agenda-gcal-wrap">
            {filteredCalendario.length === 0 ? (
              <div className="agenda-empty">
                <div className="agenda-empty-icon" aria-hidden>
                  <CalendarClock size={40} strokeWidth={1.4} />
                </div>
                <p>{busca || fStatus ? 'Nenhum item para os filtros neste mês.' : 'Nenhum agendamento neste mês.'}</p>
              </div>
            ) : (
              <AgendaCalendarView
                items={filteredCalendario}
                calendarYm={calendarYm}
                onCalendarYmChange={setCalendarYm}
                selectedId={selectedAgendamento?.id ?? null}
                onEventClick={handleCalendarEventClick}
                onClearSelection={closeCalPopover}
              />
            )}
            {selectedAgendamento &&
              calPopoverAnchor &&
              createPortal(
                <AgendaCalEventPopover
                  agendamento={selectedAgendamento}
                  anchor={calPopoverAnchor}
                  podeAgir={podeAgirNoItem(selectedAgendamento)}
                  isAdmin={!!isAdmin}
                  isSdrRole={!!isSdrRole}
                  disabled={marcandoId === selectedAgendamento.id}
                  onClose={closeCalPopover}
                  onRealizada={() => {
                    closeCalPopover()
                    setRealizadaPara(selectedAgendamento)
                  }}
                  onNoShow={() => void handleNoShow(selectedAgendamento)}
                  onVenda={() => {
                    closeCalPopover()
                    setVendaPara(selectedAgendamento)
                  }}
                  onReagendar={() => {
                    closeCalPopover()
                    setReagendarPara(selectedAgendamento)
                  }}
                  onAdminDesfecho={(action) => abrirDesfechoAdmin(selectedAgendamento, action, true)}
                />,
                document.body
              )}
          </div>
        )}
        {!error && viewMode === 'lista' && (rows.length > 0 || !loading) && (
          <div className="tw">
            {filteredLista.length === 0 ? (
              <div className="empty">
                <div className="empty-icon" aria-hidden>
                  <CalendarClock size={40} strokeWidth={1.4} />
                </div>
                <p>{busca || fStatus ? 'Nenhum item para os filtros.' : 'Nenhum agendamento no período.'}</p>
              </div>
            ) : (
              <table className="agenda-table">
                <colgroup>
                  <col className="agenda-col-data" />
                  <col className="agenda-col-lead" />
                  <col className="agenda-col-origem" />
                  <col className="agenda-col-sdr" />
                  <col className="agenda-col-squad" />
                  <col className="agenda-col-status" />
                  <col className="agenda-col-qual" />
                  <col className="agenda-col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Nome do lead</th>
                    <th>Origem do lead</th>
                    <th>SDR</th>
                    <th>Squad</th>
                    <th>Status</th>
                    <th>Qualif. SDR</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLista.map((a) => (
                    <tr key={a.id}>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {fdt(a.data)}
                      </td>
                      <td className="agenda-td-text" style={{ fontWeight: 600 }}>
                        <span
                          className="chip agenda-chip"
                          title={a.grupoWpp}
                          style={{ borderColor: 'rgba(34,197,94,.35)', color: 'var(--green)' }}
                        >
                          {a.grupoWpp}
                        </span>
                      </td>
                      <td className="agenda-td-text">
                        {a.origemLead ? (
                          <span className="chip agenda-chip" title={a.origemLead}>
                            {a.origemLead}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="agenda-td-text">
                        <strong className="agenda-td-ellipsis">{a.sdrUserName}</strong>
                      </td>
                      <td className="agenda-td-text" style={{ fontSize: 12, color: 'var(--text2)' }}>
                        <span className="agenda-td-ellipsis">{a.squadNome}</span>
                      </td>
                      <td className="agenda-td-status">
                        <span
                          className={`badge ${AGENDAMENTO_STATUS_BADGE[a.status]}`}
                          title={
                            a.closerUserName
                              ? `${AGENDAMENTO_STATUS_LABEL[a.status]} · Closer: ${a.closerUserName}`
                              : AGENDAMENTO_STATUS_LABEL[a.status]
                          }
                        >
                          {AGENDAMENTO_STATUS_LABEL[a.status]}
                        </span>
                      </td>
                      <td className="agenda-td-qual" style={{ fontSize: 12 }}>
                        {(a.status === 'realizada' || a.status === 'venda') && a.qualificacaoSdr ? (
                          <span
                            className={`badge ${AGENDAMENTO_QUAL_BADGE[a.qualificacaoSdr]}`}
                            title={QUALIFICACAO_SDR_LABELS[a.qualificacaoSdr]}
                          >
                            {QUALIFICACAO_SDR_LABELS[a.qualificacaoSdr]}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text3)' }}>—</span>
                        )}
                      </td>
                      <td className="agenda-td-actions">{renderActions(a)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {vendaPara &&
        currentUser &&
        createPortal(
          <AgendaVendaModal
            agendamento={vendaPara}
            closer={currentUser}
            adminOverride={adminDesfechoEdit}
            onClose={() => {
              setVendaPara(null)
              setAdminDesfechoEdit(false)
            }}
          />,
          document.body
        )}
      {realizadaPara &&
        currentUser &&
        createPortal(
          <AgendaRealizadaModal
            agendamento={realizadaPara}
            closer={currentUser}
            adminOverride={adminDesfechoEdit}
            onClose={() => {
              setRealizadaPara(null)
              setAdminDesfechoEdit(false)
            }}
          />,
          document.body
        )}
      {reagendarPara &&
        currentUser &&
        createPortal(
          <AgendaReagendarModal
            agendamento={reagendarPara}
            closer={currentUser}
            onClose={() => setReagendarPara(null)}
          />,
          document.body
        )}
    </div>
  )
}
