const META_KEYS_LEAD = [
  'lead',
  'onsite_conversion.lead',
  'onsite_conversion.lead_grouped',
  'offsite_conversion.fb_pixel_lead',
  'leadgen_grouped'
]
const META_KEYS_MSG = ['onsite_conversion.messaging_conversation_started_7d', 'omni_messaging_conversation_started', 'messaging_first_reply']
const META_KEYS_VISITA = ['link_click', 'outbound_click.outbound', 'outbound_click']

/** v19 gerava aviso de Ads API desatualizada no servidor Meta. Sobrescrever em `.env`: `VITE_META_GRAPH_API_VERSION=v23.0` */
const GRAPH_VERSION =
  (import.meta.env.VITE_META_GRAPH_API_VERSION as string | undefined)?.trim() || 'v22.0'
const META_GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

/** Versão da Graph API em uso (útil para depuração na UI). */
export function getMetaGraphApiVersion(): string {
  return GRAPH_VERSION
}

/** Acima disto usamos POST (limite prático de URL em browsers). */
const META_GRAPH_GET_MAX_QUERY = 1800

const ENV_TOKEN = (import.meta.env.VITE_META_ADS_ACCESS_TOKEN as string | undefined)?.trim() || ''

export type MetaConvMode = 'lead' | 'mensagem' | 'visita'

export function getConversionKeys(mode: MetaConvMode): string[] {
  return mode === 'lead' ? META_KEYS_LEAD : mode === 'mensagem' ? META_KEYS_MSG : META_KEYS_VISITA
}

export function extractActionFromInsights(actions: Array<{ action_type: string; value: string }> | undefined, keys: string[]): number | null {
  if (!actions) return null
  for (const k of keys) {
    const a = actions.find((x) => x.action_type === k)
    if (a) return parseFloat(a.value) || 0
  }
  return null
}

export const META_STORAGE_KEYS = {
  mode: 'crm_meta_mode',
  accId: 'crm_meta_accid',
  fav: 'crm_meta_fav',
  token: 'crm_meta_token',
  /** Página Facebook escolhida para listar Lead Ads (Leads retrieval). */
  leadsPageId: 'crm_meta_leads_pageid',
  /** Página favorita na lista Leads Meta (prioridade ao carregar). */
  leadsPageFav: 'crm_meta_leads_page_fav'
} as const

/** Mapa lead id → coluna do Kanban (localStorage). */
export const META_LEADS_KANBAN_STORAGE_KEY = 'crm_meta_leads_kanban_v1'

/** Token efetivo: sessão → armazenamento local → variável de ambiente (só dev). */
export function metaGetEffectiveToken(): string {
  if (typeof window === 'undefined') return ENV_TOKEN
  try {
    const s = sessionStorage.getItem(META_STORAGE_KEYS.token)?.trim()
    if (s) return s
    const l = localStorage.getItem(META_STORAGE_KEYS.token)?.trim()
    if (l) return l
  } catch {
    /* ignore */
  }
  return ENV_TOKEN
}

export function metaHasSessionToken(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return Boolean(sessionStorage.getItem(META_STORAGE_KEYS.token)?.trim())
  } catch {
    return false
  }
}

/** Token guardado no browser (sessão ou local), não só variável de ambiente. */
export function metaHasBrowserStoredToken(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return Boolean(
      sessionStorage.getItem(META_STORAGE_KEYS.token)?.trim() || localStorage.getItem(META_STORAGE_KEYS.token)?.trim()
    )
  } catch {
    return false
  }
}

export function metaIsEnvTokenActive(): boolean {
  return Boolean(ENV_TOKEN)
}

/** Grava o token no browser; devolve false se storage estiver indisponível (ex.: modo privado). */
export function metaSaveToken(accessToken: string): boolean {
  const t = accessToken.trim()
  if (typeof window === 'undefined' || !t) return false
  try {
    sessionStorage.setItem(META_STORAGE_KEYS.token, t)
    localStorage.setItem(META_STORAGE_KEYS.token, t)
    return true
  } catch {
    return false
  }
}

export function metaClearSessionToken(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(META_STORAGE_KEYS.token)
    localStorage.removeItem(META_STORAGE_KEYS.token)
  } catch {
    /* ignore */
  }
}

async function parseGraphResponse(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text.trim()) {
    if (!res.ok) throw new Error(`Erro HTTP ${res.status} na API Graph (resposta vazia)`)
    return {}
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error(`Resposta inválida da Meta (HTTP ${res.status})`)
  }
}

/**
 * Chama a Graph API (GET com query quando o URL é curto; POST com form para pedidos longos).
 * Trata erros OAuth (`error` no JSON) e HTTP não OK.
 */
export async function metaFetch<T = unknown>(path: string, params: Record<string, string>): Promise<T> {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v != null && String(v) !== '') search.set(k, String(v))
  }
  const p = path.startsWith('/') ? path : `/${path}`
  const query = search.toString()
  const usePost = query.length > META_GRAPH_GET_MAX_QUERY

  const res = usePost
    ? await fetch(`${META_GRAPH_BASE}${p}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: query
      })
    : await fetch(`${META_GRAPH_BASE}${p}?${query}`)

  const json = (await parseGraphResponse(res)) as T & { error?: { message?: string; code?: number } }

  if (json && typeof json === 'object' && 'error' in json && json.error) {
    const code = json.error.code != null ? ` (código ${json.error.code})` : ''
    throw new Error((json.error.message || 'Erro na API Graph') + code)
  }

  if (!res.ok) {
    throw new Error(`Erro HTTP ${res.status} na API Graph`)
  }

  return json as T
}

export function metaLoadSaved(): { mode: MetaConvMode; accId: string; favAccId: string; token: string } {
  const mode = (typeof window !== 'undefined' ? localStorage.getItem(META_STORAGE_KEYS.mode) : null) || 'lead'
  const accId = typeof window !== 'undefined' ? localStorage.getItem(META_STORAGE_KEYS.accId) || '' : ''
  const favAccId = typeof window !== 'undefined' ? localStorage.getItem(META_STORAGE_KEYS.fav) || '' : ''
  return { mode: mode as MetaConvMode, accId, favAccId, token: metaGetEffectiveToken() }
}

export function metaSaveMode(mode: MetaConvMode): void {
  if (typeof window !== 'undefined') localStorage.setItem(META_STORAGE_KEYS.mode, mode)
}

export function metaSaveAccId(accId: string): void {
  if (typeof window !== 'undefined') localStorage.setItem(META_STORAGE_KEYS.accId, accId)
}

export function metaSaveFav(accId: string): void {
  if (typeof window !== 'undefined') localStorage.setItem(META_STORAGE_KEYS.fav, accId)
}

export function metaClearFav(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(META_STORAGE_KEYS.fav)
}

export function metaSaveLeadsPageId(pageId: string): void {
  if (typeof window === 'undefined') return
  try {
    const id = pageId.trim()
    if (id) localStorage.setItem(META_STORAGE_KEYS.leadsPageId, id)
    else localStorage.removeItem(META_STORAGE_KEYS.leadsPageId)
  } catch {
    /* ignore */
  }
}

export function metaLoadLeadsPageId(): string {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(META_STORAGE_KEYS.leadsPageId)?.trim() || ''
  } catch {
    return ''
  }
}

export function metaSaveLeadsPageFav(pageId: string): void {
  if (typeof window === 'undefined') return
  try {
    const id = pageId.trim()
    if (id) localStorage.setItem(META_STORAGE_KEYS.leadsPageFav, id)
    else localStorage.removeItem(META_STORAGE_KEYS.leadsPageFav)
  } catch {
    /* ignore */
  }
}

export function metaLoadLeadsPageFav(): string {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(META_STORAGE_KEYS.leadsPageFav)?.trim() || ''
  } catch {
    return ''
  }
}

export function metaClearLeadsPageFav(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(META_STORAGE_KEYS.leadsPageFav)
  } catch {
    /* ignore */
  }
}

export interface MetaAccount {
  id: string
  name: string
  currency?: string
}

export interface MetaInsightRow {
  spend?: string
  impressions?: string
  actions?: Array<{ action_type: string; value: string }>
  cost_per_action_type?: Array<{ action_type: string; value: string }>
  date_start?: string
}

export interface MetaCampaign {
  id: string
  name: string
  insights?: { data?: MetaInsightRow[] }
}

/** IDs de conta às vezes vêm só numéricos; a Graph exige `act_`. */
export function normalizeMetaAdAccountId(raw: string): string {
  const id = raw.trim()
  if (!id) return ''
  if (id.startsWith('act_')) return id
  if (/^\d+$/.test(id)) return `act_${id}`
  return id
}

function insightsPathFromPagingNext(nextUrl: string): { path: string; params: Record<string, string> } {
  const u = new URL(nextUrl)
  const stripped = u.pathname.replace(new RegExp(`^/${GRAPH_VERSION}/`), '/')
  const path = stripped.startsWith('/') ? stripped : `/${stripped}`
  const params: Record<string, string> = {}
  u.searchParams.forEach((v, k) => {
    params[k] = v
  })
  return { path, params }
}

/**
 * A Meta devolve `paging.next` dos leads como `/{formId}/leads?…`, mas esse caminho pode
 * devolver 2500; o equivalente suportado é `/{pageId}/leadgen_forms/{formId}/leads?…`.
 */
function leadgenLeadsPagingSpecFromNext(
  nextUrl: string,
  pageId: string,
  formId: string
): { path: string; params: Record<string, string> } {
  const spec = insightsPathFromPagingNext(nextUrl)
  const norm = spec.path.replace(/\/$/, '')
  if (norm === `/${formId}/leads`) {
    return {
      path: `/${pageId}/leadgen_forms/${formId}/leads`,
      params: spec.params
    }
  }
  return spec
}

/**
 * Total de leads (ações de conversão do modo guardado em Meta Ads) na conta entre `since` e `until` (YYYY-MM-DD).
 * Agrega todas as linhas devolvidas (e páginas seguintes) e trata ausência da ação como 0, alinhado à página Meta Ads.
 * `null` se não houver token/conta ou se a API falhar.
 */
export async function fetchMetaLeadsCountForRange(since: string, until: string): Promise<number | null> {
  const token = metaGetEffectiveToken()
  if (!token || !since || !until) return null
  const { mode, accId, favAccId } = metaLoadSaved()
  const accountId = normalizeMetaAdAccountId(favAccId || accId)
  if (!accountId) return null
  const convKeys = getConversionKeys((mode as MetaConvMode) || 'lead')
  const timeRange = JSON.stringify({ since, until })
  try {
    type InsRes = { data?: MetaInsightRow[]; paging?: { next?: string } }
    type PageSpec = { path: string; params: Record<string, string> }
    let sum = 0
    let nextUrl: string | null = null
    for (;;) {
      const spec: PageSpec = nextUrl
        ? insightsPathFromPagingNext(nextUrl)
        : {
            path: `/${accountId}/insights`,
            params: {
              access_token: token,
              fields: 'actions',
              time_range: timeRange,
              limit: '500'
            }
          }
      const insData: InsRes = await metaFetch<InsRes>(spec.path, spec.params)
      const rows = insData.data || []
      for (const row of rows) {
        sum += extractActionFromInsights(row.actions, convKeys) ?? 0
      }
      nextUrl = insData.paging?.next ?? null
      if (!nextUrl) break
    }
    return Math.round(sum)
  } catch {
    return null
  }
}

/** Página com token próprio (necessário para `leadgen_forms` / `leads`). */
export interface MetaPageWithToken {
  id: string
  name: string
  access_token: string
}

export interface MetaLeadgenFormRow {
  id: string
  name?: string
  status?: string
}

export interface MetaLeadgenFieldDatum {
  name: string
  values: string[]
}

export interface MetaLeadgenLeadRow {
  id: string
  created_time: string
  field_data?: MetaLeadgenFieldDatum[]
}

/** Listagem de páginas que o utilizador gere (token de utilizador). */
export async function fetchMetaPagesForUser(userToken: string): Promise<MetaPageWithToken[]> {
  type R = { data?: MetaPageWithToken[] }
  const j = await metaFetch<R>('/me/accounts', {
    access_token: userToken,
    fields: 'id,name,access_token',
    limit: '100'
  })
  return (j.data || []).filter((p) => p.id && p.access_token)
}

/** Formulários Lead Gen da página (token da página). */
export async function fetchLeadgenForms(pageAccessToken: string, pageId: string): Promise<MetaLeadgenFormRow[]> {
  type R = { data?: MetaLeadgenFormRow[] }
  const j = await metaFetch<R>(`/${pageId}/leadgen_forms`, {
    access_token: pageAccessToken,
    fields: 'id,name,status',
    limit: '100'
  })
  return j.data || []
}

function errorText(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}

/** Texto fixo quando a Graph devolve 2500 em `/{formId}/leads` para um ID listado em `leadgen_forms`. */
const LEADS_GRAPH_2500_HINT_PT = `
Possíveis causas (Meta):
· Depois de mudar a app para Live: gera um User Access Token novo (Explorador da API) com leads_retrieval, remove o token antigo na configuração Meta deste CRM e cola o novo — tokens emitidos em Dev não «herdam» sozinhos o modo Live.
· Em app Live, a permissão leads_retrieval pode exigir Advanced Access / App Review para dados de utilizadores reais; sem isso, a lista de formulários pode aparecer mas a leitura de leads falha de forma estranha.
· App em modo Desenvolvimento: só consegues ver leads de testadores da app (ferramenta «Lead Ads Testing»).
· Nas definições avançadas da app: «Require App Secret» para chamadas API — um CRM só no browser não pode enviar appsecret_proof com segurança; é preciso um backend ou desativar essa exigência para testes.
· Centro de Leads / Leads Access Manager: restrições na página podem bloquear a API mesmo com admin.
· Alguns tipos de formulário não expõem leitura em massa por este endpoint — usa exportação no Centro de Leads / Gestor de Negócios.`

/** Resultado da verificação `GET /me/permissions` para o scope leads_retrieval (só faz sentido com token de utilizador). */
export type MetaLeadsRetrievalScopeStatus = 'granted' | 'missing' | 'declined' | 'unknown'

export async function metaCheckLeadsRetrievalPermission(accessToken: string): Promise<MetaLeadsRetrievalScopeStatus> {
  try {
    type Row = { permission?: string; status?: string }
    type R = { data?: Row[] }
    const j = await metaFetch<R>('/me/permissions', {
      access_token: accessToken
    })
    const row = (j.data || []).find((x) => x.permission === 'leads_retrieval')
    if (!row) return 'missing'
    if (row.status === 'granted') return 'granted'
    if (row.status === 'declined') return 'declined'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

/** Lê o nó do formulário sem usar a aresta `/leads` (útil para diagnóstico quando só o 2500 aparece). */
async function probeLeadgenFormScalars(formId: string, accessToken: string): Promise<string> {
  try {
    type R = { id?: string; name?: string; status?: string; leads_count?: number; organic_leads_count?: number }
    const j = await metaFetch<R>(`/${formId}`, {
      access_token: accessToken,
      fields: 'id,name,status,leads_count,organic_leads_count'
    })
    const lc = j.leads_count != null ? String(j.leads_count) : '—'
    const oc = j.organic_leads_count != null ? String(j.organic_leads_count) : '—'
    return `\nDiagnóstico (sem aresta /leads): o nó responde — nome=${JSON.stringify(j.name ?? '')}, status=${j.status ?? '?'}, leads_count=${lc}, organic_leads_count=${oc}. Se leads_count > 0 mas /leads falha, é limitação ou política da Meta neste tipo de formulário/token.`
  } catch (e) {
    return `\nDiagnóstico (sem aresta /leads): nem campos básicos no ID ${formId} — ${errorText(e)}`
  }
}

async function fetchLeadgenFormMetadataType(formId: string, accessToken: string): Promise<string | undefined> {
  try {
    type M = { metadata?: { type?: string }; id?: string }
    const m = await metaFetch<M>(`/${formId}`, {
      access_token: accessToken,
      metadata: '1',
      fields: 'id'
    })
    return m.metadata?.type
  } catch {
    return undefined
  }
}

type LeadgenLeadsPage = { data?: MetaLeadgenLeadRow[]; paging?: { next?: string } }

async function fetchLeadgenLeadsPaged(
  path: string,
  pageAccessToken: string,
  pagingRewrite?: { pageId: string; formId: string }
): Promise<MetaLeadgenLeadRow[]> {
  type PageSpec = { path: string; params: Record<string, string> }
  const out: MetaLeadgenLeadRow[] = []
  let nextUrl: string | null = null
  for (;;) {
    const spec: PageSpec = nextUrl
      ? pagingRewrite
        ? leadgenLeadsPagingSpecFromNext(nextUrl, pagingRewrite.pageId, pagingRewrite.formId)
        : insightsPathFromPagingNext(nextUrl)
      : {
          path,
          params: {
            access_token: pageAccessToken,
            fields: 'id,created_time,field_data',
            limit: '100'
          }
        }
    const j: LeadgenLeadsPage = await metaFetch<LeadgenLeadsPage>(spec.path, spec.params)
    out.push(...(j.data || []))
    nextUrl = j.paging?.next ?? null
    if (!nextUrl) break
  }
  return out
}

async function collectLeadsFromLeadPage(
  first: LeadgenLeadsPage | undefined,
  pagingRewrite?: { pageId: string; formId: string }
): Promise<MetaLeadgenLeadRow[]> {
  const out: MetaLeadgenLeadRow[] = [...(first?.data || [])]
  let nextUrl = first?.paging?.next ?? null
  while (nextUrl) {
    const spec = pagingRewrite
      ? leadgenLeadsPagingSpecFromNext(nextUrl, pagingRewrite.pageId, pagingRewrite.formId)
      : insightsPathFromPagingNext(nextUrl)
    const j: LeadgenLeadsPage = await metaFetch<LeadgenLeadsPage>(spec.path, spec.params)
    out.push(...(j.data || []))
    nextUrl = j.paging?.next ?? null
  }
  return out
}

type FormRowWithLeads = { id: string; leads?: LeadgenLeadsPage }

/** Resposta de `GET /{pageId}?fields=leadgen_forms{...}` (campo no nó Page). */
type PageNodeWithLeadgenForms = {
  leadgen_forms?: { data?: FormRowWithLeads[]; paging?: { next?: string } }
}

/**
 * Quando `GET /{formId}/leads` falha, tenta caminhos suportados no contexto da página.
 * (Mensagens da Meta podem vir em PT — não depender só de "Unknown path components".)
 */
async function fetchLeadgenLeadsForFormFallback(pageId: string, formId: string, pageAccessToken: string): Promise<MetaLeadgenLeadRow[]> {
  const attempts: string[] = []

  const rewrite = { pageId, formId }

  try {
    return await fetchLeadgenLeadsPaged(`/${pageId}/leadgen_forms/${formId}/leads`, pageAccessToken, rewrite)
  } catch (e) {
    attempts.push(`…/leadgen_forms/${formId}/leads: ${errorText(e)}`)
  }

  try {
    let nextUrl: string | null = null
    for (;;) {
      const spec = nextUrl
        ? insightsPathFromPagingNext(nextUrl)
        : {
            path: `/${pageId}/leadgen_forms`,
            params: {
              access_token: pageAccessToken,
              fields: 'id,leads.limit(100){id,created_time,field_data}',
              limit: '100'
            }
          }
      const j: { data?: FormRowWithLeads[]; paging?: { next?: string } } = await metaFetch(spec.path, spec.params)
      for (const row of j.data || []) {
        if (row.id === formId) return await collectLeadsFromLeadPage(row.leads, rewrite)
      }
      nextUrl = j.paging?.next ?? null
      if (!nextUrl) break
    }
  } catch (e) {
    attempts.push(`…/leadgen_forms?fields=…leads…: ${errorText(e)}`)
  }

  try {
    const fields = 'leadgen_forms.limit(100){id,leads.limit(100){id,created_time,field_data}}'
    let formsNext: string | null = null
    for (;;) {
      let j: PageNodeWithLeadgenForms
      if (!formsNext) {
        j = await metaFetch<PageNodeWithLeadgenForms>(`/${pageId}`, {
          access_token: pageAccessToken,
          fields
        })
      } else {
        const spec = insightsPathFromPagingNext(formsNext)
        j = await metaFetch<PageNodeWithLeadgenForms>(spec.path, spec.params)
      }
      const block = j.leadgen_forms
      for (const row of block?.data || []) {
        if (row.id === formId) return await collectLeadsFromLeadPage(row.leads, rewrite)
      }
      formsNext = block?.paging?.next ?? null
      if (!formsNext) break
    }
  } catch (e) {
    attempts.push(`…/{pageId}?fields=leadgen_forms…: ${errorText(e)}`)
  }

  const metaType = await fetchLeadgenFormMetadataType(formId, pageAccessToken)
  const typeLine = metaType ? `\nTipo Graph (metadata) do ID ${formId}: ${metaType}.` : ''
  const probeLine = await probeLeadgenFormScalars(formId, pageAccessToken)

  throw new Error(
    `Não foi possível obter leads do formulário ${formId} na página ${pageId}.\n` +
      `A Graph API não expõe a aresta /leads neste ID (erro 2500 em todos os caminhos testados).${typeLine}${probeLine}\n` +
      `Versão API em uso: ${GRAPH_VERSION} (define VITE_META_GRAPH_API_VERSION no .env para testar outra, ex. v23.0).\n` +
      `Tentativas:\n${attempts.map((a) => `· ${a}`).join('\n')}\n` +
      LEADS_GRAPH_2500_HINT_PT.trim()
  )
}

/**
 * Todos os envios de um formulário (paginação automática).
 * Se `GET /{formId}/leads` falhar e existir `pageId`, tenta leitura no contexto da página.
 * `userAccessToken` opcional: token de utilizador (ex. o guardado em Meta Ads); às vezes o pedido
 * `/{formId}/leads` aceita-o quando o page token falha com 2500.
 */
export async function fetchLeadgenLeadsForForm(
  pageId: string,
  formId: string,
  pageAccessToken: string,
  userAccessToken?: string
): Promise<MetaLeadgenLeadRow[]> {
  const pid = String(pageId ?? '').trim()
  const userTok = userAccessToken?.trim()
  let directErr: unknown
  try {
    return await fetchLeadgenLeadsPaged(`/${formId}/leads`, pageAccessToken)
  } catch (e) {
    directErr = e
    if (userTok && userTok !== pageAccessToken.trim()) {
      try {
        return await fetchLeadgenLeadsPaged(`/${formId}/leads`, userTok)
      } catch {
        /* continuar com fallback à página */
      }
    }
    if (!pid) throw directErr
    try {
      return await fetchLeadgenLeadsForFormFallback(pid, formId, pageAccessToken)
    } catch (fbErr) {
      throw new Error(`${errorText(directErr)}\n\n--- Tentativas pela página ${pid} ---\n${errorText(fbErr)}`)
    }
  }
}

export function flattenLeadFieldData(field_data?: MetaLeadgenFieldDatum[]): Record<string, string> {
  const o: Record<string, string> = {}
  for (const f of field_data ?? []) {
    o[f.name] = (f.values ?? []).join(' · ')
  }
  return o
}

export function pickLeadDisplayName(fields: Record<string, string>): string {
  const tryKeys = ['full_name', 'nome_completo', 'first_name', 'nome', 'name', 'full name']
  for (const k of tryKeys) {
    const v = fields[k] ?? fields[k.toLowerCase()]
    if (v?.trim()) return v.trim()
  }
  const fn = (fields.first_name || fields.nome || '').trim()
  const ln = (fields.last_name || fields.sobrenome || fields.apelido || '').trim()
  if (fn || ln) return `${fn} ${ln}`.trim()
  const firstVal = Object.values(fields).find((x) => x?.trim())
  return firstVal?.trim() || 'Lead sem nome'
}

export function pickLeadEmail(fields: Record<string, string>): string | undefined {
  const keys = ['email', 'e-mail', 'business_email']
  for (const k of keys) {
    const v = fields[k] ?? fields[k.toLowerCase()]
    if (v?.includes('@')) return v.trim()
  }
  for (const v of Object.values(fields)) {
    if (v?.includes('@')) return v.trim()
  }
  return undefined
}

export function pickLeadPhone(fields: Record<string, string>): string | undefined {
  const keys = ['phone_number', 'phone', 'telefone', 'mobile_phone', 'celular']
  for (const k of keys) {
    const v = fields[k] ?? fields[k.toLowerCase()]
    if (v?.trim()) return v.trim()
  }
  return undefined
}

/** Data `YYYY-MM-DD` a partir de `created_time` da Graph (ISO-like). */
export function leadCreatedDateIso(created_time: string): string {
  const t = created_time?.trim() || ''
  if (t.length >= 10) return t.slice(0, 10)
  return ''
}
