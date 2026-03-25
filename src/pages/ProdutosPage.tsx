import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Package, Pencil, Trash2 } from 'lucide-react'
import {
  getProdutos,
  getLinhasNegociacaoAll,
  deleteProduto,
  type ProdutoRow,
  type LinhaNegociacaoRow,
  type ProdutoBlocoPrecoTabela,
  type ProdutoBlocoCondicaoComercial
} from '../firebase/firestore'
import { LinhasNegociacaoProdutoBlock } from '../components/produto/LinhasNegociacaoProdutoBlock'
import { useAppStore } from '../store/useAppStore'

function fmt(v: number | null): string {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function resumoParcela(total: number | null, parc: number | null): string {
  if (total == null || parc == null || parc <= 0) return '—'
  return `${parc}x ${fmt(total / parc)}`
}

function resumoBlocoTabela(bt: ProdutoBlocoPrecoTabela): string {
  const parts: string[] = []
  if (bt.valorTotal != null && bt.valorTotal > 0) parts.push(`Tot. ${fmt(bt.valorTotal)}`)
  if (bt.valorAVista != null && bt.valorAVista > 0) parts.push(`À vista ${fmt(bt.valorAVista)}`)
  if (bt.valorParceladoCartao != null && bt.valorParceladoCartao > 0) {
    parts.push(`${resumoParcela(bt.valorParceladoCartao, bt.parcelasCartao)}`)
  }
  if (bt.linkPagamento?.trim()) parts.push('🔗')
  return parts.length ? parts.join(' · ') : '—'
}

function resumoBlocoCondicao(bc: ProdutoBlocoCondicaoComercial): string {
  const parts: string[] = []
  if (bc.valorAVista != null && bc.valorAVista > 0) parts.push(`À vista ${fmt(bc.valorAVista)}`)
  if (bc.valorParceladoCartao != null && bc.valorParceladoCartao > 0) {
    parts.push(`Cartão ${resumoParcela(bc.valorParceladoCartao, bc.parcelasCartao)}`)
  }
  const b = bc.bonus?.trim()
  if (b) parts.push(b.length > 48 ? `${b.slice(0, 48)}…` : b)
  if (bc.linkPagamento?.trim()) parts.push('🔗')
  return parts.length ? parts.join(' · ') : '—'
}

export function ProdutosPage() {
  const { openModal, showToast, produtosVersion, currentUser } = useAppStore()
  const podeEditar = currentUser?.cargo === 'admin'
  const [loading, setLoading] = useState(true)
  const [produtos, setProdutos] = useState<ProdutoRow[]>([])
  const [linhas, setLinhas] = useState<LinhaNegociacaoRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const loadTudo = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, lns] = await Promise.all([getProdutos(), getLinhasNegociacaoAll()])
      setProdutos(list)
      setLinhas(lns)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
      setProdutos([])
      setLinhas([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTudo()
  }, [loadTudo, produtosVersion])

  const linhasPorProduto = useMemo(() => {
    const m = new Map<string, LinhaNegociacaoRow[]>()
    for (const l of linhas) {
      if (!m.has(l.produtoId)) m.set(l.produtoId, [])
      m.get(l.produtoId)!.push(l)
    }
    return m
  }, [linhas])

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleNew() {
    if (!podeEditar) return
    useAppStore.getState().setEditingProduto(null)
    openModal('modal-produto')
  }

  function handleEdit(p: ProdutoRow) {
    if (!podeEditar) return
    useAppStore.getState().setEditingProduto({
      id: p.id,
      nome: p.nome,
      blocoPrecoTabela: p.blocoPrecoTabela,
      blocoOferta: p.blocoOferta,
      blocoUltimaCondicao: p.blocoUltimaCondicao,
      blocoCartaNaManga: p.blocoCartaNaManga
    })
    openModal('modal-produto')
  }

  async function handleDelete(p: ProdutoRow) {
    if (!podeEditar) return
    if (!window.confirm(`Remover "${p.nome}"?`)) return
    try {
      await deleteProduto(p.id)
      showToast(`${p.nome} removido`)
      setExpanded((prev) => {
        const next = new Set(prev)
        next.delete(p.id)
        return next
      })
      loadTudo()
    } catch (err) {
      showToast(`Erro: ${err instanceof Error ? err.message : 'Erro'}`, 'err')
    }
  }

  const colCount = podeEditar ? 8 : 7

  return (
    <div className="content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <Link to="/config" className="config-sub-back">
            ← Configurações
          </Link>
          <h2 className="page-title-row" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, marginTop: 10 }}>
            <Package size={24} strokeWidth={1.65} aria-hidden />
            Produtos
          </h2>
          <p style={{ color: 'var(--text2)' }}>
            {podeEditar
              ? 'Catálogo comercial e linhas de negociação por produto (expandir a linha). A página Negociações continua só para simular carrinho com o cliente.'
              : 'Consulta do catálogo e das linhas de proposta — expandir o produto. Negociações (menu) é o simulador de carrinho.'}
          </p>
        </div>
        {podeEditar ? (
          <button type="button" className="btn btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={handleNew}>
            + Novo produto
          </button>
        ) : null}
      </div>
      <div className="card">
        {loading && (
          <div className="loading">
            <div className="spin" /> Carregando...
          </div>
        )}
        {error && (
          <div className="empty">
            <p>{error}</p>
          </div>
        )}
        {!loading && !error && !produtos.length && (
          <div className="empty">
            <div className="empty-icon" aria-hidden>
              <Package size={40} strokeWidth={1.4} />
            </div>
            <p>
              Nenhum produto cadastrado.
              {podeEditar ? (
                <>
                  <br />
                  Clique em <strong>+ Novo produto</strong> para começar.
                </>
              ) : (
                <>
                  <br />
                  Peça a um administrador para incluir itens.
                </>
              )}
            </p>
          </div>
        )}
        {!loading && !error && produtos.length > 0 && (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }} aria-label="Expandir" />
                  <th>Nome do produto</th>
                  <th>Preço de tabela</th>
                  <th>Oferta promocional</th>
                  <th>Última condição</th>
                  <th>Carta na manga</th>
                  <th>Linhas</th>
                  {podeEditar ? <th>Ações</th> : null}
                </tr>
              </thead>
              <tbody>
                {produtos.map((p) => {
                  const nLinhas = (linhasPorProduto.get(p.id) ?? []).length
                  const isOpen = expanded.has(p.id)
                  return (
                    <Fragment key={p.id}>
                      <tr>
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ padding: 4 }}
                            onClick={() => toggleExpand(p.id)}
                            aria-expanded={isOpen}
                            title={isOpen ? 'Recolher linhas' : 'Ver linhas de negociação'}
                          >
                            {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </button>
                        </td>
                        <td>
                          <strong>{p.nome}</strong>
                        </td>
                        <td style={{ color: 'var(--text2)', fontSize: 11, maxWidth: 200, lineHeight: 1.35 }}>{resumoBlocoTabela(p.blocoPrecoTabela)}</td>
                        <td style={{ color: 'var(--text2)', fontSize: 11, maxWidth: 200, lineHeight: 1.35 }}>{resumoBlocoCondicao(p.blocoOferta)}</td>
                        <td style={{ color: 'var(--text2)', fontSize: 11, maxWidth: 200, lineHeight: 1.35 }}>{resumoBlocoCondicao(p.blocoUltimaCondicao)}</td>
                        <td style={{ color: 'var(--text2)', fontSize: 11, maxWidth: 200, lineHeight: 1.35 }}>{resumoBlocoCondicao(p.blocoCartaNaManga)}</td>
                        <td style={{ fontSize: 13 }}>{nLinhas}</td>
                        {podeEditar ? (
                          <td style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                              onClick={() => handleEdit(p)}
                            >
                              <Pencil size={14} strokeWidth={1.65} aria-hidden />
                              Editar
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              title="Excluir"
                              aria-label="Excluir"
                              onClick={() => handleDelete(p)}
                            >
                              <Trash2 size={14} strokeWidth={1.65} />
                            </button>
                          </td>
                        ) : null}
                      </tr>
                      {isOpen ? (
                        <tr className="prod-ln-expand-row">
                          <td colSpan={colCount} style={{ background: 'var(--bg2)', padding: '12px 16px 16px', verticalAlign: 'top' }}>
                            <LinhasNegociacaoProdutoBlock
                              produto={p}
                              linhas={linhasPorProduto.get(p.id) ?? []}
                              todasLinhas={linhas}
                              podeEditar={podeEditar}
                              onAfterChange={loadTudo}
                              embedded
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
