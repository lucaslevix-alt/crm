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

/** Uma linha “ideal” por produto; as demais são “com desconto” em relação a ela */
export type LinhaPrecoRole = 'ideal' | 'desconto'

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
  /** Nome do cliente (vendas) */
  nomeCliente?: string | null
  produtosIds?: string[]
  produtosDetalhes?: RegistroProdutoItem[]
  /** Soma (referência ideal × qtd) — à vista ou parcelado conforme forma de pagamento da venda */
  valorReferenciaVenda?: number
  /** Soma (linha ideal − linha fechada) × qtd por item na venda */
  descontoCloser?: number
  criadoEm?: { seconds: number }
}

export interface RegistroProdutoItem {
  produtoId: string
  quantidade: number
  /** Linha de proposta usada para calcular o valor de referência */
  linhaNegociacaoId?: string | null
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
    nomeCliente:
      String(x.tipo) === 'venda' && x.nomeCliente != null && String(x.nomeCliente).trim() !== ''
        ? String(x.nomeCliente).trim()
        : null,
    produtosIds: Array.isArray(x.produtosIds) ? x.produtosIds.map((v) => String(v)) : [],
    produtosDetalhes: Array.isArray(x.produtosDetalhes)
      ? x.produtosDetalhes.map((v) => {
          const row = v as { produtoId?: unknown; quantidade?: unknown; linhaNegociacaoId?: unknown }
          const lid = row.linhaNegociacaoId != null && String(row.linhaNegociacaoId).trim() !== ''
            ? String(row.linhaNegociacaoId).trim()
            : null
          return {
            produtoId: String(row.produtoId ?? ''),
            quantidade: Number(row.quantidade ?? 0),
            linhaNegociacaoId: lid
          }
        })
      : [],
    valorReferenciaVenda:
      x.valorReferenciaVenda != null && String(x.tipo) === 'venda' ? Number(x.valorReferenciaVenda) : undefined,
    descontoCloser:
      x.descontoCloser != null && String(x.tipo) === 'venda' ? Number(x.descontoCloser) : undefined,
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
  valorReferenciaVenda?: number
  descontoCloser?: number
  nomeCliente?: string | null
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
    nomeCliente:
      params.tipo === 'venda' && params.nomeCliente?.trim()
        ? params.nomeCliente.trim()
        : null,
    produtosIds: params.produtosIds ?? [],
    produtosDetalhes: params.produtosDetalhes ?? [],
    ...(params.tipo === 'venda'
      ? {
          valorReferenciaVenda: params.valorReferenciaVenda ?? 0,
          descontoCloser: params.descontoCloser ?? 0
        }
      : {
          valorReferenciaVenda: null,
          descontoCloser: null
        }),
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
  valorReferenciaVenda?: number
  descontoCloser?: number
  nomeCliente?: string | null
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
    nomeCliente:
      params.tipo === 'venda' && params.nomeCliente?.trim()
        ? params.nomeCliente.trim()
        : null,
    produtosIds: params.produtosIds ?? [],
    produtosDetalhes: params.produtosDetalhes ?? [],
    ...(params.tipo === 'venda'
      ? {
          valorReferenciaVenda: params.valorReferenciaVenda ?? 0,
          descontoCloser: params.descontoCloser ?? 0
        }
      : {
          valorReferenciaVenda: null,
          descontoCloser: null
        })
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

/** Preço de tabela: valor total + à vista + parcelado no cartão + link rápido */
export interface ProdutoBlocoPrecoTabela {
  valorTotal: number | null
  valorAVista: number | null
  valorParceladoCartao: number | null
  parcelasCartao: number | null
  linkPagamento: string | null
}

/** Oferta / última condição / carta na manga: à vista + parcelado cartão + bônus + link */
export interface ProdutoBlocoCondicaoComercial {
  valorAVista: number | null
  valorParceladoCartao: number | null
  parcelasCartao: number | null
  bonus: string | null
  linkPagamento: string | null
}

export function emptyBlocoPrecoTabela(): ProdutoBlocoPrecoTabela {
  return {
    valorTotal: null,
    valorAVista: null,
    valorParceladoCartao: null,
    parcelasCartao: null,
    linkPagamento: null
  }
}

export function emptyBlocoCondicaoComercial(): ProdutoBlocoCondicaoComercial {
  return {
    valorAVista: null,
    valorParceladoCartao: null,
    parcelasCartao: null,
    bonus: null,
    linkPagamento: null
  }
}

export interface ProdutoRow {
  id: string
  nome: string
  blocoPrecoTabela: ProdutoBlocoPrecoTabela
  blocoOferta: ProdutoBlocoCondicaoComercial
  blocoUltimaCondicao: ProdutoBlocoCondicaoComercial
  blocoCartaNaManga: ProdutoBlocoCondicaoComercial
  /** Legado / detalhamento por forma de pagamento (documentos antigos) */
  valor: number | null
  valorCartao: number | null
  parcelasCartao: number | null
  valorBoleto: number | null
  parcelasBoleto: number | null
  aVista: number | null
  desc: string | null
}

function parseBlocoPrecoTabela(x: Record<string, unknown>): ProdutoBlocoPrecoTabela {
  const raw = x.blocoPrecoTabela
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>
    return {
      valorTotal: numOrNull(o.valorTotal),
      valorAVista: numOrNull(o.valorAVista),
      valorParceladoCartao: numOrNull(o.valorParceladoCartao),
      parcelasCartao: numOrNull(o.parcelasCartao),
      linkPagamento: strOrNull(o.linkPagamento)
    }
  }
  const oldPreco = numOrNull(x.precoTabela) ?? numOrNull(x.valor)
  return {
    valorTotal: oldPreco,
    valorAVista: numOrNull(x.aVista) ?? oldPreco,
    valorParceladoCartao: numOrNull(x.valorCartao) ?? oldPreco,
    parcelasCartao: numOrNull(x.parcelasCartao),
    linkPagamento: null
  }
}

function parseBlocoCondicao(
  x: Record<string, unknown>,
  blocoKey: string,
  legacyTextKey: string
): ProdutoBlocoCondicaoComercial {
  const raw = x[blocoKey]
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>
    return {
      valorAVista: numOrNull(o.valorAVista),
      valorParceladoCartao: numOrNull(o.valorParceladoCartao),
      parcelasCartao: numOrNull(o.parcelasCartao),
      bonus: strOrNull(o.bonus),
      linkPagamento: strOrNull(o.linkPagamento)
    }
  }
  const leg = strOrNull(x[legacyTextKey])
  return {
    valorAVista: null,
    valorParceladoCartao: null,
    parcelasCartao: null,
    bonus: leg,
    linkPagamento: null
  }
}

/** Referência única quando não há detalhe na coluna específica (ex.: só preço de tabela). */
export function produtoPrecoReferencia(p: ProdutoRow): number | null {
  const bt = p.blocoPrecoTabela
  if (bt.valorTotal != null && bt.valorTotal > 0) return bt.valorTotal
  if (bt.valorParceladoCartao != null && bt.valorParceladoCartao > 0) return bt.valorParceladoCartao
  if (bt.valorAVista != null && bt.valorAVista > 0) return bt.valorAVista
  if (p.valorCartao != null && p.valorCartao > 0) return p.valorCartao
  if (p.valorBoleto != null && p.valorBoleto > 0) return p.valorBoleto
  if (p.aVista != null && p.aVista > 0) return p.aVista
  if (p.valor != null && p.valor > 0) return p.valor
  return null
}

export function produtoValorCartaoEfetivo(p: ProdutoRow): number | null {
  const bt = p.blocoPrecoTabela
  if (bt.valorParceladoCartao != null && bt.valorParceladoCartao > 0) return bt.valorParceladoCartao
  if (p.valorCartao != null && p.valorCartao > 0) return p.valorCartao
  return produtoPrecoReferencia(p)
}

export function produtoParcelasCartaoEfetivo(p: ProdutoRow): number | null {
  const bt = p.blocoPrecoTabela
  const v = produtoValorCartaoEfetivo(p)
  if (v == null || v <= 0) return null
  if (bt.valorParceladoCartao != null && bt.valorParceladoCartao > 0) {
    const n = bt.parcelasCartao
    return n != null && n > 0 ? n : 1
  }
  if (p.valorCartao != null && p.valorCartao > 0) {
    return p.parcelasCartao != null && p.parcelasCartao > 0 ? p.parcelasCartao : 1
  }
  return 1
}

export function produtoValorBoletoEfetivo(p: ProdutoRow): number | null {
  if (p.valorBoleto != null && p.valorBoleto > 0) return p.valorBoleto
  return produtoPrecoReferencia(p)
}

export function produtoParcelasBoletoEfetivo(p: ProdutoRow): number | null {
  const v = produtoValorBoletoEfetivo(p)
  if (v == null || v <= 0) return null
  if (p.valorBoleto != null && p.valorBoleto > 0) {
    return p.parcelasBoleto != null && p.parcelasBoleto > 0 ? p.parcelasBoleto : 1
  }
  return 1
}

export function produtoValorAVistaEfetivo(p: ProdutoRow): number | null {
  const bt = p.blocoPrecoTabela
  if (bt.valorAVista != null && bt.valorAVista > 0) return bt.valorAVista
  if (p.aVista != null && p.aVista > 0) return p.aVista
  return produtoPrecoReferencia(p)
}

function numOrNull(x: unknown): number | null {
  if (x == null || x === '') return null
  const n = Number(x)
  return Number.isFinite(n) ? n : null
}

function strOrNull(x: unknown): string | null {
  if (x == null) return null
  const s = String(x).trim()
  return s === '' ? null : s
}

export async function getProdutos(): Promise<ProdutoRow[]> {
  const snapshot = await getDocs(query(collection(db, 'produtos'), orderBy('nome')))
  return snapshot.docs.map((d) => {
    const x = d.data() as Record<string, unknown>
    const valorLegado = numOrNull(x.valor)
    return {
      id: d.id,
      nome: String(x.nome ?? ''),
      blocoPrecoTabela: parseBlocoPrecoTabela(x),
      blocoOferta: parseBlocoCondicao(x, 'blocoOferta', 'ofertaPromocional'),
      blocoUltimaCondicao: parseBlocoCondicao(x, 'blocoUltimaCondicao', 'ultimaCondicao'),
      blocoCartaNaManga: parseBlocoCondicao(x, 'blocoCartaNaManga', 'cartaNaManga'),
      valor: valorLegado,
      valorCartao: numOrNull(x.valorCartao),
      parcelasCartao: numOrNull(x.parcelasCartao),
      valorBoleto: numOrNull(x.valorBoleto),
      parcelasBoleto: numOrNull(x.parcelasBoleto),
      aVista: numOrNull(x.aVista),
      desc: x.desc != null ? String(x.desc) : null
    }
  })
}

function serializeBlocoTabela(b: ProdutoBlocoPrecoTabela): Record<string, unknown> {
  return {
    valorTotal: b.valorTotal,
    valorAVista: b.valorAVista,
    valorParceladoCartao: b.valorParceladoCartao,
    parcelasCartao: b.parcelasCartao,
    linkPagamento: b.linkPagamento
  }
}

function serializeBlocoCondicao(b: ProdutoBlocoCondicaoComercial): Record<string, unknown> {
  return {
    valorAVista: b.valorAVista,
    valorParceladoCartao: b.valorParceladoCartao,
    parcelasCartao: b.parcelasCartao,
    bonus: b.bonus,
    linkPagamento: b.linkPagamento
  }
}

export async function addProduto(params: {
  nome: string
  blocoPrecoTabela: ProdutoBlocoPrecoTabela
  blocoOferta: ProdutoBlocoCondicaoComercial
  blocoUltimaCondicao: ProdutoBlocoCondicaoComercial
  blocoCartaNaManga: ProdutoBlocoCondicaoComercial
}): Promise<string> {
  const ref = await addDoc(collection(db, 'produtos'), {
    nome: params.nome,
    blocoPrecoTabela: serializeBlocoTabela(params.blocoPrecoTabela),
    blocoOferta: serializeBlocoCondicao(params.blocoOferta),
    blocoUltimaCondicao: serializeBlocoCondicao(params.blocoUltimaCondicao),
    blocoCartaNaManga: serializeBlocoCondicao(params.blocoCartaNaManga),
    valor: null,
    valorCartao: null,
    parcelasCartao: null,
    valorBoleto: null,
    parcelasBoleto: null,
    aVista: null,
    desc: null,
    criadoEm: serverTimestamp()
  })
  return ref.id
}

export async function updateProduto(
  id: string,
  params: {
    nome: string
    blocoPrecoTabela: ProdutoBlocoPrecoTabela
    blocoOferta: ProdutoBlocoCondicaoComercial
    blocoUltimaCondicao: ProdutoBlocoCondicaoComercial
    blocoCartaNaManga: ProdutoBlocoCondicaoComercial
  }
): Promise<void> {
  await updateDoc(doc(db, 'produtos', id), {
    nome: params.nome,
    blocoPrecoTabela: serializeBlocoTabela(params.blocoPrecoTabela),
    blocoOferta: serializeBlocoCondicao(params.blocoOferta),
    blocoUltimaCondicao: serializeBlocoCondicao(params.blocoUltimaCondicao),
    blocoCartaNaManga: serializeBlocoCondicao(params.blocoCartaNaManga)
  })
}

export async function deleteProduto(id: string): Promise<void> {
  const qLinhas = query(collection(db, 'linhas_negociacao'), where('produtoId', '==', id))
  const snapLinhas = await getDocs(qLinhas)
  for (const d of snapLinhas.docs) {
    await deleteDoc(doc(db, 'linhas_negociacao', d.id))
  }
  await deleteDoc(doc(db, 'produtos', id))
}

/** Linhas de proposta (valor + parcelas + link de cartão) por produto — menu Propostas de fechamento */
export interface LinhaNegociacaoRow {
  id: string
  produtoId: string
  /** Total do pacote parcelado (cartão / boleto parcelado na venda) */
  valorTotal: number
  parcelas: number
  /** Preço à vista na mesma linha (venda com forma “À vista”) */
  valorAVista: number | null
  linkCartao: string | null
  /** Texto livre: se há bônus e em que condições */
  possibilidadeBonus: string | null
  rotulo: string | null
  ordem: number
  linhaPrecoRole: LinhaPrecoRole
}

function parseLinhaPrecoRole(raw: unknown): LinhaPrecoRole {
  return raw === 'ideal' ? 'ideal' : 'desconto'
}

function docToLinhaNegociacao(d: { id: string; data: () => Record<string, unknown> }): LinhaNegociacaoRow {
  const x = d.data()
  const av = x.valorAVista
  const valorAVistaParsed =
    av != null && av !== '' && Number.isFinite(Number(av)) && Number(av) > 0 ? Number(av) : null
  return {
    id: d.id,
    produtoId: String(x.produtoId ?? ''),
    valorTotal: Number(x.valorTotal ?? 0),
    parcelas: Math.max(1, Math.floor(Number(x.parcelas ?? 1))),
    valorAVista: valorAVistaParsed,
    linkCartao: x.linkCartao != null && String(x.linkCartao).trim() !== '' ? String(x.linkCartao).trim() : null,
    possibilidadeBonus: strOrNull(x.possibilidadeBonus),
    rotulo: x.rotulo != null && String(x.rotulo).trim() !== '' ? String(x.rotulo).trim() : null,
    ordem: Number(x.ordem ?? 0),
    linhaPrecoRole: parseLinhaPrecoRole(x.linhaPrecoRole)
  }
}

export async function getLinhasNegociacaoAll(): Promise<LinhaNegociacaoRow[]> {
  const snapshot = await getDocs(collection(db, 'linhas_negociacao'))
  const rows = snapshot.docs.map(docToLinhaNegociacao)
  rows.sort((a, b) => {
    if (a.produtoId !== b.produtoId) return a.produtoId.localeCompare(b.produtoId)
    return a.ordem - b.ordem || a.id.localeCompare(b.id)
  })
  return rows
}

export async function addLinhaNegociacao(params: {
  produtoId: string
  valorTotal: number
  parcelas: number
  valorAVista?: number | null
  linkCartao?: string | null
  possibilidadeBonus?: string | null
  rotulo?: string | null
  ordem?: number
  linhaPrecoRole?: LinhaPrecoRole
}): Promise<string> {
  const ref = await addDoc(collection(db, 'linhas_negociacao'), {
    produtoId: params.produtoId,
    valorTotal: params.valorTotal,
    parcelas: Math.max(1, Math.floor(params.parcelas)),
    valorAVista:
      params.valorAVista != null && params.valorAVista > 0 ? params.valorAVista : null,
    linkCartao: params.linkCartao?.trim() || null,
    possibilidadeBonus: params.possibilidadeBonus?.trim() || null,
    rotulo: params.rotulo?.trim() || null,
    ordem: params.ordem ?? 0,
    linhaPrecoRole: params.linhaPrecoRole ?? 'desconto',
    criadoEm: serverTimestamp()
  })
  return ref.id
}

export async function updateLinhaNegociacao(
  id: string,
  params: {
    valorTotal: number
    parcelas: number
    valorAVista?: number | null
    linkCartao?: string | null
    possibilidadeBonus?: string | null
    rotulo?: string | null
    ordem?: number
    linhaPrecoRole?: LinhaPrecoRole
  }
): Promise<void> {
  await updateDoc(doc(db, 'linhas_negociacao', id), {
    valorTotal: params.valorTotal,
    parcelas: Math.max(1, Math.floor(params.parcelas)),
    valorAVista:
      params.valorAVista != null && params.valorAVista > 0 ? params.valorAVista : null,
    linkCartao: params.linkCartao?.trim() || null,
    possibilidadeBonus: params.possibilidadeBonus?.trim() || null,
    rotulo: params.rotulo?.trim() || null,
    linhaPrecoRole: params.linhaPrecoRole ?? 'desconto',
    ...(params.ordem !== undefined ? { ordem: params.ordem } : {})
  })
}

export async function deleteLinhaNegociacao(id: string): Promise<void> {
  await deleteDoc(doc(db, 'linhas_negociacao', id))
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

/** Squad comercial: agrega vendas dos closers/SDRs membros */
export interface SquadRow {
  id: string
  nome: string
  fotoUrl: string
  memberIds: string[]
  ordem: number
}

function docToSquad(d: { id: string; data: () => Record<string, unknown> }): SquadRow {
  const x = d.data()
  return {
    id: d.id,
    nome: String(x.nome ?? ''),
    fotoUrl: String(x.fotoUrl ?? ''),
    memberIds: Array.isArray(x.memberIds) ? x.memberIds.map((v) => String(v)) : [],
    ordem: Number(x.ordem ?? 0)
  }
}

export async function listSquads(): Promise<SquadRow[]> {
  const snapshot = await getDocs(collection(db, 'squads'))
  const rows = snapshot.docs.map(docToSquad)
  rows.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
  return rows
}

/** Garante que nenhum membro pertença a mais de um squad */
async function validateSquadMembersUnique(memberIds: string[], excludeSquadId?: string): Promise<void> {
  const uniq = [...new Set(memberIds.filter(Boolean))]
  if (uniq.length !== memberIds.filter(Boolean).length) {
    throw new Error('Membro duplicado no mesmo squad.')
  }
  const all = await listSquads()
  const set = new Set(uniq)
  for (const s of all) {
    if (excludeSquadId && s.id === excludeSquadId) continue
    for (const uid of s.memberIds) {
      if (set.has(uid)) {
        throw new Error(
          `Um ou mais membros já estão no squad "${s.nome}". Cada pessoa pode pertencer a apenas um squad.`
        )
      }
    }
  }
}

export async function addSquad(params: { nome: string; fotoUrl?: string; memberIds: string[] }): Promise<string> {
  await validateSquadMembersUnique(params.memberIds)
  const existing = await listSquads()
  const ordem = existing.length ? Math.max(...existing.map((s) => s.ordem)) + 1 : 0
  const ref = await addDoc(collection(db, 'squads'), {
    nome: params.nome.trim(),
    fotoUrl: (params.fotoUrl ?? '').trim(),
    memberIds: params.memberIds,
    ordem,
    criadoEm: serverTimestamp()
  })
  return ref.id
}

export async function updateSquad(
  id: string,
  params: { nome: string; fotoUrl?: string; memberIds: string[] }
): Promise<void> {
  await validateSquadMembersUnique(params.memberIds, id)
  await updateDoc(doc(db, 'squads', id), {
    nome: params.nome.trim(),
    fotoUrl: (params.fotoUrl ?? '').trim(),
    memberIds: params.memberIds,
    atualizadoEm: serverTimestamp()
  })
}

export async function deleteSquad(id: string): Promise<void> {
  await deleteDoc(doc(db, 'squads', id))
}

