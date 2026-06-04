import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore'
import { db } from './db'

export type AvisoTipo = 'recado' | 'comunicado' | 'operacao'
export type AvisoPrioridade = 'normal' | 'alta' | 'urgente'

export interface AvisoRow {
  id: string
  tipo: AvisoTipo
  prioridade: AvisoPrioridade
  titulo: string
  mensagem: string
  ativo: boolean
  fixo: boolean
  /** ISO string; vazio = sem expiração */
  expiraEm: string | null
  /** URL pública (Firebase Storage) */
  fotoUrl?: string | null
  criadoPorId: string
  criadoPorNome: string
  criadoEm?: { seconds: number } | null
}

function parseAvisoTipo(raw: unknown): AvisoTipo {
  const t = String(raw ?? '').trim()
  if (t === 'comunicado') return 'comunicado'
  if (t === 'operacao') return 'operacao'
  return 'recado'
}

function parseAvisoPrioridade(raw: unknown): AvisoPrioridade {
  const p = String(raw ?? '').trim()
  if (p === 'urgente') return 'urgente'
  if (p === 'alta') return 'alta'
  return 'normal'
}

function docToAviso(d: { id: string; data: () => Record<string, unknown> }): AvisoRow {
  const x = d.data()
  const ts = x.criadoEm as Timestamp | undefined
  const exp = x.expiraEm
  const expiraEm =
    exp instanceof Timestamp
      ? exp.toDate().toISOString()
      : exp != null && String(exp).trim()
        ? String(exp).trim()
        : null
  return {
    id: d.id,
    tipo: parseAvisoTipo(x.tipo),
    prioridade: parseAvisoPrioridade(x.prioridade),
    titulo: String(x.titulo ?? '').trim(),
    mensagem: String(x.mensagem ?? '').trim(),
    ativo: x.ativo !== false,
    fixo: x.fixo === true,
    expiraEm,
    fotoUrl:
      x.fotoUrl != null && String(x.fotoUrl).trim() !== ''
        ? String(x.fotoUrl).trim()
        : null,
    criadoPorId: String(x.criadoPorId ?? '').trim(),
    criadoPorNome: String(x.criadoPorNome ?? '').trim() || '—',
    criadoEm: ts ? { seconds: ts.seconds } : null
  }
}

function normalizeAvisoPayload(params: {
  tipo: AvisoTipo
  prioridade: AvisoPrioridade
  titulo: string
  mensagem: string
  ativo: boolean
  fixo: boolean
  expiraEm?: string | null
}) {
  const titulo = params.titulo.trim()
  const mensagem = params.mensagem.trim()
  if (!titulo) throw new Error('Informe um título.')
  if (!mensagem) throw new Error('Informe a mensagem.')
  const expRaw = params.expiraEm != null ? String(params.expiraEm).trim() : ''
  let expiraEm: string | null = null
  if (expRaw) {
    const d = new Date(expRaw)
    if (!Number.isFinite(d.getTime())) throw new Error('Data de expiração inválida.')
    expiraEm = d.toISOString()
  }
  return {
    tipo: params.tipo,
    prioridade: params.prioridade,
    titulo,
    mensagem,
    ativo: params.ativo,
    fixo: params.fixo,
    expiraEm
  }
}

export async function listAvisosRecentes(params?: { limitCount?: number; includeInactive?: boolean }): Promise<AvisoRow[]> {
  const limitCount = Math.max(1, Math.min(200, params?.limitCount ?? 80))
  const includeInactive = params?.includeInactive === true
  // Evita exigir índice composto (where + orderBy em campos diferentes).
  // Pegamos os mais recentes e filtramos `ativo` no cliente quando necessário.
  const q = query(collection(db, 'avisos'), orderBy('criadoEm', 'desc'), limit(limitCount))
  const snap = await getDocs(q)
  const rows = snap.docs.map((d) => docToAviso({ id: d.id, data: () => d.data() as Record<string, unknown> }))
  return includeInactive ? rows : rows.filter((r) => r.ativo)
}

export function isAvisoAtivoAgora(row: AvisoRow, now = new Date()): boolean {
  if (!row.ativo) return false
  if (!row.expiraEm) return true
  const t = new Date(row.expiraEm).getTime()
  if (!Number.isFinite(t)) return true
  return t > now.getTime()
}

export async function addAviso(params: {
  tipo: AvisoTipo
  prioridade: AvisoPrioridade
  titulo: string
  mensagem: string
  ativo?: boolean
  fixo?: boolean
  expiraEm?: string | null
  criadoPor: { id: string; nome: string }
}): Promise<string> {
  const payload = normalizeAvisoPayload({
    tipo: params.tipo,
    prioridade: params.prioridade,
    titulo: params.titulo,
    mensagem: params.mensagem,
    ativo: params.ativo !== false,
    fixo: params.fixo === true,
    expiraEm: params.expiraEm ?? null
  })
  const ref = await addDoc(collection(db, 'avisos'), {
    ...payload,
    fotoUrl: null,
    criadoPorId: params.criadoPor.id,
    criadoPorNome: params.criadoPor.nome,
    criadoEm: serverTimestamp()
  })
  return ref.id
}

export async function updateAviso(
  id: string,
  params: {
    tipo: AvisoTipo
    prioridade: AvisoPrioridade
    titulo: string
    mensagem: string
    ativo: boolean
    fixo: boolean
    expiraEm?: string | null
  }
): Promise<void> {
  const payload = normalizeAvisoPayload(params)
  await updateDoc(doc(db, 'avisos', id), {
    ...payload,
    atualizadoEm: serverTimestamp()
  })
}

export async function setAvisoFotoUrl(id: string, fotoUrl: string | null): Promise<void> {
  const normalized = fotoUrl != null && String(fotoUrl).trim() ? String(fotoUrl).trim() : null
  await updateDoc(doc(db, 'avisos', id), {
    fotoUrl: normalized,
    atualizadoEm: serverTimestamp()
  })
}

export async function deleteAviso(id: string): Promise<void> {
  await deleteDoc(doc(db, 'avisos', id))
}

export interface EventoFotoRow {
  id: string
  /** Nome do evento (ex.: LVX Day — Maio 2026) */
  evento: string
  /** Legenda opcional no telão */
  legenda: string
  /** Link colado pelo admin (Google Drive ou URL direta) */
  link: string
  ativo: boolean
  /** Maior = aparece primeiro no telão */
  ordem: number
  criadoPorId: string
  criadoPorNome: string
  criadoEm?: { seconds: number } | null
}

function docToEventoFoto(d: { id: string; data: () => Record<string, unknown> }): EventoFotoRow {
  const x = d.data()
  const ts = x.criadoEm as Timestamp | undefined
  return {
    id: d.id,
    evento: String(x.evento ?? '').trim(),
    legenda: String(x.legenda ?? '').trim(),
    link: String(x.link ?? '').trim(),
    ativo: x.ativo !== false,
    ordem: Number.isFinite(Number(x.ordem)) ? Math.floor(Number(x.ordem)) : 0,
    criadoPorId: String(x.criadoPorId ?? '').trim(),
    criadoPorNome: String(x.criadoPorNome ?? '').trim() || '—',
    criadoEm: ts ? { seconds: ts.seconds } : null
  }
}

function normalizeEventoFotoPayload(params: {
  evento: string
  legenda: string
  link: string
  ativo: boolean
  ordem: number
}) {
  const evento = params.evento.trim()
  const legenda = params.legenda.trim()
  const link = params.link.trim()
  if (!evento) throw new Error('Informe o nome do evento.')
  if (!link) throw new Error('Informe o link da foto (Google Drive).')
  if (!/^https?:\/\//i.test(link)) throw new Error('O link deve começar com http:// ou https://')
  return {
    evento,
    legenda,
    link,
    ativo: params.ativo,
    ordem: Math.max(0, Math.min(999_999, Math.floor(params.ordem)))
  }
}

export async function listEventoFotos(params?: {
  limitCount?: number
  includeInactive?: boolean
}): Promise<EventoFotoRow[]> {
  const limitCount = Math.max(1, Math.min(300, params?.limitCount ?? 120))
  const includeInactive = params?.includeInactive === true
  const q = query(collection(db, 'evento_fotos'), orderBy('criadoEm', 'desc'), limit(limitCount))
  const snap = await getDocs(q)
  const rows = snap.docs.map((d) => docToEventoFoto({ id: d.id, data: () => d.data() as Record<string, unknown> }))
  const filtered = includeInactive ? rows : rows.filter((r) => r.ativo)
  return filtered.sort((a, b) => b.ordem - a.ordem || (b.criadoEm?.seconds ?? 0) - (a.criadoEm?.seconds ?? 0))
}

export async function addEventoFoto(params: {
  evento: string
  legenda?: string
  link: string
  ativo?: boolean
  ordem?: number
  criadoPor: { id: string; nome: string }
}): Promise<string> {
  const payload = normalizeEventoFotoPayload({
    evento: params.evento,
    legenda: params.legenda ?? '',
    link: params.link,
    ativo: params.ativo !== false,
    ordem: params.ordem ?? 0
  })
  const ref = await addDoc(collection(db, 'evento_fotos'), {
    ...payload,
    criadoPorId: params.criadoPor.id,
    criadoPorNome: params.criadoPor.nome,
    criadoEm: serverTimestamp()
  })
  return ref.id
}

export async function addEventoFotosBatch(params: {
  evento: string
  legenda?: string
  links: string[]
  ativo?: boolean
  /** Ordem da primeira foto; as seguintes decrementam (primeira linha = maior prioridade no telão). */
  ordemBase?: number
  criadoPor: { id: string; nome: string }
}): Promise<{ created: number; failed: { link: string; message: string }[] }> {
  const links = params.links.map((l) => l.trim()).filter((l) => l.length > 0)
  if (!links.length) throw new Error('Informe pelo menos um link.')
  const base = Math.max(0, Math.min(999_999, Math.floor(params.ordemBase ?? 0)))
  let created = 0
  const failed: { link: string; message: string }[] = []
  for (let i = 0; i < links.length; i++) {
    try {
      await addEventoFoto({
        evento: params.evento,
        legenda: params.legenda,
        link: links[i],
        ativo: params.ativo,
        ordem: Math.max(0, base - i),
        criadoPor: params.criadoPor
      })
      created++
    } catch (err) {
      const message =
        err instanceof Error ? err.message : typeof err === 'string' ? err : 'Erro ao salvar'
      failed.push({ link: links[i], message })
    }
  }
  if (created === 0 && failed.length) {
    throw new Error(failed[0]?.message || 'Nenhuma foto foi criada.')
  }
  return { created, failed }
}

export async function updateEventoFoto(
  id: string,
  params: {
    evento: string
    legenda: string
    link: string
    ativo: boolean
    ordem: number
  }
): Promise<void> {
  const payload = normalizeEventoFotoPayload(params)
  await updateDoc(doc(db, 'evento_fotos', id), {
    ...payload,
    atualizadoEm: serverTimestamp()
  })
}

export async function deleteEventoFoto(id: string): Promise<void> {
  await deleteDoc(doc(db, 'evento_fotos', id))
}

export interface TvTimersConfig {
  /** Intervalo de troca de ranking no modo TV, em milissegundos */
  rankingsRotateMs: number
  /** Intervalo de troca de aviso no slide "Avisos", em milissegundos */
  avisosRotateMs: number
  /** Intervalo de troca de foto no slide "Eventos LVX", em milissegundos */
  eventosFotosRotateMs: number
}

const tvTimersConfigRef = doc(db, 'config', 'tv_timers')

function clampMs(raw: unknown, fallback: number, minMs: number, maxMs: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.max(minMs, Math.min(maxMs, Math.floor(n)))
}

export async function getTvTimersConfig(): Promise<TvTimersConfig> {
  const snap = await getDoc(tvTimersConfigRef)
  const raw = snap.exists() ? (snap.data() as Record<string, unknown>) : {}
  return {
    rankingsRotateMs: clampMs(raw.rankingsRotateMs, 30_000, 5_000, 300_000),
    avisosRotateMs: clampMs(raw.avisosRotateMs, 10_000, 3_000, 120_000),
    eventosFotosRotateMs: clampMs(raw.eventosFotosRotateMs, 8_000, 3_000, 60_000)
  }
}

export async function setTvTimersConfig(params: Partial<TvTimersConfig>): Promise<void> {
  const body: Record<string, number> = {}
  if (params.rankingsRotateMs != null) body.rankingsRotateMs = clampMs(params.rankingsRotateMs, 30_000, 5_000, 300_000)
  if (params.avisosRotateMs != null) body.avisosRotateMs = clampMs(params.avisosRotateMs, 10_000, 3_000, 120_000)
  if (params.eventosFotosRotateMs != null) {
    body.eventosFotosRotateMs = clampMs(params.eventosFotosRotateMs, 8_000, 3_000, 60_000)
  }
  await setDoc(tvTimersConfigRef, body, { merge: true })
}
