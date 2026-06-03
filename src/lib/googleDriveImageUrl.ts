/** Extrai o ID de ficheiro de URLs comuns do Google Drive. */
export function extractGoogleDriveFileId(url: string): string | null {
  const raw = url.trim()
  if (!raw) return null
  const fileMatch = raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (fileMatch) return fileMatch[1]
  const idMatch = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (idMatch) return idMatch[1]
  const ucMatch = raw.match(/\/uc\?[^#]*\bid=([a-zA-Z0-9_-]+)/)
  if (ucMatch) return ucMatch[1]
  return null
}

/** URL direta para `<img>` (ficheiro tem de estar partilhado: “Qualquer pessoa com o link”). */
export function resolveGoogleDriveImageUrl(input: string): string {
  const raw = input.trim()
  if (!raw) return ''
  const lower = raw.toLowerCase()
  if (!lower.includes('drive.google.com') && !lower.includes('docs.google.com')) {
    return raw
  }
  const id = extractGoogleDriveFileId(raw)
  if (!id) return raw
  return `https://drive.google.com/uc?export=view&id=${id}`
}

/** Alternativa quando `export=view` falha no browser. */
export function resolveGoogleDriveThumbnailUrl(input: string, width = 2000): string {
  const raw = input.trim()
  if (!raw) return ''
  const id = extractGoogleDriveFileId(raw)
  if (!id) return resolveGoogleDriveImageUrl(raw)
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${Math.min(4000, Math.max(200, width))}`
}

export function isLikelyGoogleDriveUrl(input: string): boolean {
  const s = input.trim().toLowerCase()
  return s.includes('drive.google.com') || s.includes('docs.google.com')
}
