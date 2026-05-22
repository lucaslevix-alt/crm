import { CalendarPlus, CheckCircle2, ChevronDown, CircleDollarSign, UserX } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AgendamentoRow, AgendamentoStatus } from '../../firebase/firestore'

type MenuRect = { top: number; right: number; minWidth: number }

function AgendaCloserOutcomeMenu({
  disabled,
  variant,
  currentStatus,
  onPick
}: {
  disabled: boolean
  variant: 'agendada' | 'realizada' | 'admin-finalizado'
  currentStatus?: AgendamentoStatus
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
    variant === 'admin-finalizado' ? (
      <>
        <button type="button" className="agenda-dd-item" role="menuitem" onClick={() => { setOpen(false); onPick('realizada') }}>
          <CheckCircle2 size={16} strokeWidth={1.65} aria-hidden />
          Realizada
        </button>
        <button
          type="button"
          className="agenda-dd-item"
          role="menuitem"
          disabled={currentStatus === 'no_show'}
          onClick={() => { setOpen(false); onPick('no_show') }}
        >
          <UserX size={16} strokeWidth={1.65} aria-hidden />
          No show
        </button>
        <button
          type="button"
          className="agenda-dd-item agenda-dd-item--primary"
          role="menuitem"
          disabled={currentStatus === 'venda'}
          onClick={() => { setOpen(false); onPick('venda') }}
        >
          <CircleDollarSign size={16} strokeWidth={1.65} aria-hidden />
          Venda
        </button>
      </>
    ) : variant === 'agendada' ? (
      <>
        <button type="button" className="agenda-dd-item" role="menuitem" onClick={() => { setOpen(false); onPick('realizada') }}>
          <CheckCircle2 size={16} strokeWidth={1.65} aria-hidden />
          Realizada
        </button>
        <button type="button" className="agenda-dd-item" role="menuitem" onClick={() => { setOpen(false); onPick('no_show') }}>
          <UserX size={16} strokeWidth={1.65} aria-hidden />
          No show
        </button>
        <button type="button" className="agenda-dd-item agenda-dd-item--primary" role="menuitem" onClick={() => { setOpen(false); onPick('venda') }}>
          Venda
        </button>
      </>
    ) : (
      <button type="button" className="agenda-dd-item agenda-dd-item--primary" role="menuitem" onClick={() => { setOpen(false); onPick('venda') }}>
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
        {variant === 'admin-finalizado' ? 'Editar desfecho' : 'Desfecho'}
        <ChevronDown size={14} strokeWidth={2} aria-hidden className="agenda-dd-chevron" />
      </button>
      {open &&
        menuRect &&
        createPortal(
          <div
            ref={menuRef}
            className="agenda-dd-menu"
            style={{ top: menuRect.top, right: menuRect.right, minWidth: menuRect.minWidth }}
            role="menu"
          >
            {menuBody}
          </div>,
          document.body
        )}
    </div>
  )
}

export interface AgendaRowActionsProps {
  a: AgendamentoRow
  podeAgir: boolean
  isAdmin: boolean
  disabled: boolean
  onRealizada: () => void
  onNoShow: () => void
  onVenda: () => void
  onReagendar: () => void
  onAdminDesfecho: (action: 'realizada' | 'no_show' | 'venda') => void
}

export function AgendaRowActions({
  a,
  podeAgir,
  isAdmin,
  disabled,
  onRealizada,
  onNoShow,
  onVenda,
  onReagendar,
  onAdminDesfecho
}: AgendaRowActionsProps) {
  if (!podeAgir) return null
  return (
    <>
      {(a.status === 'agendada' || a.status === 'reagendada') && (
        <AgendaCloserOutcomeMenu
          variant="agendada"
          disabled={disabled}
          onPick={(action) => {
            if (action === 'realizada') onRealizada()
            else if (action === 'no_show') onNoShow()
            else onVenda()
          }}
        />
      )}
      {a.status === 'no_show' && (
        <button
          type="button"
          className="btn btn-ghost btn-sm agenda-dd-trigger"
          disabled={disabled}
          onClick={onReagendar}
          title="Nova data da reunião"
        >
          <CalendarPlus size={14} strokeWidth={1.75} aria-hidden style={{ marginRight: 4 }} />
          Reagendar
        </button>
      )}
      {a.status === 'realizada' && !isAdmin && (
        <AgendaCloserOutcomeMenu variant="realizada" disabled={disabled} onPick={(action) => { if (action === 'venda') onVenda() }} />
      )}
      {isAdmin && (a.status === 'realizada' || a.status === 'venda' || a.status === 'no_show') && (
        <AgendaCloserOutcomeMenu
          variant="admin-finalizado"
          currentStatus={a.status}
          disabled={disabled}
          onPick={onAdminDesfecho}
        />
      )}
    </>
  )
}
