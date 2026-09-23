import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { logAudit, getClientIp } from "@/lib/audit";

export const dynamic = "force-dynamic";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Ação destrutiva: só ADMIN e GESTAO (mesmo nível do "Excluir análise").
const ALLOWED_ROLES = ["ADMIN", "GESTAO"] as const;

interface RouteParams { params: Promise<{ id: string }> }

// DELETE — exclui a solicitação (partner_service_orders) da lista de Pedidos de Partners.
// Uso: limpar pedidos que nunca foram pagos (decisão 22/09/2026, a limpeza é manual).
// Bloqueado quando o pedido já gerou comissão ou já teve relatório entregue: aí existe
// rastro financeiro/cliente que não pode ficar órfão. Consentimentos de documentos
// adicionais caem junto (FK ON DELETE CASCADE); proposta de crédito vinculada, se houver,
// não é apagada.
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as typeof ALLOWED_ROLES[number])) {
    return NextResponse.json({ error: "Apenas ADMIN e GESTAO podem excluir solicitações" }, { status: 403 });
  }

  const svc = serviceClient();
  const { data: order, error: getErr } = await svc
    .from("partner_service_orders")
    .select("id, client_name, client_doc, partner_id, source, status, amount_cents, paid_at, credit_desk_proposal_id, partner_commission_id, report_delivered_at, created_at")
    .eq("id", id)
    .maybeSingle();
  if (getErr) return NextResponse.json({ error: getErr.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 });

  if (order.partner_commission_id) {
    return NextResponse.json({ error: "Esta solicitação já gerou comissão para o partner e não pode ser excluída." }, { status: 409 });
  }
  if (order.report_delivered_at) {
    return NextResponse.json({ error: "O relatório desta solicitação já foi entregue ao cliente e ela não pode ser excluída." }, { status: 409 });
  }

  const { error: delErr } = await svc.from("partner_service_orders").delete().eq("id", id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  await logAudit({
    userId: user.id,
    userName: (profile.full_name as string | null) ?? null,
    action: "DELETE",
    entity: "partner_service_orders",
    entityId: id,
    oldData: order,
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ success: true });
}
