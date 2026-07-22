import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as typeof ALLOWED_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");

  const svc = serviceClient();

  const { data: orders, error } = await svc
    .from("partner_service_orders")
    .select(`
      id, partner_id, client_name, client_email, client_doc, amount_cents, status,
      paid_at, intake_token, intake_submitted_at, credit_desk_proposal_id,
      report_public_token, report_delivered_at, created_at,
      partner_service_links(title, service_type),
      credit_desk_proposals(id, credit_profile_id, status),
      partner:profiles!partner_id(full_name)
    `)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type OrderRow = typeof orders extends (infer T)[] ? T : never;

  let filtered = ((orders ?? []) as OrderRow[]).filter((o) => {
    const link = o.partner_service_links as unknown as { service_type?: string } | null;
    return link?.service_type === "credit_analysis";
  });

  if (statusFilter) {
    filtered = filtered.filter((o) => (o as { status: string }).status === statusFilter.toUpperCase());
  }

  const tokens = filtered.map((o) => (o as { intake_token: string | null }).intake_token).filter(Boolean) as string[];

  let consentsByToken: Record<string, { status: string; registrato_pdf_path: string | null }> = {};
  if (tokens.length > 0) {
    const { data: consents } = await svc
      .from("credit_consents")
      .select("intake_token, status, registrato_pdf_path")
      .in("intake_token", tokens);
    consentsByToken = Object.fromEntries((consents ?? []).map((c) => [c.intake_token, c]));
  }

  const result = filtered.map((o) => {
    const row = o as unknown as {
      id: string; partner_id: string; client_name: string; client_email: string; client_doc: string;
      amount_cents: number; status: string; paid_at: string | null; intake_token: string | null;
      intake_submitted_at: string | null; credit_desk_proposal_id: string | null;
      report_public_token: string | null; report_delivered_at: string | null; created_at: string;
      partner_service_links: { title?: string } | null;
      credit_desk_proposals: { id: string; credit_profile_id: string | null; status: string } | null;
      partner: { full_name?: string } | null;
    };
    const consent = row.intake_token ? consentsByToken[row.intake_token] : null;
    return {
      id: row.id,
      client_name: row.client_name,
      client_email: row.client_email,
      client_doc: row.client_doc,
      partner_name: row.partner?.full_name ?? null,
      service_title: row.partner_service_links?.title ?? "Análise de Crédito Empresarial",
      amount_cents: row.amount_cents,
      status: row.status,
      paid_at: row.paid_at,
      consent_status: consent?.status ?? "pending",
      registrato_uploaded: Boolean(consent?.registrato_pdf_path),
      credit_desk_proposal_id: row.credit_desk_proposal_id,
      credit_profile_id: row.credit_desk_proposals?.credit_profile_id ?? null,
      report_public_token: row.report_public_token,
      report_delivered_at: row.report_delivered_at,
      created_at: row.created_at,
    };
  });

  return NextResponse.json({ orders: result });
}
