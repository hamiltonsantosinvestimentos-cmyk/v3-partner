export const PLANO_VALOR: Record<string, number> = {
  STARTER: 29700, // R$ 297,00
  PARTNER: 49700, // R$ 497,00
  PARTNER_PRO: 89700, // R$ 897,00
  ENTERPRISE: 250000, // R$ 2.500,00
};

export function getPlanoValor(role: string | null | undefined): number {
  return PLANO_VALOR[role ?? ""] ?? PLANO_VALOR.STARTER;
}
