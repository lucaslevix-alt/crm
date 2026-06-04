import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from './db'
export interface BaseClientesOperacaoDoc {
  /** ano (string, ex. "2026") → mês ("1"…"12") → total (inteiro ≥ 0) */
  anos: Record<string, Record<string, number>>
}

const baseClientesOperacaoRef = doc(db, 'config', 'base_clientes_operacao')

function parseBaseClientesOperacaoDoc(data: Record<string, unknown> | undefined): BaseClientesOperacaoDoc {
  const anosRaw = data?.anos
  const anos: Record<string, Record<string, number>> = {}
  if (anosRaw && typeof anosRaw === 'object' && !Array.isArray(anosRaw)) {
    for (const [yKey, monthsVal] of Object.entries(anosRaw)) {
      if (!monthsVal || typeof monthsVal !== 'object' || Array.isArray(monthsVal)) continue
      const meses: Record<string, number> = {}
      for (const [mKey, v] of Object.entries(monthsVal)) {
        meses[String(mKey)] = Math.max(0, Math.floor(Number(v) || 0))
      }
      anos[String(yKey)] = meses
    }
  }
  return { anos }
}

export function getTotalClientesOperacaoMes(anos: BaseClientesOperacaoDoc['anos'], year: number, month: number): number {
  const y = String(year)
  const m = String(month)
  return Math.max(0, Math.floor(Number(anos[y]?.[m]) || 0))
}

export async function getBaseClientesOperacao(): Promise<BaseClientesOperacaoDoc> {
  const snap = await getDoc(baseClientesOperacaoRef)
  return parseBaseClientesOperacaoDoc(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined)
}

export async function setTotalClientesOperacaoMes(year: number, month: number, total: number): Promise<void> {
  const t = Math.max(0, Math.floor(Number(total) || 0))
  const y = String(year)
  const m = String(month)
  await runTransaction(db, async (trx) => {
    const snap = await trx.get(baseClientesOperacaoRef)
    const cur = parseBaseClientesOperacaoDoc(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined)
    const meses = { ...(cur.anos[y] ?? {}), [m]: t }
    const anos = { ...cur.anos, [y]: meses }
    trx.set(baseClientesOperacaoRef, { anos, atualizadoEm: serverTimestamp() }, { merge: true })
  })
}

/** Soma `adicionar` e subtrai `remover` do total do mês (mínimo 0). */
export async function ajustarTotalClientesOperacaoMes(
  year: number,
  month: number,
  adicionar: number,
  remover: number
): Promise<number> {
  const add = Math.max(0, Math.floor(Number(adicionar) || 0))
  const rem = Math.max(0, Math.floor(Number(remover) || 0))
  let novo = 0
  const y = String(year)
  const m = String(month)
  await runTransaction(db, async (trx) => {
    const snap = await trx.get(baseClientesOperacaoRef)
    const cur = parseBaseClientesOperacaoDoc(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined)
    const base = getTotalClientesOperacaoMes(cur.anos, year, month)
    novo = Math.max(0, base + add - rem)
    const meses = { ...(cur.anos[y] ?? {}), [m]: novo }
    const anos = { ...cur.anos, [y]: meses }
    trx.set(baseClientesOperacaoRef, { anos, atualizadoEm: serverTimestamp() }, { merge: true })
  })
  return novo
}
