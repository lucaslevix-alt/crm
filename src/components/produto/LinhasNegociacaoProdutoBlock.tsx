import { useEffect, useState } from 'react'
import { Package } from 'lucide-react'
import {
  addLinhaNegociacao,
  updateLinhaNegociacao,
  deleteLinhaNegociacao,
  type ProdutoRow,
  type LinhaNegociacaoRow,
  type LinhaPrecoRole
} from '../../firebase/firestore'
import { useAppStore } from '../../store/useAppStore'

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

export type LinhaPropostaDraft = {
  rotulo: string
  valorTotal: string
  valorAVista: string
  parcelas: string
  linkCartao: string
  possibilidadeBonus: string
  linhaPrecoRole: LinhaPrecoRole
}

export function LinhasNegociacaoProdutoBlock({
  produto,
  linhas,
  todasLinhas,
  podeEditar,
  onAfterChange,
  embedded
}: {
  produto: ProdutoRow
  linhas: LinhaNegociacaoRow[]
  todasLinhas: LinhaNegociacaoRow[]
  podeEditar: boolean
  onAfterChange: () => Promise<void>
  /** Sem card externo / título grande — uso dentro da tabela de produtos */
  embedded?: boolean
}) {
  const { showToast } = useAppStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<LinhaPropostaDraft | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [novo, setNovo] = useState<LinhaPropostaDraft>({
    rotulo: '',
    valorTotal: '',
    valorAVista: '',
    parcelas: '1',
    linkCartao: '',
    possibilidadeBonus: '',
    linhaPrecoRole: 'ideal'
  })

  useEffect(() => {
    if (!podeEditar) {
      setEditingId(null)
      setEditDraft(null)
    }
  }, [podeEditar])

  function nextOrdem(produtoId: string): number {
    const list = todasLinhas.filter((x) => x.produtoId === produtoId)
    if (!list.length) return 0
    return Math.max(...list.map((x) => x.ordem)) + 1
  }

  async function demoverOutrasIdeais(produtoId: string, manterId?: string) {
    const alvos = todasLinhas.filter(
      (l) => l.produtoId === produtoId && l.linhaPrecoRole === 'ideal' && (manterId == null || l.id !== manterId)
    )
    for (const l of alvos) {
      await updateLinhaNegociacao(l.id, {
        valorTotal: l.valorTotal,
        parcelas: l.parcelas,
        valorAVista: l.valorAVista,
        linkCartao: l.linkCartao,
        possibilidadeBonus: l.possibilidadeBonus,
        rotulo: l.rotulo,
        ordem: l.ordem,
        linhaPrecoRole: 'desconto'
      })
    }
  }

  async function handleAdd(produtoId: string, draft: LinhaPropostaDraft): Promise<boolean> {
    if (!podeEditar) return false
    const vt = parseFloat(draft.valorTotal.replace(',', '.'))
    const pc = parseInt(draft.parcelas, 10)
    if (!vt || vt <= 0) {
      showToast('Informe o valor total válido', 'err')
      return false
    }
    if (!pc || pc < 1) {
      showToast('Informe o número de parcelas (mín. 1)', 'err')
      return false
    }
    const va = parseFloat(draft.valorAVista.replace(',', '.'))
    if (!va || va <= 0) {
      showToast('Informe o valor à vista (R$) desta linha', 'err')
      return false
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
        possibilidadeBonus: draft.possibilidadeBonus.trim() || null,
        rotulo: draft.rotulo.trim() || null,
        ordem: nextOrdem(produtoId),
        linhaPrecoRole: draft.linhaPrecoRole
      })
      showToast('Linha adicionada')
      await onAfterChange()
      return true
    } catch (e) {
      showToast('Erro: ' + (e instanceof Error ? e.message : String(e)), 'err')
      return false
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
      possibilidadeBonus: l.possibilidadeBonus ?? '',
      linhaPrecoRole: l.linhaPrecoRole
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft(null)
  }

  async function saveEdit(id: string) {
    if (!podeEditar || !editDraft) return
    const row = todasLinhas.find((l) => l.id === id)
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
        possibilidadeBonus: editDraft.possibilidadeBonus.trim() || null,
        rotulo: editDraft.rotulo.trim() || null,
        linhaPrecoRole: editDraft.linhaPrecoRole
      })
      showToast(
        editDraft.linhaPrecoRole === 'desconto' && row.linhaPrecoRole === 'ideal'
          ? 'Linha atualizada. Se não houver mais linha ideal neste produto, marque outra.'
          : 'Linha atualizada'
      )
      cancelEdit()
      await onAfterChange()
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
      await onAfterChange()
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

  const temIdeal = linhas.some((l) => l.linhaPrecoRole === 'ideal')

  const head = embedded ? (
    <div style={{ marginBottom: 10 }}>
      <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Package size={18} strokeWidth={1.65} aria-hidden style={{ color: 'var(--accent)', flexShrink: 0 }} />
        Linhas de negociação (propostas)
      </h4>
      <p style={{ fontSize: 12, color: 'var(--text2)', margin: '6px 0 0' }}>
        Valores à vista e parcelados, bônus opcional e link de pagamento. O mesmo cadastro aparece em Propostas de fechamento.
      </p>
    </div>
  ) : (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Package size={20} strokeWidth={1.65} aria-hidden style={{ color: 'var(--accent)', flexShrink: 0 }} />
        {produto.nome}
      </h3>
      <span style={{ fontSize: 12, color: 'var(--text3)' }}>
        {linhas.length} {linhas.length === 1 ? 'proposta' : 'propostas'}
      </span>
    </div>
  )

  return (
    <div
      className={embedded ? 'prod-ln-embedded' : 'card mb'}
      style={
        embedded
          ? { padding: '12px 0 0', borderTop: '1px solid var(--border2)' }
          : { marginBottom: 16 }
      }
    >
      {head}

      {podeEditar && linhas.length > 0 && !temIdeal && (
        <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--amber)', fontWeight: 600 }}>
          Nenhuma linha está marcada como <strong>preço ideal</strong>. Sem isso, o desconto do closer não é calculado nas vendas.
        </p>
      )}
      {podeEditar && linhas.some((l) => l.valorAVista == null || l.valorAVista <= 0) && (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text2)' }}>
          Algumas linhas estão sem <strong>valor à vista</strong>. Edite-as para que vendas com forma “À vista” comparem corretamente.
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
                <th>Bônus</th>
                <th>Link pagamento</th>
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
                          onChange={(e) => setEditDraft({ ...editDraft, rotulo: e.target.value })}
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
                              onChange={(e) => setEditDraft({ ...editDraft, valorAVista: e.target.value })}
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
                              onChange={(e) => setEditDraft({ ...editDraft, valorTotal: e.target.value })}
                              title="Valor total parcelado"
                            />
                            <span style={{ color: 'var(--text3)' }}>em</span>
                            <input
                              type="number"
                              className="di"
                              min={1}
                              style={{ width: 56 }}
                              value={editDraft.parcelas}
                              onChange={(e) => setEditDraft({ ...editDraft, parcelas: e.target.value })}
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
                              onChange={() => setEditDraft({ ...editDraft, linhaPrecoRole: 'ideal' })}
                            />
                            Preço ideal (sem desconto)
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                            <input
                              type="radio"
                              name={`tipo-${l.id}`}
                              checked={editDraft.linhaPrecoRole === 'desconto'}
                              onChange={() => setEditDraft({ ...editDraft, linhaPrecoRole: 'desconto' })}
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
                    <td style={{ fontSize: 12, maxWidth: 160, verticalAlign: 'top' }}>
                      {isEd && editDraft ? (
                        <input
                          type="text"
                          className="di"
                          style={{ width: '100%' }}
                          value={editDraft.possibilidadeBonus}
                          onChange={(e) => setEditDraft({ ...editDraft, possibilidadeBonus: e.target.value })}
                          placeholder="Ex.: Sim, material extra"
                        />
                      ) : (
                        <span style={{ color: l.possibilidadeBonus ? 'var(--text)' : 'var(--text3)' }}>
                          {l.possibilidadeBonus?.trim() || '—'}
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
                          onChange={(e) => setEditDraft({ ...editDraft, linkCartao: e.target.value })}
                          placeholder="https://..."
                        />
                      ) : l.linkCartao ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                          <a href={l.linkCartao} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ width: 'auto' }}>
                            Abrir
                          </a>
                          <button type="button" className="btn btn-ghost btn-sm" style={{ width: 'auto' }} onClick={() => copyLink(l.linkCartao!)}>
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
                            <button type="button" className="btn btn-primary btn-sm" disabled={savingId === l.id} onClick={() => saveEdit(l.id)}>
                              {savingId === l.id ? '...' : 'Salvar'}
                            </button>{' '}
                            <button type="button" className="btn btn-ghost btn-sm" onClick={cancelEdit}>
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(l)}>
                              Editar
                            </button>{' '}
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(l)}>
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
            <input type="number" className="di" min={1} value={novo.parcelas} onChange={(e) => setNovo((n) => ({ ...n, parcelas: e.target.value }))} />
          </div>
          <div className="fg" style={{ margin: 0, gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11 }}>Possibilidade de bônus</label>
            <input
              type="text"
              className="di"
              value={novo.possibilidadeBonus}
              onChange={(e) => setNovo((n) => ({ ...n, possibilidadeBonus: e.target.value }))}
              placeholder="Ex.: Sim, 2 mentorias extras"
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
                const ok = await handleAdd(produto.id, novo)
                if (ok) {
                  setNovo({
                    rotulo: '',
                    valorTotal: '',
                    valorAVista: '',
                    parcelas: '1',
                    linkCartao: '',
                    possibilidadeBonus: '',
                    linhaPrecoRole: tinhaIdeal || esteEhIdeal ? 'desconto' : 'ideal'
                  })
                }
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
