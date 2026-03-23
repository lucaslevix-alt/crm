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

export function QuickRegBar() {
  const { currentUser, quickBarHidden } = useAppStore()
  const [pendingTipo, setPendingTipo] = useState<string | null>(null)
  const [campanha, setCampanha] = useState('')

  const isSdr = currentUser && (currentUser.cargo === 'sdr' || currentUser.cargo === 'admin')
  const isCloser = currentUser && (currentUser.cargo === 'closer' || currentUser.cargo === 'admin')

  const showSdr = isSdr && !quickBarHidden
  const showCloser = isCloser && !quickBarHidden

  async function quickReg(tipo: string, campanhaVal?: string) {
    if (!currentUser) return
    try {
      await addRegistro({
        data: today(),
        tipo,
        userId: currentUser.id,
        userName: currentUser.nome,
        userCargo: currentUser.cargo,
        anuncio: campanhaVal?.trim() || null
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
  }

  function confirmCampanha() {
    if (!pendingTipo) return
    quickReg(pendingTipo, campanha)
    setPendingTipo(null)
    setCampanha('')
  }

  function cancelCampanha() {
    setPendingTipo(null)
    setCampanha('')
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

      {pendingTipo && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelCampanha()
          }}
        >
          <div
            style={{
              background: '#1c1c1e',
              borderRadius: 14,
              width: 340,
              padding: '24px 20px 16px',
              boxShadow: '0 8px 32px rgba(0,0,0,.5)',
              border: '1px solid rgba(255,255,255,.08)'
            }}
          >
            <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
              {tipoLabels[pendingTipo] ?? pendingTipo}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>
              Campanha Meta Ads (opcional — deixe vazio para pular):
            </div>
            <input
              type="text"
              className="di"
              value={campanha}
              onChange={(e) => setCampanha(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmCampanha()
              }}
              style={{
                width: '100%',
                marginBottom: 20,
                border: '2px solid var(--amber)',
                borderRadius: 8,
                background: '#111',
                color: '#fff',
                fontSize: 14,
                padding: '10px 12px'
              }}
              placeholder=""
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={cancelCampanha}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,.12)',
                  background: 'rgba(255,255,255,.06)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmCampanha}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
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
