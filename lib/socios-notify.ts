import { createClient as sc } from "@supabase/supabase-js";
import { sendWhatsApp } from "@/lib/whatsapp/subscription-messages";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";

// Notificação Proativa para a Diretoria (BRIEF 2 do Fast-Track, 30/08/2026,
// item 1). Gap operacional real: hoje os sócios só descobrem que uma
// minuta está esperando voto entrando na Central de Contratos. Esta rotina
// fecha isso para minutas origem=agente_ia entrando em em_revisao.
//
// Escopo deliberadamente restrito aos 3 sócios (ADMIN), pedido explícito
// de João. O jurídico (Dr. Athaydes) não é notificado por esta rotina —
// candidato a extensão futura, registrado como pendente.
const SOCIOS: { id: string; name: string; email: string; phone: string | null }[] = [
  { id: "d0af8eaa-9f3c-4e7a-b8c6-613736524317", name: "João Lemos", email: "joao.lemos@v3partners.com.br", phone: null },
  { id: "75c6cac4-8d30-436e-b9a6-d5d494d7470b", name: "Hamilton Santos", email: "suporte@v3partners.com.br", phone: "51997466001" },
  { id: "d5f26efd-8ed5-4d90-b3f4-9ce0004803c5", name: "Robson Lino", email: "robinholino16@gmail.com", phone: "51998556322" },
];

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function notifySociosMinutaEmRevisao(params: {
  templateId: string;
  templateName: string;
  origem: "manual" | "agente_ia";
}): Promise<void> {
  const { templateId, templateName, origem } = params;
  const link = `https://app.v3partners.com.br/juridico/contratos?tab=minutas&template_id=${templateId}`;
  const origemLabel = origem === "agente_ia" ? "Agente Revisor de Riscos (Fast-Track)" : "Manual";

  const subjectGate = auditText(`Minuta aguardando aprovação: ${templateName}`);
  const htmlGate = auditHtml(
    `<p>Olá,</p>
     <p>A minuta <strong>${templateName}</strong> entrou em revisão e aguarda seu voto.</p>
     <p>Origem: ${origemLabel}</p>
     <p>Acesse diretamente: <a href="${link}">${link}</a></p>
     <p>V3 Partners</p>`
  );
  const whatsappMsg = auditText(
    `Minuta aguardando aprovacao: ${templateName}. Origem: ${origemLabel}. Acesse: ${link}`
  );

  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await Promise.all(
      SOCIOS.map((socio) =>
        resend.emails.send({
          from: "V3 Partners <noreply@v3partners.com.br>",
          to: socio.email,
          subject: subjectGate.corrected,
          html: htmlGate.corrected,
        }).catch((e) => console.error(`[socios-notify] falha e-mail ${socio.email}:`, e))
      )
    );
  }

  await Promise.all(
    SOCIOS.filter((s) => s.phone).map((socio) =>
      sendWhatsApp(socio.phone as string, whatsappMsg.corrected).catch((e) =>
        console.error(`[socios-notify] falha whatsapp ${socio.name}:`, e)
      )
    )
  );
}

// E-mail de Alerta de Risco (02/09/2026, pedido explícito de João: proteção
// jurídica da V3 e mitigação de armadilhas contratuais). Disparado no lugar
// de notifySociosMinutaEmRevisao especificamente para o Agente Revisor de
// Riscos (analysis-callback), quando um contrato de terceiro é analisado:
// em vez do aviso genérico "está aguardando seu voto", lista os pontos
// críticos reais encontrados e já aponta a minuta saneada correspondente.
// Mesmo escopo de destinatários (3 sócios) e mesmo gate Brand Guardian.
export async function notifySociosRiscoContrato(params: {
  templateId: string;
  templateName: string;
  laudoRisco: {
    resumo?: string;
    pontos_criticos?: { clausula_original: string; severidade: "alto" | "medio" | "baixo"; risco: string; desvio_precedente?: string }[];
  } | null;
}): Promise<void> {
  const { templateId, templateName, laudoRisco } = params;
  const link = `https://app.v3partners.com.br/juridico/contratos?tab=minutas&template_id=${templateId}`;
  const pontos = laudoRisco?.pontos_criticos ?? [];

  const pontosHtmlList = pontos.length > 0
    ? `<ul>${pontos.map((p) =>
        `<li><strong>${p.clausula_original}</strong> (severidade ${p.severidade}): ${p.risco}${
          p.desvio_precedente ? `. Desvio em relação ao padrão V3: ${p.desvio_precedente}` : ""
        }</li>`
      ).join("")}</ul>`
    : "<p>O agente não listou pontos críticos individuais neste laudo.</p>";

  const pontosTextList = pontos.length > 0
    ? pontos.map((p) => `- ${p.clausula_original} (${p.severidade}): ${p.risco}`).join(". ")
    : "sem pontos criticos individuais listados";

  const subjectGate = auditText(`Riscos identificados em contrato recebido: ${templateName}`);
  const htmlGate = auditHtml(
    `<p>Olá,</p>
     <p>O Agente Revisor de Riscos analisou o contrato de terceiro recebido pela Mesa <strong>${templateName}</strong> antes de qualquer assinatura.</p>
     ${laudoRisco?.resumo ? `<p><strong>Resumo:</strong> ${laudoRisco.resumo}</p>` : ""}
     <p><strong>Pontos críticos identificados (${pontos.length}):</strong></p>
     ${pontosHtmlList}
     <p>Uma minuta saneada já foi redigida, substituindo as cláusulas de risco pelo padrão institucional já aprovado da V3, e aguarda sua revisão.</p>
     <p>Acesse diretamente: <a href="${link}">${link}</a></p>
     <p>V3 Partners</p>`
  );
  const whatsappMsg = auditText(
    `Riscos identificados em contrato recebido: ${templateName}. ${pontos.length} ponto(s) critico(s): ${pontosTextList}. Minuta saneada pronta para revisao. Acesse: ${link}`
  );

  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await Promise.all(
      SOCIOS.map((socio) =>
        resend.emails.send({
          from: "V3 Partners <noreply@v3partners.com.br>",
          to: socio.email,
          subject: subjectGate.corrected,
          html: htmlGate.corrected,
        }).catch((e) => console.error(`[socios-notify] falha e-mail de risco ${socio.email}:`, e))
      )
    );
  }

  await Promise.all(
    SOCIOS.filter((s) => s.phone).map((socio) =>
      sendWhatsApp(socio.phone as string, whatsappMsg.corrected).catch((e) =>
        console.error(`[socios-notify] falha whatsapp de risco ${socio.name}:`, e)
      )
    )
  );
}

// Registro na auditoria dedicada (contract_ai_agent_audit_log). actor_id
// null = evento do próprio agente; preenchido = voto/decisão humana.
export async function logAgentAuditEvent(params: {
  templateId: string;
  // estruturacao_concluida/erro (02/09/2026): Agente Estruturador de
  // Contratos (Agente 1). ajuste_solicitado: "Pedir Ajuste ao Agente",
  // compartilhado pelos dois agentes. CHECK constraint espelhado em
  // contract_ai_agent_audit_log (migration 20260902b) -- se adicionar
  // um valor novo aqui, adicionar lá também.
  eventType: "analise_concluida" | "analise_erro" | "voto_registrado" | "minuta_aprovada" | "minuta_reprovada" | "estruturacao_concluida" | "estruturacao_erro" | "ajuste_solicitado";
  actorId?: string | null;
  actorName: string;
  detail?: Record<string, unknown> | null;
}): Promise<void> {
  const { templateId, eventType, actorId, actorName, detail } = params;
  const { error } = await svc().from("contract_ai_agent_audit_log").insert({
    template_id: templateId,
    event_type: eventType,
    actor_id: actorId ?? null,
    actor_name: actorName,
    detail: detail ?? null,
  });
  if (error) {
    // Nunca deixa o erro de auditoria derrubar o fluxo principal, mas
    // nunca engole silenciosamente também.
    console.error(`[agent-audit-log] falha ao gravar evento ${eventType} pra ${templateId}:`, error.message);
  }
}
