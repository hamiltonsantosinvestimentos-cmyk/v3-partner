/**
 * VALIDAÇÃO E NORMALIZAÇÃO DO ENVIO DA QUALIFICAÇÃO (BRIEF 30/09/2026, Fase 1B)
 *
 * Fonte única do que o servidor aceita e do que grava, e da pré-visualização do texto
 * que a tela mostra antes do envio. Lê a matriz de obrigatoriedade de
 * `lib/qualification-schema.ts` (nunca replica a regra) e devolve:
 *   - os erros, por campo, em português;
 *   - os valores já normalizados e a "gravação dupla": o código fechado (marital_status_code,
 *     nationality_code, id_type...) e o texto que entra no contrato (marital_status,
 *     nationality, rg composto, endereco_completo no formato do manual v4).
 *
 * Só funções puras, sem rede e sem banco: roda igual no servidor, no cliente e nos testes.
 * O que depende de I/O (consulta de CEP no ViaCEP, resolução do Client 360, anexos) fica na
 * rota, que usa este módulo como base.
 */

import { isValidCPF, isValidCNPJ } from "./validators/cpf-cnpj";
import { normalizePhone } from "./phone";
import { normalizeDocument } from "./v3-clients-pure";
import {
  FIELD_MATRIX,
  buildAddressText,
  composeIdentity,
  fieldRequirement,
  formatCep,
  isCpfWaived,
  isIdType,
  isIsoCountryCode,
  isMaritalStatusCode,
  isNationalityCode,
  isUf,
  isValidPassportNumber,
  maritalStatusProse,
  missingIdentityParts,
  nationalityProse,
  normalizeIdNumber,
  type QualificationFieldKey,
  type QualificationProfile,
} from "./qualification-schema";
import {
  REQUIRED_REPRESENTATIVE_TYPES,
  buildLegalQualification,
  cleanPartyText,
  type LegalQualificationParty,
  type LegalQualificationRepresentation,
  type PartyNature,
  type RepresentativeType,
} from "./legal-qualification";

export const MAX_REPRESENTATION_DEPTH = 5;
const VALID_NATURES: PartyNature[] = ["PF", "PF_PROCURACAO", "INCAPAZ_RELATIVO", "INCAPAZ_ABSOLUTO", "ESPOLIO", "PJ"];
const VALID_REP_TYPES: RepresentativeType[] = ["procurador", "genitor", "curador", "tutor", "inventariante", "administrador", "representante_legal"];
const PJ_REP_TYPES: RepresentativeType[] = ["administrador", "representante_legal"];
const LEGAL_NATURES = ["privado", "publico", "misto"] as const;

// ---------------------------------------------------------------------------
// Tipos de entrada (o que chega no corpo da requisição)
// ---------------------------------------------------------------------------

export interface PartyInput {
  full_name?: string | null;
  cpf_cnpj?: string | null;
  /** Estrangeiro com passaporte que declara não possuir CPF (só adultos, ver isCpfWaived). */
  declared_no_cpf?: boolean | null;
  nationality_code?: string | null;
  nationality_other?: string | null;
  profession?: string | null;
  marital_status_code?: string | null;
  birth_date?: string | null;
  id_type?: string | null;
  id_number?: string | null;
  id_issuer?: string | null;
  id_issuer_uf?: string | null;
  id_country?: string | null;
  email?: string | null;
  phone?: string | null;
  endereco_cep?: string | null;
  endereco_rua?: string | null;
  endereco_numero?: string | null;
  endereco_complemento?: string | null;
  endereco_bairro?: string | null;
  endereco_cidade?: string | null;
  endereco_estado?: string | null;
  /** A parte não achou o CEP e aceitou informar o endereço à mão. */
  endereco_manual?: boolean | null;
  company_name?: string | null;
  company_legal_nature?: string | null;
  company_cnpj?: string | null;
  company_cep?: string | null;
  company_rua?: string | null;
  company_numero?: string | null;
  company_complemento?: string | null;
  company_bairro?: string | null;
  company_cidade?: string | null;
  company_estado?: string | null;
  company_manual?: boolean | null;
}

export interface RepresentationInput extends PartyInput {
  representative_type?: string | null;
  party_nature?: string | null;
  representation?: RepresentationInput | null;
}

export interface SubmissionInput extends PartyInput {
  party_nature?: string | null;
  representation?: RepresentationInput | null;
}

// ---------------------------------------------------------------------------
// Tipos de saída
// ---------------------------------------------------------------------------

export interface FieldError {
  /** Caminho da parte: "principal", "representante.1", "representante.2"... */
  path: string;
  field: QualificationFieldKey | "representation" | "party_nature" | "legal_nature";
  message: string;
}

export interface NormalizedParty {
  profile: QualificationProfile;
  full_name: string | null;
  /** CPF canônico (11 dígitos) ou null. */
  cpf_cnpj: string | null;
  nationality_code: string | null;
  nationality: string | null;
  profession: string | null;
  marital_status_code: string | null;
  marital_status: string | null;
  birth_date: string | null;
  id_type: string | null;
  id_number: string | null;
  id_issuer: string | null;
  id_issuer_uf: string | null;
  id_country: string | null;
  /** Identidade composta, gravada também na coluna legada `rg`. */
  rg: string | null;
  email: string | null;
  /** Telefone em E.164. */
  phone: string | null;
  endereco_completo: string | null;
  endereco_cep: string | null;
  endereco_rua: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  endereco_manual: boolean;
  company_name: string | null;
  company_legal_nature: string | null;
  /** CNPJ canônico (14 caracteres, maiúsculo) ou null. */
  company_cnpj: string | null;
  company_address: string | null;
  company_cep: string | null;
  company_rua: string | null;
  company_numero: string | null;
  company_complemento: string | null;
  company_bairro: string | null;
  company_cidade: string | null;
  company_estado: string | null;
  company_manual: boolean;
  /** Estrangeiro sem CPF identificado só pelo passaporte. */
  cpf_waived: boolean;
}

export interface NormalizedRepresentation extends NormalizedParty {
  representative_type: RepresentativeType;
  party_nature: "PF" | "PJ";
  representation: NormalizedRepresentation | null;
}

export interface SubmissionResult {
  ok: boolean;
  errors: FieldError[];
  nature: PartyNature | null;
  principal: NormalizedParty | null;
  representation: NormalizedRepresentation | null;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const blank = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Data de nascimento válida (AAAA-MM-DD), não futura e não anterior a 120 anos. */
export function isValidBirthDate(value: string | null | undefined, now: Date = new Date()): boolean {
  const v = blank(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d) return false;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (parsed.getTime() > today) return false;
  const limit = Date.UTC(now.getUTCFullYear() - 120, now.getUTCMonth(), now.getUTCDate());
  return parsed.getTime() >= limit;
}

/** E-mail: sem espaços nas pontas, minúsculo, formato local@dominio.tld, até 254 caracteres. */
export function normalizeEmail(raw: string | null | undefined): string | null {
  const e = blank(raw).toLowerCase();
  if (!e || e.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

export function profileOfNature(nature: PartyNature): QualificationProfile {
  return nature;
}

export function profileOfRepresentative(partyNature: "PF" | "PJ"): QualificationProfile {
  return partyNature === "PJ" ? "REP_PJ" : "REP_PF";
}

const EMPTY: NormalizedParty = {
  profile: "PF", full_name: null, cpf_cnpj: null, nationality_code: null, nationality: null, profession: null,
  marital_status_code: null, marital_status: null, birth_date: null, id_type: null, id_number: null, id_issuer: null,
  id_issuer_uf: null, id_country: null, rg: null, email: null, phone: null, endereco_completo: null, endereco_cep: null,
  endereco_rua: null, endereco_numero: null, endereco_complemento: null, endereco_bairro: null, endereco_cidade: null,
  endereco_estado: null, endereco_manual: false, company_name: null, company_legal_nature: null, company_cnpj: null,
  company_address: null, company_cep: null, company_rua: null, company_numero: null, company_complemento: null,
  company_bairro: null, company_cidade: null, company_estado: null, company_manual: false, cpf_waived: false,
};

// ---------------------------------------------------------------------------
// Normalização de uma pessoa (principal ou representante)
// ---------------------------------------------------------------------------

export interface NormalizePartyOptions {
  path: string;
  /** Nome vindo do convite. Na parte principal o nome é cadastrado pela Mesa, não digitado. */
  inviteName?: string | null;
  /** E-mail do convite, usado como padrão quando a parte principal não o altera. */
  inviteEmail?: string | null;
}

export function normalizeParty(
  profile: QualificationProfile,
  input: PartyInput,
  opts: NormalizePartyOptions,
): { errors: FieldError[]; values: NormalizedParty } {
  const errors: FieldError[] = [];
  const err = (field: FieldError["field"], message: string) => errors.push({ path: opts.path, field, message });
  const req = (field: QualificationFieldKey) => fieldRequirement(field, profile);
  const v: NormalizedParty = { ...EMPTY, profile };
  const isPj = profile === "PJ" || profile === "REP_PJ";

  // --- nome / razão social ---
  if (isPj) {
    v.company_name = cleanPartyText(input.company_name);
    if (!v.company_name) err("name", "Informe a razão social.");
  } else {
    v.full_name = cleanPartyText(opts.inviteName ?? input.full_name);
    if (!v.full_name) err("name", "Informe o nome completo.");
  }

  // --- nacionalidade (primeiro, porque a dispensa de CPF depende dela) ---
  if (req("nationality") !== "nao_se_aplica") {
    if (!isNationalityCode(input.nationality_code)) {
      err("nationality", "Escolha a nacionalidade.");
    } else {
      v.nationality_code = input.nationality_code;
      const prose = nationalityProse(input.nationality_code, input.nationality_other);
      if (!prose) err("nationality", "Informe a nacionalidade.");
      else v.nationality = prose;
    }
  }

  // --- identidade (antes do CPF, porque o passaporte pode dispensá-lo) ---
  const idRequirement = req("identity");
  if (idRequirement !== "nao_se_aplica") {
    const idParts = {
      id_type: blank(input.id_type) || null,
      id_number: normalizeIdNumber(input.id_number) || null,
      id_issuer: blank(input.id_issuer).toUpperCase() || null,
      id_issuer_uf: blank(input.id_issuer_uf).toUpperCase() || null,
      id_country: blank(input.id_country).toUpperCase() || null,
    };
    const anyId = Object.values(idParts).some(Boolean);
    if (idRequirement === "obrigatorio" || anyId) {
      if (!isIdType(idParts.id_type)) {
        err("identity", "Escolha o tipo do documento de identidade.");
      } else {
        const faltam = missingIdentityParts(idParts);
        if (faltam.length) {
          err("identity", "Complete a identidade: " + faltam.map(describeIdentityPart).join(", ") + ".");
        } else if (idParts.id_type === "passaporte" && (!isValidPassportNumber(idParts.id_number) || !isIsoCountryCode(idParts.id_country))) {
          err("identity", "Passaporte inválido: confira o número (5 a 20 caracteres) e o país emissor.");
        } else if (idParts.id_issuer_uf && !isUf(idParts.id_issuer_uf) && idParts.id_type !== "passaporte") {
          err("identity", "UF de emissão inválida.");
        } else {
          v.id_type = idParts.id_type;
          v.id_number = idParts.id_number;
          v.id_issuer = idParts.id_type === "passaporte" || idParts.id_type === "oab" ? null : idParts.id_issuer;
          v.id_issuer_uf = idParts.id_type === "passaporte" ? null : idParts.id_issuer_uf;
          v.id_country = idParts.id_type === "passaporte" ? idParts.id_country : null;
          v.rg = composeIdentity({ id_type: v.id_type, id_number: v.id_number, id_issuer: v.id_issuer, id_issuer_uf: v.id_issuer_uf, id_country: v.id_country });
        }
      }
    }
  }

  // --- CPF ---
  if (req("cpf") !== "nao_se_aplica") {
    const waived = isCpfWaived({
      profile,
      nationality_code: v.nationality_code,
      id_type: v.id_type,
      declared_no_cpf: input.declared_no_cpf === true,
    });
    v.cpf_waived = waived;
    const rawCpf = blank(input.cpf_cnpj);
    if (waived) {
      if (rawCpf) err("cpf", "Remova o CPF ou desmarque \"Não possuo CPF\".");
    } else if (!rawCpf) {
      err("cpf", input.declared_no_cpf === true
        ? "A dispensa de CPF só vale para estrangeiro adulto com passaporte. Informe o CPF."
        : "Informe o CPF.");
    } else if (!isValidCPF(rawCpf)) {
      err("cpf", "CPF inválido, confira os dígitos.");
    } else {
      v.cpf_cnpj = normalizeDocument(rawCpf);
    }
  }

  // --- CNPJ ---
  if (req("cnpj") !== "nao_se_aplica") {
    const rawCnpj = blank(input.company_cnpj);
    if (!rawCnpj) err("cnpj", "Informe o CNPJ.");
    else if (!isValidCNPJ(rawCnpj)) err("cnpj", "CNPJ inválido, confira os dígitos.");
    else v.company_cnpj = normalizeDocument(rawCnpj);
  }

  // --- natureza jurídica ---
  if (req("legal_nature") !== "nao_se_aplica") {
    const ln = blank(input.company_legal_nature);
    if (!(LEGAL_NATURES as readonly string[]).includes(ln)) err("legal_nature", "Escolha a natureza jurídica da empresa.");
    else v.company_legal_nature = ln;
  }

  // --- profissão e estado civil ---
  if (req("profession") !== "nao_se_aplica") {
    v.profession = cleanPartyText(input.profession);
    if (!v.profession) err("profession", "Informe a profissão.");
  }
  if (req("marital_status") !== "nao_se_aplica") {
    if (!isMaritalStatusCode(input.marital_status_code)) {
      err("marital_status", "Escolha o estado civil.");
    } else {
      v.marital_status_code = input.marital_status_code;
      v.marital_status = maritalStatusProse(input.marital_status_code);
    }
  }

  // --- data de nascimento (KYC, fora do texto do contrato) ---
  if (req("birth_date") !== "nao_se_aplica") {
    const bd = blank(input.birth_date);
    if (!bd) err("birth_date", "Informe a data de nascimento.");
    else if (!isValidBirthDate(bd)) err("birth_date", "Data de nascimento inválida (não pode ser futura nem anterior a 120 anos).");
    else v.birth_date = bd;
  }

  // --- e-mail e telefone ---
  const emailReq = req("email");
  if (emailReq !== "nao_se_aplica") {
    const rawEmail = blank(input.email) || blank(opts.inviteEmail);
    if (!rawEmail) {
      if (emailReq === "obrigatorio") err("email", "Informe o e-mail.");
    } else {
      const e = normalizeEmail(rawEmail);
      if (!e) err("email", "E-mail inválido.");
      else v.email = e;
    }
  }
  const phoneReq = req("phone");
  if (phoneReq !== "nao_se_aplica") {
    const rawPhone = blank(input.phone);
    if (!rawPhone) {
      if (phoneReq === "obrigatorio") err("phone", "Informe o telefone com DDI e DDD.");
    } else {
      const p = normalizePhone(rawPhone);
      if (!p.ok) err("phone", p.error ?? "Telefone inválido.");
      else v.phone = p.e164;
    }
  }

  // --- endereço ---
  if (req("address") !== "nao_se_aplica") {
    const prefix = isPj ? "company" : "endereco";
    const pick = (suffix: string) => blank((input as Record<string, unknown>)[`${prefix}_${suffix}`] as string | null | undefined);
    const parts = {
      rua: pick("rua"), numero: pick("numero"), complemento: pick("complemento"),
      bairro: pick("bairro"), cidade: pick("cidade"), estado: pick("estado").toUpperCase(), cep: pick("cep"),
    };
    const text = buildAddressText(parts);
    if (!text) {
      err("address", describeAddressProblem(parts));
    } else {
      const manual = (isPj ? input.company_manual : input.endereco_manual) === true;
      if (isPj) {
        v.company_address = text; v.company_cep = formatCep(parts.cep); v.company_rua = parts.rua;
        v.company_numero = parts.numero.toUpperCase(); v.company_complemento = parts.complemento || null;
        v.company_bairro = parts.bairro; v.company_cidade = parts.cidade; v.company_estado = parts.estado; v.company_manual = manual;
      } else {
        v.endereco_completo = text; v.endereco_cep = formatCep(parts.cep); v.endereco_rua = parts.rua;
        v.endereco_numero = parts.numero.toUpperCase(); v.endereco_complemento = parts.complemento || null;
        v.endereco_bairro = parts.bairro; v.endereco_cidade = parts.cidade; v.endereco_estado = parts.estado; v.endereco_manual = manual;
      }
    }
  }

  return { errors, values: v };
}

function describeIdentityPart(k: string): string {
  switch (k) {
    case "id_type": return "tipo do documento";
    case "id_number": return "número";
    case "id_issuer": return "órgão emissor";
    case "id_issuer_uf": return "UF de emissão";
    case "id_country": return "país emissor";
    default: return k;
  }
}

function describeAddressProblem(p: { rua: string; numero: string; bairro: string; cidade: string; estado: string; cep: string }): string {
  if (!formatCep(p.cep)) return "Informe um CEP válido (8 dígitos).";
  if (!p.rua) return "Informe o logradouro.";
  if (!p.numero) return "Informe o número (ou S/N).";
  if (!p.bairro) return "Informe o bairro.";
  if (!p.cidade) return "Informe a cidade.";
  if (!isUf(p.estado)) return "Informe uma UF válida.";
  return "Endereço incompleto.";
}

// ---------------------------------------------------------------------------
// Envio completo: principal + cadeia de representantes
// ---------------------------------------------------------------------------

export interface NormalizeSubmissionOptions {
  inviteName?: string | null;
  inviteEmail?: string | null;
}

export function normalizeSubmission(input: SubmissionInput, opts: NormalizeSubmissionOptions = {}): SubmissionResult {
  const errors: FieldError[] = [];
  const natureRaw = input.party_nature as PartyNature | null | undefined;
  if (!natureRaw || !VALID_NATURES.includes(natureRaw)) {
    return { ok: false, errors: [{ path: "principal", field: "party_nature", message: "Escolha a natureza da parte." }], nature: null, principal: null, representation: null };
  }
  const nature: PartyNature = natureRaw;

  const principal = normalizeParty(profileOfNature(nature), input, { path: "principal", inviteName: opts.inviteName, inviteEmail: opts.inviteEmail });
  errors.push(...principal.errors);

  const allowed = REQUIRED_REPRESENTATIVE_TYPES[nature];
  let representation: NormalizedRepresentation | null = null;
  if (allowed) {
    const rep = normalizeRepresentation(input.representation, allowed, 1, errors);
    representation = rep;
  }

  return { ok: errors.length === 0, errors, nature, principal: principal.values, representation };
}

function normalizeRepresentation(
  rep: RepresentationInput | null | undefined,
  allowedTypes: RepresentativeType[],
  depth: number,
  errors: FieldError[],
): NormalizedRepresentation | null {
  const path = `representante.${depth}`;
  if (depth > MAX_REPRESENTATION_DEPTH) {
    errors.push({ path, field: "representation", message: "A cadeia de representação excede o limite de 5 níveis." });
    return null;
  }
  if (!rep || typeof rep !== "object") {
    errors.push({ path, field: "representation", message: "O representante é obrigatório para esta natureza de parte." });
    return null;
  }
  const type = rep.representative_type as RepresentativeType | undefined;
  if (!type || !VALID_REP_TYPES.includes(type)) {
    errors.push({ path, field: "representation", message: "Escolha o tipo de representação." });
    return null;
  }
  if (!allowedTypes.includes(type)) {
    errors.push({ path, field: "representation", message: "Tipo de representação não permitido para esta natureza." });
    return null;
  }
  const partyNature: "PF" | "PJ" = rep.party_nature === "PJ" ? "PJ" : "PF";
  const { errors: partyErrors, values } = normalizeParty(profileOfRepresentative(partyNature), rep, { path });
  errors.push(...partyErrors);

  let nested: NormalizedRepresentation | null = null;
  if (partyNature === "PJ") {
    nested = normalizeRepresentation(rep.representation, PJ_REP_TYPES, depth + 1, errors);
  }
  return { ...values, representative_type: type, party_nature: partyNature, representation: nested };
}

// ---------------------------------------------------------------------------
// Texto da qualificação (modal de confirmação e gravação)
// ---------------------------------------------------------------------------

/** Converte um representante normalizado para o JSON gravado em `representation` (sem v3_client_id). */
export function toRepresentationJson(rep: NormalizedRepresentation): LegalQualificationRepresentation {
  const isPj = rep.party_nature === "PJ";
  return {
    representative_type: rep.representative_type,
    party_nature: rep.party_nature,
    full_name: rep.full_name,
    cpf_cnpj: rep.cpf_cnpj,
    rg: rep.rg,
    id_type: rep.id_type,
    email: rep.email,
    nationality: rep.nationality,
    marital_status: rep.marital_status,
    profession: rep.profession,
    phone: rep.phone,
    endereco_completo: isPj ? null : rep.endereco_completo,
    company_name: rep.company_name,
    company_cnpj: rep.company_cnpj,
    company_address: isPj ? rep.company_address : null,
    company_legal_nature: (rep.company_legal_nature as LegalQualificationRepresentation["company_legal_nature"]) ?? null,
    representation: rep.representation ? toRepresentationJson(rep.representation) : null,
  };
}

/**
 * Texto da qualificação que vai para o contrato, calculado a partir do envio já
 * normalizado. A tela usa o mesmo cálculo no modal de confirmação, para a parte ver
 * exatamente o que será impresso. Devolve null enquanto houver erro.
 */
export function previewQualificationText(result: SubmissionResult): string | null {
  if (!result.ok || !result.principal || !result.nature) return null;
  const p = result.principal;
  const party: LegalQualificationParty = {
    party_nature: result.nature,
    full_name: p.full_name,
    cpf_cnpj: p.cpf_cnpj,
    rg: p.rg,
    id_type: p.id_type,
    email: p.email,
    nationality: p.nationality,
    marital_status: p.marital_status,
    profession: p.profession,
    phone: p.phone,
    endereco_completo: p.endereco_completo,
    company_name: p.company_name,
    company_cnpj: p.company_cnpj,
    company_address: p.company_address,
    company_legal_nature: (p.company_legal_nature as LegalQualificationParty["company_legal_nature"]) ?? null,
    representation: result.representation ? toRepresentationJson(result.representation) : null,
  };
  return buildLegalQualification(party);
}

// ---------------------------------------------------------------------------
// Máscaras de digitação (usadas pela tela). Nenhuma apaga letra de CNPJ enquanto se digita.
// ---------------------------------------------------------------------------

/** CPF: só dígitos, até 11, no formato 000.000.000-00. */
export function maskCpf(value: string | null | undefined): string {
  const d = (value ?? "").replace(/\D/g, "").slice(0, 11);
  let o = d.slice(0, 3);
  if (d.length > 3) o += "." + d.slice(3, 6);
  if (d.length > 6) o += "." + d.slice(6, 9);
  if (d.length > 9) o += "-" + d.slice(9, 11);
  return o;
}

/** CNPJ legado ou alfanumérico: letras e dígitos, maiúsculo, até 14, no formato 00.000.000/0000-00. */
export function maskCnpj(value: string | null | undefined): string {
  const c = (value ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 14);
  let o = c.slice(0, 2);
  if (c.length > 2) o += "." + c.slice(2, 5);
  if (c.length > 5) o += "." + c.slice(5, 8);
  if (c.length > 8) o += "/" + c.slice(8, 12);
  if (c.length > 12) o += "-" + c.slice(12, 14);
  return o;
}

/** CEP: só dígitos, até 8, no formato 00000-000. */
export function maskCep(value: string | null | undefined): string {
  const d = (value ?? "").replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export { FIELD_MATRIX };
