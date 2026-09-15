import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const READ_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"] as const;

// GET — status do Link de Serviço (partner_service_links, /meus-links) mais
// recente vinculado a esta proposta de Crédito ou Deal de M&A (14/09/2026,
// pedido de João: "visualizar também no deal do ativo o status do link
// gerado"). Espelha /api/credit-proposals/analise-status e
// /api/ma-deals/analise-status, que já fazem o mesmo pro link "?prop="
// separado (analise_link_opens/partner_service_orders) -- aqui é sobre o
// outro mecanismo de link, o self-service de partner_service_links.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  const { searchParams } = new URL(req.url);
  const dealType = searchParams.get("deal_type") === "ma" ? "ma" : "credit";
  const dealId = searchParams.get("deal_id");
  if (!dealId) return NextResponse.json({ error: "deal_id obrigatório" }, { status: 400 });

  const svcDb = svc();

  // Confirma posse/permissão antes de responder, mesmo padrão dos irmãos
  // analise-status.
  if (dealType === "ma") {
    const { data: deal } = await svcDb.from("ma_deals").select("id, created_by, assigned_to").eq("id", dealId).single();
    if (!deal) return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });
    const isReader = READ_ROLES.includes(profile?.role as typeof READ_ROLES[number]);
    const isOwner = deal.created_by === user.id || deal.assigned_to === user.id;
    if (!isReader && !isOwner) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  } else {
    const { data: prop } = await svcDb.from("credit_desk_proposals").select("id, partner_id").eq("id", dealId).single();
    if (!prop) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
    const isReader = READ_ROLES.includes(profile?.role as typeof READ_ROLES[number]);
    if (!isReader && prop.partner_id !== user.id) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const column = dealType === "ma" ? "ma_deal_id" : "credit_desk_proposal_id";
  const { data: link } = await svcDb
    .from("partner_service_links")
    .select("id, title, active, expires_at, total_uses, total_paid_cents, created_at")
    .eq(column, dealId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ link: link ?? null });
}
