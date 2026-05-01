import { useState, useEffect } from 'react'
import { Info, Megaphone } from 'lucide-react'
import {
  metaFetch,
  metaSaveToken,
  metaSaveMode,
  metaLoadSaved,
  metaGetEffectiveToken,
  metaHasBrowserStoredToken,
  metaClearSessionToken,
  metaIsEnvTokenActive,
  type MetaConvMode
} from '../../lib/meta-ads'
import { formatFirebaseOrUnknownError } from '../../lib/firebaseUserFacingError'
import { useAppStore } from '../../store/useAppStore'

interface MeRes {
  name?: string
  id?: string
}

export function MetaConfigModal() {
  const { closeModal, showToast, activeModalId } = useAppStore()
  const [tokenInput, setTokenInput] = useState('')
  const [mode, setMode] = useState<MetaConvMode>('lead')
  const [loading, setLoading] = useState(false)
  const isOpen = activeModalId === 'modal-meta-config'

  useEffect(() => {
    if (!isOpen) return
    setTokenInput('')
    const saved = metaLoadSaved()
    setMode(saved.mode as MetaConvMode)
  }, [isOpen])

  async function handleConnect() {
    const t = tokenInput.trim() || metaGetEffectiveToken()
    if (!t) {
      showToast('Insira o Access Token', 'err')
      return
    }
    setLoading(true)
    try {
      const me = await metaFetch<MeRes>('/me', { access_token: t, fields: 'name,id' })
      if (tokenInput.trim()) {
        if (!metaSaveToken(t)) {
          showToast('Não foi possível guardar o token (armazenamento do navegador bloqueado?).', 'err')
          return
        }
      }
      metaSaveMode(mode)
      closeModal()
      showToast(`Meta conectado: ${me.name ?? 'OK'}`)
      useAppStore.getState().setMetaConnectedAt(Date.now())
    } catch (err) {
      showToast(`Erro Meta: ${formatFirebaseOrUnknownError(err)}`, 'err')
    } finally {
      setLoading(false)
    }
  }

  function handleRemoveSessionToken() {
    metaClearSessionToken()
    setTokenInput('')
    showToast('Token removido deste navegador.')
    useAppStore.getState().setMetaConnectedAt(Date.now())
  }

  const browserToken = metaHasBrowserStoredToken()
  const envToken = metaIsEnvTokenActive()

  return (
    <div style={{ padding: 24 }}>
      <div className="mh" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="mt modal-title-ic" style={{ fontSize: 18, fontWeight: 700 }}>
          <Megaphone size={22} strokeWidth={1.65} aria-hidden />
          Conectar Meta Ads
        </div>
        <button type="button" className="mc" onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text2)' }}>
          ✕
        </button>
      </div>
      <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20, lineHeight: 1.7 }}>
        Insira seu <strong style={{ color: 'var(--accent2)' }}>Access Token</strong> do Meta Business.
        <br />
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
          Gere em: Meta for Developers → Ferramentas → Explorador da API do Graph
        </span>
      </p>
      <p style={{ color: 'var(--text2)', fontSize: 12, marginBottom: 16, lineHeight: 1.65, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
        Se mudaste a app para <strong>Live</strong> ou alteraste permissões: gera um <strong>token novo</strong> no Explorador (com{' '}
        <code style={{ fontSize: 11 }}>leads_retrieval</code> para ler leads), usa <strong>«Remover token»</strong> abaixo e cola o novo. O token antigo não atualiza sozinho.
      </p>
      {(browserToken || envToken) && (
        <div
          style={{
            marginBottom: 14,
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--text2)',
            background: 'rgba(34,197,94,.12)',
            border: '1px solid rgba(34,197,94,.25)'
          }}
        >
          {browserToken
            ? 'Já existe um token neste navegador. Deixe o campo abaixo vazio para manter ou cole um novo para substituir.'
            : 'Token carregado a partir da configuração de ambiente (apenas desenvolvimento). Para produção, use um token colado aqui.'}
        </div>
      )}
      <div className="fg">
        <label htmlFor="meta-token-input">Access Token *</label>
        <input
          id="meta-token-input"
          type="password"
          className="di"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder={browserToken || envToken ? '•••••••• (mantido no navegador / env)' : 'EAABs...'}
          autoComplete="off"
        />
      </div>
      <div className="fg">
        <label htmlFor="meta-conv-mode">Modo de conversão</label>
        <select
          id="meta-conv-mode"
          className="di"
          value={mode}
          onChange={(e) => setMode(e.target.value as MetaConvMode)}
        >
          <option value="lead">Leads (formulário / pixel)</option>
          <option value="mensagem">Mensagens iniciadas</option>
          <option value="visita">Cliques no link</option>
        </select>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
          margin: '12px 0',
          padding: '12px 16px',
          background: 'var(--bg3)',
          borderRadius: 10,
          fontSize: 12,
          color: 'var(--text3)'
        }}
      >
        <Info size={18} strokeWidth={1.65} aria-hidden style={{ flexShrink: 0, color: 'var(--accent)', marginTop: 1 }} />
        <span>
          O token fica no <strong>armazenamento deste navegador</strong>. Os pedidos à Meta usam <strong>POST</strong> (token no corpo,
          não na URL). Para não expor o segredo no cliente, no futuro pode voltar a usar um proxy no servidor (ex.: Cloud Functions).
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
        <button type="button" className="btn btn-primary" onClick={() => void handleConnect()} disabled={loading}>
          {loading ? 'Conectando...' : 'Conectar'}
        </button>
        {browserToken && (
          <button type="button" className="btn btn-ghost" onClick={handleRemoveSessionToken} disabled={loading}>
            Remover token deste navegador
          </button>
        )}
      </div>
    </div>
  )
}
