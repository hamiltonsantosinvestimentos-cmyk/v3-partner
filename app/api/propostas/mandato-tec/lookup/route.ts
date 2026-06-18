import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const code = req.nextUrl.searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ error: "Parâmetro 'code' obrigatório" }, { status: 422 });

  // 1. ma_deals (v3_code ou legacy_code)
  const { data: deal } = await svc()
    .from("ma_deals")
    .select("id, v3_code, legacy_code, title, sector, asset_data, status")
    .or(`v3_code.eq.${code},legacy_code.eq.${code}`)
    .limit(1)
    .single();

  if (deal) {
    const asset = deal.asset_data as Record<string, unknown> ?? {};
    const participants: Array<{ name: string; email: string; role: string }> = [];

    if (asset.contact_name) participants.push({ name: String(asset.contact_name), email: String(asset.contact_email ?? ""), role: "cliente" });
    if (asset.partner_name) participants.push({ name: String(asset.partner_name), email: String(asset.partner_email ?? ""), role: "partner" });
    if (asset.seller_name) participants.push({ name: String(asset.seller_name), email: String(asset.seller_email ?? ""), role: "vendedor" });

    return NextResponse.json({
      found: true, source: "ma_deals",
      deal: { id: deal.id, code: deal.v3_code || deal.legacy_code, title: deal.title, sector: deal.sector, value: asset.valor_operacao ?? null },
      participants,
    });
  }

  // 2. credit_desk_proposals
  const { data: credit } = await svc()
    .from("credit_desk_proposals")
    .select("id, code, client_name, client_email, requested_value, credit_line, status")
    .eq("code", code)
    .limit(1)
    .single();

  if (credit) {
    return NextResponse.json({
      found: true, source: "credit_desk_proposals",
      deal: { id: credit.id, code: credit.code, title: `Crédito — ${credit.client_name}`, sector: credit.credit_line, value: credit.requested_value },
      participants: [{ name: credit.client_name, email: credit.client_email ?? "", role: "cliente" }],
    });
  }

  // 3. deal_intakes
  const { data: intake } = await svc()
    .from("deal_intakes")
    .select("id, deal_code, contact_name, contact_email, sector, estimated_value")
    .eq("deal_code", code)
    .limit(1)
    .single();

  if (intake) {
    return NextResponse.json({
      found: true, source: "deal_intakes",
      deal: { id: intake.id, code: intake.deal_code, title: `Intake — ${intake.contact_name}`, sector: intake.sector, value: intake.estimated_value },
      participants: [{ name: intake.contact_name, email: intake.contact_email ?? "", role: "cliente" }],
    });
  }

  return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });
}
