import * as logger from 'firebase-functions/logger'
import type { Request, Response } from 'express'
import * as admin from 'firebase-admin'

const db = admin.firestore()

export type CrmWebhookStepKind = 'agendada' | 'realizada' | 'venda'

export type CrmWebhookConfig = {
  enabled: boolean
  secret: string
  stepMappings: Record<CrmWebhookStepKind, string[]>
}

const CONFIG_DOC = 'config/crm_webhook'
const ORDER_COLLECTION = 'crm_webhook_orders'
const PROCESSED_COLLECTION = 'crm_webhook_processed'
const LOG_COLLECTION = 'crm_webhook_logs'

const DEFAULT_MAPPINGS: Record<CrmWebhookStepKind, string[]> = {
  agendada: [
    'reuniao agendada',
    'reunião agendada',
    'reuniao marcada',
    'reunião marcada',
    'agendada',
    'agendado',
    'meeting scheduled',
    'scheduled'
  ],
  realizada: [
    'reuniao realizada',
    'reunião realizada',
    'realizada',
    'realizado',
    'reuniao feita',
    'reunião feita',
    'meeting held',
    'meeting done',
    'conducted'
  ],
  venda: ['venda', 'vendas', 'vendido', 'fechado', 'ganho', 'won', 'closed won', 'closed-won', 'deal won']
}

export function normalizeStepLabel(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function parseAmount(raw: unknown): number {
  if (raw == null) return 0
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, raw)
  let s = String(raw).trim()
  if (!s) return 0
  s = s.replace(/[^\d,.-]/g, '')
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (s.includes(',')) {
    s = s.replace(',', '.')
  }
  const n = parseFloat(s)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

function isoToDateYmd(iso: string | undefined): string {
  if (!iso) return new Date().toISOString().slice(0, 10)
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10)
  return d.toISOString().slice(0, 10)
}

export async function loadCrmWebhookConfig(): Promise<CrmWebhookConfig> {
  const snap = await db.doc(CONFIG_DOC).get()
  const data = snap.data() ?? {}
  const envSecret = String(process.env.CRM_WEBHOOK_SECRET ?? '').trim()
  const mappings = (data.stepMappings ?? {}) as Partial<Record<CrmWebhookStepKind, string[]>>
  return {
    enabled: data.enabled !== false,
    secret: String(data.secret ?? '').trim() || envSecret,
    stepMappings: {
      agendada: Array.isArray(mappings.agendada) && mappings.agendada.length > 0 ? mappings.agendada : DEFAULT_MAPPINGS.agendada,
      realizada:
        Array.isArray(mappings.realizada) && mappings.realizada.length > 0 ? mappings.realizada : DEFAULT_MAPPINGS.realizada,
      venda: Array.isArray(mappings.venda) && mappings.venda.length > 0 ? mappings.venda : DEFAULT_MAPPINGS.venda
    }
  }
}

export function matchStepKind(stepLabel: string, cfg: CrmWebhookConfig): CrmWebhookStepKind | null {
  const norm = normalizeStepLabel(stepLabel)
  if (!norm) return null
  const kinds: CrmWebhookStepKind[] = ['venda', 'realizada', 'agendada']
  for (const kind of kinds) {
    const list = cfg.stepMappings[kind] ?? []
    for (const pattern of list) {
      const p = normalizeStepLabel(pattern)
      if (!p) continue
      if (norm === p || norm.includes(p) || p.includes(norm)) return kind
    }
  }
  return null
}

type ParsedWebhook = {
  event: string
  commercialOrderId: string
  stepLabel: string
  responsibleEmail: string
  transferAt?: string
  pipeline?: string
  amount: number
  contactName: string
  contactEmail: string
  contactPhone: string
  raw: Record<string, unknown>
}

export function parseWebhookBody(body: unknown): ParsedWebhook | null {
  if (!body || typeof body !== 'object') return null
  const root = body as Record<string, unknown>
  const event = String(root.event ?? root.type ?? '').trim()
  const data = (root.data ?? root.payload ?? root) as Record<string, unknown>

  const commercialOrderId = String(
    data.commercialOrderId ?? data.commercial_order_id ?? data.orderId ?? ''
  ).trim()
  if (!commercialOrderId) return null

  const stepLabel = String(
    data.toStep ?? data.to_step ?? data.step ?? data.newStep ?? data.column ?? ''
  ).trim()

  const responsibleEmail = String(data.responsible ?? data.responsibleEmail ?? data.owner ?? '').trim()

  const contact = (data.contact ?? {}) as Record<string, unknown>
  const contactName = String(contact.name ?? contact.nome ?? data.contactName ?? '').trim()
  const contactEmail = String(contact.email ?? '').trim()
  const contactPhone = String(contact.number ?? contact.phone ?? contact.telefone ?? '').trim()

  return {
    event,
    commercialOrderId,
    stepLabel,
    responsibleEmail,
    transferAt: String(data.transferAt ?? data.transfer_at ?? data.createdAt ?? data.created_at ?? '').trim() || undefined,
    pipeline: String(data.pipeline ?? '').trim() || undefined,
    amount: parseAmount(data.amount ?? data.value ?? data.valor),
    contactName,
    contactEmail,
    contactPhone,
    raw: root
  }
}

type CrmUserRow = { id: string; nome: string; email: string; cargo: string }

async function findUserByEmail(email: string): Promise<CrmUserRow | null> {
  const normalized = email.toLowerCase().trim()
  if (!normalized || !normalized.includes('@')) return null
  const snap = await db.collection('usuarios').where('email', '==', normalized).limit(1).get()
  if (snap.empty) return null
  const d = snap.docs[0]
  const x = d.data()
  return {
    id: d.id,
    nome: String(x.nome ?? '—'),
    email: normalized,
    cargo: String(x.cargo ?? '').trim().toLowerCase()
  }
}

function isSdrCargo(cargo: string): boolean {
  return cargo === 'sdr' || cargo === 'admin'
}

function isCloserCargo(cargo: string): boolean {
  return cargo === 'closer' || cargo === 'admin'
}

async function wasProcessed(dedupKey: string): Promise<boolean> {
  const snap = await db.collection(PROCESSED_COLLECTION).doc(dedupKey).get()
  return snap.exists
}

async function markProcessed(dedupKey: string, meta: Record<string, unknown>): Promise<void> {
  await db.collection(PROCESSED_COLLECTION).doc(dedupKey).set({
    ...meta,
    processedAt: admin.firestore.FieldValue.serverTimestamp()
  })
}

async function appendLog(entry: Record<string, unknown>): Promise<void> {
  await db.collection(LOG_COLLECTION).add({
    ...entry,
    ts: admin.firestore.FieldValue.serverTimestamp()
  })
}

type OrderLink = {
  commercialOrderId: string
  sdrUserId?: string | null
  sdrUserName?: string | null
  sdrUserCargo?: string | null
  grupoWpp?: string | null
  origemLead?: string | null
  pipeline?: string | null
  updatedAt?: admin.firestore.FieldValue
}

async function getOrderLink(orderId: string): Promise<OrderLink | null> {
  const snap = await db.collection(ORDER_COLLECTION).doc(orderId).get()
  if (!snap.exists) return null
  return snap.data() as OrderLink
}

async function saveOrderLink(orderId: string, patch: Partial<OrderLink>): Promise<void> {
  await db.collection(ORDER_COLLECTION).doc(orderId).set(
    {
      commercialOrderId: orderId,
      ...patch,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  )
}

async function createRegistroFromWebhook(params: {
  data: string
  tipo: string
  user: CrmUserRow
  anuncio: string | null
  grupoWpp: string | null
  valor?: number
  cashCollected?: number
  nomeCliente?: string | null
  obs: string | null
  qualificacaoSdr?: string | null
  vendaSdrUserId?: string | null
  vendaSdrUserName?: string | null
  externalOrderId: string
  externalStep: string
  externalEvent: string
}): Promise<string> {
  const ref = await db.collection('registros').add({
    data: params.data,
    tipo: params.tipo,
    userId: params.user.id,
    userName: params.user.nome,
    userCargo: params.user.cargo,
    anuncio: params.anuncio,
    grupoWpp: params.grupoWpp,
    valor: params.valor ?? 0,
    cashCollected: params.cashCollected ?? 0,
    obs: params.obs,
    formaPagamento: params.tipo === 'venda' ? null : null,
    nomeCliente: params.tipo === 'venda' && params.nomeCliente ? params.nomeCliente : null,
    produtosIds: [],
    produtosDetalhes: [],
    valorReferenciaVenda: params.tipo === 'venda' ? params.valor ?? 0 : null,
    descontoCloser: params.tipo === 'venda' ? 0 : null,
    invalidoComissao: false,
    leadBudget: null,
    callRecordingUrl: null,
    qualificacaoSdr: params.tipo === 'reuniao_realizada' ? params.qualificacaoSdr ?? 'pendente' : null,
    vendaSdrUserId: params.tipo === 'venda' && params.vendaSdrUserId ? params.vendaSdrUserId : null,
    vendaSdrUserName: params.tipo === 'venda' && params.vendaSdrUserName ? params.vendaSdrUserName : null,
    externalSource: 'crm_native',
    externalOrderId: params.externalOrderId,
    externalStep: params.externalStep,
    externalEvent: params.externalEvent,
    criadoEm: admin.firestore.FieldValue.serverTimestamp()
  })
  return ref.id
}

function buildLeadLabel(parsed: ParsedWebhook): string {
  if (parsed.contactName) return parsed.contactName
  if (parsed.contactPhone) return parsed.contactPhone
  if (parsed.contactEmail) return parsed.contactEmail
  return `Negócio #${parsed.commercialOrderId}`
}

function buildOrigem(parsed: ParsedWebhook): string {
  if (parsed.pipeline?.trim()) return `CRM · ${parsed.pipeline.trim()}`
  return 'CRM nativo'
}

export type ProcessResult = {
  ok: boolean
  skipped?: boolean
  reason?: string
  registrosCriados?: string[]
}

export async function processCrmNativeWebhook(parsed: ParsedWebhook, cfg: CrmWebhookConfig): Promise<ProcessResult> {
  const eventUpper = parsed.event.toUpperCase()
  if (eventUpper && !eventUpper.includes('COMMERCIAL_ORDER')) {
    return { ok: true, skipped: true, reason: `evento_ignorado:${parsed.event}` }
  }

  const stepKind = matchStepKind(parsed.stepLabel, cfg)
  if (!stepKind) {
    await appendLog({
      level: 'info',
      commercialOrderId: parsed.commercialOrderId,
      step: parsed.stepLabel,
      message: 'Coluna não mapeada — nenhum registro criado'
    })
    return { ok: true, skipped: true, reason: `coluna_nao_mapeada:${parsed.stepLabel}` }
  }

  const responsible = await findUserByEmail(parsed.responsibleEmail)
  if (!responsible) {
    await appendLog({
      level: 'error',
      commercialOrderId: parsed.commercialOrderId,
      step: parsed.stepLabel,
      responsible: parsed.responsibleEmail,
      message: 'E-mail do responsável não encontrado em Usuários'
    })
    return { ok: false, reason: 'responsavel_nao_encontrado' }
  }

  const data = isoToDateYmd(parsed.transferAt)
  const grupoWpp = buildLeadLabel(parsed)
  const origem = buildOrigem(parsed)
  const obsBase = `CRM nativo · negócio #${parsed.commercialOrderId} · coluna «${parsed.stepLabel}»`
  const registrosCriados: string[] = []
  const orderId = parsed.commercialOrderId
  const orderLink = await getOrderLink(orderId)

  if (stepKind === 'agendada') {
    const dedupKey = `${orderId}_reuniao_agendada`
    if (await wasProcessed(dedupKey)) {
      return { ok: true, skipped: true, reason: 'duplicado_agendada' }
    }
    const regId = await createRegistroFromWebhook({
      data,
      tipo: 'reuniao_agendada',
      user: responsible,
      anuncio: origem,
      grupoWpp,
      obs: obsBase,
      externalOrderId: orderId,
      externalStep: parsed.stepLabel,
      externalEvent: parsed.event
    })
    registrosCriados.push(regId)
    await markProcessed(dedupKey, { registroId: regId, tipo: 'reuniao_agendada' })

    const sdrPatch: Partial<OrderLink> = { grupoWpp, origemLead: origem, pipeline: parsed.pipeline ?? null }
    if (isSdrCargo(responsible.cargo)) {
      sdrPatch.sdrUserId = responsible.id
      sdrPatch.sdrUserName = responsible.nome
      sdrPatch.sdrUserCargo = responsible.cargo
    }
    await saveOrderLink(orderId, sdrPatch)
    return { ok: true, registrosCriados }
  }

  if (stepKind === 'realizada') {
    const created: string[] = []

    if (orderLink?.sdrUserId) {
      const dedupSdr = `${orderId}_reuniao_realizada`
      if (!(await wasProcessed(dedupSdr))) {
        const sdrUser = await db.collection('usuarios').doc(orderLink.sdrUserId).get()
        const sdrData = sdrUser.data()
        if (sdrUser.exists && sdrData) {
          const sdr: CrmUserRow = {
            id: sdrUser.id,
            nome: String(sdrData.nome ?? orderLink.sdrUserName ?? '—'),
            email: String(sdrData.email ?? ''),
            cargo: String(sdrData.cargo ?? 'sdr').toLowerCase()
          }
          const regId = await createRegistroFromWebhook({
            data,
            tipo: 'reuniao_realizada',
            user: sdr,
            anuncio: orderLink.origemLead ?? origem,
            grupoWpp: orderLink.grupoWpp ?? grupoWpp,
            obs: `${obsBase} · SDR (negócio agendado por ${orderLink.sdrUserName ?? sdr.nome})`,
            qualificacaoSdr: 'pendente',
            externalOrderId: orderId,
            externalStep: parsed.stepLabel,
            externalEvent: parsed.event
          })
          created.push(regId)
          await markProcessed(dedupSdr, { registroId: regId, tipo: 'reuniao_realizada' })
        }
      }
    } else if (isSdrCargo(responsible.cargo)) {
      const dedupSdr = `${orderId}_reuniao_realizada`
      if (!(await wasProcessed(dedupSdr))) {
        const regId = await createRegistroFromWebhook({
          data,
          tipo: 'reuniao_realizada',
          user: responsible,
          anuncio: origem,
          grupoWpp,
          obs: obsBase,
          qualificacaoSdr: 'pendente',
          externalOrderId: orderId,
          externalStep: parsed.stepLabel,
          externalEvent: parsed.event
        })
        created.push(regId)
        await markProcessed(dedupSdr, { registroId: regId, tipo: 'reuniao_realizada' })
        await saveOrderLink(orderId, {
          sdrUserId: responsible.id,
          sdrUserName: responsible.nome,
          sdrUserCargo: responsible.cargo,
          grupoWpp,
          origemLead: origem
        })
      }
    }

    if (isCloserCargo(responsible.cargo)) {
      const dedupCloser = `${orderId}_reuniao_closer_${responsible.id}`
      if (!(await wasProcessed(dedupCloser))) {
        const regId = await createRegistroFromWebhook({
          data,
          tipo: 'reuniao_closer',
          user: responsible,
          anuncio: orderLink?.origemLead ?? origem,
          grupoWpp: orderLink?.grupoWpp ?? grupoWpp,
          obs: `${obsBase} · closer`,
          externalOrderId: orderId,
          externalStep: parsed.stepLabel,
          externalEvent: parsed.event
        })
        created.push(regId)
        await markProcessed(dedupCloser, { registroId: regId, tipo: 'reuniao_closer' })
      }
    }

    if (created.length === 0) {
      return { ok: true, skipped: true, reason: 'realizada_duplicada_ou_sem_tipo' }
    }
    return { ok: true, registrosCriados: created }
  }

  if (stepKind === 'venda') {
    const dedupKey = `${orderId}_venda_${responsible.id}`
    if (await wasProcessed(dedupKey)) {
      return { ok: true, skipped: true, reason: 'duplicado_venda' }
    }
    const valor = parsed.amount
    const regId = await createRegistroFromWebhook({
      data,
      tipo: 'venda',
      user: responsible,
      anuncio: orderLink?.origemLead ?? origem,
      grupoWpp: orderLink?.grupoWpp ?? grupoWpp,
      valor,
      cashCollected: valor,
      nomeCliente: parsed.contactName || grupoWpp,
      obs: obsBase,
      vendaSdrUserId: orderLink?.sdrUserId ?? null,
      vendaSdrUserName: orderLink?.sdrUserName ?? null,
      externalOrderId: orderId,
      externalStep: parsed.stepLabel,
      externalEvent: parsed.event
    })
    await markProcessed(dedupKey, { registroId: regId, tipo: 'venda' })
    return { ok: true, registrosCriados: [regId] }
  }

  return { ok: true, skipped: true, reason: 'sem_acao' }
}

function extractSecret(req: Request): string {
  const h = req.headers['x-crm-webhook-secret'] ?? req.headers['x-webhook-secret']
  if (typeof h === 'string' && h.trim()) return h.trim()
  if (Array.isArray(h) && h[0]) return String(h[0]).trim()
  const q = req.query.secret
  if (typeof q === 'string') return q.trim()
  return ''
}

export async function handleCrmNativeWebhookRequest(req: Request, res: Response): Promise<void> {
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, service: 'crm-native-webhook' })
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }

  try {
    const cfg = await loadCrmWebhookConfig()
    if (!cfg.enabled) {
      res.status(503).json({ ok: false, error: 'webhook_desativado' })
      return
    }
    if (!cfg.secret) {
      logger.error('CRM webhook: secret não configurado')
      res.status(503).json({ ok: false, error: 'secret_nao_configurado' })
      return
    }
    const provided = extractSecret(req)
    if (!provided || provided !== cfg.secret) {
      res.status(401).json({ ok: false, error: 'nao_autorizado' })
      return
    }

    const parsed = parseWebhookBody(req.body)
    if (!parsed) {
      res.status(400).json({ ok: false, error: 'payload_invalido' })
      return
    }

    const result = await processCrmNativeWebhook(parsed, cfg)
    await appendLog({
      level: result.ok ? 'ok' : 'warn',
      commercialOrderId: parsed.commercialOrderId,
      event: parsed.event,
      step: parsed.stepLabel,
      responsible: parsed.responsibleEmail,
      result
    })

    res.status(200).json({ ...result, ok: result.ok })
  } catch (e) {
    logger.error('crmNativeWebhook', e)
    await appendLog({
      level: 'error',
      message: e instanceof Error ? e.message : String(e)
    }).catch(() => {})
    res.status(500).json({ ok: false, error: 'erro_interno' })
  }
}
