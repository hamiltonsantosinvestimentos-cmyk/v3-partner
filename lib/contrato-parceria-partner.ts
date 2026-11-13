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

import { valorEmReaisPorExtenso } from "@/lib/utils/valor-extenso";
import { dateExtensoBR } from "@/lib/contract-adhesion";

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

// A anuidade impressa no item 3.1 vem da linha do plano no Anexo III da própria minuta aprovada
// (BRIEF 2026-11-10_contrato-parceria-anuidade-do-anexo-iii): o 3.1 nunca diverge do Anexo III.

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
/** "R$ 49.896,96" com espaço comum (o Intl usa espaço não separável). */
export function formatarBRL(v: number): string {
  return BRL.format(v).replace(/\s/g, " ");
}

// Gold/Diamante: mensalidade e comissão (item 3.2 da minuta deles), impressas no item 3.1.
const PLANO_MENSAL: Partial<Record<PlanoContratoParceria, { mensalidade: string; comissao: string }>> = {
  GOLD: { mensalidade: "R$ 397,00", comissao: "25%" },
  DIAMANTE: { mensalidade: "R$ 897,00", comissao: "40%" },
};

/** Mensalidade do Gold/Diamante (null nos planos de anuidade). */
export function mensalidadeDoPlano(plano: PlanoContratoParceria): string | null {
  return PLANO_MENSAL[plano]?.mensalidade ?? null;
}

/**
 * Texto do modal vermelho antes de "Gerar e enviar para assinatura"
 * (BRIEF 2026-11-10_modal-confirmacao-enviar-contrato). Nada vira "null".
 */
export function textoConfirmacaoEnvio(d: {
  plano: PlanoContratoParceria;
  templateName: string | null | undefined;
  anuidade: number | null;
  itemAcordo: string | null;
  dataPagamento: string;
  razaoSocial: string;
  email: string;
  /** Gold/Diamante que entrou pelo link pago (cadastro com fatura de adesão). */
  linkPago?: boolean;
  /** undefined = lista ainda não carregou; null = nenhum contrato ativo. */
  contratoAtivo: { codigo: string | null; status: string } | null | undefined;
}): string {
  const familia = familiaDoPlano(d.plano);
  const versao = versaoDaMinuta(d.templateName);
  const linhas = [
    "Isso gera o contrato e envia na hora para assinatura no ClickSign, sem volta. Para desfazer, só cancelando o contrato na Central de Contratos.",
    "",
    `Contrato: ${TITULO_CONTRATO[familia]}${versao ? ` ${versao}` : ""}`,
    `Plano: ${PLANO_LABEL[d.plano]}`,
  ];
  if (familia === "parceria") {
    const valor = d.anuidade != null ? `${formatarBRL(d.anuidade)} (Anexo III da minuta)` : "conforme o Anexo III da minuta";
    const acordo = d.plano === "ENTERPRISE" && d.itemAcordo ? `, ou o valor do acordo comercial (item ${d.itemAcordo})` : "";
    linhas.push(`Anuidade: ${valor}${acordo}`);
    linhas.push(`Data prevista de pagamento: ${dataBR(d.dataPagamento) ?? "não informada"}`);
    linhas.push(`Licenciado: ${d.razaoSocial.trim().toUpperCase()}`);
  } else {
    const m = mensalidadeDoPlano(d.plano);
    // Link pago (BRIEF 2026-11-13): a 1ª mensalidade foi cobrada na adesão, sem os 30 dias grátis.
    if (m) linhas.push(d.linkPago ? `Mensalidade: ${m} (1ª cobrada na adesão)` : `Mensalidade: ${m}, após 30 dias grátis`);
    linhas.push(`Contratante: ${d.razaoSocial.trim().toUpperCase()}`);
  }
  linhas.push(`Assinatura enviada para: ${d.email.trim()}`);
  if (d.contratoAtivo === undefined) {
    linhas.push("", "Não foi possível verificar contratos anteriores deste cadastro.");
  } else if (d.contratoAtivo) {
    linhas.push("", `Atenção: este cadastro já tem o contrato ${d.contratoAtivo.codigo ?? "sem código"} (${d.contratoAtivo.status}). Enviar de novo gera um segundo contrato.`);
  }
  return linhas.join("\n");
}

export type FamiliaContrato = "parceria" | "oferta";

export function familiaDoPlano(plano: PlanoContratoParceria): FamiliaContrato {
  return plano === "GOLD" || plano === "DIAMANTE" ? "oferta" : "parceria";
}

export const TITULO_CONTRATO: Record<FamiliaContrato, string> = {
  parceria: "Contrato de Parceria",
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

export type ParceriaTemplate = { id: string; template_name: string; approval_status?: string | null; version?: number | null; created_at?: string | null; body_text_raw?: string | null };

/** Versão lida do nome da minuta ("... v2.4" → "v2.4"), para o título do card. */
export function versaoDaMinuta(name: string | null | undefined): string | null {
  const m = (name ?? "").match(/\bv(\d+(?:\.\d+)*)\s*$/i);
  return m ? `v${m[1]}` : null;
}

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
  cora_invoice_id?: string | null;
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
  if (!dataBR(d.data_pagamento)) throw new Error("Data prevista de pagamento inválida.");
  const itemAcordo = itemAcordoEnterprise(html);
  const anuidade = anuidadeDoAnexoIII(html, plano);
  html = trocar(html, "Plano contratado: [plano]", textoItem31(plano, d.data_pagamento, itemAcordo, anuidade));
  html = trocarLicenciante(html);
  html = trocar(
    html,
    "[razão social], CNPJ/CPF nº [documento], com sede em [endereço], representado por [nome do representante], CPF nº [CPF], RG nº [RG], e-mail [e-mail], telefone [telefone].",
    `${esc(d.razao_social.toUpperCase())}, CNPJ/CPF nº ${esc(d.documento)}, com sede em ${esc(d.endereco)}, representado por ${esc(d.representante.toUpperCase())}, CPF nº ${esc(d.cpf)}, RG nº ${esc(d.rg)}, e-mail ${esc(d.email)}, telefone ${esc(d.telefone)}.`,
  );
  html = trocar(html, "([nº] módulos)", `(${esc(d.modulos)} módulos)`);

  return semMarcadores(html);
}

// ── Item 3.1 (BRIEF 2026-11-10_contrato-enterprise-item-3-1-acordo-comercial) ──

/**
 * Número do item "Condições do Plano Enterprise" (acordo comercial), lido da própria minuta.
 * null = a minuta não tem o item (v2.3): o 3.1 do Enterprise sai sem citar o acordo.
 */
export function itemAcordoEnterprise(html: string | null | undefined): string | null {
  const m = (html ?? "").match(/(\d+(?:\.\d+)+)\s*<(?:b|strong)>\s*Condições do Plano Enterprise/i);
  return m ? m[1] : null;
}

/** Texto do item 3.1 (sem o "3.1"), com valor e data também por extenso. dataIso = "yyyy-mm-dd". */
export function textoItem31(plano: PlanoContratoParceria, dataIso: string, itemAcordo: string | null, valor: number): string {
  const dataNum = dataBR(dataIso);
  if (!dataNum) throw new Error("Data prevista de pagamento inválida.");
  // Meio-dia UTC: dateExtensoBR formata em Brasília e meia-noite UTC recuaria um dia.
  const dataExt = dateExtensoBR(`${dataIso}T12:00:00Z`);
  const acordo = plano === "ENTERPRISE" && itemAcordo
    ? `, ou o valor e as condições de pagamento do acordo comercial firmado entre as partes por WhatsApp ou por e-mail (item ${itemAcordo})`
    : "";
  return `Plano contratado: ${esc(PLANO_LABEL[plano])}, anuidade de ${formatarBRL(valor)} (${valorEmReaisPorExtenso(valor)}) (Anexo III)${acordo}. Data prevista de pagamento: ${dataNum} (${dataExt}).`;
}

/** Valores em R$ de uma linha de tabela, em centavos, na ordem em que aparecem. Sem faixa. */
export function valoresBRLDaLinha(tr: string): number[] {
  return [...tr.matchAll(/R\$(?:\s|&nbsp;)*(\d{1,3}(?:\.\d{3})*,\d{2})/g)].map((m) => Number(m[1].replace(/\./g, "").replace(",", "")));
}

const ANUIDADE_MIN_CENT = 100_000;      // R$ 1.000,00
const ANUIDADE_MAX_CENT = 100_000_000;  // R$ 1.000.000,00

/**
 * Anuidade do plano lida da linha dele no Anexo III da minuta: (a), (b), (c) e Total Anual.
 * Para a geração (nada vai ao ClickSign) se a linha faltar, estiver incompleta, zerada,
 * fora da faixa ou com soma diferente do total.
 */
export function anuidadeDoAnexoIII(html: string, plano: PlanoContratoParceria): number {
  const label = PLANO_LABEL[plano];
  const linhas = html.match(/<tr>[\s\S]*?<\/tr>/gi) ?? [];
  const linha = linhas.find((tr) => {
    const primeira = tr.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
    return !!primeira && primeira[1].replace(/<[^>]+>/g, "").trim() === label;
  });
  if (!linha) throw new Error(`O Anexo III da minuta não tem a linha do plano ${label}; revise a minuta na Central.`);
  const v = valoresBRLDaLinha(linha);
  if (v.length < 4) throw new Error(`A linha do plano ${label} no Anexo III da minuta não tem os quatro valores (a), (b), (c) e Total; revise a minuta na Central.`);
  const [a, b, c, total] = v;
  const nomes = ["(a)", "(b)", "(c)"];
  [a, b, c].forEach((x, i) => {
    if (x <= 0) throw new Error(`No Anexo III da minuta, a parcela ${nomes[i]} do ${label} está zerada; revise a minuta na Central.`);
  });
  if (total < ANUIDADE_MIN_CENT || total > ANUIDADE_MAX_CENT) {
    throw new Error(`No Anexo III da minuta, o Total Anual do ${label} (${formatarBRL(total / 100)}) está fora da faixa aceita (de R$ 1.000,00 a R$ 1.000.000,00); revise a minuta na Central.`);
  }
  if (a + b + c !== total) {
    throw new Error(`No Anexo III da minuta, as parcelas (a), (b) e (c) do ${label} somam ${formatarBRL((a + b + c) / 100)}, diferente do Total Anual ${formatarBRL(total / 100)}; revise a minuta na Central.`);
  }
  return total / 100;
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
