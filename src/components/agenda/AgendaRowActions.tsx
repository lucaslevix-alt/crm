import { CalendarPlus, CheckCircle2, ChevronDown, CircleDollarSign, Trash2, UserX } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { AgendamentoRow } from '../../firebase/firestore'

type MenuRect = { top: number; right: number; minWidth: number }

function AgendaActionsMenu({
  label,
  disabled,
  children
}: {
  label: string
  disabled: boolean
  children: ReactNode
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
        {label}
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
            {children}
          </div>,
          document.body
        )}
    </div>
  )
}

function MenuDivider() {
  return <div className="agenda-dd-divider" role="separator" />
}

function MenuItem({
  children,
  onClick,
  disabled: itemDisabled,
  primary,
  danger
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  primary?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      className={`agenda-dd-item${primary ? ' agenda-dd-item--primary' : ''}${danger ? ' agenda-dd-item--danger' : ''}`}
      role="menuitem"
      disabled={itemDisabled}
      onClick={onClick}
    >
      {children}
    </button>
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
  onAdminQualificacao?: () => void
  onAdminEditRegistro?: () => void
  podeExcluir?: boolean
  onExcluir?: () => void
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
  onAdminDesfecho,
  onAdminQualificacao,
  onAdminEditRegistro,
  podeExcluir,
  onExcluir
}: AgendaRowActionsProps) {
  const showAdminQual =
    isAdmin &&
    (a.status === 'realizada' || a.status === 'venda') &&
    a.registroRealizadaSdrId &&
    (onAdminQualificacao || onAdminEditRegistro)

  const close = (fn: () => void) => () => fn()

  function renderMenu(): { label: string; body: ReactNode } | null {
    const st = a.status

    if (podeAgir && (st === 'agendada' || st === 'reagendada')) {
      return {
        label: 'Desfecho',
        body: (
          <>
            <MenuItem onClick={close(onRealizada)}>
              <CheckCircle2 size={16} strokeWidth={1.65} aria-hidden />
              Realizada
            </MenuItem>
            <MenuItem onClick={close(onNoShow)}>
              <UserX size={16} strokeWidth={1.65} aria-hidden />
              No show
            </MenuItem>
            <MenuItem onClick={close(onVenda)} primary>
              Venda
            </MenuItem>
            {podeExcluir && onExcluir && (
              <>
                <MenuDivider />
                <MenuItem onClick={close(onExcluir)} danger>
                  <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                  Remover
                </MenuItem>
              </>
            )}
          </>
        )
      }
    }

    if (st === 'no_show' && (podeAgir || (isAdmin && podeExcluir && onExcluir))) {
      const label = isAdmin ? 'Editar desfecho' : 'Ações'
      return {
        label,
        body: (
          <>
            {podeAgir && (
              <MenuItem onClick={close(onReagendar)}>
                <CalendarPlus size={16} strokeWidth={1.75} aria-hidden />
                Reagendar
              </MenuItem>
            )}
            {isAdmin && podeAgir && (
              <>
                <MenuDivider />
                <MenuItem onClick={close(() => onAdminDesfecho('realizada'))}>
                  <CheckCircle2 size={16} strokeWidth={1.65} aria-hidden />
                  Realizada
                </MenuItem>
                <MenuItem onClick={close(() => onAdminDesfecho('no_show'))} disabled>
                  <UserX size={16} strokeWidth={1.65} aria-hidden />
                  No show
                </MenuItem>
                <MenuItem onClick={close(() => onAdminDesfecho('venda'))} primary>
                  <CircleDollarSign size={16} strokeWidth={1.65} aria-hidden />
                  Venda
                </MenuItem>
              </>
            )}
            {podeExcluir && onExcluir && (
              <>
                <MenuDivider />
                <MenuItem onClick={close(onExcluir)} danger>
                  <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                  Remover
                </MenuItem>
              </>
            )}
          </>
        )
      }
    }

    if (podeAgir && st === 'realizada' && !isAdmin) {
      return {
        label: 'Desfecho',
        body: (
          <MenuItem onClick={close(onVenda)} primary>
            <CircleDollarSign size={16} strokeWidth={1.65} aria-hidden />
            Registrar venda
          </MenuItem>
        )
      }
    }

    if (podeAgir && isAdmin && (st === 'realizada' || st === 'venda')) {
      return {
        label: 'Editar desfecho',
        body: (
          <>
            <MenuItem onClick={close(() => onAdminDesfecho('realizada'))}>
              <CheckCircle2 size={16} strokeWidth={1.65} aria-hidden />
              Realizada
            </MenuItem>
            <MenuItem onClick={close(() => onAdminDesfecho('no_show'))}>
              <UserX size={16} strokeWidth={1.65} aria-hidden />
              No show
            </MenuItem>
            <MenuItem onClick={close(() => onAdminDesfecho('venda'))} disabled={st === 'venda'} primary>
              <CircleDollarSign size={16} strokeWidth={1.65} aria-hidden />
              Venda
            </MenuItem>
            {podeExcluir && onExcluir && (
              <>
                <MenuDivider />
                <MenuItem onClick={close(onExcluir)} danger>
                  <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                  Remover
                </MenuItem>
              </>
            )}
          </>
        )
      }
    }

    if (podeExcluir && onExcluir) {
      return {
        label: 'Ações',
        body: (
          <MenuItem onClick={close(onExcluir)} danger>
            <Trash2 size={16} strokeWidth={1.75} aria-hidden />
            Remover
          </MenuItem>
        )
      }
    }

    return null
  }

  const menu = renderMenu()

  if (!menu && !showAdminQual) return null

  return (
    <>
      {menu && (
        <AgendaActionsMenu label={menu.label} disabled={disabled}>
          {menu.body}
        </AgendaActionsMenu>
      )}
      {showAdminQual && onAdminQualificacao && (
        <button
          type="button"
          className="btn btn-ghost btn-sm agenda-dd-trigger"
          disabled={disabled}
          onClick={onAdminQualificacao}
          title="Ajustar qualificação SDR (admin)"
        >
          Qualif. SDR
        </button>
      )}
      {showAdminQual && onAdminEditRegistro && (
        <button
          type="button"
          className="btn btn-ghost btn-sm agenda-dd-trigger"
          disabled={disabled}
          onClick={onAdminEditRegistro}
          title="Editar registo de reunião realizada"
        >
          Editar registo
        </button>
      )}
    </>
  )
}
