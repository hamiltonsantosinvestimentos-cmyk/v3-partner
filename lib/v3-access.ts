import { createClient as sc, type SupabaseClient } from "@supabase/supabase-js";

// V3 Access reaproveitou o papel STARTER (PR #220, no ar em 03/10/2026), mas ainda existem
// partners do antigo "V3 Starter" (R$ 297/mês) com esse mesmo papel. Só é partner Access quem
// tem papel STARTER E um cadastro Starter aprovado feito a partir do lançamento do Access
// (cadastro em /cadastro-partner-access, anuidade de R$ 1.447). O link da Análise Estruturada
// V3 (R$ 1.500) e o card do dashboard ficam só para esses.

import { ACCESS_LANCAMENTO } from "@/lib/v3-access-rotulos";
export { ACCESS_LANCAMENTO, cadastroStarterAntigo, rotuloStarter } from "@/lib/v3-access-rotulos";

export async function ehPartnerAccess(db: SupabaseClient, profileId: string | null | undefined): Promise<boolean> {
  if (!profileId) return false;
  const { data: profile } = await db.from("profiles").select("role, email").eq("id", profileId).maybeSingle();
  if (profile?.role !== "STARTER" || !profile.email) return false;
  const { data: cadastro } = await db
    .from("partner_registrations")
    .select("id")
    .ilike("email", profile.email)
    .eq("plano", "STARTER")
    .eq("status", "APROVADO")
    .gte("created_at", ACCESS_LANCAMENTO)
    .limit(1)
    .maybeSingle();
  return !!cadastro;
}

/** Ids dos perfis STARTER que são do antigo V3 Starter (em lote, para listas). */
export async function idsStarterAntigo(db: SupabaseClient): Promise<Set<string>> {
  const { data: starters } = await db.from("profiles").select("id, email").eq("role", "STARTER");
  if (!starters?.length) return new Set();
  const { data: cadastros } = await db
    .from("partner_registrations")
    .select("email")
    .eq("plano", "STARTER")
    .eq("status", "APROVADO")
    .gte("created_at", ACCESS_LANCAMENTO);
  const access = new Set((cadastros ?? []).map((c) => String(c.email ?? "").toLowerCase()));
  return new Set(starters.filter((p) => !access.has(String(p.email ?? "").toLowerCase())).map((p) => p.id as string));
}

/** Partner do antigo V3 Starter (papel STARTER sem cadastro do Access): mantém o menu de antes do Access. */
export async function ehStarterAntigo(profileId: string): Promise<boolean> {
  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await db.from("profiles").select("role").eq("id", profileId).maybeSingle();
  return profile?.role === "STARTER" && !(await ehPartnerAccess(db, profileId));
}
