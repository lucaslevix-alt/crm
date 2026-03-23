import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { RegistrosPage } from './pages/RegistrosPage'
import { MetasPage } from './pages/MetasPage'
import { FunilPage } from './pages/FunilPage'
import { RankingSDRPage } from './pages/RankingSDRPage'
import { RankingCloserPage } from './pages/RankingCloserPage'
import { MetaAdsPage } from './pages/MetaAdsPage'
import { NegociacoesPage } from './pages/NegociacoesPage'
import { PropostasFechamentoPage } from './pages/PropostasFechamentoPage'
import { UsuariosPage } from './pages/UsuariosPage'
import { ProdutosPage } from './pages/ProdutosPage'
import { ConfigPage } from './pages/ConfigPage'
import { AuditoriaPage } from './pages/AuditoriaPage'
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
  const { currentUser } = useAppStore()
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

export default function App() {
  return (
    <div className="text-sm text-[var(--text)] bg-[var(--bg)] min-h-screen">
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="registros" element={<RegistrosPage />} />
            <Route path="funil" element={<FunilPage />} />
            <Route path="metas" element={<MetasPage />} />
            <Route path="ranking-sdr" element={<RankingSDRPage />} />
            <Route path="ranking-closer" element={<RankingCloserPage />} />
            <Route path="usuarios" element={<AdminOnlyRoute><UsuariosPage /></AdminOnlyRoute>} />
            <Route path="produtos" element={<ProdutosPage />} />
            <Route path="config" element={<ConfigPage />} />
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
            <h3 style={{ marginBottom: 12 }}>🎯 Registrar Leads</h3>
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
