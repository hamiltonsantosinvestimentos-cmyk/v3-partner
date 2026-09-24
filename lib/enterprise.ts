import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ENTERPRISE WHITE LABEL (24/09/2026) — ver supabase/migrations/20260924_enterprise_white_label.sql
 *
 * - Master: profile role ENTERPRISE com enterprise_id NULL.
 * - Usuário: profile role ENTERPRISE com enterprise_id = master (até MAX_USUARIOS por master).
 * - Comissão de qualquer venda da equipe vai para o master (55%); o master repassa a cada
 *   usuário o % definido por ele, sobre os 55% (enterprise_repasses).
 * - Marca (nome + logo) do master vale para ele e para os usuários dele.
 */

export const MAX_USUARIOS = 10;
export const ENTERPRISE_COMISSAO_PCT = 55;
export const V3_LOGO_URL = "https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png";

export interface Marca { nome: string; logoUrl: string | null }

export interface EnterpriseContexto {
  /** true = master de um Enterprise; false = usuário abaixo de um master. */
  ehMaster: boolean;
  masterId: string;
  /** Master: ids dos usuários dele. Usuário: vazio. */
  usuariosIds: string[];
  marca: Marca | null;
}

type PerfilBase = { id: string; role: string | null; enterprise_id?: string | null };

/** Contexto Enterprise de um perfil, ou null se não é Enterprise. */
export async function contextoEnterprise(db: SupabaseClient, perfil: PerfilBase | string): Promise<EnterpriseContexto | null> {
  let p = typeof perfil === "string" ? null : perfil;
  if (!p || p.enterprise_id === undefined) {
    const id = typeof perfil === "string" ? perfil : perfil.id;
    const { data } = await db.from("profiles").select("id, role, enterprise_id").eq("id", id).maybeSingle();
    p = data as PerfilBase | null;
  }
  if (!p || p.role !== "ENTERPRISE") return null;

  const masterId = p.enterprise_id ?? p.id;
  const ehMaster = !p.enterprise_id;
  const [{ data: master }, usuarios] = await Promise.all([
    db.from("profiles").select("full_name, white_label_nome, white_label_logo_url").eq("id", masterId).maybeSingle(),
    ehMaster ? db.from("profiles").select("id").eq("enterprise_id", masterId) : Promise.resolve({ data: [] as { id: string }[] }),
  ]);
  const nomeMarca = (master?.white_label_nome as string | null) ?? null;
  const logo = (master?.white_label_logo_url as string | null) ?? null;
  return {
    ehMaster,
    masterId,
    usuariosIds: ((usuarios as { data: { id: string }[] | null }).data ?? []).map((u) => u.id),
    marca: nomeMarca || logo ? { nome: nomeMarca ?? (master?.full_name as string) ?? "Enterprise", logoUrl: logo } : null,
  };
}

/**
 * Ids de partner cujas propostas/leads este usuário enxerga: master vê o dele + os dos
 * usuários; qualquer outro perfil vê só o próprio.
 */
export async function idsDaEquipe(db: SupabaseClient, perfil: PerfilBase | string): Promise<string[]> {
  const id = typeof perfil === "string" ? perfil : perfil.id;
  const ctx = await contextoEnterprise(db, perfil);
  if (!ctx?.ehMaster) return [id];
  return [id, ...ctx.usuariosIds];
}

/** Marca do white label de um perfil (dele se master, do master se usuário). */
export async function marcaDoPerfil(db: SupabaseClient, perfil: PerfilBase | string): Promise<Marca | null> {
  return (await contextoEnterprise(db, perfil))?.marca ?? null;
}

/** Marca do destinatário de um e-mail (null se não é Enterprise com marca configurada). */
export async function marcaPorEmail(db: SupabaseClient, email: string): Promise<Marca | null> {
  const { data } = await db.from("profiles").select("id, role, enterprise_id").ilike("email", email.trim()).maybeSingle();
  if (!data || data.role !== "ENTERPRISE") return null;
  return marcaDoPerfil(db, data as PerfilBase);
}

/** Troca a marca V3 pela do Enterprise num HTML (e-mail, relatório, PDF). */
export function aplicarMarca(html: string, marca: Marca | null): string {
  if (!marca) return html;
  let out = html;
  if (marca.logoUrl) {
    out = out.split(V3_LOGO_URL).join(marca.logoUrl);
    out = out.replace(/alt="V3 Partners"/g, `alt="${marca.nome.replace(/"/g, "&quot;")}"`);
  }
  return out;
}
