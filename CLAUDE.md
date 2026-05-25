# CLAUDE.md — V3 Partners · Plataforma Unificada
> Compartilhado entre João (jlemo) e Hamilton (hamiltonsantosinvestimentos-cmyk)
> Atualizado em: 16/05/2026

---

## PROJETO — v3-partner

**Repositório:** https://github.com/hamiltonsantosinvestimentos-cmyk/v3-partner
**Stack:** Next.js 16 · TypeScript · Tailwind CSS v4 · Supabase · Anthropic SDK
**Propósito:** Plataforma SaaS interna V3 Partners — gestão de partners, operações, M&A, crédito, split fiscal, academy e IA

**Colaboradores:**
- Hamilton Santos — `hamiltonsantosinvestimentos-cmyk` — Financeiro / Cross-border / Dev principal
- João Lemos Netto — `Jlnetto35` — Originação / Head de Ativos

---

## EMPRESA — V3 PARTNERS

**Razão Social:** V3 Partners Soluções Ltda
**CNPJ:** 14.219.287/0001-50
**Site:** v3partners.com.br
**Posicionamento:** Boutique institucional multiproduto de securitização e estruturação financeira.

**Sócios (33,33% cada):**
- João Lemos Netto — Originação
- Hamilton Santos — Financeiro / Cross-border
- Robson Lino — Compliance / Operações

**Infraestrutura:** White Label Bloxs S.A. (tokenização, KYC, liquidação OTC/cripto 24/7)

**4 Verticais de Receita:**
1. Securitização de Crédito e Recebíveis Judiciais — CGI, precatórios, CRI, FIDC
2. Real Estate Estruturado — SLB, BTS, BTR
3. Mineração, Metais Preciosos e Commodities — lítio, ouro, cross-border
4. M&A e Negócios Cross-Border — fundos asiáticos e americanos

**Rede de Partners:**
- V3 Partner R$197/mês → role `PARTNER` → 30% comissionamento
- V3 Partner PRO R$397/mês → role `PARTNER_PRO` → 50% + co-branding

---

## IDENTIDADE VISUAL — OBRIGATÓRIO EM TODOS OS COMPONENTES

### Paleta de Cores (Brandbook V2.0 aprovado pelos 3 sócios)
| Nome | Hex | Uso |
|---|---|---|
| Navy Profundo | `#09081A` | Fundo principal, body, sidebar |
| Navy Base | `#111F35` | Páginas internas, input, muted |
| Navy Card | `#162744` | Cards, popovers, borders |
| Navy Médio | `#243A66` | Hover, accent, scrollbar |
| Ouro V3 | `#C9A84C` | Primary, ring, labels, logo |
| Ouro Claro | `#E8C97A` | Destaque secundário, gradients |
| Cream | `#F0ECE4` | Títulos, texto primário, foreground |
| Muted | `#7A8FA8` | Corpo, descrições, muted-foreground |

**Regra 90/8/2:** 90% navy · 8% cream/muted · 2% ouro.
**NUNCA:** azul (`#1A4FC4` ou qualquer outro), branco, preto puro, verde, vermelho fora de badges de erro.

### Tipografia
**Fonte exclusiva: DM Sans** — Google Fonts
```
https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap
```
**NUNCA usar:** Inter, Outfit, Bebas Neue, Montserrat, Raleway ou qualquer outra.

| Nível | Peso | Tamanho | Cor |
|---|---|---|---|
| Display | 700–800 | 48–72px | `#F0ECE4` |
| H1 | 600–700 | 32–44px | `#F0ECE4` |
| H2 | 600 | 20–28px | `#F0ECE4` |
| Corpo | 400 | 12–14px | `#7A8FA8` |
| Labels/Tags | 700 CAPS | 7–9px | `#C9A84C` |

### Logo
- Arquivo: `/public/logo.jpg` (já no repo)
- NUNCA recriar com SVG ou texto estilizado

---

## ARQUITETURA DA PLATAFORMA

```
app/
├── (auth)/login          ← Login público
├── (auth)/unauthorized   ← Acesso negado
├── auth/callback         ← Supabase OAuth callback
└── (platform)/           ← Área autenticada (layout protegido)
    ├── dashboard         ← KPIs, gráficos, market ticker
    ├── crm               ← Gestão de contatos
    ├── ranking           ← Ranking de partners
    ├── usuarios          ← Gestão de usuários (ADMIN only)
    ├── ia-assistant      ← V3 IA Partner (Anthropic SDK)
    ├── financeiro        ← Financeiro (ADMIN/FINANCEIRO)
    ├── comissoes         ← Comissões de partners
    ├── split-fiscal      ← Divisão de receitas
    ├── hub               ← Hub de Deals central
    ├── relatorios        ← Relatórios de inteligência
    ├── prompts           ← Banco de prompts
    ├── agentes           ← Squads de IA (7 squads) — ADMIN/GESTAO/MESA
    ├── docs              ← Central de Documentação (Manual Usuário + Técnico)
    ├── deal-rooms        ← Workspaces persistentes por deal
    ├── ma                ← Pipeline M&A
    │   └── oportunidades ← Deal Discovery (investor_profiles + varredura)
    ├── mesa-credito/     ← Mesa de Crédito
    │   ├── nivel-1       ← Crédito Varejo
    │   ├── nivel-2       ← Crédito Estruturado
    │   └── nivel-3       ← High Ticket (≥ R$5M)
    ├── mesa-ma           ← Mesa M&A completa (ADMIN/GESTAO/MESA)
    ├── consorcio/        ← Consórcio + simulação + cartas
    ├── mesa-consorcio-op ← Operação consórcio
    ├── mesa-operacional  ← Tickets de suporte
    ├── compliance        ← Módulo compliance
    ├── kyc               ← KYC partners
    ├── marketplace       ← Marketplace de produtos
    ├── prospeccao        ← Prospecção ativa
    ├── minha-assinatura  ← Assinatura Cora (cobranças Pix/boleto)
    └── academy           ← Treinamentos por categoria

api/ma/                   ← Mesa M&A — endpoints principais
├── forja-validate        ← FORJA Fase 1: score + validação (Haiku/Sonnet adaptativo)
├── forja-narrative       ← FORJA Fase 2: narrativa + tese_investimento (Haiku)
├── forja-kit             ← Geração completa do kit de criativos
├── forja-pdf             ← Export PDF do relatório FORJA
├── gerar-teaser-cego     ← Teaser cego com whitelist + blind de dados identificáveis
├── preview-criativo      ← Preview CIM, Teaser, LinkedIn, Story
├── investor-profiles     ← CRUD de perfis de investidores
├── match-investors       ← Matching automático por setor/UF/ticket (RPC SQL)
├── detect-opportunities  ← Varredura IA em relatórios → deal_opportunities
├── briefing-by-profile   ← Briefing cruzado para perfil de investidor
├── transfer-deal         ← Transferência de deal entre partners (ADMIN/GESTAO)
├── gerar-kit-ia          ← Kit completo (descricao, linkedin, story, etc.)
└── documents             ← Upload de documentos ao deal

api/agentes/
└── chat                  ← Chat dos Squads IA (max_tokens por squad, web search)

components/
├── layout/               ← sidebar, topbar, platform-shell
├── dashboard/            ← dashboard-client, market-ticker
├── agentes/              ← agentes-client (7 squads, exportação, botão Apresentação)
├── ma/
│   ├── forja-panel       ← FORJA two-phase com narrativa async
│   ├── criativos-panel   ← Kit de Criativos (CIM, Teaser, LinkedIn, Story)
│   ├── investor-match-panel ← Cadastro e matching de investidores
│   └── deal-discovery-client ← KPIs + varredura + oportunidades
├── mesa-ma/              ← mesa-ma-client (deal pipeline, Transfer, Teaser Cego, FORJA)
├── mesa-credito/         ← componentes mesa crédito
├── mesa-consorcio/       ← componentes consórcio
├── mesa-operacional/     ← tickets
├── ranking/              ← ranking de partners
├── split-fiscal/         ← split fiscal
├── academy/              ← academy
├── usuarios/             ← gestão de usuários
├── shared/               ← componentes reutilizáveis
└── ui/                   ← primitivos Radix UI
```

### Roles e permissões
| Role | Acesso |
|---|---|
| `ADMIN` | Tudo |
| `PARTNER` | Dashboard, CRM, Ranking, IA, Comissões, Split, M&A, Mesa Crédito N1/N2, Consórcio, Academy |
| `PARTNER_PRO` | Igual Partner + Mesa Crédito N3, Academy M&A |
| `MESA_OPERACIONAL` | Dashboard, IA, Mesa Crédito, Mesa Operacional, Mesa Consórcio, Academy, Consórcio |
| `GESTAO` | Tudo exceto Usuários |
| `FINANCEIRO` | IA, Financeiro, Comissões |
| `MESA` | Mesa M&A, Agentes IA, Deal Rooms, Docs |

### Sistemas externos integrados
- **Anthropic SDK** — Claude Sonnet 4.6 + Haiku 4.5 (squads IA + FORJA)
- **Cora Bank** — cobranças Pix/boleto via mTLS, webhook de pagamento
- **ClickSign** — assinatura eletrônica de contratos
- **Resend** — emails transacionais (notificações, transferência de deal)
- **n8n** — W0 (error catch) + W2 (intake) + W3 (ingestão docs) + CCR (relatório diário)

---

## BANCO DE DADOS — SUPABASE

**Projeto:** `sbmuashewklfhdyyuezr` (V3 PARTNERS PRO)

**Total: 79 tabelas — todas com RLS habilitado.**

**Core / Auth:**
- `profiles` — usuários com role, plan, Cora customer_id
- `notifications` — notificações in-app
- `audit_logs` — trilha de auditoria
- `execution_errors` — erros n8n/hooks com severity/status
- `split_fiscal` — divisão de receitas
- `financeiro_records` — registros financeiros
- `ai_conversations` — conversas V3 IA Partner

**Mesa M&A (344–96 kB ativos):**
- `ma_deals` (28 cols, 344 kB) — pipeline com asset_data JSONB rico
- `ma_deal_history` — histórico de mudanças de status
- `ma_captacao_links` — links de captação por deal
- `deal_intakes` (16 cols, 96 kB) — intake público de oportunidades
- `deal_workspaces` — workspaces por deal para squads
- `deal_opportunities` — oportunidades detectadas via IA
- `investor_profiles` — investidores para matching (setor/UF/ticket)
- `docs_ingeridos` (13 cols, 176 kB) — PDFs processados via W3

**Agentes IA:**
- `agent_sessions` (10 cols, 176 kB) — histórico de conversas por squad
- `generated_reports` (9 cols, 176 kB) — relatórios agente diário CCR

**Mesa de Crédito:**
- `credit_desk_proposals` (36 cols, 384 kB — maior tabela)
- `regras_linhas_credito` (20 cols, 96 kB)
- `portfolio_linhas` (24 cols, 160 kB)

**Partners / Contratos:**
- `partner_registrations` (37 cols, 96 kB)
- `partner_contracts` (18 cols, 248 kB)
- `partner_subscriptions`, `partner_goals`
- `contratos_mandato` (57 cols, 160 kB)
- `captacao_links`

**CRM / Prospecção:**
- `crm_leads` (27 cols, 112 kB)
- `prospeccao_leads` (23 cols, 96 kB)
- `prospeccao_followups`, `prospeccao_historico`

**KYC (4 tabelas):**
- `kyc_analyses` (13 cols, 80 kB)
- `kyc_access_log`, `kyc_api_keys`, `kyc_blacklist`
- `v_kyc_monthly_usage` (view)

**Marketplace (5 tabelas):**
- `marketplace_products` (22 cols, 80 kB)
- `marketplace_suppliers`, `marketplace_leads`
- `marketplace_product_reviews`, `marketplace_favorites`

**Academy (8 tabelas):**
- `academy_badges`, `academy_certificates`, `academy_comments`
- `academy_notes`, `academy_progress`, `academy_quiz_results`
- `academy_video_overrides`, `academy_yt_links`

**Suporte / Operacional:**
- `operational_tickets`, `ticket_comments`

**Outros:**
- `comunicados`, `disc_assessments`, `people_hub_members`
- `creative_files`, `creative_jobs`

**RLS:** Habilitado em todas as tabelas. Função central: `get_user_role()`

**Funções SQL:**
- `match_investors_for_deal(p_deal_id)` — scoring setor+40/UF+30/ticket+30
- `extractUF(text)` — extrai UF de endereço via regex (27 estados)

**Migrações aplicadas (mai/2026):**
- `create_execution_errors` — tabela de erros com trigger updated_at
- `create_investor_profiles_and_match` — investor_profiles + match function + extractUF
- `add_opportunity_scan_fields` — deal_opportunities + colunas em generated_reports

**Constraints críticos:**
- High Ticket (N3): `requested_value >= 5.000.000`
- Crédito consignado/pessoal = EXCLUÍDO do escopo
- Colunas novas em tabelas existentes: sempre nullable (backward compatible)

---

## REGRAS DE DESENVOLVIMENTO

### Sempre
- Componentes com `"use client"` quando usam hooks ou eventos
- Validação de dados com Zod + React Hook Form
- Queries Supabase com tratamento de erro
- Respeitar RLS — nunca bypassar com service_role no frontend

### Nunca
- Usar cores fora da paleta V3 — nem inline, nem em className hardcoded
- Usar fontes fora de DM Sans
- Expor `SUPABASE_SERVICE_ROLE_KEY` no cliente
- Crédito consignado ou pessoal nos fluxos de crédito
- Referenciar Finance Dealer — descontinuada

### Anti-alucinação
1. Dados de mercado → WebSearch, nunca inventar
2. Arquivos → verificar existência antes de referenciar
3. Regulatório → sinalizar "validar com Robson"
4. Incerteza → dizer explicitamente

---

## WORKFLOW GIT

```bash
# Atualizar antes de trabalhar
git pull origin main

# Criar branch para feature
git checkout -b feat/nome-da-feature

# Commit padrão
git commit -m "feat: descrição clara da mudança"

# Push e PR
git push origin feat/nome-da-feature
```

**Branch main:** protegida — sempre via PR, nunca push direto.
