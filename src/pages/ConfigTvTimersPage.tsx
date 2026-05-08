import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Timer } from 'lucide-react'
import { getTvTimersConfig, setTvTimersConfig } from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { useAppStore } from '../store/useAppStore'

function parseIntSafe(raw: string): number | null {
  const s = raw.replace(/[^\d]/g, '')
  if (!s) return null
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : null
}

function toSeconds(ms: number): number {
  return Math.max(1, Math.round(ms / 1000))
}

function toMsFromSecondsInput(raw: string): number | null {
  const n = parseIntSafe(raw)
  if (n == null) return null
  return Math.max(1, n) * 1000
}

export function ConfigTvTimersPage() {
  const { showToast } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rankingsSec, setRankingsSec] = useState('30')
  const [avisosSec, setAvisosSec] = useState('10')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const cfg = await getTvTimersConfig()
      setRankingsSec(String(toSeconds(cfg.rankingsRotateMs)))
      setAvisosSec(String(toSeconds(cfg.avisosRotateMs)))
    } catch (err) {
      showToast(formatFirebaseOrUnknownError(err) || 'Erro ao carregar', 'err')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  async function salvar() {
    const rankingsRotateMs = toMsFromSecondsInput(rankingsSec)
    const avisosRotateMs = toMsFromSecondsInput(avisosSec)
    if (rankingsRotateMs == null) {
      showToast('Informe o intervalo (segundos) para trocar de ranking.', 'err')
      return
    }
    if (avisosRotateMs == null) {
      showToast('Informe o intervalo (segundos) para trocar de aviso.', 'err')
      return
    }

    setSaving(true)
    try {
      await setTvTimersConfig({ rankingsRotateMs, avisosRotateMs })
      showToast('Temporizadores salvos. Recarregue a TV para aplicar.')
      await load()
    } catch (err) {
      showToast(formatFirebaseOrUnknownError(err) || 'Erro ao salvar', 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="content">
      <div style={{ marginBottom: 20 }}>
        <Link to="/config" className="config-sub-back">
          ← Configurações
        </Link>
        <h2 className="page-title-row" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, marginTop: 10 }}>
          <Timer size={24} strokeWidth={1.65} aria-hidden />
          Temporizadores do modo TV
        </h2>
        <p style={{ color: 'var(--text2)' }}>
          Controla o tempo de troca automática no menu Classificação → TV (rankings) e no slide de Avisos.
        </p>
      </div>

      <div className="card">
        <div className="card-header" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="card-title">Intervalos</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={load} disabled={saving}>
              Recarregar
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={salvar} disabled={saving || loading}>
              Salvar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading" style={{ padding: 24 }}>
            <div className="spin" /> Carregando...
          </div>
        ) : (
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 10 }}>
            <label style={{ gridColumn: 'span 6', display: 'grid', gap: 6, fontSize: 13 }}>
              Trocar de ranking (segundos)
              <input
                className="di"
                inputMode="numeric"
                placeholder="Ex.: 30"
                value={rankingsSec}
                disabled={saving}
                onChange={(e) => setRankingsSec(e.target.value)}
              />
              <span style={{ color: 'var(--text3)', fontSize: 12 }}>
                Mínimo 5s, máximo 300s.
              </span>
            </label>

            <label style={{ gridColumn: 'span 6', display: 'grid', gap: 6, fontSize: 13 }}>
              Trocar de aviso (segundos)
              <input
                className="di"
                inputMode="numeric"
                placeholder="Ex.: 10"
                value={avisosSec}
                disabled={saving}
                onChange={(e) => setAvisosSec(e.target.value)}
              />
              <span style={{ color: 'var(--text3)', fontSize: 12 }}>
                Mínimo 3s, máximo 120s.
              </span>
            </label>

            <div style={{ gridColumn: 'span 12', color: 'var(--text3)', fontSize: 12 }}>
              Dica: após salvar, recarregue a página da TV para garantir que os timers novos sejam aplicados.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

