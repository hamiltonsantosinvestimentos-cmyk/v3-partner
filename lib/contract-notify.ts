import { createClient as sc } from "@supabase/supabase-js";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Notifica UM usuário específico (sino in-app + e-mail), 11/09/2026 --
// fecha os gaps mapeados no Fluxograma de Notificações (voto registrado,
// quórum fechado de minuta, aprovação de contrato pendente): antes disso
// nenhuma dessas 3 etapas emitia sinal nenhum, generalização do padrão que
// já funcionava só na etapa de "enviar pra revisão" (lib/socios-notify.ts).
// Nunca deixa falha de notificação derrubar o fluxo principal (mesmo
// espírito best-effort já usado em todo o resto do sistema).
export async function notifyUser(params: {
  userId: string;
  title: string;
  message: string;
  type: string;
  actionUrl?: string;
}): Promise<void> {
  const { userId, title, message, type, actionUrl } = params;
  const db = svc();

  const { error: insertError } = await db.from("notifications").insert({
    user_id: userId,
    title,
    message,
    type,
    action_url: actionUrl ?? null,
    read: false,
  });
  if (insertError) console.error(`[contract-notify] falha ao gravar notificação in-app pra ${userId}:`, insertError.message);

  const { data: profile } = await db.from("profiles").select("email").eq("id", userId).maybeSingle();
  if (profile?.email && process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const subjectGate = auditText(title);
      const htmlGate = auditHtml(
        `<p>${message}</p>${actionUrl ? `<p><a href="${actionUrl}">${actionUrl}</a></p>` : ""}<p>V3 Partners</p>`
      );
      await resend.emails.send({
        from: "V3 Partners <noreply@v3partners.com.br>",
        to: profile.email,
        subject: subjectGate.corrected,
        html: htmlGate.corrected,
      });
    } catch (e) {
      console.error(`[contract-notify] falha e-mail pra ${profile.email}:`, e);
    }
  }
}

// Identidade do jurídico (Dr. Luis Athaydes) -- mesma pessoa referenciada em
// app/api/contracts/templates/[id]/review/route.ts (JURIDICO) e
// lib/ncnda-desk-head.ts (BOLSA_ATIVOS.lookupEmail).
export const JURIDICO_ID = "82171bc1-edbd-40f8-936b-1b26d412a121";

// Mesmo array de sócios usado em lib/socios-notify.ts e
// app/api/contracts/approve/route.ts -- reproduzido aqui (não importado
// daquele arquivo) porque tem forma diferente (userId simples, não
// {id,name,email,phone}) e para não acoplar contract-notify.ts a um módulo
// dono de um assunto mais estreito (notificação específica de minuta em
// revisão).
export const SOCIOS_IDS = [
  "d0af8eaa-9f3c-4e7a-b8c6-613736524317", // João Lemos
  "75c6cac4-8d30-436e-b9a6-d5d494d7470b", // Hamilton Santos (conta admin real, suporte@)
  "d5f26efd-8ed5-4d90-b3f4-9ce0004803c5", // Robson Lino
];
