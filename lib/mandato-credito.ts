import type { SupabaseClient } from "@supabase/supabase-js";

// Mandato de Crédito (09/10/2026, pedido do Hamilton): contrato de mandato que
// a Mesa Operacional envia ao cliente pelo botão "Mandato" do modal da
// proposta. Duas minutas na Central de Contratos, uma por tipo de cliente
// (PF e PJ), série V3C-MAN, vertical credito. A qualificação do cliente entra
// pronta em {{contratante_qualificacao}} e o % cobrado vem do campo "Mandato"
// do modal ({{percentual_mandato}}).

export const MANDATO_TEMPLATE_PREFIX = "Mandato de Crédito";
export const MANDATO_SERIES = "V3C-MAN";

export type MandatoTipo = "PF" | "PJ";
export type MandatoDados = Record<string, string>;

export function mandatoTemplateName(tipo: MandatoTipo): string {
  return `${MANDATO_TEMPLATE_PREFIX} (Cliente ${tipo})`;
}

export type MandatoTemplate = { id: string; template_name: string; approval_status?: string | null };

/** Minuta ativa do tipo pedido, a partir da lista de /api/contracts/templates. */
export function pickMandatoTemplate<T extends MandatoTemplate>(templates: T[], tipo: MandatoTipo): T | null {
  const nome = mandatoTemplateName(tipo).toLowerCase();
  return templates.find((t) => t.template_name.toLowerCase().startsWith(nome)) ?? null;
}

export function isMandatoTemplateName(name: string | null | undefined): boolean {
  return !!name && name.toLowerCase().startsWith(MANDATO_TEMPLATE_PREFIX.toLowerCase());
}

/** true quando o contrato foi gerado a partir de uma das minutas de Mandato de Crédito. */
export async function isMandatoCreditoContract(db: SupabaseClient, templateId: string | null | undefined): Promise<boolean> {
  if (!templateId) return false;
  const { data } = await db.from("contract_templates").select("template_name").eq("id", templateId).maybeSingle();
  return isMandatoTemplateName((data as { template_name?: string } | null)?.template_name);
}

// ── Campos de qualificação ──────────────────────────────────────────────────

export type MandatoCampo = {
  key: string;
  label: string;
  placeholder?: string;
  opcoes?: string[];
  opcional?: boolean;
  grupo: "cliente" | "empresa" | "socio";
};

export const ESTADOS_CIVIS = ["solteiro(a)", "casado(a)", "união estável", "divorciado(a)", "separado(a)", "viúvo(a)"];
const UNIDO = ["casado(a)", "união estável"];

function camposPessoa(prefixo: string, grupo: MandatoCampo["grupo"]): MandatoCampo[] {
  const k = (s: string) => `${prefixo}${s}`;
  return [
    { key: k("nome"), label: "Nome completo", grupo },
    { key: k("nacionalidade"), label: "Nacionalidade", placeholder: "brasileiro(a)", grupo },
    { key: k("estado_civil"), label: "Estado civil", opcoes: ESTADOS_CIVIS, grupo },
    { key: k("regime_bens"), label: "Regime de bens", placeholder: "comunhão parcial de bens", grupo },
    { key: k("profissao"), label: "Profissão", grupo },
    { key: k("nascimento"), label: "Data de nascimento", placeholder: "dd/mm/aaaa", grupo },
    { key: k("rg"), label: "RG (número)", grupo },
    { key: k("rg_orgao"), label: "Órgão expedidor / UF", placeholder: "SSP/SP", grupo },
    { key: k("cpf"), label: "CPF", grupo },
    { key: k("endereco"), label: "Endereço (rua, nº, complemento, bairro)", grupo },
    { key: k("cidade"), label: "Cidade", grupo },
    { key: k("uf"), label: "UF", placeholder: "RJ", grupo },
    { key: k("cep"), label: "CEP", grupo },
    { key: k("email"), label: "E-mail (recebe o contrato para assinar)", grupo },
    { key: k("telefone"), label: "Telefone / WhatsApp", grupo },
  ];
}

export const CAMPOS_PF: MandatoCampo[] = [
  ...camposPessoa("", "cliente"),
  { key: "conjuge_nome", label: "Nome do cônjuge / companheiro(a)", opcional: true, grupo: "cliente" },
  { key: "conjuge_cpf", label: "CPF do cônjuge / companheiro(a)", opcional: true, grupo: "cliente" },
];

export const CAMPOS_PJ: MandatoCampo[] = [
  { key: "razao_social", label: "Razão social", grupo: "empresa" },
  { key: "cnpj", label: "CNPJ", grupo: "empresa" },
  { key: "nire", label: "NIRE", opcional: true, grupo: "empresa" },
  { key: "junta", label: "Junta Comercial (UF)", placeholder: "JUCERJA", opcional: true, grupo: "empresa" },
  { key: "endereco", label: "Endereço da sede (rua, nº, complemento, bairro)", grupo: "empresa" },
  { key: "cidade", label: "Cidade", grupo: "empresa" },
  { key: "uf", label: "UF", placeholder: "RJ", grupo: "empresa" },
  { key: "cep", label: "CEP", grupo: "empresa" },
  { key: "email", label: "E-mail da empresa", grupo: "empresa" },
  ...camposPessoa("socio_", "socio"),
];

export function camposDoTipo(tipo: MandatoTipo): MandatoCampo[] {
  return tipo === "PF" ? CAMPOS_PF : CAMPOS_PJ;
}

/** Regime de bens só é exigido para casado(a) / união estável. */
function campoExigido(c: MandatoCampo, dados: MandatoDados): boolean {
  if (c.opcional) return false;
  if (c.key.endsWith("regime_bens")) {
    const prefixo = c.key.slice(0, -"regime_bens".length);
    return UNIDO.includes((dados[`${prefixo}estado_civil`] ?? "").trim());
  }
  return true;
}

const so = (v: string | undefined) => (v ?? "").replace(/\D/g, "");

/** Lista os campos obrigatórios vazios ou inválidos (CPF/CNPJ/e-mail). */
export function camposFaltantes(tipo: MandatoTipo, dados: MandatoDados): MandatoCampo[] {
  return camposDoTipo(tipo).filter((c) => {
    if (!campoExigido(c, dados)) return false;
    const v = (dados[c.key] ?? "").trim();
    if (!v) return true;
    if (c.key.endsWith("cpf") && so(v).length !== 11) return true;
    if (c.key === "cnpj" && so(v).length !== 14) return true;
    if (c.key.endsWith("email") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return true;
    return false;
  });
}

/** Campos exibidos no formulário (regime de bens só aparece quando se aplica). */
export function camposVisiveis(tipo: MandatoTipo, dados: MandatoDados): MandatoCampo[] {
  return camposDoTipo(tipo).filter((c) => !c.key.endsWith("regime_bens") || campoExigido(c, dados));
}

// ── Pré-preenchimento pela proposta ────────────────────────────────────────

type ProposalLike = {
  client_name?: string | null;
  client_cpf_cnpj?: string | null;
  cpf_cnpj?: string | null;
  client_type?: string | null;
  email?: string | null;
  telefone?: string | null;
  metadata?: Record<string, unknown> | null;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function tipoDaProposta(p: ProposalLike): MandatoTipo {
  const meta = (p.metadata ?? {}) as Record<string, unknown>;
  const declarado = str(meta.client_type) || str(p.client_type);
  if (declarado === "PJ" || declarado === "PF") return declarado;
  const doc = so(p.client_cpf_cnpj ?? p.cpf_cnpj ?? "");
  return doc.length === 14 ? "PJ" : "PF";
}

/** ISO (aaaa-mm-dd) vira dd/mm/aaaa; outros formatos passam intactos. */
function dataBR(v: string): string {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

const ESTADO_CIVIL_MAP: Record<string, string> = {
  solteiro: "solteiro(a)", solteira: "solteiro(a)", casado: "casado(a)", casada: "casado(a)",
  divorciado: "divorciado(a)", divorciada: "divorciado(a)", separado: "separado(a)", separada: "separado(a)",
  viuvo: "viúvo(a)", "viúvo": "viúvo(a)", viuva: "viúvo(a)", "viúva": "viúvo(a)",
  "uniao estavel": "união estável", "união estável": "união estável", uniao_estavel: "união estável",
};
function estadoCivil(v: string): string {
  const k = v.toLowerCase().trim();
  return ESTADO_CIVIL_MAP[k] ?? (ESTADOS_CIVIS.includes(k) ? k : v);
}

/**
 * Dados já conhecidos da proposta: cadastro da proposta + o que a Mesa já
 * completou num envio anterior (metadata.mandato_qualificacao), que vence.
 */
export function dadosDaProposta(p: ProposalLike): { tipo: MandatoTipo; dados: MandatoDados } {
  const meta = (p.metadata ?? {}) as Record<string, unknown>;
  const tipo = tipoDaProposta(p);
  const doc = str(p.client_cpf_cnpj) || str(p.cpf_cnpj);
  const email = str(meta.email) || str(p.email);
  const telefone = str(meta.telefone) || str(p.telefone);
  const base: MandatoDados = {
    endereco: str(meta.endereco_rua),
    cidade: str(meta.endereco_cidade),
    uf: str(meta.endereco_uf),
    cep: str(meta.endereco_cep),
    email,
  };
  const dados: MandatoDados = tipo === "PF"
    ? {
        ...base,
        nome: str(p.client_name),
        cpf: doc,
        rg: str(meta.rg),
        nascimento: dataBR(str(meta.nascimento)),
        estado_civil: estadoCivil(str(meta.estado_civil)),
        telefone,
      }
    : {
        ...base,
        razao_social: str(meta.razao_social) || str(p.client_name),
        cnpj: doc,
        socio_nome: str(meta.socio_responsavel),
        socio_telefone: telefone,
      };
  const salvo = meta.mandato_qualificacao as { tipo?: string; dados?: MandatoDados } | undefined;
  if (salvo?.tipo === tipo && salvo.dados) {
    for (const [k, v] of Object.entries(salvo.dados)) if (str(v)) dados[k] = str(v);
  }
  for (const k of Object.keys(dados)) if (!dados[k]) delete dados[k];
  return { tipo, dados };
}

// ── Texto jurídico ─────────────────────────────────────────────────────────

function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtCpf(v: string): string {
  const d = so(v);
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : v;
}
function fmtCnpj(v: string): string {
  const d = so(v);
  return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : v;
}
function fmtCep(v: string): string {
  const d = so(v);
  return d.length === 8 ? d.replace(/(\d{5})(\d{3})/, "$1-$2") : v;
}

function prosaPessoa(d: MandatoDados, p: string): string {
  const g = (k: string) => esc((d[`${p}${k}`] ?? "").trim());
  const civil = g("estado_civil");
  const regime = UNIDO.includes((d[`${p}estado_civil`] ?? "").trim()) && g("regime_bens") ? ` sob o regime de ${g("regime_bens")}` : "";
  return `<strong>${esc((d[`${p}nome`] ?? "").trim().toUpperCase())}</strong>, ${g("nacionalidade")}, ${civil}${regime}, ${g("profissao")}, nascido(a) em ${g("nascimento")}, `
    + `portador(a) da carteira de identidade nº ${g("rg")} ${g("rg_orgao")}, inscrito(a) no CPF sob o nº ${esc(fmtCpf(d[`${p}cpf`] ?? ""))}, `
    + `residente e domiciliado(a) na ${g("endereco")}, ${g("cidade")}/${g("uf").toUpperCase()}, CEP ${esc(fmtCep(d[`${p}cep`] ?? ""))}, `
    + `endereço eletrônico ${g("email")}, telefone ${g("telefone")}`;
}

/** Parágrafo de qualificação da CONTRATANTE, já em HTML seguro. */
export function montarQualificacao(tipo: MandatoTipo, d: MandatoDados): string {
  const g = (k: string) => esc((d[k] ?? "").trim());
  if (tipo === "PF") {
    const conjuge = g("conjuge_nome")
      ? `, cônjuge/companheiro(a) ${g("conjuge_nome")}${g("conjuge_cpf") ? `, CPF ${esc(fmtCpf(d.conjuge_cpf))}` : ""}`
      : "";
    return `${prosaPessoa(d, "")}${conjuge}, doravante designado(a) simplesmente <strong>CONTRATANTE</strong>.`;
  }
  const registro = g("nire")
    ? `, registrada${g("junta") ? ` na ${g("junta")}` : " na Junta Comercial"} sob o NIRE nº ${g("nire")}`
    : "";
  return `<strong>${esc((d.razao_social ?? "").trim().toUpperCase())}</strong>, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${esc(fmtCnpj(d.cnpj ?? ""))}${registro}, `
    + `com sede na ${g("endereco")}, ${g("cidade")}/${g("uf").toUpperCase()}, CEP ${esc(fmtCep(d.cep ?? ""))}, endereço eletrônico ${g("email")}, `
    + `neste ato representada, na forma de seu contrato social, por seu sócio administrador ${prosaPessoa(d, "socio_")}, `
    + `doravante designada simplesmente <strong>CONTRATANTE</strong>.`;
}

/** Quem assina pela CONTRATANTE (PJ: o sócio administrador, pessoa física). */
export function signatarioMandato(tipo: MandatoTipo, d: MandatoDados): { nome: string; doc: string; email: string; rotulo: string } {
  if (tipo === "PF") {
    return { nome: (d.nome ?? "").trim(), doc: fmtCpf(d.cpf ?? ""), email: (d.email ?? "").trim(), rotulo: "Contratante" };
  }
  return {
    nome: (d.socio_nome ?? "").trim(),
    doc: fmtCpf(d.socio_cpf ?? ""),
    email: (d.socio_email ?? "").trim(),
    rotulo: `Contratante, p. ${(d.razao_social ?? "").trim()}`,
  };
}

// ── Percentual por extenso ─────────────────────────────────────────────────

const UNID = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZ = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];

function inteiroExtenso(n: number): string {
  if (n === 100) return "cem";
  if (n < 20) return UNID[n];
  const d = Math.floor(n / 10), u = n % 10;
  return u ? `${DEZ[d]} e ${UNID[u]}` : DEZ[d];
}

/** 6 → "6% (seis por cento)"; 6.5 → "6,5% (seis vírgula cinco por cento)". */
export function percentualPorExtenso(pct: number): string {
  const v = Math.round(pct * 100) / 100;
  const int = Math.floor(v);
  const decStr = v.toFixed(2).split(".")[1].replace(/0+$/, "");
  const numero = decStr ? `${int},${decStr}` : String(int);
  let extenso = inteiroExtenso(int);
  if (decStr) {
    const dec = parseInt(decStr, 10);
    extenso += ` vírgula ${decStr.length === 2 && decStr[0] === "0" ? "zero " : ""}${inteiroExtenso(dec)}`;
  }
  return `${numero}% (${extenso} por cento)`;
}
