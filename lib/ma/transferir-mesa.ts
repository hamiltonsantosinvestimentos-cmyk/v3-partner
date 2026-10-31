// Bloco C da Mesa M&A (BRIEF 30/10/2026, revisão 3.4): transferir deal para a Bolsa de Ativos ou a
// Mesa de Crédito. Ponto único de papel, tradução de erro do banco, aviso ao partner e selo do card.
//
// As funções SQL ma_deal_transfer_to_desk e ma_desk_confirm_classification só executam para o
// service_role (migration 20261030g). As rotas validam o papel pela SESSÃO do usuário, chamam a
// função com a chave de serviço e passam p_actor; a função revalida o papel de p_actor.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc, type SupabaseClient } from "@supabase/supabase-js";
import { sendPushNotification } from "@/lib/push";

export const DESK_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;
const STAFF_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"];

import type { DeskDestino, TransferenciaMesa } from "@/lib/ma/transferir-mesa-tipos";
export type { DeskDestino, TransferenciaMesa };
export const DESTINO_LABEL: Record<DeskDestino, string> = { bolsa: "Bolsa de Ativos", credito: "Mesa de Crédito" };

export function serviceClient(): SupabaseClient {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export type DeskActor = { userId: string; role: string; name: string | null };

/** Valida a sessão e o papel (ADMIN, GESTAO, MESA_OPERACIONAL). Partner recebe 403. */
export async function requireDeskActor(): Promise<{ ok: true; actor: DeskActor } | { ok: false; res: NextResponse }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, res: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  const { data: perfil } = await serviceClient().from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!perfil || !(DESK_ROLES as readonly string[]).includes(perfil.role as string)) {
    return { ok: false, res: NextResponse.json({ error: "A transferência entre mesas é conduzida pela Mesa M&A." }, { status: 403 }) };
  }
  return { ok: true, actor: { userId: user.id, role: perfil.role as string, name: (perfil.full_name as string | null) ?? null } };
}

/**
 * Traduz o erro do banco. As mensagens das funções são em português e seguras para o operador
 * (4xx); erro inesperado (5xx) devolve texto genérico e vai para o log do servidor.
 */
export function rpcErrorResponse(err: { code?: string; message?: string }): NextResponse {
  const code = err.code ?? "";
  const status =
    code === "42501" ? 403 :
    code === "P0002" ? 404 :
    code === "23505" ? 409 :
    code === "22023" || code === "23514" ? 422 : 500;
  if (status === 500) {
    console.error("[ma/transferir-mesa] erro inesperado do banco:", code, err.message);
    return NextResponse.json({ error: "Não foi possível concluir a operação. Tente novamente ou chame a Mesa." }, { status });
  }
  return NextResponse.json({ error: err.message ?? "Operação recusada", code }, { status });
}

/**
 * Aviso genérico ao partner originador (BRIEF 4C). Texto fixo, sem mesa, código, valor ou motivo.
 * Dentro da plataforma, com await e verificação de erro. Falha não desfaz a movimentação: grava
 * PARTNER_NOTIFY_FAIL em audit_logs. O e-mail via n8n é entrega posterior (workflow novo).
 */
export async function notifyDealPartner(db: SupabaseClient, dealId: string, evento: "transferencia" | "classificacao"): Promise<void> {
  try {
    const { data: deal } = await db
      .from("ma_deals")
      .select("id, target_company, title, assigned_to, originator_profile_id, created_by")
      .eq("id", dealId)
      .single();
    const alvo = (deal?.originator_profile_id ?? deal?.assigned_to ?? deal?.created_by) as string | null | undefined;
    if (!deal || !alvo) return;
    const { data: perfil } = await db.from("profiles").select("role").eq("id", alvo).single();
    if (!perfil || STAFF_ROLES.includes(perfil.role as string)) return;

    const empresa = (deal.target_company as string | null) || (deal.title as string | null) || "seu deal";
    const message = evento === "transferencia"
      ? `O deal ${empresa} foi encaminhado a outra mesa da V3.`
      : `Houve uma atualização no deal ${empresa}.`;
    const title = "Atualização do seu deal";
    const action_url = `/ma/${deal.id}`;

    const { error } = await db.from("notifications").insert({ user_id: alvo, title, message, type: "deal", action_url });
    if (error) throw new Error(error.message);
    await sendPushNotification({ user_id: alvo, title, body: message, url: action_url }).catch(() => undefined);
  } catch (e) {
    try {
      await db.from("audit_logs").insert({
        action: "PARTNER_NOTIFY_FAIL",
        entity: "ma_deals",
        entity_id: dealId,
        new_data: { evento, erro: String(e instanceof Error ? e.message : e).slice(0, 200) },
      });
    } catch { /* sem outro canal: o log do servidor já registrou */ }
    console.error("[ma/transferir-mesa] aviso ao partner falhou:", e);
  }
}

// Selo do card e caminho do ativo: função pura em arquivo próprio (testável sem o Next).
export { anexarTransferencias } from "@/lib/ma/transferencias";
