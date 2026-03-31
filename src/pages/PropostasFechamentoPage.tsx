import { Fragment, useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Link2 } from 'lucide-react'
import { getProdutos, type ProdutoRow } from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { ProdutoQuatroLinhasPanel } from '../components/produto/ProdutoQuatroLinhasPanel'
import { useAppStore } from '../store/useAppStore'
import { resumoBlocoCondicao, resumoBlocoTabela } from '../lib/produtoResumo'

const COL_COUNT = 7

export function PropostasFechamentoPage() {
  const { currentUser } = useAppStore()
  const podeEditar = currentUser?.cargo === 'admin'
  const [loading, setLoading] = useState(true)
  const [produtos, setProdutos] = useState<ProdutoRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const prods = await getProdutos()
      setProdutos(prods)
    } catch (err) {
      setError(formatFirebaseOrUnknownError(err) || 'Erro ao carregar')
      setProdutos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="content">
      <div style={{ marginBottom: 20 }}>
        <h2 className="page-title-row" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
          <Link2 size={24} strokeWidth={1.65} aria-hidden />
          Propostas de fechamento
        </h2>
        <p style={{ color: 'var(--text2)', maxWidth: 760 }}>
          {podeEditar ? (
            <>
              Cada produto tem <strong>quatro ofertas</strong> para contrato de <strong>3 meses</strong> e as mesmas
              quatro para <strong>6 meses</strong>, cadastradas em <strong>Produtos</strong> (modal com abas). São essas
              as <strong>linhas de negociação</strong> nas vendas. Expanda para alternar período, ver valores e links.
              Para editar, use <strong>Produtos</strong> → Editar.
            </>
          ) : (
            <>
              Resumo por produto (3 e 6 meses). Use <strong>Expandir</strong> para alternar o contrato, ver detalhes e{' '}
              <strong>Abrir</strong> / <strong>Copiar</strong> nos links.
            </>
          )}
        </p>
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
          <strong style={{ color: 'var(--text)' }}>Desconto do closer nas vendas</strong>
          <p style={{ margin: '8px 0 0' }}>
            A referência (preço ideal) é o <strong>Preço de tabela</strong> do <strong>mesmo período</strong> (3 ou 6
            meses) da linha em que o cliente fechou. O desconto do closer compara com essa tabela conforme a forma de
            pagamento (à vista ou parcelado).
          </p>
        </div>
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
            Nenhum produto cadastrado. Cadastre produtos em <strong>Produtos</strong> com as quatro ofertas.
          </p>
        </div>
      )}

      {!loading && !error && produtos.length > 0 && (
        <div className="card">
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 44 }} aria-label="Expandir" />
                  <th>Produto</th>
                  <th>Preço de tabela</th>
                  <th>Oferta promocional</th>
                  <th>Última condição</th>
                  <th>Carta na manga</th>
                  <th title="Ofertas × períodos">Linhas</th>
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
                            title={isOpen ? 'Recolher' : 'Expandir as 4 ofertas'}
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
                        <td style={{ fontSize: 12 }} title="4 ofertas × 2 períodos">
                          4 × 2
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr className="prod-ln-expand-row">
                          <td
                            colSpan={COL_COUNT}
                            style={{ background: 'var(--bg2)', padding: '12px 16px 16px', verticalAlign: 'top' }}
                          >
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
        </div>
      )}
    </div>
  )
}
