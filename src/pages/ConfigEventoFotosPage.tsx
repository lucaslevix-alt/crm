import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Images, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  addEventoFoto,
  addEventoFotosBatch,
  deleteEventoFoto,
  listEventoFotos,
  updateEventoFoto,
  type EventoFotoRow
} from '../firebase/firestore'
import { parseEventoFotoLinksFromText } from '../lib/eventoFotoLinks'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import {
  isLikelyGoogleDriveUrl,
  resolveGoogleDriveImageUrl,
  resolveGoogleDriveThumbnailUrl
} from '../lib/googleDriveImageUrl'
import { useAppStore } from '../store/useAppStore'

type EventoFotoForm = {
  evento: string
  legenda: string
  link: string
  ativo: boolean
  ordem: string
}

const EMPTY_FORM: EventoFotoForm = {
  evento: '',
  legenda: '',
  link: '',
  ativo: true,
  ordem: '0'
}

export function ConfigEventoFotosPage() {
  const { showToast, currentUser } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<EventoFotoRow[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formMode, setFormMode] = useState<'single' | 'batch'>('batch')
  const [linksBatchText, setLinksBatchText] = useState('')
  const [form, setForm] = useState<EventoFotoForm>({ ...EMPTY_FORM })
  const [previewFailed, setPreviewFailed] = useState(false)
  const [previewThumb, setPreviewThumb] = useState(false)

  const canEdit = currentUser?.cargo === 'admin'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listEventoFotos({ includeInactive: true, limitCount: 200 })
      setRows(data)
    } catch (err) {
      setError(formatFirebaseOrUnknownError(err) || 'Erro ao carregar')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (a.ativo !== b.ativo) return a.ativo ? -1 : 1
      if (b.ordem !== a.ordem) return b.ordem - a.ordem
      return (b.criadoEm?.seconds ?? 0) - (a.criadoEm?.seconds ?? 0)
    })
  }, [rows])

  const activeCount = useMemo(() => rows.filter((r) => r.ativo).length, [rows])
  const batchLinks = useMemo(() => parseEventoFotoLinksFromText(linksBatchText), [linksBatchText])
  const isBatchMode = formMode === 'batch' && !editingId

  const previewSrc = useMemo(() => {
    const link = form.link.trim()
    if (!link) return ''
    if (previewThumb) return resolveGoogleDriveThumbnailUrl(link, 400)
    return resolveGoogleDriveImageUrl(link)
  }, [form.link, previewThumb])

  useEffect(() => {
    setPreviewFailed(false)
    setPreviewThumb(false)
  }, [form.link])

  function startNew() {
    setEditingId(null)
    setFormMode('batch')
    setLinksBatchText('')
    setForm({ ...EMPTY_FORM })
    setPreviewFailed(false)
    setPreviewThumb(false)
  }

  function startEdit(r: EventoFotoRow) {
    setFormMode('single')
    setLinksBatchText('')
    setEditingId(r.id)
    setForm({
      evento: r.evento,
      legenda: r.legenda,
      link: r.link,
      ativo: r.ativo,
      ordem: String(r.ordem)
    })
    setPreviewFailed(false)
    setPreviewThumb(false)
  }

  async function handleSave() {
    if (!canEdit) return
    const ordem = parseInt(form.ordem.replace(/\D/g, ''), 10)
    const ordemNum = Number.isFinite(ordem) ? ordem : 0
    setBusy(true)
    try {
      const uid = currentUser?.id ?? ''
      const nome = currentUser?.nome ?? 'Admin'
      if (!uid) throw new Error('Utilizador inválido.')

      if (editingId) {
        await updateEventoFoto(editingId, {
          evento: form.evento,
          legenda: form.legenda,
          link: form.link,
          ativo: form.ativo,
          ordem: ordemNum
        })
        showToast('Foto atualizada.')
      } else if (isBatchMode) {
        if (!batchLinks.length) {
          showToast('Cole pelo menos um link (um por linha).', 'err')
          return
        }
        const { created, failed } = await addEventoFotosBatch({
          evento: form.evento,
          legenda: form.legenda,
          links: batchLinks,
          ativo: form.ativo,
          ordemBase: ordemNum,
          criadoPor: { id: uid, nome }
        })
        if (failed.length) {
          showToast(
            `${created} foto(s) criada(s). ${failed.length} falhou(aram).`,
            created > 0 ? undefined : 'err'
          )
        } else {
          showToast(`${created} foto(s) adicionada(s) ao telão.`)
        }
        setLinksBatchText('')
      } else {
        await addEventoFoto({
          evento: form.evento,
          legenda: form.legenda,
          link: form.link,
          ativo: form.ativo,
          ordem: ordemNum,
          criadoPor: { id: uid, nome }
        })
        showToast('Foto adicionada.')
        startNew()
      }
      if (editingId) startNew()
      await load()
    } catch (err) {
      showToast(formatFirebaseOrUnknownError(err) || 'Erro ao salvar', 'err')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    if (!canEdit) return
    if (!window.confirm('Apagar esta foto do telão?')) return
    setBusy(true)
    try {
      await deleteEventoFoto(id)
      showToast('Foto apagada.')
      if (editingId === id) startNew()
      await load()
    } catch (err) {
      showToast(formatFirebaseOrUnknownError(err) || 'Erro ao apagar', 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="content">
      <div style={{ marginBottom: 20 }}>
        <Link to="/config" className="config-sub-back">
          ← Configurações
        </Link>
        <h2 className="page-title-row" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, marginTop: 10 }}>
          <Images size={24} strokeWidth={1.65} aria-hidden />
          Fotos dos eventos
        </h2>
        <p style={{ color: 'var(--text2)' }}>
          Fotos dos eventos LVX para o telão interno (modo TV). Use <b>Vários links</b> para colar dezenas de
          URLs do Google Drive de uma vez (um por linha). Ativas agora: <b>{activeCount}</b>.
        </p>
        <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 8 }}>
          No Drive: clique com o botão direito no ficheiro → Partilhar → Acesso geral → Copiar link.
          Intervalo de troca em <Link to="/config/tv">Configurações → TV</Link>.
        </p>
      </div>

      <div className="card mb" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="card-title">
            {editingId ? 'Editar foto' : isBatchMode ? 'Adicionar em lote' : 'Nova foto'}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={startNew} disabled={busy}>
              <Plus size={16} strokeWidth={1.65} aria-hidden /> Novo
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={busy || !canEdit || (isBatchMode && batchLinks.length === 0)}
            >
              {isBatchMode ? `Adicionar ${batchLinks.length || ''} foto(s)`.trim() : 'Salvar'}
            </button>
          </div>
        </div>
        <div style={{ padding: '0 14px 10px' }}>
          {!editingId && (
            <div className="ctrl-row" style={{ flexWrap: 'wrap', gap: 8, margin: 0 }}>
              <span className="ctrl-label">Modo:</span>
              <button
                type="button"
                className={`prd-btn ${formMode === 'batch' ? 'active' : ''}`}
                disabled={busy}
                onClick={() => setFormMode('batch')}
              >
                Vários links
              </button>
              <button
                type="button"
                className={`prd-btn ${formMode === 'single' ? 'active' : ''}`}
                disabled={busy}
                onClick={() => setFormMode('single')}
              >
                Uma foto
              </button>
            </div>
          )}
        </div>
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 10 }}>
          <label style={{ gridColumn: 'span 6', display: 'grid', gap: 6, fontSize: 13 }}>
            Evento
            <input
              className="di"
              value={form.evento}
              disabled={busy || !canEdit}
              placeholder="Ex.: LVX Summit — Maio 2026"
              onChange={(e) => setForm((p) => ({ ...p, evento: e.target.value }))}
            />
          </label>
          <label style={{ gridColumn: 'span 3', display: 'grid', gap: 6, fontSize: 13 }}>
            Ordem no telão
            <input
              className="di"
              inputMode="numeric"
              value={form.ordem}
              disabled={busy || !canEdit}
              placeholder="0"
              onChange={(e) => setForm((p) => ({ ...p, ordem: e.target.value }))}
            />
            <span style={{ color: 'var(--text3)', fontSize: 12 }}>Maior número = aparece primeiro.</span>
          </label>
          <label style={{ gridColumn: 'span 3', display: 'grid', gap: 6, fontSize: 13, alignContent: 'end' }}>
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={form.ativo}
                disabled={busy || !canEdit}
                onChange={(e) => setForm((p) => ({ ...p, ativo: e.target.checked }))}
              />
              Ativa no telão
            </span>
          </label>

          <label style={{ gridColumn: 'span 12', display: 'grid', gap: 6, fontSize: 13 }}>
            Legenda (opcional)
            <input
              className="di"
              value={form.legenda}
              disabled={busy || !canEdit}
              placeholder="Ex.: Equipe comercial 2026"
              onChange={(e) => setForm((p) => ({ ...p, legenda: e.target.value }))}
            />
          </label>

          {isBatchMode ? (
            <label style={{ gridColumn: 'span 12', display: 'grid', gap: 6, fontSize: 13 }}>
              Links das fotos (um por linha)
              <textarea
                className="di"
                rows={10}
                value={linksBatchText}
                disabled={busy || !canEdit}
                placeholder={
                  'Cole vários links do Google Drive, um em cada linha:\n\nhttps://drive.google.com/file/d/...\nhttps://drive.google.com/file/d/...'
                }
                onChange={(e) => setLinksBatchText(e.target.value)}
              />
              <span style={{ color: 'var(--text3)', fontSize: 12 }}>
                {batchLinks.length > 0
                  ? `${batchLinks.length} link(s) válido(s). A primeira linha aparece primeiro no telão (ordem mais alta).`
                  : 'Linhas vazias e duplicados são ignorados. Cada linha deve começar com http:// ou https://'}
              </span>
            </label>
          ) : (
            <label style={{ gridColumn: 'span 12', display: 'grid', gap: 6, fontSize: 13 }}>
              Link da foto (Google Drive)
              <input
                className="di"
                value={form.link}
                disabled={busy || !canEdit}
                placeholder="https://drive.google.com/file/d/..."
                onChange={(e) => setForm((p) => ({ ...p, link: e.target.value }))}
              />
              {form.link.trim() && !isLikelyGoogleDriveUrl(form.link) && (
                <span style={{ color: 'var(--amber)', fontSize: 12 }}>
                  Este link não parece ser do Google Drive; URLs diretas de imagem também funcionam se forem públicas.
                </span>
              )}
            </label>
          )}

          {!isBatchMode && previewSrc && !previewFailed && (
            <div style={{ gridColumn: 'span 12' }}>
              <img
                src={previewSrc}
                alt="Pré-visualização"
                className="evento-foto-preview"
                onError={() => {
                  if (!previewThumb) {
                    setPreviewThumb(true)
                  } else {
                    setPreviewFailed(true)
                  }
                }}
              />
            </div>
          )}
          {!isBatchMode && previewFailed && (
            <div style={{ gridColumn: 'span 12', color: 'var(--red)', fontSize: 13 }}>
              Não foi possível pré-visualizar. Confirme que o ficheiro está partilhado como &quot;Qualquer pessoa com o
              link&quot; e que o URL está correto.
            </div>
          )}

          {!canEdit && (
            <div style={{ gridColumn: 'span 12', color: 'var(--text3)', fontSize: 12 }}>
              Apenas admin pode editar.
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Galeria cadastrada</span>
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
            <table className="rank-perf-table" style={{ width: '100%', minWidth: 880, fontSize: 13 }}>
              <thead>
                <tr>
                  <th className="rank-perf-th">Prévia</th>
                  <th className="rank-perf-th">Status</th>
                  <th className="rank-perf-th rank-perf-th--num">Ordem</th>
                  <th className="rank-perf-th">Evento</th>
                  <th className="rank-perf-th">Link</th>
                  <th className="rank-perf-th rank-perf-th--num">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <EventoFotoTableRow
                    key={r.id}
                    row={r}
                    busy={busy}
                    canEdit={canEdit}
                    onEdit={() => startEdit(r)}
                    onDelete={() => handleDelete(r.id)}
                  />
                ))}
              </tbody>
            </table>
            {!sorted.length && (
              <div className="empty" style={{ padding: 20 }}>
                <p>Nenhuma foto cadastrada.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function EventoFotoTableRow({
  row,
  busy,
  canEdit,
  onEdit,
  onDelete
}: {
  row: EventoFotoRow
  busy: boolean
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const [src, setSrc] = useState(() => resolveGoogleDriveImageUrl(row.link))
  const [thumb, setThumb] = useState(false)

  return (
    <tr>
      <td className="rank-perf-td">
        {src ? (
          <img
            src={src}
            alt=""
            className="evento-foto-thumb"
            onError={() => {
              if (!thumb) {
                setThumb(true)
                setSrc(resolveGoogleDriveThumbnailUrl(row.link, 200))
              } else {
                setSrc('')
              }
            }}
          />
        ) : (
          '—'
        )}
      </td>
      <td className="rank-perf-td" style={{ fontWeight: 700 }}>
        {row.ativo ? 'ATIVA' : 'INATIVA'}
      </td>
      <td className="rank-perf-td rank-perf-td--num">{row.ordem}</td>
      <td className="rank-perf-td">
        <div style={{ fontWeight: 700 }}>{row.evento || '—'}</div>
        {row.legenda ? (
          <div style={{ color: 'var(--text2)', fontSize: 12, marginTop: 4 }}>{row.legenda}</div>
        ) : null}
      </td>
      <td className="rank-perf-td" style={{ maxWidth: 280, fontSize: 11, wordBreak: 'break-all' }}>
        <a href={row.link} target="_blank" rel="noopener noreferrer">
          {row.link}
        </a>
      </td>
      <td className="rank-perf-td rank-perf-td--num">
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy || !canEdit} onClick={onEdit}>
            <Pencil size={16} strokeWidth={1.65} aria-hidden />
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy || !canEdit} onClick={onDelete}>
            <Trash2 size={16} strokeWidth={1.65} aria-hidden />
          </button>
        </div>
      </td>
    </tr>
  )
}
