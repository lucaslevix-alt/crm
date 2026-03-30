import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarCheck, CalendarPlus, CircleDollarSign, Handshake, Target, Zap } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { addRegistro, createAgendamentoFromSdr } from '../../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../../lib/firebaseUserFacingError'
import { icSm } from '../../lib/icon-sizes'
import { getN8nAgendamentoWebhookUrl, triggerN8nAgendamentoWebhook } from '../../lib/n8nAgendamentoWebhook'

function today(): string {
  return new Date().toISOString().split('T')[0]
}

const tipoLabels: Record<string, string> = {
  reuniao_agendada: 'Agendei reunião',
  reuniao_realizada: 'Realizei reunião',
  reuniao_closer: 'Reunião closer'
}

function isRealizeiReuniaoSdr(tipo: string): boolean {
  return tipo === 'reuniao_realizada'
}

function isAgendeiReuniaoSdr(tipo: string): boolean {
  return tipo === 'reuniao_agendada'
}

export function QuickRegBar() {
  const { currentUser, quickBarHidden, showToast, incrementRegistrosVersion } = useAppStore()
  const [pendingTipo, setPendingTipo] = useState<string | null>(null)
  const [origemLead, setOrigemLead] = useState('')
  const [grupoWpp, setGrupoWpp] = useState('')

  const isSdr = currentUser && (currentUser.cargo === 'sdr' || currentUser.cargo === 'admin')
  const isCloser = currentUser && (currentUser.cargo === 'closer' || currentUser.cargo === 'admin')

  const showSdr = isSdr && !quickBarHidden
  const showCloser = isCloser && !quickBarHidden

  async function quickReg(tipo: string, origemLeadVal?: string, grupoWppVal?: string | null) {
    if (!currentUser) return
    try {
      if (tipo === 'reuniao_agendada') {
        const created = await createAgendamentoFromSdr({
          sdrUserId: currentUser.id,
          sdrUserName: currentUser.nome,
          sdrCargo: currentUser.cargo,
          origemLead: (origemLeadVal ?? '').trim(),
          grupoWpp: (grupoWppVal ?? '').trim()
        })
        const dataStr = today()
        triggerN8nAgendamentoWebhook({
          event: 'reuniao_agendada_sdr',
          origemLead: (origemLeadVal ?? '').trim(),
          nomeLead: (grupoWppVal ?? '').trim(),
          sdrUserId: currentUser.id,
          sdrUserName: currentUser.nome,
          sdrCargo: currentUser.cargo,
          squadId: created.squadId,
          squadNome: created.squadNome,
          agendamentoId: created.agendamentoId,
          registroAgendadaId: created.registroAgendadaId,
          data: dataStr,
          source: 'crm_quick_bar'
        })
        const n8nOn = Boolean(getN8nAgendamentoWebhookUrl())
        showToast(
          n8nOn
            ? 'Reunião agendada. Automação N8N notificada (criação do grupo no WhatsApp).'
            : 'Reunião agendada (registro + agenda do squad).'
        )
      } else {
        await addRegistro({
          data: today(),
          tipo,
          userId: currentUser.id,
          userName: currentUser.nome,
          userCargo: currentUser.cargo,
          anuncio: origemLeadVal?.trim() || null,
          grupoWpp: isRealizeiReuniaoSdr(tipo) ? grupoWppVal?.trim() || null : null
        })
        const msg =
          tipo === 'reuniao_realizada'
            ? 'Reunião realizada.'
            : tipo === 'reuniao_closer'
              ? 'Reunião closer registrada.'
              : 'Registro salvo.'
        showToast(msg)
      }
      incrementRegistrosVersion()
    } catch (err) {
      showToast('Erro: ' + formatFirebaseOrUnknownError(err), 'err')
    }
  }

  function handleQuickAction(tipo: string) {
    setPendingTipo(tipo)
    setOrigemLead('')
    setGrupoWpp('')
  }

  function confirmCampanha() {
    if (!pendingTipo) return
    if (isAgendeiReuniaoSdr(pendingTipo)) {
      if (!origemLead.trim()) {
        showToast('Informe a origem do lead', 'err')
        return
      }
      if (!grupoWpp.trim()) {
        showToast('Informe o nome do lead', 'err')
        return
      }
    }
    if (isRealizeiReuniaoSdr(pendingTipo) && !grupoWpp.trim()) {
      showToast('Informe o grupo de WhatsApp', 'err')
      return
    }
    const gw =
      isAgendeiReuniaoSdr(pendingTipo) || isRealizeiReuniaoSdr(pendingTipo) ? grupoWpp : null
    void quickReg(pendingTipo, origemLead, gw)
    setPendingTipo(null)
    setOrigemLead('')
    setGrupoWpp('')
  }

  function cancelCampanha() {
    setPendingTipo(null)
    setOrigemLead('')
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
                  <label htmlFor="qrb-origem-lead">
                    Origem do lead{' '}
                    {isAgendeiReuniaoSdr(pendingTipo) ? (
                      <span className="qrb-meet-req">*</span>
                    ) : (
                      <span className="qrb-meet-hint">(opcional)</span>
                    )}
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
                {(isRealizeiReuniaoSdr(pendingTipo) || isAgendeiReuniaoSdr(pendingTipo)) && (
                  <div className="qrb-meet-field">
                    <label htmlFor="qrb-grupo-wpp">
                      {isAgendeiReuniaoSdr(pendingTipo) ? (
                        <>
                          Nome do lead <span className="qrb-meet-req">*</span>
                        </>
                      ) : (
                        <>
                          Grupo Wpp <span className="qrb-meet-req">*</span>
                        </>
                      )}
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
                      placeholder={
                        isAgendeiReuniaoSdr(pendingTipo)
                          ? 'Nome para identificar o lead (o N8N pode usar para criar o grupo)'
                          : 'Identificação ou link do grupo'
                      }
                      autoComplete="off"
                    />
                  </div>
                )}
                <div className="qrb-meet-actions">
                  <button type="button" className="qrb-meet-btn qrb-meet-btn--secondary" onClick={cancelCampanha}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="qrb-meet-btn qrb-meet-btn--primary"
                    onClick={confirmCampanha}
                    disabled={
                      (isAgendeiReuniaoSdr(pendingTipo) && (!origemLead.trim() || !grupoWpp.trim())) ||
                      (isRealizeiReuniaoSdr(pendingTipo) && !grupoWpp.trim())
                    }
                  >
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
