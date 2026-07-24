import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export type DealLookupParticipant = { name: string; email: string; role: string };

export type DealLookupResult = {
  found: true;
  source: "ma_deals" | "credit_desk_proposals" | "deal_intakes";
  deal: { id: string; code: string; title: string; sector: string | null; value: number | null };
  participants: DealLookupParticipant[];
} | {
  found: false;
};

/**
 * Busca um deal por código digitado pelo usuário, tentando nesta ordem:
 * ma_deals (code, v3_code ou legacy_code) → credit_desk_proposals (code) → deal_intakes (deal_code).
 * Usada pelo fluxo de Mandato TEC e pelo módulo de Propostas Comerciais.
 */
export async function lookupDealByCode(code: string): Promise<DealLookupResult> {
  const db = svc();

  // 1. ma_deals (code, v3_code ou legacy_code)
  const { data: deal } = await db
    .from("ma_deals")
    .select("id, code, v3_code, legacy_code, title, sector, asset_data, status")
    .or(`code.eq.${code},v3_code.eq.${code},legacy_code.eq.${code}`)
    .limit(1)
    .single();

  if (deal) {
    const asset = (deal.asset_data as Record<string, unknown>) ?? {};
    const participants: DealLookupParticipant[] = [];

    if (asset.contact_name) participants.push({ name: String(asset.contact_name), email: String(asset.contact_email ?? ""), role: "cliente" });
    if (asset.partner_name) participants.push({ name: String(asset.partner_name), email: String(asset.partner_email ?? ""), role: "partner" });
    if (asset.seller_name) participants.push({ name: String(asset.seller_name), email: String(asset.seller_email ?? ""), role: "vendedor" });

    const compra = asset.pedido_compra as Record<string, unknown> | undefined;
    if (compra?.contato_nome) {
      participants.push({
        name: String(compra.contato_nome),
        email: String(compra.contato_email ?? ""),
        role: "comprador",
      });
    }

    return {
      found: true,
      source: "ma_deals",
      deal: {
        id: deal.id,
        code: deal.code || deal.v3_code || deal.legacy_code,
        title: deal.title,
        sector: deal.sector,
        value: (asset.valor_operacao as number | undefined) ?? null,
      },
      participants,
    };
  }

  // 2. credit_desk_proposals
  const { data: credit } = await db
    .from("credit_desk_proposals")
    .select("id, code, client_name, client_email, requested_value, credit_line, status")
    .eq("code", code)
    .limit(1)
    .single();

  if (credit) {
    return {
      found: true,
      source: "credit_desk_proposals",
      deal: { id: credit.id, code: credit.code, title: `Crédito — ${credit.client_name}`, sector: credit.credit_line, value: credit.requested_value },
      participants: [{ name: credit.client_name, email: credit.client_email ?? "", role: "cliente" }],
    };
  }

  // 3. deal_intakes
  const { data: intake } = await db
    .from("deal_intakes")
    .select("id, deal_code, contact_name, contact_email, sector, estimated_value")
    .eq("deal_code", code)
    .limit(1)
    .single();

  if (intake) {
    return {
      found: true,
      source: "deal_intakes",
      deal: { id: intake.id, code: intake.deal_code, title: `Intake — ${intake.contact_name}`, sector: intake.sector, value: intake.estimated_value },
      participants: [{ name: intake.contact_name, email: intake.contact_email ?? "", role: "cliente" }],
    };
  }

  return { found: false };
}
