import { createClient as sc } from "@supabase/supabase-js";

// Chaves de rollout da Bolsa de Ativos (tabela cm_feature_flags, migration 20260920b).
// Leitura so pelo servidor. Qualquer falha de leitura cai no fallback (por padrao,
// DESLIGADO): uma chave que nao da pra ler nunca liga um comportamento automatico.

export async function getCmFlag(key: string, fallback = false): Promise<boolean> {
  try {
    const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data, error } = await db.from("cm_feature_flags").select("enabled").eq("key", key).maybeSingle();
    if (error || !data) return fallback;
    return !!data.enabled;
  } catch {
    return fallback;
  }
}

/** Gatilho automatico da reuniao inicial (Etapa 2), ambos os lados. Ver migration 20260920b. */
export const FLAG_MEETING_AUTOTRIGGER = "meeting_autotrigger";
