const META_KEYS_LEAD = ['lead', 'onsite_conversion.lead', 'offsite_conversion.fb_pixel_lead', 'leadgen_grouped']
const META_KEYS_MSG = ['onsite_conversion.messaging_conversation_started_7d', 'omni_messaging_conversation_started', 'messaging_first_reply']
const META_KEYS_VISITA = ['link_click', 'outbound_click.outbound', 'outbound_click']

/** v19 gerava aviso de Ads API desatualizada no servidor Meta. */
const GRAPH_VERSION = 'v22.0'
const META_GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

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
