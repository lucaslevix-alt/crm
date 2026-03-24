import type { LinhaNegociacaoRow, RegistroProdutoItem } from '../firebase/firestore'

/** Uma linha “ideal” por produto (a primeira encontrada, se houver duplicata no Firestore) */
export function idealLinePorProduto(linhas: LinhaNegociacaoRow[]): Map<string, LinhaNegociacaoRow> {
  const m = new Map<string, LinhaNegociacaoRow>()
  for (const l of linhas) {
    if (l.linhaPrecoRole !== 'ideal') continue
    if (!m.has(l.produtoId)) m.set(l.produtoId, l)
  }
  return m
}

/** Com forma “À vista” na venda compara `valorAVista` das linhas; caso contrário compara o total parcelado (`valorTotal`). */
export function vendaUsaPrecoAvista(formaPagamento: string | null | undefined): boolean {
  return formaPagamento === 'a_vista'
}

/**
 * Valor usado na comparação ideal vs linha fechada.
 * Se à vista e não houver `valorAVista` cadastrado, usa `valorTotal` (linhas antigas).
 */
export function valorComparavelLinha(l: LinhaNegociacaoRow, compararAvista: boolean): number {
  if (compararAvista) {
    if (l.valorAVista != null && l.valorAVista > 0) return l.valorAVista
    return l.valorTotal
  }
  return l.valorTotal
}

/**
 * Desconto = soma (valor ideal no mesmo modelo de pagamento − valor fechado) × qtd,
 * quando a linha fechada não é a ideal. Modelo = à vista vs parcelado conforme `formaPagamento` da venda.
 */
export function computeDescontoVenda(params: {
  produtosDetalhes: RegistroProdutoItem[]
  linhasById: Map<string, LinhaNegociacaoRow>
  idealPorProduto: Map<string, LinhaNegociacaoRow>
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
    valorReferencia += vi * q
    if (fechada.id === ideal.id) continue
    desconto += Math.max(0, vi - vf) * q
  }
  return { valorReferencia, desconto }
}
