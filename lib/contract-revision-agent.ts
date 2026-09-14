import type { SupabaseClient } from "@supabase/supabase-js";
import { logAgentAuditEvent } from "@/lib/socios-notify";

// Dispara o mesmo pedido de ajuste que o botão manual "Pedir Ajuste ao
// Agente" (webhook único v3-contract-revise, workflow n8n "W19") -- usado
// tanto pelo botão (app/api/contracts/templates/[id]/request-revision)
// quanto pelo gatilho automático ao reprovar
// (app/api/contracts/templates/[id]/review, 14/09/2026, pedido de João/Dr.
// Athaydes). Extraído pra cá pra não duplicar a chamada ao n8n nos dois
// lugares.
//
// Generalizado pra QUALQUER origem (antes só agente_ia/agente_ia_estruturador
// tinham acesso a isso): o n8n já tratava qualquer origem fora dessas duas
// como o prompt "Sanitizador", e agora ganhou um terceiro prompt dedicado
// ("Ajuste Pontual de Revisor") só pra esse caso novo -- ver o nó "Montar
// Prompt de Ajuste" do workflow W19. minuta origem=manual (17 das 18 minutas
// reais hoje) volta pelo callback novo
// app/api/contracts/templates/[id]/revision-callback, que bumpa
// review_round corretamente (analysis-callback/draft-callback, usados pelas
// origens de IA, não bumpam round -- correto pra eles porque nascem sempre
// em rodada nova, mas errado pra reprovação, que precisa abrir rodada nova
// pra não deixar voto antigo contando pro texto já corrigido).

interface TemplateForRevision {
  id: string;
  origem: string;
  vertical: string;
  contract_series: string | null;
  body_text_raw: string;
}

export async function triggerContractRevisionAgent(
  db: SupabaseClient,
  template: TemplateForRevision,
  instrucao: string,
  opts: { actorId?: string | null; actorName: string }
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { error: updateErr } = await db
    .from("contract_templates")
    .update({ analysis_status: "processando" })
    .eq("id", template.id);
  if (updateErr) return { ok: false, status: 500, error: updateErr.message };

  await logAgentAuditEvent({
    templateId: template.id,
    eventType: "ajuste_solicitado",
    actorId: opts.actorId ?? null,
    actorName: opts.actorName,
    detail: { instrucao, origem: template.origem },
  });

  const n8nBase = process.env.N8N_API_URL?.replace("/api/v1", "");
  if (!n8nBase) {
    await db.from("contract_templates").update({
      analysis_status: "erro",
      analysis_error: "N8N_API_URL não configurada — ajuste não pode ser disparado",
    }).eq("id", template.id);
    return { ok: false, status: 500, error: "Integração de ajuste não configurada (N8N_API_URL ausente)" };
  }

  try {
    await fetch(`${n8nBase}/webhook/v3-contract-revise`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": process.env.CRON_SECRET ?? "" },
      body: JSON.stringify({
        template_id: template.id,
        origem: template.origem,
        instrucao,
        vertical: template.vertical,
        contract_series: template.contract_series,
        body_text_raw_atual: template.body_text_raw.slice(0, 40000),
      }),
    });
  } catch (e) {
    console.error("[contract-revision-agent] webhook n8n falhou:", e);
    await db.from("contract_templates").update({
      analysis_status: "erro",
      analysis_error: "Não foi possível acionar o agente para o ajuste. Tente novamente em 1 minuto.",
    }).eq("id", template.id);
    return { ok: false, status: 503, error: "Agente indisponível para ajuste. Tente novamente em 1 minuto." };
  }

  return { ok: true };
}
