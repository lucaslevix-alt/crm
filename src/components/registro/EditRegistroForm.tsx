import { useState, useEffect, useMemo } from 'react'
import { Pencil } from 'lucide-react'
import {
  listUsers,
  getProdutos,
  getLinhasNegociacaoAll,
  updateRegistro,
  FORMAS_PAGAMENTO_VENDA,
  parseFormaPagamentoVenda,
  produtoPrecoReferencia
} from '../../firebase/firestore'
import type { LinhaNegociacaoRow, ProdutoRow } from '../../firebase/firestore'
import type { CrmUser } from '../../store/useAppStore'
import { useAppStore } from '../../store/useAppStore'
import { computeDescontoVenda, idealLinePorProduto } from '../../lib/vendaDesconto'

interface ProdutoSelecionadoItem {
  uid: string
  produtoId: string
  quantidade: string
  linhaNegociacaoId: string
}

function fmtBrl(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function labelLinhaNegociacao(l: LinhaNegociacaoRow): string {
  const nome = l.rotulo?.trim() || `Proposta ${l.ordem + 1}`
  const av =
    l.valorAVista != null && l.valorAVista > 0 ? fmtBrl(l.valorAVista) : 'av. —'
  const parc = fmtBrl(l.valorTotal)
  return `${nome} · ${av} · parc. ${parc}`
}

export function EditRegistroForm() {
  const { editingRegistro, closeModal, setEditingRegistro, showToast, incrementRegistrosVersion } = useAppStore()
  const [users, setUsers] = useState<CrmUser[]>([])
  const [produtos, setProdutos] = useState<ProdutoRow[]>([])
  const [linhas, setLinhas] = useState<LinhaNegociacaoRow[]>([])
  const [data, setData] = useState('')
  const [tipo, setTipo] = useState('reuniao_agendada')
  const [userId, setUserId] = useState('')
  const [anuncio, setAnuncio] = useState('')
  const [valor, setValor] = useState('')
  const [cashCollected, setCashCollected] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('')
  const [nomeCliente, setNomeCliente] = useState('')
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
    setFormaPagamento(editingRegistro.formaPagamento ?? '')
    setNomeCliente(editingRegistro.nomeCliente ?? '')
    setObs(editingRegistro.obs ?? '')
    setProdutoItems(
      editingRegistro.produtosDetalhes && editingRegistro.produtosDetalhes.length > 0
        ? editingRegistro.produtosDetalhes.map((item, index) => ({
            uid: `${editingRegistro.id}-${index}`,
            produtoId: item.produtoId,
            quantidade: String(item.quantidade || 1),
            linhaNegociacaoId: item.linhaNegociacaoId?.trim() ?? ''
          }))
        : []
    )
    listUsers().then(setUsers)
    Promise.all([getProdutos(), getLinhasNegociacaoAll()]).then(([p, l]) => {
      setProdutos(p)
      setLinhas(l)
    })
  }, [editingRegistro])

  const filteredUsers =
    tipo === 'reuniao_agendada' || tipo === 'reuniao_realizada'
      ? users.filter((u) => u.cargo === 'sdr' || u.cargo === 'admin')
      : tipo === 'reuniao_closer' || tipo === 'venda'
        ? users.filter((u) => u.cargo === 'closer' || u.cargo === 'admin')
        : users

  function linhasDoProduto(produtoId: string) {
    return linhas.filter((l) => l.produtoId === produtoId)
  }

  function addProdutoItem() {
    setProdutoItems((current) => [
      ...current,
      { uid: `${Date.now()}-${Math.random()}`, produtoId: '', quantidade: '1', linhaNegociacaoId: '' }
    ])
  }

  function updateProdutoItem(uid: string, key: 'produtoId' | 'quantidade' | 'linhaNegociacaoId', value: string) {
    setProdutoItems((current) =>
      current.map((item) => {
        if (item.uid !== uid) return item
        if (key === 'produtoId') {
          const opts = linhas.filter((l) => l.produtoId === value)
          return {
            ...item,
            produtoId: value,
            linhaNegociacaoId: opts[0]?.id ?? ''
          }
        }
        return { ...item, [key]: value }
      })
    )
  }

  function removeProdutoItem(uid: string) {
    setProdutoItems((current) => current.filter((item) => item.uid !== uid))
  }

  const isVenda = tipo === 'venda'
  const linhasById = useMemo(() => new Map(linhas.map((l) => [l.id, l])), [linhas])
  const idealPorProduto = useMemo(() => idealLinePorProduto(linhas), [linhas])

  const descontoPreview = useMemo(() => {
    if (!isVenda) return null
    const produtosDetalhes = produtoItems
      .map((item) => ({
        produtoId: item.produtoId,
        quantidade: Math.max(1, parseInt(item.quantidade || '1', 10) || 1),
        linhaNegociacaoId: item.linhaNegociacaoId || null
      }))
      .filter((item) => item.produtoId)
    const fp = parseFormaPagamentoVenda(formaPagamento)
    return computeDescontoVenda({
      produtosDetalhes,
      linhasById,
      idealPorProduto,
      formaPagamento: fp
    })
  }, [isVenda, produtoItems, linhasById, idealPorProduto, formaPagamento])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingRegistro) return
    if (!data || !tipo || !userId) {
      showToast('Preencha data, tipo e profissional', 'err')
      return
    }
    if (tipo === 'venda' && !nomeCliente.trim()) {
      showToast('Informe o nome do cliente', 'err')
      return
    }
    if (tipo === 'venda' && !parseFloat(valor)) {
      showToast('Informe o valor da venda', 'err')
      return
    }
    if (tipo === 'venda' && !parseFormaPagamentoVenda(formaPagamento)) {
      showToast('Selecione a forma de pagamento', 'err')
      return
    }
    const u = users.find((x) => x.id === userId)
    const produtosDetalhes = produtoItems
      .map((item) => ({
        produtoId: item.produtoId,
        quantidade: Math.max(1, parseInt(item.quantidade || '1', 10) || 1),
        linhaNegociacaoId: item.linhaNegociacaoId?.trim() || null
      }))
      .filter((item) => item.produtoId)
    const valorNum = tipo === 'venda' ? parseFloat(valor) || 0 : 0
    const descCalc =
      tipo === 'venda'
        ? computeDescontoVenda({
            produtosDetalhes,
            linhasById,
            idealPorProduto: idealLinePorProduto(linhas),
            formaPagamento: parseFormaPagamentoVenda(formaPagamento)!
          })
        : { valorReferencia: 0, desconto: 0 }

    setSaving(true)
    try {
      await updateRegistro(editingRegistro.id, {
        data,
        tipo,
        userId,
        userName: u?.nome ?? '—',
        userCargo: u?.cargo ?? '—',
        anuncio: anuncio.trim() || null,
        valor: valorNum,
        cashCollected: tipo === 'venda' ? parseFloat(cashCollected) || 0 : 0,
        formaPagamento: tipo === 'venda' ? parseFormaPagamentoVenda(formaPagamento) : null,
        nomeCliente: tipo === 'venda' ? nomeCliente.trim() || null : null,
        obs: obs.trim() || null,
        produtosIds: tipo === 'venda' ? produtosDetalhes.flatMap((item) => Array(item.quantidade).fill(item.produtoId)) : [],
        produtosDetalhes: tipo === 'venda' ? produtosDetalhes : [],
        valorReferenciaVenda: tipo === 'venda' ? descCalc.valorReferencia : undefined,
        descontoCloser: tipo === 'venda' ? descCalc.desconto : undefined
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

  return (
    <div style={{ padding: 24 }}>
      <div className="mh">
        <div className="mt modal-title-ic">
          <Pencil size={20} strokeWidth={1.65} aria-hidden />
          Editar Registro
        </div>
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
              <div className="fg s2">
                <label>Nome do cliente *</label>
                <input
                  type="text"
                  className="di"
                  value={nomeCliente}
                  onChange={(e) => setNomeCliente(e.target.value)}
                  placeholder="Nome completo do cliente"
                  autoComplete="name"
                  required={isVenda}
                />
              </div>
              <div className="fg">
                <label>Valor da Venda (R$) *</label>
                <input type="number" className="di" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
              </div>
              <div className="fg">
                <label>Cash Collected (R$)</label>
                <input type="number" className="di" step="0.01" value={cashCollected} onChange={(e) => setCashCollected(e.target.value)} placeholder="0,00" />
              </div>
              <div className="fg">
                <label>Forma de pagamento *</label>
                <select
                  className="di"
                  value={formaPagamento}
                  onChange={(e) => setFormaPagamento(e.target.value)}
                  required={isVenda}
                >
                  <option value="">Selecionar...</option>
                  {FORMAS_PAGAMENTO_VENDA.map((fp) => (
                    <option key={fp.value} value={fp.value}>
                      {fp.label}
                    </option>
                  ))}
                  {formaPagamento &&
                    !FORMAS_PAGAMENTO_VENDA.some((x) => x.value === formaPagamento) && (
                      <option value={formaPagamento}>{formaPagamento} (valor antigo)</option>
                    )}
                </select>
              </div>
              <div className="fg s2">
                <label>Produtos (opcional)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {produtoItems.map((item, index) => {
                    const opts = item.produtoId ? linhasDoProduto(item.produtoId) : []
                    return (
                      <div
                        key={item.uid}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(100px, 1fr) 72px minmax(120px, 1fr) 44px',
                          gap: 8,
                          alignItems: 'center'
                        }}
                      >
                        <select
                          className="di"
                          value={item.produtoId}
                          onChange={(e) => updateProdutoItem(item.uid, 'produtoId', e.target.value)}
                        >
                          <option value="">Produto #{index + 1}</option>
                          {produtos.map((p) => {
                            const ref = produtoPrecoReferencia(p)
                            return (
                              <option key={`${item.uid}-${p.id}`} value={p.id}>
                                {p.nome}
                                {ref != null
                                  ? ` (${ref.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`
                                  : ''}
                              </option>
                            )
                          })}
                        </select>
                        <input
                          type="number"
                          min="1"
                          className="di"
                          value={item.quantidade}
                          onChange={(e) => updateProdutoItem(item.uid, 'quantidade', e.target.value)}
                          placeholder="Qtd."
                          title="Quantidade"
                        />
                        <select
                          className="di"
                          value={item.linhaNegociacaoId}
                          onChange={(e) => updateProdutoItem(item.uid, 'linhaNegociacaoId', e.target.value)}
                          disabled={!item.produtoId}
                          title="Linha em que o cliente fechou. Desconto = linha ideal − esta linha (× qtd)."
                        >
                          <option value="">{item.produtoId ? 'Linha em que fechou' : '—'}</option>
                          {opts.map((l) => (
                            <option key={l.id} value={l.id}>
                              {labelLinhaNegociacao(l)}
                            </option>
                          ))}
                        </select>
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
                    )
                  })}
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
                  A <strong>forma de pagamento</strong> define se o desconto usa o preço <strong>à vista</strong> ou o{' '}
                  <strong>total parcelado</strong> de cada linha (cadastrados em Propostas).
                </p>
                {descontoPreview && descontoPreview.valorReferencia > 0 && (
                  <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>
                    Ref. ideal ({parseFormaPagamentoVenda(formaPagamento) === 'a_vista' ? 'à vista' : 'parcelado'}):{' '}
                    <strong>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        descontoPreview.valorReferencia
                      )}
                    </strong>
                    {' · '}
                    Desconto (ideal − linha fechada):{' '}
                    <strong style={{ color: descontoPreview.desconto > 0 ? 'var(--amber)' : 'var(--text)' }}>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        descontoPreview.desconto
                      )}
                    </strong>
                  </p>
                )}
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
