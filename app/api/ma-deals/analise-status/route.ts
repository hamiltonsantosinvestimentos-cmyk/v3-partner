import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const READ_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"] as const;

// GET — status do pedido de Análise de Crédito mais recente vinculado a este
// Deal de M&A (link gerado via ?prop=<code>&deal_type=ma em /analise-v2, ou
// via dropdown em Meus Links de Serviço). Espelha
// /api/credit-proposals/analise-status (26/08/2026), estendido pra Mesa M&A
// (09/09/2026).
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  const dealId = new URL(req.url).searchParams.get("deal_id");
  if (!dealId) return NextResponse.json({ error: "deal_id obrigatório" }, { status: 400 });

  const svc = serviceClient();
  const { data: deal } = await svc
    .from("ma_deals")
    .select("id, created_by, assigned_to")
    .eq("id", dealId)
    .single();

  if (!deal) return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });

  const isReader = READ_ROLES.includes(profile?.role as typeof READ_ROLES[number]);
  const isOwner = deal.created_by === user.id || deal.assigned_to === user.id;
  if (!isReader && !isOwner) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { data: order } = await svc
    .from("partner_service_orders")
    .select("id, status, amount_cents, client_name, client_email, created_at, paid_at")
    .eq("ma_deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ order: order ?? null });
}
