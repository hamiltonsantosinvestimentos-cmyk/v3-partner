// ViaCEP (https://viacep.com.br) — API publica gratuita de consulta de CEP,
// mesmo padrao de fetch direto do client ja usado em lib/br-locations.ts
// para municipios do IBGE. Sem chave, sem custo.

export interface ViaCepResult {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string; // cidade
  uf: string;
  erro?: boolean;
}

/** Busca um CEP (8 digitos). Retorna null se invalido, nao encontrado ou API fora do ar. */
export async function fetchCep(cep: string): Promise<ViaCepResult | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ViaCepResult;
    if (data.erro) return null;
    return data;
  } catch {
    return null;
  }
}

/** Monta a string de endereco completo a partir do resultado do ViaCEP + numero/complemento
 * digitados a mao (ViaCEP nunca retorna numero de porta). */
export function buildEnderecoFromCep(result: ViaCepResult, numero: string, complemento?: string): string {
  const parts = [
    result.logradouro,
    numero ? `nº ${numero}` : null,
    complemento || null,
    result.bairro,
    result.localidade,
    result.uf,
    formatCepMask(result.cep),
  ].filter((p): p is string => !!p && p.trim() !== "");
  return parts.join(", ");
}

export function formatCepMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}
