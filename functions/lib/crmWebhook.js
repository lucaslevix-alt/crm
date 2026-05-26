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
exports.normalizeStepLabel = normalizeStepLabel;
exports.loadCrmWebhookConfig = loadCrmWebhookConfig;
exports.matchStepKind = matchStepKind;
exports.parseWebhookBody = parseWebhookBody;
exports.processCrmNativeWebhook = processCrmNativeWebhook;
exports.handleCrmNativeWebhookRequest = handleCrmNativeWebhookRequest;
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
const CONFIG_DOC = 'config/crm_webhook';
const ORDER_COLLECTION = 'crm_webhook_orders';
const PROCESSED_COLLECTION = 'crm_webhook_processed';
const LOG_COLLECTION = 'crm_webhook_logs';
const DEFAULT_MAPPINGS = {
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
};
function normalizeStepLabel(raw) {
    return String(raw ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '');
}
function parseAmount(raw) {
    if (raw == null)
        return 0;
    if (typeof raw === 'number' && Number.isFinite(raw))
        return Math.max(0, raw);
    let s = String(raw).trim();
    if (!s)
        return 0;
    s = s.replace(/[^\d,.-]/g, '');
    if (s.includes(',') && s.includes('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
    }
    else if (s.includes(',')) {
        s = s.replace(',', '.');
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
}
function isoToDateYmd(iso) {
    if (!iso)
        return new Date().toISOString().slice(0, 10);
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return new Date().toISOString().slice(0, 10);
    return d.toISOString().slice(0, 10);
}
async function loadCrmWebhookConfig() {
    const snap = await db.doc(CONFIG_DOC).get();
    const data = snap.data() ?? {};
    const envSecret = String(process.env.CRM_WEBHOOK_SECRET ?? '').trim();
    const mappings = (data.stepMappings ?? {});
    return {
        enabled: data.enabled !== false,
        secret: String(data.secret ?? '').trim() || envSecret,
        stepMappings: {
            agendada: Array.isArray(mappings.agendada) && mappings.agendada.length > 0 ? mappings.agendada : DEFAULT_MAPPINGS.agendada,
            realizada: Array.isArray(mappings.realizada) && mappings.realizada.length > 0 ? mappings.realizada : DEFAULT_MAPPINGS.realizada,
            venda: Array.isArray(mappings.venda) && mappings.venda.length > 0 ? mappings.venda : DEFAULT_MAPPINGS.venda
        }
    };
}
function matchStepKind(stepLabel, cfg) {
    const norm = normalizeStepLabel(stepLabel);
    if (!norm)
        return null;
    const kinds = ['venda', 'realizada', 'agendada'];
    for (const kind of kinds) {
        const list = cfg.stepMappings[kind] ?? [];
        for (const pattern of list) {
            const p = normalizeStepLabel(pattern);
            if (!p)
                continue;
            if (norm === p || norm.includes(p) || p.includes(norm))
                return kind;
        }
    }
    return null;
}
function parseWebhookBody(body) {
    if (!body || typeof body !== 'object')
        return null;
    const root = body;
    const event = String(root.event ?? root.type ?? '').trim();
    const data = (root.data ?? root.payload ?? root);
    const commercialOrderId = String(data.commercialOrderId ?? data.commercial_order_id ?? data.orderId ?? '').trim();
    if (!commercialOrderId)
        return null;
    const stepLabel = String(data.toStep ?? data.to_step ?? data.step ?? data.newStep ?? data.column ?? '').trim();
    const responsibleEmail = String(data.responsible ?? data.responsibleEmail ?? data.owner ?? '').trim();
    const contact = (data.contact ?? {});
    const contactName = String(contact.name ?? contact.nome ?? data.contactName ?? '').trim();
    const contactEmail = String(contact.email ?? '').trim();
    const contactPhone = String(contact.number ?? contact.phone ?? contact.telefone ?? '').trim();
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
    };
}
async function findUserByEmail(email) {
    const normalized = email.toLowerCase().trim();
    if (!normalized || !normalized.includes('@'))
        return null;
    const snap = await db.collection('usuarios').where('email', '==', normalized).limit(1).get();
    if (snap.empty)
        return null;
    const d = snap.docs[0];
    const x = d.data();
    return {
        id: d.id,
        nome: String(x.nome ?? '—'),
        email: normalized,
        cargo: String(x.cargo ?? '').trim().toLowerCase()
    };
}
function isSdrCargo(cargo) {
    return cargo === 'sdr' || cargo === 'admin';
}
function isCloserCargo(cargo) {
    return cargo === 'closer' || cargo === 'admin';
}
async function wasProcessed(dedupKey) {
    const snap = await db.collection(PROCESSED_COLLECTION).doc(dedupKey).get();
    return snap.exists;
}
async function markProcessed(dedupKey, meta) {
    await db.collection(PROCESSED_COLLECTION).doc(dedupKey).set({
        ...meta,
        processedAt: admin.firestore.FieldValue.serverTimestamp()
    });
}
async function appendLog(entry) {
    await db.collection(LOG_COLLECTION).add({
        ...entry,
        ts: admin.firestore.FieldValue.serverTimestamp()
    });
}
async function getOrderLink(orderId) {
    const snap = await db.collection(ORDER_COLLECTION).doc(orderId).get();
    if (!snap.exists)
        return null;
    return snap.data();
}
async function saveOrderLink(orderId, patch) {
    await db.collection(ORDER_COLLECTION).doc(orderId).set({
        commercialOrderId: orderId,
        ...patch,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}
async function createRegistroFromWebhook(params) {
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
    });
    return ref.id;
}
function buildLeadLabel(parsed) {
    if (parsed.contactName)
        return parsed.contactName;
    if (parsed.contactPhone)
        return parsed.contactPhone;
    if (parsed.contactEmail)
        return parsed.contactEmail;
    return `Negócio #${parsed.commercialOrderId}`;
}
function buildOrigem(parsed) {
    if (parsed.pipeline?.trim())
        return `CRM · ${parsed.pipeline.trim()}`;
    return 'CRM nativo';
}
async function processCrmNativeWebhook(parsed, cfg) {
    const eventUpper = parsed.event.toUpperCase();
    if (eventUpper && !eventUpper.includes('COMMERCIAL_ORDER')) {
        return { ok: true, skipped: true, reason: `evento_ignorado:${parsed.event}` };
    }
    const stepKind = matchStepKind(parsed.stepLabel, cfg);
    if (!stepKind) {
        await appendLog({
            level: 'info',
            commercialOrderId: parsed.commercialOrderId,
            step: parsed.stepLabel,
            message: 'Coluna não mapeada — nenhum registro criado'
        });
        return { ok: true, skipped: true, reason: `coluna_nao_mapeada:${parsed.stepLabel}` };
    }
    const responsible = await findUserByEmail(parsed.responsibleEmail);
    if (!responsible) {
        await appendLog({
            level: 'error',
            commercialOrderId: parsed.commercialOrderId,
            step: parsed.stepLabel,
            responsible: parsed.responsibleEmail,
            message: 'E-mail do responsável não encontrado em Usuários'
        });
        return { ok: false, reason: 'responsavel_nao_encontrado' };
    }
    const data = isoToDateYmd(parsed.transferAt);
    const grupoWpp = buildLeadLabel(parsed);
    const origem = buildOrigem(parsed);
    const obsBase = `CRM nativo · negócio #${parsed.commercialOrderId} · coluna «${parsed.stepLabel}»`;
    const registrosCriados = [];
    const orderId = parsed.commercialOrderId;
    const orderLink = await getOrderLink(orderId);
    if (stepKind === 'agendada') {
        const dedupKey = `${orderId}_reuniao_agendada`;
        if (await wasProcessed(dedupKey)) {
            return { ok: true, skipped: true, reason: 'duplicado_agendada' };
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
        });
        registrosCriados.push(regId);
        await markProcessed(dedupKey, { registroId: regId, tipo: 'reuniao_agendada' });
        const sdrPatch = { grupoWpp, origemLead: origem, pipeline: parsed.pipeline ?? null };
        if (isSdrCargo(responsible.cargo)) {
            sdrPatch.sdrUserId = responsible.id;
            sdrPatch.sdrUserName = responsible.nome;
            sdrPatch.sdrUserCargo = responsible.cargo;
        }
        await saveOrderLink(orderId, sdrPatch);
        return { ok: true, registrosCriados };
    }
    if (stepKind === 'realizada') {
        const created = [];
        if (orderLink?.sdrUserId) {
            const dedupSdr = `${orderId}_reuniao_realizada`;
            if (!(await wasProcessed(dedupSdr))) {
                const sdrUser = await db.collection('usuarios').doc(orderLink.sdrUserId).get();
                const sdrData = sdrUser.data();
                if (sdrUser.exists && sdrData) {
                    const sdr = {
                        id: sdrUser.id,
                        nome: String(sdrData.nome ?? orderLink.sdrUserName ?? '—'),
                        email: String(sdrData.email ?? ''),
                        cargo: String(sdrData.cargo ?? 'sdr').toLowerCase()
                    };
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
                    });
                    created.push(regId);
                    await markProcessed(dedupSdr, { registroId: regId, tipo: 'reuniao_realizada' });
                }
            }
        }
        else if (isSdrCargo(responsible.cargo)) {
            const dedupSdr = `${orderId}_reuniao_realizada`;
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
                });
                created.push(regId);
                await markProcessed(dedupSdr, { registroId: regId, tipo: 'reuniao_realizada' });
                await saveOrderLink(orderId, {
                    sdrUserId: responsible.id,
                    sdrUserName: responsible.nome,
                    sdrUserCargo: responsible.cargo,
                    grupoWpp,
                    origemLead: origem
                });
            }
        }
        if (isCloserCargo(responsible.cargo)) {
            const dedupCloser = `${orderId}_reuniao_closer_${responsible.id}`;
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
                });
                created.push(regId);
                await markProcessed(dedupCloser, { registroId: regId, tipo: 'reuniao_closer' });
            }
        }
        if (created.length === 0) {
            return { ok: true, skipped: true, reason: 'realizada_duplicada_ou_sem_tipo' };
        }
        return { ok: true, registrosCriados: created };
    }
    if (stepKind === 'venda') {
        const dedupKey = `${orderId}_venda_${responsible.id}`;
        if (await wasProcessed(dedupKey)) {
            return { ok: true, skipped: true, reason: 'duplicado_venda' };
        }
        const valor = parsed.amount;
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
        });
        await markProcessed(dedupKey, { registroId: regId, tipo: 'venda' });
        return { ok: true, registrosCriados: [regId] };
    }
    return { ok: true, skipped: true, reason: 'sem_acao' };
}
function extractSecret(req) {
    const h = req.headers['x-crm-webhook-secret'] ?? req.headers['x-webhook-secret'];
    if (typeof h === 'string' && h.trim())
        return h.trim();
    if (Array.isArray(h) && h[0])
        return String(h[0]).trim();
    const q = req.query.secret;
    if (typeof q === 'string')
        return q.trim();
    return '';
}
async function handleCrmNativeWebhookRequest(req, res) {
    if (req.method === 'GET') {
        res.status(200).json({ ok: true, service: 'crm-native-webhook' });
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ ok: false, error: 'method_not_allowed' });
        return;
    }
    try {
        const cfg = await loadCrmWebhookConfig();
        if (!cfg.enabled) {
            res.status(503).json({ ok: false, error: 'webhook_desativado' });
            return;
        }
        if (!cfg.secret) {
            logger.error('CRM webhook: secret não configurado');
            res.status(503).json({ ok: false, error: 'secret_nao_configurado' });
            return;
        }
        const provided = extractSecret(req);
        if (!provided || provided !== cfg.secret) {
            res.status(401).json({ ok: false, error: 'nao_autorizado' });
            return;
        }
        const parsed = parseWebhookBody(req.body);
        if (!parsed) {
            res.status(400).json({ ok: false, error: 'payload_invalido' });
            return;
        }
        const result = await processCrmNativeWebhook(parsed, cfg);
        await appendLog({
            level: result.ok ? 'ok' : 'warn',
            commercialOrderId: parsed.commercialOrderId,
            event: parsed.event,
            step: parsed.stepLabel,
            responsible: parsed.responsibleEmail,
            result
        });
        res.status(200).json({ ...result, ok: result.ok });
    }
    catch (e) {
        logger.error('crmNativeWebhook', e);
        await appendLog({
            level: 'error',
            message: e instanceof Error ? e.message : String(e)
        }).catch(() => { });
        res.status(500).json({ ok: false, error: 'erro_interno' });
    }
}
//# sourceMappingURL=crmWebhook.js.map