// Aviso por e-mail ao partner originador quando o deal muda de etapa (BRIEF Mesa M&A bloco C, segunda
// entrega, 01/11/2026). O e-mail sai pelo workflow W22 do n8n (formata, roda o Brand Audit e dispara pelo
// Resend); nunca direto de uma rota. Só passa pela chave `ma_aviso_email_partner` (desligada por padrão) e
// só o payload mínimo vai ao webhook: destinatário, primeiro nome, etapa, link. Nunca código do deal, nome da
// empresa, valor, mesa de destino ou motivo (o código leva a sigla do setor). Política de sigilo 31/10/2026.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCmFlag } from "@/lib/cm-flags";
import { dbStageLabel } from "@/lib/ma/pipeline";
import { ehPapelInternoDeal } from "@/lib/ma/acesso-deal";

export const FLAG_AVISO_EMAIL_PARTNER = "ma_aviso_email_partner";
export const ACAO_ENVIADO = "PARTNER_EMAIL_ENVIADO";
export const ACAO_SUPRIMIDO = "PARTNER_EMAIL_SUPRIMIDO";

const WEBHOOK_W22 = `${process.env.N8N_BASE_URL ?? "https://n8n-514n.onrender.com"}/webhook/v3-aviso-deal-partner`;
const SAIDAS_DO_FUNIL = ["CLOSED_WON", "CLOSED_LOST"];
const MENSAGEM_NEUTRA = "Um deal que você originou foi atualizado. Veja os detalhes na plataforma.";

export type PayloadAviso = {
  destinatario: string;
  primeiro_nome: string;
  etapa: string;
  neutro: boolean;
  mensagem: string | null;
  link: string;
};

export function primeiroNome(nomeCompleto: string | null | undefined): string {
  return (nomeCompleto ?? "").trim().split(/\s+/)[0] ?? "";
}

/**
 * Payload filtrado. Ganho e Perdido usam mensagem neutra e não revelam o resultado nem a etapa.
 * Função pura: é o único ponto que decide o que sai da V3.
 */
export function montarPayloadAviso(p: {
  etapaDb: string; email: string; nomeCompleto: string | null; dealId: string; appUrl: string;
}): PayloadAviso {
  const neutro = SAIDAS_DO_FUNIL.includes(p.etapaDb);
  return {
    destinatario: p.email,
    primeiro_nome: primeiroNome(p.nomeCompleto),
    etapa: neutro ? "" : dbStageLabel(p.etapaDb),
    neutro,
    mensagem: neutro ? MENSAGEM_NEUTRA : null,
    link: `${p.appUrl.replace(/\/+$/, "")}/ma/${p.dealId}`,
  };
}

async function registrar(db: SupabaseClient, action: string, dealId: string, etapaDb: string, extra?: Record<string, unknown>) {
  const { error } = await db.from("audit_logs").insert({
    action, entity: "ma_deals", entity_id: dealId, new_data: { etapa: etapaDb, ...extra },
  });
  if (error) console.error("[aviso-originador] falha ao gravar audit_logs", { action, code: error.code });
  return !error;
}

export type ResultadoAviso = "desligado" | "sem_originador_externo" | "suprimido" | "enviado" | "falhou";

/**
 * Chamar depois de uma mudança de etapa gravada com sucesso. Nunca lança: a mudança de etapa já aconteceu e
 * o aviso é complementar. Um e-mail por deal e etapa; repetição é registrada como PARTNER_EMAIL_SUPRIMIDO.
 */
export async function avisarOriginadorDaMudancaDeEtapa(db: SupabaseClient, dealId: string, etapaDb: string): Promise<ResultadoAviso> {
  try {
    if (!(await getCmFlag(FLAG_AVISO_EMAIL_PARTNER, false))) return "desligado";
    const segredo = process.env.N8N_AVISO_PARTNER_SECRET;
    if (!segredo) { console.error("[aviso-originador] N8N_AVISO_PARTNER_SECRET ausente, nada enviado"); return "falhou"; }

    const { data: deal } = await db.from("ma_deals").select("id, originator_profile_id, created_by").eq("id", dealId).is("deleted_at", null).maybeSingle();
    const alvo = (deal?.originator_profile_id ?? deal?.created_by) as string | null | undefined;
    if (!deal || !alvo) return "sem_originador_externo";

    const { data: perfil } = await db.from("profiles").select("role, full_name, email").eq("id", alvo).maybeSingle();
    if (!perfil || ehPapelInternoDeal(perfil.role as string) || !perfil.email) return "sem_originador_externo";

    const { data: jaAvisado } = await db.from("audit_logs").select("id").eq("action", ACAO_ENVIADO).eq("entity", "ma_deals")
      .eq("entity_id", dealId).eq("new_data->>etapa", etapaDb).limit(1);
    if (jaAvisado && jaAvisado.length > 0) {
      await registrar(db, ACAO_SUPRIMIDO, dealId, etapaDb);
      return "suprimido";
    }

    const payload = montarPayloadAviso({
      etapaDb, email: perfil.email as string, nomeCompleto: (perfil.full_name as string | null) ?? null, dealId,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br",
    });
    const res = await fetch(WEBHOOK_W22, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-v3-secret": segredo },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) { console.error("[aviso-originador] W22 respondeu", res.status); return "falhou"; }
    await registrar(db, ACAO_ENVIADO, dealId, etapaDb);
    return "enviado";
  } catch (e) {
    console.error("[aviso-originador] falhou:", e);
    return "falhou";
  }
}
