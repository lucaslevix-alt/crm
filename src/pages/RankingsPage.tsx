import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Trophy } from 'lucide-react'

const TABS = [
  { to: '/rankings/sdr', label: 'SDRs' },
  { to: '/rankings/closer', label: 'Closers' },
  { to: '/rankings/squads', label: 'Squads' },
  { to: '/rankings/tv', label: 'TV' },
  { to: '/rankings/metas', label: 'Metas' }
] as const

export function RankingsPage() {
  const { pathname } = useLocation()
  if (pathname === '/rankings/tv') {
    return (
      <div className="rankings-tv-root">
        <Outlet />
      </div>
    )
  }

  return (
    <div className="content">
      <div className="rankings-shell-head">
        <div className="rankings-shell-title">
          <h2 className="page-title-row" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            <Trophy size={24} strokeWidth={1.65} aria-hidden />
            Classificação
          </h2>
          <p style={{ color: 'var(--text2)', marginBottom: 0 }}>
            Desempenho de SDRs e Closers em tabela, Squads, modo TV e metas por squad
          </p>
        </div>
        <nav className="rankings-tabs" aria-label="Tipo de ranking">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} className={({ isActive }) => `rankings-tab${isActive ? ' active' : ''}`}>
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  )
}
