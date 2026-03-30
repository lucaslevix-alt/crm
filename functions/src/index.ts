import { setGlobalOptions } from 'firebase-functions/v2'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import * as logger from 'firebase-functions/logger'
import * as admin from 'firebase-admin'

setGlobalOptions({ region: 'us-central1', maxInstances: 20 })

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()
const GRAPH_VERSION = 'v19.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`
const PRIVATE_DOC = 'private/meta_ads'

async function getCrmCargo(email: string | undefined): Promise<string | null> {
  if (!email) return null
  const normalized = email.toLowerCase().trim()
  const snap = await db.collection('usuarios').where('email', '==', normalized).limit(1).get()
  if (snap.empty) return null
  return String(snap.docs[0].data().cargo ?? '')
}

function canUseMetaAds(cargo: string | null): boolean {
  return cargo === 'admin' || cargo === 'sdr' || cargo === 'closer'
}

function isAdmin(cargo: string | null): boolean {
  return cargo === 'admin'
}

function sanitizePath(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  if (p.length > 512) throw new HttpsError('invalid-argument', 'path demasiado longo')
  if (!/^\/[a-zA-Z0-9_./-]+$/.test(p)) throw new HttpsError('invalid-argument', 'path inválido')
  return p
}

async function graphPostRaw(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    body.set(k, v)
  }
  const r = await fetch(`${GRAPH_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  })
  return (await r.json()) as Record<string, unknown>
}

async function graphApiPost(path: string, params: Record<string, string>): Promise<unknown> {
  const json = await graphPostRaw(path, params)
  const err = json.error as { message?: string } | undefined
  if (err) {
    logger.warn('Graph API', { path, message: err.message })
    throw new HttpsError('internal', err.message || 'Erro na API Graph')
  }
  return json
}

/** Apenas admin: valida o token com /me e grava em Firestore (ilegível pelo cliente com regras corretas). */
export const setMetaAdsToken = onCall(async (request) => {
  const email = request.auth?.token?.email
  if (!email) throw new HttpsError('unauthenticated', 'Login necessário.')

  const cargo = await getCrmCargo(email)
  if (!isAdmin(cargo)) {
    throw new HttpsError('permission-denied', 'Apenas administradores podem guardar o token Meta.')
  }

  const accessToken = String(request.data?.accessToken ?? '').trim()
  if (!accessToken) throw new HttpsError('invalid-argument', 'accessToken em falta.')

  let json: Record<string, unknown>
  try {
    json = await graphPostRaw('/me', { access_token: accessToken, fields: 'name,id' })
  } catch {
    throw new HttpsError('invalid-argument', 'Não foi possível contactar a API Meta.')
  }
  if (json.error) {
    const msg = (json.error as { message?: string })?.message || 'Token inválido'
    throw new HttpsError('invalid-argument', msg)
  }
  const me = json as { name?: string }
  await db.doc(PRIVATE_DOC).set(
    {
      accessToken,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedByEmail: email
    },
    { merge: true }
  )
  return { ok: true, name: me.name ?? 'OK' }
})

export const clearMetaAdsToken = onCall(async (request) => {
  const email = request.auth?.token?.email
  if (!email) throw new HttpsError('unauthenticated', 'Login necessário.')
  const cargo = await getCrmCargo(email)
  if (!isAdmin(cargo)) throw new HttpsError('permission-denied', 'Apenas administradores.')
  await db.doc(PRIVATE_DOC).delete()
  return { ok: true }
})

export const getMetaAdsStatus = onCall(async (request) => {
  const email = request.auth?.token?.email
  if (!email) throw new HttpsError('unauthenticated', 'Login necessário.')

  const cargo = await getCrmCargo(email)
  if (!canUseMetaAds(cargo)) throw new HttpsError('permission-denied', 'Sem permissão para Meta Ads.')

  const doc = await db.doc(PRIVATE_DOC).get()
  const configured = doc.exists && Boolean(String(doc.data()?.accessToken ?? '').trim())
  return { configured }
})

/** Proxy autenticado: o token nunca sai do servidor. */
export const metaGraphProxy = onCall(async (request) => {
  const email = request.auth?.token?.email
  if (!email) throw new HttpsError('unauthenticated', 'Login necessário.')

  const cargo = await getCrmCargo(email)
  if (!canUseMetaAds(cargo)) throw new HttpsError('permission-denied', 'Sem permissão para Meta Ads.')

  const doc = await db.doc(PRIVATE_DOC).get()
  const accessToken = String(doc.data()?.accessToken ?? '').trim()
  if (!accessToken) {
    throw new HttpsError(
      'failed-precondition',
      'Token Meta não configurado. Um administrador deve conectar em Meta Ads → Conectar.'
    )
  }

  const path = sanitizePath(String(request.data?.path ?? ''))
  const rawParams = request.data?.params
  if (rawParams != null && (typeof rawParams !== 'object' || Array.isArray(rawParams))) {
    throw new HttpsError('invalid-argument', 'params inválidos')
  }
  const paramsIn = (rawParams ?? {}) as Record<string, string>

  const params: Record<string, string> = { access_token: accessToken }
  for (const [k, v] of Object.entries(paramsIn)) {
    if (k === 'access_token') continue
    const s = String(v ?? '')
    if (s.length > 12000) throw new HttpsError('invalid-argument', 'parâmetro demasiado longo')
    params[k] = s
  }

  return await graphApiPost(path, params)
})
