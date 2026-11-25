// Recuperação de senha com a marca do Enterprise: link gerado no servidor e e-mail pelo send()
// com o remetente da marca. BRIEF docs/briefs/2026-11-25_recuperar-senha-marca-enterprise.md
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { enterprisePorDominio } from "@/lib/enterprise";
import { dominiosVerificadosResend } from "@/lib/email-remetente";
import { emailParaIlike, montarRemetente } from "@/lib/email-remetente-regras";
import { daEquipe, podeEnviar, MAX_RESERVAS_IP_HORA, MAX_RESERVAS_USUARIO_HORA, type Reserva } from "@/lib/recuperar-senha-regras";
import { enviarRecuperacaoSenha } from "@/lib/email";

const EV_RESERVA = "recuperar_senha_reserva";
const EV_ENVIADO = "recuperar_senha_enviado";
const NOME_AUDITORIA = "Pedido anônimo de recuperação de senha";

export function servico(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/**
 * Domínio acessado com marca pronta para e-mail: é o domínio de um master Enterprise, com status
 * "ativo" e verificado no Resend. null = fluxo da V3 (Supabase) sem mudança.
 */
export async function dominioComMarcaPronta(db: SupabaseClient, host: string | null): Promise<{ masterId: string; dominio: string } | null> {
  try {
    const e = await enterprisePorDominio(db, host);
    if (!e) return null;
    const { data: m } = await db.from("profiles")
      .select("full_name, white_label_nome, white_label_dominio, white_label_dominio_status")
      .eq("id", e.masterId).maybeSingle();
    if (!m?.white_label_dominio) return null;
    const from = montarRemetente({
      nome: (m.white_label_nome as string | null) || (m.full_name as string | null),
      dominio: m.white_label_dominio as string,
      status: m.white_label_dominio_status as string | null,
      verificados: await dominiosVerificadosResend(),
    });
    if (!from) return null;
    return { masterId: e.masterId, dominio: String(m.white_label_dominio).trim().toLowerCase() };
  } catch {
    return null;
  }
}

function umaHoraAtras(): string {
  return new Date(Date.now() - 60 * 60_000).toISOString();
}

async function contar(db: SupabaseClient, evento: string, filtro: { entityId?: string; ip?: string }): Promise<number> {
  let q = db.from("audit_logs").select("id", { count: "exact", head: true })
    .eq("entity", "profiles").eq("new_data->>evento", evento).gte("created_at", umaHoraAtras());
  if (filtro.entityId) q = q.eq("entity_id", filtro.entityId);
  if (filtro.ip) q = q.eq("ip_address", filtro.ip);
  const { count, error } = await q;
  if (error) throw new Error(`audit_logs: ${error.message}`);
  return count ?? 0;
}

/** Processa o pedido (roda em after(), depois da resposta). Nunca devolve nada a quem pediu. */
export async function processarPedido(email: string, host: string | null, ip: string | null): Promise<void> {
  const db = servico();
  const alvo = await dominioComMarcaPronta(db, host);
  if (!alvo) return;

  const { data: p } = await db.from("profiles").select("id, role, enterprise_id, full_name")
    .ilike("email", emailParaIlike(email)).limit(1).maybeSingle();
  const perfil = p as { id: string; role: string | null; enterprise_id: string | null; full_name: string | null } | null;
  if (!perfil || !daEquipe(perfil, alvo.masterId)) return; // fora da equipe: nada é enviado

  // Teto de escrita antes de gravar (falha de contagem lança: falha fechado).
  if (await contar(db, EV_RESERVA, { entityId: perfil.id }) >= MAX_RESERVAS_USUARIO_HORA) return;
  if (ip && await contar(db, EV_RESERVA, { ip }) >= MAX_RESERVAS_IP_HORA) return;

  const { data: minha, error: errIns } = await db.from("audit_logs").insert({
    user_id: perfil.id, user_name: NOME_AUDITORIA, action: "ACCESS", entity: "profiles",
    entity_id: perfil.id, new_data: { evento: EV_RESERVA }, ip_address: ip,
  }).select("id, created_at").single();
  if (errIns || !minha) throw new Error(`audit_logs: ${errIns?.message ?? "sem reserva"}`);

  const { data: reservas, error: errRes } = await db.from("audit_logs").select("id, created_at")
    .eq("entity", "profiles").eq("entity_id", perfil.id).eq("new_data->>evento", EV_RESERVA)
    .gte("created_at", umaHoraAtras()).order("created_at", { ascending: true }).order("id", { ascending: true });
  if (errRes) throw new Error(`audit_logs: ${errRes.message}`);
  const envios = await contar(db, EV_ENVIADO, { entityId: perfil.id });
  if (!podeEnviar((reservas ?? []) as Reserva[], String(minha.id), envios, Date.now())) return;

  const { data: u } = await db.auth.admin.getUserById(perfil.id);
  const emailAuth = u?.user?.email;
  if (!emailAuth) return;
  const { data: link, error: errLink } = await db.auth.admin.generateLink({ type: "recovery", email: emailAuth });
  const hash = link?.properties?.hashed_token;
  if (errLink || !hash) throw new Error(`generateLink falhou para ${perfil.id}`);

  const ok = await enviarRecuperacaoSenha({
    to: emailAuth,
    nome: perfil.full_name,
    link: `https://${alvo.dominio}/auth/confirm?token_hash=${encodeURIComponent(hash)}`,
  });
  if (!ok) { console.error("[recuperar-senha] Resend recusou o envio", perfil.id); return; }
  await db.from("audit_logs").insert({
    user_id: perfil.id, user_name: NOME_AUDITORIA, action: "ACCESS", entity: "profiles",
    entity_id: perfil.id, new_data: { evento: EV_ENVIADO }, ip_address: ip,
  });
}
