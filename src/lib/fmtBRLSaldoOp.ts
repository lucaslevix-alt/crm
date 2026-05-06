const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Saldo de bônus operacional em BRL.
 * Valores negativos usam o sinal "−" (menos tipográfico) antes do valor absoluto,
 * ex.: bônus inicial R$ 5.000,00 e retiradas R$ 6.500,00 → **−R$ 1.500,00**.
 */
export function fmtBRLSaldoOp(v: number): string {
  const n = Number(v)
  if (!Number.isFinite(n)) return brl.format(0)
  if (n < 0) return `−${brl.format(Math.abs(n))}`
  return brl.format(n)
}
