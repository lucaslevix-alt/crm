import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Factory, Trophy, Users } from 'lucide-react'
import {
  ajustarChurnGtOperacaoMes,
  getChurnGtOperacaoMes,
  getGtsChurnOperacao,
  listUsers,
  setChurnGtOperacaoMes,
  type GtsChurnOperacaoDoc
} from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { NOME_MES } from '../lib/mesesPt'
import type { CrmUser } from '../store/useAppStore'
import { useAppStore } from '../store/useAppStore'

function parseIntSafe(raw: string): number {
  const n = parseInt(raw.replace(/\D/g, ''), 10)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

export function ConfigGtsPage() {
  const { showToast } = useAppStore()
  const currentY = new Date().getFullYear()
  const [ano, setAno] = useState(currentY)
  const [users, setUsers] = useState<CrmUser[]>([])
  const [selectedGtId, setSelectedGtId] = useState('')
  const [churnDoc, setChurnDoc] = useState<GtsChurnOperacaoDoc>({ anos: {} })
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [novoPorMes, setNovoPorMes] = useState<Record<number, string>>({})
  const [addPorMes, setAddPorMes] = useState<Record<number, string>>({})
  const [remPorMes, setRemPorMes] = useState<Record<number, string>>({})
  const [busyMes, setBusyMes] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const [list, doc] = await Promise.all([listUsers(), getGtsChurnOperacao()])
      const gts = list.filter((u) => u.cargo === 'gt').sort((a, b) => a.nome.localeCompare(b.nome))
      setUsers(gts)
      setChurnDoc(doc)
      setSelectedGtId((prev) => {
        if (prev && gts.some((u) => u.id === prev)) return prev
        return gts[0]?.id ?? ''
      })
    } catch (e) {
      setErr(formatFirebaseOrUnknownError(e) || 'Erro ao carregar')
      setUsers([])
      setChurnDoc({ anos: {} })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setNovoPorMes({})
    setAddPorMes({})
    setRemPorMes({})
  }, [selectedGtId, ano])

  function totalMes(mes: number): number {
    if (!selectedGtId) return 0
    return getChurnGtOperacaoMes(churnDoc.anos, ano, mes, selectedGtId)
  }

  async function salvarDefinir(mes: number) {
    if (!selectedGtId) {
      showToast('Selecione um GT.', 'err')
      return
    }
    const raw = (novoPorMes[mes] ?? '').trim()
    if (!raw) {
      showToast('Informe a quantidade de churn.', 'err')
      return
    }
    const v = parseIntSafe(raw)
    setBusyMes(mes)
    try {
      await setChurnGtOperacaoMes(ano, mes, selectedGtId, v)
      showToast(`${NOME_MES[mes - 1]}: churn definido para ${v.toLocaleString('pt-BR')}.`)
      setNovoPorMes((p) => ({ ...p, [mes]: '' }))
      await load()
    } catch (err) {
      showToast(formatFirebaseOrUnknownError(err) || 'Erro ao salvar', 'err')
    } finally {
      setBusyMes(null)
    }
  }

  async function aplicarAjuste(mes: number) {
    if (!selectedGtId) {
      showToast('Selecione um GT.', 'err')
      return
    }
    const a = parseIntSafe(addPorMes[mes] ?? '')
    const r = parseIntSafe(remPorMes[mes] ?? '')
    if (a <= 0 && r <= 0) {
      showToast('Informe quantidade a adicionar ou a remover.', 'err')
      return
    }
    setBusyMes(mes)
    try {
      const novo = await ajustarChurnGtOperacaoMes(ano, mes, selectedGtId, a, r)
      showToast(`${NOME_MES[mes - 1]}: ajuste aplicado. Total agora: ${novo.toLocaleString('pt-BR')}.`)
      setAddPorMes((p) => ({ ...p, [mes]: '' }))
      setRemPorMes((p) => ({ ...p, [mes]: '' }))
      await load()
    } catch (err) {
      showToast(formatFirebaseOrUnknownError(err) || 'Erro ao ajustar', 'err')
    } finally {
      setBusyMes(null)
    }
  }

  const anosOpts = Array.from({ length: 7 }, (_, i) => currentY - 3 + i)
  const selectedGt = users.find((u) => u.id === selectedGtId)

  return (
    <div className="content">
      <div style={{ marginBottom: 20 }}>
        <Link to="/config" className="config-sub-back">
          ← Configurações
        </Link>
        <h2 className="page-title-row" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, marginTop: 10 }}>
          <Trophy size={24} strokeWidth={1.65} aria-hidden />
          GTs — churn (quantidade)
        </h2>
        <p style={{ color: 'var(--text2)', maxWidth: 720 }}>
          Cadastro mensal por gestor: número de churn (log), não valores em R$. O mesmo modelo da Base: definir total ou
          adicionar/remover. Alimenta a Classificação → GTs.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Atalhos</span>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link
            to="/rankings/gts"
            className="btn btn-ghost"
            style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Trophy size={18} strokeWidth={1.65} aria-hidden />
              Ver classificação GTs
            </span>
            <ChevronRight size={18} aria-hidden />
          </Link>
          <Link
            to="/config/usuarios"
            className="btn btn-ghost"
            style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} strokeWidth={1.65} aria-hidden />
              Gerir usuários (cargo GT)
            </span>
            <ChevronRight size={18} aria-hidden />
          </Link>
          <Link
            to="/config/gestao-op"
            className="btn btn-ghost"
            style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Factory size={18} strokeWidth={1.65} aria-hidden />
              Gestão OP (saldo do squad em R$)
            </span>
            <ChevronRight size={18} aria-hidden />
          </Link>
        </div>
      </div>

      <div className="card mb" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="card-title">Gestor e ano</span>
          <select
            className="di"
            style={{ minWidth: 200, maxWidth: 320 }}
            value={selectedGtId}
            onChange={(e) => setSelectedGtId(e.target.value)}
            disabled={loading || users.length === 0}
          >
            {users.length === 0 ? (
              <option value="">Nenhum GT — crie em Usuários</option>
            ) : (
              users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))
            )}
          </select>
          <select className="di" style={{ maxWidth: 140 }} value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {anosOpts.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        {selectedGt && (
          <p style={{ padding: '0 18px 14px', margin: 0, fontSize: 13, color: 'var(--text3)' }}>
            A editar: <strong style={{ color: 'var(--text)' }}>{selectedGt.nome}</strong>
          </p>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Churn por mês (quantidade)</span>
        </div>
        {loading && (
          <div className="loading" style={{ padding: 24 }}>
            <div className="spin" /> Carregando...
          </div>
        )}
        {err && (
          <div className="empty">
            <p>{err}</p>
          </div>
        )}
        {!loading && !err && users.length === 0 && (
          <div style={{ padding: 24 }}>
            <p style={{ color: 'var(--text3)' }}>Ainda não há utilizadores com cargo GT. Crie ou edite em Usuários.</p>
          </div>
        )}
        {!loading && !err && users.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="rank-perf-table" style={{ width: '100%', minWidth: 720, fontSize: 13 }}>
              <thead>
                <tr>
                  <th className="rank-perf-th">Mês</th>
                  <th className="rank-perf-th rank-perf-th--num">Qtd. atual</th>
                  <th className="rank-perf-th">Definir quantidade</th>
                  <th className="rank-perf-th">Adicionar / Remover</th>
                </tr>
              </thead>
              <tbody>
                {NOME_MES.map((nome, i) => {
                  const mes = i + 1
                  const tot = totalMes(mes)
                  const busy = busyMes === mes
                  return (
                    <tr key={mes}>
                      <td className="rank-perf-td" style={{ fontWeight: 600 }}>
                        {nome}
                      </td>
                      <td className="rank-perf-td rank-perf-td--num">{tot.toLocaleString('pt-BR')}</td>
                      <td className="rank-perf-td">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                          <input
                            className="di"
                            style={{ width: 120, margin: 0 }}
                            inputMode="numeric"
                            placeholder="Nova qtd."
                            value={novoPorMes[mes] ?? ''}
                            onChange={(e) => setNovoPorMes((p) => ({ ...p, [mes]: e.target.value }))}
                            disabled={busy || !selectedGtId}
                          />
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={busy || !selectedGtId}
                            onClick={() => salvarDefinir(mes)}
                          >
                            Salvar
                          </button>
                        </div>
                      </td>
                      <td className="rank-perf-td">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                          <input
                            className="di"
                            style={{ width: 88, margin: 0 }}
                            inputMode="numeric"
                            placeholder="+ Qtd"
                            title="Somar ao total de churn"
                            value={addPorMes[mes] ?? ''}
                            onChange={(e) => setAddPorMes((p) => ({ ...p, [mes]: e.target.value }))}
                            disabled={busy || !selectedGtId}
                          />
                          <input
                            className="di"
                            style={{ width: 88, margin: 0 }}
                            inputMode="numeric"
                            placeholder="− Qtd"
                            title="Subtrair do total de churn"
                            value={remPorMes[mes] ?? ''}
                            onChange={(e) => setRemPorMes((p) => ({ ...p, [mes]: e.target.value }))}
                            disabled={busy || !selectedGtId}
                          />
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busy || !selectedGtId}
                            onClick={() => aplicarAjuste(mes)}
                          >
                            Aplicar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
