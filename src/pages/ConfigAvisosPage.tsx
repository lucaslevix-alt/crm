import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Megaphone, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  addAviso,
  deleteAviso,
  isAvisoAtivoAgora,
  listAvisosRecentes,
  setAvisoFotoUrl,
  uploadAvisoFoto,
  updateAviso,
  type AvisoPrioridade,
  type AvisoRow,
  type AvisoTipo
} from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import { useAppStore } from '../store/useAppStore'

type AvisoForm = {
  tipo: AvisoTipo
  prioridade: AvisoPrioridade
  titulo: string
  mensagem: string
  ativo: boolean
  fixo: boolean
  expiraEm: string
}

function prioridadeLabel(p: AvisoPrioridade): string {
  if (p === 'urgente') return 'Urgente'
  if (p === 'alta') return 'Alta'
  return 'Normal'
}

function tipoLabel(t: AvisoTipo): string {
  if (t === 'comunicado') return 'Comunicado'
  if (t === 'operacao') return 'Operação'
  return 'Recado'
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocalValue(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  const d = new Date(s)
  if (!Number.isFinite(d.getTime())) return null
  return d.toISOString()
}

const EMPTY_FORM: AvisoForm = {
  tipo: 'recado',
  prioridade: 'normal',
  titulo: '',
  mensagem: '',
  ativo: true,
  fixo: false,
  expiraEm: ''
}

export function ConfigAvisosPage() {
  const { showToast, currentUser } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<AvisoRow[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AvisoForm>({ ...EMPTY_FORM })
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState<string | null>(null)
  const [removeFoto, setRemoveFoto] = useState(false)

  const canEdit = currentUser?.cargo === 'admin'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listAvisosRecentes({ includeInactive: true, limitCount: 150 })
      setRows(data)
    } catch (err) {
      const msg = formatFirebaseOrUnknownError(err) || 'Erro ao carregar'
      setError(msg)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const sorted = useMemo(() => {
    const now = new Date()
    const prW = (p: AvisoPrioridade) => (p === 'urgente' ? 3 : p === 'alta' ? 2 : 1)
    return [...rows].sort((a, b) => {
      const aa = isAvisoAtivoAgora(a, now)
      const bb = isAvisoAtivoAgora(b, now)
      if (aa !== bb) return aa ? -1 : 1
      if (a.fixo !== b.fixo) return a.fixo ? -1 : 1
      const pw = prW(b.prioridade) - prW(a.prioridade)
      if (pw) return pw
      const ta = a.criadoEm?.seconds ?? 0
      const tb = b.criadoEm?.seconds ?? 0
      return tb - ta || b.id.localeCompare(a.id)
    })
  }, [rows])

  function startNew() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setFotoFile(null)
    setRemoveFoto(false)
  }

  function startEdit(r: AvisoRow) {
    setEditingId(r.id)
    setForm({
      tipo: r.tipo,
      prioridade: r.prioridade,
      titulo: r.titulo,
      mensagem: r.mensagem,
      ativo: r.ativo,
      fixo: r.fixo,
      expiraEm: toDatetimeLocalValue(r.expiraEm)
    })
    setFotoFile(null)
    setRemoveFoto(false)
  }

  useEffect(() => {
    if (!fotoFile) {
      if (fotoPreviewUrl) URL.revokeObjectURL(fotoPreviewUrl)
      setFotoPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(fotoFile)
    setFotoPreviewUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotoFile])

  async function handleSave() {
    if (!canEdit) return
    setBusy(true)
    try {
      const expIso = fromDatetimeLocalValue(form.expiraEm)
      const payload = {
        tipo: form.tipo,
        prioridade: form.prioridade,
        titulo: form.titulo,
        mensagem: form.mensagem,
        ativo: form.ativo,
        fixo: form.fixo,
        expiraEm: expIso
      }
      if (editingId) {
        await updateAviso(editingId, payload)
        if (removeFoto) {
          await setAvisoFotoUrl(editingId, null)
        }
        if (fotoFile) {
          setUploadingFoto(true)
          const url = await uploadAvisoFoto({ avisoId: editingId, file: fotoFile })
          await setAvisoFotoUrl(editingId, url)
        }
        showToast('Aviso atualizado.')
      } else {
        const uid = currentUser?.id ?? ''
        const nome = currentUser?.nome ?? 'Admin'
        if (!uid) throw new Error('Utilizador inválido.')
        const id = await addAviso({ ...payload, criadoPor: { id: uid, nome } })
        if (fotoFile) {
          setUploadingFoto(true)
          const url = await uploadAvisoFoto({ avisoId: id, file: fotoFile })
          await setAvisoFotoUrl(id, url)
        }
        showToast('Aviso criado.')
      }
      startNew()
      await load()
    } catch (err) {
      showToast(formatFirebaseOrUnknownError(err) || 'Erro ao salvar', 'err')
    } finally {
      setBusy(false)
      setUploadingFoto(false)
    }
  }

  async function handleDelete(id: string) {
    if (!canEdit) return
    if (!window.confirm('Apagar este aviso?')) return
    setBusy(true)
    try {
      await deleteAviso(id)
      showToast('Aviso apagado.')
      if (editingId === id) startNew()
      await load()
    } catch (err) {
      showToast(formatFirebaseOrUnknownError(err) || 'Erro ao apagar', 'err')
    } finally {
      setBusy(false)
    }
  }

  const activeNowCount = useMemo(() => sorted.filter((r) => isAvisoAtivoAgora(r)).length, [sorted])
  const editingRow = useMemo(() => (editingId ? rows.find((r) => r.id === editingId) ?? null : null), [editingId, rows])

  return (
    <div className="content">
      <div style={{ marginBottom: 20 }}>
        <Link to="/config" className="config-sub-back">
          ← Configurações
        </Link>
        <h2 className="page-title-row" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, marginTop: 10 }}>
          <Megaphone size={24} strokeWidth={1.65} aria-hidden />
          Avisos
        </h2>
        <p style={{ color: 'var(--text2)' }}>
          Recados rápidos e comunicados que aparecem no modo TV da Classificação. Ativos agora: <b>{activeNowCount}</b>.
        </p>
      </div>

      <div className="card mb" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="card-title">{editingId ? 'Editar aviso' : 'Novo aviso'}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={startNew} disabled={busy}>
              <Plus size={16} strokeWidth={1.65} aria-hidden /> Novo
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={busy || uploadingFoto || !canEdit}
            >
              Salvar
            </button>
          </div>
        </div>
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 10 }}>
          <label style={{ gridColumn: 'span 3', display: 'grid', gap: 6, fontSize: 13 }}>
            Tipo
            <select
              className="di"
              value={form.tipo}
              disabled={busy || !canEdit}
              onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value as AvisoTipo }))}
            >
              <option value="recado">Recado</option>
              <option value="comunicado">Comunicado</option>
              <option value="operacao">Operação</option>
            </select>
          </label>
          <label style={{ gridColumn: 'span 3', display: 'grid', gap: 6, fontSize: 13 }}>
            Prioridade
            <select
              className="di"
              value={form.prioridade}
              disabled={busy || !canEdit}
              onChange={(e) => setForm((p) => ({ ...p, prioridade: e.target.value as AvisoPrioridade }))}
            >
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </label>
          <label style={{ gridColumn: 'span 6', display: 'grid', gap: 6, fontSize: 13 }}>
            Expira em (opcional)
            <input
              className="di"
              type="datetime-local"
              value={form.expiraEm}
              disabled={busy || !canEdit}
              onChange={(e) => setForm((p) => ({ ...p, expiraEm: e.target.value }))}
            />
          </label>

          <label style={{ gridColumn: 'span 12', display: 'grid', gap: 6, fontSize: 13 }}>
            Título (curto)
            <input
              className="di"
              value={form.titulo}
              disabled={busy || !canEdit}
              placeholder="Ex.: Reunião geral às 10:30"
              onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
            />
          </label>

          <label style={{ gridColumn: 'span 12', display: 'grid', gap: 6, fontSize: 13 }}>
            Mensagem
            <textarea
              className="di"
              value={form.mensagem}
              disabled={busy || !canEdit}
              rows={4}
              placeholder="Mensagem que vai para o ticker / destaque no modo TV."
              onChange={(e) => setForm((p) => ({ ...p, mensagem: e.target.value }))}
            />
          </label>

          <div style={{ gridColumn: 'span 12', display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                Foto (opcional)
                <input
                  type="file"
                  accept="image/*"
                  disabled={busy || uploadingFoto || !canEdit}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null
                    setFotoFile(f)
                    setRemoveFoto(false)
                  }}
                />
              </label>
              {editingRow?.fotoUrl && (
                <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={removeFoto}
                    disabled={busy || uploadingFoto || !canEdit}
                    onChange={(e) => setRemoveFoto(e.target.checked)}
                  />
                  Remover foto atual
                </label>
              )}
              {uploadingFoto && <span style={{ color: 'var(--text3)', fontSize: 12 }}>A enviar foto…</span>}
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {(fotoPreviewUrl || editingRow?.fotoUrl) && (
                <img
                  src={fotoPreviewUrl ?? editingRow?.fotoUrl ?? ''}
                  alt=""
                  style={{
                    width: 84,
                    height: 84,
                    objectFit: 'cover',
                    borderRadius: 12,
                    border: '1px solid var(--border)'
                  }}
                />
              )}
              <div style={{ color: 'var(--text3)', fontSize: 12, maxWidth: 560 }}>
                Sugestão: use para <b>Aniversariante</b> e <b>Novos colaboradores</b>. Limite: <b>3MB</b>.
              </div>
            </div>
          </div>

          <div style={{ gridColumn: 'span 12', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={form.ativo}
                disabled={busy || !canEdit}
                onChange={(e) => setForm((p) => ({ ...p, ativo: e.target.checked }))}
              />
              Ativo
            </label>
            <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={form.fixo}
                disabled={busy || !canEdit}
                onChange={(e) => setForm((p) => ({ ...p, fixo: e.target.checked }))}
              />
              Fixo (sempre no topo)
            </label>
            {!canEdit && <span style={{ color: 'var(--text3)', fontSize: 12 }}>Apenas admin pode editar.</span>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Histórico</span>
        </div>
        {loading && (
          <div className="loading" style={{ padding: 24 }}>
            <div className="spin" /> Carregando...
          </div>
        )}
        {error && (
          <div className="empty">
            <p>{error}</p>
          </div>
        )}
        {!loading && !error && (
          <div style={{ overflowX: 'auto' }}>
            <table className="rank-perf-table" style={{ width: '100%', minWidth: 920, fontSize: 13 }}>
              <thead>
                <tr>
                  <th className="rank-perf-th">Foto</th>
                  <th className="rank-perf-th">Status</th>
                  <th className="rank-perf-th">Tipo</th>
                  <th className="rank-perf-th">Prioridade</th>
                  <th className="rank-perf-th">Título</th>
                  <th className="rank-perf-th">Expira</th>
                  <th className="rank-perf-th">Criado por</th>
                  <th className="rank-perf-th rank-perf-th--num">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const ativoAgora = isAvisoAtivoAgora(r)
                  return (
                    <tr key={r.id}>
                      <td className="rank-perf-td">
                        {r.fotoUrl ? (
                          <img
                            src={r.fotoUrl}
                            alt=""
                            style={{
                              width: 40,
                              height: 40,
                              objectFit: 'cover',
                              borderRadius: 10,
                              border: '1px solid var(--border)'
                            }}
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="rank-perf-td" style={{ fontWeight: 700 }}>
                        {ativoAgora ? 'ATIVO' : r.ativo ? 'EXPIRADO' : 'DESATIV.'}
                        {r.fixo ? ' • FIXO' : ''}
                      </td>
                      <td className="rank-perf-td">{tipoLabel(r.tipo)}</td>
                      <td className="rank-perf-td">{prioridadeLabel(r.prioridade)}</td>
                      <td className="rank-perf-td" style={{ maxWidth: 420 }}>
                        <div style={{ fontWeight: 700 }}>{r.titulo || '—'}</div>
                        <div style={{ color: 'var(--text2)', fontSize: 12, marginTop: 4, whiteSpace: 'pre-wrap' }}>
                          {r.mensagem}
                        </div>
                      </td>
                      <td className="rank-perf-td">
                        {r.expiraEm ? new Date(r.expiraEm).toLocaleString('pt-BR') : '—'}
                      </td>
                      <td className="rank-perf-td">{r.criadoPorNome || '—'}</td>
                      <td className="rank-perf-td rank-perf-td--num">
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busy || !canEdit}
                            onClick={() => startEdit(r)}
                            title="Editar"
                          >
                            <Pencil size={16} strokeWidth={1.65} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busy || !canEdit}
                            onClick={() => handleDelete(r.id)}
                            title="Apagar"
                          >
                            <Trash2 size={16} strokeWidth={1.65} aria-hidden />
                          </button>
                        </div>
                      </td>
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

