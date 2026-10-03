export const PLANO_VALOR: Record<string, number> = {
  // V3 Access (02/10/2026): reaproveita o papel STARTER (20%). Anual R$ 1.447,00
  // (em até 10x sem juros no cartão); aqui fica o equivalente mensal, mesma
  // convenção dos outros planos anuais (o cadastro cobra o anual via
  // PLANO_VALOR_ANUAL_FIXO em app/api/cadastro-partner/route.ts).
  STARTER: 12058, // R$ 120,58 = R$ 1.447,00 / 12
  PARTNER: 90808, // R$ 908,08
  PARTNER_PRO: 132475, // R$ 1.324,75
  PARTNER_HE: 9700, // R$ 97,00/mês — plano enxuto Home Equity (só as 4 linhas HE na Mesa de Crédito)
  ENTERPRISE: 415808, // R$ 4.158,08
};

export function getPlanoValor(role: string | null | undefined): number {
  return PLANO_VALOR[role ?? ""] ?? PLANO_VALOR.STARTER;
}
