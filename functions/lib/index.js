"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.metaGraphProxy = exports.getMetaAdsStatus = exports.clearMetaAdsToken = exports.setMetaAdsToken = void 0;
const v2_1 = require("firebase-functions/v2");
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
(0, v2_1.setGlobalOptions)({ region: 'us-central1', maxInstances: 20 });
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const GRAPH_VERSION = 'v22.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const PRIVATE_DOC = 'private/meta_ads';
async function getCrmCargo(email) {
    if (!email)
        return null;
    const normalized = email.toLowerCase().trim();
    const snap = await db.collection('usuarios').where('email', '==', normalized).limit(1).get();
    if (snap.empty)
        return null;
    return String(snap.docs[0].data().cargo ?? '');
}
function canUseMetaAds(cargo) {
    return cargo === 'admin' || cargo === 'sdr' || cargo === 'closer';
}
function isAdmin(cargo) {
    return cargo === 'admin';
}
function sanitizePath(path) {
    const p = path.startsWith('/') ? path : `/${path}`;
    if (p.length > 512)
        throw new https_1.HttpsError('invalid-argument', 'path demasiado longo');
    if (!/^\/[a-zA-Z0-9_./-]+$/.test(p))
        throw new https_1.HttpsError('invalid-argument', 'path inválido');
    return p;
}
async function graphPostRaw(path, params) {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        body.set(k, v);
    }
    const r = await fetch(`${GRAPH_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
    });
    return (await r.json());
}
async function graphApiPost(path, params) {
    const json = await graphPostRaw(path, params);
    const err = json.error;
    if (err) {
        logger.warn('Graph API', { path, message: err.message });
        throw new https_1.HttpsError('internal', err.message || 'Erro na API Graph');
    }
    return json;
}
/** Apenas admin: valida o token com /me e grava em Firestore (ilegível pelo cliente com regras corretas). */
exports.setMetaAdsToken = (0, https_1.onCall)(async (request) => {
    const email = request.auth?.token?.email;
    if (!email)
        throw new https_1.HttpsError('unauthenticated', 'Login necessário.');
    const cargo = await getCrmCargo(email);
    if (!isAdmin(cargo)) {
        throw new https_1.HttpsError('permission-denied', 'Apenas administradores podem guardar o token Meta.');
    }
    const accessToken = String(request.data?.accessToken ?? '').trim();
    if (!accessToken)
        throw new https_1.HttpsError('invalid-argument', 'accessToken em falta.');
    let json;
    try {
        json = await graphPostRaw('/me', { access_token: accessToken, fields: 'name,id' });
    }
    catch {
        throw new https_1.HttpsError('invalid-argument', 'Não foi possível contactar a API Meta.');
    }
    if (json.error) {
        const msg = json.error?.message || 'Token inválido';
        throw new https_1.HttpsError('invalid-argument', msg);
    }
    const me = json;
    await db.doc(PRIVATE_DOC).set({
        accessToken,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByEmail: email
    }, { merge: true });
    return { ok: true, name: me.name ?? 'OK' };
});
exports.clearMetaAdsToken = (0, https_1.onCall)(async (request) => {
    const email = request.auth?.token?.email;
    if (!email)
        throw new https_1.HttpsError('unauthenticated', 'Login necessário.');
    const cargo = await getCrmCargo(email);
    if (!isAdmin(cargo))
        throw new https_1.HttpsError('permission-denied', 'Apenas administradores.');
    await db.doc(PRIVATE_DOC).delete();
    return { ok: true };
});
exports.getMetaAdsStatus = (0, https_1.onCall)(async (request) => {
    const email = request.auth?.token?.email;
    if (!email)
        throw new https_1.HttpsError('unauthenticated', 'Login necessário.');
    const cargo = await getCrmCargo(email);
    if (!canUseMetaAds(cargo))
        throw new https_1.HttpsError('permission-denied', 'Sem permissão para Meta Ads.');
    const doc = await db.doc(PRIVATE_DOC).get();
    const configured = doc.exists && Boolean(String(doc.data()?.accessToken ?? '').trim());
    return { configured };
});
/** Proxy autenticado: o token nunca sai do servidor. */
exports.metaGraphProxy = (0, https_1.onCall)(async (request) => {
    const email = request.auth?.token?.email;
    if (!email)
        throw new https_1.HttpsError('unauthenticated', 'Login necessário.');
    const cargo = await getCrmCargo(email);
    if (!canUseMetaAds(cargo))
        throw new https_1.HttpsError('permission-denied', 'Sem permissão para Meta Ads.');
    const doc = await db.doc(PRIVATE_DOC).get();
    const accessToken = String(doc.data()?.accessToken ?? '').trim();
    if (!accessToken) {
        throw new https_1.HttpsError('failed-precondition', 'Token Meta não configurado. Um administrador deve conectar em Meta Ads → Conectar.');
    }
    const path = sanitizePath(String(request.data?.path ?? ''));
    const rawParams = request.data?.params;
    if (rawParams != null && (typeof rawParams !== 'object' || Array.isArray(rawParams))) {
        throw new https_1.HttpsError('invalid-argument', 'params inválidos');
    }
    const paramsIn = (rawParams ?? {});
    const params = { access_token: accessToken };
    for (const [k, v] of Object.entries(paramsIn)) {
        if (k === 'access_token')
            continue;
        const s = String(v ?? '');
        if (s.length > 12000)
            throw new https_1.HttpsError('invalid-argument', 'parâmetro demasiado longo');
        params[k] = s;
    }
    return await graphApiPost(path, params);
});
//# sourceMappingURL=index.js.map