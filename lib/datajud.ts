// Busca no Datajud (CNJ) compartilhada: extraida de app/api/kyc/datajud/route.ts em 08/10/2026
// para a aba Due Diligence da Ficha de Qualificacao reutilizar sem duplicar.

const DATAJUD_KEY = process.env.DATAJUD_API_KEY ?? "";

export const TRIBUNAIS_PRINCIPAIS = [
  "api_publica_tjsp",
  "api_publica_tjrj",
  "api_publica_tjmg",
  "api_publica_tjrs",
  "api_publica_tjba",
  "api_publica_tjpr",
  "api_publica_tjsc",
  "api_publica_tjdf",
  "api_publica_tjgo",
  "api_publica_tjce",
  "api_publica_trf1",
  "api_publica_trf2",
  "api_publica_trf3",
  "api_publica_trf4",
  "api_publica_trf5",
  "api_publica_trf6",
  "api_publica_tst",
  "api_publica_stj",
  "api_publica_tjto",
];

export async function searchTribunal(tribunal: string, body: object): Promise<object[]> {
  try {
    const res = await fetch(
      `https://api-publica.datajud.cnj.jus.br/${tribunal}/_search`,
      {
        method: "POST",
        headers: {
          Authorization: `APIKey ${DATAJUD_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...body, size: 10 }),
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return [];
    const json = await res.json();
    const hits = json?.hits?.hits ?? [];
    return hits.map((h: { _source: object }) => ({
      ...h._source,
      _tribunal: tribunal.replace("api_publica_", "").toUpperCase(),
    }));
  } catch {
    return [];
  }
}

export function buildQuery(tipo: string, valor: string) {
  const valorLimpo = valor.replace(/\D/g, "");

  if (tipo === "processo") {
    return {
      query: { match: { numeroProcesso: valorLimpo || valor } },
    };
  }

  if (tipo === "cpf" || tipo === "cnpj") {
    return {
      query: {
        bool: {
          should: [
            { match: { "partes.cpfCnpj": valor } },
            { match: { "partes.cpfCnpj": valorLimpo } },
            { match: { "partes.documento": valorLimpo } },
            { match: { "partes.numeroDocumentoPrincipal": valorLimpo } },
          ],
          minimum_should_match: 1,
        },
      },
    };
  }

  if (tipo === "nome") {
    return {
      query: {
        bool: {
          should: [
            { match: { "partes.nome": { query: valor, operator: "and" } } },
            { match: { "partes.nomeParteAtiva": { query: valor, operator: "and" } } },
            { match: { "partes.nomePartePassiva": { query: valor, operator: "and" } } },
          ],
          minimum_should_match: 1,
        },
      },
    };
  }

  return { query: { match_all: {} } };
}

