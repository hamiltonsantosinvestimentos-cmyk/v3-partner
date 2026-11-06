// Alertas de segurança da API para o ADMIN (BRIEF ajustes de segurança, 06/11/2026).
// No máximo um alerta por tipo e por referência (IP ou chave) a cada hora.
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyByRoles } from "@/lib/notify";
import { enviarEmailHtml } from "@/lib/email";
import { emailHtml } from "@/lib/integracao-api";

export type TipoAlerta = "ip_bloqueado" | "ip_nao_autorizado" | "limite_diario_80";

export const JANELA_ALERTA_MS = 3600_000;

/** Grava o alerta se não houve outro igual na última hora. Devolve true se deve enviar. */
export async function reservarAlerta(db: SupabaseClient, tipo: TipoAlerta, referencia: string, agora = Date.now()): Promise<boolean> {
  const { data } = await db.from("partner_api_alertas")
    .select("id").eq("tipo", tipo).eq("referencia", referencia)
    .gte("enviado_em", new Date(agora - JANELA_ALERTA_MS).toISOString())
    .limit(1).maybeSingle();
  if (data) return false;
  const { error } = await db.from("partner_api_alertas").insert({ tipo, referencia });
  return !error;
}

/** Notifica o ADMIN (sino + e-mail) e, quando informado, o partner. Nunca derruba a chamada. */
export async function alertar(db: SupabaseClient, tipo: TipoAlerta, referencia: string, a: {
  titulo: string; mensagem: string; emailPartner?: string | null; mensagemPartner?: string;
}): Promise<void> {
  try {
    if (!(await reservarAlerta(db, tipo, referencia))) return;
    await notifyByRoles(["ADMIN"], { type: "info", title: a.titulo, message: a.mensagem, action_url: "/admin-cadastros/chaves-api" });
    const admin = process.env.EMAIL_ADMIN;
    if (admin) await enviarEmailHtml(admin, a.titulo, emailHtml(a.titulo, [a.mensagem.replace(/</g, "&lt;"), "Veja em app.v3partners.com.br/admin-cadastros/chaves-api."])).catch(() => {});
    if (a.emailPartner && a.mensagemPartner) {
      await enviarEmailHtml(a.emailPartner, a.titulo, emailHtml(a.titulo, [a.mensagemPartner.replace(/</g, "&lt;")])).catch(() => {});
    }
  } catch (e) {
    console.error("[api-v1 alertas]", tipo, e instanceof Error ? e.message : e);
  }
}
