import type { SupabaseClient } from "@supabase/supabase-js";

// V3 Access reaproveitou o papel STARTER (PR #220, no ar em 03/10/2026), mas ainda existem
// partners do antigo "V3 Starter" (R$ 297/mês) com esse mesmo papel. Só é partner Access quem
// tem papel STARTER E um cadastro Starter aprovado feito a partir do lançamento do Access
// (cadastro em /cadastro-partner-access, anuidade de R$ 1.447). O link da Análise Estruturada
// V3 (R$ 1.500) e o card do dashboard ficam só para esses.

export const ACCESS_LANCAMENTO = "2026-10-03T00:00:00Z";

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
