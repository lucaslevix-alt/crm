import { useEffect, useState } from 'react'
import { MonitorPlay } from 'lucide-react'
import { RankingSDRPage } from './RankingSDRPage'
import { RankingCloserPage } from './RankingCloserPage'
import { RankingSquadsPage } from './RankingSquadsPage'

const ROTATE_SECONDS = 30

const SLIDES = [
  { key: 'sdr', label: 'SDR', Component: RankingSDRPage },
  { key: 'closer', label: 'Closer', Component: RankingCloserPage },
  { key: 'squads', label: 'Squads', Component: RankingSquadsPage }
] as const

export function RankingTVPage() {
  const [slide, setSlide] = useState(0)
  const [secsLeft, setSecsLeft] = useState(ROTATE_SECONDS)

  useEffect(() => {
    const id = window.setInterval(() => {
      setSecsLeft((s) => {
        if (s <= 1) {
          setSlide((sl) => (sl + 1) % SLIDES.length)
          return ROTATE_SECONDS
        }
        return s - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  const { Component, label } = SLIDES[slide]
  const progressPct = ((ROTATE_SECONDS - secsLeft) / ROTATE_SECONDS) * 100

  return (
    <div>
      <div
        className="rankings-tv-bar"
        style={{
          marginBottom: 20,
          padding: '14px 18px',
          borderRadius: 12,
          border: '1px solid var(--border2)',
          background: 'var(--surface2)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 14
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <MonitorPlay size={22} strokeWidth={1.65} aria-hidden style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: 0.02 }}>Modo TV</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
              Pódios alternam a cada {ROTATE_SECONDS}s · período: este mês
            </div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {SLIDES.map((s, i) => (
              <span
                key={s.key}
                className={i === slide ? 'db-tag db-tag--green' : 'db-tag'}
                style={{
                  margin: 0,
                  textTransform: 'none',
                  letterSpacing: 'normal',
                  fontSize: 12,
                  opacity: i === slide ? 1 : 0.55,
                  fontWeight: i === slide ? 700 : 500
                }}
              >
                {s.label}
              </span>
            ))}
          </div>
          <div
            aria-hidden
            style={{
              height: 4,
              borderRadius: 999,
              background: 'var(--border2)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressPct}%`,
                background: 'var(--accent)',
                borderRadius: 999
              }}
            />
          </div>
        </div>
        <div
          style={{
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 800,
            fontSize: 20,
            color: 'var(--accent)',
            minWidth: 52,
            textAlign: 'right'
          }}
          title="Segundos até o próximo pódio"
        >
          {secsLeft}s
        </div>
      </div>

      <div
        key={SLIDES[slide].key}
        className="rankings-tv-slide"
        style={{ animation: 'rankingsTvFadeIn 0.45s ease-out' }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text2)',
            marginBottom: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.06em'
          }}
        >
          Pódio · {label}
        </div>
        <Component tvMode />
      </div>

      <style>{`
        @keyframes rankingsTvFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
