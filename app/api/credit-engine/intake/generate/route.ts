import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

// Authenticated endpoint: Mesa gera link publico de consentimento + upload do
// Registrato para uma proposta de credito ja existente.
// POST /api/credit-engine/intake/generate
// Body: { proposal_id: string }

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;
const EXPIRES_HOURS = 72;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!ALLOWED_ROLES.includes(profile?.role as typeof ALLOWED_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { proposal_id?: string };
  if (!body.proposal_id) return NextResponse.json({ error: "proposal_id obrigatório" }, { status: 400 });

  const db = svc();
  const { data: proposal, error: propErr } = await db
    .from("credit_desk_proposals")
    .select("id, client_name, client_cpf_cnpj, client_email")
    .eq("id", body.proposal_id)
    .single();

  if (propErr || !proposal) {
    return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  }

  // Reaproveita consent pendente existente para a mesma proposta em vez de duplicar
  const { data: existing } = await db
    .from("credit_consents")
    .select("id, intake_token, intake_expires_at")
    .eq("deal_proposal_id", proposal.id)
    .eq("status", "pending")
    .gt("intake_expires_at", new Date().toISOString())
    .maybeSingle();

  let token: string;
  let expiresAt: string;

  if (existing) {
    token = existing.intake_token as string;
    expiresAt = existing.intake_expires_at as string;
  } else {
    token = randomBytes(24).toString("hex");
    const expires = new Date();
    expires.setHours(expires.getHours() + EXPIRES_HOURS);
    expiresAt = expires.toISOString();

    const { error: insertErr } = await db.from("credit_consents").insert({
      subject_cpf_cnpj: proposal.client_cpf_cnpj,
      subject_name: proposal.client_name,
      subject_email: proposal.client_email ?? null,
      intake_token: token,
      intake_expires_at: expiresAt,
      consent_scope: ["registrato_bacen"],
      status: "pending",
      deal_proposal_id: proposal.id,
      requested_by: user.id,
    });

    if (insertErr) {
      return NextResponse.json({ error: "Falha ao gerar link: " + insertErr.message }, { status: 500 });
    }
  }

  const host = req.headers.get("host") ?? "app.v3partners.com.br";
  const protocol = host.includes("localhost") ? "http" : "https";
  const url = `${protocol}://${host}/intake/credit/${token}`;

  return NextResponse.json({ token, url, expires_at: expiresAt });
}
