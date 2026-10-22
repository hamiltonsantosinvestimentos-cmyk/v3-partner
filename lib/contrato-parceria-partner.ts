// Contrato de Parceria Comercial v2.2 (21/10/2026, pedido do Hamilton): depois
// de aprovar o cadastro do partner em /admin-cadastros, o ADMIN clica em
// "Enviar contrato" e o contrato sai preenchido com os dados do cadastro, vai
// para o ClickSign e aparece na Central de Contratos como qualquer outro.
// Minuta na Central: "Contrato de Parceria Comercial, Licenciamento Partner /
// Partner PRO / Enterprise, Plataforma V3 (Mentoria Digital, Antichargeback)
// v2.2", série V3C-PAR, vertical clientes. O texto da minuta usa marcadores
// entre colchetes ([razão social], [CPF], [plano]...), não {{variáveis}}; eles
// são preenchidos aqui, sem tocar nas cláusulas.

export const PARCERIA_TEMPLATE_MARCA = "licenciamento partner / partner pro / enterprise";

export const PLANOS_CONTRATO_PARCERIA = ["PARTNER", "PARTNER_PRO", "ENTERPRISE"] as const;
export type PlanoContratoParceria = (typeof PLANOS_CONTRATO_PARCERIA)[number];

export const PLANO_LABEL: Record<PlanoContratoParceria, string> = {
  PARTNER: "Partner",
  PARTNER_PRO: "Partner PRO",
  ENTERPRISE: "Enterprise",
};

// Anuidade de cada plano (Anexo III da minuta), impressa no item 3.1.
export const PLANO_ANUIDADE: Record<PlanoContratoParceria, string> = {
  PARTNER: "R$ 10.897,00",
  PARTNER_PRO: "R$ 15.897,00",
  ENTERPRISE: "R$ 49.897,00",
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

export type ParceriaTemplate = { id: string; template_name: string; approval_status?: string | null; version?: number | null; created_at?: string | null };

/** Minuta ativa mais recente do Contrato de Parceria (aprovada primeiro). */
export function pickContratoParceriaTemplate<T extends ParceriaTemplate>(templates: T[]): T | null {
  const candidatas = templates.filter((t) => isContratoParceriaTemplateName(t.template_name));
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

export function camposFaltantes(d: DadosLicenciado): CampoLicenciado[] {
  return CAMPOS_LICENCIADO.filter((c) => !d[c.key].trim() || (c.key === "data_pagamento" && !dataBR(d.data_pagamento)));
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

  const planoLabel = PLANO_LABEL[plano];
  html = trocar(html, "Licenciamento [PLANO]", `Licenciamento ${esc(planoLabel)}`);
  const pagamento = dataBR(d.data_pagamento);
  if (!pagamento) throw new Error("Data prevista de pagamento inválida.");
  html = trocar(
    html,
    "Plano contratado: [plano]",
    `Plano contratado: ${esc(planoLabel)}, anuidade de ${PLANO_ANUIDADE[plano]} (Anexo III). Data prevista de pagamento: ${pagamento}.`,
  );
  html = trocar(
    html,
    "JOÃO LEMOS NETTO, CPF nº 078.678.257-97, RG nº [RG], e-mail [e-mail].",
    `JOÃO LEMOS NETTO, CPF nº 078.678.257-97, RG nº ${LICENCIANTE_RG}, e-mail ${LICENCIANTE_EMAIL}.`,
  );
  html = trocar(
    html,
    "[razão social], CNPJ/CPF nº [documento], com sede em [endereço], representado por [nome do representante], CPF nº [CPF], RG nº [RG], e-mail [e-mail], telefone [telefone].",
    `${esc(d.razao_social.toUpperCase())}, CNPJ/CPF nº ${esc(d.documento)}, com sede em ${esc(d.endereco)}, representado por ${esc(d.representante.toUpperCase())}, CPF nº ${esc(d.cpf)}, RG nº ${esc(d.rg)}, e-mail ${esc(d.email)}, telefone ${esc(d.telefone)}.`,
  );
  html = trocar(html, "([nº] módulos)", `(${esc(d.modulos)} módulos)`);

  const sobra = html.match(/\[(?:PLANO|plano|RG|e-mail|razão social|documento|endereço|nome do representante|CPF|telefone|nº)\]/);
  if (sobra) throw new Error(`Marcador ${sobra[0]} ficou sem preencher no Contrato de Parceria.`);
  return html.trim();
}
