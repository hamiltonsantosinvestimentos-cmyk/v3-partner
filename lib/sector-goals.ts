import type { SupabaseClient } from "@supabase/supabase-js";

export const SECTORS = ["MA", "CREDITO", "CONSORCIO", "PRECATORIOS", "MARKETPLACE"] as const;
export type Sector = typeof SECTORS[number];

export const SECTOR_LABELS: Record<Sector, string> = {
  MA: "M&A",
  CREDITO: "Crédito",
  CONSORCIO: "Consórcio",
  PRECATORIOS: "Precatórios",
  MARKETPLACE: "Marketplace",
};

export function isValidSector(v: string): v is Sector {
  return (SECTORS as readonly string[]).includes(v);
}

/** Soma valores reais por mês (1-12) para o setor/ano informado, a partir dos dados operacionais reais. */
export async function getRealizadoPorMes(db: SupabaseClient, sector: Sector, year: number): Promise<Record<number, number>> {
  const porMes: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) porMes[m] = 0;

  const add = (dateStr: string | null | undefined, value: number | null | undefined) => {
    if (!dateStr || !value) return;
    const d = new Date(dateStr);
    if (d.getFullYear() !== year) return;
    const m = d.getMonth() + 1;
    porMes[m] = (porMes[m] ?? 0) + value;
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
    const { data } = await db
      .from("credit_desk_proposals")
      .select("approved_value, updated_at")
      .in("status", ["APPROVED", "COMPLETED"])
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
  } else if (sector === "PRECATORIOS") {
    // Proxy: não existe pipeline dedicado de precatórios ainda — usa Mesa de Capitais
    // (cm_asset_listings) filtrando o tipo de ativo, status "liquidado" como fechado.
    const { data } = await db
      .from("cm_asset_listings")
      .select("valor_face, updated_at")
      .eq("asset_type", "precatorio")
      .eq("listing_status", "liquidado")
      .gte("updated_at", yearStart)
      .lte("updated_at", yearEnd);
    for (const row of data ?? []) {
      add(row.updated_at as string, row.valor_face as number | null);
    }
  }

  return porMes;
}
