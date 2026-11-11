/**
 * CONFERÊNCIA DA QUALIFICAÇÃO DO CONTRATO: regras Q-01 a Q-07 (fonte única).
 *
 * BRIEF 11/11/2026 (06_Operacional/SOPs/2026-11-11_Operacional_BRIEF-Conferencia-de-
 * Qualificacao-e-Numeracao-do-Contrato_v1.html). Origem: o NCNDA 0063 foi enviado com RG
 * de mesmos dígitos do CPF e numeração mista das partes, e nem o pré-voo nem a diretoria
 * tinham como conferir a qualificação depois do envio.
 *
 * Lógica PURA: sem banco, sem rede. Quem lê o banco monta as entradas e chama aqui. Os três
 * consumidores (pré-voo, gate de envio e tela de conferência) usam estas mesmas funções,
 * para a regra nunca divergir entre eles.
 *
 * Nenhuma mensagem devolvida carrega dado pessoal: só o ID da regra e o papel da parte.
 *
 * Contratos já enviados ou assinados não são tocados por estas regras. O gate de envio só
 * as aplica no primeiro envio; a troca de e-mail em contrato já enviado roda só as regras
 * que já existiam (BRIEF, seção 4.5).
 */

import { detectDocumentType, normalizeDocument } from "./v3-clients-pure";
import { isValidCNPJ, isValidCPF } from "./validators/cpf-cnpj";
import {
  ISO_COUNTRY_CODES,
  countryName,
  isIsoCountryCode,
  isMaritalStatusCode,
  isNationalityCode,
  isValidPassportNumber,
  normalizePassportNumber,
  passportDocumentKey,
} from "./qualification-schema";

export type QRuleId = "Q-01" | "Q-02" | "Q-03" | "Q-04" | "Q-05" | "Q-06" | "Q-07";
export type QSeverity = "bloqueia" | "alerta";

export interface QFinding {
  id: QRuleId;
  severity: QSeverity;
  /** Papel da parte no contrato (ex: "intermediario_1"). Nunca nome nem documento. */
  role: string;
  message: string;
}

/** Regras bloqueantes que admitem override do ADMIN (decisão 7 do BRIEF: só a Q-02). */
export const Q_OVERRIDE_PERMITIDO: readonly QRuleId[] = ["Q-02"];

/** Pessoa natural com documento: a parte ou um representante da cadeia de uma PJ. */
export interface QPerson {
  cpfCnpj?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  rg?: string | null;
  idCountry?: string | null;
}

export interface QParty extends QPerson {
  role: string;
  nature?: "PF" | "PJ" | null;
  fullName?: string | null;
  maritalCode?: string | null;
  maritalText?: string | null;
  nationalityCode?: string | null;
  nationalityText?: string | null;
  companyName?: string | null;
  companyCnpj?: string | null;
  /** Razão social gravada pela consulta à Receita (cnpj_razao_social). */
  cnpjRazaoSocial?: string | null;
  /** Representantes da cadeia, já achatados (todos os níveis). */
  representatives?: QPerson[];
}

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

function semAcento(v: string): string {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function nomeNormalizado(v: string): string {
  return semAcento(v).toUpperCase().replace(/\s+/g, " ").trim();
}

function minusculaSemAcento(v: string): string {
  return semAcento(v).toLowerCase().replace(/\s+/g, " ").trim();
}

function pessoas(party: QParty): QPerson[] {
  return [party, ...(party.representatives ?? [])];
}

// ---------------------------------------------------------------------------
// Q-01: lista de partes em alíneas
// ---------------------------------------------------------------------------

/**
 * Marcador da lista de partes: a), b), c)... O gerador usa isto no lugar do antigo "1)".
 * Acima de 26 partes falha com mensagem clara, sem gerar contrato.
 */
export function partyListMarker(index: number): string {
  if (!Number.isInteger(index) || index < 0) throw new Error("Posição inválida na lista de partes.");
  if (index >= 26) {
    throw new Error("O bloco de qualificação em alíneas comporta até 26 partes. Reduza o número de envolvidos.");
  }
  return `${String.fromCharCode(97 + index)})`;
}

export interface NumeracaoOpts {
  /** Data de criação do contrato. */
  createdAt?: string | Date | null;
  /**
   * Início de vigência da regra, em ISO com fuso. Fixado no dia em que a mudança do gerador
   * for ao ar. Enquanto for nulo, a Q-01 não se aplica (nenhum contrato é barrado).
   */
  cutoffIso?: string | null;
}

/** Q-01. Só vale para contratos gerados a partir da data de corte (histórico congelado). */
export function checarNumeracaoDasPartes(html: string, opts: NumeracaoOpts = {}): QFinding[] {
  if (!opts.cutoffIso) return [];
  if (opts.createdAt) {
    const criado = new Date(opts.createdAt).getTime();
    const corte = new Date(opts.cutoffIso).getTime();
    if (!Number.isNaN(criado) && !Number.isNaN(corte) && criado < corte) return [];
  }
  const achados: QFinding[] = [];
  const reParagrafo = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = reParagrafo.exec(html)) !== null) {
    const texto = m[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
    if (/^\d+\)\s/.test(texto) && /(CPF|CNPJ|Identidade|RG\b)/i.test(texto)) {
      achados.push({
        id: "Q-01",
        severity: "bloqueia",
        role: "bloco_de_partes",
        message: "Q-01: a lista de partes está numerada como 1), 2), 3). O padrão é em alíneas a), b), c).",
      });
      break;
    }
  }
  return achados;
}

// ---------------------------------------------------------------------------
// Q-02: RG ou identidade com os mesmos caracteres do CPF
// ---------------------------------------------------------------------------

export function checarRgIgualCpf(party: QParty): QFinding[] {
  const achados: QFinding[] = [];
  for (const p of pessoas(party)) {
    const doc = normalizeDocument(p.cpfCnpj);
    if (!doc) continue;
    const candidatos = [p.rg, p.idNumber].map((v) => normalizeDocument(v)).filter(Boolean);
    if (candidatos.includes(doc)) {
      achados.push({
        id: "Q-02",
        severity: "bloqueia",
        role: party.role,
        message: "Q-02: o número da identidade é igual ao do CPF. Confira o documento original. O mesmo número não pode ocupar dois campos.",
      });
      break;
    }
  }
  return achados;
}

// ---------------------------------------------------------------------------
// Q-03: razão social impressa contra a Receita (alerta)
// ---------------------------------------------------------------------------

export function checarRazaoSocial(party: QParty): QFinding[] {
  if (!party.companyName || !party.cnpjRazaoSocial) return [];
  if (nomeNormalizado(party.companyName) === nomeNormalizado(party.cnpjRazaoSocial)) return [];
  return [{
    id: "Q-03",
    severity: "alerta",
    role: party.role,
    message: "Q-03: a razão social da ficha difere da gravada pela consulta à Receita. Confira o nome com o contrato social.",
  }];
}

// ---------------------------------------------------------------------------
// Q-04: documentos válidos (CPF, CNPJ legado e alfanumérico, passaporte)
// ---------------------------------------------------------------------------

function checarDocumentoDaPessoa(p: QPerson, role: string): QFinding[] {
  const achados: QFinding[] = [];
  const doc = normalizeDocument(p.cpfCnpj);
  if (doc) {
    const tipo = detectDocumentType(doc);
    if (tipo === "CPF" && !isValidCPF(doc)) {
      achados.push({ id: "Q-04", severity: "bloqueia", role, message: "Q-04: CPF com dígito verificador inválido ou sequência repetida." });
    } else if (tipo === "CNPJ" && !isValidCNPJ(doc)) {
      achados.push({ id: "Q-04", severity: "bloqueia", role, message: "Q-04: CNPJ com dígito verificador inválido." });
    } else if (!tipo) {
      achados.push({ id: "Q-04", severity: "bloqueia", role, message: "Q-04: documento com tamanho que não é de CPF nem de CNPJ." });
    }
  }
  if ((p.idType ?? "").toLowerCase() === "passaporte") {
    if (!isValidPassportNumber(p.idNumber) || !isIsoCountryCode(p.idCountry)) {
      achados.push({
        id: "Q-04",
        severity: "bloqueia",
        role,
        message: "Q-04: passaporte sem número válido ou sem país emissor (código ISO).",
      });
    }
  }
  return achados;
}

export function checarDocumentosValidos(party: QParty): QFinding[] {
  const achados: QFinding[] = [];
  for (const p of pessoas(party)) achados.push(...checarDocumentoDaPessoa(p, party.role));
  const cnpjEmpresa = normalizeDocument(party.companyCnpj);
  if (cnpjEmpresa && !isValidCNPJ(cnpjEmpresa)) {
    achados.push({ id: "Q-04", severity: "bloqueia", role: party.role, message: "Q-04: CNPJ da empresa com dígito verificador inválido." });
  }
  return achados;
}

// ---------------------------------------------------------------------------
// Q-05: estado civil e nacionalidade dentro do dicionário fechado
// ---------------------------------------------------------------------------

const ESTADO_CIVIL_ACEITO = new Set([
  "casado", "casada", "solteiro", "solteira", "divorciado", "divorciada",
  "viuvo", "viuva", "uniao estavel", "em uniao estavel",
]);

let nomesDePais: Set<string> | null = null;
function paisesNormalizados(): Set<string> {
  if (!nomesDePais) {
    nomesDePais = new Set<string>(["br", "brasil", "brazil"]);
    for (const c of ISO_COUNTRY_CODES) nomesDePais.add(minusculaSemAcento(countryName(c)));
  }
  return nomesDePais;
}

export function checarDicionarios(party: QParty): QFinding[] {
  if (party.nature === "PJ") return [];
  const achados: QFinding[] = [];

  if (party.maritalCode) {
    if (!isMaritalStatusCode(party.maritalCode)) {
      achados.push({ id: "Q-05", severity: "bloqueia", role: party.role, message: "Q-05: estado civil fora da lista de cinco valores." });
    }
  } else if (party.maritalText) {
    const t = minusculaSemAcento(party.maritalText).replace(/\(a\)/g, "").trim();
    if (!ESTADO_CIVIL_ACEITO.has(t)) {
      achados.push({ id: "Q-05", severity: "bloqueia", role: party.role, message: "Q-05: estado civil fora da lista de cinco valores (por exemplo, sigla de estado)." });
    }
  }

  if (party.nationalityCode) {
    if (!isNationalityCode(party.nationalityCode)) {
      achados.push({ id: "Q-05", severity: "bloqueia", role: party.role, message: "Q-05: nacionalidade fora do dicionário (brasileiro(a) ou outra)." });
    } else if (party.nationalityCode === "outra") {
      const t = minusculaSemAcento(party.nationalityText ?? "");
      if (!t || paisesNormalizados().has(t)) {
        achados.push({ id: "Q-05", severity: "bloqueia", role: party.role, message: "Q-05: a nacionalidade 'outra' precisa do gentílico (por exemplo, portuguesa), e não do nome do país." });
      }
    }
  } else if (party.nationalityText) {
    const t = minusculaSemAcento(party.nationalityText);
    if (paisesNormalizados().has(t)) {
      achados.push({ id: "Q-05", severity: "bloqueia", role: party.role, message: "Q-05: a nacionalidade traz o nome do país no lugar do gentílico." });
    }
  }
  return achados;
}

// ---------------------------------------------------------------------------
// Q-06: caractere estranho em nome (alerta)
// ---------------------------------------------------------------------------

const CARACTERE_PERMITIDO = /^[\p{L}\p{N} .,'’&/()\-ºª]+$/u;

export function checarCaractereEstranho(party: QParty): QFinding[] {
  const achados: QFinding[] = [];
  const razao = party.cnpjRazaoSocial ?? "";
  for (const nome of [party.fullName, party.companyName]) {
    if (!nome) continue;
    const estranhos = [...nome].filter((c) => !CARACTERE_PERMITIDO.test(c) && !razao.includes(c));
    if (estranhos.length > 0 || /\s{2,}/.test(nome)) {
      achados.push({
        id: "Q-06",
        severity: "alerta",
        role: party.role,
        message: "Q-06: o nome tem caractere estranho ou espaço duplicado. Confira com o documento.",
      });
      break;
    }
  }
  return achados;
}

// ---------------------------------------------------------------------------
// Q-07: o mesmo documento em duas partes diferentes
// ---------------------------------------------------------------------------

function chaveDaPessoa(p: QPerson): string | null {
  if ((p.idType ?? "").toLowerCase() === "passaporte") {
    const k = passportDocumentKey(p.idCountry, p.idNumber);
    if (k) return k;
  }
  const doc = normalizeDocument(p.cpfCnpj);
  return doc || null;
}

export function checarDocumentoDuplicado(parties: QParty[], permitidos: readonly string[] = []): QFinding[] {
  const dono = new Map<string, number>();
  const achados: QFinding[] = [];
  const jaAcusado = new Set<string>();
  parties.forEach((party, i) => {
    const chaves = new Set<string>();
    for (const p of pessoas(party)) {
      const k = chaveDaPessoa(p);
      if (k) chaves.add(k);
    }
    const cnpjEmpresa = normalizeDocument(party.companyCnpj);
    if (cnpjEmpresa) chaves.add(cnpjEmpresa);
    for (const k of chaves) {
      if (permitidos.includes(k)) continue;
      if (dono.has(k) && dono.get(k) !== i && !jaAcusado.has(k)) {
        jaAcusado.add(k);
        achados.push({
          id: "Q-07",
          severity: "bloqueia",
          role: `${parties[dono.get(k)!].role}+${party.role}`,
          message: "Q-07: o mesmo documento aparece em mais de uma parte do contrato.",
        });
      }
      if (!dono.has(k)) dono.set(k, i);
    }
  });
  return achados;
}

// ---------------------------------------------------------------------------
// Conjunto
// ---------------------------------------------------------------------------

export interface ConferenciaOpts extends NumeracaoOpts {
  /** Chaves de documento que podem repetir entre partes (ex: o Head que também é representante). */
  documentosPermitidosEmDuplicidade?: readonly string[];
  /** HTML impresso do contrato. Se vier, a Q-01 também é conferida. */
  renderedHtml?: string | null;
}

/** Roda Q-01 a Q-07 sobre as partes e, se vier, o HTML impresso. */
export function conferirQualificacao(parties: QParty[], opts: ConferenciaOpts = {}): QFinding[] {
  const achados: QFinding[] = [];
  if (opts.renderedHtml) achados.push(...checarNumeracaoDasPartes(opts.renderedHtml, opts));
  for (const party of parties) {
    achados.push(
      ...checarRgIgualCpf(party),
      ...checarDocumentosValidos(party),
      ...checarDicionarios(party),
      ...checarRazaoSocial(party),
      ...checarCaractereEstranho(party),
    );
  }
  achados.push(...checarDocumentoDuplicado(parties, opts.documentosPermitidosEmDuplicidade));
  return achados;
}

export function temBloqueio(achados: QFinding[]): boolean {
  return achados.some((a) => a.severity === "bloqueia");
}

/** Regras bloqueantes que o ADMIN pode ignorar com justificativa. Q-01, Q-04, Q-05 e Q-07 nunca. */
export function bloqueiosSemOverride(achados: QFinding[]): QFinding[] {
  return achados.filter((a) => a.severity === "bloqueia" && !Q_OVERRIDE_PERMITIDO.includes(a.id));
}

export { normalizePassportNumber };
