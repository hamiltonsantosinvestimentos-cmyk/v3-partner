export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export type UF = (typeof UFS)[number];

/**
 * Municipios sao buscados em tempo real na API publica do IBGE
 * (https://servicodados.ibge.gov.br/api/v1/localidades/estados/{uf}/municipios)
 * em vez de embutir uma lista estatica — evita dados incompletos ou desatualizados.
 */
export async function fetchMunicipios(uf: string): Promise<string[]> {
  const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data as Array<{ nome: string }>).map((m) => m.nome).sort((a, b) => a.localeCompare(b, "pt-BR"));
}
