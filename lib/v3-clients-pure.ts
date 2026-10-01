/**
 * Partes PURAS do registro de Client 360 (sem Supabase, sem rede): a normalização da
 * chave de identidade de CPF e CNPJ. Separadas de `lib/v3-clients.ts` para o código da
 * tela (client components) poder importar sem puxar o cliente do banco para o bundle.
 * `lib/v3-clients.ts` reexporta estas duas funções, então nenhum import existente muda.
 */

export type V3DocumentType = "CPF" | "CNPJ" | "PASSAPORTE";

/**
 * Remove tudo que não é [0-9A-Za-z] e força maiúsculas. É a chave de identidade, nunca
 * comparar com máscara. CNPJ alfanumérico (emissão pela Receita/Serpro desde 31/07/2026)
 * tem letras nas 12 primeiras posições; `\D` apagaria essas letras e corromperia o CNPJ
 * novo, impedindo dedup e reaproveitamento de KYC de qualquer empresa com o formato novo.
 */
export function normalizeDocument(raw: string | null | undefined): string {
  return (raw ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

/** CPF tem 11 caracteres (sempre dígitos), CNPJ tem 14 (dígitos, ou alfanumérico desde 31/07/2026). Qualquer outro tamanho não é documento válido. */
export function detectDocumentType(normalized: string): "CPF" | "CNPJ" | null {
  if (normalized.length === 11) return "CPF";
  if (normalized.length === 14) return "CNPJ";
  return null;
}
