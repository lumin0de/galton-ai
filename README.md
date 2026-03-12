# Galton AI

Agente de inteligência de vendas para representantes farmacêuticos da Galderma. Sistema de chat com IA (Claude) que consulta dados de médicos, vendas, dropouts e cross-sell em tempo real.

---

## Índice

- [Estrutura do Sistema](#estrutura-do-sistema)
- [Configurações Necessárias](#configurações-necessárias)
- [Regras de Negócio](#regras-de-negócio)
- [Como Executar](#como-executar)
- [API e Endpoints](#api-e-endpoints)
- [Ferramentas do Agente](#ferramentas-do-agente)
- [Schema do Banco](#schema-do-banco)

---

## Estrutura do Sistema

```
galton-ai/
├── api/                          # Backend Express + TypeScript
│   ├── src/
│   │   ├── db/
│   │   │   ├── supabase.ts       # Cliente Supabase (schema galton)
│   │   │   └── load-bases.ts     # Carga de CSVs → Supabase
│   │   ├── routes/
│   │   │   ├── alerts.ts         # GET /api/alerts (dropouts, cross-sell, planned not purchased)
│   │   │   ├── chat.ts           # POST /api/chat (streaming SSE com Claude)
│   │   │   ├── conversations.ts # CRUD conversas e mensagens
│   │   │   └── dashboard-summary.ts  # GET /api/dashboard-summary (briefing IA)
│   │   ├── skills/               # Persona e regras do agente
│   │   │   ├── agent-persona.md
│   │   │   ├── business-rules.md
│   │   │   ├── frontend-design.md
│   │   │   └── ui-ux-pro-max.md
│   │   ├── tools/                # Ferramentas do agente
│   │   │   ├── getNearActiveAccounts.ts
│   │   │   └── getPlannedNotPurchased.ts
│   │   └── server.ts
│   ├── package.json
│   └── tsconfig.json
│
├── web/                          # Frontend React + Vite + Tailwind
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── pages/
│   │   │   ├── ChatPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   └── LoginPage.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── supabase/
│   └── schema.sql                # Schema galton (tabelas, índices, triggers)
│
├── bases/                        # CSVs para carga (não versionados)
│   ├── painel.csv
│   ├── vendas.csv
│   ├── ativo_positivado.csv
│   ├── cota.csv
│   └── name-map.json             # Mapa de nomes fictícios
│
├── .env                          # Variáveis de ambiente (não versionado)
├── .env.example
├── package.json                  # Monorepo root
└── restart-api.ps1               # Script para reiniciar API (Windows)
```

### Stack

| Camada | Tecnologia |
|--------|------------|
| Backend | Express, TypeScript, Supabase |
| Frontend | React, Vite, Tailwind CSS |
| IA | Anthropic Claude (API) |
| Banco | PostgreSQL (Supabase) |

---

## Configurações Necessárias

### 1. Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto (copie de `.env.example`):

```bash
cp .env.example .env
```

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `SUPABASE_URL` | URL do projeto Supabase (ex: `https://<PROJECT_ID>.supabase.co`) | **Sim** |
| `SUPABASE_ANON_KEY` | Chave anônima (pública) | Não |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service_role (acesso total) — **manter em segredo** | **Sim** |
| `ANTHROPIC_API_KEY` | Chave da API Anthropic (Claude) | **Sim** |
| `PORT` | Porta da API (padrão: 3001) | Não |
| `VITE_API_URL` | URL da API para o frontend (ex: `http://localhost:3001`) | Não (dev usa proxy) |

**Onde obter:**

- **Supabase**: [Dashboard](https://supabase.com/dashboard) → Projeto → Settings → API
- **Anthropic**: [Console](https://console.anthropic.com) → API Keys

### 2. Supabase

1. Crie um projeto no [Supabase](https://supabase.com)
2. Em **Settings → API → Extra schemas**, inclua `galton`
3. No **SQL Editor**, execute o conteúdo de `supabase/schema.sql`

### 3. Arquivos de Dados (bases/)

Coloque os CSVs na pasta `bases/` (não versionada):

| Arquivo | Descrição |
|---------|-----------|
| `painel.csv` | Dados do painel de médicos |
| `vendas.csv` | Histórico de vendas |
| `ativo_positivado.csv` | Status ativo/positivado por período |
| `cota.csv` | Metas de cota |
| `name-map.json` | Mapa de nomes fictícios (opcional) |

---

## Regras de Negócio

### Conta Ativa (janela: últimos 3 meses corridos)

| Produto | Meta (unidades equivalentes) |
|---------|------------------------------|
| Dysport | ≥ 10 |
| Restylane | ≥ 10 |
| Sculptra | ≥ 6 |

**Conta ativa** = atingiu meta em **pelo menos 1** produto.

### Conta Positivada

≥ 1 unidade equivalente de qualquer produto nos últimos 3 meses.

### Segmentação (ordem de prioridade)

**A > B > C > D > E > N/D**

### Dropout

Conta ativa no trimestre anterior **e** não atingiu meta no trimestre atual.

### Cross-sell

Comprou produto **X** mas **nunca** comprou produto **Y** nos últimos 6 meses.

### Trimestres

| Trimestre | Período |
|-----------|---------|
| Q1 | jan–mar |
| Q2 | abr–jun |
| Q3 | jul–set |
| Q4 | out–dez |

### Agrupamento

- Usar **ONE ID** para agrupar médicos do mesmo grupo econômico
- Exibir sempre **ONE NAME** como nome principal do grupo

### Metas de Cota (Q4_2024)

- Metas mensais em `galton.quotas` (mth1, mth2, mth3) por produto
- Território padrão: `BRAX110301MS`

### Regras do Agente (Persona)

- Responder em português brasileiro, direto e objetivo
- Listas em Markdown, agrupadas por segmentação
- **Nunca inventar dados** — usar apenas resultados das ferramentas
- **Nunca reordenar** os dados retornados pelas ferramentas (ordem = prioridade)
- Limite: 5 itens por segmentação, máximo 20 no total
- Uma linha por cliente; nunca múltiplos na mesma linha

---

## Como Executar

### Pré-requisitos

- Node.js (v18+)
- Conta Supabase
- Chave API Anthropic

### Instalação

```bash
npm install
cd api && npm install
cd ../web && npm install
```

### Configuração Inicial

1. Copiar `.env.example` → `.env` e preencher as variáveis
2. Executar `supabase/schema.sql` no Supabase Studio
3. Colocar os CSVs em `bases/`

### Carga de Dados

```bash
npm run load-bases
```

Carrega os CSVs de `bases/` para o schema `galton` no Supabase.

### Desenvolvimento

**Terminal 1 — API:**
```bash
npm run dev:api
```

**Terminal 2 — Web:**
```bash
npm run dev:web
```

- API: `http://localhost:3001`
- Web: `http://localhost:5173` (Vite faz proxy de `/api` para a API)

### Build

```bash
npm run build:api
npm run build:web
```

### Reiniciar API (Windows)

```powershell
.\restart-api.ps1
```

---

## API e Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Health check |
| POST | `/api/chat` | Chat com Claude (streaming SSE) |
| GET | `/api/alerts` | Dropouts, cross-sell, planned not purchased |
| GET | `/api/dashboard-summary` | Briefing executivo gerado por IA |
| GET | `/api/conversations` | Lista conversas |
| POST | `/api/conversations` | Cria conversa |
| PATCH | `/api/conversations/:id` | Atualiza conversa |
| DELETE | `/api/conversations/:id` | Remove conversa |
| GET | `/api/conversations/:id/messages` | Lista mensagens |
| POST | `/api/conversations/:id/messages` | Adiciona mensagem |

---

## Ferramentas do Agente

O chat usa Claude com ferramentas que consultam o Supabase:

| Ferramenta | Descrição |
|------------|-----------|
| `getNearActiveAccounts` | Médicos próximos de virar conta ativa (50–100% da meta), agrupados por segmentação |
| `getPlannedNotPurchased` | Médicos que compraram no trimestre anterior e não compraram no atual |
| `getDropouts` | Contas ativas no trimestre anterior que não atingiram meta no atual |

---

## Schema do Banco

Schema dedicado: `galton`

| Tabela | Descrição |
|--------|-----------|
| `representatives` | Representantes de vendas |
| `doctors` | Médicos/clientes (ONE ID, segmentação) |
| `sales` | Vendas (1 linha por produto/pedido) |
| `quotas` | Metas de cota por representante/produto |
| `active_positivated` | Status ativo/positivado por período |
| `chat_conversations` | Conversas do chat |
| `chat_messages` | Mensagens de cada conversa |

---

## Dependências Principais

**API:** `@anthropic-ai/sdk`, `@supabase/supabase-js`, `express`, `cors`, `dotenv`, `csv-parse`

**Web:** `react`, `react-router-dom`, `axios`, `react-markdown`, `remark-gfm`, `tailwindcss`, `vite`

---

## Arquitetura do Agente (CLAUDE.md)

O projeto segue uma **arquitetura de 4 camadas** para agentes:

- **Camada 0**: Capability Discovery (skills, scripts, diretivas)
- **Camada 1**: Directive Layer (SOPs em Markdown)
- **Camada 2**: Orchestration Layer (decisões do agente)
- **Camada 3**: Execution Layer (scripts determinísticos)

Consulte `CLAUDE.md` para detalhes de operação do agente.
