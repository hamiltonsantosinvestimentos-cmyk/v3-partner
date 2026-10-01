/**
 * REGISTRO ÚNICO DE CAMPOS DA QUALIFICAÇÃO DE PARTES
 *
 * BRIEF de 30/09/2026 (Padronização da Qualificação de Partes), Fase 1A.
 *
 * Até aqui a mesma informação (estado civil, nacionalidade, identidade, endereço)
 * era coletada em pelo menos 7 pontos do portal, em texto livre no formulário que
 * gera contrato, e a regra de obrigatoriedade vivia em três lugares que não
 * concordavam entre si (tela, `missingBaseFields()` da rota e o manual v4). Este
 * módulo é a fonte única: dicionários fechados, matriz de obrigatoriedade e as
 * funções puras que montam o texto que vai para o contrato.
 *
 * Só funções puras, sem rede e sem banco, para rodar igual no servidor, no cliente
 * e nos testes (`npm run test:unit`).
 *
 * Decisões de João (30/09/2026): "(a)" neutro, sem campo de gênero; passaporte com
 * foto aceito; identidade obrigatória (tipo, número e emissor).
 */

import type { RepresentativeType } from "./legal-qualification";

// ---------------------------------------------------------------------------
// Ordenação: todo dropdown do portal em ordem alfabética pt-BR (regra 4.1 do QA)
// ---------------------------------------------------------------------------

/** Ordena por rótulo com locale pt-BR, para acentuadas não caírem no fim. Nunca muta a entrada. */
export function sortPt<T>(items: readonly T[], label: (item: T) => string): T[] {
  return [...items].sort((a, b) => label(a).localeCompare(label(b), "pt-BR"));
}

// ---------------------------------------------------------------------------
// Estado civil: 5 valores fechados, texto neutro (decisão de João, 30/09/2026)
// ---------------------------------------------------------------------------

export type MaritalStatusCode = "casado" | "divorciado" | "solteiro" | "uniao_estavel" | "viuvo";

export interface MaritalStatusEntry {
  code: MaritalStatusCode;
  /** Rótulo do dropdown. */
  label: string;
  /** Texto que entra no contrato, sempre neutro. */
  prose: string;
}

export const MARITAL_STATUS: readonly MaritalStatusEntry[] = sortPt(
  [
    { code: "casado", label: "Casado(a)", prose: "casado(a)" },
    { code: "divorciado", label: "Divorciado(a)", prose: "divorciado(a)" },
    { code: "solteiro", label: "Solteiro(a)", prose: "solteiro(a)" },
    { code: "uniao_estavel", label: "União Estável", prose: "em união estável" },
    { code: "viuvo", label: "Viúvo(a)", prose: "viúvo(a)" },
  ] as MaritalStatusEntry[],
  (e) => e.label,
);

export function isMaritalStatusCode(value: unknown): value is MaritalStatusCode {
  return MARITAL_STATUS.some((e) => e.code === value);
}

/** Texto do contrato para o estado civil, ou null se o código não existe. */
export function maritalStatusProse(code: string | null | undefined): string | null {
  return MARITAL_STATUS.find((e) => e.code === code)?.prose ?? null;
}

// ---------------------------------------------------------------------------
// Nacionalidade
// ---------------------------------------------------------------------------

export type NationalityCode = "br" | "outra";

export const NATIONALITIES: readonly { code: NationalityCode; label: string }[] = [
  { code: "br", label: "Brasileiro(a)" },
  { code: "outra", label: "Outra (informar)" },
];

export function isNationalityCode(value: unknown): value is NationalityCode {
  return value === "br" || value === "outra";
}

/**
 * Texto do contrato para a nacionalidade. "br" vira "brasileiro(a)". "outra" usa o
 * texto informado, limpo e em caixa baixa. Devolve null se faltar o texto de "outra".
 */
export function nationalityProse(code: string | null | undefined, other?: string | null): string | null {
  if (code === "br") return "brasileiro(a)";
  if (code === "outra") {
    const t = (other ?? "").replace(/\s+/g, " ").replace(/[\s,;]+$/g, "").trim().toLowerCase();
    return t || null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Identidade: tipo, número e emissor (obrigatória, decisão de João, 30/09/2026)
// ---------------------------------------------------------------------------

export type IdType = "cnh" | "oab" | "outro" | "passaporte" | "rg";

export const ID_TYPES: readonly { code: IdType; label: string }[] = sortPt(
  [
    { code: "cnh", label: "CNH" },
    { code: "oab", label: "OAB" },
    { code: "outro", label: "Outro documento" },
    { code: "passaporte", label: "Passaporte" },
    { code: "rg", label: "RG" },
  ] as { code: IdType; label: string }[],
  (e) => e.label,
);

export function isIdType(value: unknown): value is IdType {
  return ID_TYPES.some((e) => e.code === value);
}

export interface IdentityParts {
  id_type?: string | null;
  id_number?: string | null;
  /** Órgão emissor (RG, CNH, outro). Não se aplica a OAB nem a passaporte. */
  id_issuer?: string | null;
  /** UF de emissão (RG, CNH, outro) ou seccional (OAB). */
  id_issuer_uf?: string | null;
  /** Código ISO 3166-1 alfa-2 do país emissor (só passaporte). */
  id_country?: string | null;
}

/** Número do documento em maiúsculas, sem espaços nas pontas. */
export function normalizeIdNumber(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim().toUpperCase();
}

/**
 * Campos exigidos para cada tipo de identidade. Fonte única: usada pela validação do
 * servidor e pela montagem da tela, nunca duplicada.
 */
export function identityRequiredParts(idType: string | null | undefined): (keyof IdentityParts)[] {
  switch (idType) {
    case "passaporte":
      return ["id_type", "id_number", "id_country"];
    case "oab":
      return ["id_type", "id_number", "id_issuer_uf"];
    case "cnh":
    case "rg":
    case "outro":
      return ["id_type", "id_number", "id_issuer", "id_issuer_uf"];
    default:
      return ["id_type"];
  }
}

/** Quais campos de identidade faltam. Lista vazia significa completa. */
export function missingIdentityParts(parts: IdentityParts): (keyof IdentityParts)[] {
  return identityRequiredParts(parts.id_type).filter((k) => {
    const v = (parts[k] ?? "").toString().trim();
    return v === "";
  });
}

/**
 * Texto composto da identidade, gravado também na coluna legada `rg` (gravação dupla)
 * para o gerador de contratos e a ficha continuarem funcionando sem alteração.
 * Devolve null enquanto a identidade estiver incompleta.
 *
 *   RG       "RG 98.765.432 SSP/MG"
 *   CNH      "CNH 01234567890 DETRAN/SP"
 *   OAB      "OAB/MG 123.456"
 *   Passaporte "Passaporte X1234567 (US)"
 */
export function composeIdentity(parts: IdentityParts): string | null {
  if (missingIdentityParts(parts).length > 0) return null;
  const n = normalizeIdNumber(parts.id_number);
  const uf = (parts.id_issuer_uf ?? "").trim().toUpperCase();
  const issuer = (parts.id_issuer ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  switch (parts.id_type) {
    case "passaporte":
      return `Passaporte ${n} (${(parts.id_country ?? "").trim().toUpperCase()})`;
    case "oab":
      return `OAB/${uf} ${n}`;
    case "cnh":
      return `CNH ${n} ${issuer}/${uf}`;
    case "rg":
      return `RG ${n} ${issuer}/${uf}`;
    case "outro":
      return `Documento ${n} ${issuer}/${uf}`;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Passaporte como chave de cliente (Client 360)
// ---------------------------------------------------------------------------

/** Número de passaporte normalizado: só [0-9A-Z], sem espaço, hífen ou ponto. */
export function normalizePassportNumber(raw: string | null | undefined): string {
  return (raw ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

/**
 * Número de passaporte plausível: 5 a 20 caracteres alfanuméricos, não pode ser um
 * único caractere repetido nem só zeros (evita chave de cliente trivial como "00000").
 */
export function isValidPassportNumber(raw: string | null | undefined): boolean {
  const n = normalizePassportNumber(raw);
  if (n.length < 5 || n.length > 20) return false;
  if (/^(.)\1+$/.test(n)) return false;
  if (/^0+$/.test(n)) return false;
  return true;
}

/**
 * Chave canônica do passaporte no Client 360: `PP:<ISO2>:<NÚMERO>`. Os dois-pontos
 * nunca existem em CPF nem em CNPJ, então esse espaço de chaves não colide com o de
 * `normalizeDocument()`, que continua tratando só CPF e CNPJ. O país evita colisão
 * entre números iguais emitidos por países diferentes.
 */
export function passportDocumentKey(iso2: string | null | undefined, number: string | null | undefined): string | null {
  const country = (iso2 ?? "").trim().toUpperCase();
  if (!isIsoCountryCode(country)) return null;
  if (!isValidPassportNumber(number)) return null;
  return `PP:${country}:${normalizePassportNumber(number)}`;
}

// ---------------------------------------------------------------------------
// UF e países
// ---------------------------------------------------------------------------

export const UF_LIST: readonly string[] = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI",
  "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

export function isUf(value: unknown): boolean {
  return typeof value === "string" && UF_LIST.includes(value.toUpperCase());
}

/** ISO 3166-1 alfa-2. O nome em português vem de Intl.DisplayNames, nunca digitado à mão. */
export const ISO_COUNTRY_CODES: readonly string[] = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ",
  "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ",
  "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE", "EG", "EH", "ER", "ES", "ET",
  "FI", "FJ", "FK", "FM", "FO", "FR",
  "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY",
  "HK", "HM", "HN", "HR", "HT", "HU",
  "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT",
  "JE", "JM", "JO", "JP",
  "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ",
  "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY",
  "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ",
  "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ",
  "OM",
  "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY",
  "QA",
  "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ",
  "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ",
  "UA", "UG", "UM", "US", "UY", "UZ",
  "VA", "VC", "VE", "VG", "VI", "VN", "VU",
  "WF", "WS",
  "YE", "YT",
  "ZA", "ZM", "ZW",
];

export function isIsoCountryCode(value: unknown): boolean {
  return typeof value === "string" && ISO_COUNTRY_CODES.includes(value.toUpperCase());
}

let regionNames: Intl.DisplayNames | null = null;

/** Nome do país em português a partir do código ISO. Devolve o próprio código se o runtime não souber. */
export function countryName(code: string): string {
  if (!regionNames) regionNames = new Intl.DisplayNames(["pt-BR"], { type: "region" });
  try {
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** Opções do dropdown de país, em ordem alfabética pt-BR. */
export function countryOptions(): { code: string; name: string }[] {
  return sortPt(
    ISO_COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })),
    (c) => c.name,
  );
}

// ---------------------------------------------------------------------------
// Endereço: formato do manual v4
// ---------------------------------------------------------------------------

export interface AddressParts {
  rua?: string | null;
  /** Número da porta ou "S/N". */
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}

/** CEP no formato 00000-000, ou null se não tiver 8 dígitos. */
export function formatCep(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : null;
}

/**
 * Texto do endereço no formato do manual de qualificações v4:
 *   `logradouro, número, complemento - CEP 00000-000 - bairro, cidade/UF`
 * Complemento só aparece quando existe. "S/N" é aceito no número. Devolve null se
 * faltar qualquer parte obrigatória (nunca monta um endereço pela metade).
 */
export function buildAddressText(parts: AddressParts): string | null {
  const clean = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, " ").trim();
  const rua = clean(parts.rua);
  const numero = clean(parts.numero).toUpperCase();
  const complemento = clean(parts.complemento);
  const bairro = clean(parts.bairro);
  const cidade = clean(parts.cidade);
  const uf = clean(parts.estado).toUpperCase();
  const cep = formatCep(parts.cep);
  if (!rua || !numero || !bairro || !cidade || !isUf(uf) || !cep) return null;
  return `${rua}, ${numero}${complemento ? `, ${complemento}` : ""} - CEP ${cep} - ${bairro}, ${cidade}/${uf}`;
}

// ---------------------------------------------------------------------------
// Matriz de obrigatoriedade (BRIEF, seção 5.2)
// ---------------------------------------------------------------------------

export type QualificationProfile =
  | "PF" // A1
  | "PF_PROCURACAO" // B1
  | "INCAPAZ_RELATIVO" // B2
  | "INCAPAZ_ABSOLUTO" // B3
  | "ESPOLIO" // C1
  | "PJ" // D1
  | "REP_PF" // representante pessoa física
  | "REP_PJ"; // representante pessoa jurídica

export type FieldRequirement = "obrigatorio" | "se_houver" | "nao_se_aplica";

export type QualificationFieldKey =
  | "name"
  | "cpf"
  | "cnpj"
  | "nationality"
  | "profession"
  | "marital_status"
  | "identity"
  | "birth_date"
  | "email"
  | "phone"
  | "address"
  | "legal_nature"
  | "doc_identificacao"
  | "doc_contrato_social"
  | "doc_instrumento";

const O: FieldRequirement = "obrigatorio";
const S: FieldRequirement = "se_houver";
const N: FieldRequirement = "nao_se_aplica";

/** Ordem das colunas: PF, B1, B2, B3, C1, D1, REP_PF, REP_PJ. */
const ORDER: QualificationProfile[] = [
  "PF",
  "PF_PROCURACAO",
  "INCAPAZ_RELATIVO",
  "INCAPAZ_ABSOLUTO",
  "ESPOLIO",
  "PJ",
  "REP_PF",
  "REP_PJ",
];

function row(...reqs: FieldRequirement[]): Record<QualificationProfile, FieldRequirement> {
  const out = {} as Record<QualificationProfile, FieldRequirement>;
  ORDER.forEach((p, i) => { out[p] = reqs[i]; });
  return out;
}

/**
 * Fonte única de "o que é obrigatório para quem". Exceção declarada: o CPF é
 * dispensado para estrangeiro com passaporte que declara não possuir CPF
 * (ver `isCpfWaived`). `doc_instrumento` vale para a parte principal que tem
 * representante com anexo exigido nesta entrega (B1 e C1) e é anexado no representante
 * de nível 1. B2 e B3 (certidão de nascimento, termo de curatela, termo de tutela) ficam
 * para a sub-entrega 1D, junto com a declaração do representante legal de menor (BRIEF 5.17).
 * Pelo mesmo motivo, a identidade de B2 e B3 continua "se houver" até a 1D: nenhuma
 * obrigatoriedade nova de dado de menor antes da declaração do representante legal.
 */
export const FIELD_MATRIX: Record<QualificationFieldKey, Record<QualificationProfile, FieldRequirement>> = {
  //                          PF  B1  B2  B3  C1  D1  RPF RPJ
  name:                row(  O,  O,  O,  O,  O,  O,  O,  O),
  cpf:                 row(  O,  O,  O,  O,  O,  N,  O,  N),
  cnpj:                row(  N,  N,  N,  N,  N,  O,  N,  O),
  nationality:         row(  O,  O,  O,  O,  N,  N,  O,  N),
  profession:          row(  O,  O,  O,  N,  N,  N,  O,  N),
  marital_status:      row(  O,  O,  O,  N,  N,  N,  O,  N),
  identity:            row(  O,  O,  S,  S,  N,  N,  O,  N),
  birth_date:          row(  O,  O,  O,  O,  N,  N,  N,  N),
  email:               row(  O,  S,  S,  N,  N,  S,  O,  S),
  phone:               row(  O,  S,  S,  N,  N,  S,  O,  S),
  address:             row(  O,  O,  O,  N,  N,  O,  O,  O),
  legal_nature:        row(  N,  N,  N,  N,  N,  O,  N,  O),
  doc_identificacao:   row(  O,  O,  O,  N,  N,  N,  O,  N),
  doc_contrato_social: row(  N,  N,  N,  N,  N,  O,  N,  O),
  doc_instrumento:     row(  N,  O,  N,  N,  O,  N,  N,  N),
};

export function fieldRequirement(field: QualificationFieldKey, profile: QualificationProfile): FieldRequirement {
  return FIELD_MATRIX[field][profile];
}

/** Campos obrigatórios de um perfil, na ordem da matriz. */
export function requiredFields(profile: QualificationProfile): QualificationFieldKey[] {
  return (Object.keys(FIELD_MATRIX) as QualificationFieldKey[]).filter((k) => FIELD_MATRIX[k][profile] === "obrigatorio");
}

/**
 * Estrangeiro com passaporte que declara não possuir CPF (decisão de João,
 * 30/09/2026). Só vale para pessoa física maior de idade (A1, B1 e representante PF),
 * com nacionalidade "outra" e identidade do tipo passaporte. Menores (B2 e B3) só na
 * sub-entrega 1D. Nenhuma outra combinação dispensa o CPF.
 */
export function isCpfWaived(input: {
  profile: QualificationProfile;
  nationality_code?: string | null;
  id_type?: string | null;
  declared_no_cpf?: boolean | null;
}): boolean {
  // Só pessoa física maior de idade. Menores (B2 e B3) ficam de fora até a sub-entrega 1D.
  const pfLike: QualificationProfile[] = ["PF", "PF_PROCURACAO", "REP_PF"];
  return (
    pfLike.includes(input.profile) &&
    input.nationality_code === "outra" &&
    input.id_type === "passaporte" &&
    input.declared_no_cpf === true
  );
}

/** Tipo de anexo exigido para cada tipo de representação (null = o contrato social da PJ já cumpre). */
export const INSTRUMENT_DOCUMENT_KIND: Record<RepresentativeType, string | null> = {
  administrador: null,
  curador: "termo_curatela",
  genitor: "certidao_nascimento",
  inventariante: "termo_inventariante",
  procurador: "mandato",
  representante_legal: null,
  tutor: "termo_tutela",
};

export const INSTRUMENT_DOCUMENT_LABELS: Record<string, string> = {
  mandato: "Mandato (procuração)",
  certidao_nascimento: "Certidão de nascimento",
  termo_curatela: "Termo de curatela",
  termo_tutela: "Termo de tutela",
  termo_inventariante: "Termo de inventariante",
};

/** Todos os valores de `document_kind` aceitos em cm_party_qualification_documents depois da Fase 1. */
export const ALL_DOCUMENT_KINDS: readonly string[] = [
  "identificacao_foto",
  "contrato_social",
  ...Object.keys(INSTRUMENT_DOCUMENT_LABELS),
];
