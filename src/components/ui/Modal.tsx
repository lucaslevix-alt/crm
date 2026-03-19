import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '../../store/useAppStore'

interface ModalProps {
  id: string
  children: ReactNode
}

export function Modal({ id, children }: ModalProps) {
  const { activeModalId, closeModal } = useAppStore()

  const isOpen = activeModalId === id

  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, closeModal])

  if (!isOpen) return null

  return createPortal(
    <div className="mo" onClick={closeModal}>
      <div
        className="modal"
        onClick={(event) => {
          event.stopPropagation()
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}

