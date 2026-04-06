import { useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { marcarAgendamentoParaReagendamento, type AgendamentoRow } from '../../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../../lib/firebaseUserFacingError'
import type { CrmUser } from '../../store/useAppStore'
import { useAppStore } from '../../store/useAppStore'

interface AgendaReagendarModalProps {
  agendamento: AgendamentoRow
  closer: CrmUser
  onClose: () => void
}

export function AgendaReagendarModal({ agendamento, closer, onClose }: AgendaReagendarModalProps) {
  const { showToast, incrementRegistrosVersion } = useAppStore()
  const [novaData, setNovaData] = useState(agendamento.data || '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(novaData)) {
      showToast('Indique a nova data da reunião.', 'err')
      return
    }
    setSaving(true)
    try {
      await marcarAgendamentoParaReagendamento({
        agendamentoId: agendamento.id,
        novaData,
        closer: { id: closer.id, nome: closer.nome, cargo: closer.cargo }
      })
      showToast('Reagendamento guardado. Mantém-se um único registo de agendada; ao marcar realizada, contará como realizada.')
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
      <div className="qrb-meet-panel" style={{ maxWidth: 440, maxHeight: '90vh', overflow: 'auto' }} role="dialog" aria-modal="true">
        <h2 className="qrb-meet-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarClock size={22} strokeWidth={1.65} aria-hidden />
          Reagendar após no show
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
          Lead: {agendamento.grupoWpp.slice(0, 44)}
          {agendamento.grupoWpp.length > 44 ? '…' : ''} · SDR: {agendamento.sdrUserName}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>
          Define a <strong>nova data</strong> da reunião. Não é criado um novo registo de «reunião agendada» — continua a mesma linha do SDR. Quando marcar <strong>realizada</strong> depois, contará como realizada.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="fg2">
            <div className="fg">
              <label>Nova data da reunião *</label>
              <input type="date" className="di" value={novaData} onChange={(e) => setNovaData(e.target.value)} required />
            </div>
          </div>
          <div className="qrb-meet-actions" style={{ marginTop: 16 }}>
            <button type="button" className="qrb-meet-btn qrb-meet-btn--secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="qrb-meet-btn qrb-meet-btn--primary" disabled={saving}>
              {saving ? 'A guardar…' : 'Confirmar reagendamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
