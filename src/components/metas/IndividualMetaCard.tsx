import type { MetasConfig, RegistroRow } from '../../firebase/firestore'
import { contaParaComissao } from '../../lib/registroComissao'
import { metaPctParts } from '../../utils/metaProgress'

export const META_ITEMS: Array<{ lb: string; key: keyof MetasConfig; money: boolean }> = [
  { lb: 'Reuniões Agendadas', key: 'meta_reunioes_agendadas', money: false },
  { lb: 'Reuniões Realizadas', key: 'meta_reunioes_realizadas', money: false },
  { lb: 'Reuniões Closer', key: 'meta_reunioes_closer', money: false },
  { lb: 'Vendas', key: 'meta_vendas', money: false },
  { lb: 'Faturamento', key: 'meta_faturamento', money: true },
  { lb: 'Cash Collected', key: 'meta_cash', money: true }
]

export const TKEY: Record<keyof MetasConfig, 'ag' | 're' | 'cl' | 'vn' | 'ft' | 'ca'> = {
  meta_reunioes_agendadas: 'ag',
  meta_reunioes_realizadas: 're',
  meta_reunioes_closer: 'cl',
  meta_vendas: 'vn',
  meta_faturamento: 'ft',
  meta_cash: 'ca'
}

export type MetaTally = { ag: number; re: number; cl: number; vn: number; ft: number; ca: number }

export function formatMetaBrl(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

export function totalsForUser(recs: RegistroRow[], userId: string): MetaTally {
  const mine = (tipo: string) =>
    recs.filter((r) => contaParaComissao(r) && r.tipo === tipo && r.userId === userId)
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

export function totalsForUserIds(recs: RegistroRow[], userIds: Set<string>): MetaTally {
  const mine = (tipo: string) =>
    recs.filter((r) => contaParaComissao(r) && r.tipo === tipo && userIds.has(r.userId))
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

export function userHasIndivMeta(partial: Partial<MetasConfig> | undefined): boolean {
  if (!partial) return false
  return Object.values(partial).some((v) => typeof v === 'number' && Number.isFinite(v))
}

function MetaLinesCard({
  titulo,
  subtitulo,
  partial,
  tu
}: {
  titulo: string
  subtitulo?: string
  partial: Partial<MetasConfig>
  tu: MetaTally
}) {
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
              {it.money ? formatMetaBrl(val) : String(val)}
              <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--text3)', marginLeft: 8 }}>
                / {it.money ? formatMetaBrl(alvo) : String(alvo)}
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

export function IndivMetaPersonCard({
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
  return <MetaLinesCard titulo={titulo} subtitulo={subtitulo} partial={partial} tu={tu} />
}

export function SquadMetaAggregateCard({
  titulo,
  subtitulo,
  partial,
  recs,
  memberIds
}: {
  titulo: string
  subtitulo?: string
  partial: Partial<MetasConfig>
  recs: RegistroRow[]
  memberIds: string[]
}) {
  const tu = totalsForUserIds(recs, new Set(memberIds))
  return <MetaLinesCard titulo={titulo} subtitulo={subtitulo} partial={partial} tu={tu} />
}
