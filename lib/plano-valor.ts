export const PLANO_VALOR: Record<string, number> = {
  STARTER: 29700, // R$ 297,00 — legado, não vendido mais (fora do site desde ago/2026)
  PARTNER: 90808, // R$ 908,08
  PARTNER_PRO: 132475, // R$ 1.324,75
  ENTERPRISE: 415808, // R$ 4.158,08
};

export function getPlanoValor(role: string | null | undefined): number {
  return PLANO_VALOR[role ?? ""] ?? PLANO_VALOR.STARTER;
}
