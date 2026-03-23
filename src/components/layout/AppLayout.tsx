import { useEffect } from 'react'
import { AnimatedOutlet } from './AnimatedOutlet'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { QuickRegBar } from './QuickRegBar'
import { useAppStore } from '../../store/useAppStore'

export function AppLayout() {
  const { activeModalId, closeModal, openModal, sidebarOpen } = useAppStore()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeModal()
        return
      }
      if (e.key === 'n' || e.key === 'N') {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
        if (!activeModalId) openModal('modal-registro')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeModalId, closeModal, openModal])

  return (
    <div id="app" className="app-shell" style={{ flexDirection: 'row', minHeight: '100vh' }}>
      <Sidebar />
      <main className={`main ${!sidebarOpen ? 'sidebar-collapsed' : ''}`}>
        <Topbar />
        <AnimatedOutlet />
      </main>
      <QuickRegBar />
    </div>
  )
}
