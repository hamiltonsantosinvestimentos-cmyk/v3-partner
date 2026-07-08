import type { SupabaseClient } from "@supabase/supabase-js";

export const SECTORS = ["MA", "CREDITO", "CONSORCIO", "BOLSA_ATIVOS", "MARKETPLACE", "CREDITO_INTERNACIONAL", "ASSINATURAS"] as const;
export type Sector = typeof SECTORS[number];

export const SECTOR_LABELS: Record<Sector, string> = {
  MA: "M&A",
  CREDITO: "Crédito",
  CONSORCIO: "Consórcio",
  BOLSA_ATIVOS: "Bolsa de Ativos",
  MARKETPLACE: "Marketplace",
  CREDITO_INTERNACIONAL: "Crédito Internacional",
  ASSINATURAS: "Assinaturas",
};

export function isValidSector(v: string): v is Sector {
  return (SECTORS as readonly string[]).includes(v);
}

export interface RealizadoMes { valor: number; quantidade: number; }

/** Soma valor + quantidade reais por mês (1-12) para o setor/ano informado, a partir dos dados operacionais reais. */
export async function getRealizadoPorMes(db: SupabaseClient, sector: Sector, year: number): Promise<Record<number, RealizadoMes>> {
  const porMes: Record<number, RealizadoMes> = {};
  for (let m = 1; m <= 12; m++) porMes[m] = { valor: 0, quantidade: 0 };

  const add = (dateStr: string | null | undefined, value: number | null | undefined) => {
    if (!dateStr) return;
    const d = new Date(dateStr);
    if (d.getFullYear() !== year) return;
    const m = d.getMonth() + 1;
    porMes[m].valor += value ?? 0;
    porMes[m].quantidade += 1;
  };

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31T23:59:59`;

  if (sector === "MA") {
    const { data } = await db
      .from("ma_deals")
      .select("deal_value, contract_signed_at, updated_at")
      .eq("stage", "CLOSED_WON")
      .gte("updated_at", yearStart)
      .lte("updated_at", yearEnd);
    for (const row of data ?? []) {
      add((row.contract_signed_at as string | null) ?? (row.updated_at as string), row.deal_value as number | null);
    }
  } else if (sector === "CREDITO") {
    // Exclui linhas "Op. Internacional ..." — essas contam pro setor Crédito Internacional
    const { data } = await db
      .from("credit_desk_proposals")
      .select("approved_value, updated_at, credit_line")
      .in("status", ["APPROVED", "COMPLETED"])
      .not("credit_line", "ilike", "Op. Internacional%")
      .gte("updated_at", yearStart)
      .lte("updated_at", yearEnd);
    for (const row of data ?? []) {
      add(row.updated_at as string, row.approved_value as number | null);
    }
  } else if (sector === "CREDITO_INTERNACIONAL") {
    const { data } = await db
      .from("credit_desk_proposals")
      .select("approved_value, updated_at")
      .in("status", ["APPROVED", "COMPLETED"])
      .ilike("credit_line", "Op. Internacional%")
      .gte("updated_at", yearStart)
      .lte("updated_at", yearEnd);
    for (const row of data ?? []) {
      add(row.updated_at as string, row.approved_value as number | null);
    }
  } else if (sector === "CONSORCIO") {
    const { data } = await db
      .from("consorcio_cartas")
      .select("asking_price, updated_at")
      .eq("status", "VENDIDA")
      .gte("updated_at", yearStart)
      .lte("updated_at", yearEnd);
    for (const row of data ?? []) {
      add(row.updated_at as string, row.asking_price as number | null);
    }
  } else if (sector === "MARKETPLACE") {
    const { data } = await db
      .from("marketplace_leads")
      .select("updated_at, product:marketplace_products(price)")
      .eq("status", "CONVERTED")
      .gte("updated_at", yearStart)
      .lte("updated_at", yearEnd);
    for (const row of (data ?? []) as unknown as { updated_at: string | null; product: { price: number | null } | { price: number | null }[] | null }[]) {
      const product = Array.isArray(row.product) ? row.product[0] : row.product;
      add(row.updated_at, product?.price ?? null);
    }
  } else if (sector === "BOLSA_ATIVOS") {
    // Mesa de Capitais (cm_asset_listings) — todos os tipos de ativo
    // (precatorio, direito_creditorio, cgi, cri, fidc, outros), status "liquidado" como fechado.
    const { data } = await db
      .from("cm_asset_listings")
      .select("valor_face, updated_at")
      .eq("listing_status", "liquidado")
      .gte("updated_at", yearStart)
      .lte("updated_at", yearEnd);
    for (const row of data ?? []) {
      add(row.updated_at as string, row.valor_face as number | null);
    }
  } else if (sector === "ASSINATURAS") {
    // "Venda nova" = primeiro pagamento confirmado de cada partner (não conta renovação).
    // Busca sem filtro de ano pra achar o primeiro pagamento de verdade, mesmo se
    // for de um ano anterior — o add() já ignora o que não é do ano pedido.
    const { data } = await db
      .from("partner_subscriptions")
      .select("partner_id, amount_cents, paid_at")
      .eq("status", "PAID")
      .not("paid_at", "is", null)
      .order("paid_at", { ascending: true });

    const primeiroPagamentoPorPartner = new Map<string, { amount_cents: number; paid_at: string }>();
    for (const row of data ?? []) {
      const partnerId = row.partner_id as string;
      if (!primeiroPagamentoPorPartner.has(partnerId)) {
        primeiroPagamentoPorPartner.set(partnerId, { amount_cents: row.amount_cents as number, paid_at: row.paid_at as string });
      }
    }
    for (const { amount_cents, paid_at } of primeiroPagamentoPorPartner.values()) {
      add(paid_at, (amount_cents ?? 0) / 100);
    }
  }

  return porMes;
}

/**
 * MRR acumulado (receita recorrente ativa) por mês — não é "quanto entrou de caixa
 * no mês", é "quantos partners pagantes estavam com assinatura vigente naquele mês",
 * somando o valor mensal de cada um. Um partner conta em todo mês coberto pelo
 * período [paid_at, due_date) do seu pagamento mais recente até aquele ponto.
 */
export async function getMRRAcumuladoPorMes(db: SupabaseClient, year: number): Promise<Record<number, number>> {
  const mrrPorMes: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) mrrPorMes[m] = 0;

  const { data } = await db
    .from("partner_subscriptions")
    .select("partner_id, amount_cents, paid_at, due_date")
    .eq("status", "PAID")
    .not("paid_at", "is", null)
    .lte("paid_at", `${year}-12-31T23:59:59`);

  const porPartner = new Map<string, { amount_cents: number; paid_at: string; due_date: string }[]>();
  for (const row of (data ?? []) as { partner_id: string; amount_cents: number; paid_at: string; due_date: string }[]) {
    const list = porPartner.get(row.partner_id) ?? [];
    list.push(row);
    porPartner.set(row.partner_id, list);
  }

  for (let month = 1; month <= 12; month++) {
    const inicioMes = new Date(year, month - 1, 1);
    const fimMes = new Date(year, month, 0, 23, 59, 59);

    for (const pagamentos of porPartner.values()) {
      // Entre os pagamentos já feitos até o fim do mês, pega o mais recente
      const validos = pagamentos.filter(p => new Date(p.paid_at) <= fimMes);
      if (validos.length === 0) continue;
      const maisRecente = validos.reduce((a, b) => (new Date(a.paid_at) > new Date(b.paid_at) ? a : b));
      const cobreAte = maisRecente.due_date ? new Date(maisRecente.due_date + "T23:59:59") : null;
      // Considera o partner ainda "ativo" nesse mês se o vencimento do último pagamento
      // não ficou pra trás antes do mês em questão
      if (!cobreAte || cobreAte >= inicioMes) {
        mrrPorMes[month] += (maisRecente.amount_cents ?? 0) / 100;
      }
    }
  }

  return mrrPorMes;
}
