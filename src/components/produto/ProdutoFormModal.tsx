import { useState, useEffect } from 'react'
import { Package, Pencil } from 'lucide-react'
import {
  addProduto,
  updateProduto,
  emptyBlocoPrecoTabela,
  emptyBlocoCondicaoComercial,
  type ProdutoBlocoCondicaoComercial,
  type ProdutoBlocoPrecoTabela
} from '../../firebase/firestore'
import { useAppStore } from '../../store/useAppStore'

function parseMoney(s: string): number | null {
  const t = s.trim()
  if (!t) return null
  const n = parseFloat(t.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function parseIntOrNull(s: string): number | null {
  const t = s.trim()
  if (!t) return null
  const n = parseInt(t, 10)
  return Number.isFinite(n) && n >= 1 ? n : null
}

function blocoTabelaToStrings(b: ProdutoBlocoPrecoTabela) {
  return {
    valorTotal: b.valorTotal != null ? String(b.valorTotal) : '',
    valorAVista: b.valorAVista != null ? String(b.valorAVista) : '',
    valorParceladoCartao: b.valorParceladoCartao != null ? String(b.valorParceladoCartao) : '',
    parcelasCartao: b.parcelasCartao != null ? String(b.parcelasCartao) : '',
    linkPagamento: b.linkPagamento ?? ''
  }
}

function blocoCondToStrings(b: ProdutoBlocoCondicaoComercial) {
  return {
    valorAVista: b.valorAVista != null ? String(b.valorAVista) : '',
    valorParceladoCartao: b.valorParceladoCartao != null ? String(b.valorParceladoCartao) : '',
    parcelasCartao: b.parcelasCartao != null ? String(b.parcelasCartao) : '',
    bonus: b.bonus ?? '',
    linkPagamento: b.linkPagamento ?? ''
  }
}

export function ProdutoFormModal() {
  const { closeModal, showToast, editingProduto, setEditingProduto, currentUser } = useAppStore()
  const podeEditar = currentUser?.cargo === 'admin'
  const [nome, setNome] = useState('')
  const [pt, setPt] = useState(() => blocoTabelaToStrings(emptyBlocoPrecoTabela()))
  const [of, setOf] = useState(() => blocoCondToStrings(emptyBlocoCondicaoComercial()))
  const [uc, setUc] = useState(() => blocoCondToStrings(emptyBlocoCondicaoComercial()))
  const [cm, setCm] = useState(() => blocoCondToStrings(emptyBlocoCondicaoComercial()))
  const [loading, setLoading] = useState(false)

  const isEdit = editingProduto != null

  useEffect(() => {
    if (editingProduto) {
      setNome(editingProduto.nome)
      setPt(blocoTabelaToStrings(editingProduto.blocoPrecoTabela))
      setOf(blocoCondToStrings(editingProduto.blocoOferta))
      setUc(blocoCondToStrings(editingProduto.blocoUltimaCondicao))
      setCm(blocoCondToStrings(editingProduto.blocoCartaNaManga))
    } else {
      setNome('')
      setPt(blocoTabelaToStrings(emptyBlocoPrecoTabela()))
      setOf(blocoCondToStrings(emptyBlocoCondicaoComercial()))
      setUc(blocoCondToStrings(emptyBlocoCondicaoComercial()))
      setCm(blocoCondToStrings(emptyBlocoCondicaoComercial()))
    }
  }, [editingProduto])

  function buildBlocoTabela(): ProdutoBlocoPrecoTabela {
    return {
      valorTotal: parseMoney(pt.valorTotal),
      valorAVista: parseMoney(pt.valorAVista),
      valorParceladoCartao: parseMoney(pt.valorParceladoCartao),
      parcelasCartao: parseIntOrNull(pt.parcelasCartao),
      linkPagamento: pt.linkPagamento.trim() || null
    }
  }

  function buildBlocoCond(s: typeof of): ProdutoBlocoCondicaoComercial {
    return {
      valorAVista: parseMoney(s.valorAVista),
      valorParceladoCartao: parseMoney(s.valorParceladoCartao),
      parcelasCartao: parseIntOrNull(s.parcelasCartao),
      bonus: s.bonus.trim() || null,
      linkPagamento: s.linkPagamento.trim() || null
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!podeEditar) {
      showToast('Apenas administradores podem alterar produtos', 'err')
      return
    }
    const n = nome.trim()
    if (!n) {
      showToast('Informe o nome do produto', 'err')
      return
    }
    const payload = {
      nome: n,
      blocoPrecoTabela: buildBlocoTabela(),
      blocoOferta: buildBlocoCond(of),
      blocoUltimaCondicao: buildBlocoCond(uc),
      blocoCartaNaManga: buildBlocoCond(cm)
    }

    setLoading(true)
    try {
      if (isEdit && editingProduto) {
        await updateProduto(editingProduto.id, payload)
        showToast(`${n} atualizado`)
      } else {
        await addProduto(payload)
        showToast(`${n} cadastrado`)
      }
      setEditingProduto(null)
      closeModal()
      useAppStore.getState().incrementProdutosVersion()
    } catch (err) {
      showToast(`Erro: ${err instanceof Error ? err.message : 'Erro'}`, 'err')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setEditingProduto(null)
    closeModal()
  }

  const secStyle: React.CSSProperties = {
    marginTop: 20,
    paddingTop: 16,
    borderTop: '1px solid var(--border2)'
  }
  const grid2: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 12,
    alignItems: 'end'
  }

  return (
    <div style={{ padding: 24, maxWidth: 640 }}>
      <div className="mh" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="mt modal-title-ic" style={{ fontSize: 18, fontWeight: 700 }}>
          {isEdit ? <Pencil size={22} strokeWidth={1.65} aria-hidden /> : <Package size={22} strokeWidth={1.65} aria-hidden />}
          {isEdit ? 'Editar produto' : 'Novo produto'}
        </div>
        <button type="button" className="mc" onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text2)' }}>
          ✕
        </button>
      </div>
      {!podeEditar && (
        <p style={{ color: 'var(--text2)', marginBottom: 16, fontSize: 13 }}>
          Apenas administradores podem cadastrar ou editar produtos.
        </p>
      )}
      <form onSubmit={handleSubmit}>
        <div style={{ maxHeight: 'min(72vh, 620px)', overflowY: 'auto', paddingRight: 6 }}>
          <div className="fg">
            <label htmlFor="p-nome">Nome do produto *</label>
            <input id="p-nome" type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do produto" disabled={!podeEditar} />
          </div>

          <div style={secStyle}>
            <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>Preço de tabela</div>
            <p style={{ fontSize: 12, color: 'var(--text2)', margin: '0 0 12px' }}>
              Valor total do pacote, condição à vista e total parcelado no cartão (com número de parcelas). Link opcional para checkout.
            </p>
            <div style={grid2}>
              <div className="fg" style={{ margin: 0 }}>
                <label htmlFor="pt-total">Valor total (R$)</label>
                <input id="pt-total" type="number" step="0.01" value={pt.valorTotal} onChange={(e) => setPt((x) => ({ ...x, valorTotal: e.target.value }))} disabled={!podeEditar} />
              </div>
              <div className="fg" style={{ margin: 0 }}>
                <label htmlFor="pt-av">À vista (R$)</label>
                <input id="pt-av" type="number" step="0.01" value={pt.valorAVista} onChange={(e) => setPt((x) => ({ ...x, valorAVista: e.target.value }))} disabled={!podeEditar} />
              </div>
              <div className="fg" style={{ margin: 0 }}>
                <label htmlFor="pt-vpc">Total parcelado cartão (R$)</label>
                <input id="pt-vpc" type="number" step="0.01" value={pt.valorParceladoCartao} onChange={(e) => setPt((x) => ({ ...x, valorParceladoCartao: e.target.value }))} disabled={!podeEditar} />
              </div>
              <div className="fg" style={{ margin: 0 }}>
                <label htmlFor="pt-pc">Parcelas no cartão</label>
                <input id="pt-pc" type="number" min={1} value={pt.parcelasCartao} onChange={(e) => setPt((x) => ({ ...x, parcelasCartao: e.target.value }))} disabled={!podeEditar} placeholder="ex: 12" />
              </div>
              <div className="fg" style={{ margin: 0, gridColumn: '1 / -1' }}>
                <label htmlFor="pt-link">Link de pagamento</label>
                <input id="pt-link" type="url" value={pt.linkPagamento} onChange={(e) => setPt((x) => ({ ...x, linkPagamento: e.target.value }))} disabled={!podeEditar} placeholder="https://..." />
              </div>
            </div>
          </div>

          {(
            [
              { title: 'Oferta promocional', state: of, set: setOf, id: 'of' },
              { title: 'Última condição', state: uc, set: setUc, id: 'uc' },
              { title: 'Carta na manga', state: cm, set: setCm, id: 'cm' }
            ] as const
          ).map(({ title, state, set, id }) => (
            <div key={id} style={secStyle}>
              <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>{title}</div>
              <p style={{ fontSize: 12, color: 'var(--text2)', margin: '0 0 12px' }}>
                À vista, total parcelado no cartão, parcelas, bônus oferecidos e link de pagamento para agilizar a venda.
              </p>
              <div style={grid2}>
                <div className="fg" style={{ margin: 0 }}>
                  <label htmlFor={`${id}-av`}>À vista (R$)</label>
                  <input id={`${id}-av`} type="number" step="0.01" value={state.valorAVista} onChange={(e) => set((s) => ({ ...s, valorAVista: e.target.value }))} disabled={!podeEditar} />
                </div>
                <div className="fg" style={{ margin: 0 }}>
                  <label htmlFor={`${id}-vpc`}>Total parcelado cartão (R$)</label>
                  <input id={`${id}-vpc`} type="number" step="0.01" value={state.valorParceladoCartao} onChange={(e) => set((s) => ({ ...s, valorParceladoCartao: e.target.value }))} disabled={!podeEditar} />
                </div>
                <div className="fg" style={{ margin: 0 }}>
                  <label htmlFor={`${id}-pc`}>Parcelas</label>
                  <input id={`${id}-pc`} type="number" min={1} value={state.parcelasCartao} onChange={(e) => set((s) => ({ ...s, parcelasCartao: e.target.value }))} disabled={!podeEditar} />
                </div>
                <div className="fg" style={{ margin: 0, gridColumn: '1 / -1' }}>
                  <label htmlFor={`${id}-bonus`}>Bônus</label>
                  <textarea id={`${id}-bonus`} rows={2} value={state.bonus} onChange={(e) => set((s) => ({ ...s, bonus: e.target.value }))} disabled={!podeEditar} placeholder="O que entra a mais nesta condição" />
                </div>
                <div className="fg" style={{ margin: 0, gridColumn: '1 / -1' }}>
                  <label htmlFor={`${id}-link`}>Link de pagamento</label>
                  <input id={`${id}-link`} type="url" value={state.linkPagamento} onChange={(e) => set((s) => ({ ...s, linkPagamento: e.target.value }))} disabled={!podeEditar} placeholder="https://..." />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20, paddingTop: 12, borderTop: '1px solid var(--border2)' }}>
          <button type="button" className="btn btn-ghost" onClick={handleClose}>
            {podeEditar ? 'Cancelar' : 'Fechar'}
          </button>
          {podeEditar ? (
            <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 28px' }} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          ) : null}
        </div>
      </form>
    </div>
  )
}
