/** 1 = Janeiro … 12 = Dezembro */
export const NOME_MES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
] as const

export function labelMesAno(mes: number, ano: number): string {
  const nome = NOME_MES[mes - 1] ?? `Mês ${mes}`
  return `${nome} ${ano}`
}

export function labelPeriodYm(periodYm: string): string {
  const parts = periodYm.trim().split('-')
  if (parts.length < 2) return periodYm
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (!Number.isFinite(y) || !Number.isFinite(m)) return periodYm
  return labelMesAno(m, y)
}

export function mesAnterior(ano: number, mes: number): { ano: number; mes: number } {
  if (mes <= 1) return { ano: ano - 1, mes: 12 }
  return { ano, mes: mes - 1 }
}

export function mesPosterior(ano: number, mes: number): { ano: number; mes: number } {
  if (mes >= 12) return { ano: ano + 1, mes: 1 }
  return { ano, mes: mes + 1 }
}
