import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarClock, CalendarPlus, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { createAgendamentoFromSdr, listClosersParaAgendamentoSdr } from '../../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../../lib/firebaseUserFacingError'
import {
  buildGoogleCalendarAgendamentoUrlForSdr,
  parseLeadEmailsInput
} from '../../lib/googleCalendarAgendamento'
import { getN8nAgendamentoWebhookUrl, triggerN8nAgendamentoWebhook } from '../../lib/n8nAgendamentoWebhook'
import type { CrmUser } from '../../store/useAppStore'
import { useAppStore } from '../../store/useAppStore'

function today(): string {
  return new Date().toISOString().split('T')[0]
}

export interface AgendeiReuniaoModalProps {
  open: boolean
  user: CrmUser
  onClose: () => void
}

export function AgendeiReuniaoModal({ open, user, onClose }: AgendeiReuniaoModalProps) {
  const navigate = useNavigate()
  const { showToast, incrementRegistrosVersion } = useAppStore()
  const [origemLead, setOrigemLead] = useState('')
  const [nomeLead, setNomeLead] = useState('')
  const [emailsLead, setEmailsLead] = useState('')
  const [closerId, setCloserId] = useState('')
  const [closers, setClosers] = useState<CrmUser[]>([])
  const [loadingClosers, setLoadingClosers] = useState(false)
  const [dataReuniao, setDataReuniao] = useState(today())
  const [horaReuniao, setHoraReuniao] = useState('')
  const [saving, setSaving] = useState(false)
  const [googleUrl, setGoogleUrl] = useState<string | null>(null)

  const closerSel = useMemo(() => closers.find((c) => c.id === closerId) ?? null, [closers, closerId])

  useEffect(() => {
    if (!open) return
    setOrigemLead('')
    setNomeLead('')
    setEmailsLead('')
    setCloserId('')
    setDataReuniao(today())
    setHoraReuniao('')
    setSaving(false)
    setGoogleUrl(null)
    setLoadingClosers(true)
    listClosersParaAgendamentoSdr(user.id, user.cargo)
      .then((list) => {
        setClosers(list)
        if (list.length === 1) setCloserId(list[0].id)
      })
      .catch(() => setClosers([]))
      .finally(() => setLoadingClosers(false))
  }, [open, user.id, user.cargo])

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget && !saving) onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const origem = origemLead.trim()
    const nome = nomeLead.trim()
    if (!origem) {
      showToast('Informe a origem do lead', 'err')
      return
    }
    if (!nome) {
      showToast('Informe o nome do lead', 'err')
      return
    }
    if (!closerSel) {
      showToast('Selecione o closer da reunião', 'err')
      return
    }
    const closerEmail = closerSel.email.trim().toLowerCase()
    if (!closerEmail.includes('@')) {
      showToast('O closer selecionado não tem e-mail válido no sistema', 'err')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataReuniao)) {
      showToast('Data da reunião inválida', 'err')
      return
    }
    const leadEmails = parseLeadEmailsInput(emailsLead)
    if (emailsLead.trim() && leadEmails.length === 0) {
      showToast('Informe pelo menos um e-mail válido do lead', 'err')
      return
    }

    setSaving(true)
    try {
      const obsParts = [`Closer: ${closerSel.nome}`]
      if (leadEmails.length > 0) obsParts.push(`E-mails lead: ${leadEmails.join(', ')}`)
      const created = await createAgendamentoFromSdr({
        sdrUserId: user.id,
        sdrUserName: user.nome,
        sdrCargo: user.cargo,
        origemLead: origem,
        grupoWpp: nome,
        data: dataReuniao,
        obs: obsParts.join(' · '),
        closerUserId: closerSel.id,
        closerUserName: closerSel.nome
      })

      triggerN8nAgendamentoWebhook({
        event: 'reuniao_agendada_sdr',
        origemLead: origem,
        nomeLead: nome,
        emailsLead: leadEmails.length > 0 ? leadEmails : undefined,
        closerUserId: closerSel.id,
        closerUserName: closerSel.nome,
        closerEmail,
        horaReuniao: horaReuniao.trim() || undefined,
        sdrUserId: user.id,
        sdrUserName: user.nome,
        sdrCargo: user.cargo,
        squadId: created.squadId,
        squadNome: created.squadNome,
        agendamentoId: created.agendamentoId,
        registroAgendadaId: created.registroAgendadaId,
        data: dataReuniao,
        source: 'crm_quick_bar'
      })

      const gUrl = buildGoogleCalendarAgendamentoUrlForSdr({
        nomeLead: nome,
        date: dataReuniao,
        time: horaReuniao.trim() || undefined,
        leadEmails,
        closerEmail
      })
      setGoogleUrl(gUrl)

      const n8nOn = Boolean(getN8nAgendamentoWebhookUrl())
      showToast(
        n8nOn
          ? 'Agendado no CRM e na agenda do squad. N8N notificado para o grupo WhatsApp.'
          : 'Agendado no CRM e na agenda do squad.'
      )
      incrementRegistrosVersion()
    } catch (err) {
      showToast('Erro: ' + formatFirebaseOrUnknownError(err), 'err')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const semClosers = !loadingClosers && closers.length === 0

  return createPortal(
    <div className="qrb-meet-backdrop" role="presentation" onClick={handleBackdrop}>
      <div
        className="qrb-meet-panel"
        style={{ maxWidth: googleUrl ? 440 : 420 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agendei-reuniao-title"
      >
        <h2 id="agendei-reuniao-title" className="qrb-meet-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <CalendarPlus size={20} strokeWidth={1.65} aria-hidden />
          Agendei reunião
        </h2>

        {!googleUrl ? (
          <>
            <p style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', margin: '-8px 0 16px', lineHeight: 1.45 }}>
              Um passo: registo no CRM, agenda do squad e (se configurado) grupo no WhatsApp via N8N.
            </p>
            {semClosers && (
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--amber)',
                  textAlign: 'center',
                  marginBottom: 12,
                  lineHeight: 1.45
                }}
              >
                Nenhum closer no seu squad. Peça a um administrador para associar closers ao squad.
              </p>
            )}
            <form onSubmit={handleSubmit}>
              <div className="qrb-meet-fields">
                <div className="qrb-meet-field">
                  <label htmlFor="ag-closer">
                    Closer da reunião <span className="qrb-meet-req">*</span>
                  </label>
                  <select
                    id="ag-closer"
                    className="qrb-meet-input"
                    value={closerId}
                    onChange={(e) => setCloserId(e.target.value)}
                    disabled={loadingClosers || semClosers}
                    required
                  >
                    <option value="">
                      {loadingClosers ? 'A carregar closers…' : 'Selecionar closer…'}
                    </option>
                    {closers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                        {c.email ? ` (${c.email})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="qrb-meet-field">
                  <label htmlFor="ag-origem">
                    Origem do lead <span className="qrb-meet-req">*</span>
                  </label>
                  <input
                    id="ag-origem"
                    type="text"
                    className="qrb-meet-input"
                    value={origemLead}
                    onChange={(e) => setOrigemLead(e.target.value)}
                    placeholder="Ex: Meta Ads, indicação…"
                    autoComplete="off"
                    required
                  />
                </div>
                <div className="qrb-meet-field">
                  <label htmlFor="ag-nome">
                    Nome do lead <span className="qrb-meet-req">*</span>
                  </label>
                  <input
                    id="ag-nome"
                    type="text"
                    className="qrb-meet-input"
                    value={nomeLead}
                    onChange={(e) => setNomeLead(e.target.value)}
                    placeholder="Como aparece no WhatsApp / CRM"
                    autoComplete="off"
                    required
                  />
                </div>
                <div className="qrb-meet-field">
                  <label htmlFor="ag-emails">E-mail(s) do lead</label>
                  <input
                    id="ag-emails"
                    type="text"
                    className="qrb-meet-input"
                    value={emailsLead}
                    onChange={(e) => setEmailsLead(e.target.value)}
                    placeholder="lead@empresa.com ou vários separados por vírgula"
                    autoComplete="email"
                  />
                  <p style={{ fontSize: 11, color: 'var(--text3)', margin: '6px 0 0', lineHeight: 1.4 }}>
                    Convidados no Google Agenda: e-mails do lead, o closer escolhido e{' '}
                    <strong style={{ color: 'var(--text2)', fontWeight: 600 }}>contato@lvxdigital.com.br</strong>.
                  </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="qrb-meet-field" style={{ margin: 0 }}>
                    <label htmlFor="ag-data">
                      Data da reunião <span className="qrb-meet-req">*</span>
                    </label>
                    <input
                      id="ag-data"
                      type="date"
                      className="qrb-meet-input"
                      value={dataReuniao}
                      onChange={(e) => setDataReuniao(e.target.value)}
                      required
                    />
                  </div>
                  <div className="qrb-meet-field" style={{ margin: 0 }}>
                    <label htmlFor="ag-hora">Hora (opcional)</label>
                    <input
                      id="ag-hora"
                      type="time"
                      className="qrb-meet-input"
                      value={horaReuniao}
                      onChange={(e) => setHoraReuniao(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="qrb-meet-actions">
                <button type="button" className="qrb-meet-btn qrb-meet-btn--secondary" onClick={onClose} disabled={saving}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="qrb-meet-btn qrb-meet-btn--primary"
                  disabled={saving || semClosers || loadingClosers}
                >
                  {saving ? 'A guardar…' : 'Confirmar agendamento'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--green)' }}>Lead agendado</strong> em Registros e na Agenda do squad
              {closerSel ? (
                <>
                  {' '}
                  com <strong>{closerSel.nome}</strong>.
                </>
              ) : (
                '.'
              )}
              {horaReuniao.trim() ? (
                <> Abra o Google Agenda para bloquear o horário.</>
              ) : (
                <> Defina data/hora no Google Agenda se ainda não tiver.</>
              )}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              <a
                href={googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="qrb-meet-btn qrb-meet-btn--primary"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' }}
              >
                <ExternalLink size={16} strokeWidth={1.75} aria-hidden />
                Abrir Google Agenda
              </a>
              <button
                type="button"
                className="qrb-meet-btn qrb-meet-btn--secondary"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onClick={() => {
                  onClose()
                  navigate('/agenda')
                }}
              >
                <CalendarClock size={16} strokeWidth={1.75} aria-hidden />
                Ver na Agenda
              </button>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
