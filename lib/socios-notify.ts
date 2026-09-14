import { createClient as sc } from "@supabase/supabase-js";
import { sendWhatsApp } from "@/lib/whatsapp/subscription-messages";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";

// Notificação Proativa para a Diretoria (BRIEF 2 do Fast-Track, 30/08/2026,
// item 1). Gap operacional real: hoje os sócios só descobrem que uma
// minuta está esperando voto entrando na Central de Contratos. Esta rotina
// fecha isso para minutas origem=agente_ia entrando em em_revisao.
const SOCIOS: { id: string; name: string; email: string; phone: string | null }[] = [
  { id: "d0af8eaa-9f3c-4e7a-b8c6-613736524317", name: "João Lemos", email: "joao.lemos@v3partners.com.br", phone: null },
  { id: "75c6cac4-8d30-436e-b9a6-d5d494d7470b", name: "Hamilton Santos", email: "suporte@v3partners.com.br", phone: "51997466001" },
  { id: "d5f26efd-8ed5-4d90-b3f4-9ce0004803c5", name: "Robson Lino", email: "robinholino16@gmail.com", phone: "51998556322" },
];

// Jurídico (11/09/2026, Fluxograma de Notificações): achado real, o próprio
// comentário desta rotina dizia "candidato a extensão futura, registrado
// como pendente" -- o jurídico nunca foi notificado de nenhuma minuta
// esperando o voto dele, mesmo sendo voto obrigatório na maioria dos casos
// (regra de quórum em templates/[id]/review/route.ts). Fechado agora.
const JURIDICO = { id: "82171bc1-edbd-40f8-936b-1b26d412a121", name: "Dr. Luis Athaydes", email: "luis.athaydes@v3partners.com.br", phone: null as string | null };

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

  // Jurídico entra na mesma rodada de e-mail/WhatsApp/sino que os sócios
  // (11/09/2026) -- antes só os 3 ADMIN eram notificados, o próprio Dr.
  // Athaydes nunca sabia que tinha minuta esperando o voto dele.
  const recipients = [...SOCIOS, JURIDICO];

  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await Promise.all(
      recipients.map((r) =>
        resend.emails.send({
          from: "V3 Partners <noreply@v3partners.com.br>",
          to: r.email,
          subject: subjectGate.corrected,
          html: htmlGate.corrected,
        }).catch((e) => console.error(`[socios-notify] falha e-mail ${r.email}:`, e))
      )
    );
  }

  await Promise.all(
    recipients.filter((r) => r.phone).map((r) =>
      sendWhatsApp(r.phone as string, whatsappMsg.corrected).catch((e) =>
        console.error(`[socios-notify] falha whatsapp ${r.name}:`, e)
      )
    )
  );

  // Sino (in-app): esta rotina nunca gravou em `notifications`, só e-mail/
  // WhatsApp -- por isso o ícone de notificações no topo da plataforma
  // nunca refletia "minuta aguardando aprovação" pra ninguém, mesmo pros
  // sócios que já recebiam e-mail. Fechado no mesmo bloco do jurídico.
  const db = svc();
  await db.from("notifications").insert(
    recipients.map((r) => ({
      user_id: r.id,
      title: `Minuta aguardando aprovação: ${templateName}`,
      message: `A minuta "${templateName}" entrou em revisão e aguarda seu voto. Origem: ${origemLabel}.`,
      type: "minuta_em_revisao",
      action_url: "/juridico/contratos?tab=minutas&template_id=" + templateId,
      read: false,
    }))
  ).then(({ error }) => {
    if (error) console.error("[socios-notify] falha ao gravar notificação in-app:", error.message);
  });
}

// Alerta de novo cadastro de partner (pedido do Hamilton, 13/09/2026): antes
// disso, um cadastro novo em partner_registrations só aparecia pra quem
// entrasse manualmente na aba Cadastros — ninguém era avisado na hora. Só
// notifica o Hamilton (WhatsApp + e-mail), não os outros sócios — é isso que
// foi pedido, diferente de notifySociosMinutaEmRevisao acima.
const HAMILTON_WHATSAPP = "51997466001";
const HAMILTON_EMAIL = "hamilton@v3partners.com.br";

const PLANO_LABEL_CADASTRO: Record<string, string> = {
  STARTER: "V3 Starter",
  PARTNER: "V3 Partner",
  PARTNER_PRO: "V3 Partner PRO",
  PARTNER_HE: "Partner HE",
  ENTERPRISE: "V3 Enterprise",
};

export async function notifyNovoCadastroPartner(params: {
  nome: string;
  plano: string;
  tipoPessoa: "PF" | "PJ";
  email: string;
  telefone: string;
}): Promise<void> {
  const { nome, plano, tipoPessoa, email, telefone } = params;
  const planoLabel = PLANO_LABEL_CADASTRO[plano] ?? plano;
  const link = "https://app.v3partners.com.br/admin-cadastros";

  const subjectGate = auditText(`Novo cadastro de partner: ${nome} (${planoLabel})`);
  const htmlGate = auditHtml(
    `<p>Olá, Hamilton,</p>
     <p>Um novo cadastro de partner acabou de entrar na aba Cadastros:</p>
     <ul>
       <li><strong>Nome:</strong> ${nome}</li>
       <li><strong>Plano:</strong> ${planoLabel}</li>
       <li><strong>Tipo:</strong> ${tipoPessoa === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}</li>
       <li><strong>E-mail:</strong> ${email}</li>
       <li><strong>Telefone:</strong> ${telefone}</li>
     </ul>
     <p>Acesse para aprovar: <a href="${link}">${link}</a></p>
     <p>V3 Partners</p>`
  );
  const whatsappMsg = auditText(
    `Novo cadastro de partner: ${nome} (${planoLabel}, ${tipoPessoa}). Tel: ${telefone}. Acesse: ${link}`
  );

  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "V3 Partners <noreply@v3partners.com.br>",
      to: HAMILTON_EMAIL,
      subject: subjectGate.corrected,
      html: htmlGate.corrected,
    }).catch((e) => console.error("[socios-notify] falha e-mail novo cadastro:", e));
  }

  await sendWhatsApp(HAMILTON_WHATSAPP, whatsappMsg.corrected).catch((e) =>
    console.error("[socios-notify] falha whatsapp novo cadastro:", e)
  );
}

// Registro na auditoria dedicada (contract_ai_agent_audit_log). actor_id
// null = evento do próprio agente; preenchido = voto/decisão humana.
export async function logAgentAuditEvent(params: {
  templateId: string;
  // estruturacao_concluida/erro (02/09/2026): Agente Estruturador de
  // Contratos (Agente 1). ajuste_solicitado: "Pedir Ajuste ao Agente",
  // compartilhado pelos dois agentes. ajuste_aplicado/ajuste_erro
  // (14/09/2026): fecham o ciclo de ajuste_solicitado quando o revisor
  // reprova com comentário (gatilho automático, generalizado pra qualquer
  // origem, ver lib/contract-revision-agent.ts). CHECK constraint
  // espelhado em contract_ai_agent_audit_log (migration 20260902b,
  // estendida em 20260914b) -- se adicionar um valor novo aqui, adicionar
  // lá também.
  eventType: "analise_concluida" | "analise_erro" | "voto_registrado" | "minuta_aprovada" | "minuta_reprovada" | "estruturacao_concluida" | "estruturacao_erro" | "ajuste_solicitado" | "ajuste_aplicado" | "ajuste_erro";
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
