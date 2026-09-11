import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

// Documentos ADICIONAIS de um pedido de Análise de Crédito Empresarial (CNPJ
// com sócio/garantidor, ou grupo com mais de 1 CNPJ) — o documento principal
// do pedido continua no fluxo de sempre (partner_service_orders.intake_token),
// isto aqui é só para o que sobra do cnpj_count/cpf_count contratado.
//
// GET  /api/credit-engine/orders/[id]/documents — lista os documentos
//      adicionais já cadastrados (com status do consentimento LGPD)
// POST /api/credit-engine/orders/[id]/documents — Mesa registra um documento
//      adicional e gera o link de consentimento pra esse documento

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;
const EXPIRES_HOURS = 72;

interface RouteParams { params: Promise<{ id: string }> }

async function requireRole(): Promise<{ userId: string } | NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as typeof ALLOWED_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  return { userId: user.id };
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireRole();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const db = svc();
  const { data: docs, error } = await db
    .from("credit_consents")
    .select("id, subject_cpf_cnpj, document_label, status, intake_token, registrato_pdf_path, credit_desk_proposal_id, report_public_token, report_delivered_at, created_at")
    .eq("partner_service_order_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // credit_profile_id não está direto em credit_consents — busca via a(s)
  // proposta(s) vinculada(s) pra cada documento, quando já houver.
  const proposalIds = (docs ?? []).map((d) => d.credit_desk_proposal_id).filter(Boolean) as string[];
  let profileByProposal: Record<string, string> = {};
  if (proposalIds.length > 0) {
    const { data: proposals } = await db
      .from("credit_desk_proposals")
      .select("id, credit_profile_id")
      .in("id", proposalIds);
    profileByProposal = Object.fromEntries((proposals ?? []).map((p) => [p.id, p.credit_profile_id]).filter(([, v]) => v));
  }

  const documents = (docs ?? []).map((d) => ({
    id: d.id,
    doc: d.subject_cpf_cnpj,
    label: d.document_label,
    consent_status: d.status,
    intake_token: d.intake_token,
    registrato_uploaded: Boolean(d.registrato_pdf_path),
    credit_desk_proposal_id: d.credit_desk_proposal_id,
    credit_profile_id: d.credit_desk_proposal_id ? profileByProposal[d.credit_desk_proposal_id] ?? null : null,
    report_public_token: d.report_public_token,
    report_delivered_at: d.report_delivered_at,
  }));

  return NextResponse.json({ documents });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await requireRole();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const body = await req.json().catch(() => ({})) as { doc_type?: string; doc_value?: string; label?: string };
  const docDigits = (body.doc_value ?? "").replace(/\D/g, "");
  if (!docDigits || (docDigits.length !== 11 && docDigits.length !== 14)) {
    return NextResponse.json({ error: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido" }, { status: 400 });
  }
  const label = body.label?.trim() || (docDigits.length === 11 ? "Sócio/garantidor" : "CNPJ adicional");

  const db = svc();
  const { data: order, error: orderErr } = await db
    .from("partner_service_orders")
    .select("id, client_name, client_email, status, service_type, partner_service_links(service_type)")
    .eq("id", id)
    .single();
  if (orderErr || !order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  const link = order.partner_service_links as unknown as { service_type?: string } | null;
  const CREDIT_TYPES = ["credit_analysis", "credit_analysis_consultoria"];
  const isCreditOrder = link?.service_type === "credit_analysis" || CREDIT_TYPES.includes(order.service_type ?? "");
  if (!isCreditOrder) return NextResponse.json({ error: "Este pedido não é de Análise de Crédito" }, { status: 422 });
  if (order.status !== "PAID") return NextResponse.json({ error: "Pedido ainda não foi pago" }, { status: 422 });

  const token = randomBytes(24).toString("hex");
  const expires = new Date();
  expires.setHours(expires.getHours() + EXPIRES_HOURS);

  const { data: consent, error: insertErr } = await db
    .from("credit_consents")
    .insert({
      subject_cpf_cnpj: docDigits,
      subject_name: order.client_name,
      subject_email: order.client_email ?? null,
      intake_token: token,
      intake_expires_at: expires.toISOString(),
      consent_scope: ["registrato_bacen"],
      status: "pending",
      partner_service_order_id: id,
      document_label: label,
      requested_by: auth.userId,
    })
    .select("id, intake_token")
    .single();

  if (insertErr || !consent) {
    return NextResponse.json({ error: insertErr?.message ?? "Falha ao gerar link" }, { status: 500 });
  }

  const host = req.headers.get("host") ?? "app.v3partners.com.br";
  const protocol = host.includes("localhost") ? "http" : "https";
  const url = `${protocol}://${host}/intake/credit/${consent.intake_token}`;

  return NextResponse.json({ id: consent.id, url, expires_at: expires.toISOString() });
}
