import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Moon, Sun, Target } from 'lucide-react'
import { getMetasConfig, setMetasConfig, type MetasConfig } from '../firebase/firestore'
import { useAppStore } from '../store/useAppStore'

export function ConfigMetasPage() {
  const { showToast, themeMode, setThemeMode } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [metas, setMetas] = useState<MetasConfig>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const m = await getMetasConfig()
      setMetas(m)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar', 'err')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  const [ag, setAg] = useState('')
  const [re, setRe] = useState('')
  const [cl, setCl] = useState('')
  const [vn, setVn] = useState('')
  const [ft, setFt] = useState('')
  const [ca, setCa] = useState('')

  useEffect(() => {
    setAg(String(metas.meta_reunioes_agendadas ?? ''))
    setRe(String(metas.meta_reunioes_realizadas ?? ''))
    setCl(String(metas.meta_reunioes_closer ?? ''))
    setVn(String(metas.meta_vendas ?? ''))
    setFt(String(metas.meta_faturamento ?? ''))
    setCa(String(metas.meta_cash ?? ''))
  }, [metas])

  async function handleSaveMetas(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await setMetasConfig({
        meta_reunioes_agendadas: ag ? parseInt(ag, 10) : undefined,
        meta_reunioes_realizadas: re ? parseInt(re, 10) : undefined,
        meta_reunioes_closer: cl ? parseInt(cl, 10) : undefined,
        meta_vendas: vn ? parseInt(vn, 10) : undefined,
        meta_faturamento: ft ? parseFloat(ft) : undefined,
        meta_cash: ca ? parseFloat(ca) : undefined
      })
      showToast('Metas salvas!')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar', 'err')
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
        <p style={{ color: 'var(--text2)' }}>Metas mensais globais e preferências de aparência</p>
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
                Metas mensais
              </span>
            </div>
            <form onSubmit={handleSaveMetas}>
              <div
                className="fg2"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}
              >
                <div className="fg">
                  <label htmlFor="cm-ag">Meta Reuniões Agendadas</label>
                  <input id="cm-ag" type="number" value={ag} onChange={(e) => setAg(e.target.value)} placeholder="80" />
                </div>
                <div className="fg">
                  <label htmlFor="cm-re">Meta Reuniões Realizadas</label>
                  <input id="cm-re" type="number" value={re} onChange={(e) => setRe(e.target.value)} placeholder="60" />
                </div>
                <div className="fg">
                  <label htmlFor="cm-cl">Meta Reuniões Closer</label>
                  <input id="cm-cl" type="number" value={cl} onChange={(e) => setCl(e.target.value)} placeholder="50" />
                </div>
                <div className="fg">
                  <label htmlFor="cm-vn">Meta Vendas</label>
                  <input id="cm-vn" type="number" value={vn} onChange={(e) => setVn(e.target.value)} placeholder="20" />
                </div>
                <div className="fg">
                  <label htmlFor="cm-ft">Meta Faturamento (R$)</label>
                  <input id="cm-ft" type="number" value={ft} onChange={(e) => setFt(e.target.value)} placeholder="50000" />
                </div>
                <div className="fg">
                  <label htmlFor="cm-ca">Meta Cash Collected (R$)</label>
                  <input id="cm-ca" type="number" value={ca} onChange={(e) => setCa(e.target.value)} placeholder="40000" />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar metas'}
              </button>
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
