// Cliente Serasa Experian (Oferta PME V7 NV1) para o portal — PJ (Básico/Avançado PJ PME) e
// PF (Básico/Avançado Top Score PF PME). Porte fiel do node "Serasa · PJ/PF" do W-CREDIT
// (n8n), usado pelo botão "Reanalisar" para consultar SÓ o Serasa de um perfil já existente,
// sem refazer a análise inteira (Escavador, DataJud etc.).
//
// Credenciais só por variável de ambiente (SERASA_CLIENT_ID / SERASA_CLIENT_SECRET), nunca no
// código: mesmo padrão do CheckTudo (lib/checktudo.ts). Sem elas, retorna erro claro em vez de
// tentar. ATENÇÃO: cada relatório emitido em produção gera COBRANÇA REAL pelo contrato.

const V3_CNPJ = "14219287000150";
const TOKEN_PATH = "/security/iam/v1/client-identities/login";
const PJ_PATH = "/credit-services/business-information-report/v1/reports";
const PF_PATH = "/credit-services/person-information-report/v1/creditreport";

export type SerasaModalidade = "simples" | "avancada";

export interface SerasaData {
  report_used: string | null;
  ambiente: string | null;
  score_positivo: number | null;
  score_message: string | null;
  pefin_count: number;
  pefin_valor: number;
  refin_count: number;
  refin_valor: number;
  divida_vencida_count: number;
  divida_vencida_valor: number;
  cheque_sem_fundo_count: number;
  protesto_count: number;
  protesto_valor: number;
  acao_judicial_count: number;
  falencia_count: number;
  situacao_cadastral: string | null;
  nome_serasa: string | null;
}

export type SerasaResult = { ok: true; data: SerasaData } | { ok: false; error: string };

function reportName(isPj: boolean, modalidade: SerasaModalidade | string | null | undefined): string {
  const avancada = modalidade === "avancada";
  if (isPj) return avancada ? "RELATORIO_AVANCADO_PJ_PME" : "RELATORIO_BASICO_PJ_PME";
  return avancada ? "RELATORIO_AVANCADO_TOP_SCORE_PF_PME" : "RELATORIO_BASICO_PF_PME";
}

/** Mapeia a resposta bruta do Serasa (embrulhada em reports[0]) para o formato gravado no perfil. */
export function mapSerasaReport(raw: any, reportUsed: string, ambiente: string): SerasaData {
  // Mesmo mapeamento do node do n8n (corrigido em 03/08/2026): os blocos de negativação ficam em
  // negativeData.{pefin,refin,notary,check,collectionRecords}.summary, não na raiz.
  const r0 = (Array.isArray(raw?.reports) && raw.reports[0]) || {};
  const neg = r0.negativeData || {};
  const sum = (block: string) => (neg[block] && neg[block].summary) || {};
  const reg = r0.registration || {};
  const scoreBlock = r0.score || {};
  return {
    report_used: r0.reportName || reportUsed,
    ambiente,
    score_positivo: typeof scoreBlock.score === "number" ? scoreBlock.score : null,
    score_message: scoreBlock.message || null,
    pefin_count: sum("pefin").count || 0,
    pefin_valor: sum("pefin").balance || 0,
    refin_count: sum("refin").count || 0,
    refin_valor: sum("refin").balance || 0,
    divida_vencida_count: sum("collectionRecords").count || 0,
    divida_vencida_valor: sum("collectionRecords").balance || 0,
    cheque_sem_fundo_count: sum("check").count || 0,
    protesto_count: sum("notary").count || 0,
    protesto_valor: sum("notary").balance || 0,
    acao_judicial_count: sum("judgementFilings").count || 0,
    falencia_count: sum("bankrupts").count || 0,
    situacao_cadastral: reg.statusRegistration || null,
    nome_serasa: reg.companyName || reg.consumerName || null,
  };
}

/** Consulta o relatório Serasa de um CPF/CNPJ. Nunca lança: devolve o dado ou o motivo da falha. */
export async function consultarSerasa(opts: {
  doc: string;
  isPj: boolean;
  modalidade?: SerasaModalidade | string | null;
}): Promise<SerasaResult> {
  const clientId = process.env.SERASA_CLIENT_ID;
  const clientSecret = process.env.SERASA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { ok: false, error: "Credenciais do Serasa não configuradas no portal (SERASA_CLIENT_ID / SERASA_CLIENT_SECRET)" };
  }
  const ambiente = process.env.SERASA_AMBIENTE === "uat" ? "uat" : "producao";
  const base = process.env.SERASA_BASE_URL
    || (ambiente === "uat" ? "https://uat-api.serasaexperian.com.br" : "https://api.serasaexperian.com.br");
  const name = reportName(opts.isPj, opts.modalidade);

  try {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenRes = await fetch(base + TOKEN_PATH, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
    });
    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) return { ok: false, error: `Serasa token HTTP ${tokenRes.status}: ${tokenText.slice(0, 300)}` };
    let tb: any = {};
    try { tb = JSON.parse(tokenText); } catch { /* resposta não-JSON tratada abaixo */ }
    const accessToken = tb.AccessToken || tb.accessToken;
    if (!accessToken) return { ok: false, error: `Serasa: token não retornado - ${tokenText.slice(0, 200)}` };
    const auth = `${tb.TokenType || tb.tokenType || "Bearer"} ${accessToken}`;

    const url = new URL(base + (opts.isPj ? PJ_PATH : PF_PATH));
    url.searchParams.set("reportName", name);
    url.searchParams.set("optionalFeatures", "");
    const reportRes = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
        "X-Document-Id": opts.doc.replace(/\D/g, ""),
        "X-Retailer-Document-Id": V3_CNPJ,
      },
    });
    const reportText = await reportRes.text();
    if (!reportRes.ok) return { ok: false, error: `Serasa relatório HTTP ${reportRes.status} (reportName=${name}): ${reportText.slice(0, 400)}` };
    let body: any;
    try { body = JSON.parse(reportText); } catch { return { ok: false, error: `Serasa: resposta inválida - ${reportText.slice(0, 200)}` }; }
    return { ok: true, data: mapSerasaReport(body, name, ambiente) };
  } catch (e) {
    return { ok: false, error: `Serasa: ${(e as Error).message}` };
  }
}
