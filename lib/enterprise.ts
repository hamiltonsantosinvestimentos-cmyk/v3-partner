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

/**
 * A proposta/recurso de `partnerId` pode ser acessada por `userId`? Sim se for dele ou se
 * `userId` é o master de Enterprise do dono (o master acompanha e age nas propostas da equipe).
 */
export async function ehDaEquipe(userId: string, partnerId: string | null | undefined): Promise<boolean> {
  if (!partnerId) return false;
  if (partnerId === userId) return true;
  const { createClient: sc } = await import("@supabase/supabase-js");
  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await db.from("profiles").select("enterprise_id").eq("id", partnerId).maybeSingle();
  return data?.enterprise_id === userId;
}

/**
 * Marca do Enterprise dono de uma análise de crédito (credit_profiles.id): segue a proposta que
 * aponta para o perfil até o partner dela. null = marca V3 (inclui venda direta/site).
 */
export async function marcaDaAnaliseDeCredito(profileId: string): Promise<Marca | null> {
  try {
    const { createClient: sc } = await import("@supabase/supabase-js");
    const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: prop } = await db
      .from("credit_desk_proposals")
      .select("partner_id")
      .eq("credit_profile_id", profileId)
      .not("partner_id", "is", null)
      .limit(1)
      .maybeSingle();
    return prop?.partner_id ? await marcaDoPerfil(db, prop.partner_id as string) : null;
  } catch {
    return null;
  }
}

/** Hosts da própria V3 (nunca são domínio de Enterprise). */
export function ehHostV3(host: string | null | undefined): boolean {
  const h = (host ?? "").toLowerCase().split(":")[0];
  return !h || h === "localhost" || h.endsWith("v3partners.com.br") || h.endsWith("vercel.app") || /^\d+\.\d+\.\d+\.\d+$/.test(h);
}

/**
 * Enterprise dono de um domínio próprio (profiles.white_label_dominio, status ativo ou
 * pendente — pendente já pode estar respondendo enquanto a Vercel termina o certificado).
 */
export async function enterprisePorDominio(db: SupabaseClient, host: string | null | undefined): Promise<{ masterId: string; marca: Marca | null } | null> {
  if (ehHostV3(host)) return null;
  const h = (host ?? "").toLowerCase().split(":")[0];
  const { data } = await db
    .from("profiles")
    .select("id, role, full_name, white_label_nome, white_label_logo_url")
    .ilike("white_label_dominio", h)
    .eq("role", "ENTERPRISE")
    .is("enterprise_id", null)
    .maybeSingle();
  if (!data) return null;
  return {
    masterId: data.id as string,
    marca: { nome: (data.white_label_nome as string | null) ?? (data.full_name as string | null) ?? "Enterprise", logoUrl: (data.white_label_logo_url as string | null) ?? null },
  };
}
