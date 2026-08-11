import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Hamilton tem 2 contas: 27a8a72e... (hamilton@, PARTNER_PRO, conta de
// demonstração pra prospects/partners) e 75c6cac4... (suporte@, ADMIN, conta
// real dele). Achado real 11/08/2026: este array usava a conta de demo desde
// sempre — Hamilton nunca conseguiu aprovar contrato com a conta admin real,
// sempre tomaria 403 mesmo sendo sócio de verdade. Corrigido.
const SOCIOS = [
  "d0af8eaa-9f3c-4e7a-b8c6-613736524317", // João Lemos
  "75c6cac4-8d30-436e-b9a6-d5d494d7470b", // Hamilton Santos (conta admin real, suporte@)
  "d5f26efd-8ed5-4d90-b3f4-9ce0004803c5", // Robson Lino
];

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!SOCIOS.includes(user.id))
    return NextResponse.json({ error: "Apenas sócios podem aprovar contratos (João, Hamilton, Robson)" }, { status: 403 });

  const { data: profile } = await svc().from("profiles").select("full_name").eq("id", user.id).single();

  const { contract_id, decision, comment } = await req.json();

  if (!contract_id || !decision)
    return NextResponse.json({ error: "contract_id e decision obrigatórios" }, { status: 422 });

  if (!["aprovado", "reprovado"].includes(decision))
    return NextResponse.json({ error: "decision deve ser 'aprovado' ou 'reprovado'" }, { status: 422 });

  const { data: existing } = await svc()
    .from("contract_approvals")
    .select("id")
    .eq("contract_id", contract_id)
    .eq("approver_id", user.id)
    .single();

  if (existing)
    return NextResponse.json({ error: "Você já votou neste contrato" }, { status: 409 });

  const { data: contract } = await svc()
    .from("operation_contracts")
    .select("id, status_signature")
    .eq("id", contract_id)
    .single();

  if (!contract)
    return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });

  if (contract.status_signature === "assinado")
    return NextResponse.json({ error: "Contrato já assinado — não pode ser alterado" }, { status: 409 });

  const { data: approval, error } = await svc()
    .from("contract_approvals")
    .insert({
      contract_id,
      approver_id: user.id,
      approver_name: profile?.full_name ?? "Sócio",
      decision,
      comment: comment ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: allApprovals } = await svc()
    .from("contract_approvals")
    .select("approver_name, decision")
    .eq("contract_id", contract_id);

  const approvedCount = (allApprovals ?? []).filter((a: any) => a.decision === "aprovado").length;
  const quorumMet = approvedCount >= 2;

  return NextResponse.json({
    approval,
    quorum: { approved: approvedCount, required: 2, met: quorumMet },
    message: quorumMet
      ? "Quórum atingido (2/3 sócios). Contrato liberado para assinatura."
      : decision === "reprovado"
        ? "Contrato reprovado. Nova rodada de aprovação necessária após revisão."
        : `Aprovação registrada (${approvedCount}/2). Aguardando mais ${2 - approvedCount} sócio(s).`,
  }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const contractId = new URL(req.url).searchParams.get("contract_id");
  if (!contractId) return NextResponse.json({ error: "contract_id obrigatório" }, { status: 422 });

  const { data, error } = await svc()
    .from("contract_approvals")
    .select("*")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const approved = (data ?? []).filter((a: any) => a.decision === "aprovado").length;

  return NextResponse.json({
    approvals: data ?? [],
    quorum: { approved, required: 2, met: approved >= 2 },
  });
}
