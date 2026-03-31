import { useMemo, useState } from 'react'
import { AlertTriangle, Package } from 'lucide-react'
import type { ProdutoRow } from '../../firebase/firestore'
import { useAppStore } from '../../store/useAppStore'
import {
  linhasVendaDeProduto,
  pctAbaixoDaTabelaIdeal,
  resumoLinhaVendaPorPeriodo,
  type LinhaVendaComparable,
  type PeriodoContratoMeses
} from '../../lib/produtoLinhasVenda'

function linhaTemDados(l: LinhaVendaComparable): boolean {
  return (
    (l.valorAVista != null && l.valorAVista > 0) ||
    (l.valorTotal > 0 && l.parcelas >= 1)
  )
}

function tagTipoCell(l: LinhaVendaComparable) {
  if (l.linhaPrecoRole === 'ideal') {
    return (
      <span className="db-tag db-tag--green" style={{ margin: 0 }}>
        Referência
      </span>
    )
  }
  if (l.tagExibicao === 'risco_alto') {
    return (
      <span className="db-tag db-tag--red" style={{ margin: 0 }}>
        Risco alto
      </span>
    )
  }
  return (
    <span className="db-tag db-tag--amber" style={{ margin: 0 }}>
      Desconto
    </span>
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
  const [periodo, setPeriodo] = useState<PeriodoContratoMeses>(3)

  const linhas = useMemo(() => linhasVendaDeProduto(produto, periodo), [produto, periodo])
  const tabela = linhas[0]

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      showToast('Link copiado')
    } catch {
      showToast('Não foi possível copiar', 'err')
    }
  }

  const tituloPeriodo =
    periodo === 3 ? '3 meses · À vista ou 3x mensais' : '6 meses · À vista ou 6x mensais'
  const colParcela =
    periodo === 3 ? 'À vista / parcelado' : 'À vista / 6x mensais'

  return (
    <div className="prod-ln-embedded" style={{ padding: '12px 0 0', borderTop: '1px solid var(--border2)' }}>
      <div style={{ marginBottom: 12 }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Package size={18} strokeWidth={1.65} aria-hidden style={{ color: 'var(--accent)', flexShrink: 0 }} />
          Linhas de negociação por contrato
        </h4>
        <p style={{ fontSize: 12, color: 'var(--text2)', margin: '6px 0 0' }}>
          Escolha 3 ou 6 meses para ver preço de tabela, oferta, última condição e carta na manga. Os mesmos blocos são
          editados em <strong>Produtos</strong>
          {showEditHint ? ' → Editar (abas 3 e 6 meses).' : '.'}
        </p>
      </div>

      <div className="prod-ln-period-toggle" role="tablist" aria-label="Período do contrato">
        <button
          type="button"
          role="tab"
          aria-selected={periodo === 3}
          className={`prod-ln-tab ${periodo === 3 ? 'prod-ln-tab--active' : ''}`}
          onClick={() => setPeriodo(3)}
        >
          3 meses
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={periodo === 6}
          className={`prod-ln-tab ${periodo === 6 ? 'prod-ln-tab--active' : ''}`}
          onClick={() => setPeriodo(6)}
        >
          6 meses
        </button>
      </div>

      <div className="prod-ln-contract-head">
        <span className="prod-ln-contract-title">{tituloPeriodo}</span>
        {periodo === 3 ? (
          <span className="prod-ln-badge prod-ln-badge--ref">Referência atual</span>
        ) : (
          <span className="prod-ln-badge prod-ln-badge--new">Novo</span>
        )}
      </div>

      <div className="tw" style={{ marginTop: 8 }}>
        <table className="prod-ln-table">
          <thead>
            <tr>
              <th>Oferta</th>
              <th>{colParcela}</th>
              <th>Tipo</th>
              <th>Bônus</th>
              <th>Link pagamento</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const pct = l.tipo === 'carta_na_manga' ? pctAbaixoDaTabelaIdeal(tabela, l) : null
              const avisoRisco = l.tagExibicao === 'risco_alto' && pct != null && pct > 0
              const precoDestaque =
                l.tipo === 'carta_na_manga' && (l.tagExibicao === 'risco_alto' || (pct != null && pct >= 35))

              return (
                <tr key={l.id}>
                  <td>
                    <strong style={{ fontSize: 13 }}>{l.rotulo}</strong>
                  </td>
                  <td style={{ fontSize: 12, lineHeight: 1.5, verticalAlign: 'top' }}>
                    {linhaTemDados(l) ? (
                      <div>
                        <span style={{ color: precoDestaque ? 'var(--red)' : 'var(--text)', fontWeight: 600 }}>
                          {resumoLinhaVendaPorPeriodo(l)}
                        </span>
                        {l.textoSelo ? (
                          <div className="prod-ln-selo">{l.textoSelo}</div>
                        ) : null}
                        {avisoRisco ? (
                          <div className="prod-ln-warn" style={{ marginTop: 6 }}>
                            <AlertTriangle size={13} strokeWidth={2} aria-hidden style={{ flexShrink: 0 }} />
                            <span>{pct}% abaixo da tabela</span>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text3)' }}>Sem valores cadastrados</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, verticalAlign: 'top' }}>{tagTipoCell(l)}</td>
                  <td style={{ fontSize: 12, maxWidth: 180, verticalAlign: 'top' }}>
                    <span style={{ color: l.bonus?.trim() ? 'var(--text)' : 'var(--text3)' }}>
                      {l.bonus?.trim() || '—'}
                    </span>
                  </td>
                  <td style={{ maxWidth: 200, verticalAlign: 'top' }}>
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
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
