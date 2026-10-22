// Oferta única V3 (22/10/2026, pedido do Hamilton): 30 dias grátis para subir propostas com toda a
// estrutura da V3 e, depois do trial, um destes caminhos:
//   · GOLD      R$ 397/mês, comissão 25%, sem fidelidade
//   · DIAMANTE  R$ 897/mês, comissão 40%, sem fidelidade
//   · PARTNER PRO anual (valor integral do ano), comissão 50%, garantia de retorno em contrato
// Os mensais podem ser interrompidos quando o partner quiser: paga o mês corrente e não renova.
// A LP é /oferta; o lead cai em prospeccao_leads (origem "oferta_trial", etapa "trial") e o time
// libera o acesso. Gold e Diamante ainda não são papéis da plataforma (não há cobrança automática).

export type PlanoOferta = "gold" | "diamante" | "partner_pro";

export const OFERTA = {
  trialDias: 30,
  planos: {
    gold: { nome: "Gold", preco: 397, periodo: "mês", comissao: 25 },
    diamante: { nome: "Diamante", preco: 897, periodo: "mês", comissao: 40 },
    partner_pro: { nome: "Partner PRO", preco: 15897, periodo: "ano", comissao: 50 },
  } satisfies Record<PlanoOferta, { nome: string; preco: number; periodo: "mês" | "ano"; comissao: number }>,
} as const;

export const PLANOS_OFERTA = Object.keys(OFERTA.planos) as PlanoOferta[];

export function brl(v: number, centavos = false): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: centavos ? 2 : 0, maximumFractionDigits: centavos ? 2 : 0 });
}
