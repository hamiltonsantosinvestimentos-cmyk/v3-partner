import type { SupabaseClient } from "@supabase/supabase-js";
import { CREDIT_SOURCE_DEFAULTS } from "@/lib/credit-source-defaults";

// Config efetiva de fontes de uma análise de crédito, compartilhada entre
// app/api/credit-engine/trigger/route.ts (análise completa) e
// lib/credit-reanalysis.ts (botão "Reanalisar"), para os dois sempre decidirem
// as mesmas fontes a consultar. Extraído do trigger sem mudar o comportamento.

export type SourceConfig = typeof CREDIT_SOURCE_DEFAULTS;

export async function resolveEffectiveSourceConfig(db: SupabaseClient, clientDoc: string | null | undefined) {
  const rawDoc = (clientDoc ?? "").replace(/\D/g, "");
  const subject_type: "PJ" | "PF" = rawDoc.length === 14 ? "PJ" : "PF";

  // Painel de Configuração de Fontes: usa a config salva pelo CNPJ do titular,
  // ou os defaults se nunca configurado.
  const { data: sourceConfig } = await db
    .from("credit_source_configs")
    .select("receita_federal, cnj_datajud, ceis, registrato_bacen, serasa, serasa_modalidade, serasa_cnpj, serasa_cpf, serasa_cpf_list, spc, escavador")
    .eq("cnpj", clientDoc ?? "")
    .single();

  const baseSourceConfig = (sourceConfig ?? CREDIT_SOURCE_DEFAULTS) as SourceConfig;

  // Pedidos de Partners de PF: o Serasa só roda no n8n quando serasa_cpf está
  // ligado E o CPF consta em serasa_cpf_list. O painel de fontes não permite
  // ligar isso (toggle travado) e o default é desligado, então toda análise de
  // CPF saía "Serasa não consultada", mesmo regenerando. Libera aqui, por
  // análise, só para o CPF do próprio pedido (formatado e só dígitos, pois não
  // vemos qual formato o node do n8n compara), respeitando serasa desligado.
  const cpfFormatado = rawDoc.length === 11
    ? rawDoc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    : null;
  const effectiveSourceConfig: SourceConfig =
    subject_type === "PF" && baseSourceConfig.serasa && cpfFormatado
      ? {
          ...baseSourceConfig,
          serasa_cpf: true,
          serasa_cpf_list: Array.from(new Set([...(baseSourceConfig.serasa_cpf_list ?? []), rawDoc, cpfFormatado])),
        }
      : baseSourceConfig;

  return { rawDoc, subject_type, baseSourceConfig, effectiveSourceConfig };
}
