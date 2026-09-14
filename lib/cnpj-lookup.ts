// Consulta de CNPJ (situação cadastral + quadro de sócios/administradores)
// via BrasilAPI, com fallback ReceitaWS -- mesmo par de fontes já usado e
// testado em app/api/cnpj-search e app/api/cpf-validate, extraído pra cá
// (14/09/2026) pra ser reaproveitado pela checagem automática de
// qualificação de partes na Central de Contratos, sem duplicar a lógica
// de fetch/normalização uma terceira vez.
//
// Gratuita, sem autenticação. CPF fica de fora de propósito (decisão de
// João): não existe fonte gratuita de "situação cadastral" de CPF, e a
// única fonte paga já integrada (Checktudo, lib/checktudo.ts) não traz
// esse dado -- só SCR/processos judiciais.

export interface CnpjSocio {
  nome: string;
  qualificacao: string;
}

export interface CnpjLookupResult {
  situacao_cadastral: string;
  razao_social: string;
  socios: CnpjSocio[];
}

export type CnpjLookupOutcome =
  | { ok: true; data: CnpjLookupResult }
  | { ok: false; error: string };

function normalizeBrasilApi(d: any): CnpjLookupResult {
  return {
    situacao_cadastral: d.descricao_situacao_cadastral || "ATIVA",
    razao_social: d.razao_social || "",
    socios: (d.qsa || []).map((s: any) => ({
      nome: s.nome_socio || "",
      qualificacao: s.qualificacao_socio || "",
    })),
  };
}

function normalizeReceitaWS(d: any): CnpjLookupResult {
  return {
    situacao_cadastral: d.situacao || "ATIVA",
    razao_social: d.nome || "",
    socios: (d.qsa || []).map((s: any) => ({
      nome: s.nome || "",
      qualificacao: s.qual || "",
    })),
  };
}

export async function lookupCnpj(cnpjDigits: string): Promise<CnpjLookupOutcome> {
  const clean = cnpjDigits.replace(/\D/g, "");
  if (clean.length !== 14) return { ok: false, error: "CNPJ inválido — deve ter 14 dígitos" };

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, data: normalizeBrasilApi(data) };
    }
    if (res.status === 404) return { ok: false, error: "CNPJ não encontrado na Receita Federal" };
  } catch (e) {
    // segue pro fallback
  }

  try {
    const res2 = await fetch(`https://receitaws.com.br/v1/cnpj/${clean}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
    if (res2.ok) {
      const data2 = await res2.json();
      if (data2.status === "ERROR") return { ok: false, error: data2.message || "CNPJ não encontrado" };
      return { ok: true, data: normalizeReceitaWS(data2) };
    }
  } catch (e) {
    // esgotou as duas fontes
  }

  return { ok: false, error: "Serviço da Receita Federal indisponível (BrasilAPI e ReceitaWS falharam)" };
}

// Normalização simples pra comparação de nome: minúsculo, sem acento, sem
// pontuação. Nunca decide sozinho -- é um sinal de atenção pro revisor
// humano, não uma trava automática (nome no QSA pode estar abreviado,
// com nome do meio diferente, etc. -- falso negativo é mais provável e
// mais barato do que falso positivo aqui).
function normalizeName(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim();
}

/** true se o nome informado compartilha nome+sobrenome com algum sócio do QSA. */
export function nameMatchesSocios(informedName: string, socios: CnpjSocio[]): boolean {
  const informed = normalizeName(informedName);
  if (!informed) return false;
  const informedTokens = new Set(informed.split(/\s+/).filter((t) => t.length > 2));
  if (informedTokens.size === 0) return false;

  return socios.some((s) => {
    const socioTokens = new Set(normalizeName(s.nome).split(/\s+/).filter((t) => t.length > 2));
    if (socioTokens.size === 0) return false;
    let shared = 0;
    for (const t of informedTokens) if (socioTokens.has(t)) shared++;
    // Exige pelo menos 2 tokens em comum (ou todos, se o nome só tiver 1),
    // evitando falso positivo por sobrenome comum sozinho (ex: "Silva").
    return shared >= Math.min(2, informedTokens.size);
  });
}
