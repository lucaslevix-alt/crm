import { useEffect, useMemo, useState } from 'react'
import { isAvisoAtivoAgora, listAvisosRecentes, type AvisoRow } from '../firebase/firestore'

const ROTATE_MS = 10_000

function pickActive(rows: AvisoRow[]): AvisoRow[] {
  const now = new Date()
  return rows.filter((r) => isAvisoAtivoAgora(r, now))
}

export function RankingsAvisosTVSlide({ tvRefreshKey }: { tvRefreshKey?: number } = {}) {
  const [rows, setRows] = useState<AvisoRow[]>([])
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const data = await listAvisosRecentes({ includeInactive: false, limitCount: 120 })
        if (!alive) return
        setRows(data)
      } catch {
        if (!alive) return
        setRows([])
      }
    })()
    return () => {
      alive = false
    }
  }, [tvRefreshKey])

  const active = useMemo(() => pickActive(rows), [rows])
  const current = active.length ? active[idx % active.length] : null

  useEffect(() => {
    setIdx(0)
  }, [active.length])

  useEffect(() => {
    if (active.length <= 1) return
    const id = window.setInterval(() => setIdx((i) => i + 1), ROTATE_MS)
    return () => window.clearInterval(id)
  }, [active.length])

  if (!current) {
    return (
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Avisos</div>
          <div style={{ color: 'var(--text2)' }}>Nenhum aviso ativo no momento.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', padding: 24 }}>
      <div
        className="rankings-tv-aviso-slide"
        style={{
          width: 'min(980px, 92vw)',
          borderRadius: 22,
          border: '1px solid rgba(255,255,255,.10)',
          background: 'rgba(255,255,255,.03)',
          padding: 22,
          display: 'grid',
          gridTemplateColumns: current.fotoUrl ? '240px 1fr' : '1fr',
          gap: 18,
          alignItems: 'center'
        }}
      >
        {current.fotoUrl && (
          <img
            src={current.fotoUrl}
            alt=""
            style={{
              width: '100%',
              height: 240,
              objectFit: 'cover',
              borderRadius: 18,
              border: '1px solid rgba(255,255,255,.12)'
            }}
          />
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <span
              style={{
                padding: '6px 10px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: '.02em',
                background:
                  current.prioridade === 'urgente'
                    ? 'rgba(255, 62, 62, 0.22)'
                    : current.prioridade === 'alta'
                      ? 'rgba(255, 184, 0, 0.20)'
                      : 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255,255,255,.12)'
              }}
            >
              {current.prioridade.toUpperCase()}
              {current.fixo ? ' • FIXO' : ''}
            </span>
            <span style={{ color: 'var(--text2)', fontSize: 13, fontWeight: 800 }}>
              {current.tipo === 'comunicado' ? 'Comunicado' : current.tipo === 'operacao' ? 'Operação' : 'Recado'}
            </span>
          </div>

          <div style={{ fontSize: 34, fontWeight: 950, lineHeight: 1.05 }}>{current.titulo}</div>
          <div style={{ marginTop: 14, fontSize: 18, color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>
            {current.mensagem}
          </div>

          {active.length > 1 && (
            <div style={{ marginTop: 18, color: 'var(--text3)', fontSize: 12 }}>
              {idx % active.length + 1} / {active.length}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

