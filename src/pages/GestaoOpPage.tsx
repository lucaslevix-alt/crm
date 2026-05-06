import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Factory, History, Pencil, Trash2 } from 'lucide-react'
import {
  listSquadsOperacao,
  listUsers,
  addSquadOperacao,
  updateSquadOperacao,
  deleteSquadOperacao,
  registrarLancamentosOperacao,
  reverterLancamentoOperacao,
  type LancamentoOperacaoRow,
  type LancamentoOperacaoTipoDb,
  type SquadOperacaoRow
} from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import type { CrmUser } from '../store/useAppStore'
import { useAppStore } from '../store/useAppStore'

function canBeSquadMember(u: CrmUser): boolean {
  return u.cargo === 'sdr' || u.cargo === 'closer' || u.cargo === 'admin'
}

function fmt(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function parseMoney(raw: string): number {
  const t = raw.trim().replace(/\s/g, '').replace(/R\$\s?/i, '').replace(/\./g, '').replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

const LANCAMENTO_LABEL: Record<LancamentoOperacaoTipoDb, string> = {
  churn: 'Churn',
  inadimplencia: 'Inadimplência',
  acrescimo: 'Acréscimo',
  credito_bonus: 'Crédito no bônus'
}

function fmtDataHora(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function LancamentoLinhaRetirada({
  titulo,
  valor,
  cliente,
  onValor,
  onCliente
}: {
  titulo: string
  valor: string
  cliente: string
  onValor: (v: string) => void
  onCliente: (v: string) => void
}) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        border: '1px solid var(--border2)',
        background: 'var(--bg3)',
        marginBottom: 12
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>{titulo}</div>
      <div className="fg" style={{ marginBottom: 0 }}>
        <label>Valor (retirada)</label>
        <input className="di" inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => onValor(e.target.value)} />
      </div>
      <div className="fg" style={{ marginBottom: 0 }}>
        <label>Nome do cliente</label>
        <input
          className="di"
          placeholder="Obrigatório se houver valor"
          value={cliente}
          onChange={(e) => onCliente(e.target.value)}
          autoComplete="off"
        />
      </div>
    </div>
  )
}

export function GestaoOpPage() {
  const { showToast } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [squads, setSquads] = useState<SquadOperacaoRow[]>([])
  const [users, setUsers] = useState<CrmUser[]>([])
  const [error, setError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [fotoUrl, setFotoUrl] = useState('')
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set())
  const [bonusInicialStr, setBonusInicialStr] = useState('')
  const [bonusSaldoStr, setBonusSaldoStr] = useState('')
  const [saving, setSaving] = useState(false)

  const [retirarTarget, setRetirarTarget] = useState<SquadOperacaoRow | null>(null)
  const [retirarChurn, setRetirarChurn] = useState('')
  const [retirarChurnCliente, setRetirarChurnCliente] = useState('')
  const [retirarInad, setRetirarInad] = useState('')
  const [retirarInadCliente, setRetirarInadCliente] = useState('')
  const [retirarAcrescimo, setRetirarAcrescimo] = useState('')
  const [retirarAcrescimoCliente, setRetirarAcrescimoCliente] = useState('')
  const [retirarCredito, setRetirarCredito] = useState('')
  const [retirarCreditoCliente, setRetirarCreditoCliente] = useState('')
  const [retirarSaving, setRetirarSaving] = useState(false)

  const [historicoSquad, setHistoricoSquad] = useState<SquadOperacaoRow | null>(null)
  const [revertBusyId, setRevertBusyId] = useState<string | null>(null)

  const eligibleUsers = useMemo(() => users.filter(canBeSquadMember).sort((a, b) => a.nome.localeCompare(b.nome)), [users])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, u] = await Promise.all([listSquadsOperacao(), listUsers()])
      setSquads(s)
      setUsers(u)
    } catch (err) {
      setError(formatFirebaseOrUnknownError(err) || 'Erro ao carregar')
      setSquads([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function resetForm() {
    setEditingId(null)
    setNome('')
    setFotoUrl('')
    setMemberIds(new Set())
    setBonusInicialStr('')
    setBonusSaldoStr('')
  }

  function startEdit(s: SquadOperacaoRow) {
    setEditingId(s.id)
    setNome(s.nome)
    setFotoUrl(s.fotoUrl)
    setMemberIds(new Set(s.memberIds))
    setBonusInicialStr(String(s.bonusInicial))
    setBonusSaldoStr(String(s.bonusSaldo))
  }

  function toggleMember(id: string) {
    setMemberIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSave() {
    const n = nome.trim()
    if (!n) {
      showToast('Informe o nome do squad.', 'err')
      return
    }
    const bi = parseMoney(bonusInicialStr)
    if (!editingId && bi <= 0) {
      showToast('Informe o valor inicial do bônus (maior que zero).', 'err')
      return
    }
    const ids = [...memberIds]
    setSaving(true)
    try {
      if (editingId) {
        const bs = parseMoney(bonusSaldoStr)
        await updateSquadOperacao(editingId, {
          nome: n,
          fotoUrl,
          memberIds: ids,
          bonusInicial: bi,
          bonusSaldo: bs
        })
        showToast('Squad operacional atualizado.')
      } else {
        await addSquadOperacao({ nome: n, fotoUrl, memberIds: ids, bonusInicial: bi })
        showToast('Squad operacional criado.')
      }
      resetForm()
      await load()
    } catch (err) {
      showToast(formatFirebaseOrUnknownError(err) || 'Erro ao salvar', 'err')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(s: SquadOperacaoRow) {
    if (!window.confirm(`Remover o squad operacional "${s.nome}"?`)) return
    try {
      await deleteSquadOperacao(s.id)
      if (editingId === s.id) resetForm()
      showToast('Squad operacional removido.')
      await load()
    } catch (err) {
      showToast(formatFirebaseOrUnknownError(err) || 'Erro ao remover', 'err')
    }
  }

  function openRetirar(s: SquadOperacaoRow) {
    setRetirarTarget(s)
    setRetirarChurn('')
    setRetirarChurnCliente('')
    setRetirarInad('')
    setRetirarInadCliente('')
    setRetirarAcrescimo('')
    setRetirarAcrescimoCliente('')
    setRetirarCredito('')
    setRetirarCreditoCliente('')
  }

  function closeRetirar() {
    if (retirarSaving) return
    setRetirarTarget(null)
  }

  async function handleRetirarSalvar() {
    if (!retirarTarget) return

    const blocos: { tipo: LancamentoOperacaoTipoDb; valor: number; cliente: string }[] = [
      { tipo: 'churn', valor: parseMoney(retirarChurn), cliente: retirarChurnCliente.trim() },
      { tipo: 'inadimplencia', valor: parseMoney(retirarInad), cliente: retirarInadCliente.trim() },
      { tipo: 'acrescimo', valor: parseMoney(retirarAcrescimo), cliente: retirarAcrescimoCliente.trim() },
      { tipo: 'credito_bonus', valor: parseMoney(retirarCredito), cliente: retirarCreditoCliente.trim() }
    ]

    const ativos = blocos.filter((b) => b.valor > 0)
    for (const b of ativos) {
      if (!b.cliente) {
        showToast(`Informe o nome do cliente em: ${LANCAMENTO_LABEL[b.tipo]}.`, 'err')
        return
      }
    }

    if (ativos.length === 0) {
      showToast('Preencha pelo menos um lançamento com valor e nome do cliente.', 'err')
      return
    }

    setRetirarSaving(true)
    try {
      await registrarLancamentosOperacao(
        retirarTarget.id,
        ativos.map((b) => ({ tipo: b.tipo, valor: b.valor, clienteNome: b.cliente }))
      )
      showToast('Lançamentos registados e saldo atualizado.')
      setRetirarTarget(null)
      await load()
    } catch (err) {
      showToast(formatFirebaseOrUnknownError(err) || 'Erro ao registar lançamentos', 'err')
    } finally {
      setRetirarSaving(false)
    }
  }

  async function handleReverter(l: LancamentoOperacaoRow) {
    if (!historicoSquad || l.revertidoEm) return
    if (
      !window.confirm(
        `Reverter este lançamento?\n\n${LANCAMENTO_LABEL[l.tipo]} · ${l.clienteNome} · ${fmt(l.valor)}\n\nO saldo do squad será ajustado.`
      )
    ) {
      return
    }
    setRevertBusyId(l.id)
    try {
      await reverterLancamentoOperacao(historicoSquad.id, l.id)
      showToast('Lançamento revertido.')
      const snap = await listSquadsOperacao()
      setSquads(snap)
      const u = snap.find((x) => x.id === historicoSquad.id)
      if (u) setHistoricoSquad(u)
    } catch (err) {
      showToast(formatFirebaseOrUnknownError(err) || 'Erro ao reverter', 'err')
    } finally {
      setRevertBusyId(null)
    }
  }

  useEffect(() => {
    if (!retirarTarget) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (retirarSaving) return
      setRetirarTarget(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [retirarTarget, retirarSaving])

  useEffect(() => {
    if (!historicoSquad) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (revertBusyId) return
      setHistoricoSquad(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [historicoSquad, revertBusyId])

  function memberLabel(uid: string): string {
    const u = users.find((x) => x.id === uid)
    return u ? `${u.nome} (${String(u.cargo).toUpperCase()})` : uid
  }

  const totalRetiradas =
    parseMoney(retirarChurn) + parseMoney(retirarInad) + parseMoney(retirarAcrescimo)
  const totalCredito = parseMoney(retirarCredito)

  const historicoOrdenado = useMemo(() => {
    if (!historicoSquad?.lancamentos?.length) return []
    return [...historicoSquad.lancamentos].sort(
      (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
    )
  }, [historicoSquad])

  return (
    <div className="content">
      <div style={{ marginBottom: 20 }}>
        <Link to="/config" className="config-sub-back">
          ← Configurações
        </Link>
        <h2 className="page-title-row" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, marginTop: 10 }}>
          <Factory size={24} strokeWidth={1.65} aria-hidden />
          Gestão OP
        </h2>
        <p style={{ color: 'var(--text2)' }}>
          Cadastre squads operacionais (nome, foto, membros) e o bônus inicial. Em Retirar, cada tipo tem valor e nome do
          cliente; tudo fica no histórico consultável. Crédito no bônus aumenta o saldo. Pode reverter lançamentos ativos pelo
          histórico.
        </p>
      </div>

      <div className="card mb" style={{ marginBottom: 18 }}>
        <div className="card-header">
          <span className="card-title">{editingId ? 'Editar squad operacional' : 'Novo squad operacional'}</span>
          {editingId && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetForm}>
              Cancelar edição
            </button>
          )}
        </div>
        <div style={{ padding: '0 4px 8px' }}>
          <div className="fg">
            <label>Nome do squad</label>
            <input className="di" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Squad Logística" />
          </div>
          <div className="fg">
            <label>URL da foto (opcional)</label>
            <input className="di" value={fotoUrl} onChange={(e) => setFotoUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="fg">
            <label>{editingId ? 'Bônus inicial (referência)' : 'Bônus inicial'}</label>
            <input
              className="di"
              inputMode="decimal"
              value={bonusInicialStr}
              onChange={(e) => setBonusInicialStr(e.target.value)}
              placeholder="Ex.: 5000"
            />
            <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
              Valor com que o squad entra na disputa; o % mantido e o perdido usam este montante como base.
            </p>
          </div>
          {editingId && (
            <div className="fg">
              <label>Saldo atual do bônus</label>
              <input
                className="di"
                inputMode="decimal"
                value={bonusSaldoStr}
                onChange={(e) => setBonusSaldoStr(e.target.value)}
                placeholder="Saldo após abatimentos"
              />
            </div>
          )}
          <div className="fg">
            <label>Membros</label>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
              Os mesmos perfis que nos squads comerciais (SDR, Closer ou Admin). Cada pessoa pode estar em apenas um squad
              operacional.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 8,
                maxHeight: 280,
                overflowY: 'auto',
                padding: 4,
                border: '1px solid var(--border2)',
                borderRadius: 10,
                background: 'var(--bg3)'
              }}
            >
              {eligibleUsers.length === 0 && <span style={{ color: 'var(--text3)', fontSize: 13 }}>Nenhum usuário SDR/Closer.</span>}
              {eligibleUsers.map((u) => (
                <label
                  key={u.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13,
                    cursor: 'pointer',
                    padding: '6px 8px',
                    borderRadius: 8
                  }}
                >
                  <input type="checkbox" checked={memberIds.has(u.id)} onChange={() => toggleMember(u.id)} />
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.nome}{' '}
                    <span style={{ color: 'var(--text3)', fontSize: 11 }}>({u.cargo})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <button type="button" className="btn btn-primary" style={{ width: 'auto', marginTop: 8 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Criar squad operacional'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Squads operacionais</span>
        </div>
        {loading && (
          <div className="loading" style={{ padding: 24 }}>
            <div className="spin" /> Carregando...
          </div>
        )}
        {error && (
          <div className="empty">
            <p>{error}</p>
          </div>
        )}
        {!loading && !error && squads.length === 0 && (
          <div className="empty">
            <p>Nenhum squad operacional ainda. Crie o primeiro acima.</p>
          </div>
        )}
        {!loading &&
          !error &&
          squads.map((s) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: '14px 18px',
                borderBottom: '1px solid var(--border2)',
                flexWrap: 'wrap'
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: s.fotoUrl ? `url(${s.fotoUrl}) center/cover` : 'var(--bg3)',
                  border: '1px solid var(--border2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  color: 'var(--text2)',
                  flexShrink: 0
                }}
              >
                {!s.fotoUrl && (s.nome || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700 }}>{s.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                  Inicial: {fmt(s.bonusInicial)} · Saldo: {fmt(s.bonusSaldo)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
                  {s.memberIds.length
                    ? s.memberIds.map((id) => memberLabel(id)).join(' · ')
                    : 'Sem membros.'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => openRetirar(s)}>
                    Retirar / crédito
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setHistoricoSquad(s)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <History size={16} strokeWidth={1.65} aria-hidden />
                    Histórico
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(s)} title="Editar">
                  <Pencil size={16} strokeWidth={1.65} />
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDelete(s)} title="Remover">
                  <Trash2 size={16} strokeWidth={1.65} style={{ color: 'var(--red)' }} />
                </button>
              </div>
            </div>
          ))}
      </div>

      {retirarTarget &&
        createPortal(
          <div className="mo" onClick={closeRetirar} role="presentation">
            <div
              className="modal"
              style={{ maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="retirar-op-title"
            >
              <h3 id="retirar-op-title" className="page-title-row" style={{ fontSize: 18, marginBottom: 8 }}>
                Lançamentos — {retirarTarget.nome}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
                Saldo atual: {fmt(retirarTarget.bonusSaldo)}. Para cada tipo com valor, indique o nome do cliente. Retiradas
                diminuem o saldo; crédito no bônus aumenta. Tudo é guardado no histórico.
              </p>

              <LancamentoLinhaRetirada
                titulo="Churn"
                valor={retirarChurn}
                cliente={retirarChurnCliente}
                onValor={setRetirarChurn}
                onCliente={setRetirarChurnCliente}
              />
              <LancamentoLinhaRetirada
                titulo="Inadimplência"
                valor={retirarInad}
                cliente={retirarInadCliente}
                onValor={setRetirarInad}
                onCliente={setRetirarInadCliente}
              />
              <LancamentoLinhaRetirada
                titulo="Acréscimo"
                valor={retirarAcrescimo}
                cliente={retirarAcrescimoCliente}
                onValor={setRetirarAcrescimo}
                onCliente={setRetirarAcrescimoCliente}
              />

              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid var(--border2)',
                  background: 'var(--bg3)',
                  marginBottom: 12
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Crédito no bônus</div>
                <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
                  Aumenta o saldo (ex.: correção ou estorno interno registado com cliente).
                </p>
                <div className="fg" style={{ marginBottom: 0 }}>
                  <label>Valor (crédito)</label>
                  <input
                    className="di"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={retirarCredito}
                    onChange={(e) => setRetirarCredito(e.target.value)}
                  />
                </div>
                <div className="fg" style={{ marginBottom: 0 }}>
                  <label>Nome do cliente</label>
                  <input
                    className="di"
                    placeholder="Obrigatório se houver valor"
                    value={retirarCreditoCliente}
                    onChange={(e) => setRetirarCreditoCliente(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>

              <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
                Soma retiradas neste envio: {fmt(totalRetiradas)} · Crédito: {fmt(totalCredito)} · Líquido no saldo:{' '}
                {fmt(totalCredito - totalRetiradas)}
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button type="button" className="btn btn-ghost" onClick={closeRetirar} disabled={retirarSaving}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-primary" onClick={handleRetirarSalvar} disabled={retirarSaving}>
                  {retirarSaving ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {historicoSquad &&
        createPortal(
          <div className="mo" onClick={() => !revertBusyId && setHistoricoSquad(null)} role="presentation">
            <div
              className="modal"
              style={{ maxWidth: 640, width: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="hist-op-title"
            >
              <h3 id="hist-op-title" className="page-title-row" style={{ fontSize: 18, marginBottom: 8 }}>
                Histórico — {historicoSquad.nome}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
                Saldo atual: {fmt(historicoSquad.bonusSaldo)}. Lançamentos revertidos permanecem visíveis para auditoria.
              </p>
              <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, marginBottom: 12 }}>
                {historicoOrdenado.length === 0 ? (
                  <p style={{ color: 'var(--text3)', fontSize: 13 }}>Nenhum lançamento registado.</p>
                ) : (
                  <table className="rank-perf-table" style={{ width: '100%', fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th className="rank-perf-th">Data</th>
                        <th className="rank-perf-th">Tipo</th>
                        <th className="rank-perf-th">Cliente</th>
                        <th className="rank-perf-th rank-perf-th--num">Valor</th>
                        <th className="rank-perf-th">Efeito</th>
                        <th className="rank-perf-th" />
                      </tr>
                    </thead>
                    <tbody>
                      {historicoOrdenado.map((l) => {
                        const cred = l.tipo === 'credito_bonus'
                        const rev = !!l.revertidoEm
                        return (
                          <tr key={l.id} style={{ opacity: rev ? 0.55 : 1 }}>
                            <td className="rank-perf-td">{fmtDataHora(l.criadoEm)}</td>
                            <td className="rank-perf-td">{LANCAMENTO_LABEL[l.tipo]}</td>
                            <td className="rank-perf-td">{l.clienteNome || '—'}</td>
                            <td className="rank-perf-td rank-perf-td--num">{fmt(l.valor)}</td>
                            <td className="rank-perf-td" style={{ fontSize: 12 }}>
                              {rev ? (
                                <span style={{ color: 'var(--text3)' }}>Revertido {fmtDataHora(l.revertidoEm!)}</span>
                              ) : cred ? (
                                <span style={{ color: 'var(--green)' }}>+ saldo</span>
                              ) : (
                                <span style={{ color: 'var(--red)' }}>− saldo</span>
                              )}
                            </td>
                            <td className="rank-perf-td rank-perf-td--num">
                              {!rev && (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  disabled={revertBusyId !== null}
                                  onClick={() => handleReverter(l)}
                                >
                                  {revertBusyId === l.id ? '…' : 'Reverter'}
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setHistoricoSquad(null)} disabled={!!revertBusyId}>
                  Fechar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
