import { useCallback, useEffect, useState } from 'react'
import { listSquadsOperacao, type SquadOperacaoRow } from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { Trophy } from 'lucide-react'
import { RankingPodiumThree } from '../components/ranking/RankingPodium'
import { RankMarker } from '../components/ui/RankMarker'
import { fmtBRLSaldoOp } from '../lib/fmtBRLSaldoOp'

function fmt(v: number): string {
  const n = Number(v)
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(n) ? n : 0)
}

function fmtPctMantido(inicial: number, saldo: number): string {
  if (inicial <= 0) return '—'
  const p = (saldo / inicial) * 100
  if (!Number.isFinite(p)) return '—'
  return `${p.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 0 })}%`
}

function perdidoRs(inicial: number, saldo: number): number {
  return Math.max(0, inicial - saldo)
}

function saldoCor(saldo: number): string | undefined {
  if (saldo < 0) return 'var(--red)'
  return undefined
}

/** # | Squad | Bônus atual | % mantido | Perdido */
const R_OP_PODIUM_GRID =
  '32px minmax(96px, 1.25fr) minmax(88px, 1fr) minmax(72px, 0.85fr) minmax(88px, 1fr)'

function RankingItem({
  index,
  name,
  sub,
  val,
  valColor
}: {
  index: number
  name: React.ReactNode
  sub: React.ReactNode
  val: string
  valColor?: string
}) {
  return (
    <div className="ri">
      <div className="rn">
        <RankMarker index={index} />
      </div>
      <div className="ri-info">
        <div className="ri-name">{name}</div>
        <div className="ri-sub">{sub}</div>
      </div>
      <div className="ri-val" style={valColor ? { color: valColor, fontWeight: 700 } : undefined}>
        {val}
      </div>
    </div>
  )
}

export function RankingOperacaoPage({
  tvMode,
  tvRefreshKey
}: { tvMode?: boolean; tvRefreshKey?: number } = {}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<SquadOperacaoRow[]>([])
  const [view, setView] = useState<'lista' | 'podio'>(() => (tvMode ? 'podio' : 'lista'))

  useEffect(() => {
    if (tvMode) setView('podio')
  }, [tvMode])

  const loadRanking = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) setLoading(true)
    setError(null)
    try {
      const list = await listSquadsOperacao()
      const sorted = [...list].sort((a, b) => b.bonusSaldo - a.bonusSaldo || a.nome.localeCompare(b.nome))
      setRows(sorted)
    } catch (err) {
      setError(formatFirebaseOrUnknownError(err) || 'Erro ao carregar')
      setRows([])
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const silent = tvMode && tvRefreshKey !== undefined && tvRefreshKey > 0
    loadRanking(silent ? { silent: true } : undefined)
  }, [loadRanking, tvRefreshKey, tvMode])

  const listDisplay = [...rows].sort((a, b) => b.bonusSaldo - a.bonusSaldo || a.nome.localeCompare(b.nome))

  return (
    <>
      {!tvMode && (
        <div className="ctrl-row" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <span className="ctrl-label">Visualização:</span>
          <div style={{ display: 'inline-flex', borderRadius: 999, border: '1px solid var(--border2)', overflow: 'hidden' }}>
            <button
              type="button"
              className="prd-btn"
              style={{
                borderRadius: 0,
                border: 'none',
                background: view === 'lista' ? 'var(--btn-bg)' : 'transparent',
                color: view === 'lista' ? 'var(--btn-fg)' : 'var(--text2)',
                padding: '4px 12px',
                fontSize: 12
              }}
              onClick={() => setView('lista')}
            >
              Lista
            </button>
            <button
              type="button"
              className="prd-btn"
              style={{
                borderRadius: 0,
                border: 'none',
                background: view === 'podio' ? 'var(--btn-bg)' : 'transparent',
                color: view === 'podio' ? 'var(--btn-fg)' : 'var(--text2)',
                padding: '4px 12px',
                fontSize: 12
              }}
              onClick={() => setView('podio')}
            >
              Pódio
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="empty">
          <p>{error}</p>
        </div>
      )}
      {loading && (
        <div className="loading" style={{ padding: 24 }}>
          <div className="spin" /> Carregando...
        </div>
      )}

      {!loading && !error && view === 'lista' && (
        <div style={{ marginTop: 16 }}>
          <div className="card mb">
            <div className="card-header">
              <span className="card-title card-title--ic">
                <Trophy size={16} strokeWidth={1.65} aria-hidden />
                Por saldo de bônus
              </span>
            </div>
            <div>
              {listDisplay.length ? (
                listDisplay.map((x, i) => {
                  const sub = (
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                      {fmtPctMantido(x.bonusInicial, x.bonusSaldo)} do bônus · Perdeu {fmt(perdidoRs(x.bonusInicial, x.bonusSaldo))}
                    </span>
                  )
                  return (
                    <RankingItem
                      key={x.id}
                      index={i}
                      valColor={saldoCor(x.bonusSaldo)}
                      name={
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              background: x.fotoUrl ? `url(${x.fotoUrl}) center/cover` : 'var(--bg3)',
                              border: '1px solid var(--border2)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11,
                              fontWeight: 800,
                              color: 'var(--text3)',
                              flexShrink: 0
                            }}
                          >
                            {!x.fotoUrl && x.nome.charAt(0).toUpperCase()}
                          </span>
                          {x.nome}
                        </span>
                      }
                      sub={sub}
                      val={fmtBRLSaldoOp(x.bonusSaldo)}
                    />
                  )
                })
              ) : (
                <div className="empty">
                  <p>Nenhum squad operacional. Configure em Configurações → Gestão OP.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && !error && view === 'podio' && (
        <div style={{ marginTop: 16 }}>
          <div className="card mb">
            <div className="card-header">
              <span className="card-title card-title--ic">
                <Trophy size={16} strokeWidth={1.65} aria-hidden />
                Pódio operacional — Bônus
              </span>
            </div>
            <div style={{ padding: 16 }}>
              {listDisplay.length === 0 ? (
                <div className="empty">
                  <p>Sem squads operacionais cadastrados</p>
                </div>
              ) : (
                <>
                  {(() => {
                    const podium = listDisplay.slice(0, 3)
                    const toPerson = (s: SquadOperacaoRow) => {
                      const perd = perdidoRs(s.bonusInicial, s.bonusSaldo)
                      const pct = fmtPctMantido(s.bonusInicial, s.bonusSaldo)
                      return {
                        id: s.id,
                        nome: s.nome,
                        photoUrl: s.fotoUrl || undefined,
                        valueMain: fmtBRLSaldoOp(s.bonusSaldo),
                        valueLabel: 'saldo do bônus',
                        saldoNegativo: s.bonusSaldo < 0,
                        sub: (
                          <span style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.35 }}>
                            {pct} do bônus mantido
                            <br />
                            Perdeu {fmt(perd)}
                            {s.bonusSaldo < 0 && (
                              <>
                                <br />
                                <span style={{ color: 'var(--red)', fontWeight: 600 }}>Saldo negativo</span>
                              </>
                            )}
                          </span>
                        )
                      }
                    }
                    return (
                      <RankingPodiumThree
                        first={podium[0] ? toPerson(podium[0]) : null}
                        second={podium[1] ? toPerson(podium[1]) : null}
                        third={podium[2] ? toPerson(podium[2]) : null}
                      />
                    )
                  })()}
                  <div className="rpodium-table">
                    <div className="rpodium-table-head" style={{ gridTemplateColumns: R_OP_PODIUM_GRID }}>
                      <span className="rpodium-medal-col">#</span>
                      <span>Squad</span>
                      <span style={{ textAlign: 'right' }} title="Saldo atual do bônus">
                        Bônus atual
                      </span>
                      <span style={{ textAlign: 'right' }} title="Saldo ÷ bônus inicial">
                        % do bônus
                      </span>
                      <span style={{ textAlign: 'right' }} title="Bônus inicial menos saldo atual">
                        Perdido
                      </span>
                    </div>
                    {listDisplay.map((s, idx) => {
                      const perd = perdidoRs(s.bonusInicial, s.bonusSaldo)
                      return (
                        <div
                          key={s.id}
                          className={`rpodium-table-row ${idx === 0 ? 'rpodium-table-row--first' : ''}`}
                          style={{ gridTemplateColumns: R_OP_PODIUM_GRID }}
                        >
                          <span className="rpodium-medal-col">
                            <RankMarker index={idx} />
                          </span>
                          <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 8,
                                background: s.fotoUrl ? `url(${s.fotoUrl}) center/cover` : 'var(--bg3)',
                                border: '1px solid var(--border2)',
                                flexShrink: 0,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                fontWeight: 800,
                                color: 'var(--text3)'
                              }}
                            >
                              {!s.fotoUrl && s.nome.charAt(0).toUpperCase()}
                            </span>
                            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.nome}
                            </span>
                          </span>
                          <span
                            style={{
                              textAlign: 'right',
                              fontWeight: idx === 0 ? 800 : 600,
                              color:
                                s.bonusSaldo < 0 ? 'var(--red)' : idx === 0 ? 'var(--green)' : undefined
                            }}
                          >
                            {fmtBRLSaldoOp(s.bonusSaldo)}
                          </span>
                          <span
                            style={{
                              textAlign: 'right',
                              color: s.bonusSaldo < 0 ? 'var(--red)' : undefined
                            }}
                          >
                            {fmtPctMantido(s.bonusInicial, s.bonusSaldo)}
                          </span>
                          <span style={{ textAlign: 'right' }}>{fmt(perd)}</span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
