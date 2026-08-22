// Gate de acesso ao Cockpit de Due Diligence e Compliance (Bolsa de Ativos).
// Diferente do restante da Bolsa de Ativos (gate por role: ADMIN/GESTAO/MESA_OPERACIONAL),
// este cockpit e restrito a uma lista fechada de 5 pessoas nomeadas por Joao (22/08/2026):
// os 3 socios ADMIN (Joao, Hamilton, Robson) + Taisa Pedroso + Dr. Luis Athaydes.
// O gate e por user_id individual, via user_feature_access, para que uma conta ADMIN/GESTAO/
// MESA_OPERACIONAL futura nao herde acesso automatico so por ter esse role.
//
// Ver: 06_Operacional/SOPs/2026-08-22_Operacional_BRIEF-Cockpit-Compliance-Bolsa-Ativos_v1.html
//      wiki/sources/2026-08-22-feature-spec-compliance-dashboard-fase0-1.md

import { createClient as sc } from "@supabase/supabase-js";

export const BOLSA_COMPLIANCE_DASHBOARD_FEATURE = "bolsa_compliance_dashboard";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/**
 * Verifica se o usuario tem grant explicito para o Cockpit de Compliance da Bolsa de Ativos.
 * Nunca usar role (ADMIN/GESTAO/MESA_OPERACIONAL) como substituto disto -- o gate e por
 * user_id individual em user_feature_access, decisao explicita de Joao (22/08/2026).
 */
export async function hasComplianceDashboardAccess(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await svc()
    .from("user_feature_access")
    .select("id")
    .eq("user_id", userId)
    .eq("feature", BOLSA_COMPLIANCE_DASHBOARD_FEATURE)
    .maybeSingle();
  if (error) {
    console.error("[compliance-access] erro ao checar grant:", error.message);
    return false;
  }
  return !!data;
}
