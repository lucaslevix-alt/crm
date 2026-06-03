/** Um link por linha; ignora linhas vazias e duplicados (case-insensitive). */
export function parseEventoFotoLinksFromText(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || !/^https?:\/\//i.test(t)) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}
