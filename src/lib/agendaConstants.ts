import type { AgendamentoStatus } from '../firebase/firestore'
import type { QualificacaoSdr } from './qualificacaoSdr'
import { QUALIFICACAO_SDR_LABELS } from './qualificacaoSdr'

export const AGENDAMENTO_STATUS_LABEL: Record<AgendamentoStatus, string> = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  venda: 'Venda',
  no_show: 'No show',
  reagendada: 'Reagendada'
}

export const AGENDAMENTO_STATUS_BADGE: Record<AgendamentoStatus, string> = {
  agendada: 'b-sdr',
  realizada: 'b-green',
  venda: 'b-amber',
  no_show: 'b-no-show',
  reagendada: 'b-closer'
}

/** Cor de destaque no calendário e resumo */
export const AGENDAMENTO_STATUS_COLOR: Record<AgendamentoStatus, string> = {
  agendada: '#40E0D0',
  reagendada: '#1E90FF',
  realizada: '#9370DB',
  venda: '#008000',
  no_show: '#4B0082'
}

/** Classe CSS do chip no calendário */
export const AGENDAMENTO_STATUS_CAL_CLASS: Record<AgendamentoStatus, string> = {
  agendada: 'agenda-cal-ev--agendada',
  realizada: 'agenda-cal-ev--realizada',
  venda: 'agenda-cal-ev--venda',
  no_show: 'agenda-cal-ev--no-show',
  reagendada: 'agenda-cal-ev--reagendada'
}

export const AGENDAMENTO_QUAL_BADGE: Record<QualificacaoSdr, string> = {
  qualificada: 'b-green',
  pendente: 'b-amber',
  nao_qualificada: 'b-no-show'
}

export { QUALIFICACAO_SDR_LABELS }
