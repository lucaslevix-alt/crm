import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatedOutlet } from './AnimatedOutlet'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { QuickRegBar } from './QuickRegBar'
import { useAppStore } from '../../store/useAppStore'

export function AppLayout() {
  const { pathname } = useLocation()
  const rankingsTvMode = pathname === '/rankings/tv'
  const { activeModalId, closeModal, openModal } = useAppStore()

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
    <div id="app" className={`app-shell${rankingsTvMode ? ' app-shell--rankings-tv' : ''}`}>
      {!rankingsTvMode && <Sidebar />}
      <main className="main">
        {!rankingsTvMode && <Topbar />}
        <AnimatedOutlet />
      </main>
      {!rankingsTvMode && <QuickRegBar />}
    </div>
  )
}
