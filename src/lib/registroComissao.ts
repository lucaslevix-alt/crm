import type { RegistroRow } from '../firebase/firestore'

/**
 * Quando `invalidoComissao === true`, o registo não entra em rankings, metas, funil, dashboard (KPIs) nem relatórios de comissão.
 * Em `reuniao_realizada`, só conta para comissão SDR se `qualificacaoSdr === 'qualificada'` ou se o campo não existir (legado).
 */
export function contaParaComissao(
  r: Pick<RegistroRow, 'invalidoComissao' | 'tipo' | 'qualificacaoSdr'>
): boolean {
  if (r.invalidoComissao === true) return false
  if (r.tipo !== 'reuniao_realizada') return true
  const q = r.qualificacaoSdr
  if (q == null) return true
  if (q === 'pendente' || q === 'nao_qualificada') return false
  return true
}

const TIPOS = new Set([
  'reuniao_agendada',
  'reuniao_realizada',
  'reuniao_closer',
  'reuniao_no_show',
  'venda'
])

export function podeMarcarInvalidoComissao(tipo: string): boolean {
  return TIPOS.has(tipo)
}
