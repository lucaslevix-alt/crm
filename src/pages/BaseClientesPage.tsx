import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Database } from 'lucide-react'
import {
  getBaseClientesOperacao,
  setTotalClientesOperacaoMes,
  ajustarTotalClientesOperacaoMes,
  getTotalClientesOperacaoMes,
  type BaseClientesOperacaoDoc
} from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { NOME_MES } from '../lib/mesesPt'
import { useAppStore } from '../store/useAppStore'

function parseIntSafe(raw: string): number {
  const n = parseInt(raw.replace(/\D/g, ''), 10)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

export function BaseClientesPage() {
  const { showToast } = useAppStore()
  const currentY = new Date().getFullYear()
  const [ano, setAno] = useState(currentY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [doc, setDoc] = useState<BaseClientesOperacaoDoc>({ anos: {} })

  const [novoPorMes, setNovoPorMes] = useState<Record<number, string>>({})
  const [addPorMes, setAddPorMes] = useState<Record<number, string>>({})
  const [remPorMes, setRemPorMes] = useState<Record<number, string>>({})
  const [busyMes, setBusyMes] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = await getBaseClientesOperacao()
      setDoc(d)
    } catch (err) {
      setError(formatFirebaseOrUnknownError(err) || 'Erro ao carregar')
      setDoc({ anos: {} })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function totalMes(mes: number): number {
    return getTotalClientesOperacaoMes(doc.anos, ano, mes)
  }

  async function salvarDefinir(mes: number) {
    const raw = (novoPorMes[mes] ?? '').trim()
    if (!raw) {
      showToast('Informe o novo total de clientes.', 'err')
      return
    }
    const v = parseIntSafe(raw)
    setBusyMes(mes)
    try {
      await setTotalClientesOperacaoMes(ano, mes, v)
      showToast(`${NOME_MES[mes - 1]}: total definido para ${v.toLocaleString('pt-BR')}.`)
      setNovoPorMes((p) => ({ ...p, [mes]: '' }))
      await load()
    } catch (err) {
      showToast(formatFirebaseOrUnknownError(err) || 'Erro ao salvar', 'err')
    } finally {
      setBusyMes(null)
    }
  }

  async function aplicarAjuste(mes: number) {
    const a = parseIntSafe(addPorMes[mes] ?? '')
    const r = parseIntSafe(remPorMes[mes] ?? '')
    if (a <= 0 && r <= 0) {
      showToast('Informe quantidade a adicionar ou a remover.', 'err')
      return
    }
    setBusyMes(mes)
    try {
      const novo = await ajustarTotalClientesOperacaoMes(ano, mes, a, r)
      showToast(
        `${NOME_MES[mes - 1]}: ajuste aplicado. Total agora: ${novo.toLocaleString('pt-BR')}.`
      )
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

  return (
    <div className="content">
      <div style={{ marginBottom: 20 }}>
        <Link to="/config" className="config-sub-back">
          ← Configurações
        </Link>
        <h2 className="page-title-row" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, marginTop: 10 }}>
          <Database size={24} strokeWidth={1.65} aria-hidden />
          Base — clientes ativos (operação)
        </h2>
        <p style={{ color: 'var(--text2)' }}>
          Controle mensal do total de clientes ativos. Defina o número diretamente ou use adicionar/remover para ajustar. Os
          valores alimentam o pódio em Classificação → Base.
        </p>
      </div>

      <div className="card mb" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="card-title">Ano</span>
          <select className="di" style={{ maxWidth: 140 }} value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {anosOpts.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Totais por mês</span>
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
        {!loading && !error && (
          <div style={{ overflowX: 'auto' }}>
            <table className="rank-perf-table" style={{ width: '100%', minWidth: 720, fontSize: 13 }}>
              <thead>
                <tr>
                  <th className="rank-perf-th">Mês</th>
                  <th className="rank-perf-th rank-perf-th--num">Total atual</th>
                  <th className="rank-perf-th">Definir total</th>
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
                            placeholder="Novo total"
                            value={novoPorMes[mes] ?? ''}
                            onChange={(e) => setNovoPorMes((p) => ({ ...p, [mes]: e.target.value }))}
                            disabled={busy}
                          />
                          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => salvarDefinir(mes)}>
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
                            title="Adicionar ao total"
                            value={addPorMes[mes] ?? ''}
                            onChange={(e) => setAddPorMes((p) => ({ ...p, [mes]: e.target.value }))}
                            disabled={busy}
                          />
                          <input
                            className="di"
                            style={{ width: 88, margin: 0 }}
                            inputMode="numeric"
                            placeholder="− Qtd"
                            title="Remover do total"
                            value={remPorMes[mes] ?? ''}
                            onChange={(e) => setRemPorMes((p) => ({ ...p, [mes]: e.target.value }))}
                            disabled={busy}
                          />
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busy}
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
