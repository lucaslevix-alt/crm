import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore'
import { db } from './db'

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

/** Metas por squad efetivas para o mês (definição manual). */
export function resolveMetasSquadsParaMes(ym: string, docRow: MetasFirestoreDoc): MetasPorSquad {
  if (ym === currentMetasMonthYm()) return docRow.metasPorSquad ? { ...docRow.metasPorSquad } : {}
  const ms = docRow.metasPorMes?.[ym]?.metasPorSquad
  return ms ? { ...ms } : {}
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
