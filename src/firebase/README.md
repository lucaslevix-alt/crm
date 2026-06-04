# Camada Firestore

| Módulo | Responsabilidade |
|--------|------------------|
| `db.ts` | Instância `db` e app Firebase |
| `configMedia.ts` | Avisos, fotos de eventos (TV), temporizadores TV |
| `metas.ts` | `config/metas` — metas globais e por squad |
| `baseClientes.ts` | `config/base_clientes_operacao` |
| `gts.ts` | `config/gts_vendas_atual` (+ migração legado) |
| `audit.ts` | Coleção `auditoria` |
| `firestore.core.ts` | Registos, utilizadores, produtos, squads, operação, agenda |
| `firestore.ts` | Barrel — reexporta todos os módulos acima |

Imports na app: continue a usar `from '../firebase/firestore'` ou `from '../firebase'` — ambos reexportam a API pública.
