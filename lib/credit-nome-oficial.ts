import type { SupabaseClient } from "@supabase/supabase-js";

// Nome oficial do analisado (23/09/2026): o nome que chega na análise é o que o cliente/partner
// digitou (pode vir errado, abreviado ou ser o nome do solicitante em vez da empresa). O dossiê
// passa a usar o nome das fontes oficiais — razão social da Receita pra CNPJ, nome do Serasa
// pra CPF (ou CNPJ sem Receita) — e guarda o digitado em raw_result.nome_informado.

type PerfilNome = {
  subject_type?: string | null;
  subject_cpf_cnpj?: string | null;
  receita_data?: unknown;
  serasa_data?: unknown;
};

const limpo = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ") : null);

export function nomeOficialDoPerfil(p: PerfilNome): string | null {
  const doc = String(p.subject_cpf_cnpj ?? "").replace(/\D/g, "");
  const ehPj = p.subject_type === "PJ" || doc.length === 14;
  const rf = (p.receita_data ?? null) as { razao_social?: unknown } | null;
  const ser = (p.serasa_data ?? null) as { nome_serasa?: unknown; error?: unknown } | null;
  const serasa = ser && !ser.error ? limpo(ser.nome_serasa) : null;
  return ehPj ? limpo(rf?.razao_social) ?? serasa : serasa;
}

const norm = (s: string) => s.normalize("NFD").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export function mesmoNome(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return norm(a) === norm(b);
}

/** Tira o sufixo " (Sócio · Fulano)" que o vínculo de documento adicional acrescenta ao nome. */
export function semRotulo(nome: string | null | undefined): string | null {
  const n = limpo(nome);
  return n ? n.replace(/\s*\([^)]*\)\s*$/, "") || n : null;
}

/**
 * Troca credit_profiles.subject_name pelo nome oficial quando ele existe e é diferente do
 * digitado. Idempotente; o primeiro nome digitado fica em raw_result.nome_informado.
 */
export async function corrigirNomeAnalisado(db: SupabaseClient, profileId: string): Promise<{ corrigido: boolean; de?: string; para?: string }> {
  const { data: p } = await db
    .from("credit_profiles")
    .select("subject_name, subject_cpf_cnpj, subject_type, receita_data, serasa_data, raw_result")
    .eq("id", profileId)
    .single();
  if (!p) return { corrigido: false };
  const oficial = nomeOficialDoPerfil(p);
  if (!oficial || mesmoNome(oficial, p.subject_name)) return { corrigido: false };

  const raw = (p.raw_result ?? {}) as Record<string, unknown>;
  const { error } = await db
    .from("credit_profiles")
    .update({
      subject_name: oficial,
      raw_result: { ...raw, nome_informado: raw.nome_informado ?? p.subject_name ?? null },
    })
    .eq("id", profileId);
  if (error) {
    console.error("Correção do nome oficial falhou:", error.message);
    return { corrigido: false };
  }
  return { corrigido: true, de: p.subject_name ?? undefined, para: oficial };
}
