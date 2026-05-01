import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  ChevronDown,
  Contact,
  LayoutGrid,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Settings,
  Star
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import {
  metaGetEffectiveToken,
  metaLoadLeadsPageId,
  metaSaveLeadsPageId,
  metaLoadLeadsPageFav,
  metaSaveLeadsPageFav,
  metaClearLeadsPageFav,
  fetchMetaPagesForUser,
  fetchLeadgenForms,
  fetchLeadgenLeadsForForm,
  getMetaGraphApiVersion,
  metaCheckLeadsRetrievalPermission,
  flattenLeadFieldData,
  pickLeadDisplayName,
  pickLeadEmail,
  pickLeadPhone,
  leadCreatedDateIso,
  META_LEADS_KANBAN_STORAGE_KEY,
  type MetaPageWithToken,
  type MetaLeadgenFormRow,
  type MetaLeadgenLeadRow
} from '../lib/meta-ads'

type KanbanId = 'novo' | 'contacto' | 'qualificado' | 'agendado'

const KANBAN_COLS: Array<{ id: KanbanId; title: string; subtitle: string }> = [
  { id: 'novo', title: 'Novos', subtitle: 'Entrada' },
  { id: 'contacto', title: 'Em contacto', subtitle: 'SDR' },
  { id: 'qualificado', title: 'Qualificado', subtitle: 'Fit / ICP' },
  { id: 'agendado', title: 'Reunião agendada', subtitle: 'Closer / demo' }
]

const SKIP_TAG_KEYS = new Set(
  [
    'full_name',
    'nome_completo',
    'first_name',
    'last_name',
    'nome',
    'sobrenome',
    'apelido',
    'name',
    'email',
    'e-mail',
    'business_email',
    'phone_number',
    'phone',
    'telefone',
    'mobile_phone',
    'celular'
  ].map((k) => k.toLowerCase())
)

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

function dateRangePreset(p: 'mes' | '7d' | '30d'): { since: string; until: string } {
  const until = todayIso()
  const end = new Date()
  if (p === 'mes') {
    const y = end.getFullYear()
    const m = end.getMonth() + 1
    const since = `${y}-${String(m).padStart(2, '0')}-01`
    return { since, until }
  }
  const d = new Date(end)
  const days = p === '7d' ? 6 : 29
  d.setDate(d.getDate() - days)
  const since = d.toISOString().split('T')[0]
  return { since, until }
}

function readKanbanMap(): Record<string, KanbanId> {
  if (typeof window === 'undefined') return {}
  try {
    const s = localStorage.getItem(META_LEADS_KANBAN_STORAGE_KEY)
    if (!s) return {}
    const o = JSON.parse(s) as Record<string, string>
    const allowed: KanbanId[] = ['novo', 'contacto', 'qualificado', 'agendado']
    const out: Record<string, KanbanId> = {}
    for (const [k, v] of Object.entries(o)) {
      if (allowed.includes(v as KanbanId)) out[k] = v as KanbanId
    }
    return out
  } catch {
    return {}
  }
}

function writeKanbanMap(map: Record<string, KanbanId>) {
  try {
    localStorage.setItem(META_LEADS_KANBAN_STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

function daysShortLabel(createdDay: string): string {
  if (!createdDay) return '—'
  const a = new Date(`${createdDay}T12:00:00`).getTime()
  const b = new Date(`${todayIso()}T12:00:00`).getTime()
  const diff = Math.max(0, Math.floor((b - a) / 86400000))
  if (diff === 0) return 'hoje'
  if (diff === 1) return '1d'
  return `${diff}d`
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean)
  if (p.length === 0) return '?'
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase()
  return (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

function tagPillsFromFields(fields: Record<string, string>): Array<{ key: string; value: string }> {
  const pills: Array<{ key: string; value: string }> = []
  for (const [key, value] of Object.entries(fields)) {
    if (!value?.trim()) continue
    if (SKIP_TAG_KEYS.has(key.trim().toLowerCase())) continue
    pills.push({ key, value: value.trim().slice(0, 48) })
    if (pills.length >= 2) break
  }
  return pills
}

interface UiLead {
  id: string
  created_time: string
  createdDay: string
  formId: string
  formName: string
  fields: Record<string, string>
  displayName: string
  email?: string
  phone?: string
  pills: Array<{ key: string; value: string }>
}

function buildUiLead(row: MetaLeadgenLeadRow, formName: string, formId: string): UiLead {
  const fields = flattenLeadFieldData(row.field_data)
  return {
    id: row.id,
    created_time: row.created_time,
    createdDay: leadCreatedDateIso(row.created_time),
    formId,
    formName,
    fields,
    displayName: pickLeadDisplayName(fields),
    email: pickLeadEmail(fields),
    phone: pickLeadPhone(fields),
    pills: tagPillsFromFields(fields)
  }
}

const DRAG_TYPE = 'application/x-crm-metalead'

export function MetaLeadsPage() {
  const location = useLocation()
  const { openModal, metaConnectedAt, setMetaConnectedAt } = useAppStore()
  /** Mesmo token que Meta Ads (`metaGetEffectiveToken`: localStorage/sessão/env). */
  const hasToken = Boolean(metaGetEffectiveToken())

  const [pages, setPages] = useState<MetaPageWithToken[]>([])
  const [pageMenuOpen, setPageMenuOpen] = useState(false)
  const [pageDropdownQuery, setPageDropdownQuery] = useState('')
  const pageComboRef = useRef<HTMLDivElement>(null)
  const pageComboInputRef = useRef<HTMLInputElement>(null)
  const [favPageId, setFavPageId] = useState(() => metaLoadLeadsPageFav())
  const [pageId, setPageId] = useState(metaLoadLeadsPageId())
  const [forms, setForms] = useState<MetaLeadgenFormRow[]>([])
  const [formFilter, setFormFilter] = useState<string>('') // '' = todos
  const [periodPreset, setPeriodPreset] = useState<'mes' | '7d' | '30d' | 'custom'>('30d')
  const [since, setSince] = useState(() => dateRangePreset('30d').since)
  const [until, setUntil] = useState(() => dateRangePreset('30d').until)

  const [leads, setLeads] = useState<UiLead[]>([])
  const [kanban, setKanban] = useState<Record<string, KanbanId>>(() => readKanbanMap())

  const [loadingPages, setLoadingPages] = useState(false)
  const [loadingForms, setLoadingForms] = useState(false)
  const [loadingLeads, setLoadingLeads] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pageToken = useMemo(() => pages.find((p) => p.id === pageId)?.access_token ?? '', [pages, pageId])

  /** Lista do menu: pesquisa só dentro do dropdown; favorita primeiro. */
  const menuPageList = useMemo(() => {
    const q = pageDropdownQuery.trim().toLowerCase()
    const digitsQ = q.replace(/\D/g, '')
    const filtered = !q
      ? pages
      : pages.filter((p) => {
          const nameHit = p.name.toLowerCase().includes(q)
          const idHit = p.id.toLowerCase().includes(q)
          const digitsP = p.id.replace(/\D/g, '')
          /** `''.includes('')` é true em JS — só comparar dígitos se a pesquisa tiver algum. */
          const digitHit = digitsQ.length > 0 && digitsP.includes(digitsQ)
          return nameHit || idHit || digitHit
        })
    const sorted = [...filtered].sort((a, b) => {
      if (a.id === favPageId && b.id !== favPageId) return -1
      if (b.id === favPageId && a.id !== favPageId) return 1
      return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    })
    const ids = new Set(sorted.map((p) => p.id))
    const cur = pages.find((p) => p.id === pageId)
    if (cur && !ids.has(cur.id)) return [cur, ...sorted]
    return sorted
  }, [pages, pageDropdownQuery, pageId, favPageId])

  useEffect(() => {
    if (!pageMenuOpen) return
    const t = window.setTimeout(() => pageComboInputRef.current?.focus(), 20)
    return () => window.clearTimeout(t)
  }, [pageMenuOpen])

  useEffect(() => {
    if (!pageMenuOpen) return
    const onDoc = (e: MouseEvent) => {
      const el = pageComboRef.current
      if (el && !el.contains(e.target as Node)) setPageMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPageMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [pageMenuOpen])

  const openPageMenu = () => {
    setPageDropdownQuery('')
    setPageMenuOpen(true)
  }

  const pickPage = (id: string) => {
    setPageId(id)
    metaSaveLeadsPageId(id)
    setPageMenuOpen(false)
    setPageDropdownQuery('')
  }

  const selectedPageLabel = useMemo(() => {
    const p = pages.find((x) => x.id === pageId)
    if (!p) return pages.length ? 'Selecionar…' : '—'
    return `${p.id === favPageId ? '★ ' : ''}${p.name}`
  }, [pages, pageId, favPageId])

  const loadPages = useCallback(async () => {
    const t = metaGetEffectiveToken()
    if (!t) {
      setPages([])
      return
    }
    setLoadingPages(true)
    setError(null)
    try {
      const list = await fetchMetaPagesForUser(t)
      setPages(list)
      let favStored = metaLoadLeadsPageFav()
      if (favStored && !list.some((p) => p.id === favStored)) {
        metaClearLeadsPageFav()
        favStored = ''
      }
      setFavPageId(favStored)
      const saved = metaLoadLeadsPageId()
      let pick = ''
      if (favStored && list.some((p) => p.id === favStored)) pick = favStored
      else if (saved && list.some((p) => p.id === saved)) pick = saved
      else pick = list[0]?.id ?? ''
      setPageId(pick)
      if (pick) metaSaveLeadsPageId(pick)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao listar páginas Facebook')
      setPages([])
    } finally {
      setLoadingPages(false)
    }
  }, [metaConnectedAt])

  const togglePageFav = useCallback(() => {
    if (!pageId) return
    if (favPageId === pageId) {
      metaClearLeadsPageFav()
      setFavPageId('')
    } else {
      metaSaveLeadsPageFav(pageId)
      setFavPageId(pageId)
    }
  }, [pageId, favPageId])

  useEffect(() => {
    if (location.pathname !== '/leads-meta') return
    void loadPages()
  }, [location.pathname, metaConnectedAt, loadPages])

  const loadForms = useCallback(async () => {
    if (!pageId || !pageToken) {
      setForms([])
      return
    }
    setLoadingForms(true)
    setError(null)
    try {
      const f = await fetchLeadgenForms(pageToken, pageId)
      setForms(f)
      setFormFilter('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar formulários Lead Gen')
      setForms([])
    } finally {
      setLoadingForms(false)
    }
  }, [pageId, pageToken])

  useEffect(() => {
    if (pageId && pageToken) void loadForms()
    else setForms([])
  }, [pageId, pageToken, loadForms])

  const applyPreset = (p: typeof periodPreset) => {
    setPeriodPreset(p)
    if (p === 'custom') return
    const r = dateRangePreset(p === 'mes' ? 'mes' : p === '7d' ? '7d' : '30d')
    setSince(r.since)
    setUntil(r.until)
  }

  const fetchLeads = async () => {
    if (!pageToken || forms.length === 0) {
      setError('Escolha uma página com formulários Lead Gen.')
      return
    }
    const resolvedPageId =
      pageId.trim() || pages.find((p) => p.access_token === pageToken)?.id?.trim() || ''
    if (!resolvedPageId) {
      setError('Não foi possível identificar o ID da página Facebook (escolha outra vez a página na lista).')
      return
    }
    const userTok = metaGetEffectiveToken().trim()
    if (userTok && userTok !== pageToken.trim()) {
      const lr = await metaCheckLeadsRetrievalPermission(userTok)
      if (lr === 'missing') {
        setError(
          'O access token guardado (utilizador) não inclui o scope «leads_retrieval». No Explorador da API da Meta marca essa permissão ao gerar o token, ou adiciona-a no Login do Facebook da tua app e volta a autorizar. Depois: Configuração Meta → cola o token novo (e remove o antigo se precisares).'
        )
        return
      }
      if (lr === 'declined') {
        setError(
          'O scope «leads_retrieval» foi recusado no login da Meta. Volte a abrir a configuração Meta, remova o token e obtenha um novo token com essa permissão aceite.'
        )
        return
      }
    }
    setLoadingLeads(true)
    setError(null)
    try {
      const targets = formFilter ? forms.filter((f) => f.id === formFilter) : forms
      const merged: UiLead[] = []
      for (const f of targets) {
        const rows = await fetchLeadgenLeadsForForm(resolvedPageId, f.id, pageToken, userTok)
        const name = f.name || `Formulário ${f.id}`
        for (const row of rows) {
          merged.push(buildUiLead(row, name, f.id))
        }
      }
      const filtered = merged.filter((L) => {
        if (!L.createdDay) return false
        return L.createdDay >= since && L.createdDay <= until
      })
      filtered.sort((a, b) => b.created_time.localeCompare(a.created_time))
      setLeads(filtered)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar leads')
      setLeads([])
    } finally {
      setLoadingLeads(false)
    }
  }

  const setColumn = (leadId: string, col: KanbanId) => {
    setKanban((prev) => {
      const next = { ...prev, [leadId]: col }
      writeKanbanMap(next)
      return next
    })
  }

  const onDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData(DRAG_TYPE, leadId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const onDropCol = (e: React.DragEvent, col: KanbanId) => {
    e.preventDefault()
    const id = e.dataTransfer.getData(DRAG_TYPE)
    if (id) setColumn(id, col)
  }

  const byColumn = useMemo(() => {
    const m: Record<KanbanId, UiLead[]> = {
      novo: [],
      contacto: [],
      qualificado: [],
      agendado: []
    }
    for (const L of leads) {
      const col = kanban[L.id] ?? 'novo'
      m[col].push(L)
    }
    return m
  }, [leads, kanban])

  if (!hasToken) {
    return (
      <div className="content meta-ads-page mleads-page">
        <div style={{ marginBottom: 16 }}>
          <h2 className="page-title-row" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            <Contact size={24} strokeWidth={1.65} aria-hidden />
            Leads Meta
          </h2>
          <p style={{ color: 'var(--text2)' }}>Leads dos formulários Instant / Lead Gen da Meta</p>
        </div>
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)', maxWidth: '44ch', margin: '0 auto' }}>
          <p style={{ lineHeight: 1.55 }}>
            Esta página usa o <strong style={{ color: 'var(--text2)' }}>mesmo access token</strong> que em{' '}
            <strong style={{ color: 'var(--text2)' }}>Meta Ads</strong>. Configure-o uma vez (Meta Ads ou aqui) — não há token separado para Leads.
          </p>
          <p style={{ marginTop: 12, fontSize: 12 }}>Permissões úteis: páginas que gere + Leads retrieval.</p>
          <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={() => openModal('modal-meta-config')}>
            Abrir configuração Meta (igual Meta Ads)
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="content meta-ads-page mleads-page">
      <div className="mleads-head">
        <div>
          <h2 className="page-title-row" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            <Contact size={24} strokeWidth={1.65} aria-hidden />
            Leads Meta
          </h2>
          <p style={{ color: 'var(--text2)', margin: 0 }}>
            Kanban com dados dos formulários · mesmo token que <strong style={{ color: 'var(--text)' }}>Meta Ads</strong> · arraste os cartões (guardado neste browser)
          </p>
        </div>
        <div className="mleads-head-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => openModal('modal-meta-config')}
          >
            <Settings size={16} strokeWidth={1.65} aria-hidden />
            Token Meta Ads
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => {
              setMetaConnectedAt(Date.now())
              void loadPages()
            }}
          >
            <RefreshCw size={16} strokeWidth={1.65} aria-hidden />
            Atualizar páginas
          </button>
        </div>
      </div>

      {error && (
        <div className="card mb mleads-error" style={{ marginBottom: 16 }}>
          <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{error}</p>
          {(error.includes('2500') || error.includes('/leads')) && (
            <details style={{ marginTop: 12, fontSize: 13, color: 'var(--text2)' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--text)' }}>Checklist rápido (erro Graph / leads)</summary>
              <ul style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.55 }}>
                <li>
                  App Meta em modo <strong>Live</strong> (modo Dev limita quem pode aparecer como lead na API).
                </li>
                <li>
                  Login com permissão <code>leads_retrieval</code> e token com acesso à página escolhida.
                </li>
                <li>
                  Se a app já está em <strong>Live</strong> e o erro continua: confirma em Meta for Developers → <strong>Permissões e funcionalidades</strong> se{' '}
                  <code>leads_retrieval</code> tem <strong>acesso avançado (Advanced)</strong> aprovado para utilizadores reais (App Review), e gera um token novo com esse scope.
                </li>
                <li>
                  Em App → Definições → Avançado: se «Require App Secret» estiver a forçar prova em todas as chamadas, este CRM no browser pode falhar — usa um proxy servidor com{' '}
                  <code>appsecret_proof</code> ou ajusta a definição para testes.
                </li>
                <li>
                  Exportação manual:{' '}
                  <a href="https://business.facebook.com/latest/leads_center" target="_blank" rel="noreferrer">
                    Centro de Leads
                  </a>{' '}
                  no Meta Business Suite.
                </li>
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="card mb mleads-toolbar">
        <div className="mleads-toolbar-grid">
          <div className="mleads-account-block">
            <div className="meta-field-lbl">Página Facebook (Lead Gen)</div>
            <p className="mleads-same-token-hint">
              <strong>Mesmo token que Meta Ads.</strong> Aí vês <em>contas de anúncios</em> (ex.: <code>act_…</code>) via Marketing API; aqui vês
              as <em>páginas</em> que este utilizador gere — os formulários de lead ficam na página, não na conta de anúncios.
            </p>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
              Graph API: <code>{getMetaGraphApiVersion()}</code> — altera com <code>VITE_META_GRAPH_API_VERSION</code> no <code>.env</code> se precisares de testar outra versão.
            </p>
            <div className="mleads-page-select-row">
              <div className={`mleads-combo${pageMenuOpen ? ' mleads-combo--open' : ''}`} ref={pageComboRef}>
                <button
                  type="button"
                  className="mleads-combo-trigger meta-select"
                  disabled={loadingPages || pages.length === 0}
                  aria-expanded={pageMenuOpen}
                  aria-haspopup="listbox"
                  onClick={() => (pageMenuOpen ? setPageMenuOpen(false) : openPageMenu())}
                >
                  <span className="mleads-combo-trigger-txt">{loadingPages ? 'A carregar…' : selectedPageLabel}</span>
                  <ChevronDown size={18} strokeWidth={1.75} className="mleads-combo-chev" aria-hidden />
                </button>
                {pageMenuOpen && pages.length > 0 && (
                  <div
                    className="mleads-combo-panel"
                    role="listbox"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="mleads-combo-search-wrap">
                      <Search size={15} strokeWidth={1.65} className="mleads-combo-search-ic" aria-hidden />
                      <input
                        ref={pageComboInputRef}
                        type="text"
                        inputMode="search"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        className="mleads-combo-search"
                        placeholder="Filtrar contas…"
                        value={pageDropdownQuery}
                        onChange={(e) => setPageDropdownQuery(e.target.value)}
                        aria-label="Filtrar lista de páginas"
                      />
                    </div>
                    <ul className="mleads-combo-list">
                      {menuPageList.map((p) => (
                        <li key={p.id} role="none">
                          <button
                            type="button"
                            role="option"
                            aria-selected={p.id === pageId}
                            className={`mleads-combo-opt${p.id === pageId ? ' mleads-combo-opt--active' : ''}`}
                            onClick={() => pickPage(p.id)}
                          >
                            <span className="mleads-combo-opt-main">
                              {p.id === favPageId ? <span className="mleads-combo-star">★</span> : null}
                              <span className="mleads-combo-opt-name">{p.name}</span>
                            </span>
                            <span className="mleads-combo-opt-id">{p.id}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <button
                type="button"
                className={`btn btn-ghost btn-sm mleads-fav-btn${favPageId === pageId ? ' mleads-fav-btn--on' : ''}`}
                disabled={!pageId || pages.length === 0}
                onClick={togglePageFav}
                title={favPageId === pageId ? 'Remover página favorita' : 'Marcar esta página como favorita'}
              >
                <Star
                  size={16}
                  strokeWidth={favPageId === pageId ? 2.25 : 1.65}
                  aria-hidden
                  fill={favPageId === pageId ? 'currentColor' : 'none'}
                />
                {favPageId === pageId ? 'Favorita' : 'Favoritar'}
              </button>
            </div>
            {loadingPages && (
              <span className="mleads-inline-hint">
                <Loader2 size={14} className="mleads-spin" aria-hidden /> A carregar páginas…
              </span>
            )}
          </div>
          <div>
            <div className="meta-field-lbl">Formulário</div>
            <select
              className="meta-select mleads-select"
              value={formFilter}
              disabled={loadingForms || forms.length === 0}
              onChange={(e) => setFormFilter(e.target.value)}
            >
              <option value="">Todos os formulários</option>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name || f.id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="meta-field-lbl">Período (data do lead)</div>
            <div className="meta-period-row mleads-period">
              <button type="button" className={`prd-btn ${periodPreset === 'mes' ? 'active' : ''}`} onClick={() => applyPreset('mes')}>
                Este mês
              </button>
              <button type="button" className={`prd-btn ${periodPreset === '7d' ? 'active' : ''}`} onClick={() => applyPreset('7d')}>
                7 dias
              </button>
              <button type="button" className={`prd-btn ${periodPreset === '30d' ? 'active' : ''}`} onClick={() => applyPreset('30d')}>
                30 dias
              </button>
              <button
                type="button"
                className={`prd-btn ${periodPreset === 'custom' ? 'active' : ''}`}
                onClick={() => setPeriodPreset('custom')}
              >
                Personalizado
              </button>
            </div>
            {periodPreset === 'custom' && (
              <div className="mleads-custom-dates">
                <input type="date" className="di" value={since} onChange={(e) => setSince(e.target.value)} />
                <span style={{ color: 'var(--text3)' }}>→</span>
                <input type="date" className="di" value={until} onChange={(e) => setUntil(e.target.value)} />
              </div>
            )}
          </div>
          <div className="mleads-fetch-cell">
            <button
              type="button"
              className="btn btn-primary btn-sm mleads-fetch-btn"
              disabled={loadingLeads || !pageToken || forms.length === 0}
              onClick={() => void fetchLeads()}
            >
              {loadingLeads ? (
                <>
                  <Loader2 size={16} className="mleads-spin" aria-hidden /> A carregar…
                </>
              ) : (
                <>
                  <LayoutGrid size={16} aria-hidden /> Carregar leads
                </>
              )}
            </button>
            <span className="mleads-count-hint">{leads.length ? `${leads.length} no período` : ''}</span>
          </div>
        </div>
      </div>

      {forms.length === 0 && !loadingForms && pageId && (
        <p className="mleads-empty-forms">Nenhum formulário Lead Gen nesta página (ou falta permissão na página).</p>
      )}

      <div className="mleads-kanban">
        {KANBAN_COLS.map((col) => (
          <div
            key={col.id}
            className="mleads-col"
            onDragOver={onDragOver}
            onDrop={(e) => onDropCol(e, col.id)}
          >
            <div className="mleads-col-head">
              <div>
                <div className="mleads-col-title">{col.title}</div>
                <div className="mleads-col-sub">{col.subtitle}</div>
              </div>
              <span className="mleads-col-count">{byColumn[col.id].length}</span>
            </div>
            <div className="mleads-col-body">
              {byColumn[col.id].map((L) => (
                <article
                  key={L.id}
                  className="mleads-card"
                  draggable
                  onDragStart={(e) => onDragStart(e, L.id)}
                >
                  <div className="mleads-card-top">
                    <div className="mleads-avatar" aria-hidden>
                      {initials(L.displayName)}
                    </div>
                    <div className="mleads-card-name" title={L.displayName}>
                      {L.displayName}
                    </div>
                  </div>
                  {L.pills.length > 0 && (
                    <div className="mleads-tags">
                      {L.pills.map((p) => (
                        <span key={p.key} className="mleads-tag" title={`${p.key}: ${p.value}`}>
                          {p.value.length > 22 ? `${p.value.slice(0, 22)}…` : p.value}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mleads-card-foot">
                    <div className="mleads-card-actions">
                      {L.email && (
                        <a
                          href={`mailto:${encodeURIComponent(L.email)}`}
                          className="mleads-ic-btn"
                          title={L.email}
                          draggable={false}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Mail size={16} strokeWidth={1.65} aria-hidden />
                        </a>
                      )}
                      {L.phone && (
                        <a
                          href={`tel:${L.phone.replace(/\s/g, '')}`}
                          className="mleads-ic-btn"
                          title={L.phone}
                          draggable={false}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Phone size={16} strokeWidth={1.65} aria-hidden />
                        </a>
                      )}
                      {L.phone && L.phone.replace(/\D/g, '').length >= 10 && (
                        <a
                          href={`https://wa.me/${L.phone.replace(/\D/g, '')}`}
                          className="mleads-ic-btn"
                          title="WhatsApp"
                          target="_blank"
                          rel="noreferrer"
                          draggable={false}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MessageCircle size={16} strokeWidth={1.65} aria-hidden />
                        </a>
                      )}
                    </div>
                    <div className="mleads-card-meta">
                      <span title={`Criado: ${L.createdDay}`}>{daysShortLabel(L.createdDay)}</span>
                    </div>
                  </div>
                  <details className="mleads-details">
                    <summary>Campos do formulário</summary>
                    <dl className="mleads-dl">
                      <div className="mleads-dl-row">
                        <dt>Formulário</dt>
                        <dd>{L.formName}</dd>
                      </div>
                      {Object.entries(L.fields).map(([k, v]) => (
                        <div key={k} className="mleads-dl-row">
                          <dt>{k}</dt>
                          <dd>{v || '—'}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
