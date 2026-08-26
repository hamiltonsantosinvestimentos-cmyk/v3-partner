import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const READ_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"] as const;

// GET — status do pedido de Análise de Crédito mais recente vinculado a esta
// proposta (link gerado no modal via ?prop=<code> em /analise-v2). Usado pra
// mostrar "aguardando pagamento" / "pago em dd/mm" sem precisar passar pela
// fila manual de "Pedidos de Partners".
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  const proposalId = new URL(req.url).searchParams.get("proposal_id");
  if (!proposalId) return NextResponse.json({ error: "proposal_id obrigatório" }, { status: 400 });

  const svc = serviceClient();
  const { data: proposal } = await svc
    .from("credit_desk_proposals")
    .select("id, partner_id")
    .eq("id", proposalId)
    .single();

  if (!proposal) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });

  const isReader = READ_ROLES.includes(profile?.role as typeof READ_ROLES[number]);
  if (!isReader && proposal.partner_id !== user.id) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { data: order } = await svc
    .from("partner_service_orders")
    .select("id, status, amount_cents, client_name, client_email, created_at, paid_at")
    .eq("credit_desk_proposal_id", proposalId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ order: order ?? null });
}
