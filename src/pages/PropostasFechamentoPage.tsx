import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link2 } from 'lucide-react'
import { getProdutos, getLinhasNegociacaoAll, type ProdutoRow, type LinhaNegociacaoRow } from '../firebase/firestore'
import { LinhasNegociacaoProdutoBlock } from '../components/produto/LinhasNegociacaoProdutoBlock'
import { useAppStore } from '../store/useAppStore'

export function PropostasFechamentoPage() {
  const { currentUser } = useAppStore()
  const podeEditar = currentUser?.cargo === 'admin'
  const [loading, setLoading] = useState(true)
  const [produtos, setProdutos] = useState<ProdutoRow[]>([])
  const [linhas, setLinhas] = useState<LinhaNegociacaoRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [prods, lns] = await Promise.all([getProdutos(), getLinhasNegociacaoAll()])
      setProdutos(prods)
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
    load()
  }, [load])

  const linhasPorProduto = useMemo(() => {
    const m = new Map<string, LinhaNegociacaoRow[]>()
    for (const l of linhas) {
      if (!m.has(l.produtoId)) m.set(l.produtoId, [])
      m.get(l.produtoId)!.push(l)
    }
    return m
  }, [linhas])

  return (
    <div className="content">
      <div style={{ marginBottom: 20 }}>
        <h2 className="page-title-row" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
          <Link2 size={24} strokeWidth={1.65} aria-hidden />
          Propostas de fechamento
        </h2>
        <p style={{ color: 'var(--text2)', maxWidth: 720 }}>
          {podeEditar ? (
            <>
              Cada linha tem <strong>dois preços</strong>: <strong>à vista</strong> e <strong>parcelado</strong> (total +
              parcelas), <strong>bônus</strong> opcional e <strong>link de pagamento</strong>. Marque <strong>uma</strong>{' '}
              linha como <strong>preço ideal</strong>; as outras são <strong>com desconto</strong>. O mesmo cadastro pode
              ser feito em <strong>Produtos</strong> ao expandir cada item.
            </>
          ) : (
            <>
              Visualize as propostas cadastradas e use <strong>Abrir</strong> ou <strong>Copiar</strong> no link de
              pagamento no cartão. Apenas administradores alteram ou criam linhas.
            </>
          )}
        </p>
        {podeEditar && (
          <div
            className="card"
            style={{
              marginTop: 14,
              padding: '14px 16px',
              maxWidth: 720,
              background: 'var(--bg3)',
              borderColor: 'var(--border)',
              fontSize: 13,
              lineHeight: 1.55,
              color: 'var(--text2)'
            }}
          >
            <strong style={{ color: 'var(--text)' }}>Resumo</strong>
            <ol style={{ margin: '10px 0 0', paddingLeft: 20 }}>
              <li>
                Em cada linha informe <strong>valor à vista</strong> e <strong>valor total parcelado</strong> (com
                parcelas).
              </li>
              <li>
                Uma linha é <strong>ideal</strong> (os dois modelos dessa linha são referência); as outras são{' '}
                <strong>com desconto</strong>.
              </li>
              <li>
                Na venda, com <strong>À vista</strong> compara-se o à vista da linha ideal com o à vista da linha em que
                fechou; com <strong>cartão/boleto</strong> compara-se o total parcelado de cada uma.
              </li>
            </ol>
          </div>
        )}
      </div>

      {loading && (
        <div className="loading">
          <div className="spin" /> Carregando...
        </div>
      )}
      {error && (
        <div className="card" style={{ padding: 16, color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {!loading && !error && !produtos.length && (
        <div className="card empty">
          <p>
            Nenhum produto cadastrado. Cadastre produtos em <strong>Produtos</strong> para criar propostas.
          </p>
        </div>
      )}

      {!loading &&
        !error &&
        produtos.map((p) => (
          <LinhasNegociacaoProdutoBlock
            key={p.id}
            produto={p}
            linhas={linhasPorProduto.get(p.id) ?? []}
            todasLinhas={linhas}
            podeEditar={podeEditar}
            onAfterChange={load}
          />
        ))}
    </div>
  )
}
