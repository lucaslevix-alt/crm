import { useCallback, useEffect, useState } from 'react'
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

/** Resumo textual das parcelas no card lateral (único Nx ou faixa se produtos diferirem). */
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

export function NegociacoesPage() {
  const [produtos, setProdutos] = useState<ProdutoRow[]>([])
  const [linhas, setLinhas] = useState<LinhaNegociacao[]>([])
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
          <h2 className="neg-title">🤝 Negociações</h2>
          <p className="neg-subtitle">Selecione os produtos e apresente as opções de pagamento ao cliente</p>
        </div>
        <button
          type="button"
          className="btn btn-primary neg-btn-add"
          onClick={() => addLinha()}
          disabled={loading || !produtos.length}
        >
          <span className="neg-btn-icon">+</span>
          Adicionar produto
        </button>
      </div>

      {error && (
        <div className="neg-error">
          <span className="neg-error-icon">⚠️</span>
          <p>{error}</p>
        </div>
      )}

      {!loading && !produtos.length && !error && (
        <div className="neg-empty">
          <div className="neg-empty-icon">📦</div>
          <h3 className="neg-empty-title">Nenhum produto cadastrado</h3>
          <p className="neg-empty-text">
            Cadastre produtos no menu <strong>Produtos</strong> para negociar valores com seus clientes.
          </p>
        </div>
      )}

      {!loading && produtos.length > 0 && (
        <div className="neg-layout">
          <div className="neg-main">
            <div className="neg-section">
              <h3 className="neg-section-title">Produtos disponíveis</h3>
              <p className="neg-section-hint">Clique em um produto para adicionar à negociação</p>
              <div className="neg-produtos-grid">
                {produtos.map((p) => {
                  const parcCartao = valorParcela(p.valorCartao, p.parcelasCartao)
                  const parcBoleto = valorParcela(p.valorBoleto, p.parcelasBoleto)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="neg-produto-card"
                      onClick={() => addLinha(p.id)}
                    >
                      <div className="neg-produto-nome">{p.nome}</div>
                      <div className="neg-produto-precos">
                        <div className="neg-preco-item">
                          <span className="neg-preco-label">💵 À vista</span>
                          <span className="neg-preco-valor neg-preco-avista">{fmt(p.aVista)}</span>
                        </div>
                        <div className="neg-preco-item">
                          <span className="neg-preco-label">💳 Cartão</span>
                          {(p.parcelasCartao ?? 0) > 0 ? (
                            <>
                              <span className="neg-preco-row">
                                <span className="neg-preco-valor">{fmt(parcCartao)}</span>
                                <span className="neg-preco-parcela">
                                  {p.parcelasCartao}x <em>s/ juros</em>
                                </span>
                              </span>
                              <span className="neg-preco-total">Total: {fmt(p.valorCartao)}</span>
                            </>
                          ) : (
                            <span className="neg-preco-valor">{fmt(p.valorCartao)}</span>
                          )}
                        </div>
                        <div className="neg-preco-item">
                          <span className="neg-preco-label">📄 Boleto</span>
                          {(p.parcelasBoleto ?? 0) > 0 ? (
                            <>
                              <span className="neg-preco-row">
                                <span className="neg-preco-valor">{fmt(parcBoleto)}</span>
                                <span className="neg-preco-parcela">{p.parcelasBoleto}x</span>
                              </span>
                              <span className="neg-preco-total">Total: {fmt(p.valorBoleto)}</span>
                            </>
                          ) : (
                            <span className="neg-preco-valor">{fmt(p.valorBoleto)}</span>
                          )}
                        </div>
                      </div>
                      <span className="neg-produto-add">+ Adicionar</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="neg-section">
              <div className="neg-section-header">
                <h3 className="neg-section-title">Sua negociação</h3>
                <span className="neg-badge-juros">💳 Parcelas no cartão sem juros</span>
              </div>
              {linhas.length === 0 ? (
                <div className="neg-empty-linhas">
                  <div className="neg-empty-linhas-icon">🛒</div>
                  <p>Nenhum produto na negociação</p>
                  <p className="neg-empty-linhas-hint">Clique em um produto acima ou em <strong>Adicionar produto</strong></p>
                </div>
              ) : (
                <div className="neg-linhas">
                  {linhas.map((l) => {
                    const p = produtos.find((x) => x.id === l.produtoId)
                    if (!p) {
                      return (
                        <div key={l.uid} className="neg-linha neg-linha-invalida">
                          <select
                            value={l.produtoId}
                            onChange={(e) => updateLinha(l.uid, 'produtoId', e.target.value)}
                            className="neg-select"
                          >
                            <option value="">Selecione um produto</option>
                            {produtos.map((pr) => (
                              <option key={pr.id} value={pr.id}>
                                {pr.nome}
                              </option>
                            ))}
                          </select>
                          <button type="button" className="neg-btn-remove" onClick={() => removeLinha(l.uid)} title="Remover">
                            ✕
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
                      <div key={l.uid} className="neg-linha">
                        <div className="neg-linha-produto">
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
                          <div className="neg-linha-qtd">
                            <button
                              type="button"
                              className="neg-qtd-btn"
                              onClick={() => updateLinha(l.uid, 'quantidade', Math.max(1, l.quantidade - 1))}
                              disabled={l.quantidade <= 1}
                            >
                              −
                            </button>
                            <span className="neg-qtd-valor">{l.quantidade}</span>
                            <button
                              type="button"
                              className="neg-qtd-btn"
                              onClick={() => updateLinha(l.uid, 'quantidade', l.quantidade + 1)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="neg-linha-valores">
                          <div className="neg-linha-val">
                            <span className="neg-linha-val-label">À vista</span>
                            <span className="neg-linha-val-num neg-linha-val-avista">{fmt(av)}</span>
                          </div>
                          <div className="neg-linha-val">
                            <span className="neg-linha-val-label">Cartão</span>
                            <span className="neg-linha-val-destaque">
                              <span className="neg-linha-val-num">{fmt(linhaParcCartao)}</span>
                              <span className="neg-linha-val-parc">/parc</span>
                            </span>
                            <span className="neg-linha-val-total">Total: {fmt(vCartao)}</span>
                          </div>
                          <div className="neg-linha-val">
                            <span className="neg-linha-val-label">Boleto</span>
                            <span className="neg-linha-val-destaque">
                              <span className="neg-linha-val-num">{fmt(linhaParcBoleto)}</span>
                              <span className="neg-linha-val-parc">/parc</span>
                            </span>
                            <span className="neg-linha-val-total">Total: {fmt(vBoleto)}</span>
                          </div>
                        </div>
                        <button type="button" className="neg-btn-remove" onClick={() => removeLinha(l.uid)} title="Remover">
                          ✕
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {linhasComDetalhes.length > 0 && (
            <aside className="neg-resumo">
              <div className="neg-resumo-card">
                <h3 className="neg-resumo-title">Resumo</h3>
                <div className="neg-resumo-linhas">
                  <div className="neg-resumo-item neg-resumo-avista">
                    <span className="neg-resumo-label">💵 À vista</span>
                    <span className="neg-resumo-valor">{fmt(totalAVista)}</span>
                  </div>
                  <div className="neg-resumo-item">
                    <span className="neg-resumo-label">💳 Cartão</span>
                    {resumoParcelasCartaoTxt ? (
                      <span className="neg-resumo-parcelas-qtd">Parcelas: {resumoParcelasCartaoTxt}</span>
                    ) : (
                      <span className="neg-resumo-parcelas-qtd neg-resumo-parcelas-qtd--muted">Parcelas: —</span>
                    )}
                    <span className="neg-resumo-destaque">
                      <span className="neg-resumo-valor">{fmt(totalParcelaCartao)}</span>
                      <span className="neg-resumo-parc">/parc</span>
                    </span>
                    <span className="neg-resumo-total">Total: {fmt(totalValorCartao)}</span>
                  </div>
                  <div className="neg-resumo-item">
                    <span className="neg-resumo-label">📄 Boleto</span>
                    {resumoParcelasBoletoTxt ? (
                      <span className="neg-resumo-parcelas-qtd">Parcelas: {resumoParcelasBoletoTxt}</span>
                    ) : (
                      <span className="neg-resumo-parcelas-qtd neg-resumo-parcelas-qtd--muted">Parcelas: —</span>
                    )}
                    <span className="neg-resumo-destaque">
                      <span className="neg-resumo-valor">{fmt(totalParcelaBoleto)}</span>
                      <span className="neg-resumo-parc">/parc</span>
                    </span>
                    <span className="neg-resumo-total">Total: {fmt(totalValorBoleto)}</span>
                  </div>
                </div>
                <div className="neg-resumo-footer">
                  <span>Use estes valores para apresentar ao cliente</span>
                </div>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  )
}
