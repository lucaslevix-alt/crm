import { lazy } from 'react'

export const DashboardPage = lazy(() =>
  import('../pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
)
export const RegistrosPage = lazy(() =>
  import('../pages/RegistrosPage').then((m) => ({ default: m.RegistrosPage }))
)
export const MetasPage = lazy(() => import('../pages/MetasPage').then((m) => ({ default: m.MetasPage })))
export const FunilPage = lazy(() => import('../pages/FunilPage').then((m) => ({ default: m.FunilPage })))
export const RankingSDRPage = lazy(() =>
  import('../pages/RankingSDRPage').then((m) => ({ default: m.RankingSDRPage }))
)
export const RankingCloserPage = lazy(() =>
  import('../pages/RankingCloserPage').then((m) => ({ default: m.RankingCloserPage }))
)
export const MetaAdsPage = lazy(() => import('../pages/MetaAdsPage').then((m) => ({ default: m.MetaAdsPage })))
export const NegociacoesPage = lazy(() =>
  import('../pages/NegociacoesPage').then((m) => ({ default: m.NegociacoesPage }))
)
export const PropostasFechamentoPage = lazy(() =>
  import('../pages/PropostasFechamentoPage').then((m) => ({ default: m.PropostasFechamentoPage }))
)
export const UsuariosPage = lazy(() =>
  import('../pages/UsuariosPage').then((m) => ({ default: m.UsuariosPage }))
)
export const ProdutosPage = lazy(() =>
  import('../pages/ProdutosPage').then((m) => ({ default: m.ProdutosPage }))
)
export const ConfigPage = lazy(() => import('../pages/ConfigPage').then((m) => ({ default: m.ConfigPage })))
export const AuditoriaPage = lazy(() =>
  import('../pages/AuditoriaPage').then((m) => ({ default: m.AuditoriaPage }))
)
