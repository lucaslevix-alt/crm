import {
  getRegistrosByRange,
  listUsers,
  listAgendamentosByRegistroVendaIds,
  type RegistroRow
} from '../firebase/firestore'
import type { CrmUser } from '../store/useAppStore'
import { contaParaComissao } from './registroComissao'
import { mRange } from './dates'

export type SdrOverviewRow = {
  id: string
  nome: string
  ag: number
  re: number
  vn: number
  ft: number
}

export type CloserOverviewRow = {
  id: string
  nome: string
  cl: number
  vn: number
  ft: number
  convPct: number | null
}

export function isSdrCargo(cargo: string | undefined): boolean {
  const c = String(cargo ?? '').trim().toLowerCase()
  return c === 'sdr' || c === 'admin'
}

export function isCloserCargo(cargo: string | undefined): boolean {
  const c = String(cargo ?? '').trim().toLowerCase()
  return c === 'closer' || c === 'admin'
}

export function monthValueFromDate(d = new Date()): string {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  return `${y}-${String(m).padStart(2, '0')}`
}

export function shiftMonthYm(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map((x) => parseInt(x, 10))
  const d = new Date(y, m - 1 + delta, 1)
  return monthValueFromDate(d)
}

export function formatMonthLabelYm(ym: string): string {
  const [y, m] = ym.split('-').map((x) => parseInt(x, 10))
  const d = new Date(y, m - 1, 1)
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(d)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export async function loadSdrRankingOverview(ym: string): Promise<SdrOverviewRow[]> {
  const { start, end } = mRange(ym)
  const [recs, users] = await Promise.all([getRegistrosByRange(start, end), listUsers()])
  return buildSdrRows(recs, users)
}

export async function loadCloserRankingOverview(ym: string): Promise<CloserOverviewRow[]> {
  const { start, end } = mRange(ym)
  const [recs, users] = await Promise.all([getRegistrosByRange(start, end), listUsers()])
  return buildCloserRows(recs, users)
}

export async function buildSdrRows(recs: RegistroRow[], users: CrmUser[]): Promise<SdrOverviewRow[]> {
  const validRecs = recs.filter(contaParaComissao)
  const usersById = new Map(users.map((u) => [u.id, u]))
  const sdrUsers = users.filter((u) => isSdrCargo(u.cargo))
  const sdrIdSet = new Set(sdrUsers.map((u) => u.id))

  const m = new Map<string, SdrOverviewRow>()
  for (const u of sdrUsers) {
    m.set(u.id, { id: u.id, nome: u.nome, ag: 0, re: 0, vn: 0, ft: 0 })
  }

  validRecs
    .filter(
      (r) =>
        sdrIdSet.has(r.userId) &&
        (r.tipo === 'reuniao_agendada' || r.tipo === 'reuniao_realizada' || r.tipo === 'reuniao_no_show')
    )
    .forEach((r) => {
      ensureSdrRow(m, r.userId, usersById, r.userName)
      const s = m.get(r.userId)!
      if (r.tipo === 'reuniao_agendada') s.ag++
      else if (r.tipo === 'reuniao_realizada') s.re++
    })

  const vendas = validRecs.filter((r) => r.tipo === 'venda')
  const ags = await listAgendamentosByRegistroVendaIds(vendas.map((r) => r.id))
  const vendaIdToSdr = new Map<string, string>()
  for (const ag of ags) {
    const vid = (ag.registroVendaId ?? '').trim()
    if (vid) vendaIdToSdr.set(vid, ag.sdrUserId)
  }
  for (const r of vendas) {
    const sdrId = vendaIdToSdr.get(r.id) ?? (r.vendaSdrUserId?.trim() ? r.vendaSdrUserId.trim() : '')
    if (!sdrId || !sdrIdSet.has(sdrId)) continue
    ensureSdrRow(m, sdrId, usersById, r.userName)
    const s = m.get(sdrId)!
    s.vn++
    s.ft += r.valor || 0
  }

  return Array.from(m.values())
    .filter((s) => s.ag + s.re + s.vn > 0)
    .sort((a, b) => b.ft - a.ft || b.vn - a.vn || b.re - a.re || a.nome.localeCompare(b.nome, 'pt-BR'))
}

export async function buildCloserRows(recs: RegistroRow[], users: CrmUser[]): Promise<CloserOverviewRow[]> {
  const validRecs = recs.filter(contaParaComissao)
  const usersById = new Map(users.map((u) => [u.id, u]))
  const closerUsers = users.filter((u) => isCloserCargo(u.cargo))
  const closerIdSet = new Set(closerUsers.map((u) => u.id))

  const m = new Map<string, CloserOverviewRow>()
  for (const u of closerUsers) {
    m.set(u.id, { id: u.id, nome: u.nome, cl: 0, vn: 0, ft: 0, convPct: null })
  }

  validRecs
    .filter((r) => closerIdSet.has(r.userId) && r.tipo === 'reuniao_closer')
    .forEach((r) => {
      ensureCloserRow(m, r.userId, usersById, r.userName)
      m.get(r.userId)!.cl++
    })

  validRecs
    .filter((r) => closerIdSet.has(r.userId) && r.tipo === 'venda')
    .forEach((r) => {
      ensureCloserRow(m, r.userId, usersById, r.userName)
      const s = m.get(r.userId)!
      s.vn++
      s.ft += r.valor || 0
    })

  return Array.from(m.values())
    .map((s) => ({
      ...s,
      convPct: s.cl > 0 ? (s.vn / s.cl) * 100 : null
    }))
    .filter((s) => s.cl + s.vn > 0)
    .sort((a, b) => b.ft - a.ft || b.vn - a.vn || a.nome.localeCompare(b.nome, 'pt-BR'))
}

function ensureSdrRow(
  m: Map<string, SdrOverviewRow>,
  userId: string,
  usersById: Map<string, CrmUser>,
  fallbackName: string
): void {
  if (!m.has(userId)) {
    const u = usersById.get(userId)
    m.set(userId, {
      id: userId,
      nome: u?.nome ?? fallbackName,
      ag: 0,
      re: 0,
      vn: 0,
      ft: 0
    })
  }
}

function ensureCloserRow(
  m: Map<string, CloserOverviewRow>,
  userId: string,
  usersById: Map<string, CrmUser>,
  fallbackName: string
): void {
  if (!m.has(userId)) {
    const u = usersById.get(userId)
    m.set(userId, {
      id: userId,
      nome: u?.nome ?? fallbackName,
      cl: 0,
      vn: 0,
      ft: 0,
      convPct: null
    })
  }
}

export function sumSdrRows(rows: SdrOverviewRow[]): SdrOverviewRow {
  return rows.reduce(
    (acc, r) => ({
      id: 'total',
      nome: 'Total',
      ag: acc.ag + r.ag,
      re: acc.re + r.re,
      vn: acc.vn + r.vn,
      ft: acc.ft + r.ft
    }),
    { id: 'total', nome: 'Total', ag: 0, re: 0, vn: 0, ft: 0 }
  )
}

export function sumCloserRows(rows: CloserOverviewRow[]): CloserOverviewRow {
  const base = rows.reduce(
    (acc, r) => ({
      id: 'total',
      nome: 'Total',
      cl: acc.cl + r.cl,
      vn: acc.vn + r.vn,
      ft: acc.ft + r.ft,
      convPct: null
    }),
    { id: 'total', nome: 'Total', cl: 0, vn: 0, ft: 0, convPct: null }
  )
  base.convPct = base.cl > 0 ? (base.vn / base.cl) * 100 : null
  return base
}
