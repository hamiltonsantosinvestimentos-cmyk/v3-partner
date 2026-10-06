import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Termo de Adesão ao NCNDA Mestre (BRIEF 06/10/2026).
 *
 * Regras impostas no SERVIDOR (o botão da tela é só conveniência): perfil, estado do
 * contrato de origem, natureza de Acordo Mestre, série do template e limites de aderentes.
 * O contrato de origem nunca é alterado por este fluxo.
 */

export const ADHESION_SERIES = "V3C-ADE";
export const ADHESION_PARENT_SERIES_PREFIX = "V3C-NDA";
export const ADHESION_ALLOWED_ROLES = ["ADMIN", "GESTAO"];
export const ADHESION_MIN_PARTIES = 1;
export const ADHESION_MAX_PARTIES = 10;

export interface AdhesionParent {
  id: string;
  contract_code: string;
  vertical: string;
  status_signature: string;
  signed_at: string | null;
  deleted_at: string | null;
  rendered_html: string | null;
}

export type AdhesionCheck =
  | { ok: true; parent: AdhesionParent }
  | { ok: false; status: number; error: string };

/** O texto assinado precisa conter a cláusula de adesões futuras (natureza de Acordo Mestre). */
export function hasMasterAgreementClause(html: string | null | undefined): boolean {
  const text = (html ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
  return /ADES(Õ|O)ES\s+FUTURAS/i.test(text);
}

export async function validateAdhesionParent(
  db: SupabaseClient,
  parentId: string,
  role: string | null | undefined,
): Promise<AdhesionCheck> {
  if (!role || !ADHESION_ALLOWED_ROLES.includes(role)) {
    return { ok: false, status: 403, error: "Somente ADMIN ou GESTAO podem adicionar adesão a um contrato." };
  }
  const { data: parent } = await db
    .from("operation_contracts")
    .select("id, contract_code, vertical, status_signature, signed_at, deleted_at, rendered_html")
    .eq("id", parentId)
    .maybeSingle();
  if (!parent) return { ok: false, status: 404, error: "Contrato de origem não encontrado." };
  if (parent.deleted_at) return { ok: false, status: 422, error: "O contrato de origem está na Lixeira." };
  if (parent.status_signature !== "assinado") {
    return { ok: false, status: 422, error: `O contrato de origem precisa estar assinado (status atual: ${parent.status_signature}).` };
  }
  if (!String(parent.contract_code ?? "").startsWith(ADHESION_PARENT_SERIES_PREFIX)) {
    return { ok: false, status: 422, error: "Só é possível adicionar adesão a um NCNDA (série V3C-NDA)." };
  }
  if (!hasMasterAgreementClause(parent.rendered_html)) {
    return { ok: false, status: 422, error: "Este contrato não tem natureza de Acordo Mestre (cláusula de adesões futuras ausente)." };
  }
  return { ok: true, parent: parent as AdhesionParent };
}

/** "6 de outubro de 2026" (dia 1 sai "1º"), no fuso de Brasília, sem deslocar o dia. */
export function dateExtensoBR(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "numeric", month: "long", year: "numeric",
  }).formatToParts(d);
  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = pick("day");
  return `${day === "1" ? "1º" : day} de ${pick("month")} de ${pick("year")}`;
}
