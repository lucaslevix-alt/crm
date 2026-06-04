import { collection, getDocs, query, orderBy, limit, Timestamp } from 'firebase/firestore'
import { db } from './db'
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
