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

/** Template ativo "NDA (Mesa de operações)" (nome contém "mesa de opera"). */
export async function findNdaMesaTemplate(db: SupabaseClient): Promise<NdaMesaTemplate | null> {
  const { data } = await db
    .from("contract_templates")
    .select("id, template_name, contract_series")
    .ilike("template_name", "%mesa de opera%")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as NdaMesaTemplate | null) ?? null;
}

/** true quando o contrato foi gerado a partir do template NDA (Mesa de operações). */
export async function isNdaMesaContract(db: SupabaseClient, templateId: string | null | undefined): Promise<boolean> {
  if (!templateId) return false;
  const { data } = await db
    .from("contract_templates")
    .select("template_name")
    .eq("id", templateId)
    .maybeSingle();
  return !!data && String((data as { template_name?: string }).template_name ?? "").toLowerCase().includes("mesa de opera");
}
