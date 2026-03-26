import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarCheck, CalendarPlus, CircleDollarSign, Handshake, Target, Zap } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { addRegistro } from '../../firebase/firestore'
import { icSm } from '../../lib/icon-sizes'

function today(): string {
  return new Date().toISOString().split('T')[0]
}

const tipoLabels: Record<string, string> = {
  reuniao_agendada: 'Agendei reunião',
  reuniao_realizada: 'Realizei reunião',
  reuniao_closer: 'Reunião closer'
}

/** Grupo Wpp obrigatório só em "Realizei reunião" (SDR), não em "Agendei reunião". */
function isRealizeiReuniaoSdr(tipo: string): boolean {
  return tipo === 'reuniao_realizada'
}

export function QuickRegBar() {
  const { currentUser, quickBarHidden } = useAppStore()
  const [pendingTipo, setPendingTipo] = useState<string | null>(null)
  const [campanha, setCampanha] = useState('')
  const [grupoWpp, setGrupoWpp] = useState('')

  const isSdr = currentUser && (currentUser.cargo === 'sdr' || currentUser.cargo === 'admin')
  const isCloser = currentUser && (currentUser.cargo === 'closer' || currentUser.cargo === 'admin')

  const showSdr = isSdr && !quickBarHidden
  const showCloser = isCloser && !quickBarHidden

  async function quickReg(tipo: string, campanhaVal?: string, grupoWppVal?: string | null) {
    if (!currentUser) return
    try {
      await addRegistro({
        data: today(),
        tipo,
        userId: currentUser.id,
        userName: currentUser.nome,
        userCargo: currentUser.cargo,
        anuncio: campanhaVal?.trim() || null,
        grupoWpp: isRealizeiReuniaoSdr(tipo) ? grupoWppVal?.trim() || null : null
      })
      const msg =
        tipo === 'reuniao_agendada'
          ? 'Reunião agendada.'
          : tipo === 'reuniao_realizada'
            ? 'Reunião realizada.'
            : tipo === 'reuniao_closer'
              ? 'Reunião closer registrada.'
              : 'Registro salvo.'
      useAppStore.getState().showToast(msg)
    } catch (err) {
      useAppStore.getState().showToast('Erro: ' + (err instanceof Error ? err.message : String(err)), 'err')
    }
  }

  function handleQuickAction(tipo: string) {
    setPendingTipo(tipo)
    setCampanha('')
    setGrupoWpp('')
  }

  function confirmCampanha() {
    if (!pendingTipo) return
    if (isRealizeiReuniaoSdr(pendingTipo) && !grupoWpp.trim()) {
      useAppStore.getState().showToast('Informe o grupo de WhatsApp', 'err')
      return
    }
    quickReg(pendingTipo, campanha, isRealizeiReuniaoSdr(pendingTipo) ? grupoWpp : null)
    setPendingTipo(null)
    setCampanha('')
    setGrupoWpp('')
  }

  function cancelCampanha() {
    setPendingTipo(null)
    setCampanha('')
    setGrupoWpp('')
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
        <button type="button" className="qrb-btn qrb-ag" onClick={() => handleQuickAction('reuniao_agendada')}>
          <CalendarPlus {...icSm} />
          Agendei reunião
        </button>
        <button type="button" className="qrb-btn qrb-re" onClick={() => handleQuickAction('reuniao_realizada')}>
          <CalendarCheck {...icSm} />
          Realizei reunião
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
        <button type="button" className="qrb-btn qrb-cl" onClick={() => handleQuickAction('reuniao_closer')}>
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
                  <label htmlFor="qrb-campanha">
                    Campanha Meta Ads{' '}
                    <span className="qrb-meet-hint">(opcional)</span>
                  </label>
                  <input
                    id="qrb-campanha"
                    type="text"
                    className="qrb-meet-input"
                    value={campanha}
                    onChange={(e) => setCampanha(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmCampanha()
                    }}
                    placeholder="Nome da campanha ou deixe vazio"
                    autoComplete="off"
                  />
                </div>
                {isRealizeiReuniaoSdr(pendingTipo) && (
                  <div className="qrb-meet-field">
                    <label htmlFor="qrb-grupo-wpp">
                      Grupo Wpp <span className="qrb-meet-req">*</span>
                    </label>
                    <input
                      id="qrb-grupo-wpp"
                      type="text"
                      className="qrb-meet-input"
                      value={grupoWpp}
                      onChange={(e) => setGrupoWpp(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmCampanha()
                      }}
                      placeholder="Identificação ou link do grupo"
                      autoComplete="off"
                    />
                  </div>
                )}
              </div>
              <div className="qrb-meet-actions">
                <button type="button" className="qrb-meet-btn qrb-meet-btn--secondary" onClick={cancelCampanha}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="qrb-meet-btn qrb-meet-btn--primary"
                  onClick={confirmCampanha}
                  disabled={isRealizeiReuniaoSdr(pendingTipo) && !grupoWpp.trim()}
                >
                  OK
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
