import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Contact,
  Filter,
  LayoutDashboard,
  Link2,
  CalendarClock,
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
  Zap,
  FileSpreadsheet
} from 'lucide-react'
import { getAuth, signOut } from 'firebase/auth'
import { initFirebaseApp } from '../../firebase/config'
import { useAppStore } from '../../store/useAppStore'
import { icNavStripe } from '../../lib/icon-sizes'
import { prefetchPath } from '../../lib/routePrefetch'

const CONFIG_NAV_KEY = 'sidebar_config_nav_open'

function navPrefetch(to: string) {
  return {
    onPointerEnter: () => prefetchPath(to),
    onFocus: () => prefetchPath(to)
  } as const
}

function loadConfigNavOpen(): boolean {
  try {
    const v = window.localStorage.getItem(CONFIG_NAV_KEY)
    if (v === '0') return false
    if (v === '1') return true
  } catch {
    /* ignore */
  }
  return true
}

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser, openModal, sidebarCollapsed, setSidebarCollapsed } = useAppStore()
  const [configNavOpen, setConfigNavOpen] = useState(loadConfigNavOpen)

  const isConfigRoute = location.pathname === '/config' || location.pathname.startsWith('/config/')
  const isAdmin = currentUser?.cargo === 'admin'

  useEffect(() => {
    if (isConfigRoute) setConfigNavOpen(true)
  }, [isConfigRoute])

  function toggleConfigNav() {
    setConfigNavOpen((o) => {
      const next = !o
      try {
        window.localStorage.setItem(CONFIG_NAV_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  async function handleLogout() {
    try {
      await signOut(getAuth(initFirebaseApp()))
    } catch {
      /* ignore */
    }
    useAppStore.getState().setCurrentUser(null)
    navigate('/login')
  }

  return (
    <div
      className={`sidebar-wrap${sidebarCollapsed ? ' sidebar-wrap--collapsed' : ''}`}
      title="Menu — em ecrãs pequenos, passe o rato na margem esquerda para expandir"
    >
      <aside className="sidebar" aria-label="Menu principal de navegação">
        <div className="sidebar-logo">
          <div className="logo-row">
            <div className="logo-icon" aria-hidden>
              <Zap size={20} strokeWidth={1.75} />
            </div>
            <div className="logo-text-block">
              <div className="logo-text">Comercial</div>
              <div className="logo-sub">CRM Pro</div>
            </div>
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-expanded={!sidebarCollapsed}
              aria-label={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
              title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              {sidebarCollapsed ? (
                <ChevronRight size={18} strokeWidth={1.75} aria-hidden />
              ) : (
                <ChevronLeft size={18} strokeWidth={1.75} aria-hidden />
              )}
            </button>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Menu principal">
          <div className="nav-group nav-group--main">
            <NavLink
              to="/dashboard"
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              title="Dashboard"
              end
              {...navPrefetch('/dashboard')}
            >
              <span className="nav-icon">
                <LayoutDashboard {...icNavStripe} />
              </span>
              <span className="nav-label">Dashboard</span>
            </NavLink>
            <NavLink
              to="/meta-ads"
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              title="Meta Ads"
              {...navPrefetch('/meta-ads')}
            >
              <span className="nav-icon">
                <Megaphone {...icNavStripe} />
              </span>
              <span className="nav-label">Meta Ads</span>
            </NavLink>
            <NavLink
              to="/leads-meta"
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              title="Leads Meta"
              {...navPrefetch('/leads-meta')}
            >
              <span className="nav-icon">
                <Contact {...icNavStripe} />
              </span>
              <span className="nav-label">Leads Meta</span>
            </NavLink>
            <NavLink
              to="/registros"
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              title="Registros"
              {...navPrefetch('/registros')}
            >
              <span className="nav-icon">
                <ClipboardList {...icNavStripe} />
              </span>
              <span className="nav-label">Registros</span>
            </NavLink>
            {(currentUser?.cargo === 'admin' || currentUser?.cargo === 'sdr' || currentUser?.cargo === 'closer') && (
              <NavLink
                to="/agenda"
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                title="Agenda do squad"
                {...navPrefetch('/agenda')}
              >
                <span className="nav-icon">
                  <CalendarClock {...icNavStripe} />
                </span>
                <span className="nav-label">Agenda</span>
              </NavLink>
            )}
            {(currentUser?.cargo === 'admin' || currentUser?.cargo === 'closer') && (
              <NavLink
                to="/propostas-fechamento"
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                title="Propostas de fechamento"
                {...navPrefetch('/propostas-fechamento')}
              >
                <span className="nav-icon">
                  <Link2 {...icNavStripe} />
                </span>
                <span className="nav-label">Propostas de fechamento</span>
              </NavLink>
            )}
            <NavLink
              to="/funil"
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              title="Funil de conversão"
              {...navPrefetch('/funil')}
            >
              <span className="nav-icon">
                <Filter {...icNavStripe} />
              </span>
              <span className="nav-label">Funil de conversão</span>
            </NavLink>
            <NavLink
              to="/metas"
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              title="Metas"
              {...navPrefetch('/metas')}
            >
              <span className="nav-icon">
                <Target {...icNavStripe} />
              </span>
              <span className="nav-label">Metas</span>
            </NavLink>
            <NavLink
              to="/rankings"
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              title="Classificação"
              {...navPrefetch('/rankings')}
            >
              <span className="nav-icon">
                <Trophy {...icNavStripe} />
              </span>
              <span className="nav-label">Classificação</span>
            </NavLink>
          </div>

          {isAdmin && (
            <div className="nav-group nav-group--admin">
              <div className={`nav-config-nest${configNavOpen ? ' nav-config-nest--open' : ''}`}>
                <div
                  className={`nav-config-nest-head${isConfigRoute ? ' nav-config-nest-head--active' : ''}`}
                >
                  <NavLink
                    to="/config"
                    className={() =>
                      `nav-item nav-item--config-parent${isConfigRoute ? ' active' : ''}`
                    }
                    title="Configurações"
                    {...navPrefetch('/config')}
                  >
                    <span className="nav-icon">
                      <Settings {...icNavStripe} />
                    </span>
                    <span className="nav-label">Configurações</span>
                  </NavLink>
                  <button
                    type="button"
                    className="nav-config-chevron"
                    onClick={toggleConfigNav}
                    aria-expanded={configNavOpen}
                    aria-label={configNavOpen ? 'Recolher submenu de configurações' : 'Expandir submenu de configurações'}
                  >
                    <ChevronDown size={18} strokeWidth={1.75} aria-hidden />
                  </button>
                </div>
                {configNavOpen && (
                  <div className="nav-config-nest-children" role="group" aria-label="Itens de configuração">
                    <NavLink
                      to="/config/relatorios-comissoes"
                      className={({ isActive }) =>
                        `nav-item nav-item--sub${isActive ? ' active' : ''}`
                      }
                      title="Relatórios para comissões"
                      {...navPrefetch('/config/relatorios-comissoes')}
                    >
                      <span className="nav-icon">
                        <FileSpreadsheet size={16} strokeWidth={1.5} aria-hidden />
                      </span>
                      <span className="nav-label">Comissões</span>
                    </NavLink>
                    <NavLink
                      to="/config/metas"
                      className={({ isActive }) =>
                        `nav-item nav-item--sub${isActive ? ' active' : ''}`
                      }
                      title="Configuração de metas"
                      {...navPrefetch('/config/metas')}
                    >
                      <span className="nav-icon">
                        <Target size={16} strokeWidth={1.5} aria-hidden />
                      </span>
                      <span className="nav-label">Metas</span>
                    </NavLink>
                    <NavLink
                      to="/config/usuarios"
                      className={({ isActive }) =>
                        `nav-item nav-item--sub${isActive ? ' active' : ''}`
                      }
                      title="Usuários"
                      {...navPrefetch('/config/usuarios')}
                    >
                      <span className="nav-icon">
                        <Users size={16} strokeWidth={1.5} aria-hidden />
                      </span>
                      <span className="nav-label">Usuários</span>
                    </NavLink>
                    <NavLink
                      to="/config/squads"
                      className={({ isActive }) =>
                        `nav-item nav-item--sub${isActive ? ' active' : ''}`
                      }
                      title="Squads"
                      {...navPrefetch('/config/squads')}
                    >
                      <span className="nav-icon">
                        <UsersRound size={16} strokeWidth={1.5} aria-hidden />
                      </span>
                      <span className="nav-label">Squads</span>
                    </NavLink>
                    <NavLink
                      to="/config/produtos"
                      className={({ isActive }) =>
                        `nav-item nav-item--sub${isActive ? ' active' : ''}`
                      }
                      title="Produtos"
                      {...navPrefetch('/config/produtos')}
                    >
                      <span className="nav-icon">
                        <Package size={16} strokeWidth={1.5} aria-hidden />
                      </span>
                      <span className="nav-label">Produtos</span>
                    </NavLink>
                  </div>
                )}
              </div>
              <NavLink
                to="/auditoria"
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                title="Auditoria"
                {...navPrefetch('/auditoria')}
              >
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
            <div className="user-info-text">
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
