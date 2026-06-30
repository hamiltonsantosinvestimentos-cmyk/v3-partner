import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !ALLOWED_ROLES.includes(profile.role as typeof ALLOWED_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const { proposal_id } = body;
  if (!proposal_id) return NextResponse.json({ error: "proposal_id obrigatório" }, { status: 400 });

  const svc = serviceClient();
  const { data: proposal, error: propErr } = await svc
    .from("credit_desk_proposals")
    .select("id, client_name, client_cpf_cnpj, credit_line, requested_value, current_level")
    .eq("id", proposal_id)
    .single();

  if (propErr || !proposal) {
    return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  }

  const rawDoc = (proposal.client_cpf_cnpj ?? "").replace(/\D/g, "");
  const subject_type = rawDoc.length === 14 ? "PJ" : "PF";

  const webhookRes = await fetch("https://n8n-514n.onrender.com/webhook/v3-credit-engine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      proposal_id: proposal.id,
      subject_name: proposal.client_name,
      subject_cpf_cnpj: proposal.client_cpf_cnpj,
      subject_type,
      analysis_type: "COMPLETA",
      credit_line: proposal.credit_line,
      requested_value: proposal.requested_value,
      current_level: proposal.current_level,
      requested_by: user.id,
    }),
  });

  if (!webhookRes.ok) {
    const txt = await webhookRes.text().catch(() => "");
    return NextResponse.json(
      { error: `Falha no motor de crédito: ${txt || webhookRes.status}` },
      { status: 502 }
    );
  }

  const result = await webhookRes.json();
  return NextResponse.json(result);
}
