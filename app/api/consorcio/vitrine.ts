// Vitrine de cartas contempladas (BRIEF docs/briefs/2026-11-21_consorcio-projetos-ofertas-vazamento.md, item 3).
// Quem não é da equipe interna recebe só o que a tela mostra: nada que permita deduzir o preço de custo da V3.

export const PAPEIS_INTERNOS = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

export function ehInterno(role: string | null | undefined): boolean {
  return !!role && (PAPEIS_INTERNOS as readonly string[]).includes(role);
}

/** Margem da V3 sobre o crédito, somada ao preço de custo na entrada do partner (regra de hoje). */
export const MARGEM_V3 = 0.07;

export function entradaPartner(askingPrice: number, creditValue: number): number {
  return Number(askingPrice ?? 0) + Number(creditValue ?? 0) * MARGEM_V3;
}

/** Mesma fórmula que a tela usava (partnerDiscount): uma casa decimal, nunca negativo. */
export function descontoPartner(askingPrice: number, creditValue: number): number {
  const credito = Number(creditValue ?? 0);
  if (credito <= 0) return 0;
  const pe = entradaPartner(askingPrice, credito);
  return Math.max(0, Math.round(((credito - pe) / credito) * 1000) / 10);
}

const COLUNAS_PARTNER = ["id", "code", "type", "credit_value", "admin", "group_name", "quota", "status", "created_at"] as const;
const METADATA_PARTNER = ["parcelas_qtd", "parcela_valor", "taxa_transf", "fundo_comum", "saldo_devedor", "avaliacao_minima"] as const;

/**
 * Interno: a carta inteira, mais entrada_partner/desconto_partner.
 * Demais: só as colunas da vitrine, os valores do partner calculados aqui e o metadata reduzido.
 * Ficam fora: asking_price, discount, source_ref, metadata.entrada e o resto do metadata.
 */
export function cartaParaVitrine(carta: Record<string, unknown>, interno: boolean): Record<string, unknown> {
  const asking = Number(carta.asking_price ?? 0);
  const credito = Number(carta.credit_value ?? 0);
  const calculados = { entrada_partner: entradaPartner(asking, credito), desconto_partner: descontoPartner(asking, credito) };
  if (interno) return { ...carta, ...calculados };

  const out: Record<string, unknown> = {};
  for (const c of COLUNAS_PARTNER) out[c] = carta[c] ?? null;
  const meta = (carta.metadata && typeof carta.metadata === "object" ? carta.metadata : {}) as Record<string, unknown>;
  const metaReduzido: Record<string, unknown> = {};
  for (const k of METADATA_PARTNER) if (meta[k] !== undefined) metaReduzido[k] = meta[k];
  return { ...out, ...calculados, metadata: metaReduzido };
}
