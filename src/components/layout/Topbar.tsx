import { useLocation } from 'react-router-dom'
import { Eye, EyeOff, Moon, Plus, Sun } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { icSm } from '../../lib/icon-sizes'

const ROUTE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  registros: 'Registros',
  funil: 'Funil de Conversão',
  metas: 'Metas',
  rankings: 'Rankings',
  squads: 'Squads',
  usuarios: 'Usuários',
  produtos: 'Produtos',
  config: 'Configurações',
  auditoria: 'Auditoria',
  negociacoes: 'Negociações',
  'meta-ads': 'Meta Ads'
}

function getPageTitle(pathname: string): string {
  const parts = pathname.replace(/^\//, '').split('/').filter(Boolean)
  if (parts[0] === 'config') {
    if (parts[1] === 'relatorios-comissoes') return 'Relatórios para comissões'
    if (parts[1] === 'metas') return 'Configuração de metas'
    if (parts[1] === 'usuarios') return 'Usuários'
    if (parts[1] === 'squads') return 'Squads'
    if (parts[1] === 'produtos') return 'Produtos'
    return ROUTE_TITLES.config
  }
  const segment = parts[0] || 'dashboard'
  return ROUTE_TITLES[segment] ?? segment
}

export function Topbar() {
  const location = useLocation()
  const { quickBarHidden, setQuickBarHidden, openModal, themeMode, setThemeMode } = useAppStore()

  const title = getPageTitle(location.pathname)
  const dateLabel = new Date().toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="topbar-title">{title}</div>
      </div>
      <div className="topbar-right">
        <div className="date-badge">{dateLabel}</div>
        <div style={{ width: 1, height: 20, background: 'var(--border2)' }} />
        <button
          type="button"
          className="topbar-ghost-btn"
          onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
          title={themeMode === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
          aria-label={themeMode === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
        >
          {themeMode === 'dark' ? <Sun {...icSm} /> : <Moon {...icSm} />}
          <span>{themeMode === 'dark' ? 'Claro' : 'Escuro'}</span>
        </button>
        <button
          type="button"
          className="topbar-ghost-btn"
          onClick={() => setQuickBarHidden(!quickBarHidden)}
          title={quickBarHidden ? 'Mostrar barra de ações rápidas' : 'Ocultar barra de ações rápidas'}
        >
          {quickBarHidden ? <Eye {...icSm} /> : <EyeOff {...icSm} />}
          <span>{quickBarHidden ? 'Mostrar' : 'Ocultar'}</span>
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm topbar-new-btn"
          style={{ width: 'auto', marginLeft: 8 }}
          onClick={() => openModal('modal-registro')}
        >
          <Plus size={15} strokeWidth={2.2} />
          Novo registro
        </button>
      </div>
    </header>
  )
}
