import { Link } from 'react-router-dom'
import {
  ChevronRight,
  Database,
  Factory,
  FileSpreadsheet,
  Package,
  Settings,
  Target,
  Trophy,
  Users,
  UsersRound
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

export function ConfigHubPage() {
  const { currentUser } = useAppStore()
  const cargo = currentUser?.cargo
  const isAdmin = cargo === 'admin'
  const podeProdutos = isAdmin || cargo === 'sdr' || cargo === 'closer'

  return (
    <div className="content">
      <div className="config-hub-head">
        <div className="config-hub-head-ic" aria-hidden>
          <Settings size={28} strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="config-hub-title">Configurações</h1>
          <p className="config-hub-desc">
            Metas do sistema, equipa, produtos e parâmetros — tudo num só lugar.
          </p>
        </div>
      </div>

      <div className="config-hub-grid" role="navigation" aria-label="Secções de configuração">
        {isAdmin && (
          <Link to="/config/relatorios-comissoes" className="config-hub-card">
            <span className="config-hub-card-ic">
              <FileSpreadsheet size={22} strokeWidth={1.65} aria-hidden />
            </span>
            <span className="config-hub-card-body">
              <span className="config-hub-card-title">Relatórios para comissões</span>
              <span className="config-hub-card-text">
                Exportar SDR (agendadas, realizadas, leads) e closer (vendas e valores) por período.
              </span>
            </span>
            <ChevronRight className="config-hub-card-arrow" size={18} strokeWidth={1.75} aria-hidden />
          </Link>
        )}

        {isAdmin && (
          <Link to="/config/metas" className="config-hub-card">
            <span className="config-hub-card-ic">
              <Target size={22} strokeWidth={1.65} aria-hidden />
            </span>
            <span className="config-hub-card-body">
              <span className="config-hub-card-title">Configuração de metas</span>
              <span className="config-hub-card-text">Metas mensais globais e aparência (claro / escuro).</span>
            </span>
            <ChevronRight className="config-hub-card-arrow" size={18} strokeWidth={1.75} aria-hidden />
          </Link>
        )}

        {isAdmin && (
          <Link to="/config/usuarios" className="config-hub-card">
            <span className="config-hub-card-ic">
              <Users size={22} strokeWidth={1.65} aria-hidden />
            </span>
            <span className="config-hub-card-body">
              <span className="config-hub-card-title">Usuários</span>
              <span className="config-hub-card-text">Contas, cargos e acesso ao CRM.</span>
            </span>
            <ChevronRight className="config-hub-card-arrow" size={18} strokeWidth={1.75} aria-hidden />
          </Link>
        )}

        {isAdmin && (
          <Link to="/config/squads" className="config-hub-card">
            <span className="config-hub-card-ic">
              <UsersRound size={22} strokeWidth={1.65} aria-hidden />
            </span>
            <span className="config-hub-card-body">
              <span className="config-hub-card-title">Squads</span>
              <span className="config-hub-card-text">Equipas, membros e faturamento por squad.</span>
            </span>
            <ChevronRight className="config-hub-card-arrow" size={18} strokeWidth={1.75} aria-hidden />
          </Link>
        )}

        {isAdmin && (
          <Link to="/config/gestao-op" className="config-hub-card">
            <span className="config-hub-card-ic">
              <Factory size={22} strokeWidth={1.65} aria-hidden />
            </span>
            <span className="config-hub-card-body">
              <span className="config-hub-card-title">Gestão OP</span>
              <span className="config-hub-card-text">Squads operacionais, bônus inicial e abatimentos de saldo.</span>
            </span>
            <ChevronRight className="config-hub-card-arrow" size={18} strokeWidth={1.75} aria-hidden />
          </Link>
        )}

        {isAdmin && (
          <Link to="/config/base" className="config-hub-card">
            <span className="config-hub-card-ic">
              <Database size={22} strokeWidth={1.65} aria-hidden />
            </span>
            <span className="config-hub-card-body">
              <span className="config-hub-card-title">Base</span>
              <span className="config-hub-card-text">Clientes ativos na operação por mês — alimenta o pódio na classificação.</span>
            </span>
            <ChevronRight className="config-hub-card-arrow" size={18} strokeWidth={1.75} aria-hidden />
          </Link>
        )}

        {isAdmin && (
          <Link to="/config/gts" className="config-hub-card">
            <span className="config-hub-card-ic">
              <Trophy size={22} strokeWidth={1.65} aria-hidden />
            </span>
            <span className="config-hub-card-body">
              <span className="config-hub-card-title">GTs</span>
              <span className="config-hub-card-text">
                Cadastro mensal de churn por gestor (quantidade), como a Base — alimenta a classificação.
              </span>
            </span>
            <ChevronRight className="config-hub-card-arrow" size={18} strokeWidth={1.75} aria-hidden />
          </Link>
        )}

        {podeProdutos && (
          <Link to="/config/produtos" className="config-hub-card">
            <span className="config-hub-card-ic">
              <Package size={22} strokeWidth={1.65} aria-hidden />
            </span>
            <span className="config-hub-card-body">
              <span className="config-hub-card-title">Produtos</span>
              <span className="config-hub-card-text">Catálogo, preços e linhas de negociação.</span>
            </span>
            <ChevronRight className="config-hub-card-arrow" size={18} strokeWidth={1.75} aria-hidden />
          </Link>
        )}
      </div>
    </div>
  )
}
