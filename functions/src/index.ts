import { setGlobalOptions } from 'firebase-functions/v2'

setGlobalOptions({ region: 'us-central1', maxInstances: 20 })

/**
 * Sem callables ativos — token Meta e Graph API correm no cliente (src/lib/meta-ads.ts).
 * Adicione novas functions aqui quando precisar de lógica servidor.
 */
