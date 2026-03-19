import { NavLink, useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'

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
          <div className="logo-icon">⚡</div>
          <div>
            <div className="logo-text">Comercial</div>
            <div className="logo-sub">CRM Pro</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-sec">Principal</div>
        <NavLink to="/dashboard" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="nav-icon">⚡</span>
          <span className="nav-label">Dashboard</span>
        </NavLink>
        <NavLink to="/meta-ads" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="nav-icon">📣</span>
          <span className="nav-label">Meta Ads</span>
        </NavLink>
        <NavLink to="/registros" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="nav-icon">📋</span>
          <span className="nav-label">Registros</span>
        </NavLink>
        <NavLink to="/negociacoes" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="nav-icon">🤝</span>
          <span className="nav-label">Negociações</span>
        </NavLink>
        <NavLink to="/funil" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="nav-icon">🔽</span>
          <span className="nav-label">Funil</span>
        </NavLink>
        <NavLink to="/metas" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="nav-icon">🎯</span>
          <span className="nav-label">Metas</span>
        </NavLink>

        <div className="nav-sec">Rankings</div>
        <NavLink to="/ranking-sdr" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="nav-icon">🏆</span>
          <span className="nav-label">Ranking SDR</span>
        </NavLink>
        <NavLink to="/ranking-closer" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="nav-icon">🥇</span>
          <span className="nav-label">Ranking Closer</span>
        </NavLink>

        {currentUser?.cargo === 'admin' && (
          <>
            <div className="nav-sec">Admin</div>
            <NavLink to="/usuarios" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon">👥</span>
              <span className="nav-label">Usuários</span>
            </NavLink>
            <NavLink to="/produtos" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon">📦</span>
              <span className="nav-label">Produtos</span>
            </NavLink>
            <NavLink to="/config" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon">⚙️</span>
              <span className="nav-label">Configurações</span>
            </NavLink>
            <NavLink to="/auditoria" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon">🔍</span>
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
            onClick={() => openModal('modal-perfil')}
            title="Meu perfil"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text3)',
              fontSize: 14,
              padding: 4,
              borderRadius: 6
            }}
          >
            👤
          </button>
          <button
            type="button"
            onClick={handleLogout}
            title="Sair"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text3)',
              fontSize: 16,
              padding: 4,
              borderRadius: 6
            }}
          >
            ⏻
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
        {sidebarOpen ? '◀' : '▶'}
      </button>
    </>
  )
}
