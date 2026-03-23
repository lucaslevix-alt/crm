import { useCallback, useEffect, useState } from 'react'
import { Package, Pencil, Trash2 } from 'lucide-react'
import { getProdutos, deleteProduto, type ProdutoRow } from '../firebase/firestore'
import { useAppStore } from '../store/useAppStore'

function fmt(v: number | null): string {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function valorParcela(valor: number | null, parcelas: number | null): number | null {
  if (valor == null || parcelas == null || parcelas <= 0) return null
  return valor / parcelas
}

export function ProdutosPage() {
  const { openModal, showToast, produtosVersion } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [produtos, setProdutos] = useState<ProdutoRow[]>([])
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
  }, [loadProdutos, produtosVersion])

  function handleNew() {
    useAppStore.getState().setEditingProduto(null)
    openModal('modal-produto')
  }

  function handleEdit(p: ProdutoRow) {
    useAppStore.getState().setEditingProduto({
      id: p.id,
      nome: p.nome,
      valor: p.valor ?? null,
      valorCartao: p.valorCartao,
      parcelasCartao: p.parcelasCartao,
      valorBoleto: p.valorBoleto,
      parcelasBoleto: p.parcelasBoleto,
      aVista: p.aVista,
      desc: p.desc
    })
    openModal('modal-produto')
  }

  async function handleDelete(p: ProdutoRow) {
    if (!window.confirm(`Remover "${p.nome}"?`)) return
    try {
      await deleteProduto(p.id)
      showToast(`${p.nome} removido`)
      loadProdutos()
    } catch (err) {
      showToast(`Erro: ${err instanceof Error ? err.message : 'Erro'}`, 'err')
    }
  }

  return (
    <div className="content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 className="page-title-row" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            <Package size={24} strokeWidth={1.65} aria-hidden />
            Produtos
          </h2>
          <p style={{ color: 'var(--text2)' }}>Gerencie os produtos vendidos pela equipe</p>
        </div>
        <button type="button" className="btn btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={handleNew}>
          + Novo Produto
        </button>
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
            <p>Nenhum produto cadastrado.<br />Clique em <strong>+ Novo Produto</strong> para começar.</p>
          </div>
        )}
        {!loading && !error && produtos.length > 0 && (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Cartão (valor)</th>
                  <th>Cartão (parcelas)</th>
                  <th>Cartão (x parcela)</th>
                  <th>Boleto (valor)</th>
                  <th>Boleto (parcelas)</th>
                  <th>Boleto (x parcela)</th>
                  <th>À vista</th>
                  <th>Descrição</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {produtos.map((p) => {
                  const parcCartao = valorParcela(p.valorCartao, p.parcelasCartao)
                  const parcBoleto = valorParcela(p.valorBoleto, p.parcelasBoleto)
                  return (
                    <tr key={p.id}>
                      <td><strong>{p.nome}</strong></td>
                      <td style={{ color: 'var(--green)' }}>{fmt(p.valorCartao)}</td>
                      <td>{p.parcelasCartao ?? '—'}</td>
                      <td>{fmt(parcCartao)}</td>
                      <td style={{ color: 'var(--green)' }}>{fmt(p.valorBoleto)}</td>
                      <td>{p.parcelasBoleto ?? '—'}</td>
                      <td>{fmt(parcBoleto)}</td>
                      <td>{fmt(p.aVista)}</td>
                      <td style={{ color: 'var(--text2)', fontSize: 12 }}>{p.desc || '—'}</td>
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
                    </tr>
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
