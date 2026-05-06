import { Factory } from 'lucide-react'
import { RankingOperacaoPage } from './RankingOperacaoPage'

export function OperacaoPage() {
  return (
    <div className="content">
      <div style={{ marginBottom: 20 }}>
        <h2 className="page-title-row" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
          <Factory size={24} strokeWidth={1.65} aria-hidden />
          Operação
        </h2>
        <p style={{ color: 'var(--text2)', marginBottom: 0 }}>
          Disputa dos squads operacionais pelo saldo de bônus. O ranking ordena quem ainda mantém mais valor; abatimentos são
          feitos em Configurações → Gestão OP.
        </p>
      </div>
      <RankingOperacaoPage />
    </div>
  )
}
