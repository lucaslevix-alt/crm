import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Minus, Plus, RotateCcw, Trophy, Users } from 'lucide-react'
import {
  ajustarVendasGtAtual,
  currentGtsVendasPeriodYm,
  getGtsVendasAtual,
  getVendasGtAtual,
  listUsers,
  resetGtsVendasAtual,
  type GtsVendasAtualDoc
} from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { labelPeriodYm } from '../lib/mesesPt'
import type { CrmUser } from '../store/useAppStore'
import { useAppStore } from '../store/useAppStore'

export function ConfigGtsPage() {
  const { showToast } = useAppStore()
  const [users, setUsers] = useState<CrmUser[]>([])
  const [vendasDoc, setVendasDoc] = useState<GtsVendasAtualDoc>({
    periodYm: currentGtsVendasPeriodYm(),
    totals: {}
  })
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [actionErr, setActionErr] = useState<string | null>(null)
  const [busyGtId, setBusyGtId] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const [list, vendas] = await Promise.all([
        listUsers(),
        getGtsVendasAtual({ fromServer: true })
      ])
      const gts = list
        .filter((u) => String(u.cargo ?? '').trim().toLowerCase() === 'gt')
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      setUsers(gts)
      setVendasDoc(vendas)
    } catch (e) {
      setErr(formatFirebaseOrUnknownError(e) || 'Erro ao carregar')
      setUsers([])
      setVendasDoc({ periodYm: currentGtsVendasPeriodYm(), totals: {} })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function ajustarVenda(userId: string, delta: 1 | -1) {
    if (!userId) {
      setActionErr('Gestor inválido.')
      return
    }
    const prevTot = getVendasGtAtual(vendasDoc, userId)
    if (delta < 0 && prevTot <= 0) return

    const optimistic = Math.max(0, prevTot + delta)
    setActionErr(null)
    setBusyGtId(userId)
    setVendasDoc((prev) => ({
      periodYm: prev.periodYm || currentGtsVendasPeriodYm(),
      totals: { ...prev.totals, [userId]: optimistic }
    }))

    try {
      const add = delta > 0 ? 1 : 0
      const rem = delta < 0 ? 1 : 0
      const novo = await ajustarVendasGtAtual(userId, add, rem)
      setVendasDoc((prev) => ({
        periodYm: prev.periodYm || currentGtsVendasPeriodYm(),
        totals: { ...prev.totals, [userId]: novo }
      }))
      const gt = users.find((u) => u.id === userId)
      showToast(`${gt?.nome ?? 'GT'}: ${novo} venda(s).`)
    } catch (e) {
      setVendasDoc((prev) => ({
        periodYm: prev.periodYm || currentGtsVendasPeriodYm(),
        totals: { ...prev.totals, [userId]: prevTot }
      }))
      const msg = formatFirebaseOrUnknownError(e) || 'Erro ao ajustar vendas'
      setActionErr(msg)
      showToast(msg, 'err')
    } finally {
      setBusyGtId(null)
    }
  }

  async function handleReset() {
    if (
      !window.confirm(
        'Zerar as vendas de todos os GTs e reiniciar a disputa do mês? Use isto no início de um novo mês.'
      )
    ) {
      return
    }
    setActionErr(null)
    setResetting(true)
    try {
      const next = await resetGtsVendasAtual()
      setVendasDoc(next)
      showToast(`Disputa reiniciada — ${labelPeriodYm(next.periodYm)}.`)
    } catch (e) {
      const msg = formatFirebaseOrUnknownError(e) || 'Erro ao resetar'
      setActionErr(msg)
      showToast(msg, 'err')
    } finally {
      setResetting(false)
    }
  }

  const periodLabel = vendasDoc.periodYm ? labelPeriodYm(vendasDoc.periodYm) : '—'

  return (
    <div className="content">
      <div style={{ marginBottom: 20 }}>
        <Link to="/config" className="config-sub-back">
          ← Configurações
        </Link>
        <h2 className="page-title-row" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, marginTop: 10 }}>
          <Trophy size={24} strokeWidth={1.65} aria-hidden />
          GTs — vendas
        </h2>
        <p style={{ color: 'var(--text2)', maxWidth: 720 }}>
          Lista de gestores com <b>+1</b> / <b>−1</b> ao lado do nome. Apenas admin. Alimenta a Classificação → GTs.
        </p>
      </div>

      {actionErr && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            borderColor: 'rgba(239, 68, 68, .35)',
            background: 'rgba(239, 68, 68, .08)',
            color: 'var(--red)',
            fontSize: 14
          }}
          role="alert"
        >
          {actionErr}
        </div>
      )}

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
        </div>
      </div>

      {loading && (
        <div className="loading card" style={{ padding: 24 }}>
          <div className="spin" /> Carregando...
        </div>
      )}
      {err && (
        <div className="empty card">
          <p>{err}</p>
        </div>
      )}
      {!loading && !err && users.length === 0 && (
        <div className="card" style={{ padding: 24 }}>
          <p style={{ color: 'var(--text3)' }}>Ainda não há utilizadores com cargo GT. Crie ou edite em Usuários.</p>
        </div>
      )}
      {!loading && !err && users.length > 0 && (
        <div className="card">
          <div
            className="card-header"
            style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}
          >
            <div>
              <span className="card-title">Gestores</span>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text3)' }}>
                Disputa ativa: <strong style={{ color: 'var(--text)' }}>{periodLabel}</strong>
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={resetting || busyGtId != null}
              onClick={() => void handleReset()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <RotateCcw size={16} strokeWidth={1.65} aria-hidden />
              Resetar disputa
            </button>
          </div>
          <div style={{ padding: '0 0 8px' }}>
            {users.map((u) => {
              const tot = getVendasGtAtual(vendasDoc, u.id)
              const busy = busyGtId === u.id
              return (
                <div
                  key={u.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '14px 18px',
                    borderTop: '1px solid var(--border)',
                    flexWrap: 'wrap'
                  }}
                >
                  <span style={{ flex: 1, minWidth: 160, fontWeight: 600, fontSize: 15 }}>{u.nome}</span>
                  <span
                    style={{
                      minWidth: 48,
                      textAlign: 'center',
                      fontSize: 22,
                      fontWeight: 800,
                      fontVariantNumeric: 'tabular-nums',
                      opacity: busy ? 0.55 : 1
                    }}
                  >
                    {tot}
                  </span>
                  <div style={{ display: 'inline-flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      title="Remover 1 venda"
                      disabled={busy || resetting || tot <= 0}
                      onClick={() => void ajustarVenda(u.id, -1)}
                      aria-label={`Remover 1 venda de ${u.nome}`}
                    >
                      <Minus size={18} strokeWidth={2.25} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      title="Adicionar 1 venda"
                      disabled={busy || resetting}
                      onClick={() => void ajustarVenda(u.id, 1)}
                      aria-label={`Adicionar 1 venda de ${u.nome}`}
                    >
                      <Plus size={18} strokeWidth={2.25} aria-hidden />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <p style={{ padding: '8px 18px 16px', margin: 0, fontSize: 12, color: 'var(--text3)' }}>
            No início de cada mês, use <b>Resetar disputa</b> para zerar todos e começar a contagem de novo.
          </p>
        </div>
      )}
    </div>
  )
}
