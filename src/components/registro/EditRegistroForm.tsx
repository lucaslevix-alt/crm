import { useState, useEffect } from 'react'
import { listUsers, getProdutos } from '../../firebase/firestore'
import { updateRegistro } from '../../firebase/firestore'
import type { ProdutoRow } from '../../firebase/firestore'
import type { CrmUser } from '../../store/useAppStore'
import { useAppStore } from '../../store/useAppStore'

interface ProdutoSelecionadoItem {
  uid: string
  produtoId: string
  quantidade: string
}

export function EditRegistroForm() {
  const { editingRegistro, closeModal, setEditingRegistro, showToast, incrementRegistrosVersion } = useAppStore()
  const [users, setUsers] = useState<CrmUser[]>([])
  const [produtos, setProdutos] = useState<ProdutoRow[]>([])
  const [data, setData] = useState('')
  const [tipo, setTipo] = useState('reuniao_agendada')
  const [userId, setUserId] = useState('')
  const [anuncio, setAnuncio] = useState('')
  const [valor, setValor] = useState('')
  const [cashCollected, setCashCollected] = useState('')
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)
  const [produtoItems, setProdutoItems] = useState<ProdutoSelecionadoItem[]>([])

  useEffect(() => {
    if (!editingRegistro) return
    setData(editingRegistro.data)
    setTipo(editingRegistro.tipo)
    setUserId(editingRegistro.userId)
    setAnuncio(editingRegistro.anuncio ?? '')
    setValor(String(editingRegistro.valor || ''))
    setCashCollected(String(editingRegistro.cashCollected || ''))
    setObs(editingRegistro.obs ?? '')
    setProdutoItems(
      editingRegistro.produtosDetalhes && editingRegistro.produtosDetalhes.length > 0
        ? editingRegistro.produtosDetalhes.map((item, index) => ({
            uid: `${editingRegistro.id}-${index}`,
            produtoId: item.produtoId,
            quantidade: String(item.quantidade || 1)
          }))
        : []
    )
    listUsers().then(setUsers)
    getProdutos().then(setProdutos)
  }, [editingRegistro])

  const filteredUsers =
    tipo === 'reuniao_agendada' || tipo === 'reuniao_realizada'
      ? users.filter((u) => u.cargo === 'sdr' || u.cargo === 'admin')
      : tipo === 'reuniao_closer' || tipo === 'venda'
        ? users.filter((u) => u.cargo === 'closer' || u.cargo === 'admin')
        : users

  function addProdutoItem() {
    setProdutoItems((current) => [
      ...current,
      { uid: `${Date.now()}-${Math.random()}`, produtoId: '', quantidade: '1' }
    ])
  }

  function updateProdutoItem(uid: string, key: 'produtoId' | 'quantidade', value: string) {
    setProdutoItems((current) =>
      current.map((item) => (item.uid === uid ? { ...item, [key]: value } : item))
    )
  }

  function removeProdutoItem(uid: string) {
    setProdutoItems((current) => current.filter((item) => item.uid !== uid))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingRegistro) return
    if (!data || !tipo || !userId) {
      showToast('Preencha data, tipo e profissional', 'err')
      return
    }
    if (tipo === 'venda' && !parseFloat(valor)) {
      showToast('Informe o valor da venda', 'err')
      return
    }
    const u = users.find((x) => x.id === userId)
    const produtosDetalhes = produtoItems
      .map((item) => ({
        produtoId: item.produtoId,
        quantidade: Math.max(1, parseInt(item.quantidade || '1', 10) || 1)
      }))
      .filter((item) => item.produtoId)
    setSaving(true)
    try {
      await updateRegistro(editingRegistro.id, {
        data,
        tipo,
        userId,
        userName: u?.nome ?? '—',
        userCargo: u?.cargo ?? '—',
        anuncio: anuncio.trim() || null,
        valor: tipo === 'venda' ? parseFloat(valor) || 0 : 0,
        cashCollected: tipo === 'venda' ? parseFloat(cashCollected) || 0 : 0,
        obs: obs.trim() || null,
        produtosIds: tipo === 'venda' ? produtosDetalhes.flatMap((item) => Array(item.quantidade).fill(item.produtoId)) : [],
        produtosDetalhes: tipo === 'venda' ? produtosDetalhes : []
      })
      showToast('Registro atualizado!')
      setEditingRegistro(null)
      closeModal()
      incrementRegistrosVersion()
    } catch (err) {
      showToast('Erro: ' + (err instanceof Error ? err.message : String(err)), 'err')
    } finally {
      setSaving(false)
    }
  }

  if (!editingRegistro) return null

  const isVenda = tipo === 'venda'

  return (
    <div style={{ padding: 24 }}>
      <div className="mh">
        <div className="mt">✏️ Editar Registro</div>
        <button type="button" className="mc" onClick={() => { setEditingRegistro(null); closeModal() }}>
          ✕
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="fg2">
          <div className="fg">
            <label>Data *</label>
            <input type="date" className="di" value={data} onChange={(e) => setData(e.target.value)} required />
          </div>
          <div className="fg">
            <label>Tipo *</label>
            <select className="di" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="reuniao_agendada">Reunião Agendada (SDR)</option>
              <option value="reuniao_realizada">Reunião Realizada (SDR)</option>
              <option value="reuniao_closer">Reunião Closer</option>
              <option value="venda">Venda (Closer)</option>
            </select>
          </div>
          <div className="fg">
            <label>Profissional *</label>
            <select className="di" value={userId} onChange={(e) => setUserId(e.target.value)} required>
              <option value="">Selecionar...</option>
              {filteredUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome} ({(u.cargo || '').toUpperCase()})
                </option>
              ))}
            </select>
          </div>
          <div className="fg">
            <label>Campanha (Meta Ads)</label>
            <input type="text" className="di" value={anuncio} onChange={(e) => setAnuncio(e.target.value)} placeholder="Ex: Nome da Campanha" />
          </div>
          {isVenda && (
            <>
              <div className="fg">
                <label>Valor da Venda (R$) *</label>
                <input type="number" className="di" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
              </div>
              <div className="fg">
                <label>Cash Collected (R$)</label>
                <input type="number" className="di" step="0.01" value={cashCollected} onChange={(e) => setCashCollected(e.target.value)} placeholder="0,00" />
              </div>
              <div className="fg s2">
                <label>Produtos (opcional)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {produtoItems.map((item, index) => (
                    <div key={item.uid} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 44px', gap: 8 }}>
                      <select
                        className="di"
                        value={item.produtoId}
                        onChange={(e) => updateProdutoItem(item.uid, 'produtoId', e.target.value)}
                      >
                        <option value="">Selecionar produto #{index + 1}</option>
                        {produtos.map((p) => (
                          <option key={`${item.uid}-${p.id}`} value={p.id}>
                            {p.nome}
                            {(p.valorCartao ?? p.valorBoleto ?? p.valor) != null
                            ? ` (${(p.valorCartao ?? p.valorBoleto ?? p.valor)!.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`
                            : ''}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        className="di"
                        value={item.quantidade}
                        onChange={(e) => updateProdutoItem(item.uid, 'quantidade', e.target.value)}
                        placeholder="Qtd."
                      />
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ width: 'auto', padding: '10px 0' }}
                        onClick={() => removeProdutoItem(item.uid)}
                        title="Remover produto"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ width: 'auto', padding: '8px 14px' }}
                      onClick={addProdutoItem}
                    >
                      + Adicionar produto
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  Voce pode repetir o mesmo produto quantas vezes quiser e ajustar a quantidade em cada linha.
                </p>
              </div>
            </>
          )}
          <div className="fg s2">
            <label>Observações</label>
            <textarea className="di" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Detalhes opcionais..." />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" className="btn btn-ghost" onClick={() => { setEditingRegistro(null); closeModal() }}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 28px' }} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </div>
  )
}
