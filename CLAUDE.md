# CLAUDE.md — V3 Partners · Plataforma Unificada
> Compartilhado entre João (jlemo) e Hamilton (hamiltonsantosinvestimentos-cmyk)
> Atualizado em: 03/04/2026

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
    ├── ma                ← Pipeline M&A
    ├── mesa-credito/     ← Mesa de Crédito
    │   ├── nivel-1       ← Crédito Varejo
    │   ├── nivel-2       ← Crédito Estruturado
    │   └── nivel-3       ← High Ticket (≥ R$5M)
    ├── mesa-ma           ← Mesa M&A (ADMIN/GESTAO)
    ├── consorcio/        ← Consórcio + simulação + cartas
    ├── mesa-consorcio-op ← Operação consórcio
    ├── mesa-operacional  ← Tickets de suporte
    └── academy           ← Treinamentos por categoria

components/
├── layout/               ← sidebar, topbar, platform-shell
├── dashboard/            ← dashboard-client, market-ticker
├── crm/                  ← crm-client
├── financeiro/           ← componentes financeiros
├── mesa-credito/         ← componentes mesa crédito
├── mesa-ma/              ← componentes mesa M&A
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

---

## BANCO DE DADOS — SUPABASE

**Tabelas principais:** profiles, split_fiscal, ma_deals, ma_deal_history, operational_tickets, ticket_comments, credit_desk_proposals, ai_conversations, notifications

**RLS:** Habilitado em todas as tabelas. Função central: `get_user_role()`

**Constraints críticos:**
- High Ticket (N3): `requested_value >= 5.000.000`
- Crédito consignado/pessoal = EXCLUÍDO do escopo

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
