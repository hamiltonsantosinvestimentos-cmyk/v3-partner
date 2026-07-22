import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as typeof ALLOWED_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const svc = serviceClient();

  const { data: order, error: orderErr } = await svc
    .from("partner_service_orders")
    .select("id, partner_id, client_name, client_email, client_doc, amount_cents, status, intake_token, credit_desk_proposal_id, partner_service_links(service_type)")
    .eq("id", id)
    .single();

  if (orderErr || !order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  const link = order.partner_service_links as unknown as { service_type?: string } | null;
  if (link?.service_type !== "credit_analysis") {
    return NextResponse.json({ error: "Este pedido não é de Análise de Crédito" }, { status: 422 });
  }
  if (order.status !== "PAID") {
    return NextResponse.json({ error: "Pedido ainda não foi pago" }, { status: 422 });
  }
  if (order.credit_desk_proposal_id) {
    return NextResponse.json({ error: "Pedido já está vinculado a uma proposta" }, { status: 409 });
  }

  // client_doc já vem do pedido; se o cliente já preencheu o consentimento, usar o CPF/CNPJ confirmado lá.
  let clientCpfCnpj = order.client_doc;
  if (order.intake_token) {
    const { data: consent } = await svc
      .from("credit_consents")
      .select("subject_cpf_cnpj")
      .eq("intake_token", order.intake_token)
      .single();
    if (consent?.subject_cpf_cnpj) clientCpfCnpj = consent.subject_cpf_cnpj;
  }

  const { count } = await svc.from("credit_desk_proposals").select("id", { count: "exact", head: true });
  const code = `CRED-26-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { data: proposal, error: propErr } = await svc
    .from("credit_desk_proposals")
    .insert({
      code,
      title: `Análise de Crédito · ${order.client_name}`,
      client_name: order.client_name,
      client_cpf_cnpj: clientCpfCnpj,
      credit_line: "ANALISE_AVULSA",
      requested_value: (order.amount_cents ?? 0) / 100,
      current_level: "NIVEL_1",
      status: "PENDING",
      stage: "RECEBIDO",
      partner_id: order.partner_id,
      created_by: user.id,
      metadata: {
        source: "partner_service_order",
        partner_service_order_id: order.id,
        client_email: order.client_email,
      },
    })
    .select()
    .single();

  if (propErr || !proposal) {
    return NextResponse.json({ error: propErr?.message ?? "Falha ao criar proposta" }, { status: 500 });
  }

  const { error: updateErr } = await svc
    .from("partner_service_orders")
    .update({ credit_desk_proposal_id: proposal.id })
    .eq("id", order.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ success: true, proposal });
}
