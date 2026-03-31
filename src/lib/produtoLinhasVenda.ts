import {
  produtoPacotePorMeses,
  type LinhaNegociacaoRow,
  type ProdutoBlocoCondicaoComercial,
  type ProdutoRow
} from '../firebase/firestore'

/** As 4 “linhas” vêm dos blocos do produto (cadastro em Produtos), por período 3 ou 6 meses. */
export const LINHA_PRODUTO_TIPOS = ['preco_tabela', 'oferta', 'ultima_condicao', 'carta_na_manga'] as const
export type LinhaProdutoTipo = (typeof LINHA_PRODUTO_TIPOS)[number]

export type PeriodoContratoMeses = 3 | 6

export const LINHA_PRODUTO_LABEL: Record<LinhaProdutoTipo, string> = {
  preco_tabela: 'Preço de tabela',
  oferta: 'Oferta promocional',
  ultima_condicao: 'Última condição',
  carta_na_manga: 'Carta na manga'
}

/** Mesma ideia que a antiga `LinhaNegociacaoRow`, para cálculo de desconto e UI. */
export interface LinhaVendaComparable {
  id: string
  tipo: LinhaProdutoTipo
  periodoMeses: PeriodoContratoMeses
  produtoId: string
  valorTotal: number
  parcelas: number
  valorAVista: number | null
  rotulo: string
  linhaPrecoRole: 'ideal' | 'desconto'
  linkPagamento: string | null
  bonus: string | null
  /** Só na linha preço de tabela */
  textoSelo: string | null
  /** Ofertas com desconto / carta na manga com risco */
  tagExibicao: 'desconto' | 'risco_alto' | null
}

/** ID canônico: `prodId::3m::preco_tabela` ou `prodId::6m::oferta`. */
export function linhaVirtualId(
  produtoId: string,
  tipo: LinhaProdutoTipo,
  periodoMeses: PeriodoContratoMeses = 3
): string {
  return `${produtoId}::${periodoMeses}m::${tipo}`
}

/** Formato legado: `prodId::preco_tabela` (equivale a 3 meses). */
export function linhaVirtualIdLegado(produtoId: string, tipo: LinhaProdutoTipo): string {
  return `${produtoId}::${tipo}`
}

export function parseLinhaVirtualId(
  id: string
): { produtoId: string; tipo: LinhaProdutoTipo; periodoMeses: PeriodoContratoMeses } | null {
  const parts = id.split('::')
  if (parts.length === 2) {
    const tipo = parts[1] as LinhaProdutoTipo
    if (!LINHA_PRODUTO_TIPOS.includes(tipo)) return null
    return { produtoId: parts[0], tipo, periodoMeses: 3 }
  }
  if (parts.length === 3) {
    const mes = parts[1]
    if (mes !== '3m' && mes !== '6m') return null
    const tipo = parts[2] as LinhaProdutoTipo
    if (!LINHA_PRODUTO_TIPOS.includes(tipo)) return null
    return { produtoId: parts[0], tipo, periodoMeses: mes === '6m' ? 6 : 3 }
  }
  return null
}

function lineFromTabela(p: ProdutoRow, periodoMeses: PeriodoContratoMeses): LinhaVendaComparable {
  const b = produtoPacotePorMeses(p, periodoMeses).blocoPrecoTabela
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
    id: linhaVirtualId(p.id, 'preco_tabela', periodoMeses),
    tipo: 'preco_tabela',
    periodoMeses,
    produtoId: p.id,
    valorTotal: vt,
    parcelas: parc,
    valorAVista,
    rotulo: LINHA_PRODUTO_LABEL.preco_tabela,
    linhaPrecoRole: 'ideal',
    linkPagamento: b.linkPagamento,
    bonus: null,
    textoSelo: b.textoSelo?.trim() ? b.textoSelo.trim() : null,
    tagExibicao: null
  }
}

function lineFromCondicao(
  p: ProdutoRow,
  tipo: Exclude<LinhaProdutoTipo, 'preco_tabela'>,
  bloco: ProdutoBlocoCondicaoComercial,
  periodoMeses: PeriodoContratoMeses
): LinhaVendaComparable {
  const valorAVista = bloco.valorAVista != null && bloco.valorAVista > 0 ? bloco.valorAVista : null
  const valorParc =
    bloco.valorParceladoCartao != null && bloco.valorParceladoCartao > 0 ? bloco.valorParceladoCartao : null
  const parcelas = bloco.parcelasCartao != null && bloco.parcelasCartao > 0 ? Math.floor(bloco.parcelasCartao) : 1
  const valorTotal = valorParc ?? valorAVista ?? 0
  const parc = valorParc != null ? parcelas : 1
  const tag = bloco.tagExibicao === 'risco_alto' ? 'risco_alto' : bloco.tagExibicao === 'desconto' ? 'desconto' : null
  return {
    id: linhaVirtualId(p.id, tipo, periodoMeses),
    tipo,
    periodoMeses,
    produtoId: p.id,
    valorTotal,
    parcelas: parc,
    valorAVista,
    rotulo: LINHA_PRODUTO_LABEL[tipo],
    linhaPrecoRole: 'desconto',
    linkPagamento: bloco.linkPagamento,
    bonus: bloco.bonus,
    textoSelo: null,
    tagExibicao: tag
  }
}

/** Quatro linhas do produto para o período escolhido. */
export function linhasVendaDeProduto(p: ProdutoRow, periodoMeses: PeriodoContratoMeses = 3): LinhaVendaComparable[] {
  const pac = produtoPacotePorMeses(p, periodoMeses)
  return [
    lineFromTabela(p, periodoMeses),
    lineFromCondicao(p, 'oferta', pac.blocoOferta, periodoMeses),
    lineFromCondicao(p, 'ultima_condicao', pac.blocoUltimaCondicao, periodoMeses),
    lineFromCondicao(p, 'carta_na_manga', pac.blocoCartaNaManga, periodoMeses)
  ]
}

export function todasLinhasVendaDoProduto(p: ProdutoRow): LinhaVendaComparable[] {
  return [...linhasVendaDeProduto(p, 3), ...linhasVendaDeProduto(p, 6)]
}

export function legacyLinhaToComparable(l: LinhaNegociacaoRow): LinhaVendaComparable {
  return {
    id: l.id,
    tipo: 'oferta',
    periodoMeses: 3,
    produtoId: l.produtoId,
    valorTotal: l.valorTotal,
    parcelas: l.parcelas,
    valorAVista: l.valorAVista,
    rotulo: l.rotulo?.trim() || 'Linha antiga',
    linhaPrecoRole: l.linhaPrecoRole,
    linkPagamento: l.linkCartao,
    bonus: l.possibilidadeBonus,
    textoSelo: null,
    tagExibicao: null
  }
}

export function buildLinhasByIdParaVenda(
  produtos: ProdutoRow[],
  legacyLinhas: LinhaNegociacaoRow[]
): Map<string, LinhaVendaComparable> {
  const m = new Map<string, LinhaVendaComparable>()
  for (const p of produtos) {
    for (const meses of [3, 6] as const) {
      for (const l of linhasVendaDeProduto(p, meses)) {
        m.set(l.id, l)
        if (meses === 3) {
          m.set(linhaVirtualIdLegado(p.id, l.tipo), l)
        }
      }
    }
  }
  for (const l of legacyLinhas) {
    m.set(l.id, legacyLinhaToComparable(l))
  }
  return m
}

export function fmtBrlLinha(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export function resumoLinhaVenda(l: LinhaVendaComparable): string {
  const av = l.valorAVista != null && l.valorAVista > 0 ? `À vista ${fmtBrlLinha(l.valorAVista)}` : 'À vista —'
  const parc =
    l.parcelas >= 1 && l.valorTotal > 0
      ? `${fmtBrlLinha(l.valorTotal)} em ${l.parcelas}x de ${fmtBrlLinha(l.valorTotal / l.parcelas)}`
      : 'Parcelado —'
  return `${av} · ${parc}`
}

/** Texto alinhado aos anexos (à vista + Nx com total). */
export function resumoLinhaVendaPorPeriodo(l: LinhaVendaComparable): string {
  const n = l.parcelas >= 1 ? l.parcelas : 1
  const av =
    l.valorAVista != null && l.valorAVista > 0 ? `${fmtBrlLinha(l.valorAVista)} à vista` : null
  let parcStr = '—'
  if (l.valorTotal > 0 && n >= 1) {
    const parcela = l.valorTotal / n
    if (l.periodoMeses === 6) {
      parcStr = `${n}x de ${fmtBrlLinha(parcela)}/mês`
    } else {
      parcStr = `${n}x de ${fmtBrlLinha(parcela)} (${fmtBrlLinha(l.valorTotal)})`
    }
  }
  if (av) return `${av} · ${parcStr}`
  if (l.valorTotal > 0) return parcStr
  return '—'
}

export function pctAbaixoDaTabelaIdeal(tabela: LinhaVendaComparable, linha: LinhaVendaComparable): number | null {
  if (tabela.valorTotal <= 0 || linha.valorTotal < 0) return null
  if (linha.valorTotal >= tabela.valorTotal) return null
  return Math.round(100 * (1 - linha.valorTotal / tabela.valorTotal))
}

export function labelPeriodoMeses(m: PeriodoContratoMeses): string {
  return m === 3 ? '3 meses' : '6 meses'
}

export function labelLinhaVendaSelect(l: LinhaVendaComparable): string {
  const periodo = `${labelPeriodoMeses(l.periodoMeses)} · `
  const tipo =
    l.linhaPrecoRole === 'ideal' ? ' (referência / ideal)' : ' (com desconto vs tabela)'
  return `${periodo}${l.rotulo}${tipo} — ${resumoLinhaVenda(l)}`
}

/** Rótulo sem repetir o período quando o `<select>` usa `<optgroup>` por contrato. */
export function labelLinhaOfertaNoGrupo(l: LinhaVendaComparable): string {
  const tipo =
    l.linhaPrecoRole === 'ideal' ? ' (referência / ideal)' : ' (com desconto vs tabela)'
  return `${l.rotulo}${tipo} — ${resumoLinhaVenda(l)}`
}

/** Opções do select: 4 linhas × 2 períodos + legado se a seleção atual for ID antigo. */
export function opcoesLinhaDropdown(
  produto: ProdutoRow | undefined,
  selectedLinhaId: string,
  legacyLinhas: LinhaNegociacaoRow[]
): LinhaVendaComparable[] {
  if (!produto) return []
  const base = todasLinhasVendaDoProduto(produto)
  const ids = new Set(base.map((b) => b.id))
  const legId = linhaVirtualIdLegado(produto.id, 'preco_tabela')
  ids.add(legId)
  if (selectedLinhaId && !ids.has(selectedLinhaId)) {
    const leg = legacyLinhas.find((l) => l.id === selectedLinhaId && l.produtoId === produto.id)
    if (leg) return [...base, legacyLinhaToComparable(leg)]
  }
  return base
}
