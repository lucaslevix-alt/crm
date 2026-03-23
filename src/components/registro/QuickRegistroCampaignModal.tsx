import { useEffect, useState } from 'react'
import { Banknote, CalendarClock, Handshake } from 'lucide-react'
import { addRegistro } from '../../firebase/firestore'
import { useAppStore } from '../../store/useAppStore'

const SKIP_KEY = 'quick_reg_campaign_skip'

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function loadSkipPreference(): boolean {
  try {
    return window.localStorage.getItem(SKIP_KEY) === '1'
  } catch {
    return false
  }
}

function PromptIcon({ tipo }: { tipo: string }) {
  const p = { size: 28, strokeWidth: 1.65 } as const
  if (tipo === 'venda') return <Banknote {...p} aria-hidden />
  if (tipo === 'reuniao_closer') return <Handshake {...p} aria-hidden />
  return <CalendarClock {...p} aria-hidden />
}

export function QuickRegistroCampaignModal() {
  const {
    currentUser,
    quickRegistroPrompt,
    setQuickRegistroPrompt,
    setNewRegistroDefaults,
    closeModal,
    showToast,
    incrementRegistrosVersion,
    openModal
  } = useAppStore()
  const [anuncio, setAnuncio] = useState('')
  const [skipNextTime, setSkipNextTime] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!quickRegistroPrompt) return
    setAnuncio('')
    setSkipNextTime(loadSkipPreference())
  }, [quickRegistroPrompt])

  if (!quickRegistroPrompt) return null

  const confirmLabel = saving ? 'Salvando...' : quickRegistroPrompt.mode === 'modal' ? 'Continuar' : 'Salvar'

  async function persistPreference() {
    try {
      window.localStorage.setItem(SKIP_KEY, skipNextTime ? '1' : '0')
    } catch {
      // ignore localStorage failures
    }
  }

  async function handleClose() {
    await persistPreference()
    setQuickRegistroPrompt(null)
    closeModal()
  }

  async function handleConfirm() {
    if (!currentUser || !quickRegistroPrompt) return
    await persistPreference()

    if (quickRegistroPrompt.mode === 'modal') {
      setNewRegistroDefaults({
        tipo: quickRegistroPrompt.tipo,
        anuncio: anuncio.trim()
      })
      setQuickRegistroPrompt(null)
      openModal('modal-registro')
      return
    }

    setSaving(true)
    try {
      await addRegistro({
        data: today(),
        tipo: quickRegistroPrompt.tipo,
        userId: currentUser.id,
        userName: currentUser.nome,
        userCargo: currentUser.cargo,
        anuncio: anuncio.trim() || null
      })
      incrementRegistrosVersion()
      showToast(
        quickRegistroPrompt.tipo === 'reuniao_agendada'
          ? 'Reunião agendada.'
          : quickRegistroPrompt.tipo === 'reuniao_realizada'
            ? 'Reunião realizada.'
            : 'Registro salvo.'
      )
      setQuickRegistroPrompt(null)
      closeModal()
    } catch (err) {
      showToast(`Erro: ${err instanceof Error ? err.message : String(err)}`, 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', color: 'var(--accent)', flexShrink: 0 }} aria-hidden>
          <PromptIcon tipo={quickRegistroPrompt.tipo} />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{quickRegistroPrompt.title}</div>
          <div style={{ color: 'var(--text2)', marginTop: 4 }}>
            Campanha Meta Ads do lead (opcional - deixe vazio para pular):
          </div>
        </div>
      </div>
      <div className="fg" style={{ marginBottom: 10 }}>
        <input
          type="text"
          className="di"
          value={anuncio}
          onChange={(event) => setAnuncio(event.target.value)}
          placeholder="Ex: Campanha Meta Ads"
          autoFocus
        />
      </div>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 18,
          color: 'var(--text2)',
          cursor: 'pointer'
        }}
      >
        <input
          type="checkbox"
          checked={skipNextTime}
          onChange={(event) => setSkipNextTime(event.target.checked)}
        />
        <span>Não mostrar novamente</span>
      </label>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ width: 140 }}
          onClick={handleClose}
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: 140 }}
          onClick={handleConfirm}
          disabled={saving}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
