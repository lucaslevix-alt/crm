import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { parseCsv } from '../lib/csv'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'

const LS_SHEET_URL = 'leadsMetaSheetUrl'
const LS_SHEET_TAB = 'leadsMetaSheetTab'

const DEFAULT_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1m3mMpJy0HURqpoAQXLO8_9tSfLGfVhzD_tmJjKURAqA/edit?usp=sharing'
const DEFAULT_TAB = 'Cadastro nativo'

const MQL_FAT_CODES = new Set(['de_r$_20_mil_a_r$_50_mil', 'de_r$_50_a_100_mil', 'acima_de_r$_100_mil'])

function stripAccents(s: string): string {
  try {
    return s.normalize('NFD').replace(/\p{Diacritic}+/gu, '')
  } catch {
    // Safari antigo pode falhar em \p{Diacritic}
    return s
  }
}

function normKey(s: string): string {
  const a = stripAccents(String(s ?? '').trim().toLowerCase())
  return a
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
}

function extractSpreadsheetId(urlOrId: string): string | null {
  const raw = String(urlOrId ?? '').trim()
  if (!raw) return null
  if (/^[a-zA-Z0-9-_]{20,}$/.test(raw) && !raw.includes('/')) return raw
  const m = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return m?.[1] ?? null
}

function isPublishedCsvUrl(url: string): boolean {
  const u = String(url ?? '')
  return u.includes('docs.google.com') && u.includes('output=csv')
}

function pickColIndex(headers: string[], wanted: string[]): number {
  const hn = headers.map((h) => normKey(h))
  for (const w of wanted) {
    const wi = hn.indexOf(normKey(w))
    if (wi >= 0) return wi
  }
  return -1
}

type SheetRow = Record<string, string>

function rowsFromCsv(grid: string[][]): { headers: string[]; rows: SheetRow[] } {
  const headers = grid[0] ?? []
  const rows = (grid.slice(1) ?? []).map((r) => {
    const o: SheetRow = {}
    for (let i = 0; i < headers.length; i++) o[headers[i] ?? String(i)] = r[i] ?? ''
    return o
  })
  return { headers, rows }
}

export function LeadsMetaSheetPage() {
  const [sheetUrl, setSheetUrl] = useState(() => localStorage.getItem(LS_SHEET_URL) ?? DEFAULT_SHEET_URL)
  const [tab, setTab] = useState(() => localStorage.getItem(LS_SHEET_TAB) ?? DEFAULT_TAB)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<SheetRow[]>([])
  const [lastLoadedAt, setLastLoadedAt] = useState<string>('')

  const spreadsheetId = useMemo(() => extractSpreadsheetId(sheetUrl), [sheetUrl])
  const publishedCsv = useMemo(() => (isPublishedCsvUrl(sheetUrl) ? sheetUrl.trim() : ''), [sheetUrl])

  const reload = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      let text = ''
      if (publishedCsv) {
        const res = await fetch(publishedCsv)
        if (!res.ok) throw new Error(`Falha ao carregar o CSV (${res.status}).`)
        text = await res.text()
      } else {
        // Sem CSV publicado, o browser vai bloquear por CORS. Orientamos o utilizador a publicar.
        if (!spreadsheetId) throw new Error('Link/ID da planilha inválido.')
        throw new Error(
          'Para o sistema consumir sem complicação, publique a aba no Google Sheets como CSV (Arquivo → Publicar na Web → Aba "Cadastro nativo" → CSV) e cole aqui o link gerado (ele contém "output=csv").'
        )
      }
      if (!text.trim()) throw new Error('CSV vazio.')
      const grid = parseCsv(text)
      if (!grid.length) throw new Error('Planilha vazia (CSV sem linhas).')
      const { headers, rows } = rowsFromCsv(grid)
      setHeaders(headers)
      setRows(rows)
      setLastLoadedAt(new Date().toISOString())
      try {
        localStorage.setItem(LS_SHEET_URL, sheetUrl)
        localStorage.setItem(LS_SHEET_TAB, tab)
      } catch {
        /* ignore */
      }
    } catch (e) {
      setErr(formatFirebaseOrUnknownError(e) || String((e as Error)?.message || e) || 'Erro ao carregar')
      setHeaders([])
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [publishedCsv, sheetUrl, spreadsheetId, tab])

  useEffect(() => {
    void reload()
  }, [reload])

  const fatCol = useMemo(() => {
    const idx = pickColIndex(headers, [
      'qua_sua_receita_mensal?_(faturamento)',
      'qual_a_sua_media_de_faturamento',
      'qual_a_sua_média_de_faturamento',
      'qual a sua média de faturamento?',
      'qual a sua média de faturamento'
    ])
    return idx
  }, [headers])

  const utmSourceCol = useMemo(() => pickColIndex(headers, ['utm_source', 'utm source']), [headers])

  const stats = useMemo(() => {
    const total = rows.length
    let withFat = 0
    let mql = 0
    let adsTotal = 0
    let adsWithFat = 0
    let adsMql = 0

    for (const r of rows) {
      const fatRaw = fatCol >= 0 ? (Object.values(r)[fatCol] ?? '') : ''
      const fat = normKey(fatRaw)
      const hasFat = Boolean(fat)
      if (hasFat) withFat++
      const isMql = hasFat && MQL_FAT_CODES.has(fat)
      if (isMql) mql++

      const utm = utmSourceCol >= 0 ? normKey(Object.values(r)[utmSourceCol] ?? '') : ''
      const isAds = utm === 'meta' || utm.includes('meta')
      if (isAds) {
        adsTotal++
        if (hasFat) adsWithFat++
        if (isMql) adsMql++
      }
    }

    const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0)

    return {
      total,
      withFat,
      mql,
      pctMql: pct(mql, withFat),
      adsTotal,
      adsWithFat,
      adsMql,
      pctAdsMql: pct(adsMql, adsWithFat)
    }
  }, [rows, fatCol, utmSourceCol])

  return (
    <div className="content">
      <div className="page-title-row" style={{ marginBottom: 8 }}>
        <h1 className="page-title" style={{ fontSize: 22 }}>Leads Meta — MQL (%)</h1>
        <button type="button" className="btn btn-ghost btn-sm" onClick={reload} disabled={loading} title="Recarregar">
          <RefreshCw size={16} strokeWidth={1.65} aria-hidden /> {loading ? 'Carregando…' : 'Recarregar'}
        </button>
      </div>
      <p style={{ color: 'var(--text2)', marginBottom: 18, maxWidth: 820 }}>
        Lê a Google Sheets (export CSV) e calcula a % de MQL pela coluna de faturamento. MQL = faturamento acima de R$ 20 mil.
      </p>

      <div className="card mb" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Fonte</span>
        </div>
        <div style={{ padding: 16, display: 'grid', gap: 12 }}>
          <div className="fg" style={{ marginBottom: 0 }}>
            <label>Link do CSV publicado (recomendado) ou link da planilha</label>
            <input className="di" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder={DEFAULT_SHEET_URL} />
          </div>
          <div className="fg" style={{ marginBottom: 0 }}>
            <label>Aba (tab)</label>
            <input className="di" value={tab} onChange={(e) => setTab(e.target.value)} placeholder={DEFAULT_TAB} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {publishedCsv ? (
              <>
                A usar CSV publicado (sem CORS) ·{' '}
                <span style={{ color: 'var(--text2)' }}>OK</span>
                {lastLoadedAt ? ` · Última carga: ${new Date(lastLoadedAt).toLocaleString('pt-BR')}` : null}
              </>
            ) : spreadsheetId ? (
              <>
                Planilha detectada: <span style={{ color: 'var(--text2)' }}>{spreadsheetId}</span>
                {lastLoadedAt ? ` · Última carga: ${new Date(lastLoadedAt).toLocaleString('pt-BR')}` : null}
              </>
            ) : (
              <>Cole o link do Google Sheets acima.</>
            )}
          </div>
          {!publishedCsv && (
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              Dica rápida: no Google Sheets vá em <strong>Arquivo → Publicar na Web</strong>, escolha a aba{' '}
              <strong>{tab || 'Cadastro nativo'}</strong> e formato <strong>CSV</strong>. Cole aqui o link que contém{' '}
              <strong>output=csv</strong>.
            </div>
          )}
        </div>
      </div>

      {err && (
        <div className="empty">
          <p>{err}</p>
        </div>
      )}

      {loading && (
        <div className="loading" style={{ padding: 24 }}>
          <div className="spin" /> Carregando...
        </div>
      )}

      {!loading && !err && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">MQL</span>
          </div>
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            {fatCol < 0 ? (
              <div className="empty">
                <p>
                  Não encontrei a coluna de faturamento. Verifique se existe uma coluna como{' '}
                  <strong>“Qual a sua média de faturamento?”</strong> ou <strong>“qua_sua_receita_mensal?_(faturamento)”</strong>.
                </p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div className="stat-card purple" style={{ minWidth: 200 }}>
                    <div className="glow-dot" />
                    <div className="stat-value">{stats.total.toLocaleString('pt-BR')}</div>
                    <div className="stat-label">Leads (linhas)</div>
                  </div>
                  <div className="stat-card amber" style={{ minWidth: 200 }}>
                    <div className="glow-dot" />
                    <div className="stat-value">{stats.withFat.toLocaleString('pt-BR')}</div>
                    <div className="stat-label">Com faturamento</div>
                  </div>
                  <div className="stat-card green" style={{ minWidth: 200 }}>
                    <div className="glow-dot" />
                    <div className="stat-value">{stats.mql.toLocaleString('pt-BR')}</div>
                    <div className="stat-label">MQL</div>
                  </div>
                  <div className="stat-card orange" style={{ minWidth: 200 }}>
                    <div className="glow-dot" />
                    <div className="stat-value">{stats.pctMql.toFixed(1)}%</div>
                    <div className="stat-label">% MQL (geral)</div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border2)', paddingTop: 12, marginTop: 4 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Somente anúncios (utm_source contém “meta”)</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div className="stat-card purple" style={{ minWidth: 200 }}>
                      <div className="glow-dot" />
                      <div className="stat-value">{stats.adsTotal.toLocaleString('pt-BR')}</div>
                      <div className="stat-label">Leads (meta)</div>
                    </div>
                    <div className="stat-card amber" style={{ minWidth: 200 }}>
                      <div className="glow-dot" />
                      <div className="stat-value">{stats.adsWithFat.toLocaleString('pt-BR')}</div>
                      <div className="stat-label">Com faturamento (meta)</div>
                    </div>
                    <div className="stat-card green" style={{ minWidth: 200 }}>
                      <div className="glow-dot" />
                      <div className="stat-value">{stats.adsMql.toLocaleString('pt-BR')}</div>
                      <div className="stat-label">MQL (meta)</div>
                    </div>
                    <div className="stat-card orange" style={{ minWidth: 200 }}>
                      <div className="glow-dot" />
                      <div className="stat-value">{stats.pctAdsMql.toFixed(1)}%</div>
                      <div className="stat-label">% MQL (meta)</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

