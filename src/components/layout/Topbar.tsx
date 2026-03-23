import { useLocation } from 'react-router-dom'
import { Eye, EyeOff, Plus } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { icSm } from '../../lib/icon-sizes'

const ROUTE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  registros: 'Registros',
  funil: 'Funil de Conversão',
  metas: 'Metas',
  'ranking-sdr': 'Ranking SDR',
  'ranking-closer': 'Ranking Closer',
  usuarios: 'Usuários',
  produtos: 'Produtos',
  config: 'Configurações',
  auditoria: 'Auditoria',
  negociacoes: 'Negociações',
  'meta-ads': 'Meta Ads'
}

function getPageTitle(pathname: string): string {
  const segment = pathname.replace(/^\//, '').split('/')[0] || 'dashboard'
  return ROUTE_TITLES[segment] ?? segment
}

export function Topbar() {
  const location = useLocation()
  const { quickBarHidden, setQuickBarHidden, openModal } = useAppStore()

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
