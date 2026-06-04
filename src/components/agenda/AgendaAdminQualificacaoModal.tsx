import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import {
  adminAtualizarQualificacaoAgendamento,
  type AgendamentoRow
} from '../../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../../lib/firebaseUserFacingError'
import {
  AGENDA_QUALIFICADA_OPTIONS,
  QUALIFICACAO_SDR_LABELS,
  type LeadBudgetOp,
  type QualificacaoSdr
} from '../../lib/qualificacaoSdr'
import { useAppStore } from '../../store/useAppStore'

const QUAL_OPCOES: QualificacaoSdr[] = ['qualificada', 'pendente', 'nao_qualificada']

interface AgendaAdminQualificacaoModalProps {
  agendamento: AgendamentoRow
  onClose: () => void
  onEditRegistro?: () => void
}

export function AgendaAdminQualificacaoModal({
  agendamento,
  onClose,
  onEditRegistro
}: AgendaAdminQualificacaoModalProps) {
  const { showToast, incrementRegistrosVersion } = useAppStore()
  const [qualificacaoSdr, setQualificacaoSdr] = useState<QualificacaoSdr>(
    agendamento.qualificacaoSdr ?? 'nao_qualificada'
  )
  const [leadBudget, setLeadBudget] = useState<LeadBudgetOp | ''>(agendamento.leadBudget ?? '')
  const [callRecordingUrl, setCallRecordingUrl] = useState(agendamento.callRecordingUrl ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await adminAtualizarQualificacaoAgendamento({
        agendamentoId: agendamento.id,
        qualificacaoSdr,
        leadBudget: leadBudget || null,
        callRecordingUrl: callRecordingUrl.trim() || null
      })
      showToast('Qualificação SDR atualizada.')
      incrementRegistrosVersion()
      onClose()
    } catch (err) {
      showToast('Erro: ' + formatFirebaseOrUnknownError(err), 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="qrb-meet-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 440, maxWidth: 'calc(100vw - 24px)' }} onClick={(e) => e.stopPropagation()}>
        <div className="mh">
          <div className="mt modal-title-ic">
            <ShieldCheck size={20} strokeWidth={1.65} aria-hidden />
            Qualificação SDR (admin)
          </div>
          <button type="button" className="mc" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} style={{ padding: '0 24px 24px' }}>
          <p style={{ fontSize: 13, color: 'var(--text2)', margin: '0 0 16px', lineHeight: 1.5 }}>
            <strong>{agendamento.grupoWpp}</strong>
            <br />
            Ajuste a qualificação para comissão do SDR. Vendas marcadas direto na agenda costumam ficar «Não
            qualificada» até o admin corrigir aqui.
          </p>
          <div className="fg">
            <label>Qualificação *</label>
            <select
              className="di"
              value={qualificacaoSdr}
              onChange={(e) => setQualificacaoSdr(e.target.value as QualificacaoSdr)}
              required
            >
              {QUAL_OPCOES.map((q) => (
                <option key={q} value={q}>
                  {QUALIFICACAO_SDR_LABELS[q]}
                </option>
              ))}
            </select>
          </div>
          <div className="fg">
            <label>Qualificada? (resposta no desfecho)</label>
            <select
              className="di"
              value={leadBudget === 'budget_open' ? '' : leadBudget}
              onChange={(e) => setLeadBudget((e.target.value as LeadBudgetOp) || '')}
            >
              <option value="">—</option>
              {AGENDA_QUALIFICADA_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
              {agendamento.leadBudget === 'budget_open' && (
                <option value="budget_open">Não foi abordado (legado)</option>
              )}
            </select>
          </div>
          <div className="fg">
            <label>URL da gravação (https)</label>
            <input
              type="url"
              className="di"
              value={callRecordingUrl}
              onChange={(e) => setCallRecordingUrl(e.target.value)}
              placeholder="https://…"
              autoComplete="off"
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            {onEditRegistro && (
              <button type="button" className="btn btn-ghost" onClick={onEditRegistro}>
                Editar registo completo
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'A guardar…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
