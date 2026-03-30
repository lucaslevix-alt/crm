/**
 * Webhook opcional para o N8N criar o grupo WhatsApp após o SDR agendar.
 * Configure `VITE_N8N_WEBHOOK_AGENDAMENTO` com a URL do webhook (ex.: n8n).
 * O CRM não espera resposta; falhas de rede não impedem o registro.
 */

export type N8nAgendamentoPayload = {
  event: 'reuniao_agendada_sdr'
  origemLead: string
  /** Mesmo valor guardado em Firestore como `grupoWpp` (identificador na agenda). */
  nomeLead: string
  sdrUserId: string
  sdrUserName: string
  sdrCargo: string
  squadId: string
  squadNome: string
  agendamentoId: string
  registroAgendadaId: string
  data: string
  source: 'crm_quick_bar'
}

export function getN8nAgendamentoWebhookUrl(): string | null {
  const u = (import.meta.env.VITE_N8N_WEBHOOK_AGENDAMENTO as string | undefined)?.trim()
  return u || null
}

export function triggerN8nAgendamentoWebhook(payload: N8nAgendamentoPayload): void {
  const url = getN8nAgendamentoWebhookUrl()
  if (!url) return

  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    mode: 'cors',
    credentials: 'omit',
    keepalive: true
  }).catch(() => {
    if (import.meta.env.DEV) {
      console.warn('[CRM] Webhook N8N (agendamento): falha de rede — o registro já foi gravado.')
    }
  })
}
