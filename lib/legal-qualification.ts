/**
 * MOTOR DE QUALIFICAÇÃO CIVIL PADRONIZADA E MINIMALISTA
 *
 * Diretriz de governança do Dr. Athaydes (jurídico), relayed por João em
 * 01/09/2026. Substitui a lógica duplicada que existia em 2 lugares
 * (lib/qualification-roles.ts e app/api/cm/qualifications/legal-text/route.ts)
 * por uma fonte única, capaz de montar os 6 templates padronizados
 * (A1/B1/B2/B3/C1/D1) e de resolver representação recursiva (PJ pode ser
 * representada por outra PJ, encadeado até chegar numa Pessoa Física).
 *
 * REGRA DE OURO (minimalismo, pedido explícito do Dr. Athaydes): campos
 * "(se houver)" são facultativos. Quando o dado não existe, o termo inteiro
 * é suprimido, nunca deixando vírgula dupla ou espaço sobrando. Ver frag().
 */

import { normalizePhone, formatPhoneIntl } from "./phone";

export type PartyNature = "PF" | "PF_PROCURACAO" | "INCAPAZ_RELATIVO" | "INCAPAZ_ABSOLUTO" | "ESPOLIO" | "PJ";
export type RepresentativeType = "procurador" | "genitor" | "curador" | "tutor" | "inventariante" | "administrador" | "representante_legal";
export type CompanyLegalNature = "privado" | "publico" | "misto";

export interface LegalQualificationRepresentation {
  representative_type: RepresentativeType;
  // Natureza do próprio representante -- só PF ou PJ faz sentido aqui (um
  // representante não pode ele mesmo ser um incapaz/espólio). Default PF.
  party_nature?: "PF" | "PJ" | null;
  full_name?: string | null;
  cpf_cnpj?: string | null;
  rg?: string | null;
  email?: string | null;
  nationality?: string | null;
  marital_status?: string | null;
  profession?: string | null;
  phone?: string | null;
  endereco_completo?: string | null;
  company_name?: string | null;
  company_cnpj?: string | null;
  company_address?: string | null;
  company_legal_nature?: CompanyLegalNature | null;
  // Reaproveitamento de KYC (04/09/2026): resolvido via resolveClient() a
  // partir do cpf_cnpj (PF) ou company_cnpj (PJ) DESTE nível da cadeia --
  // cada representante tem sua própria identidade/estoque de documentos,
  // independente do v3_client_id da parte principal no topo.
  v3_client_id?: string | null;
  // Recursivo: presente quando este representante também é PJ e precisa
  // do próprio representante (encadeamento PJ → PJ → ... → PF).
  representation?: LegalQualificationRepresentation | null;
}

export interface LegalQualificationParty {
  party_nature?: PartyNature | null;
  person_type?: "PF" | "PJ" | null; // legado (pré-01/09/2026), usado só como fallback
  full_name?: string | null;
  cpf_cnpj?: string | null;
  rg?: string | null;
  email?: string | null;
  nationality?: string | null;
  marital_status?: string | null;
  profession?: string | null;
  birth_date?: string | null;
  phone?: string | null;
  endereco_completo?: string | null;
  company_name?: string | null;
  company_cnpj?: string | null;
  company_address?: string | null;
  company_legal_nature?: CompanyLegalNature | null;
  representation?: LegalQualificationRepresentation | null;
}

const NAO_INFORMADO = "[NÃO INFORMADO]";

/** Fragmento condicional: some por inteiro (sem vírgula/espaço órfão) quando value é vazio. */
function frag(prefix: string, value?: string | null, suffix = ""): string {
  const v = value?.trim();
  return v ? `${prefix}${v}${suffix}` : "";
}

// birth_date/nascimento fica fora da prosa por desenho: os 6 templates do
// Dr. Athaydes (A1/B1/B2/B3/C1/D1) não citam "nascido em" em nenhum deles.
// O campo continua coletado e obrigatório (KYC, 31/08/2026), só não entra
// no texto de qualificação civil.

const REPRESENTATIVE_ROLE_PHRASE: Record<RepresentativeType, string> = {
  procurador: "seu(sua) procurador(a) (mandato anexo)",
  genitor: "seu(sua) genitor(a) (certidão de nascimento anexa)",
  curador: "seu(sua) curador(a) (termo anexo)",
  tutor: "seu(sua) tutor(a) (termo anexo)",
  inventariante: "seu(sua) inventariante (termo anexo)",
  administrador: "seu(sua) administrador(a) (contrato social anexo)",
  representante_legal: "seu(sua) representante legal (contrato social anexo)",
};

/** A1: Pessoa Natural/Física padrão. */
/**
 * Telefone no padrão brasileiro: (DD) 9XXXX-XXXX (celular, 11 dígitos) ou
 * (DD) XXXX-XXXX (fixo, 10 dígitos), com "+55 " quando o número já veio com
 * DDI. Só apresentação. Achado real 21/09/2026: 5 telefones do lote estavam
 * só com dígitos e 1 já formatado. Tamanho fora do padrão volta como digitado.
 */
export function formatPhoneBR(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  // Número internacional (DDI diferente de 55) nunca recebe a máscara
  // brasileira: "+1 555 123 4567" tem 11 dígitos e viraria "(15) 55123-4567".
  if (raw.startsWith("+") || raw.replace(/\D/g, "").startsWith("00")) {
    const r = normalizePhone(raw);
    if (r.ok && r.digits && !r.isBrazil) return formatPhoneIntl(raw);
  }
  let d = raw.replace(/\D/g, "");
  let ddi = "";
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) {
    ddi = "+55 ";
    d = d.slice(2);
  }
  if (d.length === 11) return `${ddi}(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${ddi}(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}

/**
 * Padroniza os códigos dentro de um endereço já montado ("..., Cidade, UF,
 * CEP 00000-000"): CEP sempre 00000-000 e sigla do estado em maiúsculas (o
 * lote real tinha "CEP 78652000" e "Mt", "Es"). Só apresentação.
 */
export function formatAddressCodes(address: string | null | undefined): string | null {
  const raw = (address ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return null;
  return raw
    .replace(/CEP\s*:?\s*(\d{2})\.?(\d{3})-?(\d{3})\b/gi, "CEP $1$2-$3")
    .replace(/,\s*([A-Za-z]{2})\s*,\s*(CEP\b)/g, (_m, uf: string, cep: string) => `, ${uf.toUpperCase()}, ${cep}`);
}

/**
 * Limpa texto livre digitado no formulário de qualificação antes de entrar
 * na prosa jurídica: tira espaços das pontas, vírgula/ponto e vírgula soltos
 * no fim e espaços duplos. Achado real 21/09/2026 (NCNDA V3C-NDA-2026-0036):
 * um nome gravado com vírgula no fim ("... SANTOS,") saía como ",," na
 * qualificação e como nome inválido no signatário. Não mexe em maiúsculas,
 * acentos nem em ponto final ("Jr." continua "Jr."). Vazio devolve null.
 */
export function cleanPartyText(value: string | null | undefined): string | null {
  const t = (value ?? "").replace(/\s+/g, " ").replace(/[\s,;]+$/g, "").trim();
  return t || null;
}

/**
 * Nome de pessoa física ou razão social em CAIXA ALTA no preâmbulo e no bloco
 * de assinatura (regra 2.1 do QA de governança, achado real 21/09/2026:
 * nenhuma das bases abaixo fazia essa conversão, só o RÓTULO do papel
 * (ROLE_LABELS) saía maiúsculo, nunca o nome da parte). `?? NAO_INFORMADO` já
 * é caixa alta, então aplicar .toUpperCase() no resultado combinado é seguro
 * e idempotente nos dois casos. O dado gravado nunca é reescrito.
 */
function partyNameUpper(name?: string | null): string {
  return (cleanPartyText(name) ?? NAO_INFORMADO).toUpperCase();
}

/**
 * Formata CPF (11 dígitos) ou CNPJ (14 caracteres) no padrão brasileiro,
 * qualquer que seja a forma como foi digitado (só caracteres, com ponto, com
 * espaço). Achado real 21/09/2026 (NCNDA V3C-NDA-2026-0036): 5 dos 8 CPFs do
 * lote estavam gravados só com dígitos e 3 já com pontuação, e o instrumento
 * saía com os dois formatos misturados. Só apresentação: o dado gravado em
 * cm_party_qualifications nunca é reescrito. Tamanho diferente de 11 ou 14
 * volta exatamente como digitado (nunca inventa nem corta caractere).
 * Vazio ou nulo devolve null, para o chamador cair no "[não informado]".
 *
 * CNPJ alfanumérico (emissão pela Receita/Serpro desde 31/07/2026) tem letras
 * nas 12 primeiras posições, os 2 dígitos verificadores continuam numéricos —
 * nunca usar \D aqui, que apaga a letra e corrompe o CNPJ novo (achado real
 * 21/09/2026, QA de governança, mesma armadilha em `lib/validators/cpf-cnpj.ts`,
 * corrigida junto). CPF é sempre numérico, sem essa ressalva.
 */
export function formatDocumentNumber(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const chars = raw.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  if (/^\d{11}$/.test(chars)) return chars.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (chars.length === 14) return chars.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, "$1.$2.$3/$4-$5");
  return raw;
}

function pfBase(p: { full_name?: string | null; nationality?: string | null; profession?: string | null; marital_status?: string | null; cpf_cnpj?: string | null; rg?: string | null; email?: string | null; phone?: string | null; endereco_completo?: string | null }): string {
  return `${partyNameUpper(p.full_name)}, ${p.nationality ?? NAO_INFORMADO}, ${p.profession ?? NAO_INFORMADO}, ${p.marital_status ?? NAO_INFORMADO}, CPF ${formatDocumentNumber(p.cpf_cnpj) ?? NAO_INFORMADO}${frag(", Identidade ", p.rg)}${frag(", e-mail ", p.email)}${frag(", ", formatPhoneBR(p.phone))}, residente e domiciliado(a) na ${formatAddressCodes(p.endereco_completo) ?? NAO_INFORMADO}`;
}

/** B2: Pessoa Relativamente Incapaz -- mesma base de A1, com a cláusula de incapacidade logo após o nome. */
function incapazRelativoBase(p: LegalQualificationParty): string {
  return `${partyNameUpper(p.full_name)}, relativamente incapaz, ${p.nationality ?? NAO_INFORMADO}, ${p.profession ?? NAO_INFORMADO}, ${p.marital_status ?? NAO_INFORMADO}, CPF ${formatDocumentNumber(p.cpf_cnpj) ?? NAO_INFORMADO}${frag(", Identidade ", p.rg)}${frag(", e-mail ", p.email)}${frag(", ", formatPhoneBR(p.phone))}, residente e domiciliado(a) na ${formatAddressCodes(p.endereco_completo) ?? NAO_INFORMADO}`;
}

/** B3: Pessoa Totalmente Incapaz (menor impúbere) -- só nome, nacionalidade, CPF e RG se houver. Sem profissão/estado civil/endereço, por desenho (menor). */
function incapazAbsolutoBase(p: LegalQualificationParty): string {
  return `${partyNameUpper(p.full_name)}, menor impúbere, totalmente incapaz, ${p.nationality ?? NAO_INFORMADO}, CPF ${formatDocumentNumber(p.cpf_cnpj) ?? NAO_INFORMADO}${frag(", Identidade ", p.rg)}`;
}

/** C1: Espólio -- full_name/cpf_cnpj aqui são os dados do FALECIDO. */
function espolioBase(p: LegalQualificationParty): string {
  return `ESPÓLIO DE ${partyNameUpper(p.full_name)}, CPF ${formatDocumentNumber(p.cpf_cnpj) ?? NAO_INFORMADO}`;
}

/** D1: Pessoa Jurídica. */
function pjBase(p: { company_name?: string | null; company_legal_nature?: CompanyLegalNature | null; company_cnpj?: string | null; email?: string | null; phone?: string | null; company_address?: string | null }): string {
  const legalNature = p.company_legal_nature ?? "privado";
  return `${partyNameUpper(p.company_name)}, pessoa jurídica de direito ${legalNature}, CNPJ ${formatDocumentNumber(p.company_cnpj) ?? NAO_INFORMADO}${frag(", e-mail ", p.email)}${frag(", ", formatPhoneBR(p.phone))}, com sede na ${formatAddressCodes(p.company_address) ?? NAO_INFORMADO}`;
}

/**
 * Monta a base (sem cláusula de representação, sem ponto final) de um
 * representante -- PF ou PJ. Usado recursivamente: se o representante for
 * PJ e tiver a própria `representation`, a cadeia continua.
 */
function representativeBaseWithChain(rep: LegalQualificationRepresentation): string {
  const nature = rep.party_nature ?? "PF";
  const base = nature === "PJ" ? pjBase(rep) : pfBase(rep);
  return rep.representation ? `${base}${representationClause(nature, rep.representation)}` : base;
}

/** Cláusula ", representado(a)/representada por seu(sua) [tipo] [qualificação do representante]". */
function representationClause(outerNature: PartyNature | "PF" | "PJ", rep: LegalQualificationRepresentation): string {
  const agreement = outerNature === "PJ" ? "representada" : "representado(a)";
  const rolePhrase = REPRESENTATIVE_ROLE_PHRASE[rep.representative_type];
  return `, ${agreement} por ${rolePhrase} ${representativeBaseWithChain(rep)}`;
}

/**
 * Função pública: monta a qualificação civil completa, no formato exato
 * dos templates A1/B1/B2/B3/C1/D1, terminada em ponto final.
 *
 * party_nature ausente (registro anterior a 01/09/2026) cai no fallback
 * pelo antigo person_type (PF/PJ simples, sem representação) -- nenhum
 * dado histórico quebra.
 */
export function buildLegalQualification(party: LegalQualificationParty): string {
  const nature: PartyNature = party.party_nature ?? (party.person_type === "PJ" ? "PJ" : "PF");

  let base: string;
  switch (nature) {
    case "PF":
    case "PF_PROCURACAO":
      base = pfBase(party);
      break;
    case "INCAPAZ_RELATIVO":
      base = incapazRelativoBase(party);
      break;
    case "INCAPAZ_ABSOLUTO":
      base = incapazAbsolutoBase(party);
      break;
    case "ESPOLIO":
      base = espolioBase(party);
      break;
    case "PJ":
      base = pjBase(party);
      break;
  }

  const rep = party.representation ? representationClause(nature, party.representation) : "";
  return `${base}${rep}.`;
}

/**
 * Naturezas que exigem representante (validação de obrigatoriedade vive na
 * rota, mas o mapa de "quais tipos de representante são aceitos" é
 * propriedade deste módulo -- é regra de template, não de banco).
 */
export const REQUIRED_REPRESENTATIVE_TYPES: Record<PartyNature, RepresentativeType[] | null> = {
  PF: null,
  PF_PROCURACAO: ["procurador"],
  INCAPAZ_RELATIVO: ["genitor", "curador"],
  INCAPAZ_ABSOLUTO: ["genitor", "tutor"],
  ESPOLIO: ["inventariante"],
  PJ: ["administrador", "representante_legal"],
};

export const PARTY_NATURE_LABELS: Record<PartyNature, string> = {
  PF: "Pessoa Física",
  PF_PROCURACAO: "Pessoa Física (Representada por Procuração)",
  INCAPAZ_RELATIVO: "Pessoa Relativamente Incapaz",
  INCAPAZ_ABSOLUTO: "Pessoa Totalmente Incapaz (Menor Impúbere)",
  ESPOLIO: "Espólio",
  PJ: "Pessoa Jurídica",
};

export const REPRESENTATIVE_TYPE_LABELS: Record<RepresentativeType, string> = {
  procurador: "Procurador(a)",
  genitor: "Genitor(a)",
  curador: "Curador(a)",
  tutor: "Tutor(a)",
  inventariante: "Inventariante",
  administrador: "Administrador(a)",
  representante_legal: "Representante Legal",
};
