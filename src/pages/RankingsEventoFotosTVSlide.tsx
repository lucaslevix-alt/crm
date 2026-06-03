import { useCallback, useEffect, useMemo, useState } from 'react'
import { listEventoFotos, type EventoFotoRow } from '../firebase/firestore'
import {
  resolveGoogleDriveImageUrl,
  resolveGoogleDriveThumbnailUrl
} from '../lib/googleDriveImageUrl'

function imageSrcForRow(row: EventoFotoRow): string {
  return resolveGoogleDriveImageUrl(row.link)
}

export function RankingsEventoFotosTVSlide({
  tvRefreshKey,
  rotateMs
}: { tvRefreshKey?: number; rotateMs?: number } = {}) {
  const [rows, setRows] = useState<EventoFotoRow[]>([])
  const [idx, setIdx] = useState(0)
  const [imgSrc, setImgSrc] = useState('')
  const [useThumb, setUseThumb] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const data = await listEventoFotos({ includeInactive: false, limitCount: 200 })
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

  const active = useMemo(() => rows.filter((r) => r.ativo && r.link.trim()), [rows])
  const current = active.length ? active[idx % active.length] : null

  useEffect(() => {
    setIdx(0)
  }, [active.length])

  useEffect(() => {
    if (active.length <= 1) return
    const ms = typeof rotateMs === 'number' && Number.isFinite(rotateMs) ? Math.max(3000, rotateMs) : 8_000
    const id = window.setInterval(() => setIdx((i) => i + 1), ms)
    return () => window.clearInterval(id)
  }, [active.length, rotateMs])

  useEffect(() => {
    if (!current) {
      setImgSrc('')
      setUseThumb(false)
      return
    }
    setUseThumb(false)
    setImgSrc(imageSrcForRow(current))
  }, [current?.id, current?.link])

  const onImgError = useCallback(() => {
    if (!current) return
    if (!useThumb) {
      setUseThumb(true)
      setImgSrc(resolveGoogleDriveThumbnailUrl(current.link))
      return
    }
    setImgSrc('')
  }, [current, useThumb])

  if (!current) {
    return (
      <div className="rankings-tv-eventos-empty">
        <div className="rankings-tv-eventos-empty-title">Eventos LVX</div>
        <p>Nenhuma foto ativa. Adicione em Configurações → Fotos dos eventos.</p>
      </div>
    )
  }

  return (
    <div className="rankings-tv-eventos-slide">
      {imgSrc ? (
        <img
          key={`${current.id}-${useThumb ? 't' : 'v'}`}
          className="rankings-tv-eventos-img"
          src={imgSrc}
          alt={current.legenda || current.evento}
          onError={onImgError}
        />
      ) : (
        <div className="rankings-tv-eventos-empty">
          <p>Não foi possível carregar esta foto. Verifique o link e a partilha no Google Drive.</p>
        </div>
      )}
      <div className="rankings-tv-eventos-caption">
        <div className="rankings-tv-eventos-evento">{current.evento}</div>
        {current.legenda ? <div className="rankings-tv-eventos-legenda">{current.legenda}</div> : null}
        {active.length > 1 && (
          <div className="rankings-tv-eventos-counter">
            {idx % active.length + 1} / {active.length}
          </div>
        )}
      </div>
    </div>
  )
}
