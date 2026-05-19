# OKRs — V3 Partner Platform — Q3 2026

**Team:** V3 Partners Soluções Ltda (Hamilton / João / Robson + dev)
**Period:** Q3 2026 (July–September 2026)
**Context:** Brazilian financial SaaS — CRM, M&A Pipeline, Credit Desk, Marketplace, Academy, AI Agents, KYC/Compliance
**Generated:** 2026-05-16

---

## Strategic Alignment Summary

| Company Objective | Primary Team Lever |
|---|---|
| Fix & scale Marketplace to 50+ suppliers | Engineering + Partner Success |
| Raise ARPU from R$197 to R$350+ | Pricing + Plan Migration |
| Reduce trial churn / improve activation | Onboarding + Academy |
| Launch Enterprise tier (R$2.500+/mo) | Sales + Product |
| Expand M&A deal flow via AI matching | AI Agents + Data |

---

## OKR Set 1 — Monetização e Poder de Precificação

**Objetivo: Tornar o V3 Partner a escolha premium indiscutível para parceiros financeiros — e precificá-lo à altura.**

*Racional: O preço atual de R$197/mês subvaloriza a plataforma. Com 10+ módulos entregues, o time tem profundidade de produto para justificar aumento significativo de preço e introduzir um tier Enterprise. Este OKR ataca diretamente o gap de ARPU e financia o crescimento futuro.*

**Key Results:**

- **KR1:** ARPU (Receita Média por Usuário) atinge R$350/mês ao final do Q3 2026 (subindo de ~R$197)
- **KR2:** Pelo menos 20% da base de assinantes ativos migra para PARTNER_PRO ou superior (R$397+) durante o Q3 2026
- **KR3:** Tier Enterprise (R$2.500+/mês) está no ar e atinge 5 contas Enterprise pagantes até 30 de setembro de 2026

> **Premissas:** Contagem atual de assinantes ativos e distribuição por plano devem ser conhecidas para rastrear KR2. Rastreamento de ARPU requer instrumentação do sistema de cobrança.

---

## OKR Set 2 — Saúde do Marketplace e Rede de Fornecedores

**Objetivo: Transformar o Marketplace em um ecossistema vivo e confiável onde parceiros e fornecedores transacionam com sucesso toda semana.**

*Racional: O Marketplace é a alavanca de crescimento mais estratégica da plataforma — cria efeitos de rede. Mas tem um bug crítico (leads não aparecem) que bloqueia o engajamento de fornecedores. Corrigir e escalar para 50+ fornecedores ativos transforma o módulo de passivo em flywheel de retenção e aquisição.*

**Key Results:**

- **KR1:** Bug de entrega de leads no Marketplace resolvido e zero defeitos críticos remanescentes até 15 de julho de 2026 (primeiras 2 semanas do Q3)
- **KR2:** Número de fornecedores ativos e aprovados no Marketplace atinge 50 até 30 de setembro de 2026 (baseline: contagem atual a ser estabelecida no início do Q3)
- **KR3:** Pelo menos 40% dos parceiros ativos interagem com o Marketplace ao menos uma vez por mês (taxa de uso mensal ativo) ao final do Q3 2026

> **Premissas:** "Fornecedor ativo" deve ser definido (ex: tem ao menos 1 oferta publicada). Contagem atual de fornecedores é o baseline — precisa ser medida no kickoff do Q3. Eventos de uso do Marketplace precisam de instrumentação na camada de analytics.

---

## OKR Set 3 — Ativação de Parceiros e Conversão de Trial

**Objetivo: Garantir que todo parceiro que experimenta o V3 Partner atinja seu primeiro momento de sucesso — e permaneça.**

*Racional: Um trial de 30 dias com taxa de conversão desconhecida é um vazamento silencioso de receita. A Academy está ativa mas o engajamento é incerto. Melhorar o onboarding e o time-to-value reduz diretamente o churn no trial e aumenta o número de parceiros pagantes e engajados — base do crescimento sustentável de MRR.*

**Key Results:**

- **KR1:** Taxa de conversão trial-para-pago atinge 35% ao final do Q3 2026 (baseline a ser medido no início do Q3)
- **KR2:** Time-to-First-Value (TTFV) — definido como a primeira ação completada no CRM, Credit Desk ou Marketplace — cai para menos de 48 horas após o signup no trial
- **KR3:** Taxa de conclusão de curso na Academy entre usuários de trial atinge 50% para ao menos um módulo core de onboarding até 30 de setembro de 2026

> **Premissas:** Taxa de conversão trial-para-pago é atualmente desconhecida — este baseline deve ser extraído do banco de dados antes do início do Q3. TTFV requer rastreamento de eventos na primeira ação significativa no produto. Dados de conclusão da Academy requerem instrumentação no LMS.

---

## OKR Set 4 (Bônus) — Deal Flow M&A com IA

**Objetivo: Tornar o motor de matching com IA do V3 Partner a vantagem injusta que fecha mais negócios de M&A para os parceiros.**

*Racional: Matching M&A assistido por IA é uma capacidade de alta diferenciação que justifica o tier Enterprise e posiciona o V3 Partner acima de CRMs genéricos. Melhorias no matching de negócios retêm os parceiros de maior valor.*

**Key Results:**

- **KR1:** Motor de matching por IA sugere contrapartes relevantes para ao menos 80% dos negócios ativos no pipeline (taxa de cobertura) até o final do Q3 2026
- **KR2:** Score de qualidade de match relatado pelos parceiros (pesquisa pós-match) atinge média de 4,0/5,0 ou superior até setembro de 2026
- **KR3:** Número de negócios M&A avançados (movidos de "identificado" para "em negociação") aumenta 30% trimestre a trimestre, atribuído ao menos parcialmente ao matching por IA

> **Premissas:** O motor de matching por IA pode precisar ser construído ou significativamente melhorado durante o Q3 — se não estiver no ar, KR1 é um milestone de lançamento, não métrica de engajamento. Pesquisa de qualidade de match deve ser adicionada à experiência do parceiro.

---

## Priorização Recomendada para Q3 2026

Dado o tamanho da equipe (3 fundadores + 1 dev), perseguir todos os 4 OKRs em paralelo é alto risco. Sequência recomendada:

| Prioridade | OKR | Justificativa |
|---|---|---|
| 1 | OKR Set 2 (Marketplace) | Desbloquear o bug primeiro — pré-requisito para engajamento |
| 2 | OKR Set 1 (Monetização) | Aumento de preço e Enterprise tier geram MRR independente |
| 3 | OKR Set 3 (Ativação) | Melhora conversão de trial e transforma marketing em receita |
| 4 | OKR Set 4 (IA/M&A) | Adiado para Q4 exceto se houver capacidade de dev disponível |

---

## Health Metrics (monitorar, não otimizar)

Estes KPIs devem ser rastreados como guardrails para evitar que os OKRs sejam distorcidos:

- Taxa de churn mensal (alvo: abaixo de 5%/mês)
- NPS / CSAT dos parceiros ativos
- Volume de tickets de suporte (observar picos durante migração de preços)
- Incidentes de fraude/abuso no Marketplace (à medida que a base de fornecedores cresce)

---

*Gerado por Claude Code — brainstorm-okrs skill — 2026-05-16*
