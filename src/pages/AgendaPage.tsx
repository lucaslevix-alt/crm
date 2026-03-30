import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarClock, CheckCircle2 } from 'lucide-react'
import {
  listAgendamentos,
  marcarAgendamentoRealizada,
  resolveSquadForUserId,
  type AgendamentoRow,
  type AgendamentoStatus
} from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { useAppStore } from '../store/useAppStore'
import { AgendaVendaModal } from '../components/agenda/AgendaVendaModal'

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function mRange(): { start: string; end: string } {
  const n = new Date()
  const y = n.getFullYear()
  const m = n.getMonth() + 1
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const end = new Date(y, m, 0).toISOString().split('T')[0]
  return { start, end }
}

type RegPeriod = '7d' | '14d' | 'mes' | 'todos' | 'custom'

function getRegRange(period: RegPeriod, customDate?: string): { start: string; end: string } {
  const td = today()
  if (period === '7d') {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return { start: d.toISOString().split('T')[0], end: td }
  }
  if (period === '14d') {
    const d = new Date()
    d.setDate(d.getDate() - 13)
    return { start: d.toISOString().split('T')[0], end: td }
  }
  if (period === 'mes') return mRange()
  if (period === 'custom' && customDate) return { start: customDate, end: customDate }
  return { start: '2020-01-01', end: '2099-12-31' }
}

function fdt(s: string): string {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

const STATUS_LABEL: Record<AgendamentoStatus, string> = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  venda: 'Venda'
}

const STATUS_BADGE: Record<AgendamentoStatus, string> = {
  agendada: 'b-sdr',
  realizada: 'b-green',
  venda: 'b-amber'
}

export function AgendaPage() {
  const { currentUser, registrosVersion, showToast, incrementRegistrosVersion } = useAppStore()
  const [regPeriod, setRegPeriod] = useState<RegPeriod>('14d')
  const [customDate, setCustomDate] = useState('')
  const [fStatus, setFStatus] = useState<AgendamentoStatus | ''>('')
  const [busca, setBusca] = useState('')
  const [rows, setRows] = useState<AgendamentoRow[]>([])
  const [mySquadId, setMySquadId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vendaPara, setVendaPara] = useState<AgendamentoRow | null>(null)
  const [marcandoId, setMarcandoId] = useState<string | null>(null)

  const isAdmin = currentUser?.cargo === 'admin'
  const isCloser = currentUser?.cargo === 'closer'

  const load = useCallback(async () => {
    if (!currentUser) return
    setLoading(true)
    setError(null)
    try {
      const squad = await resolveSquadForUserId(currentUser.id)
      setMySquadId(squad?.squadId ?? null)
      const list = await listAgendamentos({
        squadId: squad?.squadId ?? null,
        admin: isAdmin
      })
      setRows(list)
    } catch (e) {
      setError(formatFirebaseOrUnknownError(e) || 'Erro ao carregar')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [currentUser, isAdmin])

  useEffect(() => {
    void load()
  }, [load, registrosVersion])

  const { start, end } = getRegRange(regPeriod, customDate)

  const filtered = rows.filter((r) => {
    if (r.data < start || r.data > end) return false
    if (fStatus && r.status !== fStatus) return false
    const q = busca.trim().toLowerCase()
    if (q) {
      const match =
        r.grupoWpp.toLowerCase().includes(q) ||
        (r.origemLead ?? '').toLowerCase().includes(q) ||
        r.sdrUserName.toLowerCase().includes(q) ||
        r.squadNome.toLowerCase().includes(q) ||
        (r.closerUserName ?? '').toLowerCase().includes(q)
      if (!match) return false
    }
    return true
  })

  function podeAgirNoItem(a: AgendamentoRow): boolean {
    if (!currentUser) return false
    if (!(isAdmin || isCloser)) return false
    if (isAdmin) return true
    return a.squadId === mySquadId
  }

  async function handleRealizada(a: AgendamentoRow) {
    if (!currentUser) return
    if (!window.confirm('Marcar esta reunião como realizada? Serão criados os registos de SDR (realizada) e closer.')) return
    setMarcandoId(a.id)
    try {
      await marcarAgendamentoRealizada({
        agendamentoId: a.id,
        closer: { id: currentUser.id, nome: currentUser.nome, cargo: currentUser.cargo }
      })
      showToast('Marcado como realizada.')
      incrementRegistrosVersion()
    } catch (e) {
      showToast('Erro: ' + formatFirebaseOrUnknownError(e), 'err')
    } finally {
      setMarcandoId(null)
    }
  }

  return (
    <div className="content">
      <div className="page-title-row" style={{ marginBottom: 16 }}>
        <CalendarClock size={26} strokeWidth={1.65} aria-hidden />
        <h1 className="page-title">Agenda do squad</h1>
      </div>
      <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 16, maxWidth: 720 }}>
        Reuniões agendadas pelo SDR (barra rápida «Agendei reunião»). O closer vê o nome do lead e pode marcar como
        realizada ou registrar venda. Opcionalmente um webhook N8N pode criar o grupo no WhatsApp. Administradores veem
        todos os squads.
      </p>

      {!isAdmin && !mySquadId && (
        <div className="card" style={{ padding: 14, marginBottom: 16, borderColor: 'rgba(234,179,8,.35)', color: 'var(--text2)' }}>
          Ainda não está num squad: a lista fica vazia até um administrador o associar a um squad.
        </div>
      )}

      <div className="ctrl-row" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <span className="ctrl-label">Período:</span>
        <button type="button" className={`prd-btn ${regPeriod === '7d' ? 'active' : ''}`} onClick={() => setRegPeriod('7d')}>
          7 dias
        </button>
        <button type="button" className={`prd-btn ${regPeriod === '14d' ? 'active' : ''}`} onClick={() => setRegPeriod('14d')}>
          14 dias
        </button>
        <button type="button" className={`prd-btn ${regPeriod === 'mes' ? 'active' : ''}`} onClick={() => setRegPeriod('mes')}>
          Mês
        </button>
        <button type="button" className={`prd-btn ${regPeriod === 'todos' ? 'active' : ''}`} onClick={() => setRegPeriod('todos')}>
          Todos
        </button>
        <input
          type="date"
          className="di"
          style={{ width: 140 }}
          value={customDate}
          onChange={(e) => {
            setCustomDate(e.target.value)
            if (e.target.value) setRegPeriod('custom')
          }}
          title="Data específica"
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div className="fg" style={{ margin: 0 }}>
            <label>Status</label>
            <select className="di" value={fStatus} onChange={(e) => setFStatus((e.target.value as AgendamentoStatus | '') || '')}>
              <option value="">Todos</option>
              <option value="agendada">Agendada</option>
              <option value="realizada">Realizada</option>
              <option value="venda">Venda</option>
            </select>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="fg" style={{ margin: 0 }}>
            <label>Busca</label>
            <input
              type="text"
              className="di"
              placeholder="Nome do lead, origem, SDR…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card">
        {loading && (
          <div className="loading">
            <div className="spin" />
            A carregar…
          </div>
        )}
        {error && <div style={{ color: 'var(--red)', padding: 16 }}>Erro: {error}</div>}
        {!loading && !error && (
          <div className="tw">
            {filtered.length === 0 ? (
              <div className="empty">
                <div className="empty-icon" aria-hidden>
                  <CalendarClock size={40} strokeWidth={1.4} />
                </div>
                <p>{busca || fStatus ? 'Nenhum item para os filtros.' : 'Nenhum agendamento no período.'}</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Nome do lead</th>
                    <th>Origem do lead</th>
                    <th>SDR</th>
                    <th>Squad</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id}>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {fdt(a.data)}
                      </td>
                      <td style={{ fontWeight: 600, maxWidth: 220 }}>
                        <span className="chip" title={a.grupoWpp} style={{ borderColor: 'rgba(34,197,94,.35)', color: 'var(--green)' }}>
                          {a.grupoWpp}
                        </span>
                      </td>
                      <td style={{ maxWidth: 160 }}>
                        {a.origemLead ? (
                          <span className="chip" title={a.origemLead}>
                            {a.origemLead}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <strong>{a.sdrUserName}</strong>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{a.squadNome}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                        {a.closerUserName && (
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{a.closerUserName}</div>
                        )}
                      </td>
                      <td>
                        {a.status === 'agendada' && podeAgirNoItem(a) && currentUser && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={marcandoId === a.id}
                              onClick={() => void handleRealizada(a)}
                              title="Marcar realizada"
                            >
                              <CheckCircle2 size={16} strokeWidth={1.65} />
                              Realizada
                            </button>
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => setVendaPara(a)}>
                              Venda
                            </button>
                          </div>
                        )}
                        {a.status === 'realizada' && podeAgirNoItem(a) && currentUser && (
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => setVendaPara(a)}>
                            Registrar venda
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {vendaPara &&
        currentUser &&
        createPortal(
          <AgendaVendaModal agendamento={vendaPara} closer={currentUser} onClose={() => setVendaPara(null)} />,
          document.body
        )}
    </div>
  )
}
