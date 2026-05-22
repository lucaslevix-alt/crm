import { CalendarPlus, CheckCircle2, CircleDollarSign, UserX, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { AgendamentoRow, AgendamentoStatus } from '../../firebase/firestore'
import {
  AGENDAMENTO_QUAL_BADGE,
  AGENDAMENTO_STATUS_BADGE,
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

function PopoverActions({
  a,
  isAdmin,
  disabled,
  onRealizada,
  onNoShow,
  onVenda,
  onReagendar,
  onAdminDesfecho,
  onClose
}: {
  a: AgendamentoRow
  isAdmin: boolean
  disabled: boolean
  onRealizada: () => void
  onNoShow: () => void
  onVenda: () => void
  onReagendar: () => void
  onAdminDesfecho: (action: 'realizada' | 'no_show' | 'venda') => void
  onClose: () => void
}) {
  const pick = (fn: () => void) => {
    onClose()
    fn()
  }

  if (a.status === 'agendada' || a.status === 'reagendada') {
    return (
      <div className="agenda-cal-pop-actions">
        <span className="agenda-cal-pop-actions-label">Desfecho</span>
        <OutcomeBtn onClick={() => pick(onRealizada)} disabled={disabled}>
          <CheckCircle2 size={16} strokeWidth={1.65} aria-hidden />
          Realizada
        </OutcomeBtn>
        <OutcomeBtn onClick={() => pick(onNoShow)} disabled={disabled}>
          <UserX size={16} strokeWidth={1.65} aria-hidden />
          No show
        </OutcomeBtn>
        <OutcomeBtn onClick={() => pick(onVenda)} disabled={disabled} primary>
          <CircleDollarSign size={16} strokeWidth={1.65} aria-hidden />
          Venda
        </OutcomeBtn>
      </div>
    )
  }

  if (a.status === 'no_show') {
    return (
      <div className="agenda-cal-pop-actions">
        <OutcomeBtn onClick={() => pick(onReagendar)} disabled={disabled}>
          <CalendarPlus size={16} strokeWidth={1.75} aria-hidden />
          Reagendar
        </OutcomeBtn>
        {isAdmin && (
          <>
            <span className="agenda-cal-pop-actions-label">Editar desfecho</span>
            <OutcomeBtn onClick={() => pick(() => onAdminDesfecho('realizada'))} disabled={disabled}>
              <CheckCircle2 size={16} strokeWidth={1.65} aria-hidden />
              Realizada
            </OutcomeBtn>
            <OutcomeBtn onClick={() => pick(() => onAdminDesfecho('no_show'))} disabled={disabled}>
              <UserX size={16} strokeWidth={1.65} aria-hidden />
              No show
            </OutcomeBtn>
            <OutcomeBtn onClick={() => pick(() => onAdminDesfecho('venda'))} disabled={disabled} primary>
              <CircleDollarSign size={16} strokeWidth={1.65} aria-hidden />
              Venda
            </OutcomeBtn>
          </>
        )}
      </div>
    )
  }

  if (a.status === 'realizada' && !isAdmin) {
    return (
      <div className="agenda-cal-pop-actions">
        <OutcomeBtn onClick={() => pick(onVenda)} disabled={disabled} primary>
          <CircleDollarSign size={16} strokeWidth={1.65} aria-hidden />
          Registrar venda
        </OutcomeBtn>
      </div>
    )
  }

  if (isAdmin && (a.status === 'realizada' || a.status === 'venda')) {
    return (
      <div className="agenda-cal-pop-actions">
        <span className="agenda-cal-pop-actions-label">Editar desfecho</span>
        <OutcomeBtn onClick={() => pick(() => onAdminDesfecho('realizada'))} disabled={disabled}>
          <CheckCircle2 size={16} strokeWidth={1.65} aria-hidden />
          Realizada
        </OutcomeBtn>
        <OutcomeBtn onClick={() => pick(() => onAdminDesfecho('no_show'))} disabled={disabled}>
          <UserX size={16} strokeWidth={1.65} aria-hidden />
          No show
        </OutcomeBtn>
        <OutcomeBtn
          onClick={() => pick(() => onAdminDesfecho('venda'))}
          disabled={disabled || a.status === 'venda'}
          primary
        >
          <CircleDollarSign size={16} strokeWidth={1.65} aria-hidden />
          Venda
        </OutcomeBtn>
      </div>
    )
  }

  return null
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
  onAdminDesfecho
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
        className="agenda-cal-pop"
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
        {(a.status === 'realizada' || a.status === 'venda') && a.qualificacaoSdr && (
          <p className="agenda-cal-pop-qual">
            Qualif. SDR:{' '}
            <span className={`badge ${AGENDAMENTO_QUAL_BADGE[a.qualificacaoSdr]}`}>
              {QUALIFICACAO_SDR_LABELS[a.qualificacaoSdr]}
            </span>
          </p>
        )}
        {podeAgir ? (
          <PopoverActions
            a={a}
            isAdmin={isAdmin}
            disabled={disabled}
            onRealizada={onRealizada}
            onNoShow={onNoShow}
            onVenda={onVenda}
            onReagendar={onReagendar}
            onAdminDesfecho={onAdminDesfecho}
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
