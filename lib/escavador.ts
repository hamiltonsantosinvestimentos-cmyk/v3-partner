// Cliente compartilhado da API Escavador — extraido de app/api/kyc/escavador/route.ts
// em 2026-08-01 para reuso tambem na due diligence da Bolsa de Ativos
// (app/api/cm/listings/[id]/due-diligence/escavador/route.ts).

const ESCAVADOR_BASE = "https://api.escavador.com/api/v2";

export interface EscavadorProcesso {
  numero_cnj: string;
  polo_ativo: string | null;
  polo_passivo: string | null;
  data_inicio: string | null;
  data_ultima_movimentacao: string | null;
  estado: string | null;
  tribunal: string | null;
  grau: string | null;
  unidade: string | null;
  status: string | null;
  valor_causa: number | null;
}

export interface EscavadorResult {
  envolvido: Record<string, unknown> | null;
  total_processos: number;
  match_tipo: string | null;
  processos: EscavadorProcesso[];
}

async function escavadorGet(path: string, token: string) {
  const res = await fetch(`${ESCAVADOR_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(12000),
  });

  const text = await res.text();
  if (!text) throw new Error(`Escavador ${res.status}: resposta vazia`);

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Escavador ${res.status}: resposta inválida — ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    const msg = (json as { message?: string })?.message ?? text.slice(0, 200);
    throw new Error(`Escavador ${res.status}: ${msg}`);
  }

  return json;
}

async function getValorCausa(numeroCnj: string, token: string): Promise<number | null> {
  try {
    const detalhe = await escavadorGet(
      `/processos/numero_cnj/${encodeURIComponent(numeroCnj)}`,
      token
    );
    return (detalhe as { valor?: number; valor_causa?: number }).valor
      ?? (detalhe as { valor?: number; valor_causa?: number }).valor_causa
      ?? null;
  } catch {
    return null;
  }
}

/** Busca processos de um envolvido (CPF/CNPJ/nome) — mesma logica usada no Credit Engine. */
export async function buscarProcessosEscavador(
  tipo: "cpf" | "cnpj" | "nome",
  valor: string,
  token: string
): Promise<EscavadorResult> {
  const param = tipo === "cpf" || tipo === "cnpj" ? "cpf_cnpj" : "nome";
  const query = encodeURIComponent(valor.trim());

  const data = await escavadorGet(`/envolvido/processos?${param}=${query}`, token);

  const envolvido = (data.envolvido_encontrado as Record<string, unknown>) ?? null;
  const total = (data.quantidade_processos as number) ?? 0;
  const matchTipo = (data.match_documento_por as string) ?? null;
  const items = ((data.items as unknown[]) ?? []).slice(0, 10); // limita a 10 para evitar timeout

  const processos: EscavadorProcesso[] = [];
  for (let i = 0; i < items.length; i += 5) {
    const batch = items.slice(i, i + 5);
    const batchResult = await Promise.all(
      batch.map(async (p) => {
        const processo = p as {
          numero_cnj: string;
          titulo_polo_ativo?: string;
          titulo_polo_passivo?: string;
          data_inicio?: string;
          data_ultima_movimentacao?: string;
          estado_origem?: string;
          unidade_origem?: string;
          fontes?: { sigla: string; grau: string }[];
          status_predito?: string;
        };
        const valor_causa = await getValorCausa(processo.numero_cnj, token);
        return {
          numero_cnj: processo.numero_cnj,
          polo_ativo: processo.titulo_polo_ativo ?? null,
          polo_passivo: processo.titulo_polo_passivo ?? null,
          data_inicio: processo.data_inicio ?? null,
          data_ultima_movimentacao: processo.data_ultima_movimentacao ?? null,
          estado: processo.estado_origem ?? null,
          tribunal: processo.fontes?.[0]?.sigla ?? null,
          grau: processo.fontes?.[0]?.grau ?? null,
          unidade: processo.unidade_origem ?? null,
          status: processo.status_predito ?? null,
          valor_causa,
        };
      })
    );
    processos.push(...batchResult);
  }

  return { envolvido, total_processos: total, match_tipo: matchTipo, processos };
}
