import { NavLink, Outlet } from 'react-router-dom'
import { Trophy } from 'lucide-react'

const TABS = [
  { to: '/rankings/sdr', label: 'SDR' },
  { to: '/rankings/closer', label: 'Closer' },
  { to: '/rankings/squads', label: 'Squads' }
] as const

export function RankingsPage() {
  return (
    <div className="content">
      <div className="rankings-shell-head">
        <div className="rankings-shell-title">
          <h2 className="page-title-row" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            <Trophy size={24} strokeWidth={1.65} aria-hidden />
            Rankings
          </h2>
          <p style={{ color: 'var(--text2)', marginBottom: 0 }}>Alterne entre SDR, Closer e Squads</p>
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
