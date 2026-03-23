export function RouteFallback() {
  return (
    <div className="content route-fallback" aria-busy="true" aria-label="A carregar">
      <div className="route-fallback-grid">
        <div className="route-fallback-bar" style={{ width: '42%' }} />
        <div className="route-fallback-bar" style={{ width: '78%' }} />
        <div className="route-fallback-bar" style={{ width: '55%' }} />
      </div>
      <div className="route-fallback-cards">
        <div className="route-fallback-card" />
        <div className="route-fallback-card" />
        <div className="route-fallback-card" />
      </div>
    </div>
  )
}
