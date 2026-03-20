import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore'
import { initFirebaseApp } from './config'
import type { CrmUser } from '../store/useAppStore'

const app = initFirebaseApp()
export const db = getFirestore(app)

/** Valores persistidos no Firestore para vendas */
export const FORMAS_PAGAMENTO_VENDA = [
  { value: 'a_vista', label: 'À vista' },
  { value: 'cartao_sj', label: 'Cartão s/j' },
  { value: 'cartao_cj', label: 'Cartão c/j' },
  { value: 'boleto_parcelado', label: 'Boleto parcelado' }
] as const

export type FormaPagamentoVenda = (typeof FORMAS_PAGAMENTO_VENDA)[number]['value']

const FORMA_PAGAMENTO_VALUES = new Set<string>(FORMAS_PAGAMENTO_VENDA.map((x) => x.value))

export function parseFormaPagamentoVenda(raw: string): FormaPagamentoVenda | null {
  const t = raw.trim()
  return FORMA_PAGAMENTO_VALUES.has(t) ? (t as FormaPagamentoVenda) : null
}

export function labelFormaPagamento(value: string | null | undefined): string {
  if (!value) return '—'
  const row = FORMAS_PAGAMENTO_VENDA.find((x) => x.value === value)
  return row?.label ?? value
}

export interface RegistroRow {
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
  /** Preenchido quando `tipo === 'venda'` */
  formaPagamento?: string | null
  produtosIds?: string[]
  produtosDetalhes?: RegistroProdutoItem[]
  criadoEm?: { seconds: number }
}

export interface RegistroProdutoItem {
  produtoId: string
  quantidade: number
}

function docToRegistro(d: { id: string; data: () => Record<string, unknown> }): RegistroRow {
  const x = d.data()
  const ts = x.criadoEm as Timestamp | undefined
  return {
    id: d.id,
    data: String(x.data ?? ''),
    tipo: String(x.tipo ?? ''),
    userId: String(x.userId ?? ''),
    userName: String(x.userName ?? '—'),
    userCargo: String(x.userCargo ?? '—'),
    anuncio: x.anuncio != null ? String(x.anuncio) : null,
    valor: Number(x.valor ?? 0),
    cashCollected: Number(x.cashCollected ?? 0),
    obs: x.obs != null ? String(x.obs) : null,
    formaPagamento:
      x.formaPagamento != null && String(x.formaPagamento).trim() !== ''
        ? String(x.formaPagamento).trim()
        : null,
    produtosIds: Array.isArray(x.produtosIds) ? x.produtosIds.map((v) => String(v)) : [],
    produtosDetalhes: Array.isArray(x.produtosDetalhes)
      ? x.produtosDetalhes.map((v) => ({
          produtoId: String((v as { produtoId?: unknown }).produtoId ?? ''),
          quantidade: Number((v as { quantidade?: unknown }).quantidade ?? 0)
        }))
      : [],
    criadoEm: ts ? { seconds: ts.seconds } : undefined
  }
}

export async function findUserByEmail(params: {
  email: string
}): Promise<CrmUser | null> {
  const { email } = params
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null

  const usuariosRef = collection(db, 'usuarios')
  const snapshot = await getDocs(usuariosRef)
  const found = snapshot.docs.find((d) => {
    const data = d.data() as { email?: string }
    const value = (data.email || '').trim().toLowerCase()
    return value === normalized
  })

  if (!found) return null

  const data = found.data() as Record<string, unknown>
  return {
    id: found.id,
    nome: String(data.nome ?? ''),
    email: String(data.email ?? ''),
    cargo: String(data.cargo ?? ''),
    hasPassword: Boolean(data.hasPassword),
    photoUrl: String((data.photoUrl as string | undefined) ?? (data.fotoUrl as string | undefined) ?? '')
  }
}

export async function listUsers(): Promise<CrmUser[]> {
  const snapshot = await getDocs(
    query(collection(db, 'usuarios'), orderBy('nome'))
  )
  return snapshot.docs.map((d) => {
    const data = d.data() as Record<string, unknown>
    return {
      id: d.id,
      nome: String(data.nome ?? ''),
      email: String(data.email ?? ''),
      cargo: String(data.cargo ?? ''),
      photoUrl: String((data.photoUrl as string | undefined) ?? (data.fotoUrl as string | undefined) ?? '')
    }
  })
}

export async function getRegistrosByRange(start: string, end: string): Promise<RegistroRow[]> {
  const q = query(
    collection(db, 'registros'),
    where('data', '>=', start),
    where('data', '<=', end)
  )
  const snapshot = await getDocs(q)
  const rows = snapshot.docs.map(docToRegistro)
  rows.sort((a, b) => {
    if (b.data !== a.data) return b.data > a.data ? 1 : -1
    return (b.criadoEm?.seconds ?? 0) - (a.criadoEm?.seconds ?? 0)
  })
  return rows
}

export interface AgendaReuniaoRow extends RegistroRow {
  hora?: string
}

export async function getRegistrosCloserByRange(start: string, end: string): Promise<AgendaReuniaoRow[]> {
  const q = query(
    collection(db, 'registros'),
    where('tipo', '==', 'reuniao_closer'),
    where('data', '>=', start),
    where('data', '<=', end)
  )
  const snapshot = await getDocs(q)
  const rows = snapshot.docs.map((d) => {
    const r = docToRegistro(d)
    const x = d.data()
    const hora = x.hora != null ? String(x.hora) : undefined
    return { ...r, hora }
  })
  rows.sort((a, b) => {
    if (a.data !== b.data) return a.data.localeCompare(b.data)
    return ((a as AgendaReuniaoRow).hora ?? '').localeCompare((b as AgendaReuniaoRow).hora ?? '')
  })
  return rows as AgendaReuniaoRow[]
}

export interface MetasConfig {
  meta_reunioes_agendadas?: number
  meta_reunioes_realizadas?: number
  meta_reunioes_closer?: number
  meta_vendas?: number
  meta_faturamento?: number
  meta_cash?: number
}

export async function getMetasConfig(): Promise<MetasConfig> {
  const ref = doc(db, 'config', 'metas')
  const snap = await getDoc(ref)
  return snap.exists() ? (snap.data() as MetasConfig) : {}
}

export async function setMetasConfig(params: MetasConfig): Promise<void> {
  const ref = doc(db, 'config', 'metas')
  const body: Record<string, number | null> = {}
  const keys: (keyof MetasConfig)[] = [
    'meta_reunioes_agendadas',
    'meta_reunioes_realizadas',
    'meta_reunioes_closer',
    'meta_vendas',
    'meta_faturamento',
    'meta_cash'
  ]
  keys.forEach((k) => {
    const v = params[k]
    if (v != null) body[k] = v
  })
  await setDoc(ref, body, { merge: true })
}

export async function addRegistro(params: {
  data: string
  tipo: string
  userId: string
  userName: string
  userCargo: string
  anuncio?: string | null
  valor?: number
  cashCollected?: number
  obs?: string | null
  formaPagamento?: string | null
  produtosIds?: string[]
  produtosDetalhes?: RegistroProdutoItem[]
}): Promise<string> {
  const ref = await addDoc(collection(db, 'registros'), {
    data: params.data,
    tipo: params.tipo,
    userId: params.userId,
    userName: params.userName,
    userCargo: params.userCargo,
    anuncio: params.anuncio ?? null,
    valor: params.valor ?? 0,
    cashCollected: params.cashCollected ?? 0,
    obs: params.obs ?? null,
    formaPagamento: params.tipo === 'venda' ? (params.formaPagamento ?? null) : null,
    produtosIds: params.produtosIds ?? [],
    produtosDetalhes: params.produtosDetalhes ?? [],
    criadoEm: serverTimestamp()
  })
  return ref.id
}

export async function updateRegistro(
  id: string,
  params: {
    data: string
    tipo: string
    userId: string
    userName: string
    userCargo: string
    anuncio?: string | null
    valor?: number
    cashCollected?: number
    obs?: string | null
    formaPagamento?: string | null
    produtosIds?: string[]
    produtosDetalhes?: RegistroProdutoItem[]
  }
): Promise<void> {
  const ref = doc(db, 'registros', id)
  await updateDoc(ref, {
    data: params.data,
    tipo: params.tipo,
    userId: params.userId,
    userName: params.userName,
    userCargo: params.userCargo,
    anuncio: params.anuncio ?? null,
    valor: params.valor ?? 0,
    cashCollected: params.cashCollected ?? 0,
    obs: params.obs ?? null,
    formaPagamento: params.tipo === 'venda' ? (params.formaPagamento ?? null) : null,
    produtosIds: params.produtosIds ?? [],
    produtosDetalhes: params.produtosDetalhes ?? []
  })
}

export async function deleteRegistro(id: string): Promise<void> {
  await deleteDoc(doc(db, 'registros', id))
}

export interface LeadSdrRow {
  userId: string
  userName: string
  quantidade: number
}

export async function getLeadsSdrByRange(start: string, end: string): Promise<LeadSdrRow[]> {
  const q = query(
    collection(db, 'leads_sdr'),
    where('data', '>=', start),
    where('data', '<=', end)
  )
  const snapshot = await getDocs(q)
  const byUser = new Map<string, { userName: string; quantidade: number }>()
  snapshot.docs.forEach((d) => {
    const x = d.data()
    const uid = String(x.userId ?? '')
    const nome = String(x.userName ?? '—')
    const qtd = Number(x.quantidade ?? 0)
    const cur = byUser.get(uid)
    if (cur) {
      cur.quantidade += qtd
    } else {
      byUser.set(uid, { userName: nome, quantidade: qtd })
    }
  })
  return Array.from(byUser.entries()).map(([userId, v]) => ({
    userId,
    userName: v.userName,
    quantidade: v.quantidade
  }))
}

export async function addUser(params: { nome: string; email: string; cargo: string; hasPassword?: boolean }): Promise<string> {
  const ref = await addDoc(collection(db, 'usuarios'), {
    nome: params.nome,
    email: params.email.trim().toLowerCase(),
    cargo: params.cargo,
    hasPassword: params.hasPassword ?? false,
    criadoEm: serverTimestamp()
  })
  return ref.id
}

export async function updateUser(
  id: string,
  params: { nome: string; email: string; cargo: string; hasPassword?: boolean }
): Promise<void> {
  await updateDoc(doc(db, 'usuarios', id), {
    nome: params.nome,
    email: params.email.trim().toLowerCase(),
    cargo: params.cargo,
    ...(params.hasPassword !== undefined ? { hasPassword: params.hasPassword } : {})
  })
}

export async function deleteUser(id: string): Promise<void> {
  await deleteDoc(doc(db, 'usuarios', id))
}

export interface ProdutoRow {
  id: string
  nome: string
  valor: number | null
  valorCartao: number | null
  parcelasCartao: number | null
  valorBoleto: number | null
  parcelasBoleto: number | null
  aVista: number | null
  desc: string | null
}

export async function getProdutos(): Promise<ProdutoRow[]> {
  const snapshot = await getDocs(query(collection(db, 'produtos'), orderBy('nome')))
  return snapshot.docs.map((d) => {
    const x = d.data()
    return {
      id: d.id,
      nome: String(x.nome ?? ''),
      valor: x.valor != null ? Number(x.valor) : null,
      valorCartao: x.valorCartao != null ? Number(x.valorCartao) : null,
      parcelasCartao: x.parcelasCartao != null ? Number(x.parcelasCartao) : null,
      valorBoleto: x.valorBoleto != null ? Number(x.valorBoleto) : null,
      parcelasBoleto: x.parcelasBoleto != null ? Number(x.parcelasBoleto) : null,
      aVista: x.aVista != null ? Number(x.aVista) : null,
      desc: x.desc != null ? String(x.desc) : null
    }
  })
}

export async function addProduto(params: {
  nome: string
  valor?: number | null
  valorCartao?: number | null
  parcelasCartao?: number | null
  valorBoleto?: number | null
  parcelasBoleto?: number | null
  aVista?: number | null
  desc?: string | null
}): Promise<string> {
  const ref = await addDoc(collection(db, 'produtos'), {
    nome: params.nome,
    valor: params.valor ?? null,
    valorCartao: params.valorCartao ?? null,
    parcelasCartao: params.parcelasCartao ?? null,
    valorBoleto: params.valorBoleto ?? null,
    parcelasBoleto: params.parcelasBoleto ?? null,
    aVista: params.aVista ?? null,
    desc: params.desc ?? null,
    criadoEm: serverTimestamp()
  })
  return ref.id
}

export async function updateProduto(
  id: string,
  params: {
    nome: string
    valor?: number | null
    valorCartao?: number | null
    parcelasCartao?: number | null
    valorBoleto?: number | null
    parcelasBoleto?: number | null
    aVista?: number | null
    desc?: string | null
  }
): Promise<void> {
  await updateDoc(doc(db, 'produtos', id), {
    nome: params.nome,
    valor: params.valor ?? null,
    valorCartao: params.valorCartao ?? null,
    parcelasCartao: params.parcelasCartao ?? null,
    valorBoleto: params.valorBoleto ?? null,
    parcelasBoleto: params.parcelasBoleto ?? null,
    aVista: params.aVista ?? null,
    desc: params.desc ?? null
  })
}

export async function deleteProduto(id: string): Promise<void> {
  await deleteDoc(doc(db, 'produtos', id))
}

export interface AuditLogRow {
  id: string
  ts: { seconds: number } | null
  acao: string
  registroId: string | null
  userId: string
  userName: string
  userCargo: string
  antes: Record<string, unknown> | null
  depois: Record<string, unknown> | null
}

function docToAuditLog(d: { id: string; data: () => Record<string, unknown> }): AuditLogRow {
  const x = d.data()
  const ts = x.ts as Timestamp | undefined
  return {
    id: d.id,
    ts: ts ? { seconds: ts.seconds } : null,
    acao: String(x.acao ?? ''),
    registroId: x.registroId != null ? String(x.registroId) : null,
    userId: String(x.userId ?? ''),
    userName: String(x.userName ?? '—'),
    userCargo: String(x.userCargo ?? ''),
    antes: (x.antes as Record<string, unknown>) ?? null,
    depois: (x.depois as Record<string, unknown>) ?? null
  }
}

export async function getAuditoriaLogs(params: {
  limitCount?: number
  acao?: string
  userId?: string
}): Promise<AuditLogRow[]> {
  let q = query(
    collection(db, 'auditoria'),
    orderBy('ts', 'desc'),
    limit(params.limitCount ?? 500)
  )
  const snapshot = await getDocs(q)
  let rows = snapshot.docs.map(docToAuditLog)
  if (params.acao) rows = rows.filter((r) => r.acao === params.acao)
  if (params.userId) rows = rows.filter((r) => r.userId === params.userId)
  return rows
}

