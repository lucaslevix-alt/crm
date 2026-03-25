import { NavLink, useNavigate } from 'react-router-dom'
import {
  ClipboardList,
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
  UsersRound,
  Zap
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { icNavStripe } from '../../lib/icon-sizes'

export function Sidebar() {
  const navigate = useNavigate()
  const { currentUser, openModal } = useAppStore()

  function handleLogout() {
    useAppStore.getState().setCurrentUser(null)
    navigate('/login')
  }

  return (
    <div
      className="sidebar-wrap"
      title="Menu — em ecrãs pequenos, passe o rato na margem esquerda para expandir"
    >
      <aside className="sidebar" aria-label="Menu principal de navegação">
        <div className="sidebar-logo">
          <div className="logo-row">
            <div className="logo-icon" aria-hidden>
              <Zap size={20} strokeWidth={1.75} />
            </div>
            <div>
              <div className="logo-text">Comercial</div>
              <div className="logo-sub">CRM Pro</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Seções">
          <div className="nav-group">
            <div className="nav-sec">Início</div>
            <NavLink to="/dashboard" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} end>
              <span className="nav-icon">
                <LayoutDashboard {...icNavStripe} />
              </span>
              <span className="nav-label">Dashboard</span>
            </NavLink>
          </div>

          <div className="nav-group">
            <div className="nav-sec">Mídia e captação</div>
            <NavLink to="/meta-ads" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon">
                <Megaphone {...icNavStripe} />
              </span>
              <span className="nav-label">Meta Ads</span>
            </NavLink>
          </div>

          <div className="nav-group">
            <div className="nav-sec">Operação comercial</div>
            <NavLink to="/registros" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon">
                <ClipboardList {...icNavStripe} />
              </span>
              <span className="nav-label">Registros</span>
            </NavLink>
            <NavLink to="/negociacoes" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon">
                <Handshake {...icNavStripe} />
              </span>
              <span className="nav-label">Negociações</span>
            </NavLink>
            {(currentUser?.cargo === 'admin' ||
              currentUser?.cargo === 'sdr' ||
              currentUser?.cargo === 'closer') && (
              <NavLink to="/produtos" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="nav-icon">
                  <Package {...icNavStripe} />
                </span>
                <span className="nav-label">Produtos</span>
              </NavLink>
            )}
            {(currentUser?.cargo === 'admin' || currentUser?.cargo === 'closer') && (
              <NavLink
                to="/propostas-fechamento"
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <span className="nav-icon">
                  <Link2 {...icNavStripe} />
                </span>
                <span className="nav-label">Propostas de fechamento</span>
              </NavLink>
            )}
          </div>

          <div className="nav-group">
            <div className="nav-sec">Metas e funil</div>
            <NavLink to="/funil" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon">
                <Filter {...icNavStripe} />
              </span>
              <span className="nav-label">Funil de conversão</span>
            </NavLink>
            <NavLink to="/metas" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon">
                <Target {...icNavStripe} />
              </span>
              <span className="nav-label">Metas</span>
            </NavLink>
          </div>

          <div className="nav-group">
            <div className="nav-sec">Rankings</div>
            <NavLink to="/rankings" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon">
                <Trophy {...icNavStripe} />
              </span>
              <span className="nav-label">Classificação</span>
            </NavLink>
          </div>

          {currentUser?.cargo === 'admin' && (
            <div className="nav-group nav-group--admin">
              <div className="nav-sec">Administração</div>
              <NavLink to="/usuarios" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="nav-icon">
                  <Users {...icNavStripe} />
                </span>
                <span className="nav-label">Usuários</span>
              </NavLink>
              <NavLink to="/squads" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="nav-icon">
                  <UsersRound {...icNavStripe} />
                </span>
                <span className="nav-label">Squads</span>
              </NavLink>
              <NavLink to="/config" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="nav-icon">
                  <Settings {...icNavStripe} />
                </span>
                <span className="nav-label">Configurações</span>
              </NavLink>
              <NavLink to="/auditoria" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="nav-icon">
                  <Search {...icNavStripe} />
                </span>
                <span className="nav-label">Auditoria</span>
              </NavLink>
            </div>
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
    </div>
  )
}
