import { checktudoLogin, checktudoDossieResumido, normalizeDossieResumidoResult, type ChecktudoDocType } from "@/lib/checktudo";

// Dossiê Jurídico Resumido do CheckTudo (querycode 200) na análise de crédito — 29/10/2026,
// decisão de Hamilton: SOMA com CNJ DataJud e Escavador (que seguem no n8n), não substitui.
// Mesmo padrão do SCR (lib/credit-bacen.ts): roda direto no portal, nunca no n8n, e é dado
// de REFERÊNCIA no dossiê, nunca entra no Tier/score da V3.
//
// O resumido traz totais (quantidade e valor como réu/autor), não a lista de processos. O
// completo (querycode 219) não é documentado oficialmente pelo CheckTudo e fica de fora.
//
// Gravado em credit_profiles.raw_result.checktudo_juridico (sem coluna nova no perfil).

export interface JuridicoCheckTudoData {
  total_processos: unknown;
  reu_quantidade: unknown;
  reu_valor: unknown;
  autor_quantidade: unknown;
  autor_valor: unknown;
  /** Bloco dossieJuridicoResumido inteiro, para conferir/remapear sem pagar outra consulta. */
  dossie_bruto: unknown;
  consultado_em: string;
}

export type JuridicoResult = { ok: true; data: JuridicoCheckTudoData } | { ok: false; error: string };

/** Converte a resposta bruta do querycode 200. Pura, sem rede. */
export function parseJuridicoCheckTudo(raw: Record<string, unknown>): JuridicoCheckTudoData {
  const f = normalizeDossieResumidoResult(raw).risk_flags;
  return {
    total_processos: f.lawsuit_total_count ?? null,
    reu_quantidade: f.lawsuit_defendant_count ?? null,
    reu_valor: f.lawsuit_defendant_value ?? null,
    autor_quantidade: f.lawsuit_plaintiff_count ?? null,
    autor_valor: f.lawsuit_plaintiff_value ?? null,
    dossie_bruto: (raw?.body as { data?: { dossieJuridicoResumido?: unknown } } | undefined)?.data?.dossieJuridicoResumido ?? null,
    consultado_em: new Date().toISOString(),
  };
}

/** Consulta o Dossiê Jurídico Resumido e devolve o dado ou o motivo da falha. Nunca lança. */
export async function consultarJuridicoCheckTudo(docType: ChecktudoDocType, docValue: string): Promise<JuridicoResult> {
  const username = process.env.CHECKTUDO_USERNAME;
  const password = process.env.CHECKTUDO_PASSWORD;
  if (!username || !password) return { ok: false, error: "Credenciais do CheckTudo não configuradas no portal" };

  try {
    const session = await checktudoLogin(username, password);
    const raw = await checktudoDossieResumido(session, docType, docValue);
    return { ok: true, data: parseJuridicoCheckTudo(raw) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
