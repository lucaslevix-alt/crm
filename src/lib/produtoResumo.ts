import type { ProdutoBlocoCondicaoComercial, ProdutoBlocoPrecoTabela } from '../firebase/firestore'

export function fmtProdutoValor(v: number | null): string {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export function resumoParcelaProduto(total: number | null, parc: number | null): string {
  if (total == null || parc == null || parc <= 0) return '—'
  return `${parc}x ${fmtProdutoValor(total / parc)}`
}

export function resumoBlocoTabela(bt: ProdutoBlocoPrecoTabela): string {
  const parts: string[] = []
  if (bt.valorTotal != null && bt.valorTotal > 0) parts.push(`Tot. ${fmtProdutoValor(bt.valorTotal)}`)
  if (bt.valorAVista != null && bt.valorAVista > 0) parts.push(`À vista ${fmtProdutoValor(bt.valorAVista)}`)
  if (bt.valorParceladoCartao != null && bt.valorParceladoCartao > 0) {
    parts.push(`${resumoParcelaProduto(bt.valorParceladoCartao, bt.parcelasCartao)}`)
  }
  if (bt.linkPagamento?.trim()) parts.push('🔗')
  return parts.length ? parts.join(' · ') : '—'
}

export function resumoBlocoCondicao(bc: ProdutoBlocoCondicaoComercial): string {
  const parts: string[] = []
  if (bc.valorAVista != null && bc.valorAVista > 0) parts.push(`À vista ${fmtProdutoValor(bc.valorAVista)}`)
  if (bc.valorParceladoCartao != null && bc.valorParceladoCartao > 0) {
    parts.push(`Cartão ${resumoParcelaProduto(bc.valorParceladoCartao, bc.parcelasCartao)}`)
  }
  const b = bc.bonus?.trim()
  if (b) parts.push(b.length > 48 ? `${b.slice(0, 48)}…` : b)
  if (bc.linkPagamento?.trim()) parts.push('🔗')
  return parts.length ? parts.join(' · ') : '—'
}
