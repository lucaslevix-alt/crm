import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { RankingSDRPage } from './RankingSDRPage'
import { RankingCloserPage } from './RankingCloserPage'
import { RankingSquadsPage } from './RankingSquadsPage'
import { RankingOperacaoPage } from './RankingOperacaoPage'

const ROTATE_MS = 30_000
const REFRESH_MS = 60_000
const TV_SLIDES_STORAGE = 'rankingsTvSlideKeys'

const ALL_TV_SLIDES = [
  { key: 'sdr', label: 'SDRs', Component: RankingSDRPage },
  { key: 'closer', label: 'Closers', Component: RankingCloserPage },
  { key: 'squads', label: 'Squads', Component: RankingSquadsPage },
  { key: 'operacao', label: 'Operação', Component: RankingOperacaoPage }
] as const

type TvSlideKey = (typeof ALL_TV_SLIDES)[number]['key']

function allSlideKeys(): TvSlideKey[] {
  return ALL_TV_SLIDES.map((s) => s.key)
}

function loadSlideKeys(): TvSlideKey[] {
  const all = allSlideKeys()
  try {
    const raw = localStorage.getItem(TV_SLIDES_STORAGE)
    if (!raw) return all
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return all
    const filtered = parsed.filter((k): k is TvSlideKey => typeof k === 'string' && (all as readonly string[]).includes(k))
    return filtered.length ? filtered : all
  } catch {
    return all
  }
}

export function RankingTVPage() {
  const navigate = useNavigate()
  const [slideKeys, setSlideKeys] = useState<TvSlideKey[]>(loadSlideKeys)
  const [slide, setSlide] = useState(0)
  const [refreshTick, setRefreshTick] = useState(0)

  const slides = useMemo(() => ALL_TV_SLIDES.filter((s) => slideKeys.includes(s.key)), [slideKeys])

  useEffect(() => {
    setSlide((sl) => (slides.length ? sl % slides.length : 0))
  }, [slides.length])

  useEffect(() => {
    if (slides.length <= 1) return
    const id = window.setInterval(() => {
      setSlide((sl) => (sl + 1) % slides.length)
    }, ROTATE_MS)
    return () => window.clearInterval(id)
  }, [slides.length])

  useEffect(() => {
    const id = window.setInterval(() => {
      setRefreshTick((t) => t + 1)
    }, REFRESH_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (useAppStore.getState().activeModalId) return
      navigate('/rankings/sdr')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate])

  function toggleSlideKey(key: TvSlideKey) {
    setSlideKeys((prev) => {
      const has = prev.includes(key)
      let next = has ? prev.filter((k) => k !== key) : [...prev, key]
      if (next.length === 0) next = prev
      try {
        localStorage.setItem(TV_SLIDES_STORAGE, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const activeIndex = slides.length ? slide % slides.length : 0

  return (
    <div className="rankings-tv-inner">
      <div className="rankings-tv-stage">
        {slides.map((s, i) => {
          const Cmp = s.Component
          return (
            <div
              key={s.key}
              className="rankings-tv-slide-layer"
              hidden={i !== activeIndex}
              aria-hidden={i !== activeIndex}
            >
              <Cmp tvMode tvRefreshKey={refreshTick} />
            </div>
          )
        })}
      </div>
      <details className="rankings-tv-slide-pick" style={{ marginTop: 14 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text2)', userSelect: 'none' }}>
          Classificações neste TV
        </summary>
        <div
          role="group"
          aria-label="Escolher rankings no modo TV"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', marginTop: 12 }}
        >
          {ALL_TV_SLIDES.map((s) => (
            <label
              key={s.key}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={slideKeys.includes(s.key)}
                onChange={() => toggleSlideKey(s.key)}
              />
              {s.label}
            </label>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10, marginBottom: 0 }}>
          Pelo menos uma opção deve ficar marcada. A escolha é guardada neste dispositivo.
        </p>
      </details>
      <p className="rankings-tv-exit-hint">
        <button type="button" className="rankings-tv-exit-link" onClick={() => navigate('/rankings/sdr')}>
          Sair do modo TV
        </button>
        <span className="rankings-tv-exit-kbd"> ou Esc</span>
      </p>
    </div>
  )
}
