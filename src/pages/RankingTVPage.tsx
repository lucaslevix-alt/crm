import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { RankingSDRPage } from './RankingSDRPage'
import { RankingCloserPage } from './RankingCloserPage'
import { RankingSquadsPage } from './RankingSquadsPage'

const ROTATE_MS = 30_000

const SLIDES = [
  { key: 'sdr', Component: RankingSDRPage },
  { key: 'closer', Component: RankingCloserPage },
  { key: 'squads', Component: RankingSquadsPage }
] as const

export function RankingTVPage() {
  const navigate = useNavigate()
  const [slide, setSlide] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setSlide((sl) => (sl + 1) % SLIDES.length)
    }, ROTATE_MS)
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

  return (
    <div className="rankings-tv-inner">
      <div className="rankings-tv-stage">
        {SLIDES.map((s, i) => {
          const Cmp = s.Component
          return (
            <div
              key={s.key}
              className="rankings-tv-slide-layer"
              hidden={i !== slide}
              aria-hidden={i !== slide}
            >
              <Cmp tvMode />
            </div>
          )
        })}
      </div>
      <p className="rankings-tv-exit-hint">
        <button type="button" className="rankings-tv-exit-link" onClick={() => navigate('/rankings/sdr')}>
          Sair do modo TV
        </button>
        <span className="rankings-tv-exit-kbd"> ou Esc</span>
      </p>
    </div>
  )
}
