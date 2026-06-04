# CRM LVX (Comercial)

Aplicação web para registos comerciais, agenda de reuniões, classificações (SDR, Closer, Squads, GTs, TV) e configuração administrativa.

## Requisitos

- Node.js 20+
- Projeto Firebase (Auth + Firestore)
- Conta Netlify (deploy do frontend) ou `npm run preview` local

## Configuração local

1. Copie o exemplo de variáveis:

```bash
cp .env.example .env
```

2. Preencha no `.env`:

| Variável | Obrigatório | Uso |
|----------|-------------|-----|
| `VITE_FIREBASE_API_KEY` | Sim | Firebase Web |
| `VITE_FIREBASE_AUTH_DOMAIN` | Sim | Login |
| `VITE_FIREBASE_PROJECT_ID` | Sim | Firestore |
| `VITE_FIREBASE_STORAGE_BUCKET` | Não | Storage (opcional) |
| `VITE_META_ADS_ACCESS_TOKEN` | Não | Só dev; produção usa modal Meta Ads |
| `VITE_N8N_WEBHOOK_AGENDAMENTO` | Não | Webhook ao agendar reunião (SDR) |
| `VITE_GOOGLE_CALENDAR_DEFAULT_GUESTS` | Não | Convidados extra no Google Calendar |

3. Instale e arranque:

```bash
npm install
npm run dev
```

Abra http://localhost:5173 — login com utilizador criado em **Firebase Authentication** e documento correspondente em `usuarios/{id}`.

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento (Vite) |
| `npm run build` | Build de produção → `dist/` |
| `npm run lint` | ESLint |
| `npm run preview` | Pré-visualizar build |
| `npm run firebase:deploy:rules` | Publicar regras Firestore |
| `npm run firebase:deploy:hosting` | Hosting Firebase (se usar) |

## Rotas principais

| Rota | Quem | Função |
|------|------|--------|
| `/dashboard` | Todos | Painel |
| `/registros` | Comercial | Lançamentos |
| `/agenda` | SDR, Closer, Admin | Reuniões e desfechos |
| `/rankings/*` | Todos | Classificações e TV |
| `/metas` | Todos | Metas da equipa |
| `/meta-ads` | Comercial | Campanhas Meta |
| `/config` | Admin (+ produtos para SDR/Closer) | Metas, GTs, avisos, utilizadores, etc. |
| `/auditoria` | Admin | Histórico de alterações |

## Firestore (resumo)

| Coleção / doc | Uso |
|---------------|-----|
| `usuarios` | Perfis e cargos (`admin`, `sdr`, `closer`, `gt`) |
| `registros` | Vendas, reuniões, leads SDR |
| `agendamentos` | Pipeline agenda ↔ registos |
| `squads` / `config/squads_operacao` | Equipas e bónus operacional |
| `produtos` | Catálogo e linhas de preço |
| `config/metas` | Metas globais e por squad |
| `config/gts_vendas_atual` | Disputa de vendas GT |
| `config/base_clientes_operacao` | Base de clientes (admin) |
| `avisos`, `evento_fotos`, `config/tv_timers` | Modo TV |

Código Firestore modularizado em `src/firebase/` (ver `src/firebase/README.md`).

## Deploy (Netlify)

1. Build command: `npm run build`
2. Publish directory: `dist`
3. Defina as variáveis `VITE_*` no painel Netlify
4. SPA: redirect `/*` → `/index.html` (já em `netlify.toml`)

## Firebase Functions

O pacote em `functions/` está reservado para extensões futuras. A app usa **token Meta no browser** (`src/lib/meta-ads.ts`), não Cloud Functions para Meta.
