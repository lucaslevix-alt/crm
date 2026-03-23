import { create } from 'zustand'

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
  valor: number
  cashCollected: number
  obs: string | null
  formaPagamento?: string | null
  produtosIds?: string[]
  produtosDetalhes?: Array<{ produtoId: string; quantidade: number }>
}

interface AppStoreState {
  currentUser: CrmUser | null
  fbConfig: FirebaseConfig | null
  quickBarHidden: boolean
  activeModalId: string | null
  toast: ToastState
  registrosVersion: number
  editingRegistro: EditingRegistroRow | null
  editingUser: CrmUser | null
  usersVersion: number
  editingProduto: {
    id: string
    nome: string
    valor?: number | null
    valorCartao: number | null
    parcelasCartao: number | null
    valorBoleto: number | null
    parcelasBoleto: number | null
    aVista: number | null
    desc: string | null
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
  setMetaConnectedAt: (ts: number) => void
  setEditingUser: (u: CrmUser | null) => void
  incrementUsersVersion: () => void
  setEditingProduto: (p: {
    id: string
    nome: string
    valor?: number | null
    valorCartao: number | null
    parcelasCartao: number | null
    valorBoleto: number | null
    parcelasBoleto: number | null
    aVista: number | null
    desc: string | null
  } | null) => void
  incrementProdutosVersion: () => void
  setFbConfig: (config: FirebaseConfig | null) => void
  setQuickBarHidden: (hidden: boolean) => void
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

function loadUserFromStorage(): CrmUser | null {
  try {
    const raw = window.localStorage.getItem(CRM_USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CrmUser
  } catch {
    return null
  }
}

function loadFbConfigFromStorage(): FirebaseConfig | null {
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

export const useAppStore = create<AppStoreState>((set) => ({
  currentUser: typeof window !== 'undefined' ? loadUserFromStorage() : null,
  fbConfig: typeof window !== 'undefined' ? loadFbConfigFromStorage() : null,
  quickBarHidden: typeof window !== 'undefined' ? loadQuickBarHidden() : false,
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
      if (user) window.localStorage.setItem(CRM_USER_KEY, JSON.stringify(user))
      else window.localStorage.removeItem(CRM_USER_KEY)
    }
    set({ currentUser: user })
  },

  setFbConfig: (config) => {
    if (typeof window !== 'undefined') {
      if (config) window.localStorage.setItem(FB_CFG_KEY, JSON.stringify(config))
      else window.localStorage.removeItem(FB_CFG_KEY)
    }
    set({ fbConfig: config })
  },

  setQuickBarHidden: (hidden) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(QRB_KEY, hidden ? '1' : '0')
    }
    set({ quickBarHidden: hidden })
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

