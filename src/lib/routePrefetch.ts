/**
 * Pré-carrega chunks de páginas (dynamic import) antes do clique no menu,
 * para a navegação React Router + lazy() parecer instantânea na maior parte dos casos.
 */
const done = new Set<string>()

function runOnce(key: string, loader: () => Promise<unknown>) {
  if (done.has(key)) return
  done.add(key)
  void loader().catch(() => done.delete(key))
}

/** Chamado em pointerenter/focus nos links do menu (path completo, ex. `/dashboard`). */
export function prefetchPath(raw: string) {
  const path = raw.split('?')[0].replace(/\/+$/, '') || '/'
  const parts = path.split('/').filter(Boolean)
  const a = parts[0] ?? 'dashboard'
  const b = parts[1]

  if (a === 'dashboard' || path === '/' || parts.length === 0) {
    runOnce('p:dashboard', () => import('../pages/DashboardPage'))
    return
  }
  if (a === 'meta-ads') {
    runOnce('p:meta-ads', () => import('../pages/MetaAdsPage'))
    return
  }
  if (a === 'leads-meta') {
    runOnce('p:leads-meta', () => import('../pages/MetaLeadsPage'))
    return
  }
  if (a === 'registros') {
    runOnce('p:registros', () => import('../pages/RegistrosPage'))
    return
  }
  if (a === 'agenda') {
    runOnce('p:agenda', () => import('../pages/AgendaPage'))
    return
  }
  if (a === 'funil') {
    runOnce('p:funil', () => import('../pages/FunilPage'))
    return
  }
  if (a === 'metas' && !b) {
    runOnce('p:metas', () => import('../pages/MetasPage'))
    return
  }
  if (a === 'rankings') {
    runOnce('p:rankings-all', () =>
      Promise.all([
        import('../pages/RankingsPage'),
        import('../pages/RankingSDRPage'),
        import('../pages/RankingCloserPage'),
        import('../pages/RankingSquadsPage'),
        import('../pages/RankingMetasPage'),
        import('../pages/RankingTVPage')
      ])
    )
    return
  }
  if (a === 'propostas-fechamento') {
    runOnce('p:propostas', () => import('../pages/PropostasFechamentoPage'))
    return
  }
  if (a === 'config') {
    runOnce('p:config-bundle', () =>
      Promise.all([
        import('../pages/ConfigHubPage'),
        import('../pages/ConfigMetasPage'),
        import('../pages/RelatoriosComissoesPage'),
        import('../pages/UsuariosPage'),
        import('../pages/SquadsPage'),
        import('../pages/ProdutosPage')
      ])
    )
    return
  }
  if (a === 'auditoria') {
    runOnce('p:auditoria', () => import('../pages/AuditoriaPage'))
    return
  }
}

/** Após login, quando o browser estiver ocioso — páginas mais visitadas. */
export function prefetchCommonRoutesIdle(): () => void {
  if (typeof globalThis === 'undefined') return () => {}
  const run = () => {
    prefetchPath('/dashboard')
    prefetchPath('/registros')
  }
  if (typeof globalThis.requestIdleCallback === 'function') {
    const idleId = globalThis.requestIdleCallback(run, { timeout: 2800 })
    return () => {
      if (typeof globalThis.cancelIdleCallback === 'function') globalThis.cancelIdleCallback(idleId)
    }
  }
  const t = globalThis.setTimeout(run, 1800)
  return () => globalThis.clearTimeout(t)
}
