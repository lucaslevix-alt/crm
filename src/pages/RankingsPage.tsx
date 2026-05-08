import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { prefetchPath } from '../lib/routePrefetch'
import { useAppStore } from '../store/useAppStore'

const TABS = [
  { to: '/rankings/sdr', label: 'SDRs' },
  { to: '/rankings/closer', label: 'Closers' },
  { to: '/rankings/squads', label: 'Squads' },
  { to: '/rankings/base', label: 'Base' },
  { to: '/rankings/gts', label: 'GTs' },
  { to: '/rankings/tv', label: 'TV' },
  { to: '/rankings/metas', label: 'Metas' }
] as const

export function RankingsPage() {
  const { pathname } = useLocation()
  const { currentUser } = useAppStore()
  const isAdmin = currentUser?.cargo === 'admin'

  if (pathname === '/rankings/tv') {
    return (
      <div className="rankings-tv-root">
        <Outlet />
      </div>
    )
  }

  const tabs = isAdmin ? [...TABS, { to: '/config/avisos', label: 'Avisos' }] : [...TABS]

  return (
    <div className="content">
      <div className="rankings-shell-head">
        <div className="rankings-shell-title">
          <h2 className="page-title-row" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            <Trophy size={24} strokeWidth={1.65} aria-hidden />
            Classificação
          </h2>
          <p style={{ color: 'var(--text2)', marginBottom: 0 }}>
            SDRs, Closers, Squads, base de clientes, GTs (churn), modo TV e metas por squad
          </p>
        </div>
        <nav className="rankings-tabs" aria-label="Tipo de ranking">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) => `rankings-tab${isActive ? ' active' : ''}`}
              onPointerEnter={() => prefetchPath(t.to)}
              onFocus={() => prefetchPath(t.to)}
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  )
}
