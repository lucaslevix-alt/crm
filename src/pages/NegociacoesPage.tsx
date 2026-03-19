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

  function addLinha() {
    setLinhas((current) => [
      ...current,
      { uid: `${Date.now()}-${Math.random()}`, produtoId: produtos[0]?.id ?? '', quantidade: 1 }
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

  return (
    <div className="content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>🤝 Negociações</h2>
          <p style={{ color: 'var(--text2)' }}>Selecione os produtos e negocie os valores com o cliente</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: 'auto', padding: '10px 20px' }}
          onClick={addLinha}
          disabled={loading || !produtos.length}
        >
          + Adicionar produto
        </button>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="empty">
            <p>{error}</p>
          </div>
        </div>
      )}

      {!loading && !produtos.length && !error && (
        <div className="card">
          <div className="empty">
            <div className="empty-icon">📦</div>
            <p>
              Nenhum produto cadastrado.<br />
              Cadastre produtos no menu <strong>Produtos</strong> para negociar.
            </p>
          </div>
        </div>
      )}

      {!loading && produtos.length > 0 && (
        <>
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 16, fontWeight: 600, fontSize: 15 }}>Produtos disponíveis</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {produtos.map((p) => {
                const parcCartao = valorParcela(p.valorCartao, p.parcelasCartao)
                const parcBoleto = valorParcela(p.valorBoleto, p.parcelasBoleto)
                return (
                  <div
                    key={p.id}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'var(--bg2)',
                      border: '1px solid var(--border2)',
                      fontSize: 13
                    }}
                  >
                    <strong>{p.nome}</strong>
                    <span style={{ color: 'var(--text2)', marginLeft: 6 }}>
                      Cartão: {fmt(p.valorCartao)} ({p.parcelasCartao ?? '—'}x {fmt(parcCartao)} sem juros) · Boleto: {fmt(p.valorBoleto)} ({p.parcelasBoleto ?? '—'}x {fmt(parcBoleto)}) · À vista: {fmt(p.aVista)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card">
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>Linhas de negociação</span>
              <span style={{ fontSize: 12, color: 'var(--text3)', padding: '4px 8px', background: 'var(--bg2)', borderRadius: 6 }}>
                💳 Parcelas no cartão são <strong>sem juros</strong>
              </span>
            </div>
            {linhas.length === 0 ? (
              <div className="empty" style={{ padding: 32 }}>
                <p style={{ color: 'var(--text2)' }}>
                  Clique em <strong>+ Adicionar produto</strong> para montar sua negociação.
                </p>
              </div>
            ) : (
              <>
                <div className="tw">
                  <table>
                    <thead>
                      <tr>
                        <th>Produto</th>
                        <th>Qtd</th>
                        <th>Valor cartão</th>
                        <th>Parcela cartão (s/ juros)</th>
                        <th>Valor boleto</th>
                        <th>Parcela boleto</th>
                        <th>À vista</th>
                        <th style={{ width: 44 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((l) => {
                        const p = produtos.find((x) => x.id === l.produtoId)
                        if (!p) {
                          return (
                            <tr key={l.uid}>
                              <td colSpan={6} style={{ color: 'var(--text3)' }}>
                                Selecione um produto
                              </td>
                              <td>
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeLinha(l.uid)}>
                                  ✕
                                </button>
                              </td>
                            </tr>
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
                          <tr key={l.uid}>
                            <td>
                              <select
                                value={l.produtoId}
                                onChange={(e) => updateLinha(l.uid, 'produtoId', e.target.value)}
                                style={{ minWidth: 180 }}
                              >
                                {produtos.map((pr) => (
                                  <option key={pr.id} value={pr.id}>
                                    {pr.nome}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                min={1}
                                value={l.quantidade}
                                onChange={(e) => updateLinha(l.uid, 'quantidade', e.target.value)}
                                style={{ width: 60, padding: '6px 8px' }}
                              />
                            </td>
                            <td style={{ color: 'var(--green)' }}>{fmt(vCartao)}</td>
                            <td>{fmt(linhaParcCartao)}</td>
                            <td style={{ color: 'var(--green)' }}>{fmt(vBoleto)}</td>
                            <td>{fmt(linhaParcBoleto)}</td>
                            <td>{fmt(av)}</td>
                            <td>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeLinha(l.uid)}>
                                ✕
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    {linhasComDetalhes.length > 0 && (
                      <tfoot>
                        <tr style={{ background: 'var(--bg2)', fontWeight: 700 }}>
                          <td colSpan={2} style={{ textAlign: 'right', paddingRight: 12 }}>
                            Totais:
                          </td>
                          <td style={{ color: 'var(--green)' }}>{fmt(totalValorCartao)}</td>
                          <td>{fmt(totalParcelaCartao)}</td>
                          <td style={{ color: 'var(--green)' }}>{fmt(totalValorBoleto)}</td>
                          <td>{fmt(totalParcelaBoleto)}</td>
                          <td>{fmt(totalAVista)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
