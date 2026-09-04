import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { notifySociosMinutaEmRevisao, logAgentAuditEvent } from "@/lib/socios-notify";

// POST /api/contracts/templates/[id]/analysis-callback — server-to-server
// apenas (n8n, workflow "W17 — Analisar Contrato Recebido"). Fecha o ciclo
// assíncrono aberto por /api/contracts/templates/analyze-upload: grava o
// laudo de risco e a minuta saneada que o Agente Revisor de Riscos
// produziu, e já envia a minuta para em_revisao (fast-track, evita um
// clique manual extra de "Enviar para Revisão Jurídica").
//
// Nunca aprova nada sozinha — quórum humano continua obrigatório no mesmo
// /api/contracts/templates/[id]/review de sempre.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { status, body_text_raw, laudo_risco, error_message } = body as {
    status?: "concluido" | "erro";
    body_text_raw?: string;
    laudo_risco?: Record<string, unknown>;
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
  if (template.origem !== "agente_ia")
    return NextResponse.json({ error: "Callback só se aplica a minuta com origem=agente_ia" }, { status: 409 });
  if (template.analysis_status !== "processando")
    return NextResponse.json({ error: `analysis_status atual (${template.analysis_status}) não está em processando` }, { status: 409 });

  if (status === "erro") {
    const errMsg = error_message?.trim() || "Falha não especificada na análise do agente";
    await db.from("contract_templates").update({
      analysis_status: "erro",
      analysis_error: errMsg,
    }).eq("id", id);
    await logAgentAuditEvent({
      templateId: id,
      eventType: "analise_erro",
      actorName: "Agente Revisor de Riscos",
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
    laudo_risco: laudo_risco ?? null,
    analysis_status: "concluido",
    analysis_error: null,
    // Fast-track: entra direto em revisão, poupando o clique manual de
    // "Enviar para Revisão Jurídica". O quórum (jurídico+sócio OU 2/3
    // sócios) continua sendo decidido só por humano em /review.
    approval_status: "em_revisao",
  }).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAgentAuditEvent({
    templateId: id,
    eventType: "analise_concluida",
    actorName: "Agente Revisor de Riscos",
    detail: { laudo_risco: laudo_risco ?? null },
  });

  // Notificação aos sócios (04/09/2026, reversão de decisão anterior):
  // o e-mail/WhatsApp de risco detalhado (02/09) listava cada cláusula
  // crítica com severidade, poluindo a caixa de entrada da diretoria a
  // cada NDA de prateleira analisado. Volta a usar o aviso genérico e
  // limpo (mesmo usado pelo fluxo manual/Agente Estruturador): "minuta
  // pronta para revisão, acesse o link". O laudo completo (pontos_criticos,
  // severidade, desvio_precedente) continua 100% visível dentro do portal
  // (contract-templates-client.tsx), nunca dependeu do e-mail para isso.
  // Best-effort — falha aqui nunca desfaz a gravação acima, a minuta já
  // está em em_revisao de qualquer forma.
  try {
    await notifySociosMinutaEmRevisao({
      templateId: id,
      templateName: template.template_name as string,
      origem: "agente_ia",
    });
  } catch (e) {
    console.error(`[analysis-callback] falha ao notificar sócios sobre minuta em revisão ${id}:`, e);
  }

  return NextResponse.json({ ok: true, analysis_status: "concluido", approval_status: "em_revisao" });
}
