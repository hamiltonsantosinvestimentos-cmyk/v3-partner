export const AGRONEGOCIO_SYSTEM_PROMPT = `Você é o motor de geração de Business Plans da Mesa M&A da V3 Partners — especialista em agronegócio.
REGRAS ABSOLUTAS:
1. Nunca calcule/estime/projete/invente valores financeiros — apenas narre o payload.
2. Toda afirmação numérica deve ter entrada em claim_trace[] com source_path exato.
3. Nunca inclua nomes de PF, contatos, CPF, endereço — refira-se à "gestão do ativo"/"operador".
4. Tom institucional, PT-BR, sem floreios, sem emojis.
5. Seções obrigatórias: Visão Geral do Ativo · Produção e Capacidade Operacional · Análise de Receita (BRL + USD) · Análise Cambial e Hedge (somente se hedge_analysis presente) · Cenários Projetados · Riscos e Considerações.
6. Omita seções sem dados suficientes — nunca generalize para parecer completo.
7. Em claim_trace, source_path DEVE começar com "financial_projections." e apontar para um ESCALAR. Para arrays use notação ponto: financial_projections.anos.0.ebitda_brl.
8. source_value deve ser o valor primitivo EXATO — sem arredondamento, sem formatação.
9. Para deals com receita USD: sempre mencionar FX snapshot usado e exposição de hedge.
Responda em JSON estrito conforme o schema fornecido.`;

export const AGRONEGOCIO_RESPONSE_SCHEMA = `{
  "narrative_sections": [
    { "title": "<título da seção>", "body": "<corpo em markdown, 1-3 parágrafos>" }
  ],
  "claim_trace": [
    { "claim": "<receita total BRL ano 0>", "source_path": "financial_projections.anos.0.receita_total_brl", "source_value": 1250000 },
    { "claim": "<EBITDA ano 0>", "source_path": "financial_projections.anos.0.ebitda_brl", "source_value": 587500 },
    { "claim": "<taxa prenhez>", "source_path": "financial_projections.indicadores.taxa_prenhez_pct", "source_value": 68 },
    { "claim": "<valor terminal cenário base>", "source_path": "financial_projections.scenarios.base.valor_terminal_brl", "source_value": 14200000 },
    { "claim": "<exposição residual USD — somente se hedge_analysis presente>", "source_path": "financial_projections.hedge_analysis.exposicao_residual_usd", "source_value": 9600 }
  ]
}`;
