import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Banknote,
  ChevronLeft,
  CreditCard,
  FileText,
  Handshake,
  Package,
  Plus,
  ShoppingCart,
  X
} from 'lucide-react'
import { getProdutos, type ProdutoRow } from '../firebase/firestore'

interface LinhaNegociacao {
  uid: string
  produtoId: string
  quantidade: number
}

function fmt(v: number | null): string {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function valorParcela(valor: number | null, parcelas: number | null): number | null {
  if (valor == null || parcelas == null || parcelas <= 0) return null
  return valor / parcelas
}

function textoParcelasNegocio(
  linhas: Array<{ produto: ProdutoRow }>,
  modo: 'cartao' | 'boleto'
): string | null {
  const pk = modo === 'cartao' ? 'parcelasCartao' : 'parcelasBoleto'
  const vk = modo === 'cartao' ? 'valorCartao' : 'valorBoleto'
  const vals = linhas
    .filter((l) => (l.produto[pk] ?? 0) > 0 && (l.produto[vk] ?? 0) > 0)
    .map((l) => l.produto[pk] as number)
  if (!vals.length) return null
  const sorted = [...new Set(vals)].sort((a, b) => a - b)
  const suffix = modo === 'cartao' ? ' sem juros' : ''
  if (sorted.length === 1) return `${sorted[0]}x${suffix}`
  return `${sorted[0]}x a ${sorted[sorted.length - 1]}x${suffix}`
}

function CatalogCartaoCell({ p, parcCartao }: { p: ProdutoRow; parcCartao: number | null }) {
  const n = p.parcelasCartao ?? 0
  if (n > 0 && parcCartao != null) {
    return (
      <div className="neg-td-stack">
        <span className="neg-num">{fmt(parcCartao)}</span>
        <span className="neg-cell-meta">{n}x sem juros</span>
        <span className="neg-cell-meta neg-cell-meta--muted">Total {fmt(p.valorCartao)}</span>
      </div>
    )
  }
  return <span className="neg-num">{fmt(p.valorCartao)}</span>
}

function CatalogBoletoCell({ p, parcBoleto }: { p: ProdutoRow; parcBoleto: number | null }) {
  const n = p.parcelasBoleto ?? 0
  if (n > 0 && parcBoleto != null) {
    return (
      <div className="neg-td-stack">
        <span className="neg-num">{fmt(parcBoleto)}</span>
        <span className="neg-cell-meta">{n}x</span>
        <span className="neg-cell-meta neg-cell-meta--muted">Total {fmt(p.valorBoleto)}</span>
      </div>
    )
  }
  return <span className="neg-num">{fmt(p.valorBoleto)}</span>
}

type PainelNegView = 'catalogo' | 'carrinho'

export function NegociacoesPage() {
  const [produtos, setProdutos] = useState<ProdutoRow[]>([])
  const [linhas, setLinhas] = useState<LinhaNegociacao[]>([])
  const [painel, setPainel] = useState<PainelNegView>('catalogo')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProdutos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await getProdutos()
      setProdutos(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
      setProdutos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProdutos()
  }, [loadProdutos])

  useEffect(() => {
    if (painel === 'carrinho' && linhas.length === 0) {
      setPainel('catalogo')
    }
  }, [painel, linhas.length])

  function addLinha(produtoId?: string) {
    setLinhas((current) => [
      ...current,
      { uid: `${Date.now()}-${Math.random()}`, produtoId: produtoId ?? produtos[0]?.id ?? '', quantidade: 1 }
    ])
  }

  function updateLinha(uid: string, key: 'produtoId' | 'quantidade', value: string | number) {
    setLinhas((current) =>
      current.map((l) =>
        l.uid === uid
          ? {
              ...l,
              [key]: key === 'quantidade' ? (typeof value === 'number' ? value : Math.max(1, parseInt(String(value), 10) || 1)) : value
            }
          : l
      )
    )
  }

  function removeLinha(uid: string) {
    setLinhas((current) => current.filter((l) => l.uid !== uid))
  }

  const linhasComDetalhes = linhas
    .map((l) => {
      const p = produtos.find((x) => x.id === l.produtoId)
      return p ? { ...l, produto: p } : null
    })
    .filter((x): x is NonNullable<typeof x> => x != null)

  const totalValorCartao = linhasComDetalhes.reduce((s, l) => s + (l.produto.valorCartao ?? 0) * l.quantidade, 0)
  const totalValorBoleto = linhasComDetalhes.reduce((s, l) => s + (l.produto.valorBoleto ?? 0) * l.quantidade, 0)
  const totalParcelaCartao = linhasComDetalhes.reduce((s, l) => {
    const vp = valorParcela(l.produto.valorCartao, l.produto.parcelasCartao)
    return s + (vp ?? 0) * l.quantidade
  }, 0)
  const totalParcelaBoleto = linhasComDetalhes.reduce((s, l) => {
    const vp = valorParcela(l.produto.valorBoleto, l.produto.parcelasBoleto)
    return s + (vp ?? 0) * l.quantidade
  }, 0)
  const totalAVista = linhasComDetalhes.reduce((s, l) => s + (l.produto.aVista ?? 0) * l.quantidade, 0)

  const resumoParcelasCartaoTxt = textoParcelasNegocio(linhasComDetalhes, 'cartao')
  const resumoParcelasBoletoTxt = textoParcelasNegocio(linhasComDetalhes, 'boleto')

  return (
    <div className="content">
      <div className="neg-header">
        <div className="neg-header-text">
          <h2 className="page-title-row neg-page-title">
            <Handshake size={22} strokeWidth={1.5} aria-hidden />
            Negociações
          </h2>
          <p className="neg-subtitle">
            {painel === 'catalogo'
              ? 'Inclua produtos no catálogo e abra o carrinho para montar a negociação com o cliente'
              : 'Quantidades e condições de pagamento por linha · totais abaixo'}
          </p>
        </div>
        <div className="neg-header-actions">
          {painel === 'catalogo' ? (
            <>
              <button
                type="button"
                className="btn btn-primary neg-btn-add"
                onClick={() => addLinha()}
                disabled={loading || !produtos.length}
              >
                <Plus size={17} strokeWidth={2} aria-hidden />
                Adicionar item
              </button>
              <button
                type="button"
                className="btn btn-ghost neg-cart-open"
                disabled={linhas.length === 0}
                onClick={() => setPainel('carrinho')}
                title={linhas.length === 0 ? 'Inclua ao menos um produto' : 'Ver negociação'}
              >
                <ShoppingCart size={18} strokeWidth={1.65} aria-hidden />
                Carrinho
                {linhas.length > 0 ? <span className="neg-cart-badge">{linhas.length}</span> : null}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-ghost neg-back-catalog" onClick={() => setPainel('catalogo')}>
                <ChevronLeft size={20} strokeWidth={1.75} aria-hidden />
                Catálogo
              </button>
              <button
                type="button"
                className="btn btn-primary neg-btn-add"
                onClick={() => setPainel('catalogo')}
                disabled={loading || !produtos.length}
              >
                <Plus size={17} strokeWidth={2} aria-hidden />
                Adicionar mais
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="neg-error">
          <span className="neg-error-icon" aria-hidden>
            <AlertTriangle size={20} strokeWidth={1.5} />
          </span>
          <p>{error}</p>
        </div>
      )}

      {!loading && !produtos.length && !error && (
        <div className="neg-empty card">
          <div className="neg-empty-icon" aria-hidden>
            <Package size={44} strokeWidth={1.25} />
          </div>
          <h3 className="neg-empty-title">Nenhum produto cadastrado</h3>
          <p className="neg-empty-text">
            Cadastre produtos em <strong>Produtos</strong> para usar aqui.
          </p>
        </div>
      )}

      {!loading && produtos.length > 0 && (
        <div className="neg-layout">
          {painel === 'catalogo' && (
            <section className="card neg-card">
              <div className="neg-card-head">
                <h3 className="card-title">Catálogo</h3>
                <p className="neg-card-desc">Preços unitários · use + para incluir · depois abra o carrinho para negociar</p>
              </div>
              <div className="neg-table-scroll">
                <table className="neg-table">
                  <thead>
                    <tr>
                      <th scope="col">Produto</th>
                      <th scope="col">À vista</th>
                      <th scope="col">Cartão</th>
                      <th scope="col">Boleto</th>
                      <th scope="col" className="neg-th-action" title="Incluir na negociação">
                        +
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtos.map((p) => {
                      const parcCartao = valorParcela(p.valorCartao, p.parcelasCartao)
                      const parcBoleto = valorParcela(p.valorBoleto, p.parcelasBoleto)
                      return (
                        <tr key={p.id}>
                          <td data-label="Produto" className="neg-td-prod">
                            {p.nome}
                          </td>
                          <td data-label="À vista">
                            <span className="neg-num">{fmt(p.aVista)}</span>
                          </td>
                          <td data-label="Cartão">
                            <CatalogCartaoCell p={p} parcCartao={parcCartao} />
                          </td>
                          <td data-label="Boleto">
                            <CatalogBoletoCell p={p} parcBoleto={parcBoleto} />
                          </td>
                          <td className="neg-td-action" data-label="">
                            <button
                              type="button"
                              className="neg-add-btn"
                              onClick={() => addLinha(p.id)}
                              aria-label={`Incluir ${p.nome}`}
                            >
                              <Plus size={18} strokeWidth={2} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {painel === 'carrinho' && (
            <div className="neg-carrinho-view">
              <div className="neg-main">
                <section className="card neg-card neg-card--carrinho-itens">
                  <div className="neg-card-head neg-card-head--row">
                    <div>
                      <h3 className="card-title">Carrinho · negociação</h3>
                      <p className="neg-card-desc">Somente os itens selecionados · ajuste quantidades e apresente ao cliente</p>
                    </div>
                    <span className="neg-pill">
                      <CreditCard size={13} strokeWidth={1.75} aria-hidden />
                      Cartão sem juros (cadastro)
                    </span>
                  </div>
                  <div className="neg-items">
                    {linhas.map((l) => {
                      const p = produtos.find((x) => x.id === l.produtoId)
                      if (!p) {
                        return (
                          <div key={l.uid} className="neg-item neg-item--warn">
                            <select
                              value={l.produtoId}
                              onChange={(e) => updateLinha(l.uid, 'produtoId', e.target.value)}
                              className="neg-select neg-select-produto"
                            >
                              <option value="">Selecione o produto</option>
                              {produtos.map((pr) => (
                                <option key={pr.id} value={pr.id}>
                                  {pr.nome}
                                </option>
                              ))}
                            </select>
                            <button type="button" className="neg-btn-remove" onClick={() => removeLinha(l.uid)} title="Remover" aria-label="Remover">
                              <X size={17} strokeWidth={1.5} />
                            </button>
                          </div>
                        )
                      }
                      const vCartao = (p.valorCartao ?? 0) * l.quantidade
                      const parcCartao = valorParcela(p.valorCartao, p.parcelasCartao)
                      const linhaParcCartao = (parcCartao ?? 0) * l.quantidade
                      const vBoleto = (p.valorBoleto ?? 0) * l.quantidade
                      const parcBoleto = valorParcela(p.valorBoleto, p.parcelasBoleto)
                      const linhaParcBoleto = (parcBoleto ?? 0) * l.quantidade
                      const av = (p.aVista ?? 0) * l.quantidade
                      return (
                        <div key={l.uid} className="neg-item">
                          <div className="neg-item-toolbar">
                            <select
                              value={l.produtoId}
                              onChange={(e) => updateLinha(l.uid, 'produtoId', e.target.value)}
                              className="neg-select neg-select-produto"
                            >
                              {produtos.map((pr) => (
                                <option key={pr.id} value={pr.id}>
                                  {pr.nome}
                                </option>
                              ))}
                            </select>
                            <div className="neg-linha-qtd" aria-label="Quantidade">
                              <button
                                type="button"
                                className="neg-qtd-btn"
                                onClick={() => updateLinha(l.uid, 'quantidade', Math.max(1, l.quantidade - 1))}
                                disabled={l.quantidade <= 1}
                              >
                                −
                              </button>
                              <span className="neg-qtd-valor">{l.quantidade}</span>
                              <button type="button" className="neg-qtd-btn" onClick={() => updateLinha(l.uid, 'quantidade', l.quantidade + 1)}>
                                +
                              </button>
                            </div>
                            <button type="button" className="neg-btn-remove" onClick={() => removeLinha(l.uid)} title="Remover" aria-label="Remover linha">
                              <X size={17} strokeWidth={1.5} />
                            </button>
                          </div>
                          <div className="neg-pay-grid">
                            <div className="neg-pay-cell">
                              <span className="neg-pay-label">À vista</span>
                              <span className="neg-num neg-num--emph">{fmt(av)}</span>
                              <span className="neg-pay-foot">total da linha</span>
                            </div>
                            <div className="neg-pay-cell">
                              <span className="neg-pay-label">Cartão</span>
                              <span className="neg-num neg-num--emph">{fmt(linhaParcCartao)}</span>
                              <span className="neg-pay-foot">parcela · total {fmt(vCartao)}</span>
                            </div>
                            <div className="neg-pay-cell">
                              <span className="neg-pay-label">Boleto</span>
                              <span className="neg-num neg-num--emph">{fmt(linhaParcBoleto)}</span>
                              <span className="neg-pay-foot">parcela · total {fmt(vBoleto)}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              </div>

              {linhasComDetalhes.length > 0 && (
                <section className="card neg-totals neg-totals--destaque" aria-label="Totais da negociação">
                  <h3 className="card-title neg-totals-title">Totais</h3>
                  <p className="neg-totals-desc">Valores somados de todos os itens</p>
                  <div className="neg-totals-grid">
                    <div className="neg-total-block">
                      <span className="neg-total-label">
                        <Banknote size={14} strokeWidth={1.5} aria-hidden />
                        À vista
                      </span>
                      <span className="neg-num neg-num--total">{fmt(totalAVista)}</span>
                    </div>
                    <div className="neg-total-block">
                      <span className="neg-total-label">
                        <CreditCard size={14} strokeWidth={1.5} aria-hidden />
                        Cartão
                      </span>
                      <span className="neg-total-meta">{resumoParcelasCartaoTxt ?? '—'}</span>
                      <span className="neg-num neg-num--total-sm">{fmt(totalParcelaCartao)}</span>
                      <span className="neg-total-sub">por parcela</span>
                      <span className="neg-total-foot neg-num">{fmt(totalValorCartao)}</span>
                      <span className="neg-total-sub">total geral</span>
                    </div>
                    <div className="neg-total-block">
                      <span className="neg-total-label">
                        <FileText size={14} strokeWidth={1.5} aria-hidden />
                        Boleto
                      </span>
                      <span className="neg-total-meta">{resumoParcelasBoletoTxt ?? '—'}</span>
                      <span className="neg-num neg-num--total-sm">{fmt(totalParcelaBoleto)}</span>
                      <span className="neg-total-sub">por parcela</span>
                      <span className="neg-total-foot neg-num">{fmt(totalValorBoleto)}</span>
                      <span className="neg-total-sub">total geral</span>
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
