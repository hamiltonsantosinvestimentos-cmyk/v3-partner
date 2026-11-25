// Carrega as concessões de pasta do usuário com a chave de serviço e marca se ele é o dono da operação.
// Dono: em MA, o originador do deal (originator_profile_id, ou created_by se vazio) com o mesmo código da pasta;
// em Crédito, o partner (partner_id ou created_by) da proposta com o mesmo código. Demais verticais: nunca dono.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Concessao } from "@/lib/governance/acesso-pasta";

export async function carregarConcessoes(db: SupabaseClient, userId: string): Promise<Concessao[]> {
  const { data: grants } = await db
    .from("folder_access_grants")
    .select("expires_at, folder:folder_registry!folder_id(full_path, vertical, deal_code)")
    .eq("user_id", userId);

  const linhas = (grants ?? []).map((g: Record<string, unknown>) => {
    const f = g.folder as { full_path: string; vertical: string | null; deal_code: string | null } | null;
    return f ? { full_path: f.full_path, vertical: f.vertical, deal_code: f.deal_code, expires_at: (g.expires_at as string | null) ?? null } : null;
  }).filter((x): x is { full_path: string; vertical: string | null; deal_code: string | null; expires_at: string | null } => !!x);

  const codigosMa = linhas.filter(l => l.vertical === "MA" && l.deal_code).map(l => l.deal_code as string);
  const codigosCr = linhas.filter(l => l.vertical === "Credito" && l.deal_code).map(l => l.deal_code as string);

  const donosMa = new Set<string>();
  if (codigosMa.length) {
    const [porV3, porCode] = await Promise.all([
      db.from("ma_deals").select("v3_code, code, originator_profile_id, created_by").in("v3_code", codigosMa),
      db.from("ma_deals").select("v3_code, code, originator_profile_id, created_by").in("code", codigosMa),
    ]);
    for (const d of [...(porV3.data ?? []), ...(porCode.data ?? [])]) {
      if ((d.originator_profile_id ?? d.created_by) === userId) {
        if (d.v3_code) donosMa.add(d.v3_code);
        if (d.code) donosMa.add(d.code);
      }
    }
  }
  const donosCr = new Set<string>();
  if (codigosCr.length) {
    const { data } = await db.from("credit_desk_proposals").select("code, partner_id, created_by").in("code", codigosCr);
    for (const p of data ?? []) if (p.code && (p.partner_id === userId || p.created_by === userId)) donosCr.add(p.code);
  }

  return linhas.map(l => ({
    full_path: l.full_path,
    vertical: l.vertical,
    expires_at: l.expires_at,
    dono: !!l.deal_code && ((l.vertical === "MA" && donosMa.has(l.deal_code)) || (l.vertical === "Credito" && donosCr.has(l.deal_code))),
  }));
}
