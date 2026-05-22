import { CalendarPlus, CheckCircle2, CircleDollarSign, Trash2, UserX, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { AgendamentoRow, AgendamentoStatus } from '../../firebase/firestore'
import {
  AGENDAMENTO_QUAL_BADGE,
  AGENDAMENTO_STATUS_BADGE,
  AGENDAMENTO_STATUS_CAL_CLASS,
  AGENDAMENTO_STATUS_LABEL,
  QUALIFICACAO_SDR_LABELS
} from '../../lib/agendaConstants'

function fdt(s: string): string {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

export interface AgendaCalEventPopoverProps {
  agendamento: AgendamentoRow
  anchor: DOMRect
  podeAgir: boolean
  isAdmin: boolean
  isSdrRole: boolean
  disabled: boolean
  onClose: () => void
  onRealizada: () => void
  onNoShow: () => void
  onVenda: () => void
  onReagendar: () => void
  onAdminDesfecho: (action: 'realizada' | 'no_show' | 'venda') => void
  onAdminQualificacao?: () => void
  onAdminEditRegistro?: () => void
  podeExcluir: boolean
  onExcluir: () => void
}

function OutcomeBtn({
  children,
  onClick,
  disabled,
  primary
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  primary?: boolean
}) {
  return (
    <button
      type="button"
      className={`agenda-cal-pop-btn${primary ? ' agenda-cal-pop-btn--primary' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function PopDivider() {
  return <div className="agenda-cal-pop-divider" role="separator" />
}

function PopoverActions({
  a,
  isAdmin,
  podeAgir,
  podeExcluir,
  disabled,
  onRealizada,
  onNoShow,
  onVenda,
  onReagendar,
  onAdminDesfecho,
  onExcluir,
  onClose
}: {
  a: AgendamentoRow
  isAdmin: boolean
  podeAgir: boolean
  podeExcluir: boolean
  disabled: boolean
  onRealizada: () => void
  onNoShow: () => void
  onVenda: () => void
  onReagendar: () => void
  onAdminDesfecho: (action: 'realizada' | 'no_show' | 'venda') => void
  onExcluir: () => void
  onClose: () => void
}) {
  const pick = (fn: () => void) => {
    onClose()
    fn()
  }

  const st = a.status
  const label =
    st === 'agendada' || st === 'reagendada' || (st === 'realizada' && !isAdmin)
      ? 'Desfecho'
      : 'Editar desfecho'

  const showDesfechoBlock =
    (podeAgir && (st === 'agendada' || st === 'reagendada' || (st === 'realizada' && !isAdmin))) ||
    (isAdmin && podeAgir && (st === 'realizada' || st === 'venda' || st === 'no_show'))

  const showNoShowMenu = st === 'no_show' && (podeAgir || (isAdmin && podeExcluir))

  if (!showDesfechoBlock && !showNoShowMenu && !podeExcluir) return null

  return (
    <div className="agenda-cal-pop-actions">
      <span className="agenda-cal-pop-actions-label">{label}</span>

      {st === 'no_show' && podeAgir && (
        <OutcomeBtn onClick={() => pick(onReagendar)} disabled={disabled}>
          <CalendarPlus size={16} strokeWidth={1.75} aria-hidden />
          Reagendar
        </OutcomeBtn>
      )}

      {podeAgir && (st === 'agendada' || st === 'reagendada') && (
        <>
          <OutcomeBtn onClick={() => pick(onRealizada)} disabled={disabled}>
            <CheckCircle2 size={16} strokeWidth={1.65} aria-hidden />
            Realizada
          </OutcomeBtn>
          <OutcomeBtn onClick={() => pick(onNoShow)} disabled={disabled}>
            <UserX size={16} strokeWidth={1.65} aria-hidden />
            No show
          </OutcomeBtn>
          <OutcomeBtn onClick={() => pick(onVenda)} disabled={disabled} primary>
            Venda
          </OutcomeBtn>
        </>
      )}

      {podeAgir && st === 'realizada' && !isAdmin && (
        <OutcomeBtn onClick={() => pick(onVenda)} disabled={disabled} primary>
          <CircleDollarSign size={16} strokeWidth={1.65} aria-hidden />
          Registrar venda
        </OutcomeBtn>
      )}

      {isAdmin && podeAgir && (st === 'realizada' || st === 'venda' || st === 'no_show') && (
        <>
          {st === 'no_show' && <PopDivider />}
          <OutcomeBtn onClick={() => pick(() => onAdminDesfecho('realizada'))} disabled={disabled}>
            <CheckCircle2 size={16} strokeWidth={1.65} aria-hidden />
            Realizada
          </OutcomeBtn>
          <OutcomeBtn
            onClick={() => pick(() => onAdminDesfecho('no_show'))}
            disabled={disabled || st === 'no_show'}
          >
            <UserX size={16} strokeWidth={1.65} aria-hidden />
            No show
          </OutcomeBtn>
          <OutcomeBtn
            onClick={() => pick(() => onAdminDesfecho('venda'))}
            disabled={disabled || st === 'venda'}
            primary
          >
            <CircleDollarSign size={16} strokeWidth={1.65} aria-hidden />
            Venda
          </OutcomeBtn>
        </>
      )}

      {podeExcluir && (
        <>
          <PopDivider />
          <button
            type="button"
            className="agenda-cal-pop-btn agenda-cal-pop-btn--danger"
            disabled={disabled}
            onClick={() => pick(onExcluir)}
          >
            <Trash2 size={16} strokeWidth={1.75} aria-hidden style={{ marginRight: 6, verticalAlign: -2 }} />
            Remover da agenda
          </button>
        </>
      )}
    </div>
  )
}

export function AgendaCalEventPopover({
  agendamento: a,
  anchor,
  podeAgir,
  isAdmin,
  isSdrRole,
  disabled,
  onClose,
  onRealizada,
  onNoShow,
  onVenda,
  onReagendar,
  onAdminDesfecho,
  onAdminQualificacao,
  onAdminEditRegistro,
  podeExcluir,
  onExcluir
}: AgendaCalEventPopoverProps) {
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: anchor.bottom + 6, left: anchor.left })

  const placePopover = useCallback(() => {
    const el = popRef.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    const margin = 8
    let top = anchor.bottom + 6
    if (top + h > window.innerHeight - margin) {
      top = anchor.top - h - 6
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - h - margin))
    let left = anchor.left
    if (left + w > window.innerWidth - margin) {
      left = window.innerWidth - w - margin
    }
    left = Math.max(margin, left)
    setPos({ top: Math.round(top), left: Math.round(left) })
  }, [anchor])

  useLayoutEffect(() => {
    placePopover()
  }, [placePopover, a.id, a.status, podeAgir])

  useEffect(() => {
    const onScrollOrResize = () => placePopover()
    window.addEventListener('resize', onScrollOrResize)
    window.addEventListener('scroll', onScrollOrResize, true)
    return () => {
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('scroll', onScrollOrResize, true)
    }
  }, [placePopover])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <>
      <div className="agenda-cal-pop-backdrop" onClick={onClose} aria-hidden />
      <div
        ref={popRef}
        className={`agenda-cal-pop ${AGENDAMENTO_STATUS_CAL_CLASS[a.status]}`}
        style={{ top: pos.top, left: pos.left }}
        role="dialog"
        aria-labelledby="agenda-cal-pop-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="agenda-cal-pop-head">
          <div className="agenda-cal-pop-head-text">
            <h3 id="agenda-cal-pop-title" className="agenda-cal-pop-title">
              {a.grupoWpp}
            </h3>
            <p className="agenda-cal-pop-meta">
              {fdt(a.data)}
              {a.closerUserName ? ` · ${a.closerUserName}` : ''}
            </p>
          </div>
          <button type="button" className="agenda-cal-pop-close" onClick={onClose} aria-label="Fechar">
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <span className={`badge ${AGENDAMENTO_STATUS_BADGE[a.status as AgendamentoStatus]}`}>
          {AGENDAMENTO_STATUS_LABEL[a.status]}
        </span>
        {(a.status === 'realizada' || a.status === 'venda') && (
          <p className="agenda-cal-pop-qual">
            Qualif. SDR:{' '}
            {a.qualificacaoSdr ? (
              <span className={`badge ${AGENDAMENTO_QUAL_BADGE[a.qualificacaoSdr]}`}>
                {QUALIFICACAO_SDR_LABELS[a.qualificacaoSdr]}
              </span>
            ) : (
              <span style={{ color: 'var(--text3)' }}>—</span>
            )}
          </p>
        )}
        {isAdmin && (a.status === 'realizada' || a.status === 'venda') && a.registroRealizadaSdrId && (
          <div className="agenda-cal-pop-admin">
            <button type="button" className="agenda-cal-pop-btn" onClick={() => { onClose(); onAdminQualificacao?.() }}>
              Qualificação SDR
            </button>
            {onAdminEditRegistro && (
              <button type="button" className="agenda-cal-pop-btn" onClick={() => { onClose(); onAdminEditRegistro() }}>
                Editar registo
              </button>
            )}
          </div>
        )}
        {(podeAgir || podeExcluir) ? (
          <PopoverActions
            a={a}
            isAdmin={isAdmin}
            podeAgir={podeAgir}
            podeExcluir={podeExcluir}
            disabled={disabled}
            onRealizada={onRealizada}
            onNoShow={onNoShow}
            onVenda={onVenda}
            onReagendar={onReagendar}
            onAdminDesfecho={onAdminDesfecho}
            onExcluir={onExcluir}
            onClose={onClose}
          />
        ) : (
          <p className="agenda-cal-pop-hint">
            {isSdrRole
              ? 'O closer do squad regista o desfecho neste evento.'
              : 'Sem permissão para alterar este agendamento.'}
          </p>
        )}
      </div>
    </>,
    document.body
  )
}
