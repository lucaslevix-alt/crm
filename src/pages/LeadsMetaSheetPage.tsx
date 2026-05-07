import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { parseCsv } from '../lib/csv'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { getCallable } from '../firebase/functionsClient'

const LS_SHEET_URL = 'leadsMetaSheetUrl'
const LS_SHEET_TAB = 'leadsMetaSheetTab'
const LS_SCRIPT_URL = 'leadsMetaScriptUrl'
const LS_AUTO_REFRESH = 'leadsMetaAutoRefresh'

const DEFAULT_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1m3mMpJy0HURqpoAQXLO8_9tSfLGfVhzD_tmJjKURAqA/edit?usp=sharing'
const DEFAULT_TAB = 'Cadastro nativo'
const DEFAULT_AUTO_REFRESH_SEC = 60

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

function toPublishedCsvUrl(url: string): string {
  const u = String(url ?? '').trim()
  if (!u) return ''
  if (isPublishedCsvUrl(u)) return u
  // Link publicado em HTML (pubhtml) → CSV
  if (u.includes('docs.google.com') && u.includes('/spreadsheets/d/e/') && u.includes('/pubhtml')) {
    // ex.: .../pubhtml?gid=...&single=true  -> .../pub?gid=...&single=true&output=csv
    const next = u.replace('/pubhtml', '/pub')
    return next.includes('output=') ? next : `${next}${next.includes('?') ? '&' : '?'}output=csv`
  }
  return ''
}

function isAppsScriptUrl(url: string): boolean {
  const u = String(url ?? '').trim()
  if (!u.includes('script.google.com') || !u.includes('/macros/s/') || !u.endsWith('/exec')) return false
  const m = u.match(/\/macros\/s\/([^/]+)\/exec/i)
  const seg = (m?.[1] ?? '').trim()
  if (!seg || /xxxx/i.test(seg) || seg.length < 12) return false
  return true
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
  const [scriptUrl, setScriptUrl] = useState(() => {
    const raw = localStorage.getItem(LS_SCRIPT_URL) ?? ''
    return raw && isAppsScriptUrl(raw) ? raw : ''
  })
  const [autoRefresh, setAutoRefresh] = useState(() => (localStorage.getItem(LS_AUTO_REFRESH) ?? '1') === '1')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<SheetRow[]>([])
  const [lastLoadedAt, setLastLoadedAt] = useState<string>('')
  const [uploadedCsvName, setUploadedCsvName] = useState<string>('')
  const [uploadedCsvText, setUploadedCsvText] = useState<string>('')

  const spreadsheetId = useMemo(() => extractSpreadsheetId(sheetUrl), [sheetUrl])
  const publishedCsv = useMemo(() => toPublishedCsvUrl(sheetUrl), [sheetUrl])
  const effectiveScriptUrl = useMemo(() => (isAppsScriptUrl(scriptUrl) ? scriptUrl.trim() : ''), [scriptUrl])

  const reload = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      let text = ''
      if (uploadedCsvText.trim()) {
        text = uploadedCsvText
      } else if (spreadsheetId) {
        const call = getCallable<{ sheetUrlOrId: string; tab: string }, { csv: string }>('fetchPublicSheetCsv')
        const r = await call({ sheetUrlOrId: sheetUrl, tab: tab || DEFAULT_TAB })
        text = String(r.data?.csv ?? '')
      } else if (effectiveScriptUrl) {
        const u = new URL(effectiveScriptUrl)
        u.searchParams.set('tab', tab || DEFAULT_TAB)
        const res = await fetch(u.toString())
        if (!res.ok) throw new Error(`Falha ao carregar via Apps Script (${res.status}).`)
        const json = (await res.json()) as { csv?: string }
        text = String(json?.csv ?? '')
      } else if (publishedCsv) {
        const res = await fetch(publishedCsv)
        if (!res.ok) throw new Error(`Falha ao carregar o CSV (${res.status}).`)
        text = await res.text()
      } else {
        throw new Error(
          'Cole o link de edição da planilha (docs.google.com/.../edit) ou o ID. Com Blaze + Functions deployadas, o sistema lê automaticamente. Alternativa: upload CSV.'
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
        localStorage.setItem(LS_SCRIPT_URL, isAppsScriptUrl(scriptUrl) ? scriptUrl : '')
        localStorage.setItem(LS_AUTO_REFRESH, autoRefresh ? '1' : '0')
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
  }, [autoRefresh, effectiveScriptUrl, publishedCsv, scriptUrl, sheetUrl, spreadsheetId, tab, uploadedCsvText])

  const onUploadCsv = useCallback(async (file: File | null) => {
    if (!file) return
    try {
      const text = await file.text()
      setUploadedCsvName(file.name)
      setUploadedCsvText(text)
      setErr(null)
      setLastLoadedAt(new Date().toISOString())
    } catch (e) {
      setUploadedCsvName('')
      setUploadedCsvText('')
      setErr(formatFirebaseOrUnknownError(e) || 'Erro ao ler o arquivo CSV')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!autoRefresh) return
    if (!effectiveScriptUrl && !publishedCsv && !spreadsheetId) return
    const id = window.setInterval(() => {
      void reload()
    }, DEFAULT_AUTO_REFRESH_SEC * 1000)
    return () => window.clearInterval(id)
  }, [autoRefresh, effectiveScriptUrl, publishedCsv, reload, spreadsheetId])

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
        Com o projeto no Blaze e a function <strong>fetchPublicSheetCsv</strong> deployada, basta o link normal da planilha + nome
        da aba: o CRM lê via servidor (sem CORS) e calcula a % de MQL (faturamento acima de R$ 20 mil). Opcional: Apps Script ou upload
        CSV.
      </p>

      <div className="card mb" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Fonte</span>
        </div>
        <div style={{ padding: 16, display: 'grid', gap: 12 }}>
          <div className="fg" style={{ marginBottom: 0 }}>
            <label>Apps Script (opcional) — URL /exec</label>
            <input
              className="di"
              value={scriptUrl}
              onChange={(e) => setScriptUrl(e.target.value)}
              placeholder="(deixe em branco se usar Firebase)"
            />
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
              {effectiveScriptUrl ? (
                <>
                  Apps Script detectado · <span style={{ color: 'var(--text2)' }}>OK</span>
                </>
              ) : (
                <>Cole aqui o link do Web App do Apps Script (termina com /exec) para atualizar automaticamente.</>
              )}
            </div>
          </div>
          <div className="fg" style={{ marginBottom: 0 }}>
            <label>Upload CSV (recomendado)</label>
            <input
              className="di"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => void onUploadCsv(e.target.files?.[0] ?? null)}
            />
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
              {uploadedCsvName ? (
                <>
                  A usar arquivo: <span style={{ color: 'var(--text2)' }}>{uploadedCsvName}</span>
                  {' · '}Clique em “Recarregar” para recalcular.
                </>
              ) : (
                <>Baixe do Google Sheets: Arquivo → Fazer download → CSV (aba {tab || 'Cadastro nativo'}).</>
              )}
            </div>
          </div>
          <div className="fg" style={{ marginBottom: 0 }}>
            <label>Link da planilha (edit) ou CSV público</label>
            <input className="di" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder={DEFAULT_SHEET_URL} />
          </div>
          <div className="fg" style={{ marginBottom: 0 }}>
            <label>Aba (tab)</label>
            <input className="di" value={tab} onChange={(e) => setTab(e.target.value)} placeholder={DEFAULT_TAB} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)' }}>
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Atualizar automaticamente (a cada {DEFAULT_AUTO_REFRESH_SEC}s)
          </label>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {uploadedCsvText.trim() ? (
              <>
                A usar CSV enviado (sem CORS) · <span style={{ color: 'var(--text2)' }}>OK</span>
                {lastLoadedAt ? ` · Última carga: ${new Date(lastLoadedAt).toLocaleString('pt-BR')}` : null}
              </>
            ) : effectiveScriptUrl ? (
              <>
                A usar Apps Script (sem CORS) · <span style={{ color: 'var(--text2)' }}>OK</span>
                {lastLoadedAt ? ` · Última carga: ${new Date(lastLoadedAt).toLocaleString('pt-BR')}` : null}
              </>
            ) : publishedCsv ? (
              <>
                A usar CSV publicado (sem CORS) ·{' '}
                <span style={{ color: 'var(--text2)' }}>OK</span>
                {lastLoadedAt ? ` · Última carga: ${new Date(lastLoadedAt).toLocaleString('pt-BR')}` : null}
              </>
            ) : spreadsheetId ? (
              <>
                A ler via Firebase (proxy) · ID{' '}
                <span style={{ color: 'var(--text2)' }}>{spreadsheetId}</span>
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

