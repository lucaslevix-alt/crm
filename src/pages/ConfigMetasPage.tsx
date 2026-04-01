import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Moon, Sun, Target, Trash2 } from 'lucide-react'
import {
  clearMetasPorMes,
  currentMetasMonthYm,
  getMetasFirestoreDoc,
  resolveMetasParaMes,
  setMetasConfig,
  setMetasPorMes,
  type MetasFirestoreDoc
} from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { useAppStore } from '../store/useAppStore'

function labelMes(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export function ConfigMetasPage() {
  const { showToast, themeMode, setThemeMode, currentUser } = useAppStore()
  const podeEditarMetas = currentUser?.cargo === 'admin'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fullDoc, setFullDoc] = useState<MetasFirestoreDoc | null>(null)
  const hojeYm = currentMetasMonthYm()
  const [mesAlvo, setMesAlvo] = useState(hojeYm)

  const [ag, setAg] = useState('')
  const [re, setRe] = useState('')
  const [cl, setCl] = useState('')
  const [vn, setVn] = useState('')
  const [ft, setFt] = useState('')
  const [ca, setCa] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await getMetasFirestoreDoc()
      setFullDoc(d)
    } catch (err) {
      showToast(formatFirebaseOrUnknownError(err) || 'Erro ao carregar', 'err')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!fullDoc) return
    const r = resolveMetasParaMes(mesAlvo, fullDoc)
    setAg(String(r.meta_reunioes_agendadas ?? ''))
    setRe(String(r.meta_reunioes_realizadas ?? ''))
    setCl(String(r.meta_reunioes_closer ?? ''))
    setVn(String(r.meta_vendas ?? ''))
    setFt(String(r.meta_faturamento ?? ''))
    setCa(String(r.meta_cash ?? ''))
  }, [fullDoc, mesAlvo])

  const isMesAtual = mesAlvo === hojeYm
  const temPlanejamentoMes =
    !isMesAtual && fullDoc?.metasPorMes?.[mesAlvo] && Object.keys(fullDoc.metasPorMes[mesAlvo]).length > 0

  async function handleSaveMetas(e: React.FormEvent) {
    e.preventDefault()
    if (!podeEditarMetas) {
      showToast('Apenas administradores podem alterar metas', 'err')
      return
    }
    setSaving(true)
    try {
      if (isMesAtual) {
        await setMetasConfig({
          meta_reunioes_agendadas: ag ? parseInt(ag, 10) : undefined,
          meta_reunioes_realizadas: re ? parseInt(re, 10) : undefined,
          meta_reunioes_closer: cl ? parseInt(cl, 10) : undefined,
          meta_vendas: vn ? parseInt(vn, 10) : undefined,
          meta_faturamento: ft ? parseFloat(ft) : undefined,
          meta_cash: ca ? parseFloat(ca) : undefined
        })
        showToast('Metas do mês atual salvas!')
      } else {
        const patch: Parameters<typeof setMetasPorMes>[1] = {
          meta_reunioes_agendadas: ag ? parseInt(ag, 10) : undefined,
          meta_reunioes_realizadas: re ? parseInt(re, 10) : undefined,
          meta_reunioes_closer: cl ? parseInt(cl, 10) : undefined,
          meta_vendas: vn ? parseInt(vn, 10) : undefined,
          meta_faturamento: ft ? parseFloat(ft) : undefined,
          meta_cash: ca ? parseFloat(ca) : undefined
        }
        await setMetasPorMes(mesAlvo, patch)
        showToast(`Planejamento de ${labelMes(mesAlvo)} salvo (mês atual não foi alterado).`)
      }
      await load()
    } catch (err) {
      showToast(formatFirebaseOrUnknownError(err) || 'Erro ao salvar', 'err')
    } finally {
      setSaving(false)
    }
  }

  async function handleLimparPlanejamento() {
    if (!podeEditarMetas || isMesAtual) return
    if (!temPlanejamentoMes) return
    if (!window.confirm(`Remover todo o planejamento salvo para ${labelMes(mesAlvo)}? As metas passarão a seguir só o mês atual.`)) {
      return
    }
    setSaving(true)
    try {
      await clearMetasPorMes(mesAlvo)
      showToast('Planejamento deste mês removido.')
      await load()
    } catch (err) {
      showToast(formatFirebaseOrUnknownError(err) || 'Erro ao limpar', 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="content">
      <div style={{ marginBottom: 20 }}>
        <Link to="/config" className="config-sub-back">
          ← Configurações
        </Link>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, marginTop: 10 }}>
          Configuração de metas
        </h2>
        <p style={{ color: 'var(--text2)' }}>
          Metas do mês em curso na raiz; meses futuros (ou passados) podem ser planejados sem alterar o mês atual.
        </p>
      </div>
      {loading && (
        <div className="loading" style={{ padding: 24 }}>
          <div className="spin" /> Carregando...
        </div>
      )}
      {!loading && (
        <>
          <div className="card mb">
            <div className="card-header">
              <span className="card-title card-title--ic">
                <Target size={16} strokeWidth={1.65} aria-hidden />
                Metas por mês
              </span>
            </div>
            {!podeEditarMetas && (
              <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 14 }}>
                Apenas administradores podem editar metas. Você pode consultar os valores abaixo.
              </p>
            )}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 12,
                marginBottom: 16
              }}
            >
              <div className="fg" style={{ margin: 0, minWidth: 200 }}>
                <label htmlFor="cm-mes-alvo">Mês para configurar</label>
                <input
                  id="cm-mes-alvo"
                  type="month"
                  className="di"
                  value={mesAlvo}
                  onChange={(e) => setMesAlvo(e.target.value)}
                />
              </div>
              <button type="button" className="btn btn-ghost btn-sm" style={{ width: 'auto' }} onClick={() => setMesAlvo(hojeYm)}>
                Ir para mês atual
              </button>
              {isMesAtual ? (
                <span
                  className="db-tag db-tag--green"
                  style={{ margin: 0, textTransform: 'none', letterSpacing: 'normal', fontSize: 11 }}
                >
                  Mês atual — salva nas metas principais
                </span>
              ) : (
                <span
                  className="db-tag db-tag--purple"
                  style={{ margin: 0, textTransform: 'none', letterSpacing: 'normal', fontSize: 11 }}
                >
                  Planejamento: {labelMes(mesAlvo)} — não altera o mês atual
                </span>
              )}
            </div>
            {isMesAtual ? (
              <p style={{ fontSize: 12, color: 'var(--text2)', margin: '0 0 14px', lineHeight: 1.5 }}>
                Estes valores são os que o dashboard e a página Metas usam <strong>neste mês calendário</strong>. Ao mudar
                para outro mês no seletor, você pode definir metas antecipadas; elas ficam guardadas à parte.
              </p>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text2)', margin: '0 0 14px', lineHeight: 1.5 }}>
                Valores exibidos combinam as <strong>metas do mês atual</strong> (base) com o que você já salvou para{' '}
                <strong>{labelMes(mesAlvo)}</strong>. Campos vazios ao salvar removem a sobrescrita e voltam a usar a base.
              </p>
            )}
            <form onSubmit={handleSaveMetas}>
              <div
                className="fg2"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}
              >
                <div className="fg">
                  <label htmlFor="cm-ag">Meta Reuniões Agendadas</label>
                  <input id="cm-ag" type="number" value={ag} onChange={(e) => setAg(e.target.value)} placeholder="80" disabled={!podeEditarMetas} />
                </div>
                <div className="fg">
                  <label htmlFor="cm-re">Meta Reuniões Realizadas</label>
                  <input id="cm-re" type="number" value={re} onChange={(e) => setRe(e.target.value)} placeholder="60" disabled={!podeEditarMetas} />
                </div>
                <div className="fg">
                  <label htmlFor="cm-cl">Meta Reuniões Closer</label>
                  <input id="cm-cl" type="number" value={cl} onChange={(e) => setCl(e.target.value)} placeholder="50" disabled={!podeEditarMetas} />
                </div>
                <div className="fg">
                  <label htmlFor="cm-vn">Meta Vendas</label>
                  <input id="cm-vn" type="number" value={vn} onChange={(e) => setVn(e.target.value)} placeholder="20" disabled={!podeEditarMetas} />
                </div>
                <div className="fg">
                  <label htmlFor="cm-ft">Meta Faturamento (R$)</label>
                  <input id="cm-ft" type="number" value={ft} onChange={(e) => setFt(e.target.value)} placeholder="50000" disabled={!podeEditarMetas} />
                </div>
                <div className="fg">
                  <label htmlFor="cm-ca">Meta Cash Collected (R$)</label>
                  <input id="cm-ca" type="number" value={ca} onChange={(e) => setCa(e.target.value)} placeholder="40000" disabled={!podeEditarMetas} />
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14, alignItems: 'center' }}>
                <button type="submit" className="btn btn-primary" disabled={saving || !podeEditarMetas}>
                  {saving ? 'Salvando...' : isMesAtual ? 'Salvar metas do mês atual' : `Salvar planejamento de ${labelMes(mesAlvo)}`}
                </button>
                {!isMesAtual && temPlanejamentoMes && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ width: 'auto', color: 'var(--red)' }}
                    disabled={saving || !podeEditarMetas}
                    onClick={handleLimparPlanejamento}
                  >
                    <Trash2 size={14} strokeWidth={1.75} aria-hidden style={{ marginRight: 6 }} />
                    Herdar só metas do mês atual
                  </button>
                )}
              </div>
            </form>
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title card-title--ic">
                {themeMode === 'dark' ? (
                  <Sun size={16} strokeWidth={1.65} aria-hidden />
                ) : (
                  <Moon size={16} strokeWidth={1.65} aria-hidden />
                )}
                Aparência
              </span>
            </div>
            <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
              Modo claro com contraste de texto ajustado para leitura em ambientes iluminados. A preferência fica salva neste
              navegador.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <button
                type="button"
                className={`btn btn-sm ${themeMode === 'dark' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ width: 'auto' }}
                onClick={() => setThemeMode('dark')}
              >
                <Moon size={15} strokeWidth={1.8} aria-hidden />
                Escuro
              </button>
              <button
                type="button"
                className={`btn btn-sm ${themeMode === 'light' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ width: 'auto' }}
                onClick={() => setThemeMode('light')}
              >
                <Sun size={15} strokeWidth={1.8} aria-hidden />
                Claro
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
