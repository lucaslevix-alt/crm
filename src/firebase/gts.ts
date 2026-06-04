import { doc, getDoc, getDocFromServer, setDoc, serverTimestamp } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { initFirebaseApp } from './config'
import { db } from './db'

const app = initFirebaseApp()
/** Legado: vendas GT por mês (`config/gts_vendas_operacao`) — só migração para `gts_vendas_atual`. */
interface GtsVendasOperacaoDoc {
  /** ano → mês → userId (GT) → quantidade de vendas (inteiro ≥ 0) */
  anos: Record<string, Record<string, Record<string, number>>>
}

const gtsVendasOperacaoRef = doc(db, 'config', 'gts_vendas_operacao')

function parseGtsVendasOperacaoDoc(data: Record<string, unknown> | undefined): GtsVendasOperacaoDoc {
  const anosRaw = data?.anos
  const anos: Record<string, Record<string, Record<string, number>>> = {}
  if (anosRaw && typeof anosRaw === 'object' && !Array.isArray(anosRaw)) {
    for (const [yKey, monthsVal] of Object.entries(anosRaw)) {
      if (!monthsVal || typeof monthsVal !== 'object' || Array.isArray(monthsVal)) continue
      const meses: Record<string, Record<string, number>> = {}
      for (const [mKey, usersVal] of Object.entries(monthsVal)) {
        if (!usersVal || typeof usersVal !== 'object' || Array.isArray(usersVal)) continue
        const byUser: Record<string, number> = {}
        for (const [uid, v] of Object.entries(usersVal)) {
          byUser[String(uid)] = Math.max(0, Math.floor(Number(v) || 0))
        }
        meses[String(mKey)] = byUser
      }
      anos[String(yKey)] = meses
    }
  }
  return { anos }
}

async function getGtsVendasOperacao(): Promise<GtsVendasOperacaoDoc> {
  const snap = await getDoc(gtsVendasOperacaoRef)
  return parseGtsVendasOperacaoDoc(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined)
}

/** Disputa ativa de vendas por GT — um total por gestor, sem cadastro mês a mês na UI. */
export interface GtsVendasAtualDoc {
  /** Período da disputa, ex. "2026-05" */
  periodYm: string
  totals: Record<string, number>
}

const gtsVendasAtualRef = doc(db, 'config', 'gts_vendas_atual')

export function currentGtsVendasPeriodYm(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function sanitizeGtsTotalsMap(raw: Record<string, unknown>): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const [uid, v] of Object.entries(raw)) {
    const n = Math.floor(Number(v))
    if (!Number.isFinite(n)) continue
    totals[String(uid)] = Math.max(0, n)
  }
  return totals
}

function totalsFromLegacyAnos(
  anos: GtsVendasOperacaoDoc['anos'],
  periodYm: string
): Record<string, number> {
  const parts = periodYm.trim().split('-')
  if (parts.length < 2) return {}
  const y = parts[0]
  const m = String(parseInt(parts[1], 10))
  if (!Number.isFinite(parseInt(parts[1], 10))) return {}
  const monthData = anos[y]?.[m] ?? {}
  const totals: Record<string, number> = {}
  for (const [uid, v] of Object.entries(monthData)) {
    const n = Math.max(0, Math.floor(Number(v) || 0))
    if (n > 0) totals[String(uid)] = n
  }
  return totals
}

function parseGtsVendasAtualDoc(data: Record<string, unknown> | undefined): GtsVendasAtualDoc {
  const periodYm = String(data?.periodYm ?? '').trim() || currentGtsVendasPeriodYm()
  const totalsRaw = data?.totals
  let totals: Record<string, number> = {}
  if (totalsRaw && typeof totalsRaw === 'object' && !Array.isArray(totalsRaw)) {
    totals = sanitizeGtsTotalsMap(totalsRaw as Record<string, unknown>)
  }
  if (!Object.keys(totals).length && data?.anos) {
    totals = totalsFromLegacyAnos(parseGtsVendasOperacaoDoc(data).anos, periodYm)
  }
  return { periodYm, totals }
}

function assertFirestoreAuth(): void {
  const auth = getAuth(app)
  if (!auth.currentUser?.uid) {
    throw new Error('Sessão expirada ou não autenticado. Faça login novamente.')
  }
}

async function readGtsVendasAtualSnap(fromServer = false) {
  if (fromServer) {
    try {
      return await getDocFromServer(gtsVendasAtualRef)
    } catch {
      return getDoc(gtsVendasAtualRef)
    }
  }
  return getDoc(gtsVendasAtualRef)
}

export function getVendasGtAtual(doc: GtsVendasAtualDoc, userId: string): number {
  const uid = String(userId ?? '').trim()
  if (!uid) return 0
  return Math.max(0, Math.floor(Number(doc.totals[uid]) || 0))
}

async function migrateGtsVendasAtualFromLegacy(): Promise<GtsVendasAtualDoc | null> {
  const old = await getGtsVendasOperacao()
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const monthData = old.anos[String(y)]?.[String(m)] ?? {}
  const totals: Record<string, number> = {}
  for (const [uid, v] of Object.entries(monthData)) {
    const n = Math.max(0, Math.floor(Number(v) || 0))
    if (n > 0) totals[uid] = n
  }
  if (!Object.keys(totals).length) return null
  const migrated: GtsVendasAtualDoc = { periodYm: currentGtsVendasPeriodYm(now), totals }
  await setDoc(
    gtsVendasAtualRef,
    { periodYm: migrated.periodYm, totals: migrated.totals, atualizadoEm: serverTimestamp() },
    { merge: true }
  )
  return migrated
}

export async function getGtsVendasAtual(opts?: { fromServer?: boolean }): Promise<GtsVendasAtualDoc> {
  const snap = await readGtsVendasAtualSnap(opts?.fromServer === true)
  if (snap.exists()) {
    const parsed = parseGtsVendasAtualDoc(snap.data() as Record<string, unknown>)
    if (Object.keys(parsed.totals).length) return parsed

    const migrated = await migrateGtsVendasAtualFromLegacy()
    if (migrated && Object.keys(migrated.totals).length) return migrated
    return parsed
  }
  const migrated = await migrateGtsVendasAtualFromLegacy()
  if (migrated) return migrated
  const initial: GtsVendasAtualDoc = { periodYm: currentGtsVendasPeriodYm(), totals: {} }
  await setDoc(gtsVendasAtualRef, {
    periodYm: initial.periodYm,
    totals: {},
    atualizadoEm: serverTimestamp()
  })
  return initial
}

/** Soma `adicionar` e subtrai `remover` (mínimo 0) no total do GT na disputa ativa. */
export async function ajustarVendasGtAtual(
  userId: string,
  adicionar: number,
  remover: number
): Promise<number> {
  assertFirestoreAuth()

  const add = Math.max(0, Math.floor(Number(adicionar) || 0))
  const rem = Math.max(0, Math.floor(Number(remover) || 0))
  const uid = String(userId ?? '').trim()
  if (!uid) throw new Error('GT inválido.')
  if (add === 0 && rem === 0) throw new Error('Informe quantidade a adicionar ou remover.')

  const snap = await readGtsVendasAtualSnap(true)
  let cur: GtsVendasAtualDoc = snap.exists()
    ? parseGtsVendasAtualDoc(snap.data() as Record<string, unknown>)
    : { periodYm: currentGtsVendasPeriodYm(), totals: {} }

  if (snap.exists()) {
    const rawTotals = (snap.data() as Record<string, unknown>)?.totals
    if (rawTotals != null && (typeof rawTotals !== 'object' || Array.isArray(rawTotals))) {
      cur = { periodYm: cur.periodYm, totals: {} }
    }
  }

  if (!Object.keys(cur.totals).length) {
    const migrated = await migrateGtsVendasAtualFromLegacy()
    if (migrated && Object.keys(migrated.totals).length) {
      cur = migrated
    }
  }

  const base = getVendasGtAtual(cur, uid)
  const novo = Math.max(0, base + add - rem)
  const periodYm = cur.periodYm || currentGtsVendasPeriodYm()
  const totals = sanitizeGtsTotalsMap({ ...cur.totals, [uid]: novo })

  await setDoc(
    gtsVendasAtualRef,
    { periodYm, totals, atualizadoEm: serverTimestamp() },
    { merge: true }
  )

  return novo
}

/** Zera todos os totais e reinicia a disputa no mês calendário atual. */
export async function resetGtsVendasAtual(): Promise<GtsVendasAtualDoc> {
  assertFirestoreAuth()
  const periodYm = currentGtsVendasPeriodYm()
  const next: GtsVendasAtualDoc = { periodYm, totals: {} }
  await setDoc(gtsVendasAtualRef, {
    periodYm,
    totals: {},
    resetadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  })
  return next
}
