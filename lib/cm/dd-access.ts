// Gate da aba Due Diligence da Ficha de Qualificacao (08/10/2026). Mesmo desenho do cockpit de
// compliance: grant por usuario em user_feature_access, nunca por role, sem bypass para ADMIN.

import { createClient as sc } from "@supabase/supabase-js";

export const DUE_DILIGENCE_FEATURE = "due_diligence_qualificacao";

export async function hasDueDiligenceAccess(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await db
    .from("user_feature_access")
    .select("id")
    .eq("user_id", userId)
    .eq("feature", DUE_DILIGENCE_FEATURE)
    .maybeSingle();
  if (error) {
    console.error("[dd-access] erro ao checar grant:", error.message);
    return false;
  }
  return !!data;
}
