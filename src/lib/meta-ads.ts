const META_BASE = 'https://graph.facebook.com/v19.0'

const META_KEYS_LEAD = ['lead', 'onsite_conversion.lead', 'offsite_conversion.fb_pixel_lead', 'leadgen_grouped']
const META_KEYS_MSG = ['onsite_conversion.messaging_conversation_started_7d', 'omni_messaging_conversation_started', 'messaging_first_reply']
const META_KEYS_VISITA = ['link_click', 'outbound_click.outbound', 'outbound_click']

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

export interface MetaFetchParams {
  access_token: string
  [key: string]: string | undefined
}

export async function metaFetch<T = unknown>(
  path: string,
  params: Record<string, string | undefined> & { access_token: string }
): Promise<T> {
  const url = `${META_BASE}${path}?${new URLSearchParams(params as Record<string, string>)}`
  const r = await fetch(url)
  const d = (await r.json()) as { error?: { message: string }; data?: unknown }
  if (d.error) throw new Error(d.error.message)
  return d as T
}

export const META_STORAGE_KEYS = {
  token: 'crm_meta_token',
  mode: 'crm_meta_mode',
  accId: 'crm_meta_accid',
  fav: 'crm_meta_fav'
} as const

const ENV_TOKEN = typeof import.meta.env !== 'undefined' && typeof import.meta.env.VITE_META_ADS_TOKEN === 'string'
  ? (import.meta.env.VITE_META_ADS_TOKEN as string).trim()
  : ''

export function metaLoadSaved(): { token: string; mode: MetaConvMode; accId: string; favAccId: string } {
  let token = typeof window !== 'undefined' ? localStorage.getItem(META_STORAGE_KEYS.token) || '' : ''
  if (!token && ENV_TOKEN) {
    token = ENV_TOKEN
    if (typeof window !== 'undefined') localStorage.setItem(META_STORAGE_KEYS.token, token)
  }
  const mode = (typeof window !== 'undefined' ? localStorage.getItem(META_STORAGE_KEYS.mode) : null) || 'lead'
  const accId = typeof window !== 'undefined' ? localStorage.getItem(META_STORAGE_KEYS.accId) || '' : ''
  const favAccId = typeof window !== 'undefined' ? localStorage.getItem(META_STORAGE_KEYS.fav) || '' : ''
  return { token, mode: mode as MetaConvMode, accId, favAccId }
}

export function metaSaveToken(token: string): void {
  if (typeof window !== 'undefined') localStorage.setItem(META_STORAGE_KEYS.token, token)
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
