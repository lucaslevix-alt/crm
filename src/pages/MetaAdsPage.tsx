import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Coins,
  Layers,
  Megaphone,
  RefreshCw,
  Search,
  Settings,
  Star,
  Target,
  TrendingUp,
  Trophy
} from 'lucide-react'
import {
  metaFetch,
  metaGetEffectiveToken,
  metaLoadSaved,
  metaSaveAccId,
  metaSaveFav,
  metaClearFav,
  getConversionKeys,
  extractActionFromInsights,
  type MetaConvMode,
  type MetaAccount,
  type MetaInsightRow,
  type MetaCampaign
} from '../lib/meta-ads'
import { RankMarker } from '../components/ui/RankMarker'
import { getRegistrosByRange } from '../firebase/firestore'
import { contaParaComissao } from '../lib/registroComissao'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { useAppStore } from '../store/useAppStore'

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

type MetaPeriod = 'this_month' | 'last_7d' | 'last_14d' | 'last_30d' | 'last_60d' | 'custom'

function getMetaDateRange(period: MetaPeriod, customSince?: string, customUntil?: string): { since: string; until: string; label: string } {
  const today = new Date()
  const until = today.toISOString().split('T')[0]
  if (period === 'custom' && customSince && customUntil) {
    const [sy, sm, sd] = customSince.split('-')
    const [uy, um, ud] = customUntil.split('-')
    return { since: customSince, until: customUntil, label: `${sd}/${sm}/${sy} → ${ud}/${um}/${uy}` }
  }
  let since: string
  let label: string
  if (period === 'this_month') {
    const y = today.getFullYear()
    const m = today.getMonth() + 1
    since = `${y}-${String(m).padStart(2, '0')}-01`
    label = 'este mês'
  } else if (period === 'last_7d') {
    const d = new Date(today)
    d.setDate(d.getDate() - 6)
    since = d.toISOString().split('T')[0]
    label = 'últimos 7 dias'
  } else if (period === 'last_14d') {
    const d = new Date(today)
    d.setDate(d.getDate() - 13)
    since = d.toISOString().split('T')[0]
    label = 'últimos 14 dias'
  } else if (period === 'last_60d') {
    const d = new Date(today)
    d.setDate(d.getDate() - 59)
    since = d.toISOString().split('T')[0]
    label = 'últimos 60 dias'
  } else {
    const d = new Date(today)
    d.setDate(d.getDate() - 29)
    since = d.toISOString().split('T')[0]
    label = 'últimos 30 dias'
  }
  return { since, until, label }
}

interface MetaKpis {
  spend: number
  metaLeads: number
  cpl: number
  cpra: number
  cprr: number
  cac: number
  roas: number
  vendas: number
}

interface FunilStep {
  label: string
  val: number
  pct: number
  color: string
}

interface DailyPoint {
  date: string
  spend: number
}

interface CampaignRow {
  name: string
  adSpend: number
  adLeads: number
  adCpl: number
  crmAg: number
  crmRe: number
  crmVn: number
  crmFat: number
  cpraAd: number
  cacAd: number
  roasAd: number
  hasCrm: boolean
  score: number
}

export function MetaAdsPage() {
  const { openModal, metaConnectedAt, setMetaConnectedAt } = useAppStore()
  const hasToken = useMemo(() => Boolean(metaGetEffectiveToken()), [metaConnectedAt])
  const [convMode, setConvMode] = useState<MetaConvMode>('lead')
  const [accId, setAccId] = useState('')
  const [favAccId, setFavAccId] = useState('')
  const [period, setPeriod] = useState<MetaPeriod>('last_30d')
  const [customSince, setCustomSince] = useState('')
  const [customUntil, setCustomUntil] = useState('')
  const [dateLabel, setDateLabel] = useState('últimos 30 dias')
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')
  const [accounts, setAccounts] = useState<MetaAccount[]>([])
  const [selectedAccountName, setSelectedAccountName] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [kpis, setKpis] = useState<MetaKpis | null>(null)
  const [funilSteps, setFunilSteps] = useState<FunilStep[]>([])
  const [dailySpend, setDailySpend] = useState<DailyPoint[]>([])
  const [campaignRows, setCampaignRows] = useState<CampaignRow[]>([])
  const [campaignFilter, setCampaignFilter] = useState('')
  const [showCustomDates, setShowCustomDates] = useState(false)

  const loadMetaPage = useCallback(async () => {
    const t = metaGetEffectiveToken()
    if (!t) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { since: s, until: u, label } = getMetaDateRange(period, customSince, customUntil)
      setSince(s)
      setUntil(u)
      setDateLabel(label)
      type AccRes = { data?: MetaAccount[] }
      let allAccs: MetaAccount[] = []
      let accountLoadError: string | null = null
      try {
        const r = await metaFetch<AccRes>(`/me/adaccounts`, { access_token: t, fields: 'id,name,currency', limit: '200' })
        allAccs = r.data || []
      } catch (e) {
        accountLoadError = e instanceof Error ? e.message : 'Erro ao listar contas de anúncios'
      }
      try {
        type BizRes = { data?: Array<{ id: string }> }
        const biz = await metaFetch<BizRes>(`/me/businesses`, { access_token: t, fields: 'id,name', limit: '50' })
        for (const bm of biz.data || []) {
          try {
            const [o, c] = await Promise.all([
              metaFetch<AccRes>(`/${bm.id}/owned_ad_accounts`, { access_token: t, fields: 'id,name,currency', limit: '200' }).catch(
                () => ({ data: [] as MetaAccount[] })
              ),
              metaFetch<AccRes>(`/${bm.id}/client_ad_accounts`, { access_token: t, fields: 'id,name,currency', limit: '200' }).catch(
                () => ({ data: [] as MetaAccount[] })
              )
            ])
            for (const a of [...(o.data || []), ...(c.data || [])]) {
              if (!allAccs.find((x) => x.id === a.id)) allAccs.push(a)
            }
          } catch {
            /* ignora falhas por BM individual */
          }
        }
      } catch {
        /* /me/businesses é opcional */
      }

      if (allAccs.length === 0 && accountLoadError) {
        setError(accountLoadError)
      } else if (allAccs.length === 0) {
        setError(
          'Nenhuma conta de anúncios encontrada. Gere o token com as permissões ads_read ou ads_management e acesso às contas no Meta Business.'
        )
      } else {
        setError(null)
      }
      setAccounts(allAccs)
      const preferred = favAccId || accId || (allAccs[0]?.id ?? '')
      const chosenId = allAccs.find((a) => a.id === preferred) ? preferred : allAccs[0]?.id ?? ''
      setAccId(chosenId)
      metaSaveAccId(chosenId)
      const chosen = allAccs.find((a) => a.id === chosenId)
      setSelectedAccountName(chosen?.name || chosenId)
      setLoading(false)
    } catch (err) {
      setError(formatFirebaseOrUnknownError(err) || 'Erro ao carregar contas')
      setLoading(false)
    }
  }, [convMode, favAccId, accId, period, customSince, customUntil])

  useEffect(() => {
    const saved = metaLoadSaved()
    setConvMode(saved.mode as MetaConvMode)
    setFavAccId(saved.favAccId)
    setAccId(saved.accId)
    if (saved.token) {
      const { since: s, until: u, label } = getMetaDateRange('last_30d')
      setSince(s)
      setUntil(u)
      setDateLabel(label)
      setPeriod('last_30d')
    }
  }, [])

  useEffect(() => {
    if (!metaGetEffectiveToken()) {
      setLoading(false)
      return
    }
    loadMetaPage()
  }, [metaConnectedAt, loadMetaPage])

  const loadMetaData = useCallback(async () => {
    const tokenNow = metaGetEffectiveToken()
    if (!tokenNow || !accId || !since) return
    setLoadingData(true)
    setError(null)
    const timeRange = JSON.stringify({ since, until })
    const convKeys = getConversionKeys(convMode)
    const fields = 'spend,impressions,cpm,ctr,actions,cost_per_action_type'
    try {
      type InsRes = { data?: MetaInsightRow[] }
      type CampRes = { data?: MetaCampaign[] }
      const [insData, campaignsData, dailyData] = await Promise.all([
        metaFetch<InsRes>(`/${accId}/insights`, { access_token: tokenNow, fields, time_range: timeRange }),
        metaFetch<CampRes>(`/${accId}/campaigns`, {
          access_token: tokenNow,
          fields: `id,name,insights.time_range(${timeRange}){spend,impressions,actions,cost_per_action_type,ctr}`,
          limit: '100'
        }),
        metaFetch<InsRes>(`/${accId}/insights`, {
          access_token: tokenNow,
          fields: 'spend,date_start',
          time_increment: '1',
          time_range: timeRange
        })
      ])
      const ins = insData.data?.[0] || {}
      const spend = parseFloat(String(ins.spend || 0))
      const metaLeads = extractActionFromInsights(ins.actions, convKeys) ?? 0
      const cpl = spend > 0 && metaLeads > 0 ? spend / metaLeads : 0

      const crmRecs = (await getRegistrosByRange(since, until)).filter(contaParaComissao)
      const reunAgendadas = crmRecs.filter((r) => r.tipo === 'reuniao_agendada').length
      const reunRealizadas = crmRecs.filter((r) => r.tipo === 'reuniao_realizada').length
      const vendas = crmRecs.filter((r) => r.tipo === 'venda')
      const totalVendas = vendas.length
      const totalFaturamento = vendas.reduce((s, r) => s + (r.valor || 0), 0)

      const cpra = spend > 0 && reunAgendadas > 0 ? spend / reunAgendadas : 0
      const cprr = spend > 0 && reunRealizadas > 0 ? spend / reunRealizadas : 0
      const cac = spend > 0 && totalVendas > 0 ? spend / totalVendas : 0
      const roas = spend > 0 && totalFaturamento > 0 ? totalFaturamento / spend : 0

      setKpis({
        spend,
        metaLeads,
        cpl,
        cpra,
        cprr,
        cac,
        roas,
        vendas: totalVendas
      })

      const base = Math.max(Math.round(metaLeads), reunAgendadas, 1)
      setFunilSteps([
        { label: 'Leads (Meta)', val: Math.round(metaLeads), pct: Math.round((Math.round(metaLeads) / base) * 100), color: 'var(--purple)' },
        { label: 'Reuniões Agendadas', val: reunAgendadas, pct: Math.round((reunAgendadas / base) * 100), color: 'var(--accent2)' },
        { label: 'Reuniões Realizadas', val: reunRealizadas, pct: Math.round((reunRealizadas / base) * 100), color: 'var(--cyan)' },
        { label: 'Vendas', val: totalVendas, pct: Math.round((totalVendas / base) * 100), color: 'var(--green)' }
      ])

      const daily = (dailyData.data || []).map((d) => ({
        date: d.date_start || '',
        spend: parseFloat(String(d.spend || 0))
      }))
      setDailySpend(daily)

      const ads: CampaignRow[] = (campaignsData.data || [])
        .map((ad) => {
          const adIns = ad.insights?.data?.[0] || {}
          const adSpend = parseFloat(String(adIns.spend || 0))
          const adLeads = extractActionFromInsights(adIns.actions, convKeys) ?? 0
          const adCpl = adSpend > 0 && adLeads > 0 ? adSpend / adLeads : 0
          const crmMatches = crmRecs.filter(
            (r) => (r.anuncio || '').trim().toLowerCase() === ad.name.trim().toLowerCase()
          )
          const crmAg = crmMatches.filter((r) => r.tipo === 'reuniao_agendada').length
          const crmRe = crmMatches.filter((r) => r.tipo === 'reuniao_realizada').length
          const crmVn = crmMatches.filter((r) => r.tipo === 'venda')
          const crmFat = crmVn.reduce((s, r) => s + (r.valor || 0), 0)
          const cpraAd = adSpend > 0 && crmAg > 0 ? adSpend / crmAg : 0
          const cacAd = adSpend > 0 && crmVn.length > 0 ? adSpend / crmVn.length : 0
          const roasAd = adSpend > 0 && crmFat > 0 ? crmFat / adSpend : 0
          const score = crmFat * 1000 + crmVn.length * 100 + crmAg
          return {
            name: ad.name,
            adSpend,
            adLeads,
            adCpl,
            crmAg,
            crmRe,
            crmVn: crmVn.length,
            crmFat,
            cpraAd,
            cacAd,
            roasAd,
            hasCrm: crmMatches.length > 0,
            score
          }
        })
        .filter((a) => a.adSpend > 0)
        .sort((a, b) => {
          if (a.hasCrm && !b.hasCrm) return -1
          if (!a.hasCrm && b.hasCrm) return 1
          if (a.hasCrm && b.hasCrm) return b.score - a.score
          return b.adSpend - a.adSpend
        })
      setCampaignRows(ads)
    } catch (err) {
      setError(formatFirebaseOrUnknownError(err) || 'Erro ao carregar dados')
      setKpis(null)
      setFunilSteps([])
      setDailySpend([])
      setCampaignRows([])
    } finally {
      setLoadingData(false)
    }
  }, [metaConnectedAt, accId, since, until, convMode])

  useEffect(() => {
    if (hasToken && accId && since) loadMetaData()
  }, [hasToken, accId, since, until, loadMetaData])

  function setMetaPeriod(p: MetaPeriod) {
    setPeriod(p)
    if (p === 'custom') {
      setShowCustomDates(true)
      return
    }
    setShowCustomDates(false)
    const { since: s, until: u, label } = getMetaDateRange(p)
    setSince(s)
    setUntil(u)
    setDateLabel(label)
  }

  function applyCustom() {
    if (!customSince || !customUntil) return
    setSince(customSince)
    setUntil(customUntil)
    const [sy, sm, sd] = customSince.split('-')
    const [uy, um, ud] = customUntil.split('-')
    setDateLabel(`${sd}/${sm}/${sy} → ${ud}/${um}/${uy}`)
  }

  function onAccountChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value
    if (!id) return
    setAccId(id)
    metaSaveAccId(id)
    const opt = accounts.find((a) => a.id === id)
    setSelectedAccountName(opt?.name || id)
    setMetaConnectedAt(Date.now())
  }

  function toggleFav() {
    const isFav = favAccId === accId
    if (isFav) metaClearFav()
    else metaSaveFav(accId)
    setFavAccId(isFav ? '' : accId)
    setMetaConnectedAt(Date.now())
  }

  const filteredCampaigns = campaignFilter.trim()
    ? campaignRows.filter((a) => a.name.toLowerCase().includes(campaignFilter.trim().toLowerCase()))
    : campaignRows

  const maxDaily = dailySpend.length ? Math.max(...dailySpend.map((d) => d.spend), 1) : 1

  if (!hasToken && !loading) {
    return (
      <div className="content meta-ads-page">
        <div style={{ marginBottom: 16 }}>
          <h2 className="page-title-row" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            <Megaphone size={24} strokeWidth={1.65} aria-hidden />
            Meta Ads + CRM
          </h2>
          <p style={{ color: 'var(--text2)' }}>Desempenho dos anúncios cruzado com o comercial</p>
        </div>
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, opacity: 0.35 }} aria-hidden>
            <Megaphone size={48} strokeWidth={1.25} />
          </div>
          <p>Conecte sua conta Meta Ads para visualizar</p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ marginTop: 12, width: 'auto', padding: '8px 20px' }}
            onClick={() => openModal('modal-meta-config')}
          >
            Conectar Meta Ads
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="content meta-ads-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title-row" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            <Megaphone size={24} strokeWidth={1.65} aria-hidden />
            Meta Ads + CRM
          </h2>
          <p style={{ color: 'var(--text2)' }} id="meta-period-label">
            Período: {dateLabel}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="meta-account-pill" title="Conta ativa">
            <span className="meta-account-pill-dot" aria-hidden />
            <span>{selectedAccountName || '—'}</span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => openModal('modal-meta-config')}
          >
            <Settings size={16} strokeWidth={1.65} aria-hidden />
            Reconfigurar
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => {
              setMetaConnectedAt(Date.now())
              loadMetaPage()
            }}
          >
            <RefreshCw size={16} strokeWidth={1.65} aria-hidden />
            Atualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="card mb" style={{ marginBottom: 16, padding: 16, background: 'rgba(239,68,68,.08)', borderColor: 'var(--red)' }}>
          <p style={{ color: 'var(--red)' }}>{error}</p>
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => openModal('modal-meta-config')}>
            Reconfigurar token
          </button>
        </div>
      )}

      <div className="card mb" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div className="meta-field-lbl">Período</div>
            <div className="meta-period-row">
              {(['this_month', 'last_7d', 'last_14d', 'last_30d', 'last_60d'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`prd-btn ${period === p ? 'active' : ''}`}
                  onClick={() => setMetaPeriod(p)}
                >
                  {p === 'this_month' ? 'Este mês' : p === 'last_7d' ? '7 dias' : p === 'last_14d' ? '14 dias' : p === 'last_30d' ? '30 dias' : '60 dias'}
                </button>
              ))}
              <button
                type="button"
                className={`prd-btn ${period === 'custom' ? 'active' : ''}`}
                onClick={() => setMetaPeriod('custom')}
              >
                Personalizado
              </button>
            </div>
            {showCustomDates && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
                <input
                  type="date"
                  value={customSince}
                  onChange={(e) => setCustomSince(e.target.value)}
                  className="di"
                  style={{ width: 140 }}
                />
                <span style={{ color: 'var(--text3)' }}>→</span>
                <input
                  type="date"
                  value={customUntil}
                  onChange={(e) => setCustomUntil(e.target.value)}
                  className="di"
                  style={{ width: 140 }}
                />
                <button type="button" className="btn btn-primary btn-sm" onClick={applyCustom}>
                  Aplicar
                </button>
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 200, maxWidth: 320 }}>
            <div className="meta-field-lbl">Conta de anúncios</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={accId} onChange={onAccountChange} className="meta-select">
                {accounts.length === 0 ? (
                  <option value="">{loading ? 'Carregando contas...' : 'Nenhuma conta (mensagem no topo)'}</option>
                ) : (
                  [...accounts]
                    .sort((a, b) => {
                      if (a.id === favAccId && b.id !== favAccId) return -1
                      if (b.id === favAccId && a.id !== favAccId) return 1
                      return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
                    })
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.id === favAccId ? '★ ' : ''}
                        {a.name}
                      </option>
                    ))
                )}
              </select>
              <button
                type="button"
                id="meta-fav-btn"
                onClick={toggleFav}
                className="btn btn-ghost btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  color: favAccId === accId ? 'var(--amber)' : 'var(--text2)',
                  borderColor: favAccId === accId ? 'rgba(245,158,11,.4)' : 'var(--border2)'
                }}
              >
                <Star size={16} strokeWidth={favAccId === accId ? 2.25 : 1.65} aria-hidden fill={favAccId === accId ? 'currentColor' : 'none'} />
                {favAccId === accId ? 'Favorita' : 'Favoritar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="meta-kpi-grid">
        {(
          [
            { id: 'spend', Icon: CircleDollarSign, label: 'Gasto Meta', value: kpis ? fmtCurrency(kpis.spend) : '…', col: 'orange' },
            { id: 'leads', Icon: Target, label: 'Leads (Meta)', value: kpis ? (kpis.metaLeads > 0 ? Math.round(kpis.metaLeads).toString() : '—') : '…', col: 'purple' },
            { id: 'cpl', Icon: Coins, label: 'CPL', value: kpis && kpis.cpl > 0 ? fmtCurrency(kpis.cpl) : '—', col: 'amber' },
            { id: 'cpra', Icon: CalendarClock, label: 'Custo/Reunião Agendada', value: kpis && kpis.cpra > 0 ? fmtCurrency(kpis.cpra) : '—', col: 'green' },
            { id: 'cprr', Icon: CheckCircle2, label: 'Custo/Reunião Realizada', value: kpis && kpis.cprr > 0 ? fmtCurrency(kpis.cprr) : '—', col: 'cyan' },
            { id: 'cac', Icon: Trophy, label: 'CAC', value: kpis && kpis.cac > 0 ? fmtCurrency(kpis.cac) : '—', col: 'amber' },
            { id: 'roas', Icon: TrendingUp, label: 'ROAS', value: kpis && kpis.roas > 0 ? `${kpis.roas.toFixed(2)}x` : '—', col: 'green' },
            { id: 'vendas', Icon: Briefcase, label: 'Vendas CRM', value: kpis != null ? String(kpis.vendas) : '…', col: 'purple' }
          ] as const
        ).map(({ id, Icon, label, value, col }) => (
          <div key={id} className={`stat-card ${col}`}>
            <div className="glow-dot" />
            <div className="stat-icon">
              <Icon size={22} strokeWidth={1.65} aria-hidden />
            </div>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="meta-split-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-title card-title--ic">
              <Layers size={16} strokeWidth={1.65} aria-hidden />
              Funil de Conversão
            </span>
          </div>
          <div style={{ padding: '8px 0' }}>
            {funilSteps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>Carregando...</div>
            ) : (
              funilSteps.map((s) => (
                <div key={s.label} className="meta-funil-step">
                  <div className="meta-funil-label">{s.label}</div>
                  <div className="meta-funil-bar-wrap">
                    <div className="meta-funil-bar" style={{ width: `${Math.min(s.pct, 100)}%`, background: s.color }} />
                  </div>
                  <div className="meta-funil-val">{s.val > 0 ? s.val : '—'}</div>
                  <div className="meta-funil-pct">{s.val > 0 ? `${s.pct}%` : ''}</div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title card-title--ic">
              <BarChart3 size={16} strokeWidth={1.65} aria-hidden />
              Gasto Diário
            </span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{dateLabel}</span>
          </div>
          <div className="meta-daily-chart">
            {dailySpend.length === 0 ? (
              <div style={{ textAlign: 'center', width: '100%', color: 'var(--text3)', padding: 24 }}>Nenhum dado no período</div>
            ) : (
              dailySpend.map((d) => (
                <div
                  key={d.date}
                  className="meta-daily-bar"
                  title={`${d.date}: ${fmtCurrency(d.spend)}`}
                  style={{ height: `${Math.max(4, (d.spend / maxDaily) * 100)}%` }}
                />
              ))
            )}
          </div>
          {dailySpend.length > 0 && (
            <div className="meta-daily-foot">
              <span>{dailySpend[0]?.date?.slice(5)}</span>
              <span>{dailySpend[dailySpend.length - 1]?.date?.slice(5)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span className="card-title card-title--ic">
            <Target size={16} strokeWidth={1.65} aria-hidden />
            Desempenho por Campanha — Cruzado com CRM
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={campaignFilter}
                onChange={(e) => setCampaignFilter(e.target.value)}
                placeholder="Filtrar campanha..."
                className="di"
                style={{ width: 220, paddingRight: 28, fontSize: 12 }}
              />
              {campaignFilter && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => setCampaignFilter('')}
                  onKeyDown={(e) => e.key === 'Enter' && setCampaignFilter('')}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    cursor: 'pointer',
                    color: 'var(--text3)',
                    fontSize: 14
                  }}
                >
                  ✕
                </span>
              )}
            </div>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Cruzamento por nome do anúncio</span>
          </div>
        </div>
        <div>
          {loadingData && !campaignRows.length ? (
            <div className="loading" style={{ padding: 24 }}>
              <div className="spin" /> Carregando dados...
            </div>
          ) : !filteredCampaigns.length ? (
            <div className="empty">
              {campaignFilter ? (
                <>
                  <div className="empty-icon" aria-hidden>
                    <Search size={40} strokeWidth={1.4} />
                  </div>
                  <p>
                    Nenhuma campanha encontrada para &quot;<strong>{campaignFilter}</strong>&quot;
                  </p>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setCampaignFilter('')}>
                    Limpar filtro
                  </button>
                </>
              ) : campaignRows.length === 0 ? (
                <p>Nenhum anúncio com gasto neste período</p>
              ) : null}
            </div>
          ) : (
            <>
              {campaignFilter && (
                <div style={{ padding: '6px 16px', fontSize: 11, color: 'var(--text3)' }}>
                  {filteredCampaigns.length} de {campaignRows.length} campanhas
                </div>
              )}
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Campanha</th>
                      <th>Gasto</th>
                      <th>Leads</th>
                      <th>CPL</th>
                      <th>Agend.</th>
                      <th>Realiz.</th>
                      <th>Vendas</th>
                      <th>Faturamento</th>
                      <th>Custo/Ag.</th>
                      <th>CAC</th>
                      <th>ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCampaigns.map((a, idx) => {
                      return (
                        <tr key={a.name + idx} className={a.hasCrm ? 'meta-ad-row-crm' : ''}>
                          <td style={{ fontWeight: 700, color: 'var(--text2)', fontSize: 13 }}>
                            {a.hasCrm ? (
                              idx < 3 ? (
                                <RankMarker index={idx} />
                              ) : (
                                idx + 1
                              )
                            ) : (
                              '–'
                            )}
                          </td>
                          <td title={a.name}>
                            <span style={{ color: a.hasCrm ? 'var(--green)' : 'var(--text3)', marginRight: 5 }}>{a.hasCrm ? '●' : '○'}</span>
                            <strong>{a.name}</strong>
                          </td>
                          <td className="mono">{fmtCurrency(a.adSpend)}</td>
                          <td>{a.adLeads > 0 ? Math.round(a.adLeads) : '—'}</td>
                          <td className="mono">{a.adCpl > 0 ? fmtCurrency(a.adCpl) : '—'}</td>
                          <td style={{ color: 'var(--accent2)', fontWeight: 700 }}>{a.crmAg || '—'}</td>
                          <td style={{ color: 'var(--cyan)', fontWeight: 700 }}>{a.crmRe || '—'}</td>
                          <td style={{ color: 'var(--amber)', fontWeight: 700 }}>{a.crmVn || '—'}</td>
                          <td className="mono" style={{ color: 'var(--green)' }}>
                            {a.crmFat > 0 ? fmtCurrency(a.crmFat) : '—'}
                          </td>
                          <td className="mono">{a.cpraAd > 0 ? fmtCurrency(a.cpraAd) : '—'}</td>
                          <td className="mono">{a.cacAd > 0 ? fmtCurrency(a.cacAd) : '—'}</td>
                          <td
                            style={{
                              color: a.roasAd >= 2 ? 'var(--green)' : a.roasAd >= 1 ? 'var(--amber)' : 'var(--red)',
                              fontWeight: 700
                            }}
                          >
                            {a.roasAd > 0 ? `${a.roasAd.toFixed(2)}x` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '10px 16px', fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span>
                  <span style={{ color: 'var(--green)' }}>●</span> Cruzado com CRM — ordenado por resultado comercial
                </span>
                <span>
                  <span style={{ color: 'var(--text3)' }}>○</span> Sem cruzamento
                </span>
                {since && (
                  <span>
                    Período: <strong style={{ color: 'var(--text2)' }}>{since} → {until}</strong>
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
