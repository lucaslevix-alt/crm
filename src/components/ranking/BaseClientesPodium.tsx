import { Users } from 'lucide-react'

function fmtInt(n: number): string {
  return Math.max(0, Math.floor(n)).toLocaleString('pt-BR')
}

export function BaseClientesPodium({
  tvMode,
  totalMain,
  labelMain,
  totalLeft,
  labelLeft,
  totalRight,
  labelRight
}: {
  tvMode?: boolean
  totalMain: number
  labelMain: string
  totalLeft: number
  labelLeft: string
  totalRight: number
  labelRight: string
}) {
  return (
    <div className={`base-op-podium${tvMode ? ' base-op-podium--tv' : ''}`}>
      <div className="base-op-podium-deck-glow" aria-hidden />
      <p className="base-op-podium-kicker">
        <Users size={tvMode ? 28 : 22} strokeWidth={1.65} className="base-op-podium-kicker-ic" aria-hidden />
        Clientes ativos na operação
      </p>
      <div className="base-op-podium-row">
        <div className="base-op-podium-side">
          <div className="base-op-podium-side-inner">
            <span className="base-op-podium-side-label">{labelLeft}</span>
            <span className="base-op-podium-side-num">{fmtInt(totalLeft)}</span>
          </div>
          <div className="base-op-podium-pillar base-op-podium-pillar--side" aria-hidden />
        </div>
        <div className="base-op-podium-center">
          <div className="base-op-podium-center-card">
            <span className="base-op-podium-center-label">{labelMain}</span>
            <span className="base-op-podium-hero-num">{fmtInt(totalMain)}</span>
            <span className="base-op-podium-center-sub">total no mês</span>
          </div>
          <div className="base-op-podium-pillar base-op-podium-pillar--center" aria-hidden />
        </div>
        <div className="base-op-podium-side">
          <div className="base-op-podium-side-inner">
            <span className="base-op-podium-side-label">{labelRight}</span>
            <span className="base-op-podium-side-num">{fmtInt(totalRight)}</span>
          </div>
          <div className="base-op-podium-pillar base-op-podium-pillar--side" aria-hidden />
        </div>
      </div>
    </div>
  )
}
