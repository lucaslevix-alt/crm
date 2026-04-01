import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Moon, Sun, Target, Trash2, Users } from 'lucide-react'
import {
  clearMetasPorMes,
  currentMetasMonthYm,
  getMetasFirestoreDoc,
  listUsers,
  METAS_CONFIG_KEYS,
  resolveMetasIndividuaisParaMes,
  resolveMetasParaMes,
  setMetasConfig,
  setMetasPorMes,
  setMetasPorUsuarioRoot,
  sumMetasPorUsuarioMap,
  type MetasConfig,
  type MetasFirestoreDoc,
  type MetasPorUsuario
} from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { useAppStore } from '../store/useAppStore'
import type { CrmUser } from '../store/useAppStore'

function labelMes(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

const INDIV_COLS: Array<{ lb: string; short: string; key: keyof MetasConfig; money: boolean }> = [
  { lb: 'Reuniões agendadas', short: 'Agend.', key: 'meta_reunioes_agendadas', money: false },
  { lb: 'Reuniões realizadas', short: 'Real.', key: 'meta_reunioes_realizadas', money: false },
  { lb: 'Reuniões closer', short: 'Closer', key: 'meta_reunioes_closer', money: false },
  { lb: 'Vendas', short: 'Vendas', key: 'meta_vendas', money: false },
  { lb: 'Faturamento (R$)', short: 'Fat.', key: 'meta_faturamento', money: true },
  { lb: 'Cash (R$)', short: 'Cash', key: 'meta_cash', money: true }
]

type IndivForm = Record<string, Partial<Record<keyof MetasConfig, string>>>

function buildMetasPorUsuarioFromState(form: IndivForm): MetasPorUsuario {
  const out: MetasPorUsuario = {}
  for (const [uid, fields] of Object.entries(form)) {
    const partial: Partial<MetasConfig> = {}
    for (const k of METAS_CONFIG_KEYS) {
      const s = fields[k]?.trim()
      if (s === '' || s == null) continue
      const isMoney = k === 'meta_faturamento' || k === 'meta_cash'
      const num = isMoney ? parseFloat(s.replace(',', '.')) : parseInt(s, 10)
      if (Number.isFinite(num)) partial[k] = num
    }
    if (Object.keys(partial).length > 0) out[uid] = partial
  }
  return out
}

function fmtCmp(v: number | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: v % 1 !== 0 ? 2 : 0 }).format(v)
}

export function ConfigMetasPage() {
  const { showToast, themeMode, setThemeMode, currentUser } = useAppStore()
  const podeEditarMetas = currentUser?.cargo === 'admin'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fullDoc, setFullDoc] = useState<MetasFirestoreDoc | null>(null)
  const [users, setUsers] = useState<CrmUser[]>([])
  const [indivForm, setIndivForm] = useState<IndivForm>({})
  const hojeYm = currentMetasMonthYm()
  const [mesAlvo, setMesAlvo] = useState(hojeYm)

  const [ag, setAg] = useState('')
  const [re, setRe] = useState('')
  const [cl, setCl] = useState('')
  const [vn, setVn] = useState('')
  const [ft, setFt] = useState('')
  const [ca, setCa] = useState('')

  const sdrUsers = useMemo(() => users.filter((u) => u.cargo === 'sdr').sort((a, b) => a.nome.localeCompare(b.nome)), [users])
  const closerUsers = useMemo(
    () => users.filter((u) => u.cargo === 'closer').sort((a, b) => a.nome.localeCompare(b.nome)),
    [users]
  )
  const sdrIds = useMemo(() => new Set(sdrUsers.map((u) => u.id)), [sdrUsers])
  const closerIds = useMemo(() => new Set(closerUsers.map((u) => u.id)), [closerUsers])
  const outrosMetaUsers = useMemo(() => {
    const seen = new Set([...sdrIds, ...closerIds])
    return users
      .filter((u) => !seen.has(u.id))
      .filter((u) => {
        const row = indivForm[u.id]
        if (!row) return false
        return METAS_CONFIG_KEYS.some((k) => (row[k] ?? '').trim() !== '')
      })
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [users, sdrIds, closerIds, indivForm])
  const unknownUidsComMetas = useMemo(() => {
    const known = new Set(users.map((u) => u.id))
    return Object.keys(indivForm).filter((uid) => {
      if (known.has(uid)) return false
      const row = indivForm[uid]
      if (!row) return false
      return METAS_CONFIG_KEYS.some((k) => (row[k] ?? '').trim() !== '')
    })
  }, [indivForm, users])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [d, u] = await Promise.all([getMetasFirestoreDoc(), listUsers()])
      setFullDoc(d)
      setUsers(u)
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

  useEffect(() => {
    if (!fullDoc) return
    const m = resolveMetasIndividuaisParaMes(mesAlvo, fullDoc)
    const next: IndivForm = {}
    const ensure = (uid: string) => {
      if (!next[uid]) next[uid] = {}
    }
    for (const u of users) {
      if (u.cargo === 'sdr' || u.cargo === 'closer') ensure(u.id)
    }
    for (const uid of Object.keys(m)) ensure(uid)
    for (const [uid, partial] of Object.entries(m)) {
      for (const k of METAS_CONFIG_KEYS) {
        const v = partial[k]
        if (v != null) next[uid][k] = String(v)
      }
    }
    setIndivForm(next)
  }, [fullDoc, mesAlvo, users])

  const isMesAtual = mesAlvo === hojeYm
  const mesBlock = fullDoc?.metasPorMes?.[mesAlvo]
  const temPlanejamentoMes =
    !isMesAtual &&
    mesBlock &&
    (METAS_CONFIG_KEYS.some((k) => mesBlock[k] != null) ||
      (mesBlock.metasPorUsuario && Object.keys(mesBlock.metasPorUsuario).length > 0))

  const builtIndiv = useMemo(() => buildMetasPorUsuarioFromState(indivForm), [indivForm])
  const sumSdr = useMemo(() => {
    const ids = new Set(sdrUsers.map((u) => u.id))
    const sub: MetasPorUsuario = {}
    for (const [uid, p] of Object.entries(builtIndiv)) {
      if (ids.has(uid)) sub[uid] = p
    }
    return sumMetasPorUsuarioMap(sub)
  }, [builtIndiv, sdrUsers])
  const sumCloser = useMemo(() => {
    const ids = new Set(closerUsers.map((u) => u.id))
    const sub: MetasPorUsuario = {}
    for (const [uid, p] of Object.entries(builtIndiv)) {
      if (ids.has(uid)) sub[uid] = p
    }
    return sumMetasPorUsuarioMap(sub)
  }, [builtIndiv, closerUsers])
  const sumTodos = useMemo(() => sumMetasPorUsuarioMap(builtIndiv), [builtIndiv])

  const globalDraft = useMemo((): MetasConfig => {
    const o: MetasConfig = {}
    const agN = ag ? parseInt(ag, 10) : undefined
    const reN = re ? parseInt(re, 10) : undefined
    const clN = cl ? parseInt(cl, 10) : undefined
    const vnN = vn ? parseInt(vn, 10) : undefined
    const ftN = ft ? parseFloat(ft.replace(',', '.')) : undefined
    const caN = ca ? parseFloat(ca.replace(',', '.')) : undefined
    if (agN != null && Number.isFinite(agN)) o.meta_reunioes_agendadas = agN
    if (reN != null && Number.isFinite(reN)) o.meta_reunioes_realizadas = reN
    if (clN != null && Number.isFinite(clN)) o.meta_reunioes_closer = clN
    if (vnN != null && Number.isFinite(vnN)) o.meta_vendas = vnN
    if (ftN != null && Number.isFinite(ftN)) o.meta_faturamento = ftN
    if (caN != null && Number.isFinite(caN)) o.meta_cash = caN
    return o
  }, [ag, re, cl, vn, ft, ca])

  function setIndivCell(uid: string, key: keyof MetasConfig, value: string) {
    setIndivForm((prev) => ({
      ...prev,
      [uid]: { ...(prev[uid] ?? {}), [key]: value }
    }))
  }

  async function handleSaveMetas(e: React.FormEvent) {
    e.preventDefault()
    if (!podeEditarMetas) {
      showToast('Apenas administradores podem alterar metas', 'err')
      return
    }
    setSaving(true)
    try {
      const builtMap = buildMetasPorUsuarioFromState(indivForm)
      if (isMesAtual) {
        await setMetasConfig({
          meta_reunioes_agendadas: ag ? parseInt(ag, 10) : undefined,
          meta_reunioes_realizadas: re ? parseInt(re, 10) : undefined,
          meta_reunioes_closer: cl ? parseInt(cl, 10) : undefined,
          meta_vendas: vn ? parseInt(vn, 10) : undefined,
          meta_faturamento: ft ? parseFloat(ft.replace(',', '.')) : undefined,
          meta_cash: ca ? parseFloat(ca.replace(',', '.')) : undefined
        })
        await setMetasPorUsuarioRoot(builtMap)
        showToast('Metas do mês atual salvas!')
      } else {
        const patch: Parameters<typeof setMetasPorMes>[1] = {
          meta_reunioes_agendadas: ag ? parseInt(ag, 10) : undefined,
          meta_reunioes_realizadas: re ? parseInt(re, 10) : undefined,
          meta_reunioes_closer: cl ? parseInt(cl, 10) : undefined,
          meta_vendas: vn ? parseInt(vn, 10) : undefined,
          meta_faturamento: ft ? parseFloat(ft.replace(',', '.')) : undefined,
          meta_cash: ca ? parseFloat(ca.replace(',', '.')) : undefined
        }
        await setMetasPorMes(mesAlvo, patch, builtMap)
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
          Metas globais da empresa por mês; pode ainda repartir cotas por SDR e por Closer — a soma das colunas ajuda a
          alinhar com o total global. O mês em curso grava na raiz; outros meses ficam em planejamento sem alterar o atual.
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

              <div
                style={{
                  marginTop: 28,
                  paddingTop: 22,
                  borderTop: '1px solid var(--border)'
                }}
              >
                <h3
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    marginBottom: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  <Users size={17} strokeWidth={1.65} aria-hidden style={{ color: 'var(--accent)' }} />
                  Metas por pessoa (SDR e Closer)
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text2)', margin: '0 0 16px', lineHeight: 1.55 }}>
                  Defina cotas por utilizador; a soma das colunas pode servir de referência para a meta global da empresa
                  acima. Métricas que não fizerem sentido para o papel podem ficar em branco.
                </p>

                {sdrUsers.length === 0 &&
                  closerUsers.length === 0 &&
                  outrosMetaUsers.length === 0 &&
                  unknownUidsComMetas.length === 0 && (
                  <p style={{ fontSize: 13, color: 'var(--text2)' }}>
                    Nenhum utilizador com cargo SDR ou Closer. Crie utilizadores em Configurações → Equipa.
                  </p>
                )}

                {sdrUsers.length > 0 && (
                  <div style={{ marginBottom: 22 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--text2)' }}>
                      Squad SDR
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="config-metas-indiv-table" style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', color: 'var(--text2)' }}>
                            <th style={{ padding: '6px 8px', minWidth: 140 }}>Nome</th>
                            {INDIV_COLS.map((c) => (
                              <th key={c.key} style={{ padding: '6px 4px', minWidth: 72 }} title={c.lb}>
                                {c.short}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sdrUsers.map((u) => (
                            <tr key={u.id}>
                              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{u.nome}</td>
                              {INDIV_COLS.map((c) => (
                                <td key={c.key} style={{ padding: '4px' }}>
                                  <input
                                    type="text"
                                    inputMode={c.money ? 'decimal' : 'numeric'}
                                    className="di"
                                    style={{ width: '100%', minWidth: 0, padding: '6px 8px', fontSize: 12 }}
                                    value={indivForm[u.id]?.[c.key] ?? ''}
                                    onChange={(e) => setIndivCell(u.id, c.key, e.target.value)}
                                    disabled={!podeEditarMetas}
                                    placeholder="—"
                                    aria-label={`${c.lb} · ${u.nome}`}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                          <tr style={{ fontWeight: 700, color: 'var(--text2)', borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px' }}>Soma SDR</td>
                            {INDIV_COLS.map((c) => (
                              <td key={c.key} style={{ padding: '8px 4px' }}>
                                {fmtCmp(sumSdr[c.key])}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {closerUsers.length > 0 && (
                  <div style={{ marginBottom: 22 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--text2)' }}>
                      Squad Closer
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="config-metas-indiv-table" style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', color: 'var(--text2)' }}>
                            <th style={{ padding: '6px 8px', minWidth: 140 }}>Nome</th>
                            {INDIV_COLS.map((c) => (
                              <th key={c.key} style={{ padding: '6px 4px', minWidth: 72 }} title={c.lb}>
                                {c.short}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {closerUsers.map((u) => (
                            <tr key={u.id}>
                              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{u.nome}</td>
                              {INDIV_COLS.map((c) => (
                                <td key={c.key} style={{ padding: '4px' }}>
                                  <input
                                    type="text"
                                    inputMode={c.money ? 'decimal' : 'numeric'}
                                    className="di"
                                    style={{ width: '100%', minWidth: 0, padding: '6px 8px', fontSize: 12 }}
                                    value={indivForm[u.id]?.[c.key] ?? ''}
                                    onChange={(e) => setIndivCell(u.id, c.key, e.target.value)}
                                    disabled={!podeEditarMetas}
                                    placeholder="—"
                                    aria-label={`${c.lb} · ${u.nome}`}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                          <tr style={{ fontWeight: 700, color: 'var(--text2)', borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px' }}>Soma Closer</td>
                            {INDIV_COLS.map((c) => (
                              <td key={c.key} style={{ padding: '8px 4px' }}>
                                {fmtCmp(sumCloser[c.key])}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {outrosMetaUsers.length > 0 && (
                  <div style={{ marginBottom: 22 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--text2)' }}>
                      Outros cargos com metas guardadas
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="config-metas-indiv-table" style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', color: 'var(--text2)' }}>
                            <th style={{ padding: '6px 8px', minWidth: 140 }}>Nome</th>
                            {INDIV_COLS.map((c) => (
                              <th key={c.key} style={{ padding: '6px 4px', minWidth: 72 }} title={c.lb}>
                                {c.short}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {outrosMetaUsers.map((u) => (
                            <tr key={u.id}>
                              <td style={{ padding: '6px 8px', fontWeight: 600 }}>
                                {u.nome}
                                <span style={{ fontWeight: 400, color: 'var(--text3)', marginLeft: 6 }}>({u.cargo})</span>
                              </td>
                              {INDIV_COLS.map((c) => (
                                <td key={c.key} style={{ padding: '4px' }}>
                                  <input
                                    type="text"
                                    inputMode={c.money ? 'decimal' : 'numeric'}
                                    className="di"
                                    style={{ width: '100%', minWidth: 0, padding: '6px 8px', fontSize: 12 }}
                                    value={indivForm[u.id]?.[c.key] ?? ''}
                                    onChange={(e) => setIndivCell(u.id, c.key, e.target.value)}
                                    disabled={!podeEditarMetas}
                                    placeholder="—"
                                    aria-label={`${c.lb} · ${u.nome}`}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {unknownUidsComMetas.length > 0 && (
                  <div style={{ marginBottom: 22 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--text2)' }}>
                      Utilizadores já removidos (apenas limpar ou migrar cotas)
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="config-metas-indiv-table" style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', color: 'var(--text2)' }}>
                            <th style={{ padding: '6px 8px', minWidth: 140 }}>ID</th>
                            {INDIV_COLS.map((c) => (
                              <th key={c.key} style={{ padding: '6px 4px', minWidth: 72 }} title={c.lb}>
                                {c.short}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {unknownUidsComMetas.map((uid) => (
                            <tr key={uid}>
                              <td style={{ padding: '6px 8px', fontWeight: 600, fontSize: 11, wordBreak: 'break-all' }}>
                                {uid}
                              </td>
                              {INDIV_COLS.map((c) => (
                                <td key={c.key} style={{ padding: '4px' }}>
                                  <input
                                    type="text"
                                    inputMode={c.money ? 'decimal' : 'numeric'}
                                    className="di"
                                    style={{ width: '100%', minWidth: 0, padding: '6px 8px', fontSize: 12 }}
                                    value={indivForm[uid]?.[c.key] ?? ''}
                                    onChange={(e) => setIndivCell(uid, c.key, e.target.value)}
                                    disabled={!podeEditarMetas}
                                    placeholder="—"
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {(sdrUsers.length > 0 ||
                  closerUsers.length > 0 ||
                  outrosMetaUsers.length > 0 ||
                  unknownUidsComMetas.length > 0) && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 12,
                      borderRadius: 8,
                      background: 'var(--surface2)',
                      fontSize: 12,
                      lineHeight: 1.6
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Composição vs meta global (valores do formulário)</div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', color: 'var(--text2)' }}>
                            <th style={{ padding: '4px 8px' }}>Indicador</th>
                            <th style={{ padding: '4px 8px' }}>Soma individual</th>
                            <th style={{ padding: '4px 8px' }}>Meta global</th>
                            <th style={{ padding: '4px 8px' }}>Diferença</th>
                          </tr>
                        </thead>
                        <tbody>
                          {INDIV_COLS.map((c) => {
                            const g = globalDraft[c.key]
                            const s = sumTodos[c.key]
                            const hasG = g != null && Number.isFinite(g)
                            const hasS = s != null && Number.isFinite(s)
                            let diffLabel = '—'
                            if (hasG && hasS) {
                              const d = s! - g!
                              diffLabel = d === 0 ? '0' : d > 0 ? `+${fmtCmp(d)}` : fmtCmp(d)
                            }
                            return (
                              <tr key={c.key}>
                                <td style={{ padding: '6px 8px' }}>{c.lb}</td>
                                <td style={{ padding: '6px 8px' }}>{fmtCmp(s)}</td>
                                <td style={{ padding: '6px 8px' }}>{fmtCmp(g)}</td>
                                <td style={{ padding: '6px 8px', fontWeight: 600 }}>{diffLabel}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
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
