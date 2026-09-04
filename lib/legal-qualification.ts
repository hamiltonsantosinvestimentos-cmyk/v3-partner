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
function pfBase(p: { full_name?: string | null; nationality?: string | null; profession?: string | null; marital_status?: string | null; cpf_cnpj?: string | null; rg?: string | null; email?: string | null; phone?: string | null; endereco_completo?: string | null }): string {
  return `${p.full_name ?? NAO_INFORMADO}, ${p.nationality ?? NAO_INFORMADO}, ${p.profession ?? NAO_INFORMADO}, ${p.marital_status ?? NAO_INFORMADO}, CPF ${p.cpf_cnpj ?? NAO_INFORMADO}${frag(", Identidade ", p.rg)}${frag(", e-mail ", p.email)}${frag(", ", p.phone)}, residente e domiciliado(a) na ${p.endereco_completo ?? NAO_INFORMADO}`;
}

/** B2: Pessoa Relativamente Incapaz -- mesma base de A1, com a cláusula de incapacidade logo após o nome. */
function incapazRelativoBase(p: LegalQualificationParty): string {
  return `${p.full_name ?? NAO_INFORMADO}, relativamente incapaz, ${p.nationality ?? NAO_INFORMADO}, ${p.profession ?? NAO_INFORMADO}, ${p.marital_status ?? NAO_INFORMADO}, CPF ${p.cpf_cnpj ?? NAO_INFORMADO}${frag(", Identidade ", p.rg)}${frag(", e-mail ", p.email)}${frag(", ", p.phone)}, residente e domiciliado(a) na ${p.endereco_completo ?? NAO_INFORMADO}`;
}

/** B3: Pessoa Totalmente Incapaz (menor impúbere) -- só nome, nacionalidade, CPF e RG se houver. Sem profissão/estado civil/endereço, por desenho (menor). */
function incapazAbsolutoBase(p: LegalQualificationParty): string {
  return `${p.full_name ?? NAO_INFORMADO}, menor impúbere, totalmente incapaz, ${p.nationality ?? NAO_INFORMADO}, CPF ${p.cpf_cnpj ?? NAO_INFORMADO}${frag(", Identidade ", p.rg)}`;
}

/** C1: Espólio -- full_name/cpf_cnpj aqui são os dados do FALECIDO. */
function espolioBase(p: LegalQualificationParty): string {
  return `ESPÓLIO DE ${p.full_name ?? NAO_INFORMADO}, CPF ${p.cpf_cnpj ?? NAO_INFORMADO}`;
}

/** D1: Pessoa Jurídica. */
function pjBase(p: { company_name?: string | null; company_legal_nature?: CompanyLegalNature | null; company_cnpj?: string | null; email?: string | null; phone?: string | null; company_address?: string | null }): string {
  const legalNature = p.company_legal_nature ?? "privado";
  return `${p.company_name ?? NAO_INFORMADO}, pessoa jurídica de direito ${legalNature}, CNPJ ${p.company_cnpj ?? NAO_INFORMADO}${frag(", e-mail ", p.email)}${frag(", ", p.phone)}, com sede na ${p.company_address ?? NAO_INFORMADO}`;
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
