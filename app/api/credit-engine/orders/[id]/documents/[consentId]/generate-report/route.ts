import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { generateAndStoreCreditReportPdf } from "@/lib/credit-report-generate";

// Gera o relatório de UM documento adicional do pedido (sócio/garantidor CPF,
// ou 2º+ CNPJ do grupo) — espelha app/api/credit-engine/orders/[id]/generate-report,
// mas grava o token em credit_consents em vez de partner_service_orders,
// porque aqui pode haver mais de um relatório por pedido.

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

interface RouteParams { params: Promise<{ id: string; consentId: string }> }

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { id, consentId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as typeof ALLOWED_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const svc = serviceClient();

  const { data: consent, error: consentErr } = await svc
    .from("credit_consents")
    .select("id, partner_service_order_id, credit_desk_proposal_id")
    .eq("id", consentId)
    .single();
  if (consentErr || !consent || consent.partner_service_order_id !== id) {
    return NextResponse.json({ error: "Documento não encontrado neste pedido" }, { status: 404 });
  }
  if (!consent.credit_desk_proposal_id) {
    return NextResponse.json({ error: "Este documento ainda não foi vinculado a uma proposta" }, { status: 409 });
  }

  const { data: proposal } = await svc
    .from("credit_desk_proposals")
    .select("credit_profile_id")
    .eq("id", consent.credit_desk_proposal_id)
    .single();
  if (!proposal?.credit_profile_id) {
    return NextResponse.json({ error: "Análise ainda não foi rodada para este documento" }, { status: 409 });
  }

  const result = await generateAndStoreCreditReportPdf(proposal.credit_profile_id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  const reportToken = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 8);

  const { error: updateErr } = await svc
    .from("credit_consents")
    .update({ report_public_token: reportToken, report_pdf_path: result.pdf_path, report_delivered_at: null })
    .eq("id", consentId);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ success: true, report_public_token: reportToken, pdf_url: result.pdf_url });
}
