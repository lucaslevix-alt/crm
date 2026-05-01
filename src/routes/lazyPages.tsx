import { lazy } from 'react'

export const DashboardPage = lazy(() =>
  import('../pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
)
export const RegistrosPage = lazy(() =>
  import('../pages/RegistrosPage').then((m) => ({ default: m.RegistrosPage }))
)
export const AgendaPage = lazy(() =>
  import('../pages/AgendaPage').then((m) => ({ default: m.AgendaPage }))
)
export const MetasPage = lazy(() => import('../pages/MetasPage').then((m) => ({ default: m.MetasPage })))
export const FunilPage = lazy(() => import('../pages/FunilPage').then((m) => ({ default: m.FunilPage })))
export const RankingsPage = lazy(() =>
  import('../pages/RankingsPage').then((m) => ({ default: m.RankingsPage }))
)
export const RankingSDRPage = lazy(() =>
  import('../pages/RankingSDRPage').then((m) => ({ default: m.RankingSDRPage }))
)
export const RankingCloserPage = lazy(() =>
  import('../pages/RankingCloserPage').then((m) => ({ default: m.RankingCloserPage }))
)
export const RankingSquadsPage = lazy(() =>
  import('../pages/RankingSquadsPage').then((m) => ({ default: m.RankingSquadsPage }))
)
export const RankingMetasPage = lazy(() =>
  import('../pages/RankingMetasPage').then((m) => ({ default: m.RankingMetasPage }))
)
export const RankingTVPage = lazy(() =>
  import('../pages/RankingTVPage').then((m) => ({ default: m.RankingTVPage }))
)
export const SquadsPage = lazy(() => import('../pages/SquadsPage').then((m) => ({ default: m.SquadsPage })))
export const MetaAdsPage = lazy(() => import('../pages/MetaAdsPage').then((m) => ({ default: m.MetaAdsPage })))
export const PropostasFechamentoPage = lazy(() =>
  import('../pages/PropostasFechamentoPage').then((m) => ({ default: m.PropostasFechamentoPage }))
)
export const UsuariosPage = lazy(() =>
  import('../pages/UsuariosPage').then((m) => ({ default: m.UsuariosPage }))
)
export const ProdutosPage = lazy(() =>
  import('../pages/ProdutosPage').then((m) => ({ default: m.ProdutosPage }))
)
export const ConfigHubPage = lazy(() =>
  import('../pages/ConfigHubPage').then((m) => ({ default: m.ConfigHubPage }))
)
export const ConfigMetasPage = lazy(() =>
  import('../pages/ConfigMetasPage').then((m) => ({ default: m.ConfigMetasPage }))
)
export const RelatoriosComissoesPage = lazy(() =>
  import('../pages/RelatoriosComissoesPage').then((m) => ({ default: m.RelatoriosComissoesPage }))
)
export const AuditoriaPage = lazy(() =>
  import('../pages/AuditoriaPage').then((m) => ({ default: m.AuditoriaPage }))
)
