// Corpo do POST /api/v1/propostas: validação (Zod) e conversão para o mesmo formato que o
// modal "Nova proposta" grava (metadata), além do PLD e das declarações (Termo v2.1, 4.8 e 7.4).
import { z } from "zod";
import { isValidCPF, isValidCNPJ, formatCPF, formatCNPJ } from "@/lib/validators/cpf-cnpj";
import { LEVEL_LINES } from "@/lib/credit-checklists";
import { garantiaPelasZonas } from "@/lib/checklist-imovel";
import type { NivelCredito } from "@/lib/credit-proposal-create";

export const TETO = {
  valor: 5_000_000_000,
  renda: 10_000_000,
  faturamento: 1_000_000_000,
} as const;

export const ESTADO_CIVIL: Record<string, string> = {
  SOLTEIRO: "Solteiro(a)",
  CASADO: "Casado(a)",
  DIVORCIADO: "Divorciado(a)",
  VIUVO: "Viúvo(a)",
  UNIAO_ESTAVEL: "União Estável",
};

/** Remove pontuação sem apagar letras (CNPJ alfanumérico) e passa para maiúsculas. */
export function normalizarDocumento(v: string): string {
  return v.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

export function nivelDaLinha(linha: string): NivelCredito | null {
  for (const nivel of ["NIVEL_1", "NIVEL_2", "NIVEL_3"] as const) {
    if ((LEVEL_LINES[nivel] ?? []).includes(linha)) return nivel;
  }
  return null;
}

/** Data de calendário AAAA-MM-DD válida, comparada como texto (sem new Date() em data pura). */
export function dataValida(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [a, m, d] = s.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  const diasNoMes = [31, (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return d <= diasNoMes;
}

/** Hoje em Brasília, AAAA-MM-DD. */
export function hojeBrasilia(agora = Date.now()): string {
  return new Date(agora - 3 * 3600_000).toISOString().slice(0, 10);
}

function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

const dinheiro = (teto: number) =>
  z.number({ message: "Informe um número, sem texto formatado." })
    .gt(0, "Precisa ser maior que zero.")
    .max(teto, `Acima do teto de ${teto.toLocaleString("pt-BR")}.`)
    .refine((v) => Math.round(v * 100) === Number((v * 100).toFixed(6)), "Use no máximo 2 casas decimais.");

const texto = (max: number) => z.string().trim().min(1).max(max);
const uf = z.string().trim().regex(/^[A-Za-z]{2}$/, "Use a sigla da UF com 2 letras.").transform((s) => s.toUpperCase());
const cep = z.string().trim().regex(/^\d{5}-?\d{3}$/, "CEP no formato 00000-000.").transform((s) => `${s.replace(/\D/g, "").slice(0, 5)}-${s.replace(/\D/g, "").slice(5)}`);

const endereco = z.object({
  cep: cep.optional(),
  logradouro: texto(200).optional(),
  cidade: texto(100).optional(),
  uf: uf.optional(),
}).strict();

const imovel = z.object({
  cep: cep.optional(),
  endereco: texto(250).optional(),
  cidade: texto(100).optional(),
  uf: uf.optional(),
  zona: z.enum(["URBANO", "RURAL"]).optional(),
  padrao: texto(60).optional(),
  valor_estimado: dinheiro(TETO.valor).optional(),
  proprietario: texto(200).optional(),
}).strict();

export const propostaSchema = z.object({
  referencia_externa: z.string().trim().min(1).max(80).regex(/^[\w.\-/:#]+$/, "Use letras, números e . - _ / : #").optional(),
  cliente: z.object({
    tipo: z.enum(["PF", "PJ"]),
    nome: texto(200).optional(),
    razao_social: texto(200).optional(),
    nome_fantasia: texto(200).optional(),
    socio_responsavel: texto(200).optional(),
    cpf_cnpj: z.string().trim().min(11).max(20),
    email: z.string().trim().email("E-mail inválido.").max(200),
    telefone: z.string().trim().regex(/^\+[1-9]\d{9,14}$/, "Use o formato E.164: +, DDI, DDD e número, sem espaços."),
    rg: texto(40).optional(),
    nascimento: z.string().optional(),
    estado_civil: z.enum(["SOLTEIRO", "CASADO", "DIVORCIADO", "VIUVO", "UNIAO_ESTAVEL"]).optional(),
    renda_mensal: dinheiro(TETO.renda).optional(),
    faturamento_mensal: dinheiro(TETO.faturamento).optional(),
    endereco: endereco.optional(),
  }).strict(),
  operacao: z.object({
    linha: z.string().trim().min(1),
    valor_solicitado: dinheiro(TETO.valor),
    prazo_meses: z.number().int().min(1).max(480).optional(),
    finalidade: texto(2000).optional(),
    restricao: z.enum(["SIM", "NAO"]).optional(),
    observacoes: texto(2000).optional(),
  }).strict(),
  imoveis: z.array(imovel).max(10).optional(),
  declaracoes: z.object({
    autorizacao_consultas: z.object({
      obtida: z.literal(true, { message: "A autorização para consultas de crédito é obrigatória (Termo de Uso, cláusula 4.8)." }),
      data: z.string(),
    }).strict(),
  }).strict(),
  pld: z.object({
    pep: z.enum(["SIM", "NAO", "NAO_SEI"]).optional(),
    beneficiario_final: z.object({ nome: texto(200), cpf: z.string().trim() }).strict().nullable().optional(),
    circunstancia_atipica: texto(2000).nullable().optional(),
  }).strict().optional(),
}).strict();

export type PropostaApi = z.infer<typeof propostaSchema>;

export type PropostaConvertida = {
  nivel: NivelCredito;
  linha: string;
  clientName: string;
  documento: string;
  metadata: Record<string, unknown>;
  pld: { pep: string | null; beneficiario_final: { nome: string; cpf: string } | null; circunstancia_atipica: string | null } | null;
};

/**
 * Regras que o Zod sozinho não cobre. Devolve os campos com erro (vazio = ok) ou o código
 * especial de documento estrangeiro.
 */
export function validarRegras(p: PropostaApi, agora = Date.now()): { campos: Record<string, string>; estrangeiro: boolean } {
  const campos: Record<string, string> = {};
  const c = p.cliente;
  const doc = normalizarDocumento(c.cpf_cnpj);
  // Documento que não tem o tamanho de CPF (11) nem de CNPJ (14) é tratado como estrangeiro.
  const estrangeiro = doc.length !== 11 && doc.length !== 14;

  if (c.tipo === "PF") {
    if (!c.nome) campos["cliente.nome"] = "Obrigatório para PF.";
    if (!/^\d{11}$/.test(doc)) campos["cliente.cpf_cnpj"] = "PF exige CPF com 11 dígitos.";
    else if (!isValidCPF(doc)) campos["cliente.cpf_cnpj"] = "CPF inválido.";
  } else {
    if (!c.razao_social) campos["cliente.razao_social"] = "Obrigatório para PJ.";
    if (doc.length !== 14) campos["cliente.cpf_cnpj"] = "PJ exige CNPJ com 14 caracteres.";
    else if (!isValidCNPJ(doc)) campos["cliente.cpf_cnpj"] = "CNPJ inválido.";
  }

  if (c.nascimento !== undefined) {
    if (!dataValida(c.nascimento)) campos["cliente.nascimento"] = "Data no formato AAAA-MM-DD.";
    else {
      const hoje = hojeBrasilia(agora);
      const [a] = hoje.split("-").map(Number);
      const maisVelho = `${a - 120}${hoje.slice(4)}`, maisNovo = `${a - 18}${hoje.slice(4)}`;
      if (c.nascimento > maisNovo || c.nascimento < maisVelho) campos["cliente.nascimento"] = "Idade precisa estar entre 18 e 120 anos.";
    }
  }

  const nivel = nivelDaLinha(p.operacao.linha);
  if (!nivel) campos["operacao.linha"] = "Linha não encontrada. Use o nome exato devolvido por GET /linhas.";

  const aut = p.declaracoes.autorizacao_consultas.data;
  if (!dataValida(aut)) campos["declaracoes.autorizacao_consultas.data"] = "Data no formato AAAA-MM-DD.";
  else {
    const hoje = hojeBrasilia(agora);
    if (aut > hoje) campos["declaracoes.autorizacao_consultas.data"] = "Não pode ser uma data futura.";
    else if (aut < somarDias(hoje, -180)) campos["declaracoes.autorizacao_consultas.data"] = "Autorização com mais de 180 dias. Colha uma nova.";
  }

  const bf = p.pld?.beneficiario_final;
  if (bf) {
    const cpf = normalizarDocumento(bf.cpf);
    if (cpf.length !== 11 || !isValidCPF(cpf)) campos["pld.beneficiario_final.cpf"] = "CPF inválido.";
    if (c.tipo !== "PJ") campos["pld.beneficiario_final"] = "Beneficiário final só se aplica a cliente PJ.";
  }

  return { campos, estrangeiro };
}

/** Converte para o formato do modal. Só chamar depois de validarRegras sem erros. */
export function converterProposta(p: PropostaApi, agoraIso = new Date().toISOString()): PropostaConvertida {
  const c = p.cliente, o = p.operacao;
  const doc = normalizarDocumento(c.cpf_cnpj);
  const documento = c.tipo === "PF" ? formatCPF(doc) : formatCNPJ(doc);
  const clientName = (c.tipo === "PF" ? c.nome : c.razao_social) ?? "";
  const imoveis = (p.imoveis ?? []).map((im) => ({
    endereco: im.endereco, cep: im.cep, valor_medio: im.valor_estimado,
    cidade: im.cidade, estado: im.uf, zona: im.zona, padrao: im.padrao,
    proprietario: im.proprietario,
  }));

  const metadata: Record<string, unknown> = {
    client_type: c.tipo,
    email: c.email.toLowerCase(),
    telefone: c.telefone,
    prazo: o.prazo_meses ? `${o.prazo_meses} meses` : undefined,
    finalidade: o.finalidade,
    restricao_cliente: o.restricao,
    imoveis,
    imovel_garantia: imoveis.length ? garantiaPelasZonas(imoveis.map((i) => i.zona)) : "nao",
    observacoes: o.observacoes,
    rg: c.rg,
    nascimento: c.nascimento,
    estado_civil: c.estado_civil ? ESTADO_CIVIL[c.estado_civil] : undefined,
    renda_mensal: c.renda_mensal,
    razao_social: c.razao_social,
    nome_fantasia: c.nome_fantasia,
    socio_responsavel: c.socio_responsavel,
    faturamento_mensal: c.faturamento_mensal,
    endereco_rua: c.endereco?.logradouro,
    endereco_cidade: c.endereco?.cidade,
    endereco_uf: c.endereco?.uf,
    endereco_cep: c.endereco?.cep,
    origem_api: true,
    referencia_externa: p.referencia_externa,
    api_declaracoes: {
      autorizacao_consultas: { obtida: true, data: p.declaracoes.autorizacao_consultas.data, declarada_em: agoraIso },
    },
  };
  for (const k of Object.keys(metadata)) if (metadata[k] === undefined) delete metadata[k];

  const pld = p.pld
    ? {
        pep: p.pld.pep ?? null,
        beneficiario_final: p.pld.beneficiario_final
          ? { nome: p.pld.beneficiario_final.nome, cpf: formatCPF(normalizarDocumento(p.pld.beneficiario_final.cpf)) }
          : null,
        circunstancia_atipica: p.pld.circunstancia_atipica ?? null,
      }
    : null;

  return { nivel: nivelDaLinha(o.linha)!, linha: o.linha, clientName, documento, metadata, pld };
}

/** Converte os erros do Zod para { "cliente.cpf_cnpj": "mensagem" }. */
export function camposDoZod(err: z.ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path.join(".") || "corpo";
    if (!campos[k]) campos[k] = i.code === "unrecognized_keys" ? `Campo não reconhecido: ${(i as { keys?: string[] }).keys?.join(", ")}` : i.message;
  }
  return campos;
}
