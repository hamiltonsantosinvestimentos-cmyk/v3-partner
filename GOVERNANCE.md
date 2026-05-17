# GOVERNANCE — V3 Partners Portal
> Documento de rastreabilidade técnica e roadmap de implantação.
> Atualizado automaticamente a cada sessão de desenvolvimento.
> **Última atualização:** 16/05/2026

---

## STATUS GERAL DO SISTEMA

| Componente | Status | Última atualização |
|---|---|---|
| Portal (app.v3partners.com.br) | Produção | 15/05/2026 |
| Supabase (sbmuashewklfhdyyuezr) | Produção · 57 tabelas | 15/05/2026 |
| n8n W0 Error Catch | Produção | 13/05/2026 |
| n8n W2 Intake | Produção | 09/05/2026 |
| n8n W3 Ingestão Docs | Produção | 09/05/2026 |
| FORJA Two-Phase | Produção | 14/05/2026 |
| Squads IA (7 agentes) | Produção | 15/05/2026 |
| Credit Engine V3 | Em desenvolvimento · Go-live 25/Jun | 16/05/2026 |
| n8n W6 Credit Enrichment | Pendente | — |
| Analytics Layer (MotherDuck) | Pendente | — |

---

## ROADMAP DE IMPLANTAÇÃO — SPRINT ATIVO

### Sprint Mai/2026 — Concluído ✅

| Feature | Commits | Data |
|---|---|---|
| Integração Cora Bank (mTLS + cobranças) | cbb96ef → e7319be | 12/05 |
| Teaser Cego FORJA (whitelist + blind geo) | c17154a → a34b027 | 13–14/05 |
| FORJA Two-Phase anti-504 | 9c2b886 → 901d546 | 14/05 |
| Deal Matching Engine (investor_profiles + SQL) | 92c2972 | 13/05 |
| Deal Discovery (detect-opportunities + briefing) | 860cd22 | 14/05 |
| Transferência de Deal (ADMIN/GESTAO + email) | fa66cd6 | 13/05 |
| Squads IA maxTokens + exportação consolidada | d8c9741 | 15/05 |
| Botão Apresentação V3 nos Squads | f0b8f45 | 15/05 |
| Sistema Anti-Falha (hooks v2/v3 + n8n W0) | — | 13/05 |
| Central de Documentação (/docs) | 3978b51 | 13/05 |
| Migration docs_ingeridos commitada | 8134ee3 | 16/05 |
| CLAUDE.md atualizado (57 tabelas + arquitetura) | 4b4dad5 | 16/05 |

### Sprint Jun/2026 — Em andamento 🔄

| Feature | Prazo | Owner | Status |
|---|---|---|---|
| Credit Engine — Schema Supabase (4 tabelas) | 25/05 | Hamilton | Pendente |
| Credit Engine — APIs gratuitas (CNJ/Receita/PGFN/CEIS/OFAC) | 01/06 | Hamilton | Pendente |
| Credit Engine — Revisão LGPD + consentimento | 05/06 | Robson Lino | Pendente |
| Contrato Serasa Experian API | 05/06 | João Lemos | Pendente |
| Contrato SPC Brasil / Boa Vista | 05/06 | João Lemos | Pendente |
| n8n → Railway (migração cloud) | Esta semana | Hamilton | Pendente |
| Discovery interviews 10 partners | 05/06 | João Lemos | Pendente |
| Credit Engine — APIs pagas (Serasa + SPC + Jusbrasil) | 15/06 | Hamilton | Pendente |
| Credit Engine — Score V3 + Relatório PDF | 20/06 | Hamilton | Pendente |
| Beta fechado (5 partners selecionados) | 20/06 | João Lemos | Pendente |
| **GO-LIVE Credit Engine V3** | **25/06** | **Todos** | **Meta** |

### Backlog Priorizado

| # | Feature | Esforço | Impacto |
|---|---|---|---|
| P1 | n8n W4 Monitor Regulatório (CVM + BC + COAF) | 3h | Alto |
| P1 | Dashboard execution_errors (ADMIN) | 2h | Médio |
| P1 | Role ORIGINADOR + painel simplificado | 4h | Alto |
| P2 | Converter deal_opportunities em ma_deals formais | 2h | Médio |
| P2 | Analytics Layer Fase 1 (MotherDuck + dbt) | 40h | Alto |
| P3 | Credit Engine B2B (produto standalone) | 80h | Muito alto |

---

## MIGRAÇÕES SUPABASE APLICADAS

| Versão | Nome | Data | Status |
|---|---|---|---|
| 20260502000001 | deal_intakes | 02/05 | ✅ Applied |
| 20260509000001 | hub_deal_card_html | 09/05 | ✅ Applied |
| 20260509000002 | agent_sessions | 09/05 | ✅ Applied |
| 20260509000003 | generated_reports | 09/05 | ✅ Applied |
| 20260509000004 | docs_ingeridos | 09/05 | ✅ Applied |
| 20260511015140 | create_people_hub_tables | 11/05 | ✅ Applied |
| 20260512111702 | deal_workspaces | 12/05 | ✅ Applied |
| 20260513102018 | create_execution_errors | 13/05 | ✅ Applied |
| 20260514024547 | create_investor_profiles_and_match | 14/05 | ✅ Applied |
| 20260514030413 | add_opportunity_scan_fields | 14/05 | ✅ Applied |
| credit_engine_schema (PENDENTE) | 4 tabelas Credit Engine | Jun/2026 | ⏳ Pending |

---

## DECISÕES TÉCNICAS (ADRs)

| ID | Decisão | Data | Contexto |
|---|---|---|---|
| ADR-001 | FORJA two-phase (anti-504) | 14/05 | Vercel timeout 60s · chamada única excedia limite |
| ADR-002 | Teaser Cego whitelist (não blacklist) | 14/05 | Blacklist causava vazamento de dados identificáveis |
| ADR-003 | maxTokens por squad (não global) | 15/05 | Executor exige 6000 · outros 4096 |
| ADR-004 | getBaseUrl(req) para blob URLs | 14/05 | Relative paths não resolvem em blob: context |
| ADR-005 | Haiku sem docs · Sonnet com docs | 14/05 | Reduz tempo FORJA de 30s para 5s quando sem PDFs |
| ADR-006 | sanitizeDeal exclui 16+ campos | 14/05 | forja_result (9.6KB) estourava contexto Claude |
| ADR-007 | n8n W0 error catch universal | 13/05 | W2+W3 precisavam de captura centralizada de falhas |
| ADR-008 | credit_consents obrigatório | 16/05 | LGPD Art.7 — consentimento explícito por fonte |

---

## DEPENDÊNCIAS EXTERNAS ATIVAS

| Serviço | Plano | Custo/mês | Status |
|---|---|---|---|
| Vercel | Pro | ~R$116 | Ativo |
| Supabase | Pro | ~R$145 | Ativo |
| Anthropic API | Pay-per-use | ~R$300 | Ativo |
| Cora Bank | mTLS | Variável | Ativo |
| ClickSign | — | — | Ativo |
| Resend | — | ~R$50 | Ativo |
| n8n | Local (migrar para Railway) | R$70 | ⚠️ Migração pendente |
| Serasa Experian | Pendente contrato | R$500–800 | ⏳ Contrato em negociação |
| SPC Brasil | Pendente contrato | R$300–500 | ⏳ Contrato em negociação |
| Jusbrasil API | Pendente | R$400–600 | ⏳ Pendente |

---

## CERTIFICAÇÃO DE AGENTES — SPRINT 17/Mai/2026

### Processo: skill-creator benchmark (with_skill vs baseline, pass rate > 85%)

| Agente | Persona | Delta | Pass Rate | Status |
|---|---|---|---|---|
| ma-supervisor | MAESTRO v2.0 | +67 pp | 100% | CERTIFICADO |
| v3-feature-architect | ORION v2.0 | +38 pp | 100% | CERTIFICADO |
| ma-deal-hunter | SCOUT v2.0 | +56 pp | 89% | CERTIFICADO |

### Skills certificadas pelo skill-creator

| Skill | Delta | Iterações | Status |
|---|---|---|---|
| v3-forja-validation v1.2 | +62 pp | 3 | CERTIFICADA |
| v3-feature-spec v1.0 | +62 pp | 1 | CERTIFICADA |
| v3-compliance-gate v1.0 | +40 pp | 1 | CERTIFICADA |
| v3-frontend-design v1.0 | +25 pp | 1 | CERTIFICADA |

### Agentes aguardando certificação (próxima sessão)

**P1 — Negócio crítico (certificar primeiro):**
- `project-pm` (AXIS) — PM técnico, Agile/Scrum, roadmap
- `roadmap-sentinel` (SENTINEL) — OKRs, prazos, desvios
- `ma-estruturador` (FORJA agent) — kit M&A: CIM, Teaser, LinkedIn, Story

**P2 — Marca crítica:**
- `identity-chief` · `brand-strategist` · `visual-director` · `brand-guardian` · `logo-architect`

**P3 — Técnico:**
- `hooks-architect` · `swarm-orchestrator` · `config-engineer` · `mcp-integrator`
- `claude-mastery-chief` · `skill-craftsman` · `project-integrator`
- `buyside-agro-ma` · `v3-scout`

### Protocolo de certificação (padrão estabelecido)
1. Ler agente atual → identificar gaps e desatualizações
2. Criar 3 evals com cenários V3 reais (6 agentes: 3 with_skill + 3 baseline)
3. Rodar benchmark em paralelo
4. Grading com assertions discriminadoras
5. Corrigir bugs encontrados → re-rodar eval com falha
6. Atualizar arquivo `.claude/agents/nome.md`
7. Registrar no GOVERNANCE.md

---

## BANCO DE AGENTES V3 — 21 agentes ativos

> Ativação: `@nome-do-agente` no terminal Claude Code
> Arquivos: `C:\Users\jlemo\.claude\agents\`
> Pre-Execution Gate: `~/.claude/rules/v3-agent-execution-protocol.md`

### Mesa M&A
| Agente | Persona | Ativação | Função |
|---|---|---|---|
| ma-supervisor | MAESTRO | `@ma-supervisor` | Supervisor Central — orquestra todos os agentes |
| ma-deal-hunter | SCOUT | `@ma-deal-hunter` | Prospecção ativa de deals e ativos no Brasil |
| ma-estruturador | FORJA | `@ma-estruturador` | Kit completo de peças M&A (CIM, Teaser, LinkedIn, Story) |
| buyside-agro-ma | AGRO | `@buyside-agro-ma` | Buyside M&A frigoríficos e usinas (5 SIMs V3) |
| v3-scout | V3 SCOUT | `@v3-scout` | Deal hunter nas 4 verticais V3 |

### Brand & Visual
| Agente | Persona | Ativação | Função |
|---|---|---|---|
| identity-chief | ID CHIEF | `@identity-chief` | Decisões centrais de identidade visual |
| brand-strategist | BRAND | `@brand-strategist` | Posicionamento, voz da marca e mensagem |
| visual-director | VISUAL | `@visual-director` | Revisão final de peças (navy/ouro/DM Sans/90-8-2) |
| brand-guardian | GUARDIAN | `@brand-guardian` | Conformidade identidade visual em qualquer material |
| logo-architect | LOGO | `@logo-architect` | Uso correto das variantes de logo |

### Produto & Engenharia
| Agente | Persona | Ativação | Função |
|---|---|---|---|
| **v3-feature-architect** | **ORION** | `@v3-feature-architect` | **Arquiteto de features V3 — spec, review, ADR, estimate** |
| hooks-architect | LATCH | `@hooks-architect` | Hooks lifecycle Claude Code (17 eventos) |
| swarm-orchestrator | SWARM | `@swarm-orchestrator` | Orquestrador de agentes paralelos |
| config-engineer | CONFIG | `@config-engineer` | settings.json, permissions, env vars |
| mcp-integrator | MCP | `@mcp-integrator` | Servidores MCP (filesystem, context7, playwright, exa) |
| claude-mastery-chief | MASTERY | `@claude-mastery-chief` | Setup completo Claude Code |
| skill-craftsman | CRAFT | `@skill-craftsman` | Criação de skills e slash commands |
| project-integrator | INTEGRA | `@project-integrator` | Integração de projetos e CLAUDE.md |

### Gestão & Governança
| Agente | Persona | Ativação | Função |
|---|---|---|---|
| project-pm | AXIS | `@project-pm` | Technical PM — Agile/Scrum time de 2 |
| roadmap-sentinel | SENTINEL | `@roadmap-sentinel` | Guardião do roadmap, OKRs e desvios de prazo |

### Database (AIOX Framework)
| Agente | Persona | Ativação | Função |
|---|---|---|---|
| data-engineer | DARA | `@data-engineer` (skill) | Schema design, migrations, RLS, query optimization |

### Protocolo ORION + Dara
```
Usuário → ORION *spec → BRIEF → go → Feature Spec + HANDOFF
       → Dara recebe HANDOFF → BRIEF → go → Migration SQL
       → ORION *review → validação padrões V3
```
Arquivos do protocolo:
- `~/.claude/rules/v3-agent-execution-protocol.md` — protocolo central
- `~/.claude/rules/v3-dara-gate.md` — gate específico Dara + contexto V3

---

## ALERTAS E RISCOS ATIVOS

| # | Risco | Severidade | Ação |
|---|---|---|---|
| R-01 | n8n rodando localmente — se PC reiniciar, automações param | CRÍTICO | Migrar para Railway esta semana |
| R-02 | Consentimento LGPD para Credit Engine não implementado | ALTO | Robson Lino revisar antes de qualquer teste com dados reais |
| R-03 | migration `docs_ingeridos.sql` estava untracked | BAIXO | Resolvido — commitado em 8134ee3 |
| R-04 | Investor profiles sem cadastros — matching engine inativo | MÉDIO | Cadastrar primeiros 3-5 perfis |

---

## DOCUMENTAÇÃO GERADA (V3 Central de Documentos)

### 06_Operacional
- `2026-05-16_Operacional_Handover-Head-Tecnologia_v1.html` — estado completo do sistema
- `2026-05-15_Operacional_Manual-Tecnico-Squads-Apresentacao_v1.html`
- `2026-05-15_Operacional_Manual-Usuario-Squads-Apresentacao_v1.html`
- `2026-05-14_Operacional_Manual-Tecnico-DealDiscovery_v1.html`
- `2026-05-14_Operacional_Manual-Usuario-MesaMA_v1.html`
- `2026-05-13_Operacional_Manual-Sistema-Anti-Falha_v1.html`
- `2026-05-12_Operacional_Manual-Deal-Rooms_v1.html`

### 05_Comercial (Board Reports)
- `2026-05-16_Estrategia_BoardReport-DataStrategy-CreditEngine-Unificado_v1.html`
- `2026-05-16_GTM_CreditEngine-Lancamento-Board_v1.html`
- `2026-05-16_Estrategia_CreditEngine-V3-PropostaTecnica_v1.html`
- `2026-05-16_Estrategia_Relatorio-Executivo-AnalisePreditiva-Board_v1.html`

---

*Este arquivo é commitado automaticamente e reflete o estado atual do portal em produção.*
*Para atualizações: editar este arquivo e fazer push para main (Vercel auto-deploys).*
