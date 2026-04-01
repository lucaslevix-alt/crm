import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  getRegistrosByRange,
  getMetasFirestoreDoc,
  listUsers,
  resolveMetasIndividuaisParaMes,
  resolveMetasParaMes,
  type MetasFirestoreDoc,
  type RegistroRow,
  type MetasConfig
} from '../firebase/firestore'
import { formatFirebaseOrUnknownError } from '../lib/firebaseUserFacingError'
import type { CrmUser } from '../store/useAppStore'
import { metaPctParts } from '../utils/metaProgress'

function mRange(mv: string): { start: string; end: string } {
  const [y, m] = mv.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const end = new Date(y, m, 0).toISOString().split('T')[0]
  return { start, end }
}

function totals(recs: RegistroRow[]) {
  return {
    ag: recs.filter((r) => r.tipo === 'reuniao_agendada').length,
    re: recs.filter((r) => r.tipo === 'reuniao_realizada').length,
    cl: recs.filter((r) => r.tipo === 'reuniao_closer').length,
    vn: recs.filter((r) => r.tipo === 'venda').length,
    ft: recs.filter((r) => r.tipo === 'venda').reduce((s, r) => s + (r.valor || 0), 0),
    ca: recs.filter((r) => r.tipo === 'venda').reduce((s, r) => s + (r.cashCollected || 0), 0)
  }
}

const TKEY: Record<keyof MetasConfig, keyof ReturnType<typeof totals>> = {
  meta_reunioes_agendadas: 'ag',
  meta_reunioes_realizadas: 're',
  meta_reunioes_closer: 'cl',
  meta_vendas: 'vn',
  meta_faturamento: 'ft',
  meta_cash: 'ca'
}

function totalsForUser(recs: RegistroRow[], userId: string) {
  const mine = (tipo: string) => recs.filter((r) => r.tipo === tipo && r.userId === userId)
  const vendas = mine('venda')
  return {
    ag: mine('reuniao_agendada').length,
    re: mine('reuniao_realizada').length,
    cl: mine('reuniao_closer').length,
    vn: vendas.length,
    ft: vendas.reduce((s, r) => s + (r.valor || 0), 0),
    ca: vendas.reduce((s, r) => s + (r.cashCollected || 0), 0)
  }
}

function userHasIndivMeta(partial: Partial<MetasConfig> | undefined): boolean {
  if (!partial) return false
  return Object.values(partial).some((v) => typeof v === 'number' && Number.isFinite(v))
}

function fmt(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

const META_ITEMS: Array<{ lb: string; key: keyof MetasConfig; money: boolean }> = [
  { lb: 'Reuniões Agendadas', key: 'meta_reunioes_agendadas', money: false },
  { lb: 'Reuniões Realizadas', key: 'meta_reunioes_realizadas', money: false },
  { lb: 'Reuniões Closer', key: 'meta_reunioes_closer', money: false },
  { lb: 'Vendas', key: 'meta_vendas', money: false },
  { lb: 'Faturamento', key: 'meta_faturamento', money: true },
  { lb: 'Cash Collected', key: 'meta_cash', money: true }
]

function IndivMetaPersonCard({
  titulo,
  subtitulo,
  partial,
  recs,
  userId
}: {
  titulo: string
  subtitulo?: string
  partial: Partial<MetasConfig>
  recs: RegistroRow[]
  userId: string
}) {
  const tu = totalsForUser(recs, userId)
  const linhas = META_ITEMS.filter((it) => {
    const alvo = partial[it.key]
    return typeof alvo === 'number' && Number.isFinite(alvo) && alvo > 0
  })
  if (linhas.length === 0) return null
  return (
    <div className="card" style={{ minWidth: 260, flex: '1 1 280px' }}>
      <div style={{ fontWeight: 700, marginBottom: subtitulo ? 2 : 10 }}>{titulo}</div>
      {subtitulo && <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>{subtitulo}</div>}
      {linhas.map((it) => {
        const alvo = partial[it.key] as number
        const tk = TKEY[it.key]
        const val = Number(tu[tk])
        const mp = metaPctParts(val, alvo)
        return (
          <div key={it.key} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{it.lb}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {it.money ? fmt(val) : String(val)}
              <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--text3)', marginLeft: 8 }}>
                / {it.money ? fmt(alvo) : String(alvo)}
              </span>
            </div>
            <div className="prog-bar" style={{ height: 5, marginTop: 6 }}>
              <div
                className={`prog-fill ${mp.rawPct >= 100 ? 'green' : mp.rawPct >= 70 ? 'orange' : 'amber'}`}
                style={{ width: `${mp.barPct}%` }}
              />
            </div>
            <div style={{ fontSize: 11, marginTop: 4 }}>{mp.labelShort}</div>
          </div>
        )
      })}
    </div>
  )
}

export function MetasPage() {
  const [metaMonth, setMetaMonth] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metas, setMetas] = useState<MetasConfig>({})
  const [metasDoc, setMetasDoc] = useState<MetasFirestoreDoc | null>(null)
  const [recs, setRecs] = useState<RegistroRow[]>([])
  const [users, setUsers] = useState<CrmUser[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const { start, end } = mRange(metaMonth)
    Promise.all([getMetasFirestoreDoc(), getRegistrosByRange(start, end), listUsers()])
      .then(([doc, rows, u]) => {
        if (!cancelled) {
          setMetasDoc(doc)
          setMetas(resolveMetasParaMes(metaMonth, doc))
          setRecs(rows)
          setUsers(u)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(formatFirebaseOrUnknownError(e) || 'Erro ao carregar')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [metaMonth])

  const t = totals(recs)
  const [year, month] = metaMonth.split('-').map(Number)
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  })

  const metasIndividuais = useMemo(
    () => (metasDoc ? resolveMetasIndividuaisParaMes(metaMonth, metasDoc) : {}),
    [metasDoc, metaMonth]
  )

  const sdrComMeta = useMemo(
    () =>
      users
        .filter((u) => u.cargo === 'sdr' && userHasIndivMeta(metasIndividuais[u.id]))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    [users, metasIndividuais]
  )

  const closerComMeta = useMemo(
    () =>
      users
        .filter((u) => u.cargo === 'closer' && userHasIndivMeta(metasIndividuais[u.id]))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    [users, metasIndividuais]
  )

  const outrosComMeta = useMemo(
    () =>
      users
        .filter(
          (u) =>
            u.cargo !== 'sdr' && u.cargo !== 'closer' && userHasIndivMeta(metasIndividuais[u.id])
        )
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    [users, metasIndividuais]
  )

  const orphanIndivUids = useMemo(() => {
    const known = new Set(users.map((u) => u.id))
    return Object.keys(metasIndividuais).filter(
      (uid) => !known.has(uid) && userHasIndivMeta(metasIndividuais[uid])
    )
  }, [users, metasIndividuais])

  const temAlgumaIndiv =
    sdrComMeta.length > 0 ||
    closerComMeta.length > 0 ||
    outrosComMeta.length > 0 ||
    orphanIndivUids.length > 0

  function setMonthToday() {
    const n = new Date()
    setMetaMonth(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="content">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Metas & Histórico</h2>
        <p style={{ color: 'var(--text2)' }}>Consulte o progresso por mês</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>Mês/Ano:</span>
        <input
          type="month"
          value={metaMonth}
          onChange={(e) => setMetaMonth(e.target.value)}
          style={{ width: 180 }}
          className="di"
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={setMonthToday}>
          Mês Atual
        </button>
      </div>

      {loading && (
        <div className="loading">
          <div className="spin" />
          Carregando...
        </div>
      )}
      {error && (
        <div style={{ color: 'var(--red)', padding: 16 }}>Erro: {error}</div>
      )}
      {!loading && !error && (
        <>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarDays size={20} strokeWidth={1.65} aria-hidden style={{ color: 'var(--accent)' }} />
              {monthLabel}
            </h3>
          </div>
          <div className="g2">
            {META_ITEMS.map((it) => {
              const meta = metas[it.key]
              const tKey = TKEY[it.key]
              const val = t[tKey]
              const mp = meta != null && meta > 0 ? metaPctParts(Number(val), meta) : null
              return (
                <div key={it.key} className="card">
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>{it.lb}</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>
                    {it.money ? fmt(Number(val)) : String(val)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    Meta: {meta != null ? (it.money ? fmt(meta) : String(meta)) : '—'}
                  </div>
                  {meta != null && mp != null && (
                    <>
                      <div className="prog-bar" style={{ height: 6, marginTop: 8 }}>
                        <div
                          className={`prog-fill ${mp.rawPct >= 100 ? 'green' : mp.rawPct >= 70 ? 'orange' : 'amber'}`}
                          style={{ width: `${mp.barPct}%` }}
                        />
                      </div>
                      <div style={{ fontSize: 11, marginTop: 4 }} title={mp.superacaoPct != null ? mp.labelLong : undefined}>
                        {mp.labelShort}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {temAlgumaIndiv && (
            <div style={{ marginTop: 32 }}>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 16
                }}
              >
                <Users size={20} strokeWidth={1.65} aria-hidden style={{ color: 'var(--accent)' }} />
                Progresso das metas individuais
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: -8, marginBottom: 16 }}>
                Cotas definidas em Configurações → Metas. Os realizados vêm dos registos atribuídos a cada utilizador.
              </p>

              {sdrComMeta.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>Squad SDR</div>
                  <div className="g2">
                    {sdrComMeta.map((u) => (
                      <IndivMetaPersonCard
                        key={u.id}
                        titulo={u.nome}
                        partial={metasIndividuais[u.id]!}
                        recs={recs}
                        userId={u.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {closerComMeta.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>Squad Closer</div>
                  <div className="g2">
                    {closerComMeta.map((u) => (
                      <IndivMetaPersonCard
                        key={u.id}
                        titulo={u.nome}
                        partial={metasIndividuais[u.id]!}
                        recs={recs}
                        userId={u.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {outrosComMeta.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
                    Outros cargos
                  </div>
                  <div className="g2">
                    {outrosComMeta.map((u) => (
                      <IndivMetaPersonCard
                        key={u.id}
                        titulo={u.nome}
                        subtitulo={u.cargo}
                        partial={metasIndividuais[u.id]!}
                        recs={recs}
                        userId={u.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {orphanIndivUids.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
                    Utilizadores removidos (cotas antigas)
                  </div>
                  <div className="g2">
                    {orphanIndivUids.map((uid) => (
                      <IndivMetaPersonCard
                        key={uid}
                        titulo="Conta não encontrada"
                        subtitulo={uid}
                        partial={metasIndividuais[uid]!}
                        recs={recs}
                        userId={uid}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <Link to="/config/metas" className="btn btn-primary btn-sm">
              Editar Metas
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
