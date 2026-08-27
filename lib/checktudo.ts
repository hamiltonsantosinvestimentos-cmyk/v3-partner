// Cliente da API Checktudo (SCR/Dossie Juridico) -- Fase 2 do Cockpit de Due Diligence
// e Compliance (Bolsa de Ativos). Ver 06_Operacional/SOPs/2026-08-22_Operacional_BRIEF-
// Cockpit-Compliance-Bolsa-Ativos_v1.html, Fase 2.
//
// Desenho revisado em 27/08/2026: o BRIEF original propunha rotear isso por um workflow
// n8n (mesmo padrao do W-CREDIT para Serasa/Escavador). Descartado apos teste real: o
// n8n deste projeto so consegue guardar username/senha com seguranca em credencial nativa
// nos nos httpRequest, mas a expressao $credentials.<tipo>.<campo> nao resolve dentro do
// Body de um no com authentication="genericCredentialType" (confirmado 2x com workflow
// descartavel ZZTEST, apagado depois -- erro real: "The value in the JSON Body field is
// not valid JSON", $credentials chega undefined). A alternativa seria hardcodear a senha
// em texto puro num Code node, reproduzindo o mesmo Padrao B ja identificado e deixado de
// propósito sem correcao em 11/08/2026 (Serasa/Escavador/CEIS/DataJud no W-CREDIT). Em vez
// disso, este cliente roda direto no portal (Next.js, mesmo padrao ja usado e testado em
// app/api/cm/listings/[id]/due-diligence/escavador/route.ts para o Escavador), com as
// credenciais em variavel de ambiente do servidor (CHECKTUDO_USERNAME/CHECKTUDO_PASSWORD),
// nunca no client, nunca em n8n.
//
// Homologado com curl real em 26-27/08/2026 (autoconsulta, CPF do proprio Joao, sem tocar
// dado de terceiro) -- ver cofre-credenciais-v3.md, Secao 14, para o detalhe completo do
// teste e da estrutura de resposta real.

const CHECKTUDO_BASE = "https://api.checktudo.com.br";

export type ChecktudoDocType = "cpf" | "cnpj";

interface ChecktudoLoginResponse {
  status: { cod: number; msg: string };
  body: { token: string };
}

export interface ChecktudoSession {
  token: string;
  /** Id da conta V3 na Checktudo (claim "data" do JWT) -- NAO e o documento consultado. */
  userid: string;
  expiresAt: Date;
}

/**
 * Autentica na Checktudo com usuario/senha (mesmo login do portal web). Token JWT valido
 * por 24h (confirmado no teste real de homologacao), sem necessidade de API Key separada.
 */
export async function checktudoLogin(username: string, password: string): Promise<ChecktudoSession> {
  const res = await fetch(`${CHECKTUDO_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(15000),
  });

  const text = await res.text();
  let json: ChecktudoLoginResponse;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Checktudo login ${res.status}: resposta invalida -- ${text.slice(0, 200)}`);
  }

  if (!res.ok || json.status?.cod !== 200 || !json.body?.token) {
    throw new Error(`Checktudo login ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }

  const token = json.body.token;

  // O :userid do path de consulta e o claim "data" do proprio JWT (id da conta V3 na
  // Checktudo, estavel entre logins) -- nao e o CPF/CNPJ consultado. Descoberto por
  // engenharia reversa do apidoc publico em 26/08/2026, nao documentado em lugar nenhum
  // do resumo que a Checktudo mandou.
  const payloadB64 = token.split(".")[1];
  if (!payloadB64) throw new Error("Checktudo login: JWT sem payload valido");
  const padded = payloadB64.padEnd(payloadB64.length + ((4 - (payloadB64.length % 4)) % 4), "=");
  const claims = JSON.parse(Buffer.from(padded, "base64").toString("utf-8")) as {
    data: string;
    exp: number;
  };
  if (!claims.data) throw new Error("Checktudo login: claim 'data' (userid) ausente no JWT");

  return { token, userid: claims.data, expiresAt: new Date(claims.exp * 1000) };
}

/**
 * Consulta generica de pessoa (SCR/Dossie). Endpoint correto confirmado por teste real:
 * POST /api/person/:userid -- NAO /api/vehicle/userid (esse e so pra consulta veicular,
 * apesar do resumo geral que a Checktudo mandou citar esse exemplo).
 */
async function checktudoQuery(
  session: ChecktudoSession,
  querycode: number,
  keys: Record<string, string>
): Promise<Record<string, unknown>> {
  const res = await fetch(`${CHECKTUDO_BASE}/api/person/${session.userid}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: session.token },
    body: JSON.stringify({ querycode, keys, duplicity: false }),
    signal: AbortSignal.timeout(30000),
  });

  const text = await res.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Checktudo querycode ${querycode} HTTP ${res.status}: resposta invalida -- ${text.slice(0, 200)}`);
  }

  const status = json.status as { cod?: number; msg?: string } | undefined;
  if (!res.ok || status?.cod !== 200) {
    throw new Error(`Checktudo querycode ${querycode} HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json;
}

/** querycode 3090 -- SCR (Sistema de Informacoes de Credito, BACEN). */
export async function checktudoSCR(session: ChecktudoSession, docType: ChecktudoDocType, docValue: string) {
  return checktudoQuery(session, 3090, { [docType]: docValue });
}

/** querycode 200 -- Dossie Juridico Resumido. Documentado oficialmente pela Checktudo. */
export async function checktudoDossieResumido(session: ChecktudoSession, docType: ChecktudoDocType, docValue: string) {
  return checktudoQuery(session, 200, { [docType]: docValue });
}

/**
 * querycode 219 -- Dossie Juridico completo. NAO aparece na documentacao publica da
 * Checktudo (79 endpoints publicados em api.checktudo.com.br/integration, so o 200 e
 * documentado oficialmente). Funcionou no teste real de homologacao, mas fica de fora do
 * fluxo automatizado do cockpit ate confirmacao por escrito da Checktudo -- so disponivel
 * como consulta manual avulsa, rotulada "nao-oficial" na UI.
 */
export async function checktudoDossieCompleto(session: ChecktudoSession, docType: ChecktudoDocType, docValue: string) {
  return checktudoQuery(session, 219, { [docType]: docValue });
}

export interface ChecktudoNormalizedResult {
  /**
   * Score de risco calculado pela V3. Deixado NULL nesta fase: nem o SCR (3090) nem o
   * Dossie Resumido (200) trazem um campo de score pronto (SCR do BACEN e dado de
   * exposicao de credito, nao pontuacao), e inventar uma formula de score e decisao de
   * negocio da Fase 4 (Sintese IA), nao efeito colateral de uma migration de schema.
   */
  score: number | null;
  /**
   * Deixado NULL nesta fase pelo mesmo motivo: nao existe campo de "protesto" no SCR nem
   * no Dossie Resumido (isso e conceito de Serasa/SPC, nao de SCR/BACEN). O valor mais
   * proximo disponivel no Dossie Resumido (posicao.poloPassivo.valor, exposicao financeira
   * como reu) fica em risk_flags.lawsuit_defendant_value, sem forcar no nome errado da
   * coluna -- mesma licao do incidente Serasa 03/08/2026, nunca mapear campo que nao existe.
   */
  protests_amount: number | null;
  /** Deixado NULL nesta fase: situacao cadastral (ATIVA/BAIXADA) e conceito de Receita
   * Federal, nao aparece no SCR nem no Dossie Resumido testados. */
  cadastral_status: string | null;
  risk_flags: Record<string, unknown>;
}

/** Normaliza o SCR (querycode 3090) sozinho -- uma linha em cm_compliance_checktudo_records
 * e um querycode so, nunca uma mistura de dois. Mapeamento conferido campo a campo contra
 * retorno real da homologacao de 26-27/08/2026. */
export function normalizeScrResult(scrRaw: Record<string, unknown>): ChecktudoNormalizedResult {
  const scr = (scrRaw?.body as any)?.data?.scr?.relatorioResumido ?? {};
  return {
    score: null,
    protests_amount: null,
    cadastral_status: null,
    risk_flags: {
      scr_quantidade_operacoes: scr.quantidadeOperacoes ?? null,
      scr_quantidade_instituicoes: scr.quantidadeInstituicoes ?? null,
      scr_coobrigacao_assumida: scr.coobrigacaoAssumida ?? null,
      scr_coobrigacao_recebida: scr.coobrigacaoRecebida ?? null,
      scr_data_inicio_relacionamento: scr.dataInicioRelacionamento ?? null,
    },
  };
}

/** Normaliza o Dossie Juridico Resumido (querycode 200) sozinho. */
export function normalizeDossieResumidoResult(dossieRaw: Record<string, unknown>): ChecktudoNormalizedResult {
  const dossie = (dossieRaw?.body as any)?.data?.dossieJuridicoResumido ?? {};
  const posicao = dossie.posicao ?? {};
  const tribunais = dossie.tribunais ?? {};
  return {
    score: null,
    protests_amount: null,
    cadastral_status: null,
    risk_flags: {
      lawsuit_total_count: tribunais.total ?? null,
      lawsuit_defendant_count: posicao.poloPassivo?.quantidade ?? null,
      lawsuit_defendant_value: posicao.poloPassivo?.valor ?? null,
      lawsuit_plaintiff_count: posicao.poloAtivo?.quantidade ?? null,
      lawsuit_plaintiff_value: posicao.poloAtivo?.valor ?? null,
    },
  };
}

/** Roda o SCR + Dossie Resumido de ponta a ponta. Devolve os dois resultados separados
 * (cada um vira sua propria linha em cm_compliance_checktudo_records, ver rota). */
export async function runChecktudoComplianceScan(
  username: string,
  password: string,
  docType: ChecktudoDocType,
  docValue: string
): Promise<{
  scr: { normalized: ChecktudoNormalizedResult; raw: unknown };
  dossieResumido: { normalized: ChecktudoNormalizedResult; raw: unknown };
}> {
  const session = await checktudoLogin(username, password);
  const [scrRaw, dossieRaw] = await Promise.all([
    checktudoSCR(session, docType, docValue),
    checktudoDossieResumido(session, docType, docValue),
  ]);
  return {
    scr: { normalized: normalizeScrResult(scrRaw), raw: scrRaw },
    dossieResumido: { normalized: normalizeDossieResumidoResult(dossieRaw), raw: dossieRaw },
  };
}
