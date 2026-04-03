import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileSpreadsheet, RefreshCw } from 'lucide-react'
import {
  getRegistrosByRange,
  labelFormaPagamento,
  listAgendamentosByDataRange,
  listUsers,
  type AgendamentoRow,
  type RegistroRow
} from '../firebase/firestore'
import type { CrmUser } from '../store/useAppStore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { today, mRange, wRange, formatPeriodLabel } from '../lib/dates'
import { downloadCsvUtf8Bom } from '../lib/csvDownload'
import { contaParaComissao } from '../lib/registroComissao'
import { QUALIFICACAO_SDR_LABELS, labelLeadBudget } from '../lib/qualificacaoSdr'

function fmtMoney(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

/** Valor numérico para CSV (ponto decimal, sem separador de milhares). */
function fmtMoneyCsv(v: number): string {
  return String((Math.round((v || 0) * 100) / 100).toFixed(2))
}

function safeName(r: RegistroRow): string {
  const g = (r.grupoWpp ?? '').trim()
  if (g) return g
  const o = (r.obs ?? '').trim()
  if (o) return o.slice(0, 120)
  return '—'
}

/** Nome do closer gravado na `obs` quando a realizada veio da Agenda. */
function closerNomeFromObsAgenda(obs: string | null | undefined): string | null {
  if (!obs) return null
  const m = obs.match(/Agenda · (?:venda · )?closer (.+)/)
  return m?.[1]?.trim() || null
}

function fmtMarcacaoEm(r: RegistroRow): string {
  const secs = r.criadoEm?.seconds
  if (secs == null) return '—'
  return new Date(secs * 1000).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtMarcacaoEmCsv(r: RegistroRow): string {
  const secs = r.criadoEm?.seconds
  if (secs == null) return ''
  return new Date(secs * 1000).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function closerQueMarcouRealizada(r: RegistroRow, agByRegistroId: Map<string, AgendamentoRow>): string {
  const a = agByRegistroId.get(r.id)
  if (a?.closerUserName?.trim()) return a.closerUserName.trim()
  return closerNomeFromObsAgenda(r.obs) ?? '—'
}

export function RelatoriosComissoesPage() {
  const [start, setStart] = useState(() => mRange().start)
  const [end, setEnd] = useState(() => mRange().end)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<RegistroRow[]>([])
  const [agendamentos, setAgendamentos] = useState<AgendamentoRow[]>([])
  const [sdrUsers, setSdrUsers] = useState<CrmUser[]>([])
  const [closerUsers, setCloserUsers] = useState<CrmUser[]>([])
  const [sdrFilterUserId, setSdrFilterUserId] = useState('')
  const [closerFilterUserId, setCloserFilterUserId] = useState('')

  const agByRealizadaId = useMemo(() => {
    const m = new Map<string, AgendamentoRow>()
    for (const a of agendamentos) {
      if (a.registroRealizadaSdrId) m.set(a.registroRealizadaSdrId, a)
    }
    return m
  }, [agendamentos])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await listUsers()
        if (!cancelled) {
          const byNome = (a: CrmUser, b: CrmUser) => a.nome.localeCompare(b.nome)
          setSdrUsers(list.filter((u) => u.cargo === 'sdr').sort(byNome))
          setCloserUsers(list.filter((u) => u.cargo === 'closer').sort(byNome))
        }
      } catch {
        if (!cancelled) {
          setSdrUsers([])
          setCloserUsers([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const sdrFilterOptions = useMemo(() => {
    const base = sdrUsers.map((u) => ({ id: u.id, label: u.nome }))
    const seen = new Set(base.map((x) => x.id))
    const extra: { id: string; label: string }[] = []
    for (const r of rows) {
      if (r.tipo !== 'reuniao_agendada' && r.tipo !== 'reuniao_realizada') continue
      if (seen.has(r.userId)) continue
      seen.add(r.userId)
      extra.push({ id: r.userId, label: `${r.userName} (só registos)` })
    }
    extra.sort((a, b) => a.label.localeCompare(b.label))
    return [...base, ...extra]
  }, [sdrUsers, rows])

  const closerFilterOptions = useMemo(() => {
    const base = closerUsers.map((u) => ({ id: u.id, label: u.nome }))
    const seen = new Set(base.map((x) => x.id))
    const extra: { id: string; label: string }[] = []
    for (const r of rows) {
      if (r.tipo !== 'venda') continue
      if (seen.has(r.userId)) continue
      seen.add(r.userId)
      extra.push({ id: r.userId, label: `${r.userName} (só registos)` })
    }
    extra.sort((a, b) => a.label.localeCompare(b.label))
    return [...base, ...extra]
  }, [closerUsers, rows])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, ags] = await Promise.all([
        getRegistrosByRange(start, end),
        listAgendamentosByDataRange(start, end)
      ])
      setRows(list)
      setAgendamentos(ags)
    } catch (err) {
      setError(formatFirebaseOrUnknownError(err) || 'Erro ao carregar')
      setRows([])
      setAgendamentos([])
    } finally {
      setLoading(false)
    }
  }, [start, end])

  const rowsComissao = useMemo(() => rows.filter(contaParaComissao), [rows])

  const matchesSdrFilter = useCallback(
    (r: RegistroRow) => !sdrFilterUserId || r.userId === sdrFilterUserId,
    [sdrFilterUserId]
  )

  const matchesCloserFilter = useCallback(
    (r: RegistroRow) => !closerFilterUserId || r.userId === closerFilterUserId,
    [closerFilterUserId]
  )

  const agendadas = useMemo(
    () => rowsComissao.filter((r) => r.tipo === 'reuniao_agendada' && matchesSdrFilter(r)),
    [rowsComissao, matchesSdrFilter]
  )
  const realizadas = useMemo(
    () => rowsComissao.filter((r) => r.tipo === 'reuniao_realizada' && matchesSdrFilter(r)),
    [rowsComissao, matchesSdrFilter]
  )
  const vendas = useMemo(
    () => rowsComissao.filter((r) => r.tipo === 'venda' && matchesCloserFilter(r)),
    [rowsComissao, matchesCloserFilter]
  )

  const totalVendasValor = useMemo(() => vendas.reduce((s, r) => s + (r.valor || 0), 0), [vendas])
  const totalVendasCash = useMemo(() => vendas.reduce((s, r) => s + (r.cashCollected || 0), 0), [vendas])

  function applyPreset(p: 'mes' | 'semana' | 'hoje') {
    if (p === 'mes') {
      const { start: s, end: e } = mRange()
      setStart(s)
      setEnd(e)
    } else if (p === 'semana') {
      const { start: s, end: e } = wRange()
      setStart(s)
      setEnd(e)
    } else {
      const d = today()
      setStart(d)
      setEnd(d)
    }
  }

  function exportSdrCsv() {
    const header = [
      'tipo',
      'data_reuniao',
      'marcado_em_data_hora',
      'closer_que_marcou',
      'sdr_nome',
      'sdr_cargo',
      'cliente_lead_grupo_wpp',
      'origem_lead_anuncio',
      'orcamento_lead',
      'url_gravacao',
      'qualificacao_sdr',
      'observacoes',
      'id_registro'
    ]
    const body: string[][] = []
    for (const r of agendadas) {
      body.push([
        'reuniao_agendada',
        r.data,
        '',
        '',
        r.userName,
        r.userCargo,
        (r.grupoWpp ?? '').trim() || '—',
        (r.anuncio ?? '').trim() || '—',
        '',
        '',
        '',
        (r.obs ?? '').trim() || '—',
        r.id
      ])
    }
    for (const r of realizadas) {
      const cliente = safeName(r)
      const q = r.qualificacaoSdr
      body.push([
        'reuniao_realizada',
        r.data,
        fmtMarcacaoEmCsv(r),
        closerQueMarcouRealizada(r, agByRealizadaId),
        r.userName,
        r.userCargo,
        cliente,
        (r.anuncio ?? '').trim() || '—',
        labelLeadBudget(r.leadBudget),
        (r.callRecordingUrl ?? '').trim(),
        q ? QUALIFICACAO_SDR_LABELS[q] : '',
        (r.obs ?? '').trim() || '—',
        r.id
      ])
    }
    const stamp = `${start}_${end}`
    const suffix = sdrFilterUserId ? `_sdr-${sdrFilterUserId.slice(0, 8)}` : ''
    downloadCsvUtf8Bom(`relatorio-sdr_${stamp}${suffix}.csv`, [header, ...body])
  }

  function exportCloserCsv() {
    const header = [
      'tipo_registro',
      'data_venda',
      'registado_em_data_hora',
      'closer_nome',
      'closer_cargo',
      'cliente',
      'valor_fechado',
      'valor_referencia',
      'desconto_closer',
      'cash_entrada',
      'forma_pagamento',
      'origem_lead',
      'grupo_wpp_lead',
      'observacoes',
      'produtos_ids',
      'id_registro'
    ]
    const body = vendas.map((r) => [
      'venda',
      r.data,
      fmtMarcacaoEmCsv(r),
      r.userName,
      r.userCargo,
      (r.nomeCliente ?? '').trim() || '—',
      fmtMoneyCsv(r.valor),
      r.valorReferenciaVenda != null ? fmtMoneyCsv(r.valorReferenciaVenda) : '',
      r.descontoCloser != null ? fmtMoneyCsv(r.descontoCloser) : '',
      fmtMoneyCsv(r.cashCollected),
      labelFormaPagamento(r.formaPagamento),
      (r.anuncio ?? '').trim() || '—',
      (r.grupoWpp ?? '').trim() || '—',
      (r.obs ?? '').trim() || '—',
      (r.produtosIds ?? []).join(';'),
      r.id
    ])
    const stamp = `${start}_${end}`
    const suffix = closerFilterUserId ? `_closer-${closerFilterUserId.slice(0, 8)}` : ''
    downloadCsvUtf8Bom(`relatorio-closer-comissoes-vendas_${stamp}${suffix}.csv`, [header, ...body])
  }

  return (
    <div className="content">
      <div className="page-title-row" style={{ marginBottom: 8, alignItems: 'flex-start', gap: 12 }}>
        <FileSpreadsheet size={26} strokeWidth={1.65} aria-hidden style={{ flexShrink: 0, marginTop: 4 }} />
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            Relatórios para comissões
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text2)', fontSize: 13, maxWidth: 720 }}>
            Exporte dados do SDR e do closer no período escolhido para conferir métricas e validar comissões. No CRM, o
            identificador do lead em reuniões SDR costuma ser o <strong>grupo WhatsApp</strong> (campo guardado como
            cliente/lead nas linhas abaixo). Em reuniões marcadas pelo closer na <strong>Agenda</strong>, a coluna{' '}
            <strong>Marcado em</strong> é a data/hora em que o registo de realizada foi criado (quando o closer
            confirmou); <strong>Data</strong> na tabela é a data da reunião no agendamento. A secção do closer inclui
            apenas registos do tipo <strong>venda</strong> (com exportação para análise de comissão: valores, referência,
            desconto e cash).
          </p>
        </div>
      </div>

      <div className="card mb" style={{ marginTop: 16 }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <span className="card-title">Período</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <button type="button" className="prd-btn" onClick={() => applyPreset('mes')}>
              Este mês
            </button>
            <button type="button" className="prd-btn" onClick={() => applyPreset('semana')}>
              Esta semana
            </button>
            <button type="button" className="prd-btn" onClick={() => applyPreset('hoje')}>
              Hoje
            </button>
          </div>
        </div>
        <div style={{ padding: '12px 16px 16px', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text2)' }}>
            Início
            <input
              type="date"
              className="input"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              style={{ minWidth: 140 }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text2)' }}>
            Fim
            <input
              type="date"
              className="input"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              style={{ minWidth: 140 }}
            />
          </label>
          <button type="button" className="btn btn-primary" onClick={() => void load()} disabled={loading}>
            {loading ? (
              <>
                <span className="spin" style={{ width: 14, height: 14, marginRight: 8 }} />
                Carregando…
              </>
            ) : (
              <>
                <RefreshCw size={16} strokeWidth={1.75} style={{ marginRight: 8 }} aria-hidden />
                Carregar dados
              </>
            )}
          </button>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{formatPeriodLabel(start, end)}</span>
        </div>
      </div>

      {error && (
        <div className="empty mb">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="empty">
          <p>Carregue os registros para ver totais e exportar.</p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <>
          <div className="card mb">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
              <span className="card-title">SDR — reuniões</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text2)' }}>
                  <span style={{ whiteSpace: 'nowrap' }}>SDR</span>
                  <select
                    className="input"
                    style={{ minWidth: 200, padding: '6px 10px', fontSize: 13 }}
                    value={sdrFilterUserId}
                    onChange={(e) => setSdrFilterUserId(e.target.value)}
                    aria-label="Filtrar por SDR"
                  >
                    <option value="">Todos os SDRs</option>
                    {sdrFilterOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="btn btn-ghost btn-sm" onClick={exportSdrCsv}>
                  <Download size={15} strokeWidth={1.75} aria-hidden style={{ marginRight: 6 }} />
                  CSV SDR
                </button>
              </div>
            </div>
            <div style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 24 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Agendadas
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{agendadas.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Realizadas
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{realizadas.length}</div>
              </div>
            </div>
            <div style={{ padding: '0 16px 16px', overflowX: 'auto' }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
                Clientes / leads com reunião <strong>realizada</strong> (identificador no CRM):
              </div>
              <table style={{ width: '100%', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Data reunião</th>
                    <th>Marcado em</th>
                    <th>Closer</th>
                    <th>SDR</th>
                    <th>Cliente / lead</th>
                    <th>Origem</th>
                    <th>Orçamento</th>
                    <th>Gravação</th>
                    <th>Qualif.</th>
                  </tr>
                </thead>
                <tbody>
                  {realizadas.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ color: 'var(--text3)' }}>
                        Nenhuma reunião realizada neste período.
                      </td>
                    </tr>
                  ) : (
                    realizadas.map((r) => (
                      <tr key={r.id}>
                        <td className="mono" style={{ whiteSpace: 'nowrap' }}>
                          {r.data}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text2)' }}>{fmtMarcacaoEm(r)}</td>
                        <td>{closerQueMarcouRealizada(r, agByRealizadaId)}</td>
                        <td>{r.userName}</td>
                        <td title={r.grupoWpp ?? r.obs ?? ''}>{safeName(r)}</td>
                        <td
                          style={{
                            color: 'var(--text2)',
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={r.anuncio ?? ''}
                        >
                          {(r.anuncio ?? '—').slice(0, 80)}
                        </td>
                        <td style={{ color: 'var(--text2)', fontSize: 12, maxWidth: 140 }} title={labelLeadBudget(r.leadBudget)}>
                          {labelLeadBudget(r.leadBudget)}
                        </td>
                        <td style={{ fontSize: 11, maxWidth: 160 }} title={r.callRecordingUrl ?? ''}>
                          {r.callRecordingUrl ? (
                            <a
                              href={r.callRecordingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: 'var(--accent)' }}
                            >
                              abrir
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                          {r.qualificacaoSdr ? QUALIFICACAO_SDR_LABELS[r.qualificacaoSdr] : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card mb">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
              <span className="card-title">Closer — vendas (comissões)</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text2)' }}>
                  <span style={{ whiteSpace: 'nowrap' }}>Closer</span>
                  <select
                    className="input"
                    style={{ minWidth: 200, padding: '6px 10px', fontSize: 13 }}
                    value={closerFilterUserId}
                    onChange={(e) => setCloserFilterUserId(e.target.value)}
                    aria-label="Filtrar vendas por closer"
                  >
                    <option value="">Todos os closers</option>
                    {closerFilterOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="btn btn-ghost btn-sm" onClick={exportCloserCsv}>
                  <Download size={15} strokeWidth={1.75} aria-hidden style={{ marginRight: 6 }} />
                  CSV vendas
                </button>
              </div>
            </div>
            <div style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 24 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Vendas (linhas)
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{vendas.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Soma valores
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{fmtMoney(totalVendasValor)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Soma cash entrada
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{fmtMoney(totalVendasCash)}</div>
              </div>
            </div>
            <div style={{ padding: '0 16px 16px', overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Data venda</th>
                    <th>Registado em</th>
                    <th>Closer</th>
                    <th>Cliente</th>
                    <th>Valor</th>
                    <th>Ref.</th>
                    <th>Desc. closer</th>
                    <th>Cash</th>
                    <th>Pagamento</th>
                  </tr>
                </thead>
                <tbody>
                  {vendas.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ color: 'var(--text3)' }}>
                        Nenhuma venda neste período (com o filtro de closer aplicado).
                      </td>
                    </tr>
                  ) : (
                    vendas.map((r) => (
                      <tr key={r.id}>
                        <td className="mono" style={{ whiteSpace: 'nowrap' }}>
                          {r.data}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text2)', fontSize: 12 }}>{fmtMarcacaoEm(r)}</td>
                        <td>{r.userName}</td>
                        <td>{r.nomeCliente?.trim() || '—'}</td>
                        <td>{fmtMoney(r.valor)}</td>
                        <td style={{ color: 'var(--text2)' }}>
                          {r.valorReferenciaVenda != null ? fmtMoney(r.valorReferenciaVenda) : '—'}
                        </td>
                        <td style={{ color: 'var(--text2)' }}>
                          {r.descontoCloser != null ? fmtMoney(r.descontoCloser) : '—'}
                        </td>
                        <td>{fmtMoney(r.cashCollected)}</td>
                        <td style={{ color: 'var(--text2)' }}>{labelFormaPagamento(r.formaPagamento)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
