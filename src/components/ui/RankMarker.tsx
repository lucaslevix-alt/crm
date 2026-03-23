export function RankMarker({ index }: { index: number }) {
  const n = index + 1
  const tier = index < 3 ? (['gold', 'silver', 'bronze'] as const)[index] : ''
  return <span className={`rank-marker ${tier}`}>{n}</span>
}
