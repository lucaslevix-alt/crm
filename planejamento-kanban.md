# Planejamento: CRM Kanban de leads

Documento derivado de `kanban.md`. Objetivo: tornar **implementável** o sistema descrito, em fases, alinhado ao stack atual (React + Firebase/Firestore).

---

## 1. Síntese dos requisitos (fonte: `kanban.md`)

| Área | O que o utilizador quer |
|------|-------------------------|
| **Estrutura** | Pipelines criáveis; etapas (colunas) por pipeline; leads como cards nas etapas. |
| **Ownership** | Vincular SDR (utilizador) por negócio/lead. |
| **Reuniões** | Marcar agendada/realizada e refletir no sistema (e nas métricas). |
| **Ganho** | Marcar ganho e atualizar métricas automaticamente. |
| **Etiquetas** | CRUD de tags; aplicar várias tags por lead. |
| **Cadência** | Por etapa: sequência de atividades (dias após entrada na pipeline); tipos: Ligação, Mensagem, Reunião, Lembrete. |
| **Detalhe do card** | Histórico de atividades; notas/briefing; histórico de mudanças; nome, e-mail, faturamento, Instagram; campo extra via webhook; status na pipeline. |
| **Vista lista/Kanban** | No card: atividades em atraso; tempo na pipeline; base para ciclo de vendas (entrada → ganho). |
| **CRUD leads** | Criar, editar, excluir manualmente. |
| **Entrada** | Criação de leads via webhook. |

---

## 2. Estado atual do CRM (gap)

- **Já existe:** utilizadores (SDR/closer/admin), `registros` (tipos como reunião/venda), `leads_sdr` (contagens por SDR/data), squads, agenda interna, funil **somente como métricas agregadas**.
- **Não existe:** modelo `Pipeline` / `Etapa` / `Lead` (negócio) com posição na coluna, histórico estruturado, cadência, tags dedicadas ao Kanban, webhook de inbound para lead.
- **Implicação:** o Kanban é um **módulo novo** em Firestore + UI; a **integração** com `registros` e dashboards deve ser **definida por regras** (ver secção 6).

---

## 3. Modelo de dados proposto (Firestore)

Nomes de coleções são sugestão; ajustar a convenções do projeto.

### 3.1 Configuração

- **`pipeline_configs`** (ou subcoleção `config/pipelines`)
  - `id`, `nome`, `ordem`, `ativo`, `createdAt`, `updatedAt`
- **`pipeline_stages`** (ou mapa embutido no pipeline)
  - `pipelineId`, `id`, `nome`, `ordem`, `cor?`, `createdAt`
  - *Opcional:* `cadenciaTemplateId` ou template embutido na etapa

### 3.2 Lead (negócio)

- **`kanban_leads`** (nome final a definir)
  - Identidade: `nome`, `email`, `telefone?`, `instagram?`, `faturamentoEstimado?` (número ou texto)
  - Pipeline: `pipelineId`, `stageId`
  - `sdrUserId` (e cache `sdrUserName` para listas)
  - `tagIds: string[]`
  - `enteredPipelineAt` (timestamp) — **início do ciclo**
  - `wonAt?`, `lostAt?`, `status: 'open' | 'won' | 'lost'` — **fim do ciclo** / ganho
  - `webhookPayload` ou `camposExtras: Record<string, unknown>` — dados vindos do webhook
  - `createdAt`, `updatedAt`, `createdBy`, `source: 'manual' | 'webhook' | 'import'`

### 3.3 Atividades e cadência

- **`lead_activities`** (subcoleção `kanban_leads/{id}/activities` ou coleção top-level com `leadId`)
  - `tipo: 'ligacao' | 'mensagem' | 'reuniao' | 'lembrete' | 'nota' | 'sistema'`
  - `dueAt` / `doneAt`, `title`, `body?`, `createdBy`, `createdAt`
  - Atividades “de cadência” podem ter `templateDay: number` (dia N após entrada)

- **`stage_cadence_templates`** (ou campo no `pipeline_stages`)
  - Lista: `{ dayOffset: number, tipo: ActivityType, tituloPadrao?: string }`
  - Ao **mover lead para a etapa** ou **criar lead na etapa inicial**, gerar instâncias em `lead_activities` (job ou Cloud Function).

### 3.4 Histórico de mudanças (audit)

- **`lead_audit_log`** (subcoleção ou coleção com `leadId`)
  - `at`, `userId`, `action` (`stage_changed`, `sdr_changed`, `field_updated`, `tag_added`, …), `payload` (antes/depois)

### 3.5 Etiquetas

- **`lead_tags`**
  - `id`, `nome`, `cor`, `createdAt`

### 3.6 Webhook

- Opção A: **HTTPS Cloud Function** `POST /webhooks/leads` com secret/header; valida JSON e cria documento em `kanban_leads`.
- Opção B: integração **n8n** já usada no projeto — espelhar padrão de `VITE_N8N_WEBHOOK_*` se preferirem não expor Firebase diretamente.

---

## 4. Regras de negócio importantes

1. **Entrada na pipeline:** ao definir `enteredPipelineAt`, passar a calcular “dias na pipeline” e cadência (dia 0 = entrada).
2. **Atividades em atraso:** `dueAt < now` e `doneAt == null`.
3. **Ganho:** `status = won`, `wonAt = now`; opcionalmente disparar criação de **registro** `venda` (ou só marcar lead — decisão de produto).
4. **Reunião agendada/realizada:** ou campos no lead + atividades tipo `reuniao`, ou **sincronizar** com `registros` existentes (ex.: ao marcar “RA” no card, chamar a mesma API que `addRegistro`) para métricas globais continuarem corretas.
5. **Permissões:** SDR vê/edita leads atribuídos (e talvez pipeline inteiro read-only); admin CRUD completo; closer conforme política (só leitura ou nada).

---

## 5. Fases de implementação (ordem sugerida)

### Fase 0 — Fundações (1 sprint curto)

- Rotas: `/kanban` ou `/leads` + item no menu.
- CRUD mínimo: 1 pipeline default com etapas fixas em código **ou** CRUD pipeline/etapas já persistido.
- Coleção `kanban_leads` + listagem simples em **uma coluna** ou board estático.

### Fase 1 — Kanban utilizável

- Drag-and-drop entre etapas (atualizar `stageId` + append em `lead_audit_log`).
- Filtro por pipeline; assign SDR; tags (CRUD + multi-select no card).
- Card na board: nome, SDR, tags, indicador atraso, “dias na pipeline”.
- CRUD manual completo do lead + exclusão com confirmação.

### Fase 2 — Detalhe do lead (drawer/modal)

- Abas ou secções: dados, notas (append-only ou editável), lista de atividades, audit log.
- Campo “extras” (JSON) visível para admin/SDR.

### Fase 3 — Cadência por etapa

- UI para editar template de cadência na etapa.
- Geração de atividades ao entrar na etapa (e política ao **retroceder** etapa: cancelar futuras vs manter).

### Fase 4 — Integração métricas e reuniões

- Ações “Reunião agendada / realizada / Ganho” no lead com efeito em `registros` (se for requisito estrito de “marcar automaticamente no sistema todas as métricas”).
- Dashboard/funil: decidir se contam leads Kanban + registros ou só duplicam eventos.

### Fase 5 — Webhook

- Function + documentação do payload (campos obrigatórios, mapeamento para `camposExtras`).
- Idempotência (`externalId` do CRM externo) para evitar duplicados.

### Fase 6 — Relatórios de ciclo

- Query: média de `wonAt - enteredPipelineAt` por pipeline/SDR; export CSV opcional.

---

## 6. Decisões em aberto (resolver antes ou no início da Fase 4)

1. **Um lead pode mudar de pipeline?** (sim/não; se sim, resetar `enteredPipelineAt` ou não.)
2. **Ganho no Kanban = obrigatoriamente venda em `registros`?** Valor da venda vem do lead ou só do registro manual posterior?
3. **Leads `leads_sdr` atuais:** substituir por Kanban, manter os dois em paralelo, ou migrar contagens a partir dos leads do board?
4. **Multi-pipeline na mesma equipa:** todos os SDRs veem todos os pipelines ou restrição por squad?

---

## 7. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Firestore: muitas escritas no drag | Debounce + batch; ou atualizar só `stageId` num único write. |
| Cadência gera dezenas de tarefas | Limitar dias máximos por etapa; arquivar atividades ao fechar lead. |
| Webhook aberto | Secret em header; rate limit; validação de schema. |
| Duplicar lógica com `registros` | Serviço único `recordLeadEvent(lead, tipo)` chamado pela UI Kanban e, se preciso, pelo webhook. |

---

## 8. Próximo passo concreto

1. Validar as **decisões da secção 6** com o negócio.
2. Implementar **Fase 0 + Fase 1** com um pipeline default e permissões básicas.
3. Só depois expandir cadência, webhook e relatórios de ciclo.

Este ficheiro pode ser cortado em issues/tickets por fase; `kanban.md` permanece como visão de produto, este como roadmap técnico.
