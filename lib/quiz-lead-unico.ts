import type { SupabaseClient } from "@supabase/supabase-js";
import { sendText } from "@/lib/whatsapp/openwa-client";

// Regras comuns aos quizzes públicos (/seja-partner e /white-label) que gravam em prospeccao_leads.
//
// 1. Lead único por pessoa: quem faz os dois quizzes (o resultado "frio" do White Label leva ao
//    Seja Partner) ou refaz o mesmo quiz numa sessão nova continua sendo UM lead. A busca é pelo
//    e-mail ou pelo WhatsApp, nos últimos JANELA_DIAS dias.
// 2. Lead incompleto espera 1 minuto: o card só aparece no Kanban e o time só é avisado no WhatsApp
//    se o candidato não concluir o quiz em ATRASO_INCOMPLETO_MS (pedido do Hamilton, 12/10/2026).

export const ATRASO_INCOMPLETO_MS = 60_000;
const JANELA_DIAS = 60;

export type LeadExistente = { id: string; etapa: string; origem: string; metadata: Record<string, unknown> | null };

/** Últimos 10 dígitos (DDD + número), ignorando +55, máscara e espaços. */
export function telefoneChave(t: string | null | undefined): string {
  return (t ?? "").replace(/\D/g, "").slice(-10);
}

/** Lead mais recente com o mesmo e-mail ou WhatsApp (qualquer origem), ou null. */
export async function acharLeadPorContato(
  db: SupabaseClient,
  contato: { email: string; telefone: string },
  ignorarId?: string,
): Promise<LeadExistente | null> {
  const email = contato.email.trim().toLowerCase();
  const tel = telefoneChave(contato.telefone);
  const desde = new Date(Date.now() - JANELA_DIAS * 86_400_000).toISOString();
  // Os 8 últimos dígitos casam qualquer formatação gravada; o filtro fino é feito abaixo.
  const filtros = [`email.ilike.${email.replace(/[,()*%]/g, "")}`];
  if (tel.length >= 8) filtros.push(`telefone.ilike.%${tel.slice(-8)}%`);

  const { data } = await db.from("prospeccao_leads")
    .select("id, etapa, origem, metadata, email, telefone, created_at")
    .gte("created_at", desde)
    .or(filtros.join(","))
    .order("created_at", { ascending: false })
    .limit(10);

  const achado = (data ?? []).find((l) =>
    l.id !== ignorarId &&
    (((l.email as string | null) ?? "").trim().toLowerCase() === email ||
      (tel.length >= 10 && telefoneChave(l.telefone as string | null) === tel)));
  return achado
    ? { id: achado.id as string, etapa: achado.etapa as string, origem: achado.origem as string, metadata: (achado.metadata as Record<string, unknown> | null) ?? null }
    : null;
}

/** Ainda dentro do 1º minuto de um lead incompleto (o Kanban esconde o card). */
export function incompletoAguardando(lead: { etapa?: string | null; created_at?: string | null; metadata?: Record<string, unknown> | null }): boolean {
  if (lead.etapa !== "incompleto" || lead.metadata?.quiz_incompleto !== true) return false;
  const criado = new Date(String(lead.metadata?.parcial_criado_em ?? lead.created_at ?? "")).getTime();
  return !Number.isNaN(criado) && Date.now() - criado < ATRASO_INCOMPLETO_MS;
}

export function numerosAlertaQuiz(): string[] {
  return (process.env.QUIZ_LEAD_ALERT_WHATSAPP || "51997466001,+97433006127")
    .split(",").map((n) => n.trim()).filter(Boolean);
}

/**
 * Espera 1 minuto e, se o lead continuar incompleto, avisa o time no WhatsApp (uma vez só).
 * Roda depois da resposta (after() do Next), então o candidato não espera.
 */
export async function avisarIncompletoDepoisDeUmMinuto(db: SupabaseClient, leadId: string, mensagem: string): Promise<void> {
  await new Promise((r) => setTimeout(r, ATRASO_INCOMPLETO_MS));
  const { data: lead } = await db.from("prospeccao_leads").select("etapa, metadata").eq("id", leadId).maybeSingle();
  const meta = ((lead?.metadata as Record<string, unknown> | null) ?? {});
  if (!lead || meta.quiz_incompleto !== true || meta.alerta_incompleto_enviado_em) return;
  await db.from("prospeccao_leads")
    .update({ metadata: { ...meta, alerta_incompleto_enviado_em: new Date().toISOString() } })
    .eq("id", leadId);
  await Promise.allSettled(numerosAlertaQuiz().map((n) => sendText(n, mensagem).catch(() => false)));
}
