import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { marcarAgendamentoRealizada, type AgendamentoRow } from '../../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../../lib/firebaseUserFacingError'
import type { CrmUser } from '../../store/useAppStore'
import { useAppStore } from '../../store/useAppStore'
import { LEAD_BUDGET_OPTIONS, type LeadBudgetOp } from '../../lib/qualificacaoSdr'

interface AgendaRealizadaModalProps {
  agendamento: AgendamentoRow
  closer: CrmUser
  onClose: () => void
}

export function AgendaRealizadaModal({ agendamento, closer, onClose }: AgendaRealizadaModalProps) {
  const { showToast, incrementRegistrosVersion } = useAppStore()
  const [leadBudget, setLeadBudget] = useState<LeadBudgetOp | ''>('')
  const [callRecordingUrl, setCallRecordingUrl] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!leadBudget) {
      showToast('Selecione o orçamento do lead', 'err')
      return
    }
    const url = callRecordingUrl.trim()
    if (!url.startsWith('https://')) {
      showToast('O link da gravação deve começar por https://', 'err')
      return
    }
    try {
      const u = new URL(url)
      if (u.protocol !== 'https:') {
        showToast('Indique uma URL https válida para a gravação.', 'err')
        return
      }
    } catch {
      showToast('Indique uma URL https válida para a gravação.', 'err')
      return
    }
    setSaving(true)
    try {
      await marcarAgendamentoRealizada({
        agendamentoId: agendamento.id,
        closer: { id: closer.id, nome: closer.nome, cargo: closer.cargo },
        leadBudget,
        callRecordingUrl: url
      })
      showToast('Marcado como realizada.')
      incrementRegistrosVersion()
      onClose()
    } catch (err) {
      showToast('Erro: ' + formatFirebaseOrUnknownError(err), 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="qrb-meet-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="qrb-meet-panel" style={{ maxWidth: 480, maxHeight: '90vh', overflow: 'auto' }} role="dialog" aria-modal="true">
        <h2 className="qrb-meet-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={22} strokeWidth={1.65} aria-hidden />
          Reunião realizada — {agendamento.grupoWpp.slice(0, 36)}
          {agendamento.grupoWpp.length > 36 ? '…' : ''}
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
          SDR: {agendamento.sdrUserName} · Squad: {agendamento.squadNome}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>
          Para concluir, indique o orçamento percebido do lead e o link <strong>https</strong> da gravação da chamada.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="fg2">
            <div className="fg">
              <label>Orçamento do lead *</label>
              <select
                className="di"
                value={leadBudget}
                onChange={(e) => setLeadBudget(e.target.value as LeadBudgetOp | '')}
                required
              >
                <option value="">Selecionar…</option>
                {LEAD_BUDGET_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="fg s2">
              <label>URL da gravação (https) *</label>
              <input
                type="url"
                className="di"
                value={callRecordingUrl}
                onChange={(e) => setCallRecordingUrl(e.target.value)}
                placeholder="https://…"
                autoComplete="off"
                required
              />
            </div>
          </div>
          <div className="qrb-meet-actions" style={{ marginTop: 16 }}>
            <button type="button" className="qrb-meet-btn qrb-meet-btn--secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="qrb-meet-btn qrb-meet-btn--primary" disabled={saving}>
              {saving ? 'A guardar…' : 'Confirmar realizada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
