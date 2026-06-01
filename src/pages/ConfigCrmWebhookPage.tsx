import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Plug, RefreshCw } from 'lucide-react'
import {
  buildCrmNativeWebhookPublicUrl,
  getCrmWebhookConfig,
  listCrmWebhookLogs,
  setCrmWebhookConfig,
  type CrmWebhookLogRow,
  type CrmWebhookStepKind
} from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { useAppStore } from '../store/useAppStore'

function randomSecret(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function mappingsToText(lines: string[]): string {
  return lines.join('\n')
}

function textToMappings(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

const STEP_LABELS: Record<CrmWebhookStepKind, string> = {
  agendada: 'Reunião agendada',
  realizada: 'Reunião realizada',
  venda: 'Venda'
}

export function ConfigCrmWebhookPage() {
  const { showToast } = useAppStore()
  const siteUrl = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim() ?? ''
  const webhookUrl = useMemo(() => buildCrmNativeWebhookPublicUrl(siteUrl), [siteUrl])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [secret, setSecret] = useState('')
  const [mapAgendada, setMapAgendada] = useState('')
  const [mapRealizada, setMapRealizada] = useState('')
  const [mapVenda, setMapVenda] = useState('')
  const [logs, setLogs] = useState<CrmWebhookLogRow[]>([])

  const webhookUrlWithSecret = useMemo(() => {
    if (!webhookUrl || !secret.trim()) return ''
    const sep = webhookUrl.includes('?') ? '&' : '?'
    return `${webhookUrl}${sep}secret=${encodeURIComponent(secret.trim())}`
  }, [webhookUrl, secret])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cfg, logRows] = await Promise.all([getCrmWebhookConfig(), listCrmWebhookLogs(30)])
      setEnabled(cfg.enabled)
      setSecret(cfg.secret)
      setMapAgendada(mappingsToText(cfg.stepMappings.agendada))
      setMapRealizada(mappingsToText(cfg.stepMappings.realizada))
      setMapVenda(mappingsToText(cfg.stepMappings.venda))
      setLogs(logRows)
    } catch (err) {
      showToast(formatFirebaseOrUnknownError(err) || 'Erro ao carregar', 'err')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  async function salvar() {
    if (!secret.trim()) {
      showToast('Defina um segredo para o webhook.', 'err')
      return
    }
    setSaving(true)
    try {
      await setCrmWebhookConfig({
        enabled,
        secret: secret.trim(),
        stepMappings: {
          agendada: textToMappings(mapAgendada),
          realizada: textToMappings(mapRealizada),
          venda: textToMappings(mapVenda)
        }
      })
      showToast('Configuração do CRM nativo salva.')
      await load()
    } catch (err) {
      showToast(formatFirebaseOrUnknownError(err) || 'Erro ao salvar', 'err')
    } finally {
      setSaving(false)
    }
  }

  function copyUrl() {
    if (!webhookUrl) {
      showToast('Defina VITE_SITE_URL no Netlify (URL do site)', 'err')
      return
    }
    void navigator.clipboard.writeText(webhookUrl)
    showToast('URL copiada')
  }

  function copyUrlWithSecret() {
    if (!webhookUrlWithSecret) {
      showToast('Gere e salve o segredo, e defina VITE_SITE_URL no Netlify', 'err')
      return
    }
    void navigator.clipboard.writeText(webhookUrlWithSecret)
    showToast('URL com segredo copiada — cole no CRM nativo')
  }

  return (
    <div className="content">
      <div style={{ marginBottom: 20 }}>
        <Link to="/config" className="config-sub-back">
          ← Configurações
        </Link>
        <h2 className="page-title-row" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, marginTop: 10 }}>
          <Plug size={24} strokeWidth={1.65} aria-hidden />
          CRM nativo (webhook)
        </h2>
        <p style={{ color: 'var(--text2)', maxWidth: 720, lineHeight: 1.5 }}>
          O time usa só o CRM nativo. O webhook roda na <strong>Netlify</strong> (não precisa do plano Blaze do Firebase).
          Quando um negócio muda de coluna, criamos registos aqui e a Classificação atualiza sozinha.
        </p>
      </div>

      <div
        className="card"
        style={{
          marginBottom: 16,
          padding: '14px 16px',
          borderColor: 'var(--border2)',
          background: 'var(--card-bg, rgba(128,128,128,.04))'
        }}
      >
        <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px' }}>Checklist de configuração</p>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: 'var(--text2)', lineHeight: 1.65 }}>
          <li>
            Netlify: <code>VITE_SITE_URL</code> + <code>FIREBASE_SERVICE_ACCOUNT_JSON</code> → novo deploy do site
          </li>
          <li>
            Aqui: gerar <strong>segredo</strong>, mapear nomes das colunas, <strong>Salvar</strong>
          </li>
          <li>
            CRM nativo → <strong>Novo webhook de saída</strong> → colar <strong>só a URL</strong> (Copiar URL) →
            eventos Comercial
          </li>
          <li>Testar: mover negócio no pipeline → ver log abaixo e Classificação</li>
        </ol>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <span className="card-title">Endpoint</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={load} disabled={saving}>
              <RefreshCw size={14} aria-hidden style={{ marginRight: 6, verticalAlign: -2 }} />
              Recarregar
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={salvar} disabled={saving || loading}>
              Salvar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading" style={{ padding: 24 }}>
            <div className="spin" />
          </div>
        ) : (
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Webhook ativo
            </label>

            <div className="fg">
              <label>URL para o CRM nativo (recomendado — já inclui o segredo)</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  className="di"
                  style={{ flex: 1, minWidth: 220, fontSize: 11 }}
                  readOnly
                  value={webhookUrlWithSecret || 'Gere o segredo e salve para ver a URL completa'}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={copyUrlWithSecret}
                  disabled={!webhookUrlWithSecret}
                >
                  <Copy size={14} aria-hidden style={{ marginRight: 4, verticalAlign: -2 }} />
                  Copiar URL
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                Cole no campo <strong>Url</strong> do webhook de saída. O CRM nativo normalmente não tem campo de
                header — por isso o segredo vai na própria URL (<code>?secret=...</code>).
              </p>
              {!siteUrl && (
                <p style={{ fontSize: 11, color: 'var(--amber)', marginTop: 6 }}>
                  <code>VITE_SITE_URL</code> não está definido no build — faça deploy no Netlify com essa variável.
                </p>
              )}
            </div>

            <details style={{ fontSize: 12, color: 'var(--text3)' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--text2)' }}>URL base (sem segredo)</summary>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <input className="di" style={{ flex: 1, minWidth: 220 }} readOnly value={webhookUrl || '—'} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={copyUrl} disabled={!webhookUrl}>
                  Copiar
                </button>
              </div>
            </details>

            <div className="fg">
              <label>Segredo (vai dentro da URL — o CRM nativo não precisa de campo extra)</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  className="di"
                  style={{ flex: 1, minWidth: 200 }}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="Token longo e aleatório"
                  autoComplete="off"
                />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSecret(randomSecret())}>
                  Gerar
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text2)', marginTop: 6, lineHeight: 1.45 }}>
                No CRM nativo você só cola <strong>uma URL</strong>. O segredo já entra no final, assim:{' '}
                <code>?secret=SEU_TOKEN</code>. Use o botão <strong>Copiar URL</strong> acima — não monte na mão.
              </p>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0 }}>
              Eventos suportados: <code>COMMERCIAL_ORDER_STEP_CHANGED</code>,{' '}
              <code>COMMERCIAL_ORDER_CREATED</code>, <code>COMMERCIAL_ORDER_CHANGED</code>. O campo{' '}
              <code>responsible</code> deve ser o e-mail do utilizador cadastrado em Usuários (SDR ou closer).
            </p>

            {(['agendada', 'realizada', 'venda'] as CrmWebhookStepKind[]).map((kind) => {
              const val = kind === 'agendada' ? mapAgendada : kind === 'realizada' ? mapRealizada : mapVenda
              const setVal =
                kind === 'agendada' ? setMapAgendada : kind === 'realizada' ? setMapRealizada : setMapVenda
              return (
                <div className="fg" key={kind}>
                  <label>Nomes da coluna → {STEP_LABELS[kind]}</label>
                  <textarea
                    className="di"
                    rows={3}
                    style={{ width: '100%', resize: 'vertical' }}
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    placeholder="Um nome por linha (como aparece no pipeline)"
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Últimos eventos recebidos</span>
        </div>
        {logs.length === 0 ? (
          <p style={{ padding: 16, color: 'var(--text3)', fontSize: 13 }}>Nenhum evento registado ainda.</p>
        ) : (
          <div className="tw" style={{ maxHeight: 360, overflow: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Negócio</th>
                  <th>Coluna</th>
                  <th>Responsável</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => {
                  const when = l.ts
                    ? new Date(l.ts.seconds * 1000).toLocaleString('pt-BR')
                    : '—'
                  const res = l.result as { skipped?: boolean; reason?: string; registrosCriados?: string[] } | undefined
                  const okLabel = res?.registrosCriados?.length
                    ? `${res.registrosCriados.length} registo(s)`
                    : res?.skipped
                      ? `Ignorado (${res.reason ?? '—'})`
                      : l.message ?? l.level ?? '—'
                  return (
                    <tr key={l.id}>
                      <td className="mono" style={{ fontSize: 11 }}>
                        {when}
                      </td>
                      <td>{l.commercialOrderId ?? '—'}</td>
                      <td>{l.step ?? '—'}</td>
                      <td style={{ fontSize: 12 }}>{l.responsible ?? '—'}</td>
                      <td style={{ fontSize: 12 }}>{okLabel}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
