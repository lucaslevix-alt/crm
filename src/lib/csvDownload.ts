/** Escapa célula para CSV (RFC-style). */
export function csvEscapeCell(s: string): string {
  const t = String(s ?? '')
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`
  return t
}

/** Gera CSV com BOM UTF-8 para abrir corretamente no Excel. */
export function downloadCsvUtf8Bom(filename: string, rows: string[][]): void {
  const lines = rows.map((r) => r.map(csvEscapeCell).join(','))
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
