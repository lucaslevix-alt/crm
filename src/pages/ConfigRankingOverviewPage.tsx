import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, RefreshCw, Trophy } from 'lucide-react'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { downloadCsvUtf8Bom } from '../lib/csvDownload'
import { mRange } from '../lib/dates'
import {
  formatMonthLabelYm,
  loadCloserRankingOverview,
  loadSdrRankingOverview,
  monthValueFromDate,
  shiftMonthYm,
  sumCloserRows,
  sumSdrRows,
  type CloserOverviewRow,
  type SdrOverviewRow
} from '../lib/rankingOverview'
import { RankMarker } from '../components/ui/RankMarker'

function fmtBrl(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function fmtPct(p: number | null): string {
  if (p == null || Number.isNaN(p)) return '—'
  return `${p.toFixed(1)}%`
}

function fmtMoneyCsv(v: number): string {
  return String((Math.round((v || 0) * 100) / 100).toFixed(2))
}

function exportSdrCsv(ym: string, rows: SdrOverviewRow[], total: SdrOverviewRow): void {
  const header = ['Posição', 'Nome', 'Agendadas', 'Realizadas', 'Vendas', 'Valor vendido (BRL)']
  const body = rows.map((r, i) => [
    String(i + 1),
    r.nome,
    String(r.ag),
    String(r.re),
    String(r.vn),
    fmtMoneyCsv(r.ft)
  ])
  body.push(['', total.nome, String(total.ag), String(total.re), String(total.vn), fmtMoneyCsv(total.ft)])
  downloadCsvUtf8Bom(`ranking-sdr-${ym}.csv`, [header, ...body])
}

function exportCloserCsv(ym: string, rows: CloserOverviewRow[], total: CloserOverviewRow): void {
  const header = ['Posição', 'Nome', 'Reuniões closer', 'Vendas', 'Valor vendido (BRL)', 'Taxa conversão (%)']
  const body = rows.map((r, i) => [
    String(i + 1),
    r.nome,
    String(r.cl),
    String(r.vn),
    fmtMoneyCsv(r.ft),
    r.convPct != null ? r.convPct.toFixed(1) : ''
  ])
  body.push([
    '',
    total.nome,
    String(total.cl),
    String(total.vn),
    fmtMoneyCsv(total.ft),
    total.convPct != null ? total.convPct.toFixed(1) : ''
  ])
  downloadCsvUtf8Bom(`ranking-closer-${ym}.csv`, [header, ...body])
}

export function ConfigRankingOverviewPage() {
  const [monthYm, setMonthYm] = useState(() => monthValueFromDate())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sdrRows, setSdrRows] = useState<SdrOverviewRow[]>([])
  const [closerRows, setCloserRows] = useState<CloserOverviewRow[]>([])

  const periodLabel = useMemo(() => {
    const { start, end } = mRange(monthYm)
    const [sy, sm, sd] = start.split('-')
    const [ey, em, ed] = end.split('-')
    return `${sd}/${sm}/${sy} — ${ed}/${em}/${ey}`
  }, [monthYm])

  const sdrTotal = useMemo(() => sumSdrRows(sdrRows), [sdrRows])
  const closerTotal = useMemo(() => sumCloserRows(closerRows), [closerRows])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [sdr, closer] = await Promise.all([
        loadSdrRankingOverview(monthYm),
        loadCloserRankingOverview(monthYm)
      ])
      setSdrRows(sdr)
      setCloserRows(closer)
    } catch (err) {
      setError(formatFirebaseOrUnknownError(err) || 'Erro ao carregar rankings')
      setSdrRows([])
      setCloserRows([])
    } finally {
      setLoading(false)
    }
  }, [monthYm])

  useEffect(() => {
    load()
  }, [load])

  const monthTitle = formatMonthLabelYm(monthYm)

  return (
    <div className="config-ranking-overview">
      <p className="page-intro" style={{ marginBottom: 20, color: 'var(--text2)', fontSize: 14, lineHeight: 1.55 }}>
        Visão mensal dos rankings de SDR e Closer para comparar meses anteriores e exportar CSV para relatórios.
        Os números seguem as mesmas regras das páginas de{' '}
        <Link to="/ranking-sdr">Ranking SDR</Link> e <Link to="/ranking-closer">Ranking Closer</Link>.
      </p>

      <div
        className="ctrl-row"
        style={{
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 24,
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label="Mês anterior"
            onClick={() => setMonthYm((m) => shiftMonthYm(m, -1))}
          >
            <ChevronLeft size={18} />
          </button>
          <input
            type="month"
            className="inp"
            style={{ width: 'auto', minWidth: 160 }}
            value={monthYm}
            max={monthValueFromDate()}
            onChange={(e) => {
              const v = e.target.value
              if (v) setMonthYm(v)
            }}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label="Próximo mês"
            disabled={monthYm >= monthValueFromDate()}
            onClick={() => setMonthYm((m) => shiftMonthYm(m, 1))}
          >
            <ChevronRight size={18} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{monthTitle}</span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>({periodLabel})</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => load()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : undefined} />
            Atualizar
          </button>
          <Link to="/config/relatorios-comissoes" className="btn btn-ghost btn-sm">
            Relatório de comissões
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading && (
        <div className="empty" style={{ marginBottom: 24 }}>
          <p>Carregando rankings…</p>
        </div>
      )}

      {!loading && (
        <>
          <section className="card" style={{ marginBottom: 24 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 16
              }}
            >
              <h2 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Trophy size={20} style={{ color: 'var(--amber)' }} aria-hidden />
                Ranking SDR
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={!sdrRows.length}
                onClick={() => exportSdrCsv(monthYm, sdrRows, sdrTotal)}
              >
                <Download size={16} />
                Exportar CSV
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 12px' }}>
              Agendadas, realizadas, vendas atribuídas ao SDR e faturamento do mês.
            </p>
            <SdrTable rows={sdrRows} total={sdrTotal} />
          </section>

          <section className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 16
              }}
            >
              <h2 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Trophy size={20} style={{ color: 'var(--green)' }} aria-hidden />
                Ranking Closer
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={!closerRows.length}
                onClick={() => exportCloserCsv(monthYm, closerRows, closerTotal)}
              >
                <Download size={16} />
                Exportar CSV
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 12px' }}>
              Vendas, valor vendido e taxa de conversão (vendas ÷ reuniões closer).
            </p>
            <CloserTable rows={closerRows} total={closerTotal} />
          </section>
        </>
      )}
    </div>
  )
}

function SdrTable({ rows, total }: { rows: SdrOverviewRow[]; total: SdrOverviewRow }) {
  if (!rows.length) {
    return (
      <div className="empty">
        <p>Sem dados de SDR neste mês</p>
      </div>
    )
  }
  return (
    <div className="rank-perf-scroll">
      <table className="rank-perf-table">
        <thead>
          <tr>
            <th className="rank-perf-th rank-perf-th--num">#</th>
            <th className="rank-perf-th">Nome</th>
            <th className="rank-perf-th rank-perf-th--num">Agendadas</th>
            <th className="rank-perf-th rank-perf-th--num">Realizadas</th>
            <th className="rank-perf-th rank-perf-th--num">Vendas</th>
            <th className="rank-perf-th rank-perf-th--num">Valor vendido</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, idx) => (
            <tr key={s.id} className={idx === 0 ? 'rank-perf-tr--top' : undefined}>
              <td className="rank-perf-td rank-perf-td--num">
                <span className="rank-perf-rankcell">
                  <RankMarker index={idx} />
                </span>
              </td>
              <td className="rank-perf-td">
                <span className="rank-perf-name">{s.nome}</span>
              </td>
              <td className="rank-perf-td rank-perf-td--num">{s.ag}</td>
              <td className="rank-perf-td rank-perf-td--num">{s.re}</td>
              <td className="rank-perf-td rank-perf-td--num">{s.vn}</td>
              <td className="rank-perf-td rank-perf-td--num rank-perf-td--money">{fmtBrl(s.ft)}</td>
            </tr>
          ))}
          <tr className="rank-perf-tr--total" style={{ fontWeight: 600, borderTop: '2px solid var(--border)' }}>
            <td className="rank-perf-td" colSpan={2}>
              {total.nome}
            </td>
            <td className="rank-perf-td rank-perf-td--num">{total.ag}</td>
            <td className="rank-perf-td rank-perf-td--num">{total.re}</td>
            <td className="rank-perf-td rank-perf-td--num">{total.vn}</td>
            <td className="rank-perf-td rank-perf-td--num rank-perf-td--money">{fmtBrl(total.ft)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function CloserTable({ rows, total }: { rows: CloserOverviewRow[]; total: CloserOverviewRow }) {
  if (!rows.length) {
    return (
      <div className="empty">
        <p>Sem dados de Closer neste mês</p>
      </div>
    )
  }
  return (
    <div className="rank-perf-scroll">
      <table className="rank-perf-table">
        <thead>
          <tr>
            <th className="rank-perf-th rank-perf-th--num">#</th>
            <th className="rank-perf-th">Nome</th>
            <th className="rank-perf-th rank-perf-th--num">Vendas</th>
            <th className="rank-perf-th rank-perf-th--num">Valor vendido</th>
            <th className="rank-perf-th rank-perf-th--num">Taxa conversão</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, idx) => {
            const convColor =
              s.convPct === null
                ? 'var(--text3)'
                : s.convPct >= 40
                  ? 'var(--green)'
                  : s.convPct >= 20
                    ? 'var(--amber)'
                    : 'var(--red)'
            return (
              <tr key={s.id} className={idx === 0 ? 'rank-perf-tr--top' : undefined}>
                <td className="rank-perf-td rank-perf-td--num">
                  <span className="rank-perf-rankcell">
                    <RankMarker index={idx} />
                  </span>
                </td>
                <td className="rank-perf-td">
                  <span className="rank-perf-name">{s.nome}</span>
                </td>
                <td className="rank-perf-td rank-perf-td--num">{s.vn}</td>
                <td className="rank-perf-td rank-perf-td--num rank-perf-td--money">{fmtBrl(s.ft)}</td>
                <td className="rank-perf-td rank-perf-td--num" style={{ color: convColor, fontWeight: 600 }}>
                  {fmtPct(s.convPct)}
                </td>
              </tr>
            )
          })}
          <tr className="rank-perf-tr--total" style={{ fontWeight: 600, borderTop: '2px solid var(--border)' }}>
            <td className="rank-perf-td" colSpan={2}>
              {total.nome}
            </td>
            <td className="rank-perf-td rank-perf-td--num">{total.vn}</td>
            <td className="rank-perf-td rank-perf-td--num rank-perf-td--money">{fmtBrl(total.ft)}</td>
            <td className="rank-perf-td rank-perf-td--num">{fmtPct(total.convPct)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
