import { useState, useEffect } from 'react'
import { CreditCard, FileText, Package, Pencil } from 'lucide-react'
import { addProduto, updateProduto } from '../../firebase/firestore'
import { useAppStore } from '../../store/useAppStore'

function fmt(v: number | null): string {
  if (v == null || Number.isNaN(v)) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export function ProdutoFormModal() {
  const { closeModal, showToast, editingProduto, setEditingProduto } = useAppStore()
  const [nome, setNome] = useState('')
  const [valorCartao, setValorCartao] = useState('')
  const [parcelasCartao, setParcelasCartao] = useState('')
  const [valorBoleto, setValorBoleto] = useState('')
  const [parcelasBoleto, setParcelasBoleto] = useState('')
  const [aVista, setAVista] = useState('')
  const [desc, setDesc] = useState('')
  const [loading, setLoading] = useState(false)

  const isEdit = editingProduto != null

  const vCartao = valorCartao ? parseFloat(valorCartao) : null
  const pCartao = parcelasCartao ? Math.max(1, parseInt(parcelasCartao, 10) || 1) : null
  const valorParcelaCartao = vCartao != null && pCartao != null && pCartao > 0 ? vCartao / pCartao : null

  const vBoleto = valorBoleto ? parseFloat(valorBoleto) : null
  const pBoleto = parcelasBoleto ? Math.max(1, parseInt(parcelasBoleto, 10) || 1) : null
  const valorParcelaBoleto = vBoleto != null && pBoleto != null && pBoleto > 0 ? vBoleto / pBoleto : null

  useEffect(() => {
    if (editingProduto) {
      setNome(editingProduto.nome)
      setValorCartao(editingProduto.valorCartao != null ? String(editingProduto.valorCartao) : '')
      setParcelasCartao(editingProduto.parcelasCartao != null ? String(editingProduto.parcelasCartao) : '')
      setValorBoleto(editingProduto.valorBoleto != null ? String(editingProduto.valorBoleto) : '')
      setParcelasBoleto(editingProduto.parcelasBoleto != null ? String(editingProduto.parcelasBoleto) : '')
      setAVista(editingProduto.aVista != null ? String(editingProduto.aVista) : '')
      setDesc(editingProduto.desc ?? '')
    } else {
      setNome('')
      setValorCartao('')
      setParcelasCartao('')
      setValorBoleto('')
      setParcelasBoleto('')
      setAVista('')
      setDesc('')
    }
  }, [editingProduto])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const n = nome.trim()
    if (!n) {
      showToast('Informe o nome do produto', 'err')
      return
    }
    setLoading(true)
    try {
      const vC = valorCartao ? parseFloat(valorCartao) : null
      const pC = parcelasCartao ? Math.max(1, parseInt(parcelasCartao, 10) || 1) : null
      const vB = valorBoleto ? parseFloat(valorBoleto) : null
      const pB = parcelasBoleto ? Math.max(1, parseInt(parcelasBoleto, 10) || 1) : null
      const aV = aVista ? parseFloat(aVista) : null
      const d = desc.trim() || null
      if (isEdit && editingProduto) {
        await updateProduto(editingProduto.id, {
          nome: n,
          valorCartao: vC,
          parcelasCartao: pC,
          valorBoleto: vB,
          parcelasBoleto: pB,
          aVista: aV,
          desc: d
        })
        showToast(`${n} atualizado`)
      } else {
        await addProduto({
          nome: n,
          valorCartao: vC,
          parcelasCartao: pC,
          valorBoleto: vB,
          parcelasBoleto: pB,
          aVista: aV,
          desc: d
        })
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

  return (
    <div style={{ padding: 24 }}>
      <div className="mh" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="mt modal-title-ic" style={{ fontSize: 18, fontWeight: 700 }}>
          {isEdit ? <Pencil size={22} strokeWidth={1.65} aria-hidden /> : <Package size={22} strokeWidth={1.65} aria-hidden />}
          {isEdit ? 'Editar Produto' : 'Novo Produto'}
        </div>
        <button type="button" className="mc" onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text2)' }}>
          ✕
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="fg">
          <label htmlFor="p-nome">Nome *</label>
          <input id="p-nome" type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do produto" />
        </div>

        <div style={{ marginTop: 20, padding: '12px 0', borderTop: '1px solid var(--border2)' }}>
          <div style={{ fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={18} strokeWidth={1.65} aria-hidden style={{ color: 'var(--accent)', flexShrink: 0 }} />
            Cartão (sem juros)
          </div>
          <div className="fg">
            <label htmlFor="p-valor-cartao">Valor do produto no cartão (R$)</label>
            <input id="p-valor-cartao" type="number" step="0.01" value={valorCartao} onChange={(e) => setValorCartao(e.target.value)} placeholder="0,00" />
          </div>
          <div className="fg">
            <label htmlFor="p-parcelas-cartao">Número de parcelas</label>
            <input id="p-parcelas-cartao" type="number" min={1} value={parcelasCartao} onChange={(e) => setParcelasCartao(e.target.value)} placeholder="Ex: 3, 6, 12" />
          </div>
          <div className="fg">
            <label>Valor por parcela</label>
            <div style={{ padding: '8px 12px', background: 'var(--bg2)', borderRadius: 8, color: 'var(--green)', fontWeight: 600 }}>
              {fmt(valorParcelaCartao)}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20, padding: '12px 0', borderTop: '1px solid var(--border2)' }}>
          <div style={{ fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} strokeWidth={1.65} aria-hidden style={{ color: 'var(--accent)', flexShrink: 0 }} />
            Boleto
          </div>
          <div className="fg">
            <label htmlFor="p-valor-boleto">Valor do produto no boleto (R$)</label>
            <input id="p-valor-boleto" type="number" step="0.01" value={valorBoleto} onChange={(e) => setValorBoleto(e.target.value)} placeholder="0,00" />
          </div>
          <div className="fg">
            <label htmlFor="p-parcelas-boleto">Número de parcelas</label>
            <input id="p-parcelas-boleto" type="number" min={1} value={parcelasBoleto} onChange={(e) => setParcelasBoleto(e.target.value)} placeholder="Ex: 1, 3, 6" />
          </div>
          <div className="fg">
            <label>Valor por parcela no boleto</label>
            <div style={{ padding: '8px 12px', background: 'var(--bg2)', borderRadius: 8, color: 'var(--green)', fontWeight: 600 }}>
              {fmt(valorParcelaBoleto)}
            </div>
          </div>
        </div>

        <div className="fg" style={{ marginTop: 20 }}>
          <label htmlFor="p-avista">Valor à vista (R$)</label>
          <input id="p-avista" type="number" step="0.01" value={aVista} onChange={(e) => setAVista(e.target.value)} placeholder="0,00" />
        </div>
        <div className="fg">
          <label htmlFor="p-desc">Descrição</label>
          <textarea id="p-desc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="Opcional" />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" className="btn btn-ghost" onClick={handleClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 28px' }} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}
