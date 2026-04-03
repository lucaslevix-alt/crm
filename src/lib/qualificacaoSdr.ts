/** Orçamento do lead (Agenda — reunião realizada). */
export type LeadBudgetOp = 'budget_yes' | 'budget_open' | 'budget_no'

/** Qualificação para comissão SDR em `reuniao_realizada`. */
export type QualificacaoSdr = 'qualificada' | 'pendente' | 'nao_qualificada'

export const LEAD_BUDGET_OPTIONS: { value: LeadBudgetOp; label: string }[] = [
  { value: 'budget_yes', label: 'Sim' },
  { value: 'budget_open', label: 'Não foi abordado' },
  { value: 'budget_no', label: 'Não — Está fora do orçamento' }
]

export function labelLeadBudget(v: LeadBudgetOp | null | undefined): string {
  if (v == null) return '—'
  return LEAD_BUDGET_OPTIONS.find((o) => o.value === v)?.label ?? v
}

export const QUALIFICACAO_SDR_LABELS: Record<QualificacaoSdr, string> = {
  qualificada: 'Qualificada',
  pendente: 'Pendente revisão',
  nao_qualificada: 'Não qualificada'
}

const BUDGET_SET = new Set<string>(['budget_yes', 'budget_open', 'budget_no'])
const QUAL_SET = new Set<string>(['qualificada', 'pendente', 'nao_qualificada'])

export function parseLeadBudget(raw: unknown): LeadBudgetOp | null {
  const s = raw != null ? String(raw).trim() : ''
  return BUDGET_SET.has(s) ? (s as LeadBudgetOp) : null
}

export function parseQualificacaoSdr(raw: unknown): QualificacaoSdr | null {
  const s = raw != null ? String(raw).trim() : ''
  return QUAL_SET.has(s) ? (s as QualificacaoSdr) : null
}

export function isValidHttpsRecordingUrl(raw: string): boolean {
  const t = raw.trim()
  if (!t.startsWith('https://')) return false
  try {
    const u = new URL(t)
    return u.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Regras em `validado.md`: URL inválida → nao_qualificada; budget_no → nao_qualificada;
 * budget_yes + URL válida → qualificada; budget_open + URL válida → pendente.
 */
export function calcularQualificacaoSdr(params: { leadBudget: LeadBudgetOp; callRecordingUrl: string }): QualificacaoSdr {
  const url = params.callRecordingUrl.trim()
  if (!isValidHttpsRecordingUrl(url)) return 'nao_qualificada'
  if (params.leadBudget === 'budget_no') return 'nao_qualificada'
  if (params.leadBudget === 'budget_yes') return 'qualificada'
  return 'pendente'
}
