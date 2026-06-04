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
  token: 'crm_meta_token'
} as const

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
