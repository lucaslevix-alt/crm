import { useEffect, useMemo, useState } from 'react'
import { CircleDollarSign } from 'lucide-react'
import {
  FORMAS_PAGAMENTO_VENDA,
  getLinhasNegociacaoAll,
  getProdutos,
  marcarAgendamentoVenda,
  parseFormaPagamentoVenda,
  produtoPrecoReferencia,
  type AgendamentoRow,
  type LinhaNegociacaoRow,
  type ProdutoRow
} from '../../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../../lib/firebaseUserFacingError'
import type { CrmUser } from '../../store/useAppStore'
import { useAppStore } from '../../store/useAppStore'
import { computeDescontoVenda } from '../../lib/vendaDesconto'
import {
  buildLinhasByIdParaVenda,
  labelLinhaOfertaNoGrupo,
  linhaVirtualId,
  opcoesLinhaDropdown
} from '../../lib/produtoLinhasVenda'

interface ProdutoSelecionadoItem {
  uid: string
  produtoId: string
  quantidade: string
  linhaNegociacaoId: string
}

interface AgendaVendaModalProps {
  agendamento: AgendamentoRow
  closer: CrmUser
  onClose: () => void
}

export function AgendaVendaModal({ agendamento, closer, onClose }: AgendaVendaModalProps) {
  const { showToast, incrementRegistrosVersion } = useAppStore()
  const [produtos, setProdutos] = useState<ProdutoRow[]>([])
  const [linhas, setLinhas] = useState<LinhaNegociacaoRow[]>([])
  const [nomeCliente, setNomeCliente] = useState('')
  const [valor, setValor] = useState('')
  const [cashCollected, setCashCollected] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('')
  const [produtoItems, setProdutoItems] = useState<ProdutoSelecionadoItem[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([getProdutos(), getLinhasNegociacaoAll()]).then(([p, l]) => {
      setProdutos(p)
      setLinhas(l)
    })
  }, [])

  const linhasById = useMemo(
    () => buildLinhasByIdParaVenda(produtos, linhas),
    [produtos, linhas]
  )

  const descontoPreview = useMemo(() => {
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
      formaPagamento: fp
    })
  }, [produtoItems, linhasById, formaPagamento])

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
          return {
            ...item,
            produtoId: value,
            linhaNegociacaoId: value ? linhaVirtualId(value, 'preco_tabela', 3) : ''
          }
        }
        return { ...item, [key]: value }
      })
    )
  }

  function removeProdutoItem(uid: string) {
    setProdutoItems((current) => current.filter((item) => item.uid !== uid))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nomeCliente.trim()) {
      showToast('Informe o nome do cliente', 'err')
      return
    }
    if (!parseFloat(valor)) {
      showToast('Informe o valor da venda', 'err')
      return
    }
    const fp = parseFormaPagamentoVenda(formaPagamento)
    if (!fp) {
      showToast('Selecione a forma de pagamento', 'err')
      return
    }
    const produtosDetalhes = produtoItems
      .map((item) => ({
        produtoId: item.produtoId,
        quantidade: Math.max(1, parseInt(item.quantidade || '1', 10) || 1),
        linhaNegociacaoId: item.linhaNegociacaoId?.trim() || null
      }))
      .filter((item) => item.produtoId)
    const descCalc = computeDescontoVenda({
      produtosDetalhes,
      linhasById,
      formaPagamento: fp
    })
    setSaving(true)
    try {
      await marcarAgendamentoVenda({
        agendamentoId: agendamento.id,
        closer: { id: closer.id, nome: closer.nome, cargo: closer.cargo },
        nomeCliente: nomeCliente.trim(),
        valor: parseFloat(valor) || 0,
        cashCollected: parseFloat(cashCollected) || 0,
        formaPagamento: fp,
        produtosIds: produtosDetalhes.flatMap((item) => Array(item.quantidade).fill(item.produtoId)),
        produtosDetalhes,
        valorReferenciaVenda: descCalc.valorReferencia,
        descontoCloser: descCalc.desconto
      })
      showToast('Venda registrada e agendamento atualizado.')
      incrementRegistrosVersion()
      onClose()
    } catch (err) {
      showToast('Erro: ' + formatFirebaseOrUnknownError(err), 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="qrb-meet-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="qrb-meet-panel" style={{ maxWidth: 520, maxHeight: '90vh', overflow: 'auto' }} role="dialog" aria-modal="true">
        <h2 className="qrb-meet-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CircleDollarSign size={22} strokeWidth={1.65} aria-hidden />
          Venda — lead: {agendamento.grupoWpp.slice(0, 40)}
          {agendamento.grupoWpp.length > 40 ? '…' : ''}
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
          SDR: {agendamento.sdrUserName} · Squad: {agendamento.squadNome}
        </p>
        <form onSubmit={handleSubmit}>
          <div className="fg2">
            <div className="fg s2">
              <label>Nome do cliente *</label>
              <input
                type="text"
                className="di"
                value={nomeCliente}
                onChange={(e) => setNomeCliente(e.target.value)}
                placeholder="Nome completo"
                autoComplete="name"
                required
              />
            </div>
            <div className="fg">
              <label>Valor da Venda (R$) *</label>
              <input
                type="number"
                className="di"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="fg">
              <label>Cash Collected (R$)</label>
              <input
                type="number"
                className="di"
                step="0.01"
                value={cashCollected}
                onChange={(e) => setCashCollected(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="fg">
              <label>Forma de pagamento *</label>
              <select className="di" value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} required>
                <option value="">Selecionar...</option>
                {FORMAS_PAGAMENTO_VENDA.map((fp) => (
                  <option key={fp.value} value={fp.value}>
                    {fp.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="fg s2">
              <label>Produtos (opcional)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {produtoItems.map((item, index) => {
                  const pSel = produtos.find((x) => x.id === item.produtoId)
                  const opts = opcoesLinhaDropdown(pSel, item.linhaNegociacaoId, linhas)
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
                        title="Contrato 3 ou 6 meses · referência = tabela do mesmo período"
                      >
                        <option value="">{item.produtoId ? 'Oferta em que fechou' : '—'}</option>
                        {([3, 6] as const).map((mes) => {
                          const groupOpts = opts.filter((l) => l.periodoMeses === mes)
                          if (!groupOpts.length) return null
                          return (
                            <optgroup key={mes} label={mes === 3 ? 'Contrato 3 meses' : 'Contrato 6 meses'}>
                              {groupOpts.map((l) => (
                                <option key={l.id} value={l.id}>
                                  {labelLinhaOfertaNoGrupo(l)}
                                </option>
                              ))}
                            </optgroup>
                          )
                        })}
                      </select>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ width: 'auto', padding: '10px 0' }}
                        onClick={() => removeProdutoItem(item.uid)}
                        title="Remover"
                      >
                        ✕
                      </button>
                    </div>
                  )
                })}
                <button type="button" className="btn btn-ghost" style={{ width: 'auto', padding: '8px 14px' }} onClick={addProdutoItem}>
                  + Adicionar produto
                </button>
              </div>
              {descontoPreview && (
                <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  Ref. venda:{' '}
                  {descontoPreview.valorReferencia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · Desconto closer:{' '}
                  {descontoPreview.desconto.toFixed(1)}%
                </p>
              )}
            </div>
          </div>
          <div className="qrb-meet-actions" style={{ marginTop: 16 }}>
            <button type="button" className="qrb-meet-btn qrb-meet-btn--secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="qrb-meet-btn qrb-meet-btn--primary" disabled={saving}>
              {saving ? 'A guardar…' : 'Confirmar venda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
