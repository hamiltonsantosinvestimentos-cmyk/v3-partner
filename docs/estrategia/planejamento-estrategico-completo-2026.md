# Planejamento Estratégico Completo — V3 Partners
> Gerado em: 2026-08-09 · Síntese de todo o material estratégico existente no repositório
> Fontes: `docs/estrategia/`, `docs/vendas/`, `docs/research/`, `docs/OKRs-v3partner-Q3-2026.md`, `CLAUDE.md`, `GOVERNANCE.md`
> Para: Hamilton Santos, João Lemos Netto, Robson Lino (diretoria/sócios, 33,33% cada)

> **Nota de método:** este documento não substitui os documentos-fonte — ele os conecta. Cada seção referencia o arquivo original para o mergulho tático. Onde os dados-fonte estão desatualizados (a maioria é de maio–julho/2026) ou uma premissa carece de validação, isso é sinalizado explicitamente em vez de assumido como verdade atual — regra de anti-alucinação do próprio `CLAUDE.md` do projeto.

---

## 1. Sumário Executivo

**3 grandes apostas para os próximos 12 meses:**

1. **Vencer a corrida do ecossistema all-in-one antes que um concorrente com capital a compre.** A V3 Partner é a única plataforma que integra CRM + M&A + Crédito + Marketplace + Academy + IA num único produto. A Teddy Open Finance (R$120M projetados em 2025) tem a lacuna de CRM/M&A que, se resolvida por aquisição, fecha a janela competitiva em 12–18 meses (`docs/estrategia/analise-competitiva.md`). O Marketplace é o ativo mais defensável — cada fornecedor novo aumenta o valor para todos os parceiros, e isso não se compra da noite para o dia.
2. **Reprecificar a valor, não a custo.** O preço atual (R$197/mês) subvaloriza a plataforma frente ao WTP real dos segmentos intermediário/sênior (R$400–4.000/mês estimado). Subir ARPU para R$350+ e lançar o tier Enterprise dobra o MRR **sem precisar dobrar a base de parceiros** (`docs/research/2026-05-16-pricing-strategy.md`).
3. **Crescer com CAC baixo via loops, não via ads.** Com 3 sócios + 1 dev, não há orçamento para aquisição paga em escala. A estratégia de crescimento depende de três loops orgânicos — indicação pós-deal, certificado viral da Academy, e o flywheel two-sided do Marketplace (`docs/estrategia/growth-loops.md`) — e de um funil de aquecimento educacional inspirado no modelo G4 antes de vender alto ticket a frio (`docs/estrategia/adaptacao-modelo-g4.md`).

**Prioridades dos próximos 90 dias** (sequência já validada em `docs/OKRs-v3partner-Q3-2026.md` e `docs/estrategia/escopo-iniciativas-g4-diretoria.md`):

| Ordem | O quê | Por quê primeiro |
|---|---|---|
| 1 | Corrigir bug crítico de entrega de leads no Marketplace | Bloqueia o engajamento do fornecedor — sem isso, o loop mais defensável não gira |
| 2 | Formalizar critérios de passagem nos playbooks de vendas | Custo de engenharia ~zero, aplica-se imediatamente, reduz ciclo de vendas |
| 3 | Lançar reprecificação + tier Enterprise | Financia o resto do plano sem depender de crescimento de base |
| 4 | Reorganizar a Academy em trilha Ativar/Engajar/Expandir | Ataca diretamente TTFV e conversão trial→pago com infraestrutura já pronta |

**Resultado esperado em 12 meses** (meta consolidada de `docs/estrategia/gtm-strategy.md` + OKRs): 500 parceiros pagantes, 100 fornecedores ativos no Marketplace, MRR ~R$150–250k, ARPU R$350+, 5 contas Enterprise pagantes, churn mensal <5%.

**⚠️ Gap identificado:** todo o material de GTM/produto/OKR mapeado neste documento cobre a **plataforma SaaS V3 Partner** — uma das 4 verticais de receita da holding. As outras três (Securitização, Real Estate Estruturado, Mineração/Commodities, M&A Cross-Border como vertical de negócio direto, distinta do módulo M&A da plataforma) não têm, no repositório, um plano de mercado/metas com o mesmo nível de detalhe. Isso está listado como decisão pendente na §9.

---

## 2. Quem Somos — Visão Corporativa

**V3 Partners Soluções Ltda** — CNPJ 14.219.287/0001-50 — Rua Visconde de Pirajá, 414/Sala 718, Ipanema, RJ.

**Posicionamento:** boutique institucional multiproduto de securitização e estruturação financeira.

**Sócios (33,33% cada):**
| Sócio | Responsabilidade |
|---|---|
| João Lemos Netto | Originação / Head de Ativos |
| Hamilton Santos | Financeiro / Cross-border / Dev principal |
| Robson Lino | Compliance / Operações |

**Infraestrutura institucional:** White Label Bloxs S.A. (tokenização, KYC, liquidação OTC/cripto 24/7) — é isso que permite à V3 operar com "a estrutura de um banco e a liberdade de um independente" (mensagem central do GTM).

**4 Verticais de Receita da Holding:**
1. Securitização de Crédito e Recebíveis Judiciais — CGI, precatórios, CRI, FIDC
2. Real Estate Estruturado — SLB, BTS, BTR
3. Mineração, Metais Preciosos e Commodities — lítio, ouro, cross-border
4. M&A e Negócios Cross-Border — fundos asiáticos e americanos

**Braço de produto SaaS:** a plataforma V3 Partner (`app.v3partners.com.br`) é o motor de distribuição e originação de deal flow para as 4 verticais — ela recruta e ativa uma rede de parceiros financeiros independentes que originam operações nessas verticais, monetizando via assinatura + comissão sobre deals + taxas de marketplace.

---

## 3. Mercado e Posicionamento Competitivo

**Frase de posicionamento** (`docs/estrategia/analise-competitiva.md`):
> "V3 Partner é a única plataforma all-in-one para assessores financeiros, corretores e AGFs no Brasil que integra CRM, pipeline de M&A, crédito de alto ticket, marketplace de fornecedores, academia com certificação e 7 agentes de IA — por R$397/mês, substituindo 6 ferramentas separadas."

**Por que isso é defensável:** todos os concorrentes mapeados são single-vertical.

| Concorrente | Ameaça | Força principal | Lacuna crítica |
|---|---|---|---|
| Teddy Open Finance | **ALTA** | R$120M (2025 proj.), infra de crédito robusta, white-label | Sem CRM de investimento, sem M&A, sem Academy própria |
| Franq | Média-alta | 150+ produtos, IA de matching | Exige 5+ anos ou certificação ANCORD — exclui novos assessores |
| Wiki/Zoho | Média | Integração nativa BTG | Dependente de terceiro (Zoho), só BTG |
| Gorila Invest | Média | Consolidação multi-custódia | Não é ferramenta de gestão — só consolidação de portfolio |
| Ability WM | Baixa-média | Compliance CVM mais completo do mercado | UX defasada, custo opaco, sem IA |

**Segmentos a atacar:** assessor solo (1–3 anos) → R$197 + onboarding IA; escritórios pequenos (1–5 assessores) → R$397 + Marketplace; assessores XP/BTG diversificando para crédito; escritórios com atuação M&A.

**Segmentos a evitar por ora:** gestoras de fundos/assets (Ability WM mais adequado), family offices ultra-HNW (exige customização extrema), bancários autônomos puros de crédito (Teddy tem vantagem de escala).

**Risco mais provável nos próximos 12–18 meses:** Teddy adquire um CRM de investimento e fecha a lacuna que hoje é o principal fosso competitivo da V3. Mitigação: acelerar densidade de rede no Marketplace (efeito de rede não se compra rápido) e lock-in via dados de carteira acumulados.

*Detalhe completo dos 5 concorrentes: `docs/estrategia/analise-competitiva.md`.*

---

## 4. Cliente-Alvo (ICP e Personas)

**ICP em uma frase:** profissional financeiro independente, 32–50 anos, nos principais centros financeiros do Brasil, carteira HNW, que precisa de infraestrutura institucional para fechar operações de R$500k–R$50M em M&A, crédito estruturado e real estate sem perder o deal por falta de compliance ou back-office.

**Risco crítico de churn identificado no ICP:** parceiros que não submetem nenhum deal nos primeiros 30 dias têm churn próximo de 100%. Essa é a métrica que organiza toda a estratégia de ativação (§7 e OKR Set 3).

**3 personas mapeadas** (`docs/estrategia/personas.md`):

| Persona | Perfil | Dor mais grave | Alavanca de crescimento |
|---|---|---|---|
| Rafael, "o Iniciante Ansioso" | Solo, 0–12 meses | Overwhelm de módulos + ansiedade de preço | Onboarding progressivo ("modo iniciante") |
| Camila, "a Parceira de Alto Volume" | Equipe de 3–8, execução diária | Comissão opaca até a liquidação | Transparência → ela influencia 2–5 novos parceiros/trimestre |
| Marcos, "o Fornecedor Invisível" | Gerente comercial de fornecedor | Bug de leads (crítico) — se persistir, ele não renova | Saúde do marketplace inteiro depende dele |

**Insight que conecta as três:** Marcos (fornecedor) é o lado de oferta do Marketplace — se ele sai, a plataforma perde valor para *todos* os parceiros. É por isso que o bug de leads é a prioridade #1 do trimestre, não uma correção qualquer de bug.

*Jobs-to-be-done, pain points completos e jornada do cliente: `docs/estrategia/icp.md` e `docs/estrategia/personas.md`.*

---

## 5. Modelo de Negócio e Monetização

**Estrutura atual de planos:**

| Plano | Preço | Role | Comissão ao parceiro |
|---|---|---|---|
| V3 Starter | R$297/mês | STARTER | 20% |
| V3 Partner | R$497/mês | PARTNER | 30% |
| V3 Partner PRO | R$897/mês | PARTNER_PRO | 50% + co-branding |
| V3 Enterprise | R$2.500+/mês | ENTERPRISE | negociável |

> Regra vigente: comissão de 10% da V3 aplica-se somente em crédito, M&A e consórcio (`CLAUDE.md`).

**Por que reprecificar:** o WTP estimado por segmento (R$60–25.000/mês dependendo da receita do parceiro) mostra que o preço atual captura só o segmento iniciante — a estrutura recomendada em `docs/research/2026-05-16-pricing-strategy.md` já reflete essa correção e está consistente com os planos acima.

**Três fontes de receita a manter e expandir:**
1. Assinatura mensal (MRR previsível)
2. Comissão sobre deals fechados (revenue share alinhado ao sucesso do cliente)
3. Taxas de marketplace — lead qualificado (R$50–200), fechamento via marketplace (2–5%), listing premium (R$500–2.000/mês) — **stream novo, ainda não lançado**

**Projeção (base 50 → 200 parceiros, Ano 1):**

| Mês | Parceiros | MRR Assinatura | MRR + Comissões (est.) |
|---|---|---|---|
| M1 | 50 | ~R$22.000 | ~R$28.000 |
| M6 | 100 | ~R$44.000 | ~R$58.000 |
| M12 | 200 | ~R$90.000 | ~R$120.000 |

**Migração de clientes existentes:** grandfathering obrigatório — parceiros ativos não sofrem aumento imediato; comunicação com 60 dias de antecedência; upgrade incentivado, nunca downgrade forçado. Cronograma completo em `docs/research/2026-05-16-pricing-strategy.md` §8.

**Premissas que precisam de validação antes do lançamento** (não assumir como fato): WTP real de R$497 no tier Partner, distribuição de tiers na base atual, churn de 3%/mês, e se a comissão de 25% no Starter cria conflito de incentivo — **validar com Robson (compliance)**.

---

## 6. Go-to-Market

**Mensagem central:** *"A estrutura de um banco. A liberdade de um independente."*

**Metas de 12 meses:** 500 partners pagantes · 100 suppliers no Marketplace · MRR R$250k · 3 contratos Enterprise.

**Canais por fase:**

| Fase | Canais | Meta |
|---|---|---|
| Meses 1–3 (Tier 1, baixo custo) | Referral estruturado, LinkedIn outbound (500 abordagens/mês), parcerias ANCORD/ABAI/COFECI | 25 demos/mês via LinkedIn |
| Meses 3–6 (Tier 2, escala) | Webinars educativos, blog/SEO de nicho, retargeting ads (R$3-5k/mês) | Orgânico = 30% dos leads em 6 meses |
| Meses 6–12 (Tier 3, enterprise) | Sales-led enterprise (1 executivo sênior), eventos presenciais (Faria Lima) | 3 contratos Enterprise no Ano 1 |

**Marketplace — estratégia de cold start** (three-phase, 365 dias): Fase 1 (dias 1-90) oferta "Founding Supplier" para 40 fornecedores com onboarding white-glove; Fase 2 (90-180) rating de fornecedores + badge "Verified"; Fase 3 (180-365) co-marketing + API de pipeline + vertical internacional.

**Enterprise — alvos primários Ano 1:** bancos médios com crédito estruturado (Banco Master, Daycoval, Banrisul), gestoras independentes com AuM >R$500M, family offices multi-family, cooperativas de crédito (SICOOB/SICREDI).

**Expansão geográfica:** Faria Lima primeiro (meses 1-6), depois hub & spoke nacional (RJ, BH, Porto Alegre, Recife/Fortaleza) nos meses 6-12.

**Gap identificado pelo próprio time** (`docs/estrategia/adaptacao-modelo-g4.md`): a V3 vende alto ticket direto no outbound frio ou direto no checkout, sem aquecimento educacional prévio — diferente do modelo G4, que nunca vende alto ticket sem antes entregar valor gratuito. Ação já desenhada: 1 aula gratuita mensal por público (recrutamento de partners / D2C crédito), com nutrição automatizada de 5-7 dias.

*Canais, KPIs semanais e cronograma completo: `docs/estrategia/gtm-strategy.md`.*

---

## 7. Motor de Crescimento (Growth Engine)

**North Star Metric:** **Monthly Active Earning Partners (MAEP)** — parceiros que, num dado mês, usaram a plataforma ativamente **e** receberam comissão confirmada ou fecharam ao menos 1 deal. Rejeitado deliberadamente: MRR (lag indicator), nº de leads (atividade sem conversão), logins (vanity metric).

5 input metrics que alimentam o MAEP: Onboarding Completion Rate, Platform Depth Score (meta 3+ módulos/parceiro), Lead-to-Deal Conversion Rate, Trial-to-Paid Conversion Rate, Partner Ranking Progression Rate.

**3 growth loops, em ordem de prioridade de implementação:**

1. **Referral Loop (prioritário, dias 1-30):** parceiro fecha deal → recebe notificação de ganho → sistema sugere indicar 3 colegas → indicado ganha trial + onboarding acelerado → indicador ganha 10-20% da comissão do indicado por 6 meses. K-factor meta: 0,30.
2. **Academy Certificate Loop (viral, dias 31-60):** certificado premium compartilhável no LinkedIn com 1 clique. Estimativa: ~154 signups orgânicos/mês a custo zero, uma vez maduro.
3. **Marketplace Flywheel (two-sided, dias 61-90):** o mais defensável dos três — cada fornecedor novo atrai mais parceiros, que atraem mais fornecedores. Não é replicável rapidamente por concorrentes.

**Camada complementar (adaptação do modelo G4, priorizada por custo/risco):**

| Prioridade | Iniciativa | Esforço | Por que essa ordem |
|---|---|---|---|
| 1 | Critérios de passagem formais nos playbooks de vendas | ~1 semana, custo zero | Só disciplina de processo — aplica-se hoje |
| 2 | Trilha Academy Ativar/Engajar/Expandir | 1-2 semanas | Reaproveita 8 tabelas Academy já existentes, ataca 2 KRs do OKR Q3 |
| 3 | Aula gratuita mensal (recrutamento + D2C) | 1-2 semanas + produção de conteúdo | Aquece antes do outbound/checkout direto |
| 4 | V3 Partners Circle (comunidade fechada PRO/Enterprise) | Baixo dev, médio custo de evento | Depende de volume de PRO/Enterprise suficiente — só faz sentido depois do OKR de monetização avançar |

*Mecânica completa de cada loop e dashboard de saúde semanal: `docs/estrategia/growth-loops.md` e `docs/estrategia/adaptacao-modelo-g4.md`.*

---

## 8. Produto e Tecnologia

**Stack:** Next.js 16 · TypeScript · Tailwind CSS v4 · Supabase (79 tabelas, RLS habilitado em todas) · Anthropic SDK (Claude Sonnet + Haiku) · Cora Bank (Pix/boleto mTLS) · ClickSign · Resend · n8n.

**Módulos em produção:** CRM, Ranking, IA Assistant (V3 IA Partner), Financeiro, Comissões, Split Fiscal, Hub de Deals, Pipeline M&A (com FORJA — geração de teaser/CIM/narrativa via IA), Mesa de Crédito (3 níveis, N3 = high ticket ≥R$5M), Consórcio, Compliance, KYC, Marketplace, Prospecção, Academy, 7 Squads de IA.

**Status conforme último registro em `GOVERNANCE.md` (16/05/2026 — verificar atualização, pois hoje é 09/08/2026):**
- Portal, Supabase, n8n (W0/W2/W3), FORJA, Squads IA: em produção
- Credit Engine V3: meta de go-live era 25/06/2026 — **confirmar se foi concluído**, pois é pré-requisito para o Mesa de Crédito funcionar em escala
- Analytics Layer (MotherDuck): pendente no último registro

**Riscos técnicos ativos sinalizados no GOVERNANCE.md** (confirmar se ainda válidos):
- n8n rodando localmente — risco crítico de queda de automações se a máquina reiniciar; migração para Railway estava pendente
- Consentimento LGPD para Credit Engine — Robson precisa revisar antes de qualquer teste com dados reais
- Investor profiles sem cadastros suficientes — trava o motor de matching M&A

**21 agentes especializados via Claude Code** (`@nome-do-agente`) já certificados ou em certificação, cobrindo Mesa M&A, Brand/Visual, Produto/Engenharia e Gestão/Governança — infraestrutura de execução que permite ao time de 3 sócios + 1 dev operar com produtividade de equipe maior.

*Arquitetura completa, tabelas do banco e roadmap técnico: `CLAUDE.md` e `GOVERNANCE.md`.*

---

## 9. OKRs Q3 2026 e Prioridades

**Sequência recomendada e já validada:** Marketplace (bug fix) → Monetização → Ativação → IA/M&A (adiado para Q4).

| # | OKR | Key Results principais |
|---|---|---|
| 1 | Saúde do Marketplace | Bug de leads resolvido até 15/jul · 50 fornecedores ativos até 30/set · 40%+ dos parceiros usam o marketplace 1x/mês |
| 2 | Monetização e Precificação | ARPU R$350/mês · 20% da base migra para PRO+ · Enterprise no ar com 5 contas até 30/set |
| 3 | Ativação de Parceiros | Trial→pago 35% · TTFV <48h · conclusão de curso Academy 50% |
| 4 (Q4) | Deal Flow M&A com IA | IA sugere contrapartes para 80%+ dos deals ativos · score de qualidade 4,0/5,0 · +30% QoQ em deals avançados |

**⚠️ Verificar antes de agir sobre este documento:** a data-limite do KR1 do Marketplace (15/jul/2026) e o go-live do Credit Engine (25/jun/2026) já passaram na data de hoje (09/08/2026). Os documentos-fonte são de maio/2026 e não foram atualizados neste repositório desde então. **Confirmar com o time o status real desses marcos antes de tratar as metas abaixo como ainda válidas** — isso é uma lacuna de atualização de documentação, não uma falha deste plano.

**Health metrics a monitorar (não otimizar diretamente):** churn mensal <5%, NPS/CSAT dos parceiros ativos, volume de tickets de suporte, incidentes de fraude no Marketplace.

*OKRs completos com racional e premissas: `docs/OKRs-v3partner-Q3-2026.md` e `docs/estrategia/OKRs-Q3-2026.md`.*

---

## 10. Roadmap Consolidado

### Próximos 30 dias
- [ ] Confirmar status real do bug de Marketplace e do go-live do Credit Engine (pré-requisito para validar o resto do roadmap)
- [ ] Auditar rota `/indicacao` e ativar o Referral Loop com trigger pós-deal
- [ ] Formalizar critérios de passagem nos dois playbooks de vendas (`docs/vendas/`)
- [ ] Iniciar Supplier Acquisition Sprint: primeiros 25 fornecedores com oferta "Founding Supplier"

### Dias 31–90
- [ ] Lançar nova página `/planos` com a tabela de 4 tiers reprecificada
- [ ] Reorganizar Academy em trilha Ativar/Engajar/Expandir com certificação automática ligada a eventos reais de produto
- [ ] Redesenhar certificados com identidade premium + compartilhamento LinkedIn em 1 clique
- [ ] Rodar piloto de 30 dias da aula gratuita mensal (1 edição recrutamento + 1 edição D2C)
- [ ] Configurar LinkedIn Sales Navigator com filtros de ICP + cadência de 500 abordagens/mês

### Meses 3–6
- [ ] Migrar base existente para o novo pricing (grandfathering + comunicação 60 dias antes)
- [ ] Lançar Marketplace Fase 2: rating de fornecedores + badge "Verified" + V3 Deal Flow Report mensal
- [ ] Primeiro encontro piloto do V3 Partners Circle (se volume de PRO/Enterprise justificar)
- [ ] Ativar plano anual no Cora Bank (desconto de 17%)

### Meses 6–12
- [ ] Contratar 1 executivo de contas sênior para Enterprise
- [ ] Expandir hub & spoke nacional (RJ, BH, Porto Alegre, Recife/Fortaleza)
- [ ] Marketplace Fase 3: 100+ fornecedores, co-marketing, API de pipeline, vertical internacional
- [ ] Retomar OKR Set 4 (IA/M&A) se houver capacidade de dev disponível

---

## 11. Riscos e Mitigações (consolidado)

| Risco | Categoria | Probabilidade | Mitigação |
|---|---|---|---|
| Teddy adquire CRM de investimento e fecha o gap all-in-one | Competitivo | Média-alta | Acelerar densidade do Marketplace; lock-in via dados de carteira |
| Churn de parceiros existentes na migração de pricing | Comercial | Média | Grandfathering + 6 meses de transição + comunicação antecipada |
| n8n local — automações param se a máquina reiniciar | Técnico | Alto (se não migrado) | Migração para Railway — verificar se já concluída |
| Consentimento LGPD do Credit Engine não implementado | Regulatório | Alto até resolvido | Robson revisar antes de qualquer teste com dados reais |
| Bottleneck de fundador para apresentar webinars/eventos recorrentes | Operacional | Médio | Rotação entre os 3 sócios; avaliar especialista convidado |
| Comissão variável cria atrito no onboarding | Comercial | Média | Transparência total no contrato + simulador de earnings |
| Documentação estratégica desatualizada (maio–jul/2026) leva a decisões sobre metas já vencidas | Processo | Alto (constatado neste documento) | Estabelecer cadência de atualização dos docs de estratégia a cada fechamento de sprint/OKR |

---

## 12. Decisões Pendentes da Diretoria

1. **Aprovar ou repriorizar a sequência de iniciativas:** critérios de passagem → trilha Academy → aula gratuita → V3 Partners Circle (`docs/estrategia/escopo-iniciativas-g4-diretoria.md`).
2. **Definir quem entre os 3 sócios assume a apresentação recorrente do webinar mensal** — é gargalo de fundador, precisa de dono.
3. **Aprovar orçamento de evento trimestral** para o V3 Partners Circle e validar o critério de elegibilidade (plano + volume de deals).
4. **Validar com Robson** se a comissão de 25% no tier Starter cria conflito de incentivo regulatório antes de comunicar o novo pricing externamente.
5. **Decidir se as outras 3 verticais de receita da holding** (Securitização, Real Estate, Mineração/Commodities) recebem o mesmo nível de planejamento de mercado que a plataforma SaaS já tem — hoje esse detalhamento não existe no repositório.
6. **Estabelecer a cadência de atualização** dos documentos em `docs/estrategia/` e `docs/OKRs-*` — vários marcos citados como futuros já venceram na data deste documento.

---

## 13. Dashboard de Métricas de Acompanhamento

| Métrica | Fonte | Mês 3 | Mês 6 | Mês 12 |
|---|---|---|---|---|
| Trials iniciados/mês | GTM | 60 | 150 | 400 |
| Trial-to-Paid | GTM / OKR Set 3 | 15% | 22% | 30–35% |
| Partners pagantes (acumulado) | GTM | 50 | 150 | 500 |
| MRR | GTM | R$15k | R$50k | R$150–250k |
| ARPU | OKR Set 1 | — | — | R$350+ |
| Fornecedores ativos | GTM / OKR Set 2 | 25 | 55 | 100 |
| Churn mensal | GTM / Health metrics | <7% | <5% | <5% |
| NPS Partners | GTM | — | >45 | >55 |
| K-factor do referral | Growth loops | 0,10 | 0,30 | — |
| MAEP (North Star) | North Star Metric | baseline a estabelecer | — | — |

---

## 14. Cadência de Planejamento Estratégico (Adaptação do Modelo G4)

> Pesquisa completa e fontes em `docs/estrategia/g4-cadencia-planejamento-estrategico.md`.

O G4 Educação estrutura planejamento estratégico em torno de 4 etapas (compreensão dos objetivos → caminhos estratégicos → prioridades/KPIs → desdobramento tático/operacional/financeiro), conectadas a um Balanced Scorecard (4 dimensões: Financeira, Clientes, Processos Internos, Aprendizado e Crescimento) e a uma cadência de OKR com check-in semanal e ciclo trimestral de lançamento/fechamento. O princípio central do próprio chairman do G4: *"o planejamento não é imutável — deve ser acompanhado, revisitado e revisado periodicamente."*

Hoje a V3 aplica isso apenas à plataforma SaaS (OKRs Q3 2026). A adaptação abaixo estende a mesma disciplina às **7 linhas de negócio**: Assinaturas SaaS, Consórcio, Crédito Varejo (N1), Crédito Estruturado (N2), Crédito High Ticket (N3), Direitos Creditórios/Precatórios e M&A.

| Cadência | Formato | Participantes | Pergunta central |
|---|---|---|---|
| **Semanal** | Check-in tático, 30 min, por mesa/squad | Cada mesa | O que moveu esta semana? Onde está travado? |
| **Mensal** | Revisão de metas e resultados | Líder da linha + 1 sócio | Estamos no ritmo da meta do mês? Que rota ajustar? |
| **Trimestral** | Ciclo de OKR — fechamento do ciclo anterior + lançamento do próximo | Diretoria (3 sócios) + líderes de mesa | O que aprendemos? Quais objetivos para o próximo trimestre? |
| **Semestral** | Rebalanceamento do mapa estratégico (BSC) | Diretoria | Estamos negligenciando alguma das 4 dimensões (financeira/clientes/processos/aprendizado) numa vertical? |
| **Anual** | Replanejamento completo (as 4 etapas do G4 aplicadas à holding inteira) | Diretoria + squads-chave | Diagnóstico → caminhos estratégicos → prioridades/orçamento → desdobramento tático |

**O que cada linha de negócio reporta no check-in semanal e na revisão mensal** — tabela completa por vertical (Assinaturas SaaS, Consórcio, Crédito N1/N2/N3, Precatórios, M&A) está em `docs/estrategia/g4-cadencia-planejamento-estrategico.md` §3.

**Decisão pendente que isso adiciona à §12:** hoje só a plataforma SaaS tem OKRs formalizados — Consórcio, Crédito (3 níveis), Precatórios e M&A como vertical de negócio direto ainda não têm ciclo trimestral próprio. Formalizar isso é o primeiro passo prático para rodar esta cadência de verdade, não só documentá-la.

**Implementado na plataforma (09/08/2026):** nova aba **Plan Strategy** (`/plan-strategy`, menu Plataforma, acesso ADMIN/GESTAO) registra esses check-ins por vertical (reaproveitando os 7 setores já usados em `/projeto`: M&A, Crédito, Consórcio, Bolsa de Ativos, Marketplace, Crédito Internacional, Assinaturas) e por cadência, com status (Pendente/Em andamento/Concluído), bloqueios e próximos compromissos. Requer rodar a migration `supabase-strategic-cadence.sql` no Supabase antes do primeiro uso. A aba não substitui `/projeto` (SWOT + 5W2H + metas mensais já existentes) — ela adiciona a camada de ritual/cadência que faltava.

---

*Este documento sintetiza `docs/estrategia/*.md`, `docs/vendas/*.md`, `docs/research/*.md`, `docs/OKRs-v3partner-Q3-2026.md`, `CLAUDE.md` e `GOVERNANCE.md`. Deve ser revisado a cada fechamento de trimestre — os OKRs e prazos citados aqui vencem em 30/09/2026.*
