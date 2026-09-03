import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { logAgentAuditEvent } from "@/lib/socios-notify";

// POST /api/contracts/templates/[id]/draft-callback — server-to-server
// apenas (n8n, workflow "W18 — Estruturar Minuta"). Fecha o ciclo
// assíncrono aberto por /api/contracts/templates/draft: grava a minuta
// que o Agente Estruturador de Contratos redigiu, junto com as brechas
// jurídicas identificadas e observações para o revisor.
//
// Também é o callback reaproveitado por "Pedir Ajuste ao Agente"
// (/api/contracts/templates/[id]/request-revision) quando origem =
// agente_ia_estruturador -- mesmo shape de saída, só muda o que disparou.
//
// Diferença deliberada em relação a analysis-callback (Agente 2): NUNCA
// muda approval_status. A minuta cai e permanece em "rascunho" (decisão
// de João, 02/09/2026) -- a Mesa Operacional precisa ler e refinar antes
// de mandar manualmente pro jurídico via "Enviar para Revisão Jurídica".
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { status, body_text_raw, brechas_identificadas, observacoes_para_revisor, error_message } = body as {
    status?: "concluido" | "erro";
    body_text_raw?: string;
    brechas_identificadas?: unknown;
    observacoes_para_revisor?: string;
    error_message?: string;
  };

  if (!status || !["concluido", "erro"].includes(status))
    return NextResponse.json({ error: "status deve ser 'concluido' ou 'erro'" }, { status: 422 });

  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: template } = await db
    .from("contract_templates")
    .select("id, template_name, origem, analysis_status")
    .eq("id", id)
    .single();

  if (!template) return NextResponse.json({ error: "Minuta não encontrada" }, { status: 404 });
  if (template.origem !== "agente_ia_estruturador")
    return NextResponse.json({ error: "Callback só se aplica a minuta com origem=agente_ia_estruturador" }, { status: 409 });
  if (template.analysis_status !== "processando")
    return NextResponse.json({ error: `analysis_status atual (${template.analysis_status}) não está em processando` }, { status: 409 });

  if (status === "erro") {
    const errMsg = error_message?.trim() || "Falha não especificada na estruturação do agente";
    await db.from("contract_templates").update({
      analysis_status: "erro",
      analysis_error: errMsg,
    }).eq("id", id);
    await logAgentAuditEvent({
      templateId: id,
      eventType: "estruturacao_erro",
      actorName: "Agente Estruturador de Contratos",
      detail: { error_message: errMsg },
    });
    return NextResponse.json({ ok: true, analysis_status: "erro" });
  }

  if (!body_text_raw?.trim())
    return NextResponse.json({ error: "body_text_raw obrigatório quando status=concluido" }, { status: 422 });

  const vars = (body_text_raw.match(/\{\{([^}]+)\}\}/g) || []).map((v: string) => v.replace(/\{\{|\}\}/g, "").trim());

  const { error } = await db.from("contract_templates").update({
    body_text_raw,
    variables_map: vars.map((v: string) => ({ key: v, label: v.replace(/_/g, " "), source: "auto" })),
    brechas_identificadas: brechas_identificadas ?? null,
    observacoes_para_revisor: observacoes_para_revisor?.trim() || null,
    analysis_status: "concluido",
    analysis_error: null,
    // Deliberadamente SEM tocar approval_status -- fica em "rascunho"
    // (valor de criação), a Mesa decide quando mandar pra revisão.
  }).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAgentAuditEvent({
    templateId: id,
    eventType: "estruturacao_concluida",
    actorName: "Agente Estruturador de Contratos",
    detail: { brechas_identificadas: brechas_identificadas ?? null },
  });

  return NextResponse.json({ ok: true, analysis_status: "concluido" });
}
