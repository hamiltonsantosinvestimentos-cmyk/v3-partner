// Utilitários compartilhados FORJA — importados por forja-validate, forja-kit, doc-extract

export type ValidatedField  = { field: string; value: string; note?: string; doc_confirmed?: boolean };
export type MissingField    = { field: string; impact: string; priority: "ALTA" | "MEDIA" | "BAIXA" };
export type CorrectedField  = { field: string; original: string; corrected: string; reason: string };

/** Extrai sigla de UF de uma string de endereço */
export function extractUF(loc: string): string | null {
  const ufMatch = loc.match(/\b(AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)\b/);
  if (ufMatch) return ufMatch[1];
  const estadoMap: Record<string, string> = {
    "rio de janeiro": "RJ", "são paulo": "SP", "minas gerais": "MG",
    "bahia": "BA", "paraná": "PR", "rio grande do sul": "RS",
    "pernambuco": "PE", "ceará": "CE", "goiás": "GO",
    "santa catarina": "SC", "mato grosso": "MT", "mato grosso do sul": "MS",
    "espírito santo": "ES", "pará": "PA", "maranhão": "MA",
    "amazonas": "AM", "piauí": "PI",
  };
  const lower = loc.toLowerCase();
  for (const [estado, uf] of Object.entries(estadoMap)) {
    if (lower.includes(estado)) return uf;
  }
  return null;
}

/** Extrai localização, setor e tipo de operação dos campos validados pelo FORJA */
export function extractMatchingFields(validated: ValidatedField[]): {
  location?: string; sector?: string; tipoOperacao?: string; uf?: string;
} {
  const result: ReturnType<typeof extractMatchingFields> = {};
  for (const v of validated) {
    const f = v.field.toLowerCase();
    if ((f === "location" || f === "localizacao") && v.value && v.value !== "—") {
      result.location = v.value;
      result.uf = extractUF(v.value) ?? undefined;
    }
    if (f === "sector" && v.value && v.value !== "—") result.sector = v.value;
    if ((f === "tipooperacao" || f === "tipo_operacao" || f === "deal_type") && v.value) {
      result.tipoOperacao = v.value;
    }
    if (f === "municipio_uf" && !result.uf) {
      result.uf = extractUF(v.value) ?? undefined;
    }
  }
  return result;
}

/** Remove markdown code fences de resposta JSON da IA */
export function stripJsonFences(raw: string): string {
  return raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
}

/** Tenta parsear JSON; em caso de falha retorna null */
export function safeJsonParse<T = unknown>(raw: string): T | null {
  try { return JSON.parse(raw) as T; } catch { return null; }
}
