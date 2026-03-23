import { Trophy } from 'lucide-react'

export type PodiumPerson = {
  id: string
  nome: string
  photoUrl?: string
  valueMain: string
  valueLabel?: string
  sub?: string
}

function PodiumSlot({
  person,
  rank
}: {
  person?: PodiumPerson | null
  rank: 1 | 2 | 3
}) {
  if (!person) {
    return <div className={`rpodium-slot rpodium-slot--r${rank} rpodium-slot--empty`} aria-hidden />
  }
  const isFirst = rank === 1
  return (
    <div className={`rpodium-slot rpodium-slot--r${rank}`}>
      {isFirst && (
        <div className="rpodium-trophy" aria-hidden>
          <Trophy size={26} strokeWidth={1.65} />
        </div>
      )}
      <div className={`rpodium-card ${isFirst ? 'rpodium-card--r1' : ''}`}>
        <div
          className={`rpodium-avatar ${isFirst ? 'rpodium-avatar--r1' : ''}`}
          style={
            person.photoUrl
              ? { backgroundImage: `url(${person.photoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : undefined
          }
        >
          {!person.photoUrl && (person.nome || '?').charAt(0).toUpperCase()}
        </div>
        <div className={`rpodium-name ${isFirst ? 'rpodium-name--r1' : ''}`}>{person.nome}</div>
        <div className={`rpodium-valuebox ${isFirst ? 'rpodium-valuebox--r1' : ''}`}>
          <div className={`rpodium-value-main ${isFirst ? 'rpodium-value-main--r1' : ''}`}>{person.valueMain}</div>
          {person.valueLabel && <div className="rpodium-value-label">{person.valueLabel}</div>}
        </div>
        {person.sub && <div className="rpodium-sub">{person.sub}</div>}
      </div>
      <div className={`rpodium-pillar rpodium-pillar--r${rank}`}>
        <span>{rank}</span>
      </div>
    </div>
  )
}

export function RankingPodiumThree({
  first,
  second,
  third
}: {
  first?: PodiumPerson | null
  second?: PodiumPerson | null
  third?: PodiumPerson | null
}) {
  return (
    <div className="rpodium">
      <div className="rpodium-row">
        <PodiumSlot person={second} rank={2} />
        <PodiumSlot person={first} rank={1} />
        <PodiumSlot person={third} rank={3} />
      </div>
      <div className="rpodium-deck" aria-hidden />
    </div>
  )
}
