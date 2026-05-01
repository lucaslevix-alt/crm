import { create } from 'zustand'
import type {
  ProdutoBlocoCondicaoComercial,
  ProdutoBlocoPrecoTabela,
  ProdutoPacoteNegociacao
} from '../firebase/firestore'
import type { LeadBudgetOp, QualificacaoSdr } from '../lib/qualificacaoSdr'
import { applyTheme, getStoredTheme, persistTheme, type ThemeMode } from '../lib/theme'

export type UserRole = 'admin' | 'sdr' | 'closer' | string

export interface CrmUser {
  id: string
  nome: string
  email: string
  cargo: UserRole
  hasPassword?: boolean
  photoUrl?: string
}

export interface FirebaseConfig {
  apiKey: string
  projectId: string
  appId: string
  authDomain?: string
  storageBucket?: string
  messagingSenderId?: string
}

type ToastVariant = 'ok' | 'err'

interface ToastState {
  message: string | null
  variant: ToastVariant
}

export interface EditingRegistroRow {
  id: string
  data: string
  tipo: string
  userId: string
  userName: string
  userCargo: string
  anuncio: string | null
  grupoWpp?: string | null
  valor: number
  cashCollected: number
  obs: string | null
  formaPagamento?: string | null
  produtosIds?: string[]
  produtosDetalhes?: Array<{ produtoId: string; quantidade: number; linhaNegociacaoId?: string | null }>
  valorReferenciaVenda?: number
  descontoCloser?: number
  nomeCliente?: string | null
  leadBudget?: LeadBudgetOp | null
  callRecordingUrl?: string | null
  qualificacaoSdr?: QualificacaoSdr | null
}

interface AppStoreState {
  currentUser: CrmUser | null
  /** Primeiro evento onAuthStateChanged já correu (evita flash / bypass com localStorage) */
  authSessionReady: boolean
  fbConfig: FirebaseConfig | null
  themeMode: ThemeMode
  quickBarHidden: boolean
  /** Apenas desktop (≥1040px): rail ícones vs. etiquetas; omissão = recolhido */
  sidebarCollapsed: boolean
  activeModalId: string | null
  toast: ToastState
  registrosVersion: number
  editingRegistro: EditingRegistroRow | null
  editingUser: CrmUser | null
  usersVersion: number
  editingProduto: {
    id: string
    nome: string
    blocoPrecoTabela: ProdutoBlocoPrecoTabela
    blocoOferta: ProdutoBlocoCondicaoComercial
    blocoUltimaCondicao: ProdutoBlocoCondicaoComercial
    blocoCartaNaManga: ProdutoBlocoCondicaoComercial
    negociacao6Meses: ProdutoPacoteNegociacao
  } | null
  produtosVersion: number
  metaConnectedAt: number
  quickRegTipo: string | null
  quickRegistroPrompt: { tipo: string; title: string; mode: 'modal' | 'save' } | null
  newRegistroDefaults: { tipo?: string; anuncio?: string } | null
  setQuickRegTipo: (tipo: string | null) => void
  setQuickRegistroPrompt: (p: { tipo: string; title: string; mode: 'modal' | 'save' } | null) => void
  setNewRegistroDefaults: (d: { tipo?: string; anuncio?: string } | null) => void
  setCurrentUser: (user: CrmUser | null) => void
  setAuthSessionReady: (ready: boolean) => void
  setMetaConnectedAt: (ts: number) => void
  setEditingUser: (u: CrmUser | null) => void
  incrementUsersVersion: () => void
  setEditingProduto: (p: {
    id: string
    nome: string
    blocoPrecoTabela: ProdutoBlocoPrecoTabela
    blocoOferta: ProdutoBlocoCondicaoComercial
    blocoUltimaCondicao: ProdutoBlocoCondicaoComercial
    blocoCartaNaManga: ProdutoBlocoCondicaoComercial
    negociacao6Meses: ProdutoPacoteNegociacao
  } | null) => void
  incrementProdutosVersion: () => void
  setFbConfig: (config: FirebaseConfig | null) => void
  setThemeMode: (mode: ThemeMode) => void
  setQuickBarHidden: (hidden: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  openModal: (id: string) => void
  closeModal: () => void
  showToast: (message: string, variant?: ToastVariant) => void
  clearToast: () => void
  incrementRegistrosVersion: () => void
  setEditingRegistro: (r: EditingRegistroRow | null) => void
}

const CRM_USER_KEY = 'crm_user'
const FB_CFG_KEY = 'fb_cfg'
const QRB_KEY = 'qrb_hidden'
const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed'

function loadCrmUserFromStorage(): CrmUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CRM_USER_KEY)
    if (!raw) return null
    const u = JSON.parse(raw) as CrmUser
    if (u && typeof u.id === 'string' && typeof u.email === 'string' && typeof u.nome === 'string') {
      return u
    }
    return null
  } catch {
    return null
  }
}

function loadFbConfigFromStorage(): FirebaseConfig | null {
  if (typeof window === 'undefined' || !import.meta.env.DEV) return null
  try {
    const raw = window.localStorage.getItem(FB_CFG_KEY)
    if (!raw) return null
    return JSON.parse(raw) as FirebaseConfig
  } catch {
    return null
  }
}

function loadQuickBarHidden(): boolean {
  try {
    const raw = window.localStorage.getItem(QRB_KEY)
    return raw === '1'
  } catch {
    return false
  }
}

function loadSidebarCollapsed(): boolean {
  try {
    const raw = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (raw === null) return true
    return raw === '1'
  } catch {
    return true
  }
}

export const useAppStore = create<AppStoreState>((set) => ({
  currentUser: typeof window !== 'undefined' ? loadCrmUserFromStorage() : null,
  authSessionReady: false,
  fbConfig: typeof window !== 'undefined' ? loadFbConfigFromStorage() : null,
  themeMode: typeof window !== 'undefined' ? getStoredTheme() : 'dark',
  quickBarHidden: typeof window !== 'undefined' ? loadQuickBarHidden() : false,
  sidebarCollapsed: typeof window !== 'undefined' ? loadSidebarCollapsed() : true,
  activeModalId: null,
  toast: { message: null, variant: 'ok' },
  registrosVersion: 0,
  editingRegistro: null,
  editingUser: null,
  usersVersion: 0,
  editingProduto: null,
  produtosVersion: 0,
  metaConnectedAt: 0,
  quickRegTipo: null,
  quickRegistroPrompt: null,
  newRegistroDefaults: null,
  setQuickRegTipo: (tipo) => set({ quickRegTipo: tipo }),
  setQuickRegistroPrompt: (p) => set({ quickRegistroPrompt: p }),
  setNewRegistroDefaults: (d) => set({ newRegistroDefaults: d }),

  setCurrentUser: (user) => {
    if (typeof window !== 'undefined') {
      if (user) {
        try {
          window.localStorage.setItem(CRM_USER_KEY, JSON.stringify(user))
        } catch {
          /* ignore */
        }
      } else {
        try {
          window.localStorage.removeItem(CRM_USER_KEY)
        } catch {
          /* ignore */
        }
      }
    }
    set({ currentUser: user })
  },

  setAuthSessionReady: (ready) => set({ authSessionReady: ready }),

  setFbConfig: (config) => {
    if (typeof window !== 'undefined') {
      if (config) window.localStorage.setItem(FB_CFG_KEY, JSON.stringify(config))
      else window.localStorage.removeItem(FB_CFG_KEY)
    }
    set({ fbConfig: config })
  },

  setThemeMode: (mode) => {
    persistTheme(mode)
    applyTheme(mode)
    set({ themeMode: mode })
  },

  setQuickBarHidden: (hidden) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(QRB_KEY, hidden ? '1' : '0')
    }
    set({ quickBarHidden: hidden })
  },

  setSidebarCollapsed: (collapsed) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
    }
    set({ sidebarCollapsed: collapsed })
  },

  openModal: (id) => set({ activeModalId: id }),
  closeModal: () => set({ activeModalId: null }),

  showToast: (message, variant = 'ok') =>
    set({ toast: { message, variant } }),

  clearToast: () => set({ toast: { message: null, variant: 'ok' } }),
  incrementRegistrosVersion: () => set((s) => ({ registrosVersion: s.registrosVersion + 1 })),
  setEditingRegistro: (r) => set({ editingRegistro: r }),
  setEditingUser: (u) => set({ editingUser: u }),
  incrementUsersVersion: () => set((s) => ({ usersVersion: s.usersVersion + 1 })),
  setEditingProduto: (p) => set({ editingProduto: p }),
  incrementProdutosVersion: () => set((s) => ({ produtosVersion: s.produtosVersion + 1 })),
  setMetaConnectedAt: (ts) => set({ metaConnectedAt: ts })
}))

