import { Suspense } from 'react'
import { AuthSync } from './components/auth/AuthSync'
import { Target } from 'lucide-react'
import { BrowserRouter, Route, Routes, Navigate, Outlet } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import {
  AuditoriaPage,
  ConfigHubPage,
  ConfigMetasPage,
  DashboardPage,
  FunilPage,
  MetaAdsPage,
  MetasPage,
  NegociacoesPage,
  ProdutosPage,
  PropostasFechamentoPage,
  RankingCloserPage,
  RankingSquadsPage,
  RankingMetasPage,
  RankingSDRPage,
  RankingsPage,
  SquadsPage,
  RegistrosPage,
  AgendaPage,
  UsuariosPage
} from './routes/lazyPages'
import { RouteFallback } from './components/layout/RouteFallback'
import { EditRegistroForm } from './components/registro/EditRegistroForm'
import { NewRegistroForm } from './components/registro/NewRegistroForm'
import { MetaConfigModal } from './components/meta/MetaConfigModal'
import { UserFormModal } from './components/user/UserFormModal'
import { ProfileModal } from './components/user/ProfileModal'
import { ProdutoFormModal } from './components/produto/ProdutoFormModal'
import { AppLayout } from './components/layout/AppLayout'
import { Toast } from './components/ui/Toast'
import { Modal } from './components/ui/Modal'
import { useAppStore } from './store/useAppStore'

function ProtectedShell() {
  const { currentUser, authSessionReady } = useAppStore()
  if (!authSessionReady) return <RouteFallback />
  if (!currentUser) return <Navigate to="/login" replace />
  return <AppLayout />
}

function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAppStore()
  if (currentUser?.cargo !== 'admin') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function AdminOrCloserRoute({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAppStore()
  const ok = currentUser?.cargo === 'admin' || currentUser?.cargo === 'closer'
  if (!ok) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function ComercialProdutosRoute({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAppStore()
  const ok =
    currentUser?.cargo === 'admin' ||
    currentUser?.cargo === 'sdr' ||
    currentUser?.cargo === 'closer'
  if (!ok) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function AgendaRoute({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAppStore()
  const ok =
    currentUser?.cargo === 'admin' ||
    currentUser?.cargo === 'sdr' ||
    currentUser?.cargo === 'closer'
  if (!ok) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function ConfigOutlet() {
  return <Outlet />
}

export default function App() {
  return (
    <div className="text-sm text-[var(--text)] bg-[var(--bg)] min-h-screen app-root">
      <BrowserRouter>
        <AuthSync />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedShell />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="registros" element={<RegistrosPage />} />
              <Route
                path="agenda"
                element={
                  <AgendaRoute>
                    <AgendaPage />
                  </AgendaRoute>
                }
              />
              <Route path="funil" element={<FunilPage />} />
              <Route path="metas" element={<MetasPage />} />
              <Route path="rankings" element={<RankingsPage />}>
                <Route index element={<Navigate to="sdr" replace />} />
                <Route path="sdr" element={<RankingSDRPage />} />
                <Route path="closer" element={<RankingCloserPage />} />
                <Route path="squads" element={<RankingSquadsPage />} />
                <Route path="metas" element={<RankingMetasPage />} />
              </Route>
              <Route path="ranking-sdr" element={<Navigate to="/rankings/sdr" replace />} />
              <Route path="ranking-closer" element={<Navigate to="/rankings/closer" replace />} />
              <Route path="ranking-squads" element={<Navigate to="/rankings/squads" replace />} />
              <Route path="usuarios" element={<Navigate to="/config/usuarios" replace />} />
              <Route path="squads" element={<Navigate to="/config/squads" replace />} />
              <Route path="config" element={<ConfigOutlet />}>
                <Route index element={<ConfigHubPage />} />
                <Route
                  path="metas"
                  element={
                    <AdminOnlyRoute>
                      <ConfigMetasPage />
                    </AdminOnlyRoute>
                  }
                />
                <Route
                  path="usuarios"
                  element={
                    <AdminOnlyRoute>
                      <UsuariosPage />
                    </AdminOnlyRoute>
                  }
                />
                <Route
                  path="squads"
                  element={
                    <AdminOnlyRoute>
                      <SquadsPage />
                    </AdminOnlyRoute>
                  }
                />
                <Route
                  path="produtos"
                  element={
                    <ComercialProdutosRoute>
                      <ProdutosPage />
                    </ComercialProdutosRoute>
                  }
                />
              </Route>
              <Route path="produtos" element={<Navigate to="/config/produtos" replace />} />
              <Route path="auditoria" element={<AuditoriaPage />} />
              <Route path="negociacoes" element={<NegociacoesPage />} />
              <Route
                path="propostas-fechamento"
                element={
                  <AdminOrCloserRoute>
                    <PropostasFechamentoPage />
                  </AdminOrCloserRoute>
                }
              />
              <Route path="meta-ads" element={<MetaAdsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <Toast />
        <Modal id="modal-registro">
          <NewRegistroForm />
        </Modal>
        <Modal id="modal-edit-reg">
          <EditRegistroForm />
        </Modal>
        <Modal id="modal-meta-config">
          <MetaConfigModal />
        </Modal>
        <Modal id="modal-leads">
          <div style={{ padding: 24 }}>
            <h3 className="page-title-row" style={{ marginBottom: 12, fontSize: 18 }}>
              <Target size={22} strokeWidth={1.65} aria-hidden />
              Registrar Leads
            </h3>
            <p style={{ color: 'var(--text2)', fontSize: 13 }}>
              Formulário de registro de leads em breve. Use a barra rápida ou a página de Registros para lançamentos.
            </p>
            <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => useAppStore.getState().closeModal()}>
              Fechar
            </button>
          </div>
        </Modal>
        <Modal id="modal-usuario">
          <UserFormModal />
        </Modal>
        <Modal id="modal-perfil">
          <ProfileModal />
        </Modal>
        <Modal id="modal-produto">
          <ProdutoFormModal />
        </Modal>
      </BrowserRouter>
    </div>
  )
}
