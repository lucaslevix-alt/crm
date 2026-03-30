import { Fragment, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Package, Pencil, Trash2 } from 'lucide-react'
import { getProdutos, deleteProduto, type ProdutoRow } from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { ProdutoQuatroLinhasPanel } from '../components/produto/ProdutoQuatroLinhasPanel'
import { useAppStore } from '../store/useAppStore'
import { resumoBlocoCondicao, resumoBlocoTabela } from '../lib/produtoResumo'

export function ProdutosPage() {
  const { openModal, showToast, produtosVersion, currentUser } = useAppStore()
  const podeEditar = currentUser?.cargo === 'admin'
  const [loading, setLoading] = useState(true)
  const [produtos, setProdutos] = useState<ProdutoRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const loadTudo = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await getProdutos()
      setProdutos(list)
    } catch (err) {
      setError(formatFirebaseOrUnknownError(err) || 'Erro ao carregar')
      setProdutos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTudo()
  }, [loadTudo, produtosVersion])

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
      showToast(`Erro: ${formatFirebaseOrUnknownError(err)}`, 'err')
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
              ? 'As quatro ofertas (tabela, oferta, última condição, carta na manga) são as linhas de negociação. Edite no modal do produto; expanda a linha para ver o detalhe. Negociações simula o carrinho.'
              : 'Consulta do catálogo — expandir para ver as quatro ofertas. Negociações é o simulador de carrinho.'}
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
                        <td style={{ color: 'var(--text2)', fontSize: 11, maxWidth: 200, lineHeight: 1.35 }}>
                          {resumoBlocoTabela(p.blocoPrecoTabela)}
                        </td>
                        <td style={{ color: 'var(--text2)', fontSize: 11, maxWidth: 200, lineHeight: 1.35 }}>
                          {resumoBlocoCondicao(p.blocoOferta)}
                        </td>
                        <td style={{ color: 'var(--text2)', fontSize: 11, maxWidth: 200, lineHeight: 1.35 }}>
                          {resumoBlocoCondicao(p.blocoUltimaCondicao)}
                        </td>
                        <td style={{ color: 'var(--text2)', fontSize: 11, maxWidth: 200, lineHeight: 1.35 }}>
                          {resumoBlocoCondicao(p.blocoCartaNaManga)}
                        </td>
                        <td style={{ fontSize: 13 }}>4</td>
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
                            <ProdutoQuatroLinhasPanel produto={p} showEditHint={podeEditar} />
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
