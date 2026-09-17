import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import {
  reconcilePartnerLinkOrderPaid,
  reconcileDirectOrderPaid,
  type PartnerLinkOrderRow,
  type DirectOrderRow,
} from "@/lib/cora-order-reconcile";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

interface RouteParams { params: Promise<{ id: string }> }

// POST — confirmação manual de pagamento de um pedido (partner_service_orders),
// pra quando o webhook da Cora falha ou atrasa (Pix fora do fluxo, confirmado
// por comprovante, etc.) e a Mesa não pode esperar: sem status=PAID, nem
// link-proposal nem o resto do pipeline de Pedidos de Partners libera (ver
// gate em link-proposal/route.ts:49-51). Espelha o mesmo reconciliamento que
// o webhook roda de verdade (app/api/cora/webhook/route.ts) — marcar "pago"
// sem gerar intake_token/consentimento deixaria o pedido pago mas travado.
// paid:false é só a correção do status (engano ao marcar manual); não desfaz
// e-mails/consentimento já gerados numa marcação anterior.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as typeof ALLOWED_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { paid?: boolean };
  if (typeof body.paid !== "boolean") {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const svc = serviceClient();

  if (!body.paid) {
    const { error } = await svc
      .from("partner_service_orders")
      .update({ status: "PENDING", paid_at: null })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { data: order, error: orderErr } = await svc
    .from("partner_service_orders")
    .select(`
      id, partner_id, client_name, client_email, client_doc, status, link_id, source,
      ref_partner_id, service_type, amount_cents, cnpj_count, cpf_count, has_consultancy, ma_deal_id,
      partner_service_links(title, service_type, price_cents),
      partner:profiles!partner_id(full_name),
      ref_partner:profiles!ref_partner_id(full_name, email)
    `)
    .eq("id", id)
    .single();

  if (orderErr || !order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  if (order.status === "PAID") return NextResponse.json({ ok: true, already: true });

  const paidAt = new Date().toISOString();

  try {
    if (order.link_id) {
      await reconcilePartnerLinkOrderPaid(svc, order as unknown as PartnerLinkOrderRow, paidAt);
    } else {
      await reconcileDirectOrderPaid(svc, order as unknown as DirectOrderRow, paidAt);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao confirmar pagamento";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
