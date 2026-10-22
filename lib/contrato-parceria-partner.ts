// Contrato de Parceria Comercial v2.2 (21/10/2026, pedido do Hamilton): depois
// de aprovar o cadastro do partner em /admin-cadastros, o ADMIN clica em
// "Enviar contrato" e o contrato sai preenchido com os dados do cadastro, vai
// para o ClickSign e aparece na Central de Contratos como qualquer outro.
// Minuta na Central: "Contrato de Parceria Comercial, Licenciamento Partner /
// Partner PRO / Enterprise, Plataforma V3 (Mentoria Digital, Antichargeback)
// v2.2", série V3C-PAR, vertical clientes. O texto da minuta usa marcadores
// entre colchetes ([razão social], [CPF], [plano]...), não {{variáveis}}; eles
// são preenchidos aqui, sem tocar nas cláusulas.
//
// Gold/Diamante (22/10/2026): o mesmo botão envia, só para os planos GOLD e
// DIAMANTE, a minuta própria deles ("Contrato de Prestação de Serviços,
// Mentoria + Licença de Uso da Plataforma V3, Planos V3 Gold e V3 Diamante").
// Cada família de plano só aceita a sua minuta (familiaDoPlano).

export const PARCERIA_TEMPLATE_MARCA = "licenciamento partner / partner pro / enterprise";
export const OFERTA_TEMPLATE_MARCA = "planos v3 gold e v3 diamante";

export const PLANOS_CONTRATO_PARCERIA = ["PARTNER", "PARTNER_PRO", "ENTERPRISE", "GOLD", "DIAMANTE"] as const;
export type PlanoContratoParceria = (typeof PLANOS_CONTRATO_PARCERIA)[number];

export const PLANO_LABEL: Record<PlanoContratoParceria, string> = {
  PARTNER: "Partner",
  PARTNER_PRO: "Partner PRO",
  ENTERPRISE: "Enterprise",
  GOLD: "V3 Gold",
  DIAMANTE: "V3 Diamante",
};

// Anuidade de cada plano (Anexo III da minuta v2.3), impressa no item 3.1.
export const PLANO_ANUIDADE: Partial<Record<PlanoContratoParceria, string>> = {
  PARTNER: "R$ 10.897,00",
  PARTNER_PRO: "R$ 15.897,00",
  ENTERPRISE: "R$ 49.897,00",
};

// Gold/Diamante: mensalidade e comissão (item 3.2 da minuta deles), impressas no item 3.1.
const PLANO_MENSAL: Partial<Record<PlanoContratoParceria, { mensalidade: string; comissao: string }>> = {
  GOLD: { mensalidade: "R$ 397,00", comissao: "25%" },
  DIAMANTE: { mensalidade: "R$ 897,00", comissao: "40%" },
};

export type FamiliaContrato = "parceria" | "oferta";

export function familiaDoPlano(plano: PlanoContratoParceria): FamiliaContrato {
  return plano === "GOLD" || plano === "DIAMANTE" ? "oferta" : "parceria";
}

export const TITULO_CONTRATO: Record<FamiliaContrato, string> = {
  parceria: "Contrato de Parceria v2.3",
  oferta: "Contrato V3 Gold / V3 Diamante",
};

// Representante legal da LICENCIANTE (contrato social, 1ª alteração).
const LICENCIANTE_RG = "11734474-7 IFP";
const LICENCIANTE_EMAIL = "joao.lemos@v3partners.com.br";

export function isPlanoContratoParceria(plano: string | null | undefined): plano is PlanoContratoParceria {
  return !!plano && (PLANOS_CONTRATO_PARCERIA as readonly string[]).includes(plano);
}

export function isContratoParceriaTemplateName(name: string | null | undefined): boolean {
  return !!name && name.toLowerCase().includes(PARCERIA_TEMPLATE_MARCA);
}

export function isContratoOfertaTemplateName(name: string | null | undefined): boolean {
  return !!name && name.toLowerCase().includes(OFERTA_TEMPLATE_MARCA);
}

/** Família da minuta (null = não é contrato de partner). */
export function familiaDoTemplate(name: string | null | undefined): FamiliaContrato | null {
  if (isContratoParceriaTemplateName(name)) return "parceria";
  if (isContratoOfertaTemplateName(name)) return "oferta";
  return null;
}

export type ParceriaTemplate = { id: string; template_name: string; approval_status?: string | null; version?: number | null; created_at?: string | null };

/** Minuta ativa mais recente da família do plano (aprovada primeiro). */
export function pickContratoParceriaTemplate<T extends ParceriaTemplate>(templates: T[], plano: PlanoContratoParceria): T | null {
  const familia = familiaDoPlano(plano);
  const candidatas = templates.filter((t) => familiaDoTemplate(t.template_name) === familia);
  candidatas.sort((a, b) =>
    Number(b.approval_status === "aprovado") - Number(a.approval_status === "aprovado")
    || (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  return candidatas[0] ?? null;
}

// ── Dados do LICENCIADO ─────────────────────────────────────────────────────

export type DadosLicenciado = {
  razao_social: string;
  documento: string;
  endereco: string;
  representante: string;
  cpf: string;
  rg: string;
  email: string;
  telefone: string;
  modulos: string;
  // Data prevista de pagamento (yyyy-mm-dd), digitada no envio; sai no item 3.1.
  data_pagamento: string;
};

export type CampoLicenciado = { key: keyof DadosLicenciado; label: string; placeholder?: string; tipo?: "date" };

export const CAMPOS_LICENCIADO: CampoLicenciado[] = [
  { key: "razao_social", label: "Razão social / nome" },
  { key: "documento", label: "CNPJ / CPF" },
  { key: "endereco", label: "Endereço completo" },
  { key: "representante", label: "Representante (quem assina)" },
  { key: "cpf", label: "CPF do representante" },
  { key: "rg", label: "RG do representante", placeholder: "00.000.000-0 DETRAN/RJ" },
  { key: "email", label: "E-mail (recebe o contrato)" },
  { key: "telefone", label: "Telefone" },
  { key: "modulos", label: "Nº de módulos do Treinamento Técnico Avançado (Anexo II)", placeholder: "ex.: 12" },
  { key: "data_pagamento", label: "Data prevista de pagamento", tipo: "date" },
];

// Gold/Diamante: sem Treinamento Técnico (nº de módulos) e sem data de
// pagamento no 3.1 (a mensalidade vence a cada 30 dias depois do período grátis).
export function camposDoPlano(plano: PlanoContratoParceria): CampoLicenciado[] {
  return familiaDoPlano(plano) === "oferta"
    ? CAMPOS_LICENCIADO.filter((c) => c.key !== "modulos" && c.key !== "data_pagamento")
    : CAMPOS_LICENCIADO;
}

// O e-mail é o do cadastro (login do partner): não muda por aqui.
export const CAMPOS_EDITAVEIS = CAMPOS_LICENCIADO.filter((c) => c.key !== "email").map((c) => c.key);

export type CadastroParaContrato = {
  tipo_pessoa?: string | null;
  plano?: string | null;
  email?: string | null;
  telefone?: string | null;
  nome_completo?: string | null;
  cpf?: string | null;
  razao_social?: string | null;
  cnpj?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
};

function t(v: string | null | undefined): string {
  return (v ?? "").trim();
}

export function enderecoDoCadastro(r: CadastroParaContrato): string {
  const rua = [t(r.logradouro), t(r.numero)].filter(Boolean).join(", nº ");
  const partes = [
    [rua, t(r.complemento)].filter(Boolean).join(", "),
    t(r.bairro),
    [t(r.cidade), t(r.estado)].filter(Boolean).join("/"),
    t(r.cep) ? `CEP ${t(r.cep)}` : "",
  ].filter(Boolean);
  return partes.join(", ");
}

export function dadosDoCadastro(r: CadastroParaContrato): DadosLicenciado {
  const pj = r.tipo_pessoa === "PJ";
  return {
    razao_social: pj ? t(r.razao_social) : t(r.nome_completo),
    documento: pj ? t(r.cnpj) : t(r.cpf),
    endereco: enderecoDoCadastro(r),
    representante: t(r.nome_completo),
    cpf: t(r.cpf),
    rg: "",
    email: t(r.email),
    telefone: t(r.telefone),
    modulos: "",
    data_pagamento: "",
  };
}

/** Dados do cadastro + o que o ADMIN completou no formulário (só campos editáveis). */
export function mesclarDados(base: DadosLicenciado, ajustes: unknown): DadosLicenciado {
  const out = { ...base };
  if (ajustes && typeof ajustes === "object") {
    for (const k of CAMPOS_EDITAVEIS) {
      const v = (ajustes as Record<string, unknown>)[k];
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }
  }
  return out;
}

export function camposFaltantes(d: DadosLicenciado, plano: PlanoContratoParceria): CampoLicenciado[] {
  return camposDoPlano(plano).filter((c) => !d[c.key].trim() || (c.key === "data_pagamento" && !dataBR(d.data_pagamento)));
}

/** "2026-10-25" → "25/10/2026" (null se não for uma data válida). */
export function dataBR(iso: string): string | null {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (dt.getUTCMonth() !== +m[2] - 1 || dt.getUTCDate() !== +m[3]) return null;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

// ── Preenchimento da minuta ─────────────────────────────────────────────────

function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function trocar(html: string, de: string, para: string): string {
  if (!html.includes(de)) throw new Error(`Trecho "${de}" não encontrado na minuta do Contrato de Parceria (a minuta mudou?).`);
  return html.replace(de, para);
}

/**
 * Preenche a minuta v2.2 com os dados do LICENCIADO e devolve só o corpo do
 * documento. A minuta foi salva como página HTML completa (fundo navy, logo,
 * rodapé de "minuta"); o contrato sai no papel timbrado padrão da Central
 * (wrapContractInV3Html), por isso o <head>, o cabeçalho com logo e o rodapé
 * da minuta saem, e os rótulos de "minuta / para análise" viram a versão.
 */
export function preencherContratoParceria(minuta: string, plano: PlanoContratoParceria, d: DadosLicenciado): string {
  const m = minuta.match(/<div class="doc">([\s\S]*)<\/div>\s*(?:<!--[\s\S]*?-->\s*)?<\/body>/i);
  let html = m ? m[1] : minuta;

  // Cabeçalho com logo da minuta (o timbre da Central já traz o logo).
  html = html.replace(/<div class="header">[\s\S]*?<h1/i, "<h1");
  // Rodapé "Minuta sujeita a ajustes até a formalização final."
  html = html.replace(/<div class="footer">[\s\S]*$/i, "");
  // Versão impressa = a da própria minuta ("Minuta v2.3 · Para análise..." → "VERSÃO 2.3").
  const versao = html.match(/<p class="subtitle">[^<]*?v(\d+(?:\.\d+)*)/i)?.[1];
  html = html.replace(/<p class="subtitle">[^<]*<\/p>/i, versao ? `<p class="subtitle" style="text-align:center;font-weight:700;letter-spacing:.12em">VERSÃO ${versao}</p>` : "");

  if (familiaDoPlano(plano) === "oferta") return preencherOferta(html, plano, d);

  const planoLabel = PLANO_LABEL[plano];
  html = trocar(html, "Licenciamento [PLANO]", `Licenciamento ${esc(planoLabel)}`);
  const pagamento = dataBR(d.data_pagamento);
  if (!pagamento) throw new Error("Data prevista de pagamento inválida.");
  html = trocar(
    html,
    "Plano contratado: [plano]",
    `Plano contratado: ${esc(planoLabel)}, anuidade de ${PLANO_ANUIDADE[plano]} (Anexo III). Data prevista de pagamento: ${pagamento}.`,
  );
  html = trocarLicenciante(html);
  html = trocar(
    html,
    "[razão social], CNPJ/CPF nº [documento], com sede em [endereço], representado por [nome do representante], CPF nº [CPF], RG nº [RG], e-mail [e-mail], telefone [telefone].",
    `${esc(d.razao_social.toUpperCase())}, CNPJ/CPF nº ${esc(d.documento)}, com sede em ${esc(d.endereco)}, representado por ${esc(d.representante.toUpperCase())}, CPF nº ${esc(d.cpf)}, RG nº ${esc(d.rg)}, e-mail ${esc(d.email)}, telefone ${esc(d.telefone)}.`,
  );
  html = trocar(html, "([nº] módulos)", `(${esc(d.modulos)} módulos)`);

  return semMarcadores(html);
}

function semMarcadores(html: string): string {
  const sobra = html.match(/\[(?:PLANO|plano|RG|e-mail|razão social(?: \/ nome)?|documento|endereço|nome do representante|CPF|telefone|nº)\]/);
  if (sobra) throw new Error(`Marcador ${sobra[0]} ficou sem preencher no contrato.`);
  return html.trim();
}

function trocarLicenciante(html: string): string {
  return trocar(
    html,
    "JOÃO LEMOS NETTO, CPF nº 078.678.257-97, RG nº [RG], e-mail [e-mail].",
    `JOÃO LEMOS NETTO, CPF nº 078.678.257-97, RG nº ${LICENCIANTE_RG}, e-mail ${LICENCIANTE_EMAIL}.`,
  );
}

// Minuta Gold/Diamante: CONTRATADA (V3) e CONTRATANTE (Partner).
function preencherOferta(html: string, plano: PlanoContratoParceria, d: DadosLicenciado): string {
  const mensal = PLANO_MENSAL[plano];
  if (!mensal) throw new Error(`Plano ${plano} não usa a minuta Gold/Diamante.`);
  html = trocar(
    html,
    "[plano].",
    `${esc(PLANO_LABEL[plano])}, mensalidade de ${mensal.mensalidade}, comissão de ${mensal.comissao} do Resultado Líquido, após o período gratuito de 30 (trinta) dias (Cláusula 5).`,
  );
  html = trocarLicenciante(html);
  html = trocar(
    html,
    "[razão social / nome], CNPJ/CPF nº [documento], com sede/domicílio em [endereço], representado por [nome do representante], CPF nº [CPF], RG nº [RG], e-mail [e-mail], telefone [telefone].",
    `${esc(d.razao_social.toUpperCase())}, CNPJ/CPF nº ${esc(d.documento)}, com sede/domicílio em ${esc(d.endereco)}, representado por ${esc(d.representante.toUpperCase())}, CPF nº ${esc(d.cpf)}, RG nº ${esc(d.rg)}, e-mail ${esc(d.email)}, telefone ${esc(d.telefone)}.`,
  );
  return semMarcadores(html);
}
