import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarClock, CalendarPlus, CheckCircle2, ChevronDown, CircleDollarSign, UserX } from 'lucide-react'
import {
  listAgendamentos,
  marcarAgendamentoNoShow,
  resolveSquadForUserId,
  type AgendamentoRow,
  type AgendamentoStatus
} from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { useAppStore } from '../store/useAppStore'
import { AgendaVendaModal } from '../components/agenda/AgendaVendaModal'
import { AgendaRealizadaModal } from '../components/agenda/AgendaRealizadaModal'
import { AgendaReagendarModal } from '../components/agenda/AgendaReagendarModal'
import { QUALIFICACAO_SDR_LABELS, type QualificacaoSdr } from '../lib/qualificacaoSdr'

function today(): string {
  return new Date().toISOString().split('T')[0]
}

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
  const td = today()
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

const STATUS_LABEL: Record<AgendamentoStatus, string> = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  venda: 'Venda',
  no_show: 'No show',
  reagendada: 'Reagendada'
}

const STATUS_BADGE: Record<AgendamentoStatus, string> = {
  agendada: 'b-sdr',
  realizada: 'b-green',
  venda: 'b-amber',
  no_show: 'b-no-show',
  reagendada: 'b-closer'
}

const QUAL_BADGE: Record<QualificacaoSdr, string> = {
  qualificada: 'b-green',
  pendente: 'b-amber',
  nao_qualificada: 'b-no-show'
}

type MenuRect = { top: number; right: number; minWidth: number }

function AgendaCloserOutcomeMenu({
  disabled,
  variant,
  onPick
}: {
  disabled: boolean
  variant: 'agendada' | 'realizada'
  onPick: (action: 'realizada' | 'no_show' | 'venda') => void
}) {
  const [open, setOpen] = useState(false)
  const [menuRect, setMenuRect] = useState<MenuRect | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const placeMenu = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const minWidth = Math.max(176, Math.ceil(r.width))
    const right = Math.max(8, window.innerWidth - r.right)
    setMenuRect({ top: Math.round(r.bottom + 4), right, minWidth })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setMenuRect(null)
      return
    }
    placeMenu()
  }, [open, placeMenu])

  useEffect(() => {
    if (!open) return
    const onScrollOrResize = () => placeMenu()
    window.addEventListener('resize', onScrollOrResize)
    window.addEventListener('scroll', onScrollOrResize, true)
    return () => {
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('scroll', onScrollOrResize, true)
    }
  }, [open, placeMenu])

  useEffect(() => {
    if (!open) return
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const menuBody =
    variant === 'agendada' ? (
      <>
        <button
          type="button"
          className="agenda-dd-item"
          role="menuitem"
          onClick={() => {
            setOpen(false)
            onPick('realizada')
          }}
        >
          <CheckCircle2 size={16} strokeWidth={1.65} aria-hidden />
          Realizada
        </button>
        <button
          type="button"
          className="agenda-dd-item"
          role="menuitem"
          onClick={() => {
            setOpen(false)
            onPick('no_show')
          }}
        >
          <UserX size={16} strokeWidth={1.65} aria-hidden />
          No show
        </button>
        <button
          type="button"
          className="agenda-dd-item agenda-dd-item--primary"
          role="menuitem"
          onClick={() => {
            setOpen(false)
            onPick('venda')
          }}
        >
          Venda
        </button>
      </>
    ) : (
      <button
        type="button"
        className="agenda-dd-item agenda-dd-item--primary"
        role="menuitem"
        onClick={() => {
          setOpen(false)
          onPick('venda')
        }}
      >
        <CircleDollarSign size={16} strokeWidth={1.65} aria-hidden />
        Registrar venda
      </button>
    )

  return (
    <div className="agenda-dd" ref={wrapRef}>
      <button
        type="button"
        className="btn btn-ghost btn-sm agenda-dd-trigger"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        Desfecho
        <ChevronDown size={14} strokeWidth={2} aria-hidden className="agenda-dd-chevron" />
      </button>
      {open &&
        menuRect &&
        createPortal(
          <div
            ref={menuRef}
            className="agenda-dd-menu"
            style={{
              top: menuRect.top,
              right: menuRect.right,
              minWidth: menuRect.minWidth
            }}
            role="menu"
          >
            {menuBody}
          </div>,
          document.body
        )}
    </div>
  )
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

  const isAdmin = currentUser?.cargo === 'admin'
  const isCloser = currentUser?.cargo === 'closer'

  const load = useCallback(async () => {
    if (!currentUser) return
    setLoading(true)
    setError(null)
    try {
      const squad = await resolveSquadForUserId(currentUser.id)
      setMySquadId(squad?.squadId ?? null)
      const list = await listAgendamentos({
        squadId: squad?.squadId ?? null,
        admin: isAdmin
      })
      setRows(list)
    } catch (e) {
      setError(formatFirebaseOrUnknownError(e) || 'Erro ao carregar')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [currentUser, isAdmin])

  useEffect(() => {
    void load()
  }, [load, registrosVersion])

  const { start, end } = getRegRange(regPeriod, customDate)

  const filtered = rows.filter((r) => {
    if (r.data < start || r.data > end) return false
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
  })

  function podeAgirNoItem(a: AgendamentoRow): boolean {
    if (!currentUser) return false
    if (!(isAdmin || isCloser)) return false
    if (isAdmin) return true
    return a.squadId === mySquadId
  }

  async function handleNoShow(a: AgendamentoRow) {
    if (!currentUser) return
    if (!window.confirm('Marcar como no show? O lead não compareceu — será criado um registo para métricas (SDR).')) return
    setMarcandoId(a.id)
    try {
      await marcarAgendamentoNoShow({
        agendamentoId: a.id,
        closer: { id: currentUser.id, nome: currentUser.nome, cargo: currentUser.cargo }
      })
      showToast('Marcado como no show.')
      incrementRegistrosVersion()
      void load()
    } catch (e) {
      showToast('Erro: ' + formatFirebaseOrUnknownError(e), 'err')
    } finally {
      setMarcandoId(null)
    }
  }

  return (
    <div className="content">
      <div className="page-title-row" style={{ marginBottom: 16 }}>
        <CalendarClock size={26} strokeWidth={1.65} aria-hidden />
        <h1 className="page-title">Agenda do squad</h1>
      </div>
      <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 16, maxWidth: 720 }}>
        Reuniões agendadas pelo SDR (barra rápida «Agendei reunião»). O closer usa o menu{' '}
        <strong>Desfecho</strong> na linha para escolher realizada, no show ou venda. Após{' '}
        <strong>no show</strong>, pode <strong>reagendar</strong> com nova data — não cria outra reunião agendada; ao
        marcar realizada depois, conta como realizada. Administradores veem todos os squads.
      </p>

      {!isAdmin && !mySquadId && (
        <div className="card" style={{ padding: 14, marginBottom: 16, borderColor: 'rgba(234,179,8,.35)', color: 'var(--text2)' }}>
          Ainda não está num squad: a lista fica vazia até um administrador o associar a um squad.
        </div>
      )}

      <div className="ctrl-row" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <span className="ctrl-label">Período:</span>
        <button type="button" className={`prd-btn ${regPeriod === '7d' ? 'active' : ''}`} onClick={() => setRegPeriod('7d')}>
          7 dias
        </button>
        <button type="button" className={`prd-btn ${regPeriod === '14d' ? 'active' : ''}`} onClick={() => setRegPeriod('14d')}>
          14 dias
        </button>
        <button type="button" className={`prd-btn ${regPeriod === 'mes' ? 'active' : ''}`} onClick={() => setRegPeriod('mes')}>
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
            if (e.target.value) setRegPeriod('custom')
          }}
          title="Data específica"
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div className="fg" style={{ margin: 0 }}>
            <label>Status</label>
            <select className="di" value={fStatus} onChange={(e) => setFStatus((e.target.value as AgendamentoStatus | '') || '')}>
              <option value="">Todos</option>
              <option value="agendada">Agendada</option>
              <option value="realizada">Realizada</option>
              <option value="venda">Venda</option>
              <option value="no_show">No show</option>
              <option value="reagendada">Reagendada</option>
            </select>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="fg" style={{ margin: 0 }}>
            <label>Busca</label>
            <input
              type="text"
              className="di"
              placeholder="Nome do lead, origem, SDR…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card">
        {loading && (
          <div className="loading">
            <div className="spin" />
            A carregar…
          </div>
        )}
        {error && <div style={{ color: 'var(--red)', padding: 16 }}>Erro: {error}</div>}
        {!loading && !error && (
          <div className="tw">
            {filtered.length === 0 ? (
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
                  {filtered.map((a) => (
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
                          className={`badge ${STATUS_BADGE[a.status]}`}
                          title={
                            a.closerUserName
                              ? `${STATUS_LABEL[a.status]} · Closer: ${a.closerUserName}`
                              : STATUS_LABEL[a.status]
                          }
                        >
                          {STATUS_LABEL[a.status]}
                        </span>
                      </td>
                      <td className="agenda-td-qual" style={{ fontSize: 12 }}>
                        {(a.status === 'realizada' || a.status === 'venda') && a.qualificacaoSdr ? (
                          <span
                            className={`badge ${QUAL_BADGE[a.qualificacaoSdr]}`}
                            title={QUALIFICACAO_SDR_LABELS[a.qualificacaoSdr]}
                          >
                            {QUALIFICACAO_SDR_LABELS[a.qualificacaoSdr]}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text3)' }}>—</span>
                        )}
                      </td>
                      <td className="agenda-td-actions">
                        {(a.status === 'agendada' || a.status === 'reagendada') && podeAgirNoItem(a) && currentUser && (
                          <AgendaCloserOutcomeMenu
                            variant="agendada"
                            disabled={marcandoId === a.id}
                            onPick={(action) => {
                              if (action === 'realizada') setRealizadaPara(a)
                              else if (action === 'no_show') void handleNoShow(a)
                              else setVendaPara(a)
                            }}
                          />
                        )}
                        {a.status === 'no_show' && podeAgirNoItem(a) && currentUser && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm agenda-dd-trigger"
                            disabled={marcandoId === a.id}
                            onClick={() => setReagendarPara(a)}
                            title="Nova data da reunião — não duplica agendada do SDR"
                          >
                            <CalendarPlus size={14} strokeWidth={1.75} aria-hidden style={{ marginRight: 4 }} />
                            Reagendar
                          </button>
                        )}
                        {a.status === 'realizada' && podeAgirNoItem(a) && currentUser && (
                          <AgendaCloserOutcomeMenu
                            variant="realizada"
                            disabled={marcandoId === a.id}
                            onPick={(action) => {
                              if (action === 'venda') setVendaPara(a)
                            }}
                          />
                        )}
                      </td>
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
          <AgendaVendaModal agendamento={vendaPara} closer={currentUser} onClose={() => setVendaPara(null)} />,
          document.body
        )}
      {realizadaPara &&
        currentUser &&
        createPortal(
          <AgendaRealizadaModal
            agendamento={realizadaPara}
            closer={currentUser}
            onClose={() => setRealizadaPara(null)}
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
