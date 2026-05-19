# North Star Metric — V3 Partner
> Gerado em: 2026-05-17

## NSM: Monthly Active Earning Partners (MAEP)

> **Número único de parceiros que, em um dado mês, usaram ativamente a plataforma E receberam comissão confirmada ou fecharam ao menos 1 deal.**

### Por que este metric?
| Candidato | Por que foi rejeitado |
|---|---|
| MRR / Receita | Centrado em negócio, não no cliente; lag indicator |
| Nº de leads submetidos | Métrica de atividade — sem conversão não entrega valor |
| Nº de parceiros ativos (logins) | Vanity metric — não captura valor entregue |
| Total de comissões pagas | Varia com ticket; não reflete amplitude do sucesso |

---

## 5 Input Metrics (Constellation)

```
                    NORTH STAR METRIC
         Monthly Active Earning Partners (MAEP)
                          |
    ┌─────────┬───────────┼───────────┬─────────────┐
    │         │           │           │             │
Onboarding  Platform  Lead-to-Deal  Trial-to-  Partner Ranking
Completion   Depth     Conversion    Paid Conv.  Progression
   Rate      Score        Rate         Rate         Rate
(ativação) (stickiness) (valor     (compromisso) (momentum de
                       entregue)               engajamento)
```

### Input 1: Onboarding Completion Rate
% de novos parceiros que completam o wizard de onboarding em 7 dias.

### Input 2: Platform Depth Score
Nº médio de módulos distintos usados por parceiro/mês. Meta: 3+ módulos = muito menos churn.

### Input 3: Lead-to-Deal Conversion Rate
% de leads que avançam para deal confirmado (Credit Desk, Marketplace, M&A).

### Input 4: Trial-to-Paid Conversion Rate (30 dias)
% de parceiros trial que convertem para plano pago antes do trial expirar.

### Input 5: Partner Ranking Progression Rate
% de parceiros que subiram ao menos 1 tier no ranking em um dado mês.

---

## Implementação no Supabase
- Sinal de atividade: `agent_sessions` ou logs de acesso
- Sinal de ganho: tabela de deals/comissões com `partner_id` + `month`
- View mensual fazendo JOIN das duas condições
- Surfaced no painel admin ou ranking
