import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

import { logAgentAuditEvent } from "@/lib/socios-notify";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Grupos de revisor (11/08/2026, decisão de João). A aprovação final de uma
// minuta fecha quórum por dois caminhos possíveis, no mesmo review_round:
// (a) 1 decisão "aprovado" de alguém do grupo JURIDICO + 1 decisão
// "aprovado" de alguém do grupo COMPLIANCE_SOCIO; ou (b) 2 dos 3 sócios
// diretores (COMPLIANCE_SOCIO) aprovando, dispensando o jurídico —
// maioria de sócios adicionada em 17/08/2026, decisão de João.
const JURIDICO: Record<string, string> = {
  "82171bc1-edbd-40f8-936b-1b26d412a121": "Dr. Luis Athaydes", // jurídico V3
};
// Hamilton tem 2 contas: 27a8a72e... (hamilton@, PARTNER_PRO, demonstração
// pra prospects/partners) e 75c6cac4... (suporte@, ADMIN, conta real dele).
// Usa a real aqui — mesma correção aplicada em contracts/approve/route.ts.
const COMPLIANCE_SOCIO: Record<string, string> = {
  "d5f26efd-8ed5-4d90-b3f4-9ce0004803c5": "Robson Lino", // compliance
  "d0af8eaa-9f3c-4e7a-b8c6-613736524317": "João Lemos", // sócio diretor
  "75c6cac4-8d30-436e-b9a6-d5d494d7470b": "Hamilton Santos", // sócio diretor
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
    .select("id, approval_status, review_round, body_text_raw, version, valor_operacao_estimado, origem")
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

  // 17/08/2026: upsert em vez de insert puro. Achado real: Hamilton e
  // Robson tinham voto duplicado na mesma minuta/rodada (clique duplo ou
  // reenvio), sem nenhuma guarda — inflava o histórico e a contagem de
  // quórum por sócio (ver migration 20260817b + constraint UNIQUE
  // template_id+review_round+reviewer_id). Reenviar o voto agora
  // atualiza a decisão existente em vez de duplicar linha.
  await db.from("contract_template_reviews").upsert({
    template_id: id,
    review_round: template.review_round,
    reviewer_id: reviewer.userId,
    reviewer_name: reviewer.name,
    reviewer_type: reviewer.type,
    decision,
    comment: comment?.trim() || null,
    body_edited: !!bodyEdited,
  }, { onConflict: "template_id,review_round,reviewer_id" });

  if (decision === "reprovado") {
    await db.from("contract_templates").update({ approval_status: "reprovado" }).eq("id", id);
    if (template.origem === "agente_ia") {
      await logAgentAuditEvent({
        templateId: id,
        eventType: "voto_registrado",
        actorId: reviewer.userId,
        actorName: reviewer.name,
        detail: { decision, comment: comment?.trim() || null, reviewer_type: reviewer.type },
      });
      await logAgentAuditEvent({
        templateId: id,
        eventType: "minuta_reprovada",
        actorId: reviewer.userId,
        actorName: reviewer.name,
        detail: { comment: comment?.trim() || null },
      });
    }
    return NextResponse.json({ approval_status: "reprovado" });
  }

  // decision === "aprovado": checar se o quórum do round atual já fechou.
  // 17/08/2026, decisão de João: dois caminhos fecham o quórum agora —
  // (a) o original, 1 aprovado de cada grupo (jurídico + compliance/sócio);
  // (b) novo, 2 dos 3 sócios diretores (compliance_socio) aprovando,
  // dispensa o jurídico. Constraint UNIQUE (migration 20260817b) garante
  // que cada reviewer_id conta uma vez só por rodada, então contar linhas
  // já equivale a contar pessoas distintas.
  const { data: roundReviews } = await db
    .from("contract_template_reviews")
    .select("reviewer_id, reviewer_type, decision")
    .eq("template_id", id)
    .eq("review_round", template.review_round);

  const approvedSocios = (roundReviews ?? []).filter((r) => r.reviewer_type === "compliance_socio" && r.decision === "aprovado");
  const hasJuridico = (roundReviews ?? []).some((r) => r.reviewer_type === "juridico" && r.decision === "aprovado");
  const hasComplianceSocio = approvedSocios.length > 0;
  const socioMajority = approvedSocios.length >= 2;

  // Regra de Quórum Soberano (BRIEF 2, 30/08/2026, decisão explícita da
  // diretoria, atualiza a trava temporária dos R$50 mil criada mais cedo
  // no mesmo dia): 3 caminhos possíveis, nesta ordem de prioridade.
  //   (a) UNANIMIDADE (3/3 sócios) sempre fecha quórum, qualquer valor,
  //       inclusive acima de R$50 mil — "exceção soberana", dispensa o
  //       jurídico mesmo quando ele seria obrigatório pela regra de valor.
  //   (b) Valor declarado <= R$50 mil: maioria de sócios (2/3) fecha
  //       quórum, dispensando o jurídico (trilho rápido original).
  //   (c) Valor declarado > R$50 mil, sem unanimidade: exige jurídico +
  //       1 compliance/sócio, sem exceção por vertical (regra única,
  //       confirmada por João em 30/08, substitui a proposta anterior de
  //       diferenciar por vertical).
  // Minutas sem valor declarado (fluxo manual antigo) sempre caem no
  // caminho (b), comportamento idêntico ao que já existia antes desta
  // regra — nenhuma quebra retroativa.
  const VALOR_LIMITE_DISPENSA_JURIDICO = 50000;
  const valorDeclarado = template.valor_operacao_estimado;
  const valorAcimaDoLimite = typeof valorDeclarado === "number" && valorDeclarado > VALOR_LIMITE_DISPENSA_JURIDICO;
  const unanimidade = approvedSocios.length >= 3;
  const maioriaValidaPorValor = socioMajority && !valorAcimaDoLimite;
  const quorumViaSocios = unanimidade || maioriaValidaPorValor;
  const quorumViaJuridico = hasJuridico && hasComplianceSocio;

  const quorumMet = quorumViaJuridico || quorumViaSocios;

  if (quorumMet) {
    await db.from("contract_templates").update({ approval_status: "aprovado" }).eq("id", id);
  }

  // Auditoria dedicada (BRIEF 2, item 3): só grava para minutas geradas
  // pelo Agente Revisor de Riscos (contract_ai_agent_audit_log.template_id
  // não é útil pro fluxo manual, que já tem sua própria trilha em
  // contract_template_reviews desde sempre).
  if (template.origem === "agente_ia") {
    await logAgentAuditEvent({
      templateId: id,
      eventType: "voto_registrado",
      actorId: reviewer.userId,
      actorName: reviewer.name,
      detail: { decision, comment: comment?.trim() || null, reviewer_type: reviewer.type },
    });
    if (quorumMet) {
      await logAgentAuditEvent({
        templateId: id,
        eventType: "minuta_aprovada",
        actorName: "Sistema",
        detail: {
          via: unanimidade ? "unanimidade_3_socios" : quorumViaJuridico ? "juridico_mais_socio" : "maioria_socios",
          socios_aprovaram: approvedSocios.length,
          juridico_aprovou: hasJuridico,
          valor_operacao_estimado: valorDeclarado,
        },
      });
    }
  }

  return NextResponse.json({
    approval_status: quorumMet ? "aprovado" : "em_revisao",
    quorum: {
      juridico: hasJuridico,
      compliance_socio: hasComplianceSocio,
      socios_aprovaram: approvedSocios.length,
      met: quorumMet,
      unanimidade,
      bloqueado_por_valor: valorAcimaDoLimite && !unanimidade,
    },
    message: quorumMet
      ? unanimidade && !hasJuridico
        ? `Quórum atingido por unanimidade dos 3 sócios, exceção soberana dispensando o jurídico. Minuta aprovada, liberada para gerar contrato.`
        : quorumViaSocios && !hasJuridico
        ? `Quórum atingido por maioria de sócios (${approvedSocios.length}/3), dispensando o jurídico. Minuta aprovada, liberada para gerar contrato.`
        : "Quórum atingido (jurídico + compliance/sócio). Minuta aprovada, liberada para gerar contrato."
      : valorAcimaDoLimite && socioMajority && !unanimidade && !hasJuridico
        ? `Maioria de sócios atingida (${approvedSocios.length}/3), mas o valor declarado da operação (R$${valorDeclarado?.toLocaleString("pt-BR")}) passa de R$50.000: precisa do voto do jurídico, ou dos 3 sócios (unanimidade) para dispensar. Aguardando.`
        : `Aprovação de ${reviewer.type === "juridico" ? "jurídico" : "compliance/sócio"} registrada (${approvedSocios.length}/3 sócios, jurídico: ${hasJuridico ? "sim" : "não"}). Aguardando 2 sócios OU jurídico + 1 sócio${valorAcimaDoLimite ? " (ou os 3 sócios, dado o valor acima de R$50 mil)" : ""}.`,
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
