import { useState, useEffect } from 'react'
import { Package, Pencil } from 'lucide-react'
import {
  addProduto,
  updateProduto,
  emptyBlocoPrecoTabela,
  emptyBlocoCondicaoComercial,
  emptyPacoteNegociacao,
  type ProdutoBlocoCondicaoComercial,
  type ProdutoBlocoPrecoTabela
} from '../../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../../lib/firebaseUserFacingError'
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
    linkPagamento: b.linkPagamento ?? '',
    textoSelo: b.textoSelo?.trim() ? b.textoSelo : ''
  }
}

function blocoCondToStrings(b: ProdutoBlocoCondicaoComercial) {
  return {
    valorAVista: b.valorAVista != null ? String(b.valorAVista) : '',
    valorParceladoCartao: b.valorParceladoCartao != null ? String(b.valorParceladoCartao) : '',
    parcelasCartao: b.parcelasCartao != null ? String(b.parcelasCartao) : '',
    bonus: b.bonus ?? '',
    linkPagamento: b.linkPagamento ?? '',
    tagExibicao:
      b.tagExibicao === 'risco_alto' ? 'risco_alto' : b.tagExibicao === 'desconto' ? 'desconto' : ''
  }
}

type TabPeriodo = '3' | '6'

export function ProdutoFormModal() {
  const { closeModal, showToast, editingProduto, setEditingProduto, currentUser } = useAppStore()
  const podeEditar = currentUser?.cargo === 'admin'
  const [nome, setNome] = useState('')
  const [abaPeriodo, setAbaPeriodo] = useState<TabPeriodo>('3')
  const [pt, setPt] = useState(() => blocoTabelaToStrings(emptyBlocoPrecoTabela()))
  const [of, setOf] = useState(() => blocoCondToStrings(emptyBlocoCondicaoComercial()))
  const [uc, setUc] = useState(() => blocoCondToStrings(emptyBlocoCondicaoComercial()))
  const [cm, setCm] = useState(() => blocoCondToStrings(emptyBlocoCondicaoComercial()))
  const [pt6, setPt6] = useState(() => blocoTabelaToStrings(emptyBlocoPrecoTabela()))
  const [of6, setOf6] = useState(() => blocoCondToStrings(emptyBlocoCondicaoComercial()))
  const [uc6, setUc6] = useState(() => blocoCondToStrings(emptyBlocoCondicaoComercial()))
  const [cm6, setCm6] = useState(() => blocoCondToStrings(emptyBlocoCondicaoComercial()))
  const [loading, setLoading] = useState(false)

  const isEdit = editingProduto != null

  useEffect(() => {
    if (editingProduto) {
      setNome(editingProduto.nome)
      setPt(blocoTabelaToStrings(editingProduto.blocoPrecoTabela))
      setOf(blocoCondToStrings(editingProduto.blocoOferta))
      setUc(blocoCondToStrings(editingProduto.blocoUltimaCondicao))
      setCm(blocoCondToStrings(editingProduto.blocoCartaNaManga))
      const n6 = editingProduto.negociacao6Meses
      setPt6(blocoTabelaToStrings(n6.blocoPrecoTabela))
      setOf6(blocoCondToStrings(n6.blocoOferta))
      setUc6(blocoCondToStrings(n6.blocoUltimaCondicao))
      setCm6(blocoCondToStrings(n6.blocoCartaNaManga))
    } else {
      setNome('')
      setPt(blocoTabelaToStrings(emptyBlocoPrecoTabela()))
      setOf(blocoCondToStrings(emptyBlocoCondicaoComercial()))
      setUc(blocoCondToStrings(emptyBlocoCondicaoComercial()))
      setCm(blocoCondToStrings(emptyBlocoCondicaoComercial()))
      const empty6 = emptyPacoteNegociacao()
      setPt6(blocoTabelaToStrings(empty6.blocoPrecoTabela))
      setOf6(blocoCondToStrings(empty6.blocoOferta))
      setUc6(blocoCondToStrings(empty6.blocoUltimaCondicao))
      setCm6(blocoCondToStrings(empty6.blocoCartaNaManga))
    }
    setAbaPeriodo('3')
  }, [editingProduto])

  function buildBlocoTabela(s: typeof pt): ProdutoBlocoPrecoTabela {
    return {
      valorTotal: parseMoney(s.valorTotal),
      valorAVista: parseMoney(s.valorAVista),
      valorParceladoCartao: parseMoney(s.valorParceladoCartao),
      parcelasCartao: parseIntOrNull(s.parcelasCartao),
      linkPagamento: s.linkPagamento.trim() || null,
      textoSelo: s.textoSelo.trim() || null
    }
  }

  function buildBlocoCond(s: typeof of): ProdutoBlocoCondicaoComercial {
    const tag =
      s.tagExibicao === 'risco_alto'
        ? 'risco_alto'
        : s.tagExibicao === 'desconto'
          ? 'desconto'
          : null
    return {
      valorAVista: parseMoney(s.valorAVista),
      valorParceladoCartao: parseMoney(s.valorParceladoCartao),
      parcelasCartao: parseIntOrNull(s.parcelasCartao),
      bonus: s.bonus.trim() || null,
      linkPagamento: s.linkPagamento.trim() || null,
      tagExibicao: tag
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
      blocoPrecoTabela: buildBlocoTabela(pt),
      blocoOferta: buildBlocoCond(of),
      blocoUltimaCondicao: buildBlocoCond(uc),
      blocoCartaNaManga: buildBlocoCond(cm),
      negociacao6Meses: {
        blocoPrecoTabela: buildBlocoTabela(pt6),
        blocoOferta: buildBlocoCond(of6),
        blocoUltimaCondicao: buildBlocoCond(uc6),
        blocoCartaNaManga: buildBlocoCond(cm6)
      }
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
      showToast(`Erro: ${formatFirebaseOrUnknownError(err)}`, 'err')
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

  type CondSec = {
    title: string
    state: typeof of
    set: React.Dispatch<React.SetStateAction<typeof of>>
    id: string
  }

  function renderPacoteForm(
    ptState: typeof pt,
    setPtState: typeof setPt,
    sections: readonly CondSec[]
  ) {
    return (
      <>
        <div style={secStyle}>
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>Preço de tabela</div>
          <p style={{ fontSize: 12, color: 'var(--text2)', margin: '0 0 12px' }}>
            Valor total, à vista, total parcelado no cartão e parcelas. Selo opcional (ex.: economia vs. trimestral no
            contrato 6 meses).
          </p>
          <div style={grid2}>
            <div className="fg" style={{ margin: 0 }}>
              <label>Valor total (R$)</label>
              <input
                type="number"
                step="0.01"
                value={ptState.valorTotal}
                onChange={(e) => setPtState((x) => ({ ...x, valorTotal: e.target.value }))}
                disabled={!podeEditar}
              />
            </div>
            <div className="fg" style={{ margin: 0 }}>
              <label>À vista (R$)</label>
              <input
                type="number"
                step="0.01"
                value={ptState.valorAVista}
                onChange={(e) => setPtState((x) => ({ ...x, valorAVista: e.target.value }))}
                disabled={!podeEditar}
              />
            </div>
            <div className="fg" style={{ margin: 0 }}>
              <label>Total parcelado cartão (R$)</label>
              <input
                type="number"
                step="0.01"
                value={ptState.valorParceladoCartao}
                onChange={(e) => setPtState((x) => ({ ...x, valorParceladoCartao: e.target.value }))}
                disabled={!podeEditar}
              />
            </div>
            <div className="fg" style={{ margin: 0 }}>
              <label>Parcelas no cartão</label>
              <input
                type="number"
                min={1}
                value={ptState.parcelasCartao}
                onChange={(e) => setPtState((x) => ({ ...x, parcelasCartao: e.target.value }))}
                disabled={!podeEditar}
                placeholder="ex: 3 ou 6"
              />
            </div>
            <div className="fg" style={{ margin: 0, gridColumn: '1 / -1' }}>
              <label>Texto do selo (opcional)</label>
              <input
                type="text"
                value={ptState.textoSelo}
                onChange={(e) => setPtState((x) => ({ ...x, textoSelo: e.target.value }))}
                disabled={!podeEditar}
                placeholder='Ex.: Economia de R$ 1.200 vs 2x trimestral'
              />
            </div>
            <div className="fg" style={{ margin: 0, gridColumn: '1 / -1' }}>
              <label>Link de pagamento</label>
              <input
                type="url"
                value={ptState.linkPagamento}
                onChange={(e) => setPtState((x) => ({ ...x, linkPagamento: e.target.value }))}
                disabled={!podeEditar}
                placeholder="https://..."
              />
            </div>
          </div>
        </div>

        {sections.map(({ title, state, set, id }) => (
          <div key={id} style={secStyle}>
            <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>{title}</div>
            <p style={{ fontSize: 12, color: 'var(--text2)', margin: '0 0 12px' }}>
              À vista, parcelado, bônus, tag na coluna “Tipo” e link de pagamento.
            </p>
            <div style={grid2}>
              <div className="fg" style={{ margin: 0 }}>
                <label htmlFor={`${id}-av`}>À vista (R$)</label>
                <input
                  id={`${id}-av`}
                  type="number"
                  step="0.01"
                  value={state.valorAVista}
                  onChange={(e) => set((s) => ({ ...s, valorAVista: e.target.value }))}
                  disabled={!podeEditar}
                />
              </div>
              <div className="fg" style={{ margin: 0 }}>
                <label htmlFor={`${id}-vpc`}>Total parcelado cartão (R$)</label>
                <input
                  id={`${id}-vpc`}
                  type="number"
                  step="0.01"
                  value={state.valorParceladoCartao}
                  onChange={(e) => set((s) => ({ ...s, valorParceladoCartao: e.target.value }))}
                  disabled={!podeEditar}
                />
              </div>
              <div className="fg" style={{ margin: 0 }}>
                <label htmlFor={`${id}-pc`}>Parcelas</label>
                <input
                  id={`${id}-pc`}
                  type="number"
                  min={1}
                  value={state.parcelasCartao}
                  onChange={(e) => set((s) => ({ ...s, parcelasCartao: e.target.value }))}
                  disabled={!podeEditar}
                />
              </div>
              <div className="fg" style={{ margin: 0 }}>
                <label htmlFor={`${id}-tag`}>Tag “Tipo”</label>
                <select
                  id={`${id}-tag`}
                  value={state.tagExibicao}
                  onChange={(e) => set((s) => ({ ...s, tagExibicao: e.target.value }))}
                  disabled={!podeEditar}
                >
                  <option value="">Desconto (padrão)</option>
                  <option value="desconto">Desconto (explícito)</option>
                  <option value="risco_alto">Risco alto</option>
                </select>
              </div>
              <div className="fg" style={{ margin: 0, gridColumn: '1 / -1' }}>
                <label htmlFor={`${id}-bonus`}>Bônus</label>
                <textarea
                  id={`${id}-bonus`}
                  rows={2}
                  value={state.bonus}
                  onChange={(e) => set((s) => ({ ...s, bonus: e.target.value }))}
                  disabled={!podeEditar}
                  placeholder="O que entra a mais nesta condição"
                />
              </div>
              <div className="fg" style={{ margin: 0, gridColumn: '1 / -1' }}>
                <label htmlFor={`${id}-link`}>Link de pagamento</label>
                <input
                  id={`${id}-link`}
                  type="url"
                  value={state.linkPagamento}
                  onChange={(e) => set((s) => ({ ...s, linkPagamento: e.target.value }))}
                  disabled={!podeEditar}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>
        ))}
      </>
    )
  }

  const cond3 = [
    { title: 'Oferta promocional', state: of, set: setOf, id: 'of' },
    { title: 'Última condição', state: uc, set: setUc, id: 'uc' },
    { title: 'Carta na manga', state: cm, set: setCm, id: 'cm' }
  ] as const

  const cond6 = [
    { title: 'Oferta promocional', state: of6, set: setOf6, id: 'of6' },
    { title: 'Última condição', state: uc6, set: setUc6, id: 'uc6' },
    { title: 'Carta na manga', state: cm6, set: setCm6, id: 'cm6' }
  ] as const

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <div className="mh" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="mt modal-title-ic" style={{ fontSize: 18, fontWeight: 700 }}>
          {isEdit ? <Pencil size={22} strokeWidth={1.65} aria-hidden /> : <Package size={22} strokeWidth={1.65} aria-hidden />}
          {isEdit ? 'Editar produto' : 'Novo produto'}
        </div>
        <button
          type="button"
          className="mc"
          onClick={handleClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text2)' }}
        >
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

          <div
            style={{
              marginTop: 18,
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center'
            }}
            role="tablist"
            aria-label="Período do contrato"
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginRight: 4 }}>Negociação:</span>
            <button
              type="button"
              role="tab"
              aria-selected={abaPeriodo === '3'}
              className={abaPeriodo === '3' ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }}
              onClick={() => setAbaPeriodo('3')}
            >
              3 meses
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={abaPeriodo === '6'}
              className={abaPeriodo === '6' ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }}
              onClick={() => setAbaPeriodo('6')}
            >
              6 meses
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text2)', margin: '10px 0 0' }}>
            Cadastre valores distintos para cada período. Contratos antigos sem bloco 6 meses passam a usar uma cópia do
            pacote de 3 meses até você editar.
          </p>

          {abaPeriodo === '3' ? renderPacoteForm(pt, setPt, cond3) : renderPacoteForm(pt6, setPt6, cond6)}
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
