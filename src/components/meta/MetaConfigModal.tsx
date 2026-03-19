import { useState, useEffect } from 'react'
import { metaFetch, metaSaveToken, metaSaveMode, metaLoadSaved, type MetaConvMode } from '../../lib/meta-ads'
import { useAppStore } from '../../store/useAppStore'

interface MeRes {
  name?: string
  id?: string
}

export function MetaConfigModal() {
  const { closeModal, showToast, activeModalId } = useAppStore()
  const [token, setToken] = useState('')
  const [mode, setMode] = useState<MetaConvMode>('lead')
  const [loading, setLoading] = useState(false)
  const isOpen = activeModalId === 'modal-meta-config'

  useEffect(() => {
    if (isOpen) {
      const saved = metaLoadSaved()
      setToken(saved.token)
      setMode(saved.mode as MetaConvMode)
    }
  }, [isOpen])

  async function handleConnect() {
    const t = token.trim()
    if (!t) {
      showToast('Insira o Access Token', 'err')
      return
    }
    setLoading(true)
    try {
      const me = await metaFetch<MeRes>('/me', { access_token: t, fields: 'name,id' })
      metaSaveToken(t)
      metaSaveMode(mode)
      closeModal()
      showToast(`Meta conectado: ${me.name ?? 'OK'}`)
      useAppStore.getState().setMetaConnectedAt(Date.now())
    } catch (err) {
      showToast(`Erro Meta: ${err instanceof Error ? err.message : 'Erro'}`, 'err')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div className="mh" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="mt" style={{ fontSize: 18, fontWeight: 700 }}>📣 Conectar Meta Ads</div>
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
      <div className="fg">
        <label htmlFor="meta-token-input">Access Token *</label>
        <input
          id="meta-token-input"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="EAABs..."
          autoComplete="off"
        />
      </div>
      <div className="fg">
        <label htmlFor="meta-conv-mode">Modo de conversão</label>
        <select
          id="meta-conv-mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as MetaConvMode)}
        >
          <option value="lead">Leads (formulário / pixel)</option>
          <option value="mensagem">Mensagens iniciadas</option>
          <option value="visita">Cliques no link</option>
        </select>
      </div>
      <div style={{ margin: '12px 0', padding: '12px 16px', background: 'var(--bg3)', borderRadius: 10, fontSize: 12, color: 'var(--text3)' }}>
        💡 O token é salvo localmente no seu navegador e nunca enviado para servidores externos.
      </div>
      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: 8 }}
        onClick={handleConnect}
        disabled={loading}
      >
        {loading ? 'Conectando...' : 'Conectar'}
      </button>
    </div>
  )
}
