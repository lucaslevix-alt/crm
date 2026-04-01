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
  runTransaction,
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
  /** Grupo de WhatsApp (reuniões SDR) */
  grupoWpp: string | null
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
    grupoWpp: x.grupoWpp != null && String(x.grupoWpp).trim() !== '' ? String(x.grupoWpp).trim() : null,
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

  const q = query(collection(db, 'usuarios'), where('email', '==', normalized), limit(1))
  const snapshot = await getDocs(q)
  const found = snapshot.docs[0]
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

export const METAS_CONFIG_KEYS: (keyof MetasConfig)[] = [
  'meta_reunioes_agendadas',
  'meta_reunioes_realizadas',
  'meta_reunioes_closer',
  'meta_vendas',
  'meta_faturamento',
  'meta_cash'
]

/** Metas por utilizador (userId → parcial). Legado; a configuração atual usa `MetasPorSquad`. */
export type MetasPorUsuario = Record<string, Partial<MetasConfig>>

/** Metas por squad (id do squad em `squads` → parcial), definidas manualmente em relação à meta global. */
export type MetasPorSquad = Record<string, Partial<MetasConfig>>

/** Bloco de um mês em `metasPorMes`. */
export type MetasMesBlock = Partial<MetasConfig> & {
  metasPorUsuario?: MetasPorUsuario
  metasPorSquad?: MetasPorSquad
}

/** Documento em `config/metas`: chaves na raiz = metas do mês calendário atual; `metasPorMes` = planejamento de outros meses. */
export type MetasFirestoreDoc = MetasConfig & {
  metasPorMes?: Record<string, MetasMesBlock>
  /** Legado. */
  metasPorUsuario?: MetasPorUsuario
  /** Repartição manual da meta comercial por squad (mês atual na raiz). */
  metasPorSquad?: MetasPorSquad
}

export function currentMetasMonthYm(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function parseMetaNumber(v: unknown): number | undefined {
  if (v == null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function pickRootMetasFromRaw(raw: Record<string, unknown>): MetasConfig {
  const o: MetasConfig = {}
  for (const k of METAS_CONFIG_KEYS) {
    const n = parseMetaNumber(raw[k as string])
    if (n != null) o[k] = n
  }
  return o
}

function parsePartialMetasFromRow(row: Record<string, unknown>): Partial<MetasConfig> {
  const partial: Partial<MetasConfig> = {}
  for (const k of METAS_CONFIG_KEYS) {
    const n = parseMetaNumber(row[k as string])
    if (n != null) partial[k] = n
  }
  return partial
}

function parseMetasPorUsuarioRaw(raw: unknown): MetasPorUsuario | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: MetasPorUsuario = {}
  for (const [uid, block] of Object.entries(raw as Record<string, unknown>)) {
    if (!uid.trim() || typeof block !== 'object' || block === null || Array.isArray(block)) continue
    const partial = parsePartialMetasFromRow(block as Record<string, unknown>)
    if (Object.keys(partial).length > 0) out[uid] = partial
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function parseMetasPorSquadRaw(raw: unknown): MetasPorSquad | undefined {
  return parseMetasPorUsuarioRaw(raw) as MetasPorSquad | undefined
}

function monthBlockFromRaw(block: unknown): MetasMesBlock {
  if (!block || typeof block !== 'object' || Array.isArray(block)) return {}
  const row = block as Record<string, unknown>
  const partial = parsePartialMetasFromRow(row)
  const metasPorUsuario = parseMetasPorUsuarioRaw(row.metasPorUsuario)
  const metasPorSquad = parseMetasPorSquadRaw(row.metasPorSquad)
  const out: MetasMesBlock = { ...partial }
  if (metasPorUsuario && Object.keys(metasPorUsuario).length > 0) out.metasPorUsuario = metasPorUsuario
  if (metasPorSquad && Object.keys(metasPorSquad).length > 0) out.metasPorSquad = metasPorSquad
  return out
}

function parseMetasPorMesRaw(raw: unknown): Record<string, MetasMesBlock> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: Record<string, MetasMesBlock> = {}
  for (const [ym, block] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}$/.test(ym)) continue
    const mb = monthBlockFromRaw(block)
    const temGlobal = METAS_CONFIG_KEYS.some((k) => mb[k] != null)
    const temInd = mb.metasPorUsuario && Object.keys(mb.metasPorUsuario).length > 0
    const temSq = mb.metasPorSquad && Object.keys(mb.metasPorSquad).length > 0
    if (temGlobal || temInd || temSq) out[ym] = mb
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function metasMesBlockToFirestore(block: MetasMesBlock): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  for (const k of METAS_CONFIG_KEYS) {
    const v = block[k]
    if (typeof v === 'number' && Number.isFinite(v)) o[k as string] = v
  }
  if (block.metasPorUsuario && Object.keys(block.metasPorUsuario).length > 0) {
    const inner: Record<string, unknown> = {}
    for (const [uid, partial] of Object.entries(block.metasPorUsuario)) {
      const sub: Record<string, number> = {}
      for (const k of METAS_CONFIG_KEYS) {
        const v = partial[k]
        if (typeof v === 'number' && Number.isFinite(v)) sub[k as string] = v
      }
      if (Object.keys(sub).length > 0) inner[uid] = sub
    }
    if (Object.keys(inner).length > 0) o.metasPorUsuario = inner
  }
  if (block.metasPorSquad && Object.keys(block.metasPorSquad).length > 0) {
    const inner: Record<string, unknown> = {}
    for (const [sid, partial] of Object.entries(block.metasPorSquad)) {
      const sub: Record<string, number> = {}
      for (const k of METAS_CONFIG_KEYS) {
        const v = partial[k]
        if (typeof v === 'number' && Number.isFinite(v)) sub[k as string] = v
      }
      if (Object.keys(sub).length > 0) inner[sid] = sub
    }
    if (Object.keys(inner).length > 0) o.metasPorSquad = inner
  }
  return o
}

export async function getMetasFirestoreDoc(): Promise<MetasFirestoreDoc> {
  const ref = doc(db, 'config', 'metas')
  const snap = await getDoc(ref)
  const raw = snap.exists() ? (snap.data() as Record<string, unknown>) : {}
  const root = pickRootMetasFromRaw(raw)
  const metasPorMes = parseMetasPorMesRaw(raw.metasPorMes)
  const metasPorUsuario = parseMetasPorUsuarioRaw(raw.metasPorUsuario)
  const metasPorSquad = parseMetasPorSquadRaw(raw.metasPorSquad)
  return { ...root, metasPorMes, metasPorUsuario, metasPorSquad }
}

function rootOnlyFromDoc(docRow: MetasFirestoreDoc): MetasConfig {
  const o: MetasConfig = {}
  for (const k of METAS_CONFIG_KEYS) {
    const v = docRow[k]
    if (typeof v === 'number' && Number.isFinite(v)) o[k] = v
  }
  return o
}

/**
 * Metas efetivas para um mês YYYY-MM.
 * - Mês calendário atual: sempre as chaves na raiz do documento (não mistura com `metasPorMes` do mesmo mês).
 * - Outros meses: base na raiz + sobrescritas em `metasPorMes[ym]` (campos vazios no planejamento herdam a raiz).
 */
export function resolveMetasParaMes(ym: string, docRow: MetasFirestoreDoc): MetasConfig {
  const root = rootOnlyFromDoc(docRow)
  if (ym === currentMetasMonthYm()) return { ...root }
  const ov = docRow.metasPorMes?.[ym]
  if (!ov) return { ...root }
  const merged: MetasConfig = { ...root }
  for (const k of METAS_CONFIG_KEYS) {
    const v = ov[k]
    if (typeof v === 'number' && Number.isFinite(v)) merged[k] = v
  }
  return merged
}

/** Metas individuais efetivas para o mês (raiz se mês atual; bloco do mês se planejado). */
export function resolveMetasIndividuaisParaMes(ym: string, docRow: MetasFirestoreDoc): MetasPorUsuario {
  if (ym === currentMetasMonthYm()) return docRow.metasPorUsuario ? { ...docRow.metasPorUsuario } : {}
  const mu = docRow.metasPorMes?.[ym]?.metasPorUsuario
  return mu ? { ...mu } : {}
}

/** Metas por squad efetivas para o mês (definição manual). */
export function resolveMetasSquadsParaMes(ym: string, docRow: MetasFirestoreDoc): MetasPorSquad {
  if (ym === currentMetasMonthYm()) return docRow.metasPorSquad ? { ...docRow.metasPorSquad } : {}
  const ms = docRow.metasPorMes?.[ym]?.metasPorSquad
  return ms ? { ...ms } : {}
}

export function resolveMetasSquadParaMes(ym: string, squadId: string, docRow: MetasFirestoreDoc): Partial<MetasConfig> {
  const m = resolveMetasSquadsParaMes(ym, docRow)
  const p = m[squadId]
  return p ? { ...p } : {}
}

/** Soma todas as metas individuais (por chave numérica). */
export function sumMetasPorUsuarioMap(map: MetasPorUsuario): MetasConfig {
  const list = Object.values(map)
  const o: MetasConfig = {}
  for (const k of METAS_CONFIG_KEYS) {
    let s = 0
    let any = false
    for (const p of list) {
      const v = p[k]
      if (typeof v === 'number' && Number.isFinite(v)) {
        s += v
        any = true
      }
    }
    if (any) o[k] = s
  }
  return o
}

/** Só a raiz (metas do mês atual), compatível com leituras antigas. */
export async function getMetasConfig(): Promise<MetasConfig> {
  const d = await getMetasFirestoreDoc()
  return rootOnlyFromDoc(d)
}

export async function setMetasConfig(params: MetasConfig): Promise<void> {
  const ref = doc(db, 'config', 'metas')
  const body: Record<string, number> = {}
  METAS_CONFIG_KEYS.forEach((k) => {
    const v = params[k]
    if (v != null) body[k as string] = v
  })
  await setDoc(ref, body, { merge: true })
}

/** Metas individuais do mês calendário atual (substitui o mapa inteiro). */
export async function setMetasPorUsuarioRoot(map: MetasPorUsuario): Promise<void> {
  const ref = doc(db, 'config', 'metas')
  const inner: Record<string, unknown> = {}
  for (const [uid, partial] of Object.entries(map)) {
    const sub: Record<string, number> = {}
    for (const k of METAS_CONFIG_KEYS) {
      const v = partial[k]
      if (typeof v === 'number' && Number.isFinite(v)) sub[k as string] = v
    }
    if (Object.keys(sub).length > 0) inner[uid] = sub
  }
  await setDoc(ref, { metasPorUsuario: Object.keys(inner).length > 0 ? inner : {} }, { merge: true })
}

/** Metas por squad do mês calendário atual (substitui o mapa inteiro). */
export async function setMetasPorSquadRoot(map: MetasPorSquad): Promise<void> {
  const ref = doc(db, 'config', 'metas')
  const inner: Record<string, unknown> = {}
  for (const [sid, partial] of Object.entries(map)) {
    const sub: Record<string, number> = {}
    for (const k of METAS_CONFIG_KEYS) {
      const v = partial[k]
      if (typeof v === 'number' && Number.isFinite(v)) sub[k as string] = v
    }
    if (Object.keys(sub).length > 0) inner[sid] = sub
  }
  await setDoc(ref, { metasPorSquad: Object.keys(inner).length > 0 ? inner : {} }, { merge: true })
}

/**
 * Grava planejamento de um mês futuro/passado (não pode ser o mês calendário atual — use `setMetasConfig`).
 * Valores `undefined` removem a sobrescrita daquele indicador (volta a herdar da raiz na resolução).
 * `metasPorUsuario` / `metasPorSquad`: se omitido, mantém o já salvo; se passado (incl. `{}`), substitui.
 */
export async function setMetasPorMes(
  ym: string,
  params: Partial<MetasConfig>,
  metasPorUsuario?: MetasPorUsuario,
  metasPorSquad?: MetasPorSquad
): Promise<void> {
  if (!/^\d{4}-\d{2}$/.test(ym)) throw new Error('Mês inválido (use YYYY-MM)')
  if (ym === currentMetasMonthYm()) {
    throw new Error('Use "Salvar metas do mês atual" para o mês corrente')
  }
  const ref = doc(db, 'config', 'metas')
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const raw = snap.exists() ? (snap.data() as Record<string, unknown>) : {}
    const map: Record<string, MetasMesBlock> = {}
    const prevPm = raw.metasPorMes
    if (prevPm && typeof prevPm === 'object' && !Array.isArray(prevPm)) {
      for (const [k, v] of Object.entries(prevPm as Record<string, unknown>)) {
        if (!/^\d{4}-\d{2}$/.test(k)) continue
        map[k] = monthBlockFromRaw(v)
      }
    }
    const prevBlock: MetasMesBlock = { ...(map[ym] ?? {}) }
    const nextBlock: MetasMesBlock = { ...prevBlock }
    for (const k of METAS_CONFIG_KEYS) {
      const v = params[k]
      if (v === undefined) {
        delete nextBlock[k]
      } else if (v === null) {
        delete nextBlock[k]
      } else {
        nextBlock[k] = v
      }
    }
    if (metasPorUsuario !== undefined) {
      if (Object.keys(metasPorUsuario).length === 0) {
        delete nextBlock.metasPorUsuario
      } else {
        nextBlock.metasPorUsuario = { ...metasPorUsuario }
      }
    }
    if (metasPorSquad !== undefined) {
      if (Object.keys(metasPorSquad).length === 0) {
        delete nextBlock.metasPorSquad
      } else {
        nextBlock.metasPorSquad = { ...metasPorSquad }
      }
    }
    const temGlobal = METAS_CONFIG_KEYS.some((k) => nextBlock[k] != null)
    const temInd = nextBlock.metasPorUsuario && Object.keys(nextBlock.metasPorUsuario).length > 0
    const temSq = nextBlock.metasPorSquad && Object.keys(nextBlock.metasPorSquad).length > 0
    if (!temGlobal && !temInd && !temSq) {
      delete map[ym]
    } else {
      map[ym] = nextBlock
    }
    const firestoreMap: Record<string, unknown> = {}
    for (const [k, block] of Object.entries(map)) {
      firestoreMap[k] = metasMesBlockToFirestore(block)
    }
    tx.set(ref, { metasPorMes: firestoreMap }, { merge: true })
  })
}

/** Remove todo planejamento salvo para um mês (volta a herdar só a raiz). */
export async function clearMetasPorMes(ym: string): Promise<void> {
  if (!/^\d{4}-\d{2}$/.test(ym)) return
  const ref = doc(db, 'config', 'metas')
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const raw = snap.exists() ? (snap.data() as Record<string, unknown>) : {}
    const map: Record<string, MetasMesBlock> = {}
    const prevPm = raw.metasPorMes
    if (prevPm && typeof prevPm === 'object' && !Array.isArray(prevPm)) {
      for (const [k, v] of Object.entries(prevPm as Record<string, unknown>)) {
        if (k === ym) continue
        if (!/^\d{4}-\d{2}$/.test(k)) continue
        map[k] = monthBlockFromRaw(v)
      }
    }
    const firestoreMap: Record<string, unknown> = {}
    for (const [k, block] of Object.entries(map)) {
      firestoreMap[k] = metasMesBlockToFirestore(block)
    }
    tx.set(ref, { metasPorMes: firestoreMap }, { merge: true })
  })
}

export async function addRegistro(params: {
  data: string
  tipo: string
  userId: string
  userName: string
  userCargo: string
  anuncio?: string | null
  grupoWpp?: string | null
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
    grupoWpp:
      params.grupoWpp != null && String(params.grupoWpp).trim() !== '' ? String(params.grupoWpp).trim() : null,
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
    grupoWpp?: string | null
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
    grupoWpp:
      params.grupoWpp != null && String(params.grupoWpp).trim() !== '' ? String(params.grupoWpp).trim() : null,
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

/** Agregação de leads SDR no intervalo: por usuário e por dia (YYYY-MM-DD). */
export interface LeadsSdrRangeBundle {
  byUser: LeadSdrRow[]
  byDay: Record<string, number>
}

export async function getLeadsSdrRangeBundle(
  start: string,
  end: string,
  opts?: { onlyUserIds?: Set<string> }
): Promise<LeadsSdrRangeBundle> {
  const q = query(
    collection(db, 'leads_sdr'),
    where('data', '>=', start),
    where('data', '<=', end)
  )
  const snapshot = await getDocs(q)
  const byUser = new Map<string, { userName: string; quantidade: number }>()
  const byDay = new Map<string, number>()
  const filterIds = opts?.onlyUserIds
  snapshot.docs.forEach((d) => {
    const x = d.data()
    const uid = String(x.userId ?? '')
    if (filterIds && filterIds.size > 0 && !filterIds.has(uid)) return
    const nome = String(x.userName ?? '—')
    const qtd = Number(x.quantidade ?? 0)
    const dataStr = String(x.data ?? '')
    if (dataStr) {
      byDay.set(dataStr, (byDay.get(dataStr) ?? 0) + qtd)
    }
    const cur = byUser.get(uid)
    if (cur) {
      cur.quantidade += qtd
    } else {
      byUser.set(uid, { userName: nome, quantidade: qtd })
    }
  })
  return {
    byUser: Array.from(byUser.entries()).map(([userId, v]) => ({
      userId,
      userName: v.userName,
      quantidade: v.quantidade
    })),
    byDay: Object.fromEntries(byDay)
  }
}

export async function getLeadsSdrByRange(start: string, end: string): Promise<LeadSdrRow[]> {
  const b = await getLeadsSdrRangeBundle(start, end)
  return b.byUser
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
  /** Selo opcional (ex.: “Economia de R$ X vs 2x trimestral” no contrato 6 meses) */
  textoSelo: string | null
}

/** Oferta / última condição / carta na manga: à vista + parcelado cartão + bônus + link */
export interface ProdutoBlocoCondicaoComercial {
  valorAVista: number | null
  valorParceladoCartao: number | null
  parcelasCartao: number | null
  bonus: string | null
  linkPagamento: string | null
  /** Tag na coluna “Tipo” (ex.: carta na manga com “Risco alto”) */
  tagExibicao: 'desconto' | 'risco_alto' | null
}

/** Quatro ofertas de um mesmo período de contrato (3 ou 6 meses) */
export interface ProdutoPacoteNegociacao {
  blocoPrecoTabela: ProdutoBlocoPrecoTabela
  blocoOferta: ProdutoBlocoCondicaoComercial
  blocoUltimaCondicao: ProdutoBlocoCondicaoComercial
  blocoCartaNaManga: ProdutoBlocoCondicaoComercial
}

export function emptyBlocoPrecoTabela(): ProdutoBlocoPrecoTabela {
  return {
    valorTotal: null,
    valorAVista: null,
    valorParceladoCartao: null,
    parcelasCartao: null,
    linkPagamento: null,
    textoSelo: null
  }
}

export function emptyBlocoCondicaoComercial(): ProdutoBlocoCondicaoComercial {
  return {
    valorAVista: null,
    valorParceladoCartao: null,
    parcelasCartao: null,
    bonus: null,
    linkPagamento: null,
    tagExibicao: null
  }
}

export function emptyPacoteNegociacao(): ProdutoPacoteNegociacao {
  return {
    blocoPrecoTabela: emptyBlocoPrecoTabela(),
    blocoOferta: emptyBlocoCondicaoComercial(),
    blocoUltimaCondicao: emptyBlocoCondicaoComercial(),
    blocoCartaNaManga: emptyBlocoCondicaoComercial()
  }
}

function clonePacoteNegociacao(p: ProdutoPacoteNegociacao): ProdutoPacoteNegociacao {
  return {
    blocoPrecoTabela: { ...p.blocoPrecoTabela },
    blocoOferta: { ...p.blocoOferta },
    blocoUltimaCondicao: { ...p.blocoUltimaCondicao },
    blocoCartaNaManga: { ...p.blocoCartaNaManga }
  }
}

export interface ProdutoRow {
  id: string
  nome: string
  /** Contrato 3 meses (campos de topo = referência principal no CRM legado) */
  blocoPrecoTabela: ProdutoBlocoPrecoTabela
  blocoOferta: ProdutoBlocoCondicaoComercial
  blocoUltimaCondicao: ProdutoBlocoCondicaoComercial
  blocoCartaNaManga: ProdutoBlocoCondicaoComercial
  /** Contrato 6 meses — mesmas quatro ofertas com valores próprios */
  negociacao6Meses: ProdutoPacoteNegociacao
  /** Legado / detalhamento por forma de pagamento (documentos antigos) */
  valor: number | null
  valorCartao: number | null
  parcelasCartao: number | null
  valorBoleto: number | null
  parcelasBoleto: number | null
  aVista: number | null
  desc: string | null
}

function parseTagExibicao(raw: unknown): 'desconto' | 'risco_alto' | null {
  if (raw === 'risco_alto') return 'risco_alto'
  if (raw === 'desconto') return 'desconto'
  return null
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
      linkPagamento: strOrNull(o.linkPagamento),
      textoSelo: strOrNull(o.textoSelo)
    }
  }
  const oldPreco = numOrNull(x.precoTabela) ?? numOrNull(x.valor)
  return {
    valorTotal: oldPreco,
    valorAVista: numOrNull(x.aVista) ?? oldPreco,
    valorParceladoCartao: numOrNull(x.valorCartao) ?? oldPreco,
    parcelasCartao: numOrNull(x.parcelasCartao),
    linkPagamento: null,
    textoSelo: null
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
      linkPagamento: strOrNull(o.linkPagamento),
      tagExibicao: parseTagExibicao(o.tagExibicao)
    }
  }
  const leg = strOrNull(x[legacyTextKey])
  return {
    valorAVista: null,
    valorParceladoCartao: null,
    parcelasCartao: null,
    bonus: leg,
    linkPagamento: null,
    tagExibicao: null
  }
}

function parsePacoteNegociacao(raw: Record<string, unknown>): ProdutoPacoteNegociacao | null {
  if (!raw || typeof raw !== 'object') return null
  return {
    blocoPrecoTabela: parseBlocoPrecoTabela({ ...raw, blocoPrecoTabela: raw.blocoPrecoTabela }),
    blocoOferta: parseBlocoCondicao(raw, 'blocoOferta', 'ofertaPromocional'),
    blocoUltimaCondicao: parseBlocoCondicao(raw, 'blocoUltimaCondicao', 'ultimaCondicao'),
    blocoCartaNaManga: parseBlocoCondicao(raw, 'blocoCartaNaManga', 'cartaNaManga')
  }
}

/** Pacote do período: 3 meses = campos no topo do documento; 6 meses = `negociacao6Meses`. */
export function produtoPacotePorMeses(p: ProdutoRow, meses: 3 | 6): ProdutoPacoteNegociacao {
  if (meses === 3) {
    return {
      blocoPrecoTabela: p.blocoPrecoTabela,
      blocoOferta: p.blocoOferta,
      blocoUltimaCondicao: p.blocoUltimaCondicao,
      blocoCartaNaManga: p.blocoCartaNaManga
    }
  }
  return p.negociacao6Meses
}

function produtoPrecoReferenciaDoBlocoTabela(bt: ProdutoBlocoPrecoTabela): number | null {
  if (bt.valorTotal != null && bt.valorTotal > 0) return bt.valorTotal
  if (bt.valorParceladoCartao != null && bt.valorParceladoCartao > 0) return bt.valorParceladoCartao
  if (bt.valorAVista != null && bt.valorAVista > 0) return bt.valorAVista
  return null
}

/** Referência única quando não há detalhe na coluna específica (ex.: só preço de tabela). */
export function produtoPrecoReferencia(p: ProdutoRow): number | null {
  const bt = p.blocoPrecoTabela
  const fromBloco = produtoPrecoReferenciaDoBlocoTabela(bt)
  if (fromBloco != null) return fromBloco
  if (p.valorCartao != null && p.valorCartao > 0) return p.valorCartao
  if (p.valorBoleto != null && p.valorBoleto > 0) return p.valorBoleto
  if (p.aVista != null && p.aVista > 0) return p.aVista
  if (p.valor != null && p.valor > 0) return p.valor
  return null
}

/** Referência a partir do preço de tabela do pacote (3 ou 6 meses), sem campos legados no documento. */
export function produtoPrecoReferenciaPorMeses(p: ProdutoRow, meses: 3 | 6): number | null {
  const bt = produtoPacotePorMeses(p, meses).blocoPrecoTabela
  const fromBloco = produtoPrecoReferenciaDoBlocoTabela(bt)
  if (fromBloco != null) return fromBloco
  if (meses === 3) return produtoPrecoReferencia(p)
  return null
}

export function produtoValorCartaoEfetivo(p: ProdutoRow, meses: 3 | 6 = 3): number | null {
  const bt = produtoPacotePorMeses(p, meses).blocoPrecoTabela
  if (bt.valorParceladoCartao != null && bt.valorParceladoCartao > 0) return bt.valorParceladoCartao
  if (meses === 3 && p.valorCartao != null && p.valorCartao > 0) return p.valorCartao
  return produtoPrecoReferenciaPorMeses(p, meses)
}

export function produtoParcelasCartaoEfetivo(p: ProdutoRow, meses: 3 | 6 = 3): number | null {
  const bt = produtoPacotePorMeses(p, meses).blocoPrecoTabela
  const v = produtoValorCartaoEfetivo(p, meses)
  if (v == null || v <= 0) return null
  if (bt.valorParceladoCartao != null && bt.valorParceladoCartao > 0) {
    const n = bt.parcelasCartao
    return n != null && n > 0 ? n : 1
  }
  if (meses === 3 && p.valorCartao != null && p.valorCartao > 0) {
    return p.parcelasCartao != null && p.parcelasCartao > 0 ? p.parcelasCartao : 1
  }
  return 1
}

export function produtoValorBoletoEfetivo(p: ProdutoRow, meses: 3 | 6 = 3): number | null {
  if (meses === 3 && p.valorBoleto != null && p.valorBoleto > 0) return p.valorBoleto
  return produtoPrecoReferenciaPorMeses(p, meses)
}

export function produtoParcelasBoletoEfetivo(p: ProdutoRow, meses: 3 | 6 = 3): number | null {
  const v = produtoValorBoletoEfetivo(p, meses)
  if (v == null || v <= 0) return null
  if (meses === 3 && p.valorBoleto != null && p.valorBoleto > 0) {
    return p.parcelasBoleto != null && p.parcelasBoleto > 0 ? p.parcelasBoleto : 1
  }
  return 1
}

export function produtoValorAVistaEfetivo(p: ProdutoRow, meses: 3 | 6 = 3): number | null {
  const bt = produtoPacotePorMeses(p, meses).blocoPrecoTabela
  if (bt.valorAVista != null && bt.valorAVista > 0) return bt.valorAVista
  if (meses === 3 && p.aVista != null && p.aVista > 0) return p.aVista
  return produtoPrecoReferenciaPorMeses(p, meses)
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
    const blocoPrecoTabela = parseBlocoPrecoTabela(x)
    const blocoOferta = parseBlocoCondicao(x, 'blocoOferta', 'ofertaPromocional')
    const blocoUltimaCondicao = parseBlocoCondicao(x, 'blocoUltimaCondicao', 'ultimaCondicao')
    const blocoCartaNaManga = parseBlocoCondicao(x, 'blocoCartaNaManga', 'cartaNaManga')
    const pacote3: ProdutoPacoteNegociacao = {
      blocoPrecoTabela,
      blocoOferta,
      blocoUltimaCondicao,
      blocoCartaNaManga
    }
    const raw6 = x.negociacao6Meses
    const negociacao6Meses =
      raw6 && typeof raw6 === 'object' && !Array.isArray(raw6)
        ? parsePacoteNegociacao(raw6 as Record<string, unknown>) ?? clonePacoteNegociacao(pacote3)
        : clonePacoteNegociacao(pacote3)
    return {
      id: d.id,
      nome: String(x.nome ?? ''),
      blocoPrecoTabela,
      blocoOferta,
      blocoUltimaCondicao,
      blocoCartaNaManga,
      negociacao6Meses,
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
    linkPagamento: b.linkPagamento,
    textoSelo: b.textoSelo
  }
}

function serializeBlocoCondicao(b: ProdutoBlocoCondicaoComercial): Record<string, unknown> {
  return {
    valorAVista: b.valorAVista,
    valorParceladoCartao: b.valorParceladoCartao,
    parcelasCartao: b.parcelasCartao,
    bonus: b.bonus,
    linkPagamento: b.linkPagamento,
    tagExibicao: b.tagExibicao
  }
}

function serializePacoteNegociacao(p: ProdutoPacoteNegociacao): Record<string, unknown> {
  return {
    blocoPrecoTabela: serializeBlocoTabela(p.blocoPrecoTabela),
    blocoOferta: serializeBlocoCondicao(p.blocoOferta),
    blocoUltimaCondicao: serializeBlocoCondicao(p.blocoUltimaCondicao),
    blocoCartaNaManga: serializeBlocoCondicao(p.blocoCartaNaManga)
  }
}

export async function addProduto(params: {
  nome: string
  blocoPrecoTabela: ProdutoBlocoPrecoTabela
  blocoOferta: ProdutoBlocoCondicaoComercial
  blocoUltimaCondicao: ProdutoBlocoCondicaoComercial
  blocoCartaNaManga: ProdutoBlocoCondicaoComercial
  negociacao6Meses: ProdutoPacoteNegociacao
}): Promise<string> {
  const ref = await addDoc(collection(db, 'produtos'), {
    nome: params.nome,
    blocoPrecoTabela: serializeBlocoTabela(params.blocoPrecoTabela),
    blocoOferta: serializeBlocoCondicao(params.blocoOferta),
    blocoUltimaCondicao: serializeBlocoCondicao(params.blocoUltimaCondicao),
    blocoCartaNaManga: serializeBlocoCondicao(params.blocoCartaNaManga),
    negociacao6Meses: serializePacoteNegociacao(params.negociacao6Meses),
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
    negociacao6Meses: ProdutoPacoteNegociacao
  }
): Promise<void> {
  await updateDoc(doc(db, 'produtos', id), {
    nome: params.nome,
    blocoPrecoTabela: serializeBlocoTabela(params.blocoPrecoTabela),
    blocoOferta: serializeBlocoCondicao(params.blocoOferta),
    blocoUltimaCondicao: serializeBlocoCondicao(params.blocoUltimaCondicao),
    blocoCartaNaManga: serializeBlocoCondicao(params.blocoCartaNaManga),
    negociacao6Meses: serializePacoteNegociacao(params.negociacao6Meses)
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

/**
 * Coleção legada `linhas_negociacao` (linhas livres por produto). O CRM atual usa as quatro ofertas do documento do
 * produto; estes tipos permanecem para ler vendas antigas e limpar ao apagar produto.
 */
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
  const q = query(
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

/** Agenda interna (Firestore): reuniões agendadas pelo SDR, ações do closer */
export type AgendamentoStatus = 'agendada' | 'realizada' | 'venda' | 'no_show'

export interface AgendamentoRow {
  id: string
  squadId: string
  squadNome: string
  sdrUserId: string
  sdrUserName: string
  sdrUserCargo: string
  origemLead: string | null
  grupoWpp: string
  data: string
  status: AgendamentoStatus
  registroAgendadaId: string
  registroRealizadaSdrId: string | null
  registroCloserId: string | null
  registroVendaId: string | null
  registroNoShowId: string | null
  closerUserId: string | null
  closerUserName: string | null
  criadoEm?: Timestamp | null
}

function docToAgendamento(d: { id: string; data: () => Record<string, unknown> }): AgendamentoRow {
  const x = d.data()
  const st = x.status
  const status: AgendamentoStatus =
    st === 'realizada' || st === 'venda' || st === 'no_show' ? st : 'agendada'
  return {
    id: d.id,
    squadId: String(x.squadId ?? ''),
    squadNome: String(x.squadNome ?? ''),
    sdrUserId: String(x.sdrUserId ?? ''),
    sdrUserName: String(x.sdrUserName ?? ''),
    sdrUserCargo: String(x.sdrUserCargo ?? 'sdr'),
    origemLead: (() => {
      const raw = x.origemLead ?? x.campanhaMetaAds
      return raw != null && String(raw).trim() !== '' ? String(raw).trim() : null
    })(),
    grupoWpp: String(x.grupoWpp ?? ''),
    data: String(x.data ?? ''),
    status,
    registroAgendadaId: String(x.registroAgendadaId ?? ''),
    registroRealizadaSdrId: x.registroRealizadaSdrId != null ? String(x.registroRealizadaSdrId) : null,
    registroCloserId: x.registroCloserId != null ? String(x.registroCloserId) : null,
    registroVendaId: x.registroVendaId != null ? String(x.registroVendaId) : null,
    registroNoShowId: x.registroNoShowId != null ? String(x.registroNoShowId) : null,
    closerUserId: x.closerUserId != null ? String(x.closerUserId) : null,
    closerUserName: x.closerUserName != null ? String(x.closerUserName) : null,
    criadoEm: (x.criadoEm as Timestamp | undefined) ?? null
  }
}

export async function resolveSquadForUserId(userId: string): Promise<{ squadId: string; squadNome: string } | null> {
  const squads = await listSquads()
  for (const s of squads) {
    if (s.memberIds.includes(userId)) return { squadId: s.id, squadNome: s.nome }
  }
  return null
}

export async function createAgendamentoFromSdr(params: {
  sdrUserId: string
  sdrUserName: string
  sdrCargo: string
  origemLead: string
  grupoWpp: string
}): Promise<{ agendamentoId: string; registroAgendadaId: string; squadId: string; squadNome: string }> {
  const squad = await resolveSquadForUserId(params.sdrUserId)
  if (!squad) throw new Error('O utilizador precisa estar num squad para agendar na agenda do squad.')
  const origem = params.origemLead.trim()
  const grupo = params.grupoWpp.trim()
  if (!origem || !grupo) throw new Error('Origem do lead e nome do lead são obrigatórios.')
  const data = new Date().toISOString().split('T')[0]
  const registroAgendadaId = await addRegistro({
    data,
    tipo: 'reuniao_agendada',
    userId: params.sdrUserId,
    userName: params.sdrUserName,
    userCargo: params.sdrCargo,
    anuncio: origem,
    grupoWpp: grupo
  })
  const ref = await addDoc(collection(db, 'agendamentos'), {
    squadId: squad.squadId,
    squadNome: squad.squadNome,
    sdrUserId: params.sdrUserId,
    sdrUserName: params.sdrUserName,
    sdrUserCargo: params.sdrCargo,
    origemLead: origem,
    grupoWpp: grupo,
    data,
    status: 'agendada',
    registroAgendadaId,
    registroRealizadaSdrId: null,
    registroCloserId: null,
    registroVendaId: null,
    registroNoShowId: null,
    closerUserId: null,
    closerUserName: null,
    criadoEm: serverTimestamp()
  })
  return { agendamentoId: ref.id, registroAgendadaId, squadId: squad.squadId, squadNome: squad.squadNome }
}

export async function listAgendamentos(params: { squadId: string | null; admin: boolean }): Promise<AgendamentoRow[]> {
  if (params.admin) {
    const q = query(collection(db, 'agendamentos'), orderBy('criadoEm', 'desc'), limit(500))
    const snap = await getDocs(q)
    return snap.docs.map((d) => docToAgendamento({ id: d.id, data: () => d.data() as Record<string, unknown> }))
  }
  if (!params.squadId) return []
  const q = query(collection(db, 'agendamentos'), where('squadId', '==', params.squadId))
  const snap = await getDocs(q)
  const rows = snap.docs.map((d) => docToAgendamento({ id: d.id, data: () => d.data() as Record<string, unknown> }))
  rows.sort((a, b) => {
    const ma = a.criadoEm?.toMillis?.() ?? 0
    const mb = b.criadoEm?.toMillis?.() ?? 0
    return mb - ma
  })
  return rows
}

export async function marcarAgendamentoRealizada(params: {
  agendamentoId: string
  closer: { id: string; nome: string; cargo: string }
}): Promise<void> {
  const ref = doc(db, 'agendamentos', params.agendamentoId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Agendamento não encontrado.')
  const row = docToAgendamento({ id: snap.id, data: () => snap.data() as Record<string, unknown> })
  if (row.status !== 'agendada') {
    throw new Error('Só é possível marcar como realizada quando o status é “agendada”.')
  }
  const obsSdr = `Agenda · closer ${params.closer.nome}`
  const registroRealizadaSdrId = await addRegistro({
    data: row.data,
    tipo: 'reuniao_realizada',
    userId: row.sdrUserId,
    userName: row.sdrUserName,
    userCargo: row.sdrUserCargo,
    anuncio: row.origemLead,
    grupoWpp: row.grupoWpp,
    obs: obsSdr
  })
  const registroCloserId = await addRegistro({
    data: row.data,
    tipo: 'reuniao_closer',
    userId: params.closer.id,
    userName: params.closer.nome,
    userCargo: params.closer.cargo,
    anuncio: row.origemLead,
    grupoWpp: row.grupoWpp,
    obs: `Squad ${row.squadNome} · SDR ${row.sdrUserName}`
  })
  await updateDoc(ref, {
    status: 'realizada',
    registroRealizadaSdrId,
    registroCloserId,
    closerUserId: params.closer.id,
    closerUserName: params.closer.nome,
    atualizadoEm: serverTimestamp()
  })
}

/** Closer: lead não compareceu — registo `reuniao_no_show` (SDR) para métricas; sem realizada/closer. */
export async function marcarAgendamentoNoShow(params: {
  agendamentoId: string
  closer: { id: string; nome: string; cargo: string }
}): Promise<void> {
  const ref = doc(db, 'agendamentos', params.agendamentoId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Agendamento não encontrado.')
  const row = docToAgendamento({ id: snap.id, data: () => snap.data() as Record<string, unknown> })
  if (row.status !== 'agendada') {
    throw new Error('Só é possível marcar no-show quando o status é “agendada”.')
  }
  const registroNoShowId = await addRegistro({
    data: row.data,
    tipo: 'reuniao_no_show',
    userId: row.sdrUserId,
    userName: row.sdrUserName,
    userCargo: row.sdrUserCargo,
    anuncio: row.origemLead,
    grupoWpp: row.grupoWpp,
    obs: `No show · closer ${params.closer.nome}`
  })
  await updateDoc(ref, {
    status: 'no_show',
    registroNoShowId,
    closerUserId: params.closer.id,
    closerUserName: params.closer.nome,
    atualizadoEm: serverTimestamp()
  })
}

export async function marcarAgendamentoVenda(params: {
  agendamentoId: string
  closer: { id: string; nome: string; cargo: string }
  nomeCliente: string
  valor: number
  cashCollected?: number
  formaPagamento: FormaPagamentoVenda
  produtosIds: string[]
  produtosDetalhes: RegistroProdutoItem[]
  valorReferenciaVenda: number
  descontoCloser: number
}): Promise<void> {
  const ref = doc(db, 'agendamentos', params.agendamentoId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Agendamento não encontrado.')
  const row = docToAgendamento({ id: snap.id, data: () => snap.data() as Record<string, unknown> })
  if (row.status === 'venda') throw new Error('Este agendamento já está marcado como venda.')
  if (row.status === 'no_show') throw new Error('Este agendamento está em no-show. Não é possível registrar venda.')

  let registroRealizadaSdrId = row.registroRealizadaSdrId
  let registroCloserId = row.registroCloserId

  if (row.status === 'agendada') {
    const obsSdr = `Agenda · venda · closer ${params.closer.nome}`
    registroRealizadaSdrId = await addRegistro({
      data: row.data,
      tipo: 'reuniao_realizada',
      userId: row.sdrUserId,
      userName: row.sdrUserName,
      userCargo: row.sdrUserCargo,
      anuncio: row.origemLead,
      grupoWpp: row.grupoWpp,
      obs: obsSdr
    })
  }

  const registroVendaId = await addRegistro({
    data: row.data,
    tipo: 'venda',
    userId: params.closer.id,
    userName: params.closer.nome,
    userCargo: params.closer.cargo,
    anuncio: row.origemLead,
    grupoWpp: row.grupoWpp,
    valor: params.valor,
    cashCollected: params.cashCollected ?? 0,
    formaPagamento: params.formaPagamento,
    nomeCliente: params.nomeCliente.trim(),
    obs: `Agenda · SDR ${row.sdrUserName} · ${row.grupoWpp}`,
    produtosIds: params.produtosIds,
    produtosDetalhes: params.produtosDetalhes,
    valorReferenciaVenda: params.valorReferenciaVenda,
    descontoCloser: params.descontoCloser
  })

  await updateDoc(ref, {
    status: 'venda',
    registroRealizadaSdrId,
    registroCloserId,
    registroVendaId,
    closerUserId: params.closer.id,
    closerUserName: params.closer.nome,
    atualizadoEm: serverTimestamp()
  })
}

