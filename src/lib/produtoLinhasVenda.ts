import type { LinhaNegociacaoRow, ProdutoBlocoCondicaoComercial, ProdutoRow } from '../firebase/firestore'

/** As 4 “linhas” vêm só dos blocos do produto (cadastro em Produtos). */
export const LINHA_PRODUTO_TIPOS = ['preco_tabela', 'oferta', 'ultima_condicao', 'carta_na_manga'] as const
export type LinhaProdutoTipo = (typeof LINHA_PRODUTO_TIPOS)[number]

export const LINHA_PRODUTO_LABEL: Record<LinhaProdutoTipo, string> = {
  preco_tabela: 'Preço de tabela',
  oferta: 'Oferta promocional',
  ultima_condicao: 'Última condição',
  carta_na_manga: 'Carta na manga'
}

/** Mesma ideia que a antiga `LinhaNegociacaoRow`, para cálculo de desconto e UI. */
export interface LinhaVendaComparable {
  id: string
  produtoId: string
  valorTotal: number
  parcelas: number
  valorAVista: number | null
  rotulo: string
  linhaPrecoRole: 'ideal' | 'desconto'
  linkPagamento: string | null
  bonus: string | null
}

export function linhaVirtualId(produtoId: string, tipo: LinhaProdutoTipo): string {
  return `${produtoId}::${tipo}`
}

export function parseLinhaVirtualId(id: string): { produtoId: string; tipo: LinhaProdutoTipo } | null {
  const i = id.indexOf('::')
  if (i <= 0) return null
  const produtoId = id.slice(0, i)
  const tipo = id.slice(i + 2) as LinhaProdutoTipo
  if (!LINHA_PRODUTO_TIPOS.includes(tipo)) return null
  return { produtoId, tipo }
}

function lineFromTabela(p: ProdutoRow): LinhaVendaComparable {
  const b = p.blocoPrecoTabela
  const valorAVista = b.valorAVista != null && b.valorAVista > 0 ? b.valorAVista : null
  let valorTotal =
    b.valorParceladoCartao != null && b.valorParceladoCartao > 0
      ? b.valorParceladoCartao
      : b.valorTotal != null && b.valorTotal > 0
        ? b.valorTotal
        : null
  let parcelas = b.parcelasCartao != null && b.parcelasCartao > 0 ? Math.floor(b.parcelasCartao) : 1
  if (valorTotal == null && valorAVista != null) {
    valorTotal = valorAVista
    parcelas = 1
  }
  const vt = valorTotal ?? 0
  const parc = vt > 0 ? parcelas : 1
  return {
    id: linhaVirtualId(p.id, 'preco_tabela'),
    produtoId: p.id,
    valorTotal: vt,
    parcelas: parc,
    valorAVista,
    rotulo: LINHA_PRODUTO_LABEL.preco_tabela,
    linhaPrecoRole: 'ideal',
    linkPagamento: b.linkPagamento,
    bonus: null
  }
}

function lineFromCondicao(
  p: ProdutoRow,
  tipo: Exclude<LinhaProdutoTipo, 'preco_tabela'>,
  bloco: ProdutoBlocoCondicaoComercial
): LinhaVendaComparable {
  const valorAVista = bloco.valorAVista != null && bloco.valorAVista > 0 ? bloco.valorAVista : null
  const valorParc =
    bloco.valorParceladoCartao != null && bloco.valorParceladoCartao > 0 ? bloco.valorParceladoCartao : null
  const parcelas = bloco.parcelasCartao != null && bloco.parcelasCartao > 0 ? Math.floor(bloco.parcelasCartao) : 1
  const valorTotal = valorParc ?? valorAVista ?? 0
  const parc = valorParc != null ? parcelas : 1
  return {
    id: linhaVirtualId(p.id, tipo),
    produtoId: p.id,
    valorTotal,
    parcelas: parc,
    valorAVista,
    rotulo: LINHA_PRODUTO_LABEL[tipo],
    linhaPrecoRole: 'desconto',
    linkPagamento: bloco.linkPagamento,
    bonus: bloco.bonus
  }
}

/** Sempre 4 linhas (uma por bloco do produto). */
export function linhasVendaDeProduto(p: ProdutoRow): LinhaVendaComparable[] {
  return [
    lineFromTabela(p),
    lineFromCondicao(p, 'oferta', p.blocoOferta),
    lineFromCondicao(p, 'ultima_condicao', p.blocoUltimaCondicao),
    lineFromCondicao(p, 'carta_na_manga', p.blocoCartaNaManga)
  ]
}

export function legacyLinhaToComparable(l: LinhaNegociacaoRow): LinhaVendaComparable {
  return {
    id: l.id,
    produtoId: l.produtoId,
    valorTotal: l.valorTotal,
    parcelas: l.parcelas,
    valorAVista: l.valorAVista,
    rotulo: l.rotulo?.trim() || 'Linha antiga',
    linhaPrecoRole: l.linhaPrecoRole,
    linkPagamento: l.linkCartao,
    bonus: l.possibilidadeBonus
  }
}

export function buildLinhasByIdParaVenda(
  produtos: ProdutoRow[],
  legacyLinhas: LinhaNegociacaoRow[]
): Map<string, LinhaVendaComparable> {
  const m = new Map<string, LinhaVendaComparable>()
  for (const p of produtos) {
    for (const l of linhasVendaDeProduto(p)) {
      m.set(l.id, l)
    }
  }
  for (const l of legacyLinhas) {
    m.set(l.id, legacyLinhaToComparable(l))
  }
  return m
}

export function idealPorProdutoFromProdutos(produtos: ProdutoRow[]): Map<string, LinhaVendaComparable> {
  const m = new Map<string, LinhaVendaComparable>()
  for (const p of produtos) {
    const tabela = lineFromTabela(p)
    m.set(p.id, tabela)
  }
  return m
}

export function fmtBrlLinha(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export function resumoLinhaVenda(l: LinhaVendaComparable): string {
  const av = l.valorAVista != null && l.valorAVista > 0 ? `À vista ${fmtBrlLinha(l.valorAVista)}` : 'À vista —'
  const parc = l.parcelas >= 1 && l.valorTotal > 0
    ? `${fmtBrlLinha(l.valorTotal)} em ${l.parcelas}x de ${fmtBrlLinha(l.valorTotal / l.parcelas)}`
    : 'Parcelado —'
  return `${av} · ${parc}`
}

export function labelLinhaVendaSelect(l: LinhaVendaComparable): string {
  const tipo =
    l.linhaPrecoRole === 'ideal' ? ' (referência / ideal)' : ' (com desconto vs tabela)'
  return `${l.rotulo}${tipo} — ${resumoLinhaVenda(l)}`
}

/** Opções do select: as 4 linhas do produto +, se a seleção atual for ID legado, essa linha no fim. */
export function opcoesLinhaDropdown(
  produto: ProdutoRow | undefined,
  selectedLinhaId: string,
  legacyLinhas: LinhaNegociacaoRow[]
): LinhaVendaComparable[] {
  if (!produto) return []
  const base = linhasVendaDeProduto(produto)
  const ids = new Set(base.map((b) => b.id))
  if (selectedLinhaId && !ids.has(selectedLinhaId)) {
    const leg = legacyLinhas.find((l) => l.id === selectedLinhaId && l.produtoId === produto.id)
    if (leg) return [...base, legacyLinhaToComparable(leg)]
  }
  return base
}
