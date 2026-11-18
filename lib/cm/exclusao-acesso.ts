// Quem pode excluir documento de qualificação (BRIEF Permissões do Analista de Mesa, 17/11/2026).
// ADMIN e GESTAO excluem pelo papel. O Analista de Mesa (MESA_OPERACIONAL) exclui só com a permissão individual
// `qualificacao_excluir_documento` em user_feature_access (mesmo desenho do Cockpit de Compliance e da Due Diligence).
// A função de banco fn_excluir_documento_qualificacao repete a regra por conta própria (segunda camada) e aplica o limite
// diário; este módulo é a camada da rota e do botão.
import type { SupabaseClient } from "@supabase/supabase-js";

export const FEATURE_EXCLUIR_DOCUMENTO = "qualificacao_excluir_documento";
/** Lista fechada de chaves que a tela de Usuários concede (primeira entrega: uma só). */
export const FEATURES_PERMISSOES_MESA = [FEATURE_EXCLUIR_DOCUMENTO] as const;
export const PAPEIS_EXCLUSAO_DIRETA = ["ADMIN", "GESTAO"] as const;
export const PAPEL_ANALISTA = "MESA_OPERACIONAL";
export const LIMITE_DIARIO_EXCLUSOES_ANALISTA = 20;

export function featureConcedivel(feature: unknown): feature is (typeof FEATURES_PERMISSOES_MESA)[number] {
  return typeof feature === "string" && (FEATURES_PERMISSOES_MESA as readonly string[]).includes(feature);
}

/** Regra pura: papel de sócio exclui; analista exclui só com a permissão; qualquer outro papel nunca. */
export function decidirExclusao(role: string | null | undefined, temPermissao: boolean): boolean {
  if (!role) return false;
  if ((PAPEIS_EXCLUSAO_DIRETA as readonly string[]).includes(role)) return true;
  return role === PAPEL_ANALISTA && temPermissao;
}

/** Lê a permissão individual (chave de serviço). Erro de leitura fecha: false. */
export async function temPermissaoExcluirDocumento(db: SupabaseClient, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await db
    .from("user_feature_access")
    .select("id")
    .eq("user_id", userId)
    .eq("feature", FEATURE_EXCLUIR_DOCUMENTO)
    .maybeSingle();
  if (error) {
    console.error("[exclusao-acesso] erro ao checar permissão:", error.message);
    return false;
  }
  return !!data;
}

export async function podeExcluirDocumento(db: SupabaseClient, userId: string | null | undefined, role: string | null | undefined): Promise<boolean> {
  if (role && (PAPEIS_EXCLUSAO_DIRETA as readonly string[]).includes(role)) return true;
  if (role !== PAPEL_ANALISTA) return false;
  return decidirExclusao(role, await temPermissaoExcluirDocumento(db, userId));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PedidoPermissao = { user_id: string; feature: (typeof FEATURES_PERMISSOES_MESA)[number] };
export type ResultadoPedido = { ok: true; pedido: PedidoPermissao } | { ok: false; status: number; erro: string };

/**
 * Valida o pedido de conceder ou revogar (POST e DELETE de /api/usuarios/permissoes-mesa), em ordem:
 * corpo e uuid (422), chave fora da lista fechada (422), autoalteração (403), alvo que não é Analista de Mesa (422).
 * O papel ADMIN do chamador é conferido na rota, antes desta função.
 */
export function validarPedidoPermissao(body: unknown, callerId: string, alvoRole: string | null | undefined): ResultadoPedido {
  const b = (body ?? {}) as { user_id?: unknown; feature?: unknown };
  if (typeof b.user_id !== "string" || !UUID_RE.test(b.user_id)) return { ok: false, status: 422, erro: "Usuário inválido." };
  if (!featureConcedivel(b.feature)) return { ok: false, status: 422, erro: "Permissão inválida." };
  if (b.user_id === callerId) return { ok: false, status: 403, erro: "Ninguém altera a própria permissão." };
  if (alvoRole !== PAPEL_ANALISTA) return { ok: false, status: 422, erro: "A permissão só vale para o Analista de Mesa." };
  return { ok: true, pedido: { user_id: b.user_id, feature: b.feature } };
}

/** Código de erro da função de banco para o status HTTP da rota. 42501 papel; P0429 limite diário; P0001 regra; resto 500. */
export function statusDoErroDeExclusao(code: string | null | undefined): number {
  if (code === "42501") return 403;
  if (code === "P0429") return 429;
  if (code === "P0001") return 409;
  return 500;
}
