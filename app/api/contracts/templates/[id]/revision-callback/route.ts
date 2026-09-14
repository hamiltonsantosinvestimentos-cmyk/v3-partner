import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { notifySociosMinutaEmRevisao, logAgentAuditEvent } from "@/lib/socios-notify";

// POST /api/contracts/templates/[id]/revision-callback — server-to-server
// apenas (n8n, workflow "W19 — Pedir Ajuste ao Agente", terceiro prompt
// "Ajuste Pontual de Revisor"). Fecha o ciclo aberto tanto pelo botão manual
// (request-revision) quanto pelo gatilho automático ao reprovar
// (review/route.ts, 14/09/2026) para minuta de QUALQUER origem.
//
// Difere de propósito de analysis-callback/draft-callback (que atendem só
// origem=agente_ia/agente_ia_estruturador): aqueles nunca avançam
// review_round porque nascem numa rodada nova, sem voto nenhum ainda. Este
// callback trata o caso oposto -- a minuta JÁ tinha voto(s) de reprovação
// na rodada atual, e o texto mudou por causa disso. Sem abrir rodada nova,
// um voto "aprovado" antigo da MESMA rodada (dado sobre o texto ERRADO,
// antes do ajuste) continuaria contando pro quórum -- mesma classe de bug
// já corrigida uma vez em app/api/contracts/templates/[id]/route.ts
// (comentário de 04/09/2026 lá: "aprovações dadas sobre o texto ERRADO").
// Por isso a transição aqui espelha a mesma lógica daquela rota
// (bodyChanged -> version+1, review_round+1, approval_status=em_revisao),
// não a de analysis-callback.
//
// Nunca aprova nada sozinha -- quórum humano continua obrigatório no mesmo
// /api/contracts/templates/[id]/review de sempre, agora numa rodada nova.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { status, body_text_raw, resumo_ajuste, pendencias_nao_resolviveis, error_message } = body as {
    status?: "concluido" | "erro";
    body_text_raw?: string;
    resumo_ajuste?: string;
    pendencias_nao_resolviveis?: string[];
    error_message?: string;
  };

  if (!status || !["concluido", "erro"].includes(status))
    return NextResponse.json({ error: "status deve ser 'concluido' ou 'erro'" }, { status: 422 });

  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: template } = await db
    .from("contract_templates")
    .select("id, template_name, origem, analysis_status, approval_status, review_round, version, created_by")
    .eq("id", id)
    .single();

  if (!template) return NextResponse.json({ error: "Minuta não encontrada" }, { status: 404 });
  if (template.analysis_status !== "processando")
    return NextResponse.json({ error: `analysis_status atual (${template.analysis_status}) não está em processando` }, { status: 409 });

  if (status === "erro") {
    const errMsg = error_message?.trim() || "Falha não especificada no ajuste do agente";
    await db.from("contract_templates").update({
      analysis_status: "erro",
      analysis_error: errMsg,
    }).eq("id", id);
    await logAgentAuditEvent({
      templateId: id,
      eventType: "ajuste_erro",
      actorName: "Agente de Ajuste (Revisão Assistida)",
      detail: { error_message: errMsg },
    });
    return NextResponse.json({ ok: true, analysis_status: "erro" });
  }

  if (!body_text_raw?.trim())
    return NextResponse.json({ error: "body_text_raw obrigatório quando status=concluido" }, { status: 422 });

  // Nunca aplica corpo vazio/apagado em cima do texto legal -- se o agente
  // devolver algo suspeito (curto demais), melhor cair como erro visível do
  // que silenciosamente esvaziar a minuta.
  if (body_text_raw.trim().length < 100)
    return NextResponse.json({ error: "body_text_raw devolvido é curto demais para ser um corpo de minuta válido" }, { status: 422 });

  const vars = (body_text_raw.match(/\{\{([^}]+)\}\}/g) || []).map((v: string) => v.replace(/\{\{|\}\}/g, "").trim());
  const nextRound = (template.review_round ?? 1) + 1;

  const { error } = await db.from("contract_templates").update({
    body_text_raw,
    variables_map: vars.map((v: string) => ({ key: v, label: v.replace(/_/g, " "), source: "auto" })),
    version: (template.version ?? 1) + 1,
    review_round: nextRound,
    analysis_status: "concluido",
    analysis_error: null,
    // Reprovado -> em_revisao de novo, numa rodada nova (ver comentário
    // acima). Se por algum motivo chegou aqui em rascunho (ex: chamado pelo
    // botão manual antes de qualquer revisão ter começado), o efeito é o
    // mesmo de "Enviar para Revisão Jurídica".
    approval_status: "em_revisao",
  }).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAgentAuditEvent({
    templateId: id,
    eventType: "ajuste_aplicado",
    actorName: "Agente de Ajuste (Revisão Assistida)",
    detail: { resumo_ajuste: resumo_ajuste ?? null, pendencias_nao_resolviveis: pendencias_nao_resolviveis ?? null, review_round: nextRound },
  });

  try {
    await notifySociosMinutaEmRevisao({
      templateId: id,
      templateName: template.template_name as string,
      origem: "manual",
    });
  } catch (e) {
    console.error(`[revision-callback] falha ao notificar sócios sobre minuta em revisão ${id}:`, e);
  }

  return NextResponse.json({ ok: true, analysis_status: "concluido", approval_status: "em_revisao", review_round: nextRound });
}
