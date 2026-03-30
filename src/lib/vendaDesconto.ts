import type { RegistroProdutoItem } from '../firebase/firestore'
import type { LinhaVendaComparable } from './produtoLinhasVenda'

/** Com forma “À vista” na venda compara `valorAVista` das linhas; caso contrário compara o total parcelado (`valorTotal`). */
export function vendaUsaPrecoAvista(formaPagamento: string | null | undefined): boolean {
  return formaPagamento === 'a_vista'
}

export function valorComparavelLinha(l: LinhaVendaComparable, compararAvista: boolean): number {
  if (compararAvista) {
    if (l.valorAVista != null && l.valorAVista > 0) return l.valorAVista
    return l.valorTotal
  }
  return l.valorTotal
}

/**
 * Desconto = soma (valor ideal no mesmo modelo de pagamento − valor fechado) × qtd,
 * quando a linha fechada não é a ideal. Referência ideal = sempre **Preço de tabela** do produto.
 */
export function computeDescontoVenda(params: {
  produtosDetalhes: RegistroProdutoItem[]
  linhasById: Map<string, LinhaVendaComparable>
  idealPorProduto: Map<string, LinhaVendaComparable>
  formaPagamento: string | null
}): { valorReferencia: number; desconto: number } {
  const compararAvista = vendaUsaPrecoAvista(params.formaPagamento)
  let valorReferencia = 0
  let desconto = 0
  for (const item of params.produtosDetalhes) {
    if (!item.produtoId || !item.linhaNegociacaoId) continue
    const fechada = params.linhasById.get(item.linhaNegociacaoId)
    const ideal = params.idealPorProduto.get(item.produtoId)
    if (!fechada || !ideal || fechada.produtoId !== item.produtoId) continue
    const q = Math.max(1, item.quantidade || 1)
    const vi = valorComparavelLinha(ideal, compararAvista)
    const vf = valorComparavelLinha(fechada, compararAvista)
    if (vi <= 0 && vf <= 0) continue
    valorReferencia += vi * q
    if (fechada.id === ideal.id) continue
    desconto += Math.max(0, vi - vf) * q
  }
  return { valorReferencia, desconto }
}
