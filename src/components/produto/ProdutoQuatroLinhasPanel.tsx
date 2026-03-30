import { Package } from 'lucide-react'
import type { ProdutoRow } from '../../firebase/firestore'
import { useAppStore } from '../../store/useAppStore'
import {
  linhasVendaDeProduto,
  resumoLinhaVenda,
  type LinhaVendaComparable
} from '../../lib/produtoLinhasVenda'

function linhaTemDados(l: LinhaVendaComparable): boolean {
  return (
    (l.valorAVista != null && l.valorAVista > 0) ||
    (l.valorTotal > 0 && l.parcelas >= 1)
  )
}

export function ProdutoQuatroLinhasPanel({
  produto,
  showEditHint
}: {
  produto: ProdutoRow
  /** Mostrar texto para editar em Produtos */
  showEditHint?: boolean
}) {
  const { showToast } = useAppStore()
  const linhas = linhasVendaDeProduto(produto)

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      showToast('Link copiado')
    } catch {
      showToast('Não foi possível copiar', 'err')
    }
  }

  return (
    <div className="prod-ln-embedded" style={{ padding: '12px 0 0', borderTop: '1px solid var(--border2)' }}>
      <div style={{ marginBottom: 10 }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Package size={18} strokeWidth={1.65} aria-hidden style={{ color: 'var(--accent)', flexShrink: 0 }} />
          Linhas de negociação (4 ofertas do produto)
        </h4>
        <p style={{ fontSize: 12, color: 'var(--text2)', margin: '6px 0 0' }}>
          Preço de tabela, oferta promocional, última condição e carta na manga — os mesmos dados do cadastro do produto.
          {showEditHint ? (
            <>
              {' '}
              Para alterar valores ou links, use <strong>Produtos</strong> → Editar.
            </>
          ) : null}
        </p>
      </div>

      <div className="tw" style={{ marginTop: 8 }}>
        <table>
          <thead>
            <tr>
              <th>Oferta</th>
              <th>À vista / Parcelado</th>
              <th>Tipo</th>
              <th>Bônus</th>
              <th>Link pagamento</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id}>
                <td>
                  <strong style={{ fontSize: 13 }}>{l.rotulo}</strong>
                </td>
                <td style={{ fontSize: 12, lineHeight: 1.45 }}>
                  {linhaTemDados(l) ? (
                    <span style={{ color: 'var(--text)' }}>{resumoLinhaVenda(l)}</span>
                  ) : (
                    <span style={{ color: 'var(--text3)' }}>Sem valores cadastrados</span>
                  )}
                </td>
                <td style={{ fontSize: 12 }}>
                  {l.linhaPrecoRole === 'ideal' ? (
                    <span className="db-tag db-tag--green" style={{ margin: 0 }}>
                      Referência (ideal)
                    </span>
                  ) : (
                    <span className="db-tag db-tag--amber" style={{ margin: 0 }}>
                      Com desconto vs tabela
                    </span>
                  )}
                </td>
                <td style={{ fontSize: 12, maxWidth: 180, verticalAlign: 'top' }}>
                  <span style={{ color: l.bonus?.trim() ? 'var(--text)' : 'var(--text3)' }}>
                    {l.bonus?.trim() || '—'}
                  </span>
                </td>
                <td style={{ maxWidth: 200 }}>
                  {l.linkPagamento?.trim() ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                      <a
                        href={l.linkPagamento}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-sm"
                        style={{ width: 'auto' }}
                      >
                        Abrir
                      </a>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ width: 'auto' }}
                        onClick={() => copyLink(l.linkPagamento!)}
                      >
                        Copiar
                      </button>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text3)' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
