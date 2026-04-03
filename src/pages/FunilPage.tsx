import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Banknote,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleCheck,
  Layers,
  Target,
  Wallet
} from 'lucide-react'
import { getRegistrosByRange } from '../firebase/firestore'
import { contaParaComissao } from '../lib/registroComissao'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { today, mRange, formatPeriodLabel } from '../lib/dates'
import { metaFetch, metaLoadSaved, getConversionKeys, extractActionFromInsights } from '../lib/meta-ads'
import type { MetaInsightRow } from '../lib/meta-ads'

type FunilPeriod = 'hoje' | 'ontem' | 'mes' | '7d' | '14d' | '30d' | 'custom'

function getFunilRange(period: FunilPeriod, customSince?: string, customUntil?: string): { since: string; until: string } {
  const td = today()
  if (period === 'custom' && customSince && customUntil) return { since: customSince, until: customUntil }
  if (period === 'hoje') return { since: td, until: td }
  if (period === 'ontem') {
    const y = new Date()
    y.setDate(y.getDate() - 1)
    const ys = y.toISOString().split('T')[0]
    return { since: ys, until: ys }
  }
  if (period === 'mes') {
    const r = mRange()
    return { since: r.start, until: r.end }
  }
  const d = new Date()
  if (period === '7d') {
    d.setDate(d.getDate() - 6)
    return { since: d.toISOString().split('T')[0], until: td }
  }
  if (period === '14d') {
    d.setDate(d.getDate() - 13)
    return { since: d.toISOString().split('T')[0], until: td }
  }
  d.setDate(d.getDate() - 29)
  return { since: d.toISOString().split('T')[0], until: td }
}

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function pct(v: number | null): string {
  return v !== null ? `${Math.round(v)}%` : '—'
}

function funilBadgeClass(val: number, thresholds: { good: number; warn: number }): 'good' | 'warn' | 'bad' {
  if (val >= thresholds.good) return 'good'
  if (val >= thresholds.warn) return 'warn'
  return 'bad'
}

interface FunilStepProps {
  color: string
  icon: React.ReactNode
  label: string
  num: string
  sub?: string | null
  badge?: React.ReactNode
  barPct: number
}

function FunilStep({ color, icon, label, num, sub, badge, barPct }: FunilStepProps) {
  const barW = Math.min(100, Math.round(barPct))
  return (
    <div className="fn-step" style={{ ['--fn-color' as string]: color }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span className="fn-step-ic">{icon}</span>
        <span className="fn-label">{label}</span>
      </div>
      <div className="fn-num">{num}</div>
      {sub != null && sub !== '' && <div className="fn-sub">{sub}</div>}
      {badge}
      <div className="fn-bar-wrap">
        <div className="fn-bar" style={{ width: `${barW}%` }} />
      </div>
    </div>
  )
}

export function FunilPage() {
  const [period, setPeriod] = useState<FunilPeriod>('mes')
  const [customSince, setCustomSince] = useState('')
  const [customUntil, setCustomUntil] = useState('')
  const [showCustomDates, setShowCustomDates] = useState(false)
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState<React.ReactNode>(null)

  const loadFunil = useCallback(async () => {
    setLoading(true)
    setError(null)
    let s = since
    let u = until
    const range = getFunilRange(period, customSince, customUntil)
    s = range.since
    u = range.until
    setSince(s)
    setUntil(u)

    try {
      const recs = (await getRegistrosByRange(s, u)).filter(contaParaComissao)
      const ag = recs.filter((r) => r.tipo === 'reuniao_agendada').length
      const rr = recs.filter((r) => r.tipo === 'reuniao_realizada').length
      const ns = recs.filter((r) => r.tipo === 'reuniao_no_show').length
      const vendas = recs.filter((r) => r.tipo === 'venda')
      const vn = vendas.length
      const ft = vendas.reduce((sum, r) => sum + (r.valor || 0), 0)
      const ca = vendas.reduce((sum, r) => sum + (r.cashCollected || 0), 0)

      let leads = 0
      let spend = 0
      let cpl = 0
      const saved = metaLoadSaved()
      const hasMetaToken = Boolean(saved.token && saved.accId)
      if (hasMetaToken && saved.token && saved.accId) {
        try {
          const timeRange = JSON.stringify({ since: s, until: u })
          type InsRes = { data?: MetaInsightRow[] }
          const insData = await metaFetch<InsRes>(`/${saved.accId}/insights`, {
            access_token: saved.token,
            fields: 'spend,actions,cost_per_action_type',
            time_range: timeRange
          })
          const ins = insData.data?.[0] ?? {}
          spend = parseFloat(String(ins.spend || 0))
          const convKeys = getConversionKeys(saved.mode as 'lead' | 'mensagem' | 'visita')
          leads = extractActionFromInsights(ins.actions, convKeys) ?? 0
          cpl = leads > 0 && spend > 0 ? spend / leads : 0
        } catch {
          // ignore Meta errors
        }
      }

      const cvLeadRA = leads > 0 ? (ag / leads) * 100 : null
      const noShow = ag > 0 ? (ns / ag) * 100 : null
      const winRate = rr > 0 ? (vn / rr) * 100 : null
      const tm = vn > 0 ? ft / vn : 0
      const collectedPct = ft > 0 ? Math.round((ca / ft) * 100) : null

      const arrow = (
        <div className="fn-arrow" aria-hidden>
          <ChevronDown size={20} strokeWidth={1.65} />
        </div>
      )

      const steps: React.ReactNode[] = []

      steps.push(
        <FunilStep
          key="leads"
          color="#7c3aed"
          icon={<Target size={20} strokeWidth={1.65} />}
          label="Leads (Meta Ads)"
          num={leads > 0 ? String(Math.round(leads)) : hasMetaToken ? '0' : '—'}
          sub={hasMetaToken ? (spend > 0 ? `Gasto: ${fmtCurrency(spend)}` : 'Meta Ads conectado') : 'Conecte Meta Ads para ver leads'}
          badge={
            hasMetaToken && cpl > 0 ? (
              <span className="fn-badge warn" style={{ marginTop: 4 }}>CPL: {fmtCurrency(cpl)}</span>
            ) : undefined
          }
          barPct={100}
        />
      )
      steps.push(arrow)

      steps.push(
        <FunilStep
          key="ag"
          color="var(--accent)"
          icon={<CalendarClock size={20} strokeWidth={1.65} />}
          label="Reuniões Agendadas"
          num={String(ag)}
          sub={leads > 0 ? `De ${Math.round(leads)} leads` : null}
          badge={
            cvLeadRA !== null ? (
              <span className={`fn-badge ${funilBadgeClass(cvLeadRA, { good: 20, warn: 10 })}`}>
                Conv. Lead→RA: {pct(cvLeadRA)}
              </span>
            ) : (
              <span className="fn-badge warn">Conv. sem dados de lead</span>
            )
          }
          barPct={leads > 0 ? (ag / leads) * 100 : ag > 0 ? 100 : 0}
        />
      )
      steps.push(arrow)

      steps.push(
        <FunilStep
          key="rr"
          color="#22c55e"
          icon={<CheckCircle2 size={20} strokeWidth={1.65} />}
          label="Reuniões Realizadas"
          num={String(rr)}
          sub={
            ag > 0
              ? `De ${ag} agendadas · ${rr} realizadas · ${ns} no-show (${pct(noShow ?? null)})`
              : null
          }
          badge={
            noShow !== null ? (
              <span className={`fn-badge ${funilBadgeClass(100 - noShow, { good: 90, warn: 75 })}`}>
                No-show: {pct(noShow)}
              </span>
            ) : undefined
          }
          barPct={ag > 0 ? (rr / ag) * 100 : 0}
        />
      )
      steps.push(arrow)

      steps.push(
        <FunilStep
          key="vn"
          color="#f59e0b"
          icon={<Briefcase size={20} strokeWidth={1.65} />}
          label="Vendas Fechadas"
          num={String(vn)}
          sub={rr > 0 ? `De ${rr} reuniões realizadas` : null}
          badge={
            winRate !== null ? (
              <span className={`fn-badge ${funilBadgeClass(winRate, { good: 30, warn: 15 })}`}>
                Win-rate: {pct(winRate)}
              </span>
            ) : undefined
          }
          barPct={rr > 0 ? (vn / rr) * 100 : 0}
        />
      )
      steps.push(arrow)

      steps.push(
        <FunilStep
          key="ft"
          color="#16a34a"
          icon={<Banknote size={20} strokeWidth={1.65} />}
          label="Valor Vendido"
          num={fmtCurrency(ft)}
          sub={vn > 0 ? `${vn} vendas · Ticket médio: ${fmtCurrency(tm)}` : vn === 0 ? 'Sem vendas no período' : null}
          barPct={100}
        />
      )
      steps.push(arrow)

      steps.push(
        <FunilStep
          key="ca"
          color="#22d3ee"
          icon={<Wallet size={20} strokeWidth={1.65} />}
          label="Cash Collected"
          num={fmtCurrency(ca)}
          sub={ft > 0 ? `De ${fmtCurrency(ft)} faturados` : null}
          badge={
            collectedPct !== null ? (
              <span className={`fn-badge ${funilBadgeClass(collectedPct, { good: 80, warn: 50 })}`}>
                Coletado: {pct(collectedPct)} do faturado
              </span>
            ) : undefined
          }
          barPct={ft > 0 ? (ca / ft) * 100 : 0}
        />
      )

      let gargalo: string | null = null
      if (leads > 0 && ag > 0 && cvLeadRA !== null && cvLeadRA < 10) {
        gargalo = `Conversão Lead→RA baixa (${pct(cvLeadRA)}). Revisar qualidade dos leads ou processo de contato.`
      } else if (noShow !== null && noShow > 30) {
        gargalo = `No-show alto (${pct(noShow)}). Considere confirmação de reuniões com antecedência.`
      } else if (winRate !== null && winRate < 15) {
        gargalo = `Win-rate baixo (${pct(winRate)}). Revisar pitch, objeções e qualificação do closer.`
      } else if (collectedPct !== null && collectedPct < 50) {
        gargalo = 'Cash Collected abaixo de 50%. Revisar política de parcelamento e cobrança.'
      }

      setContent(
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 680, margin: '0 auto' }}>
            {steps}
          </div>
          {gargalo && (
            <div
              className="card"
              style={{
                marginTop: 20,
                borderColor: 'rgba(248,74,8,.3)',
                background: 'rgba(248,74,8,.05)',
                maxWidth: 680,
                marginLeft: 'auto',
                marginRight: 'auto'
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ display: 'flex', flexShrink: 0, color: 'var(--accent2)' }} aria-hidden>
                  <AlertTriangle size={22} strokeWidth={1.65} />
                </span>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--accent2)' }}>Gargalo Identificado</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>{gargalo}</div>
                </div>
              </div>
            </div>
          )}
          {!gargalo && vn > 0 && (
            <div
              className="card"
              style={{
                marginTop: 20,
                borderColor: 'rgba(34,197,94,.3)',
                background: 'rgba(34,197,94,.05)',
                maxWidth: 680,
                marginLeft: 'auto',
                marginRight: 'auto'
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ display: 'flex', flexShrink: 0, color: 'var(--green)' }} aria-hidden>
                  <CircleCheck size={22} strokeWidth={1.65} />
                </span>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--green)' }}>Funil Saudável</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>As taxas de conversão estão dentro do esperado para o período.</div>
                </div>
              </div>
            </div>
          )}
        </>
      )
    } catch (err) {
      setError(formatFirebaseOrUnknownError(err) || 'Erro ao carregar')
      setContent(null)
    } finally {
      setLoading(false)
    }
  }, [period, customSince, customUntil])

  useEffect(() => {
    loadFunil()
  }, [loadFunil])

  function setFunilPeriod(p: FunilPeriod) {
    setPeriod(p)
    if (p === 'custom') {
      setShowCustomDates(true)
      return
    }
    setShowCustomDates(false)
  }

  function applyFunilCustom() {
    if (!customSince || !customUntil) return
    setSince(customSince)
    setUntil(customUntil)
    setPeriod('custom')
  }

  const periodLabel = since && until ? formatPeriodLabel(since, until) : ''

  return (
    <div className="content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title-row" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            <Layers size={24} strokeWidth={1.65} aria-hidden />
            Funil de Conversão
          </h2>
          <p style={{ color: 'var(--text2)' }}>Identifique gargalos no processo comercial</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {(['hoje', 'ontem', 'mes', '7d', '14d', '30d'] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={`prd-btn ${period === p ? 'active' : ''}`}
              onClick={() => setFunilPeriod(p)}
            >
              {p === 'mes' ? 'Este mês' : p === '7d' ? '7 dias' : p === '14d' ? '14 dias' : p === '30d' ? '30 dias' : p === 'hoje' ? 'Hoje' : 'Ontem'}
            </button>
          ))}
          <button
            type="button"
            className={`prd-btn ${period === 'custom' ? 'active' : ''}`}
            onClick={() => setFunilPeriod('custom')}
          >
            Personalizado
          </button>
        </div>
      </div>
      {showCustomDates && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
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
          <button type="button" className="btn btn-primary btn-sm" onClick={applyFunilCustom}>
            Aplicar
          </button>
        </div>
      )}
      {periodLabel && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>Período: {periodLabel}</div>}
      <div id="fn-content">
        {loading && (
          <div className="loading">
            <div className="spin" /> Carregando...
          </div>
        )}
        {error && (
          <div className="empty">
            <p>Erro: {error}</p>
          </div>
        )}
        {!loading && !error && content}
      </div>
    </div>
  )
}
