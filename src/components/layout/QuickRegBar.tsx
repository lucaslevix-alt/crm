import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarPlus, CircleDollarSign, Handshake, Target, Zap } from 'lucide-react'
import { AgendeiReuniaoModal } from '../agenda/AgendeiReuniaoModal'
import { useAppStore } from '../../store/useAppStore'
import { addRegistro } from '../../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../../lib/firebaseUserFacingError'
import { icSm } from '../../lib/icon-sizes'

function today(): string {
  return new Date().toISOString().split('T')[0]
}

const tipoLabels: Record<string, string> = {
  reuniao_closer: 'Reunião closer'
}

export function QuickRegBar() {
  const { currentUser, quickBarHidden, showToast, incrementRegistrosVersion } = useAppStore()
  const [agendeiOpen, setAgendeiOpen] = useState(false)
  const [pendingTipo, setPendingTipo] = useState<string | null>(null)
  const [origemLead, setOrigemLead] = useState('')

  const isSdr = currentUser && (currentUser.cargo === 'sdr' || currentUser.cargo === 'admin')
  const isCloser = currentUser && (currentUser.cargo === 'closer' || currentUser.cargo === 'admin')

  const showSdr = isSdr && !quickBarHidden
  const showCloser = isCloser && !quickBarHidden

  async function quickRegCloser(origemLeadVal?: string) {
    if (!currentUser) return
    try {
      await addRegistro({
        data: today(),
        tipo: 'reuniao_closer',
        userId: currentUser.id,
        userName: currentUser.nome,
        userCargo: currentUser.cargo,
        anuncio: origemLeadVal?.trim() || null,
        grupoWpp: null
      })
      showToast('Reunião closer registrada.')
      incrementRegistrosVersion()
    } catch (err) {
      showToast('Erro: ' + formatFirebaseOrUnknownError(err), 'err')
    }
  }

  function confirmCampanha() {
    if (!pendingTipo) return
    void quickRegCloser(origemLead)
    setPendingTipo(null)
    setOrigemLead('')
  }

  function cancelCampanha() {
    setPendingTipo(null)
    setOrigemLead('')
  }

  function openModalRegistroVenda() {
    useAppStore.getState().setQuickRegTipo('venda')
    useAppStore.getState().openModal('modal-registro')
  }

  function openModalRegistro() {
    useAppStore.getState().setQuickRegTipo(null)
    useAppStore.getState().openModal('modal-registro')
  }

  return (
    <>
      <div
        className={`quick-reg-bar sdr-bar${showSdr ? ' active' : ''}`}
        style={{ display: showSdr ? 'flex' : 'none' }}
      >
        <span className="qrb-label">
          <Zap size={14} strokeWidth={2} style={{ opacity: 0.85 }} />
          SDR
        </span>
        <button type="button" className="qrb-btn qrb-ag" onClick={() => setAgendeiOpen(true)}>
          <CalendarPlus {...icSm} />
          Agendei reunião
        </button>
        <button
          type="button"
          className="qrb-btn"
          style={{ background: 'rgba(124,58,237,.15)', borderColor: 'rgba(124,58,237,.3)', color: '#a78bfa' }}
          onClick={openModalRegistro}
        >
          <Target {...icSm} />
          Registrar leads
        </button>
        <span className="qrb-sep">|</span>
        <span style={{ fontSize: 11, color: 'var(--text3)', maxWidth: 200, lineHeight: 1.35 }}>
          Realizada: closer marca na <strong style={{ color: 'var(--text2)' }}>Agenda</strong>
        </span>
        <span className="qrb-sep">|</span>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
          <span className="kbd">N</span> completo
        </span>
      </div>

      <div
        className={`quick-reg-bar closer-bar${showCloser ? ' active' : ''}`}
        style={{ display: showCloser ? 'flex' : 'none', bottom: showSdr ? 96 : 28 }}
      >
        <span className="qrb-label">
          <Zap size={14} strokeWidth={2} style={{ opacity: 0.85 }} />
          Closer
        </span>
        <button type="button" className="qrb-btn qrb-cl" onClick={() => setPendingTipo('reuniao_closer')}>
          <Handshake {...icSm} />
          Reunião realizada
        </button>
        <button type="button" className="qrb-btn qrb-vd" onClick={openModalRegistroVenda}>
          <CircleDollarSign {...icSm} />
          Registrar venda
        </button>
        <span className="qrb-sep">|</span>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
          <span className="kbd">N</span> completo
        </span>
      </div>

      {currentUser && (
        <AgendeiReuniaoModal open={agendeiOpen} user={currentUser} onClose={() => setAgendeiOpen(false)} />
      )}

      {pendingTipo &&
        createPortal(
          <div
            className="qrb-meet-backdrop"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) cancelCampanha()
            }}
          >
            <div className="qrb-meet-panel" role="dialog" aria-modal="true" aria-labelledby="qrb-meet-title">
              <h2 id="qrb-meet-title" className="qrb-meet-title">
                {tipoLabels[pendingTipo] ?? pendingTipo}
              </h2>
              <div className="qrb-meet-fields">
                <div className="qrb-meet-field">
                  <label htmlFor="qrb-origem-lead">
                    Origem do lead <span className="qrb-meet-hint">(opcional)</span>
                  </label>
                  <input
                    id="qrb-origem-lead"
                    type="text"
                    className="qrb-meet-input"
                    value={origemLead}
                    onChange={(e) => setOrigemLead(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmCampanha()
                    }}
                    placeholder="Ex: Meta Ads, indicação, evento…"
                    autoComplete="off"
                  />
                </div>
                <div className="qrb-meet-actions">
                  <button type="button" className="qrb-meet-btn qrb-meet-btn--secondary" onClick={cancelCampanha}>
                    Cancelar
                  </button>
                  <button type="button" className="qrb-meet-btn qrb-meet-btn--primary" onClick={confirmCampanha}>
                    OK
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
