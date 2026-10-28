import type { SupabaseClient } from "@supabase/supabase-js";

// NDA (Mesa de operações) — template da Central de Contratos usado para o NDA
// enviado ao CLIENTE (variáveis nome_cedente / cpf_cnpj_cedente). Fluxo do
// painel "NDA para clientes" da Mesa Operacional (30/09/2026): gera o link de
// qualificação (/intake/qualificacao/[token]), o cliente preenche dados +
// documentos, a Mesa revisa e gera/envia o NDA; depois pode vincular a uma
// proposta de crédito (modal da proposta).

export const NDA_MESA_SERIES = "V3C-NDA";
export const NDA_MESA_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export type NdaMesaTemplate = { id: string; template_name: string; contract_series: string | null };

// 28/10/2026: o "NCDA MESA OPERACIONAL" (v7 — confidencialidade + não
// circunvenção + remuneração protegida) substituiu o "NDA (Mesa de operações)"
// v5. O nome antigo continua reconhecido para os NDAs já gerados com ele.
export const NDA_MESA_NOME = "NCDA MESA OPERACIONAL";

export function isNdaMesaTemplateName(nome: string | null | undefined): boolean {
  const n = String(nome ?? "").toLowerCase();
  return n.includes("mesa operacional") || n.includes("mesa de opera");
}

/** Template ativo do NDA da Mesa Operacional (o NCDA tem preferência). */
export async function findNdaMesaTemplate(db: SupabaseClient): Promise<NdaMesaTemplate | null> {
  const { data } = await db
    .from("contract_templates")
    .select("id, template_name, contract_series")
    .or("template_name.ilike.%mesa operacional%,template_name.ilike.%mesa de opera%")
    .eq("is_active", true)
    .order("updated_at", { ascending: false });
  const lista = (data as NdaMesaTemplate[] | null) ?? [];
  return lista.find(t => t.template_name.toLowerCase().includes("mesa operacional")) ?? lista[0] ?? null;
}

/** Ids de todos os templates do NDA da Mesa Operacional (atual e anteriores),
 *  para o painel continuar mostrando os lotes/NDAs gerados com o v5. */
export async function ndaMesaTemplateIds(db: SupabaseClient): Promise<string[]> {
  const { data } = await db
    .from("contract_templates")
    .select("id, template_name")
    .or("template_name.ilike.%mesa operacional%,template_name.ilike.%mesa de opera%");
  return ((data as { id: string; template_name: string }[] | null) ?? [])
    .filter(t => isNdaMesaTemplateName(t.template_name))
    .map(t => t.id);
}

/** true quando o contrato foi gerado a partir do NDA da Mesa Operacional (NCDA ou o antigo). */
export async function isNdaMesaContract(db: SupabaseClient, templateId: string | null | undefined): Promise<boolean> {
  if (!templateId) return false;
  const { data } = await db
    .from("contract_templates")
    .select("template_name")
    .eq("id", templateId)
    .maybeSingle();
  return !!data && isNdaMesaTemplateName((data as { template_name?: string }).template_name);
}
