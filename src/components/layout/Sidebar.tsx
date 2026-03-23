import { NavLink, useNavigate } from 'react-router-dom'
import {
  Award,
  ChevronLeft,
  ChevronRight,
  Filter,
  Handshake,
  LayoutDashboard,
  Link2,
  LogOut,
  Megaphone,
  Package,
  Search,
  Settings,
  Target,
  Trophy,
  User,
  Users,
  Zap,
  ClipboardList
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { icNav } from '../../lib/icon-sizes'

export function Sidebar() {
  const navigate = useNavigate()
  const { sidebarOpen, setSidebarOpen, currentUser, openModal } = useAppStore()

  function handleToggle() {
    setSidebarOpen(!sidebarOpen)
  }

  function handleLogout() {
    useAppStore.getState().setCurrentUser(null)
    navigate('/login')
  }

  return (
    <>
      <aside className={sidebarOpen ? 'sidebar' : 'sidebar collapsed'}>
        <div className="sidebar-logo">
          <div className="logo-row">
            <div className="logo-icon" aria-hidden>
              <Zap size={22} strokeWidth={2.2} />
            </div>
            <div>
              <div className="logo-text">Comercial</div>
              <div className="logo-sub">CRM Pro</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-sec">Principal</div>
          <NavLink to="/dashboard" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">
              <LayoutDashboard {...icNav} />
            </span>
            <span className="nav-label">Dashboard</span>
          </NavLink>
          <NavLink to="/meta-ads" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">
              <Megaphone {...icNav} />
            </span>
            <span className="nav-label">Meta Ads</span>
          </NavLink>
          <NavLink to="/registros" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">
              <ClipboardList {...icNav} />
            </span>
            <span className="nav-label">Registros</span>
          </NavLink>
          <NavLink to="/negociacoes" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">
              <Handshake {...icNav} />
            </span>
            <span className="nav-label">Negociações</span>
          </NavLink>
          {(currentUser?.cargo === 'admin' || currentUser?.cargo === 'closer') && (
            <NavLink
              to="/propostas-fechamento"
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">
                <Link2 {...icNav} />
              </span>
              <span className="nav-label">Propostas de fechamento</span>
            </NavLink>
          )}
          <NavLink to="/funil" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">
              <Filter {...icNav} />
            </span>
            <span className="nav-label">Funil</span>
          </NavLink>
          <NavLink to="/metas" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">
              <Target {...icNav} />
            </span>
            <span className="nav-label">Metas</span>
          </NavLink>

          <div className="nav-sec">Rankings</div>
          <NavLink to="/ranking-sdr" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">
              <Trophy {...icNav} />
            </span>
            <span className="nav-label">Ranking SDR</span>
          </NavLink>
          <NavLink to="/ranking-closer" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">
              <Award {...icNav} />
            </span>
            <span className="nav-label">Ranking Closer</span>
          </NavLink>

          {currentUser?.cargo === 'admin' && (
            <>
              <div className="nav-sec">Admin</div>
              <NavLink to="/usuarios" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="nav-icon">
                  <Users {...icNav} />
                </span>
                <span className="nav-label">Usuários</span>
              </NavLink>
              <NavLink to="/produtos" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="nav-icon">
                  <Package {...icNav} />
                </span>
                <span className="nav-label">Produtos</span>
              </NavLink>
              <NavLink to="/config" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="nav-icon">
                  <Settings {...icNav} />
                </span>
                <span className="nav-label">Configurações</span>
              </NavLink>
              <NavLink to="/auditoria" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="nav-icon">
                  <Search {...icNav} />
                </span>
                <span className="nav-label">Auditoria</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className={`user-avatar ${(currentUser?.cargo as string) || 'admin'}`}>
              {currentUser?.nome ? currentUser.nome.charAt(0).toUpperCase() : '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="u-name">{currentUser?.nome ?? '—'}</div>
              <div className="u-role">{(currentUser?.cargo ?? '').toUpperCase()}</div>
            </div>
            <button
              type="button"
              className="sidebar-icon-btn"
              onClick={() => openModal('modal-perfil')}
              title="Meu perfil"
            >
              <User size={17} strokeWidth={1.65} />
            </button>
            <button type="button" className="sidebar-icon-btn" onClick={handleLogout} title="Sair">
              <LogOut size={17} strokeWidth={1.65} />
            </button>
          </div>
        </div>
      </aside>
      <button
        type="button"
        className="sidebar-toggle"
        onClick={handleToggle}
        title={sidebarOpen ? 'Recolher menu' : 'Expandir menu'}
        aria-label={sidebarOpen ? 'Recolher menu' : 'Expandir menu'}
      >
        {sidebarOpen ? <ChevronLeft size={16} strokeWidth={2} /> : <ChevronRight size={16} strokeWidth={2} />}
      </button>
    </>
  )
}
