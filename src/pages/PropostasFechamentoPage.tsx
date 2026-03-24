import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link2, Package } from 'lucide-react'
import {
  getProdutos,
  getLinhasNegociacaoAll,
  addLinhaNegociacao,
  updateLinhaNegociacao,
  deleteLinhaNegociacao,
  type ProdutoRow,
  type LinhaNegociacaoRow,
  type LinhaPrecoRole
} from '../firebase/firestore'
import { useAppStore } from '../store/useAppStore'

function fmt(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function valorParcela(total: number, parcelas: number): number {
  if (!parcelas || parcelas < 1) return 0
  return total / parcelas
}

function linhaResumoParcelado(l: LinhaNegociacaoRow): string {
  const vp = valorParcela(l.valorTotal, l.parcelas)
  return `${fmt(l.valorTotal)} em ${l.parcelas}x de ${fmt(vp)}`
}

function linhaResumoCompleto(l: LinhaNegociacaoRow): string {
  const parcel = linhaResumoParcelado(l)
  if (l.valorAVista != null && l.valorAVista > 0) {
    return `À vista ${fmt(l.valorAVista)} · ${parcel}`
  }
  return `À vista não cadastrado · ${parcel}`
}

type LinhaPropostaDraft = {
  rotulo: string
  valorTotal: string
  valorAVista: string
  parcelas: string
  linkCartao: string
  linhaPrecoRole: LinhaPrecoRole
}

export function PropostasFechamentoPage() {
  const { showToast, currentUser } = useAppStore()
  const podeEditar = currentUser?.cargo === 'admin'
  const [loading, setLoading] = useState(true)
  const [produtos, setProdutos] = useState<ProdutoRow[]>([])
  const [linhas, setLinhas] = useState<LinhaNegociacaoRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<LinhaPropostaDraft | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

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

  useEffect(() => {
    if (!podeEditar) {
      setEditingId(null)
      setEditDraft(null)
    }
  }, [podeEditar])

  const linhasPorProduto = useMemo(() => {
    const m = new Map<string, LinhaNegociacaoRow[]>()
    for (const l of linhas) {
      if (!m.has(l.produtoId)) m.set(l.produtoId, [])
      m.get(l.produtoId)!.push(l)
    }
    return m
  }, [linhas])

  function nextOrdem(produtoId: string): number {
    const list = linhasPorProduto.get(produtoId) ?? []
    if (!list.length) return 0
    return Math.max(...list.map((x) => x.ordem)) + 1
  }

  /** Garante no máximo uma linha ideal por produto (no Firestore). */
  async function demoverOutrasIdeais(produtoId: string, manterId?: string) {
    const alvos = linhas.filter(
      (l) => l.produtoId === produtoId && l.linhaPrecoRole === 'ideal' && (manterId == null || l.id !== manterId)
    )
    for (const l of alvos) {
      await updateLinhaNegociacao(l.id, {
        valorTotal: l.valorTotal,
        parcelas: l.parcelas,
        valorAVista: l.valorAVista,
        linkCartao: l.linkCartao,
        rotulo: l.rotulo,
        ordem: l.ordem,
        linhaPrecoRole: 'desconto'
      })
    }
  }

  async function handleAdd(produtoId: string, draft: LinhaPropostaDraft) {
    if (!podeEditar) return
    const vt = parseFloat(draft.valorTotal.replace(',', '.'))
    const pc = parseInt(draft.parcelas, 10)
    if (!vt || vt <= 0) {
      showToast('Informe o valor total válido', 'err')
      return
    }
    if (!pc || pc < 1) {
      showToast('Informe o número de parcelas (mín. 1)', 'err')
      return
    }
    const va = parseFloat(draft.valorAVista.replace(',', '.'))
    if (!va || va <= 0) {
      showToast('Informe o valor à vista (R$) desta linha', 'err')
      return
    }
    try {
      if (draft.linhaPrecoRole === 'ideal') {
        await demoverOutrasIdeais(produtoId)
      }
      await addLinhaNegociacao({
        produtoId,
        valorTotal: vt,
        parcelas: pc,
        valorAVista: va,
        linkCartao: draft.linkCartao.trim() || null,
        rotulo: draft.rotulo.trim() || null,
        ordem: nextOrdem(produtoId),
        linhaPrecoRole: draft.linhaPrecoRole
      })
      showToast('Linha adicionada')
      await load()
    } catch (e) {
      showToast('Erro: ' + (e instanceof Error ? e.message : String(e)), 'err')
    }
  }

  function startEdit(l: LinhaNegociacaoRow) {
    if (!podeEditar) return
    setEditingId(l.id)
    setEditDraft({
      rotulo: l.rotulo ?? '',
      valorTotal: String(l.valorTotal),
      valorAVista: l.valorAVista != null && l.valorAVista > 0 ? String(l.valorAVista) : '',
      parcelas: String(l.parcelas),
      linkCartao: l.linkCartao ?? '',
      linhaPrecoRole: l.linhaPrecoRole
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft(null)
  }

  async function saveEdit(id: string) {
    if (!podeEditar || !editDraft) return
    const row = linhas.find((l) => l.id === id)
    if (!row) return
    const vt = parseFloat(editDraft.valorTotal.replace(',', '.'))
    const pc = parseInt(editDraft.parcelas, 10)
    if (!vt || vt <= 0) {
      showToast('Informe o valor total válido', 'err')
      return
    }
    if (!pc || pc < 1) {
      showToast('Informe o número de parcelas', 'err')
      return
    }
    const va = parseFloat(editDraft.valorAVista.replace(',', '.'))
    if (!va || va <= 0) {
      showToast('Informe o valor à vista (R$) desta linha', 'err')
      return
    }
    setSavingId(id)
    try {
      if (editDraft.linhaPrecoRole === 'ideal') {
        await demoverOutrasIdeais(row.produtoId, id)
      }
      await updateLinhaNegociacao(id, {
        valorTotal: vt,
        parcelas: pc,
        valorAVista: va,
        linkCartao: editDraft.linkCartao.trim() || null,
        rotulo: editDraft.rotulo.trim() || null,
        linhaPrecoRole: editDraft.linhaPrecoRole
      })
      showToast(
        editDraft.linhaPrecoRole === 'desconto' && row.linhaPrecoRole === 'ideal'
          ? 'Linha atualizada. Se não houver mais linha ideal neste produto, marque outra.'
          : 'Linha atualizada'
      )
      cancelEdit()
      await load()
    } catch (e) {
      showToast('Erro: ' + (e instanceof Error ? e.message : String(e)), 'err')
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(l: LinhaNegociacaoRow) {
    if (!podeEditar) return
    if (!window.confirm('Remover esta linha de proposta?')) return
    try {
      await deleteLinhaNegociacao(l.id)
      if (editingId === l.id) cancelEdit()
      showToast(
        l.linhaPrecoRole === 'ideal'
          ? 'Removida. Era a linha ideal — marque outra como ideal se precisar medir desconto.'
          : 'Removida'
      )
      await load()
    } catch (e) {
      showToast('Erro: ' + (e instanceof Error ? e.message : String(e)), 'err')
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      showToast('Link copiado')
    } catch {
      showToast('Não foi possível copiar', 'err')
    }
  }

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
              parcelas). Marque <strong>uma</strong> linha como <strong>preço ideal</strong>; as outras são{' '}
              <strong>com desconto</strong>. Na venda, a <strong>forma de pagamento</strong> define qual dos dois valores
              entra na conta (à vista vs parcelado).
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
          <div className="empty-icon" aria-hidden>
            <Package size={40} strokeWidth={1.4} />
          </div>
          <p>
            Nenhum produto cadastrado. Cadastre produtos em <strong>Produtos</strong> para criar propostas.
          </p>
        </div>
      )}

      {!loading &&
        !error &&
        produtos.map((p) => (
          <ProdutoPropostasBlock
            key={p.id}
            produto={p}
            linhas={linhasPorProduto.get(p.id) ?? []}
            editingId={editingId}
            editDraft={editDraft}
            savingId={savingId}
            onEditDraft={setEditDraft}
            onStartEdit={startEdit}
            onCancelEdit={cancelEdit}
            onSaveEdit={saveEdit}
            onDelete={handleDelete}
            onAdd={handleAdd}
            onCopyLink={copyLink}
            podeEditar={podeEditar}
          />
        ))}
    </div>
  )
}

function ProdutoPropostasBlock({
  produto,
  linhas,
  editingId,
  editDraft,
  savingId,
  onEditDraft,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onAdd,
  onCopyLink,
  podeEditar
}: {
  produto: ProdutoRow
  linhas: LinhaNegociacaoRow[]
  podeEditar: boolean
  editingId: string | null
  editDraft: LinhaPropostaDraft | null
  savingId: string | null
  onEditDraft: (d: LinhaPropostaDraft | null) => void
  onStartEdit: (l: LinhaNegociacaoRow) => void
  onCancelEdit: () => void
  onSaveEdit: (id: string) => void
  onDelete: (l: LinhaNegociacaoRow) => void
  onAdd: (produtoId: string, draft: LinhaPropostaDraft) => Promise<void>
  onCopyLink: (url: string) => void
}) {
  const temIdeal = linhas.some((l) => l.linhaPrecoRole === 'ideal')
  const [novo, setNovo] = useState<LinhaPropostaDraft>({
    rotulo: '',
    valorTotal: '',
    valorAVista: '',
    parcelas: '1',
    linkCartao: '',
    linhaPrecoRole: 'ideal'
  })

  return (
    <div className="card mb" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Package size={20} strokeWidth={1.65} aria-hidden style={{ color: 'var(--accent)', flexShrink: 0 }} />
          {produto.nome}
        </h3>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>
          {linhas.length} {linhas.length === 1 ? 'proposta' : 'propostas'}
        </span>
      </div>

      {podeEditar && linhas.length > 0 && !temIdeal && (
        <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--amber)', fontWeight: 600 }}>
          Nenhuma linha está marcada como <strong>preço ideal</strong>. Sem isso, o desconto do closer não é calculado
          nas vendas.
        </p>
      )}
      {podeEditar &&
        linhas.some((l) => l.valorAVista == null || l.valorAVista <= 0) && (
          <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text2)' }}>
            Algumas linhas estão sem <strong>valor à vista</strong>. Edite-as para que vendas com forma “À vista”
            comparem corretamente.
          </p>
        )}

      {linhas.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text2)', margin: '12px 0' }}>Nenhuma linha cadastrada ainda.</p>
      ) : (
        <div className="tw" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Rótulo</th>
                <th>À vista / Parcelado</th>
                <th>Tipo</th>
                <th>Link cartão</th>
                {podeEditar ? <th></th> : null}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, idx) => {
                const isEd = podeEditar && editingId === l.id
                return (
                  <tr key={l.id}>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {idx + 1}
                    </td>
                    <td>
                      {isEd && editDraft ? (
                        <input
                          type="text"
                          className="di"
                          style={{ minWidth: 120 }}
                          value={editDraft.rotulo}
                          onChange={(e) => onEditDraft({ ...editDraft, rotulo: e.target.value })}
                          placeholder="Opcional"
                        />
                      ) : (
                        <span style={{ color: l.rotulo ? 'var(--text)' : 'var(--text3)' }}>{l.rotulo || '—'}</span>
                      )}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {isEd && editDraft ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 52 }}>À vista</span>
                            <input
                              type="number"
                              className="di"
                              step="0.01"
                              style={{ width: 100 }}
                              value={editDraft.valorAVista}
                              onChange={(e) => onEditDraft({ ...editDraft, valorAVista: e.target.value })}
                              title="Valor à vista"
                              placeholder="R$"
                            />
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 52 }}>Parcel.</span>
                            <input
                              type="number"
                              className="di"
                              step="0.01"
                              style={{ width: 100 }}
                              value={editDraft.valorTotal}
                              onChange={(e) => onEditDraft({ ...editDraft, valorTotal: e.target.value })}
                              title="Valor total parcelado"
                            />
                            <span style={{ color: 'var(--text3)' }}>em</span>
                            <input
                              type="number"
                              className="di"
                              min={1}
                              style={{ width: 56 }}
                              value={editDraft.parcelas}
                              onChange={(e) => onEditDraft({ ...editDraft, parcelas: e.target.value })}
                              title="Parcelas"
                            />
                            <span style={{ color: 'var(--text3)', fontSize: 12 }}>
                              × {fmt(valorParcela(parseFloat(editDraft.valorTotal) || 0, parseInt(editDraft.parcelas, 10) || 1))}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <strong style={{ lineHeight: 1.45 }}>{linhaResumoCompleto(l)}</strong>
                      )}
                    </td>
                    <td style={{ fontSize: 12, verticalAlign: 'top', minWidth: 200 }}>
                      {isEd && editDraft ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                            <input
                              type="radio"
                              name={`tipo-${l.id}`}
                              checked={editDraft.linhaPrecoRole === 'ideal'}
                              onChange={() => onEditDraft({ ...editDraft, linhaPrecoRole: 'ideal' })}
                            />
                            Preço ideal (sem desconto)
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                            <input
                              type="radio"
                              name={`tipo-${l.id}`}
                              checked={editDraft.linhaPrecoRole === 'desconto'}
                              onChange={() => onEditDraft({ ...editDraft, linhaPrecoRole: 'desconto' })}
                            />
                            Com desconto (vs ideal)
                          </label>
                        </div>
                      ) : l.linhaPrecoRole === 'ideal' ? (
                        <span className="db-tag db-tag--green" style={{ margin: 0 }}>
                          Preço ideal
                        </span>
                      ) : (
                        <span className="db-tag db-tag--amber" style={{ margin: 0 }}>
                          Com desconto
                        </span>
                      )}
                    </td>
                    <td style={{ maxWidth: 220 }}>
                      {isEd && editDraft ? (
                        <input
                          type="url"
                          className="di"
                          style={{ width: '100%' }}
                          value={editDraft.linkCartao}
                          onChange={(e) => onEditDraft({ ...editDraft, linkCartao: e.target.value })}
                          placeholder="https://..."
                        />
                      ) : l.linkCartao ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                          <a href={l.linkCartao} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ width: 'auto' }}>
                            Abrir
                          </a>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ width: 'auto' }}
                            onClick={() => onCopyLink(l.linkCartao!)}
                          >
                            Copiar
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text3)' }}>—</span>
                      )}
                    </td>
                    {podeEditar ? (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {isEd ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={savingId === l.id}
                              onClick={() => onSaveEdit(l.id)}
                            >
                              {savingId === l.id ? '...' : 'Salvar'}
                            </button>{' '}
                            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancelEdit}>
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onStartEdit(l)}>
                              Editar
                            </button>{' '}
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(l)}>
                              Excluir
                            </button>
                          </>
                        )}
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {podeEditar ? (
        <div
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: '1px solid var(--border2)',
            display: 'grid',
            gap: 10,
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            alignItems: 'end'
          }}
        >
          <div className="fg" style={{ margin: 0, gridColumn: 'span 2' }}>
            <label style={{ fontSize: 11 }}>Rótulo (opcional)</label>
            <input
              type="text"
              className="di"
              value={novo.rotulo}
              onChange={(e) => setNovo((n) => ({ ...n, rotulo: e.target.value }))}
              placeholder="Ex.: Entrada reduzida"
            />
          </div>
          <div className="fg" style={{ margin: 0 }}>
            <label style={{ fontSize: 11 }}>Valor à vista (R$) *</label>
            <input
              type="number"
              className="di"
              step="0.01"
              value={novo.valorAVista}
              onChange={(e) => setNovo((n) => ({ ...n, valorAVista: e.target.value }))}
              placeholder="5200"
            />
          </div>
          <div className="fg" style={{ margin: 0 }}>
            <label style={{ fontSize: 11 }}>Total parcelado (R$) *</label>
            <input
              type="number"
              className="di"
              step="0.01"
              value={novo.valorTotal}
              onChange={(e) => setNovo((n) => ({ ...n, valorTotal: e.target.value }))}
              placeholder="5800"
            />
          </div>
          <div className="fg" style={{ margin: 0 }}>
            <label style={{ fontSize: 11 }}>Parcelas *</label>
            <input
              type="number"
              className="di"
              min={1}
              value={novo.parcelas}
              onChange={(e) => setNovo((n) => ({ ...n, parcelas: e.target.value }))}
            />
          </div>
          <div className="fg" style={{ margin: 0, gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11 }}>Tipo desta linha</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="radio"
                  name={`novo-tipo-${produto.id}`}
                  checked={novo.linhaPrecoRole === 'ideal'}
                  onChange={() => setNovo((n) => ({ ...n, linhaPrecoRole: 'ideal' }))}
                />
                Preço ideal (sem desconto) — só pode haver uma por produto
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="radio"
                  name={`novo-tipo-${produto.id}`}
                  checked={novo.linhaPrecoRole === 'desconto'}
                  onChange={() => setNovo((n) => ({ ...n, linhaPrecoRole: 'desconto' }))}
                />
                Com desconto (valor menor que o ideal)
              </label>
            </div>
          </div>
          <div className="fg" style={{ margin: 0, gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11 }}>Link pagamento cartão</label>
            <input
              type="url"
              className="di"
              value={novo.linkCartao}
              onChange={(e) => setNovo((n) => ({ ...n, linkCartao: e.target.value }))}
              placeholder="https://checkout..."
            />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: 'auto', padding: '10px 20px' }}
              onClick={async () => {
                const tinhaIdeal = linhas.some((x) => x.linhaPrecoRole === 'ideal')
                const esteEhIdeal = novo.linhaPrecoRole === 'ideal'
                await onAdd(produto.id, novo)
                setNovo({
                  rotulo: '',
                  valorTotal: '',
                  valorAVista: '',
                  parcelas: '1',
                  linkCartao: '',
                  linhaPrecoRole: tinhaIdeal || esteEhIdeal ? 'desconto' : 'ideal'
                })
              }}
            >
              + Adicionar linha
            </button>
            {novo.valorTotal && novo.parcelas && (
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                Prévia:{' '}
                <strong>
                  {fmt(parseFloat(novo.valorTotal) || 0)} em {parseInt(novo.parcelas, 10) || 1}x de{' '}
                  {fmt(valorParcela(parseFloat(novo.valorTotal) || 0, parseInt(novo.parcelas, 10) || 1))}
                </strong>
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
