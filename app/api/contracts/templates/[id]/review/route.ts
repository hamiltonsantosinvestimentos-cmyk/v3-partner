import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Grupos de revisor (11/08/2026, decisão de João). A aprovação final de uma
// minuta exige 1 decisão "aprovado" de alguém do grupo JURIDICO + 1 decisão
// "aprovado" de alguém do grupo COMPLIANCE_SOCIO, no mesmo review_round —
// nunca uma pessoa só, e nunca dois do mesmo grupo.
const JURIDICO: Record<string, string> = {
  "82171bc1-edbd-40f8-936b-1b26d412a121": "Dr. Luis Athaydes", // jurídico V3
};
const COMPLIANCE_SOCIO: Record<string, string> = {
  "d5f26efd-8ed5-4d90-b3f4-9ce0004803c5": "Robson Lino", // compliance
  "d0af8eaa-9f3c-4e7a-b8c6-613736524317": "João Lemos", // sócio diretor
  "27a8a72e-965d-48e8-88cf-e5afaf75d167": "Hamilton Santos", // sócio diretor
};

async function getReviewer() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (JURIDICO[user.id]) return { userId: user.id, name: JURIDICO[user.id], type: "juridico" as const };
  if (COMPLIANCE_SOCIO[user.id]) return { userId: user.id, name: COMPLIANCE_SOCIO[user.id], type: "compliance_socio" as const };
  return null;
}

// POST /api/contracts/templates/[id]/review — jurídico ou compliance/sócio
// aprova ou reprova uma minuta em revisão. Pode editar o corpo direto aqui
// (body_text_raw opcional) em vez de só aprovar/reprovar e devolver pro
// autor — pedido explícito de João (11/08/2026): "é importante que o
// jurídico possa operar e fazer alteração dentro dessa visão também".
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reviewer = await getReviewer();
  if (!reviewer)
    return NextResponse.json({ error: "Apenas jurídico (Dr. Luis Athaydes) ou compliance/sócio diretor podem revisar minutas" }, { status: 403 });

  const { id } = await params;
  const { decision, comment, body_text_raw } = await req.json();

  if (!["aprovado", "reprovado"].includes(decision))
    return NextResponse.json({ error: "decision deve ser 'aprovado' ou 'reprovado'" }, { status: 422 });
  if (decision === "reprovado" && !comment?.trim())
    return NextResponse.json({ error: "Reprovação exige comentário explicando o motivo" }, { status: 422 });

  const db = svc();

  const { data: template } = await db
    .from("contract_templates")
    .select("id, approval_status, review_round, body_text_raw, version")
    .eq("id", id)
    .single();

  if (!template) return NextResponse.json({ error: "Minuta não encontrada" }, { status: 404 });
  if (template.approval_status !== "em_revisao")
    return NextResponse.json({ error: `Minuta não está em revisão (status atual: ${template.approval_status})` }, { status: 409 });

  // Revisor pode editar o corpo direto na tela de revisão antes de decidir.
  const bodyEdited = typeof body_text_raw === "string" && body_text_raw.trim() && body_text_raw !== template.body_text_raw;
  if (bodyEdited) {
    const vars = (body_text_raw.match(/\{\{([^}]+)\}\}/g) || []).map((v: string) => v.replace(/\{\{|\}\}/g, "").trim());
    await db.from("contract_templates").update({
      body_text_raw,
      variables_map: vars.map((v: string) => ({ key: v, label: v.replace(/_/g, " "), source: "auto" })),
      version: (template.version ?? 1) + 1,
    }).eq("id", id);
  }

  await db.from("contract_template_reviews").insert({
    template_id: id,
    review_round: template.review_round,
    reviewer_id: reviewer.userId,
    reviewer_name: reviewer.name,
    reviewer_type: reviewer.type,
    decision,
    comment: comment?.trim() || null,
    body_edited: !!bodyEdited,
  });

  if (decision === "reprovado") {
    await db.from("contract_templates").update({ approval_status: "reprovado" }).eq("id", id);
    return NextResponse.json({ approval_status: "reprovado" });
  }

  // decision === "aprovado": checar se o quórum do round atual já fechou
  // (1 aprovado de cada grupo, podendo ser este próprio voto).
  const { data: roundReviews } = await db
    .from("contract_template_reviews")
    .select("reviewer_type, decision")
    .eq("template_id", id)
    .eq("review_round", template.review_round);

  const hasJuridico = (roundReviews ?? []).some((r) => r.reviewer_type === "juridico" && r.decision === "aprovado");
  const hasComplianceSocio = (roundReviews ?? []).some((r) => r.reviewer_type === "compliance_socio" && r.decision === "aprovado");
  const quorumMet = hasJuridico && hasComplianceSocio;

  if (quorumMet) {
    await db.from("contract_templates").update({ approval_status: "aprovado" }).eq("id", id);
  }

  return NextResponse.json({
    approval_status: quorumMet ? "aprovado" : "em_revisao",
    quorum: { juridico: hasJuridico, compliance_socio: hasComplianceSocio, met: quorumMet },
    message: quorumMet
      ? "Quórum atingido (jurídico + compliance/sócio). Minuta aprovada, liberada para gerar contrato."
      : `Aprovação de ${reviewer.type === "juridico" ? "jurídico" : "compliance/sócio"} registrada. Aguardando aprovação de ${hasJuridico ? "compliance/sócio" : "jurídico"}.`,
  });
}

// GET /api/contracts/templates/[id]/review — histórico de revisões da minuta.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reviewer = await getReviewer();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  // Leitura também liberada pra quem só administra minutas (ADMIN/GESTAO),
  // não só quem pode votar.
  if (!reviewer) {
    const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !["ADMIN", "GESTAO"].includes(profile.role as string))
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const { data, error } = await svc()
    .from("contract_template_reviews")
    .select("*")
    .eq("template_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reviews: data ?? [] });
}
