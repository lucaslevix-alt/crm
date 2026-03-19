import { useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'

export function Toast() {
  const { toast, clearToast } = useAppStore()

  useEffect(() => {
    if (!toast.message) return
    const id = window.setTimeout(() => {
      clearToast()
    }, 3500)
    return () => window.clearTimeout(id)
  }, [toast.message, clearToast])

  if (!toast.message) return null

  const isError = toast.variant === 'err'

  return (
    <div id="toast" className={isError ? 'show err' : 'show'}>
      {toast.message}
    </div>
  )
}

