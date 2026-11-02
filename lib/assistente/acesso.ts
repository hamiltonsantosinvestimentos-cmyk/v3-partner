import { createHmac, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// MY ASSISTANT IA: autorização por id de usuário (não por papel), assinatura do webhook e
// identidade do remetente. ASSISTENTE_ALLOWED_USER_IDS nunca vai ao navegador: o layout passa só um booleano.

export function idsAutorizados(): string[] {
  return (process.env.ASSISTENTE_ALLOWED_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function usuarioAutorizado(userId: string | null | undefined): boolean {
  return !!userId && idsAutorizados().includes(userId);
}

/** Usuário da sessão, só se autorizado. As rotas de tela usam este cliente e respeitam a RLS. */
export async function exigirUsuarioAutorizado() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !usuarioAutorizado(user.id)) return null;
  // Sem o tipo gerado do banco: as tabelas assistente_* só entram nele depois da migration. Continua a sessão do usuário.
  return { user, supabase: supabase as unknown as SupabaseClient };
}

/** HMAC SHA-256 sobre o corpo bruto, com o prefixo sha256= do gateway, em tempo constante. */
export function assinaturaValida(corpoBruto: string, cabecalho: string | null, segredo: string | undefined): boolean {
  if (!segredo || !cabecalho) return false;
  const esperado = Buffer.from(`sha256=${createHmac("sha256", segredo).update(corpoBruto).digest("hex")}`);
  const recebido = Buffer.from(cabecalho);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

function canonico(jid: string): string {
  return jid.replace(/@s\.whatsapp\.net$/, "@c.us");
}

/**
 * O remetente precisa bater exatamente com o whatsappId verificado, ou com senderPhone quando o gateway
 * resolver um @lid. Sem correspondência exata a mensagem é ignorada: a regra não é afrouxada, nem para o 9º dígito.
 */
export function remetenteConfere(
  msg: { from?: string | null; senderPhone?: string | null },
  config: { whatsapp_id: string | null; phone_e164: string | null },
): boolean {
  if (!config.whatsapp_id || !msg.from) return false;
  if (canonico(msg.from) === canonico(config.whatsapp_id)) return true;
  if (!msg.from.endsWith("@lid") || !msg.senderPhone) return false;
  const digitosJid = canonico(config.whatsapp_id).replace(/@c\.us$/, "");
  const digitosE164 = (config.phone_e164 ?? "").replace(/\D/g, "");
  return msg.senderPhone === digitosJid || msg.senderPhone === digitosE164;
}

/** Formas do mesmo telefone para a limpeza de lid_mappings: só dígitos, com e sem o 9º dígito no Brasil. */
export function variantesTelefone(telefones: (string | null | undefined)[]): string[] {
  const saida = new Set<string>();
  for (const t of telefones) {
    if (!t || t.endsWith("@lid")) continue;
    const d = t.split("@")[0].replace(/\D/g, "");
    if (!d) continue;
    saida.add(d);
    if (d.startsWith("55") && d.length === 13 && d[4] === "9") saida.add(d.slice(0, 4) + d.slice(5));
    if (d.startsWith("55") && d.length === 12) saida.add(`${d.slice(0, 4)}9${d.slice(4)}`);
  }
  return [...saida];
}
