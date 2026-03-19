import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMetasConfig, setMetasConfig, type MetasConfig } from '../firebase/firestore'
import { useAppStore } from '../store/useAppStore'

export function ConfigPage() {
  const { showToast } = useAppStore()
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
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Configurações</h2>
        <p style={{ color: 'var(--text2)' }}>Metas, produtos e parâmetros do sistema</p>
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
              <span className="card-title">🎯 Metas Mensais</span>
            </div>
            <form onSubmit={handleSaveMetas}>
              <div className="fg2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
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
                {saving ? 'Salvando...' : 'Salvar Metas'}
              </button>
            </form>
          </div>
          <div className="card">
            <div className="card-header">Navegação</div>
            <Link to="/metas" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}>
              ← Voltar para Metas
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
