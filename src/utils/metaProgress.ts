/**
 * Percentual em relação à meta (`atual` / `alvo` × 100).
 * Quando > 100%, inclui quanto foi superado em relação ao valor da meta.
 */
export function metaPctParts(atual: number, alvo: number): {
  rawPct: number
  barPct: number
  /** Pontos percentuais acima de 100% da meta, ex.: meta 100, atual 124 → 24 */
  superacaoPct: number | null
  /** Texto curto: "87%" ou "124% (+24%)" */
  labelShort: string
  /** Texto explícito para linhas de resumo */
  labelLong: string
} {
  if (alvo <= 0 || !Number.isFinite(atual) || !Number.isFinite(alvo)) {
    return { rawPct: 0, barPct: 0, superacaoPct: null, labelShort: '—', labelLong: '—' }
  }
  const ratio = atual / alvo
  const rawPct = Math.round(ratio * 100)
  const barPct = Math.min(rawPct, 100)
  if (rawPct <= 100) {
    return {
      rawPct,
      barPct,
      superacaoPct: null,
      labelShort: `${rawPct}%`,
      labelLong: `${rawPct}%`
    }
  }
  const superacaoPct = Math.round((ratio - 1) * 100)
  return {
    rawPct,
    barPct: 100,
    superacaoPct,
    labelShort: `${rawPct}% (+${superacaoPct}%)`,
    labelLong: `${rawPct}% · meta superada em +${superacaoPct}%`
  }
}

/** Badge de projeção vs meta (valor projetado no fim do período). */
export function projMetaBadge(projected: number, metaVal: number | undefined): string {
  if (metaVal == null || metaVal <= 0 || !Number.isFinite(projected)) return '—'
  return metaPctParts(projected, metaVal).labelShort
}
