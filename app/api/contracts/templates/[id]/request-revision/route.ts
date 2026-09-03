import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { logAgentAuditEvent } from "@/lib/socios-notify";

// POST /api/contracts/templates/[id]/request-revision — "Pedir Ajuste ao
// Agente" (BRIEF 02/09/2026, aprovado por João). Compartilhado pelos dois
// agentes (Estruturador e Revisor de Riscos): o revisor/Mesa digita o que
// precisa mudar na minuta atual, e o MESMO agente que a gerou produz uma
// nova versão, sem precisar editar manualmente.
//
// Reaproveita o webhook único v3-contract-revise (workflow n8n "W19"), que
// decide o prompt certo pelo campo origem e chama de volta o callback já
// existente de cada agente (draft-callback para agente_ia_estruturador,
// analysis-callback para agente_ia) -- nenhum callback novo foi criado
// pra isso, os dois já existentes servem sem alteração.

const WRITE_ROLES = ["ADMIN", "GESTAO"] as const;
const AGENT_ORIGENS = ["agente_ia", "agente_ia_estruturador"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function requireWriter() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !WRITE_ROLES.includes(profile.role as typeof WRITE_ROLES[number])) return null;
  return { userId: user.id };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireWriter();
  if (!caller) return NextResponse.json({ error: "Apenas ADMIN ou GESTAO podem pedir ajuste ao agente" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { instrucao } = body as { instrucao?: string };

  if (!instrucao?.trim() || instrucao.trim().length < 5)
    return NextResponse.json({ error: "Descreva o ajuste que precisa (mínimo 5 caracteres)" }, { status: 422 });

  const db = svc();

  const { data: template } = await db
    .from("contract_templates")
    .select("id, template_name, origem, analysis_status, approval_status, body_text_raw, vertical, contract_series")
    .eq("id", id)
    .single();

  if (!template) return NextResponse.json({ error: "Minuta não encontrada" }, { status: 404 });
  if (!AGENT_ORIGENS.includes(template.origem as typeof AGENT_ORIGENS[number]))
    return NextResponse.json({ error: "Pedir ajuste ao agente só se aplica a minuta gerada por IA" }, { status: 409 });
  if (template.analysis_status !== "concluido")
    return NextResponse.json({ error: `Minuta precisa ter uma versão concluída antes de pedir ajuste (status atual: ${template.analysis_status})` }, { status: 409 });
  // Editar minuta aprovada já reseta pra rascunho no fluxo manual
  // (templates/[id] PATCH) -- "Pedir Ajuste" não deve contornar essa
  // regra por um caminho diferente. Reprovada/em outro estado também fica
  // de fora: use o fluxo normal de edição/reenvio pra esses casos.
  if (!["rascunho", "em_revisao"].includes(template.approval_status as string))
    return NextResponse.json({ error: `Minuta em status "${template.approval_status}" não aceita ajuste direto do agente. Use a edição manual.` }, { status: 409 });

  const { error: updateErr } = await db
    .from("contract_templates")
    .update({ analysis_status: "processando" })
    .eq("id", id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  await logAgentAuditEvent({
    templateId: id,
    eventType: "ajuste_solicitado",
    actorId: caller.userId,
    actorName: "Mesa/Revisor",
    detail: { instrucao: instrucao.trim(), origem: template.origem },
  });

  const n8nBase = process.env.N8N_API_URL?.replace("/api/v1", "");
  if (!n8nBase) {
    await db.from("contract_templates").update({
      analysis_status: "erro",
      analysis_error: "N8N_API_URL não configurada — ajuste não pode ser disparado",
    }).eq("id", id);
    return NextResponse.json({ error: "Integração de ajuste não configurada (N8N_API_URL ausente)" }, { status: 500 });
  }

  try {
    await fetch(`${n8nBase}/webhook/v3-contract-revise`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": process.env.CRON_SECRET ?? "" },
      body: JSON.stringify({
        template_id: id,
        origem: template.origem,
        instrucao: instrucao.trim(),
        vertical: template.vertical,
        contract_series: template.contract_series,
        body_text_raw_atual: (template.body_text_raw as string).slice(0, 40000),
      }),
    });
  } catch (e) {
    console.error("[request-revision] webhook n8n falhou:", e);
    await db.from("contract_templates").update({
      analysis_status: "erro",
      analysis_error: "Não foi possível acionar o agente para o ajuste. Tente novamente em 1 minuto.",
    }).eq("id", id);
    return NextResponse.json({ error: "Agente indisponível para ajuste. Tente novamente em 1 minuto." }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    analysis_status: "processando",
    message: "Ajuste solicitado. O agente está revisando a minuta com base na instrução.",
  }, { status: 202 });
}
