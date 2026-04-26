"use client";

import { useMemo, useState, useEffect } from "react";
import { Sparkles, CheckCircle2, AlertCircle, XCircle, ChevronRight, Info, Loader2 } from "lucide-react";
import type { ProposalFull, ProposalMeta } from "./proposta-detail-modal";
import type { RegraDB } from "./editor-regras-linhas";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface RegraLinha {
  id: string;
  nome: string;
  nivel: "NIVEL_1" | "NIVEL_2" | "NIVEL_3";
  categoria: string;
  descricao: string;
  score: (ctx: AnaliseCtx) => number; // 0–100
  motivos: (ctx: AnaliseCtx) => string[];  // pontos positivos
  alertas: (ctx: AnaliseCtx) => string[];  // pontos de atenção
  restricoes: (ctx: AnaliseCtx) => string[]; // impeditivos
  cor: string;
  emoji: string;
}

interface AnaliseCtx {
  tipo: "PF" | "PJ";
  valor: number;
  renda: number;          // PF: renda mensal | PJ: faturamento mensal
  temImovel: boolean;
  valorImovel: number;
  finalidade: string;
  prazo: string;
  restricao: boolean;
  nivel: string;
  creditLine: string;
  temRecebíveis: boolean; // faturamento > 0 implica recebíveis
  faturamentoAnual: number;
}

// ─── Engine de Regras — Portfólio V3 Partners ────────────────────────────────

const LINHAS: RegraLinha[] = [

  // ══ NÍVEL 1 — Crédito Varejo ══════════════════════════════════════════════

  {
    id: "home_equity",
    nome: "Home Equity",
    nivel: "NIVEL_1",
    categoria: "Crédito com Garantia de Imóvel",
    descricao: "Crédito pessoal ou empresarial com garantia de imóvel residencial ou comercial. Taxas a partir de 0,89% a.m. Prazo até 240 meses.",
    cor: "#3B82F6",
    emoji: "🏠",
    score: (ctx) => {
      if (!ctx.temImovel) return 0;
      if (ctx.restricao) return 5;
      let s = 60;
      if (ctx.tipo === "PF") s += 20;
      if (ctx.valor <= ctx.valorImovel * 0.6) s += 15;
      if (ctx.valor >= 50_000 && ctx.valor <= 3_000_000) s += 5;
      if (ctx.renda > 0 && ctx.valor / ctx.renda <= 300) s += 10; // comprometimento ok
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.temImovel) m.push("Possui imóvel como garantia");
      if (ctx.tipo === "PF") m.push("Perfil PF — produto ideal");
      if (ctx.valor <= ctx.valorImovel * 0.6) m.push("Valor solicitado dentro do LTV de 60%");
      if (ctx.renda > 0) m.push("Renda informada para análise de comprometimento");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (ctx.valor > ctx.valorImovel * 0.6) a.push("Valor solicitado pode exceder o LTV máximo de 60%");
      if (!ctx.prazo) a.push("Prazo não informado — pode chegar a 240 meses");
      if (ctx.tipo === "PJ") a.push("Para PJ, exige alienação fiduciária do imóvel");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (!ctx.temImovel) r.push("Sem imóvel cadastrado como garantia");
      if (ctx.restricao) r.push("Restrições no CPF/CNPJ — impeditivo para esta linha");
      if (ctx.valor < 50_000) r.push("Valor mínimo: R$ 50.000");
      if (ctx.valor > 5_000_000) r.push("Valores acima de R$ 5M — direcionar para N3");
      return r;
    },
  },

  {
    id: "aval",
    nome: "Crédito com Aval",
    nivel: "NIVEL_1",
    categoria: "Crédito Pessoal Avalizado",
    descricao: "Crédito pessoal com aval de terceiro. Ideal para quem não possui garantia real. Análise de crédito tradicional.",
    cor: "#8B5CF6",
    emoji: "🤝",
    score: (ctx) => {
      if (ctx.tipo === "PJ") return 0;
      if (ctx.restricao) return 5;
      let s = 40;
      if (ctx.renda > 0) s += 20;
      if (ctx.valor >= 5_000 && ctx.valor <= 200_000) s += 20;
      if (!ctx.temImovel) s += 10; // sem imóvel → aval é boa opção
      if (ctx.renda > 0 && ctx.valor / ctx.renda <= 60) s += 10;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.tipo === "PF") m.push("Perfil PF — produto aplicável");
      if (!ctx.temImovel) m.push("Alternativa sem necessidade de imóvel");
      if (ctx.renda > 0 && ctx.valor / ctx.renda <= 60) m.push("Comprometimento de renda dentro do limite");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (ctx.valor > 200_000) a.push("Valores altos exigem aval de qualidade comprovável");
      if (!ctx.renda) a.push("Renda não informada — necessária para análise");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.tipo === "PJ") r.push("Produto exclusivo para Pessoa Física");
      if (ctx.restricao) r.push("Restrições no CPF — impeditivo");
      if (ctx.valor < 5_000) r.push("Valor mínimo: R$ 5.000");
      if (ctx.valor > 500_000) r.push("Valor máximo recomendado: R$ 500.000");
      return r;
    },
  },

  {
    id: "cdc",
    nome: "CDC — Crédito Direto ao Consumidor",
    nivel: "NIVEL_1",
    categoria: "Financiamento de Bens",
    descricao: "Financiamento de veículos, equipamentos e bens de consumo. O próprio bem financia como garantia.",
    cor: "#06B6D4",
    emoji: "🚗",
    score: (ctx) => {
      if (ctx.tipo === "PJ" && ctx.faturamentoAnual > 10_000_000) return 10;
      if (ctx.restricao) return 5;
      let s = 35;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("veículo") || fin.includes("veiculo") || fin.includes("equipamento") || fin.includes("máquina") || fin.includes("maquina")) s += 35;
      if (ctx.valor >= 10_000 && ctx.valor <= 500_000) s += 15;
      if (ctx.renda > 0) s += 10;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("veículo") || fin.includes("veiculo")) m.push("Finalidade de veículo — CDC ideal");
      if (fin.includes("equipamento") || fin.includes("máquina")) m.push("Finalidade de equipamento — CDC aplicável");
      if (ctx.valor <= 500_000) m.push("Valor dentro da faixa do produto");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (!ctx.finalidade) a.push("Finalidade não informada — necessária para CDC");
      if (ctx.valor > 500_000) a.push("Valor elevado — avaliar garantias adicionais");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.restricao) r.push("Restrições no CPF/CNPJ — impeditivo");
      if (ctx.valor < 10_000) r.push("Valor mínimo: R$ 10.000");
      return r;
    },
  },

  // ══ NÍVEL 2 — Crédito Estruturado ════════════════════════════════════════

  {
    id: "v3giro",
    nome: "V3Giro / Capital de Giro",
    nivel: "NIVEL_2",
    categoria: "Capital de Giro Estruturado",
    descricao: "Capital de giro estruturado para empresas com faturamento comprovado. Antecipação de recebíveis e CCB. Prazo 12–36 meses.",
    cor: "#F59E0B",
    emoji: "🔄",
    score: (ctx) => {
      if (ctx.tipo === "PF") return 5;
      if (ctx.restricao) return 5;
      let s = 40;
      if (ctx.faturamentoAnual >= 1_200_000) s += 25; // R$100K/mês
      if (ctx.faturamentoAnual >= 6_000_000) s += 15; // R$500K/mês
      if (ctx.valor >= 100_000 && ctx.valor <= 5_000_000) s += 15;
      if (ctx.temRecebíveis) s += 10;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("giro") || fin.includes("capital") || fin.includes("fluxo")) s += 10;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.tipo === "PJ") m.push("Perfil PJ — produto estruturado para empresas");
      if (ctx.faturamentoAnual >= 1_200_000) m.push(`Faturamento anual de ${_fmt(ctx.faturamentoAnual)} — elegível`);
      if (ctx.temRecebíveis) m.push("Empresa com recebíveis — base para estruturação");
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("giro")) m.push("Finalidade de capital de giro — produto ideal");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (ctx.faturamentoAnual < 1_200_000 && ctx.faturamentoAnual > 0) a.push("Faturamento abaixo do recomendado (R$100K/mês)");
      if (!ctx.faturamentoAnual) a.push("Faturamento mensal não informado — necessário");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.tipo === "PF") r.push("Produto exclusivo para Pessoa Jurídica");
      if (ctx.restricao) r.push("Restrições no CNPJ — impeditivo");
      if (ctx.valor < 100_000) r.push("Valor mínimo: R$ 100.000");
      return r;
    },
  },

  {
    id: "cgi",
    nome: "CGI — Crédito com Garantia de Imóvel PJ",
    nivel: "NIVEL_2",
    categoria: "Crédito Garantido Real — PJ",
    descricao: "Crédito empresarial com garantia de imóvel comercial ou industrial. Taxas competitivas. Até 60% do valor do imóvel.",
    cor: "#10B981",
    emoji: "🏢",
    score: (ctx) => {
      if (ctx.tipo === "PF") return 20; // PF também pode, mas menos ideal
      if (!ctx.temImovel) return 0;
      if (ctx.restricao) return 5;
      let s = 55;
      if (ctx.tipo === "PJ") s += 20;
      if (ctx.valor <= ctx.valorImovel * 0.6) s += 15;
      if (ctx.faturamentoAnual >= 600_000) s += 10;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.tipo === "PJ") m.push("Perfil PJ — CGI é o produto ideal");
      if (ctx.temImovel) m.push("Imóvel disponível como garantia");
      if (ctx.valor <= ctx.valorImovel * 0.6) m.push("Dentro do LTV máximo de 60%");
      if (ctx.faturamentoAnual >= 600_000) m.push(`Faturamento de ${_fmt(ctx.faturamentoAnual)} — elegível`);
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (ctx.valor > ctx.valorImovel * 0.6) a.push("Valor pode exceder LTV máximo de 60%");
      if (ctx.tipo === "PF") a.push("Para PF, Home Equity é mais indicado que CGI");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (!ctx.temImovel) r.push("Sem imóvel cadastrado como garantia");
      if (ctx.restricao) r.push("Restrições no CNPJ — impeditivo");
      if (ctx.valor < 200_000) r.push("Valor mínimo para CGI: R$ 200.000");
      return r;
    },
  },

  {
    id: "receivables",
    nome: "Receivables / Antecipação",
    nivel: "NIVEL_2",
    categoria: "Antecipação de Recebíveis",
    descricao: "Antecipação de recebíveis comerciais, NFs, duplicatas e contratos. Ideal para empresas com carteira de clientes pagadores.",
    cor: "#6366F1",
    emoji: "📄",
    score: (ctx) => {
      if (ctx.tipo === "PF") return 0;
      if (ctx.restricao) return 5;
      let s = 35;
      if (ctx.temRecebíveis) s += 30;
      if (ctx.faturamentoAnual >= 2_400_000) s += 20; // R$200K/mês
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("recebív") || fin.includes("antecip") || fin.includes("duplicata") || fin.includes("nota fiscal")) s += 15;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.temRecebíveis) m.push("Empresa com recebíveis — produto ideal");
      if (ctx.faturamentoAnual >= 2_400_000) m.push(`Faturamento de ${_fmt(ctx.faturamentoAnual)} — elegível`);
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("antecip") || fin.includes("recebív")) m.push("Finalidade de antecipação — match perfeito");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (ctx.faturamentoAnual < 2_400_000 && ctx.faturamentoAnual > 0) a.push("Faturamento abaixo do recomendado para esta linha");
      if (!ctx.temRecebíveis) a.push("Recebíveis não identificados — necessário comprovação");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.tipo === "PF") r.push("Produto exclusivo para Pessoa Jurídica");
      if (ctx.restricao) r.push("Restrições no CNPJ — impeditivo");
      return r;
    },
  },

  {
    id: "fidc",
    nome: "FIDC — Fundo de Investimento em Direitos Creditórios",
    nivel: "NIVEL_2",
    categoria: "Securitização de Crédito",
    descricao: "Estruturação de FIDC para empresas com carteira de recebíveis. Captação institucional via mercado de capitais.",
    cor: "#EC4899",
    emoji: "📊",
    score: (ctx) => {
      if (ctx.tipo === "PF") return 0;
      if (ctx.restricao) return 0;
      let s = 20;
      if (ctx.faturamentoAnual >= 12_000_000) s += 40; // R$1M/mês
      if (ctx.valor >= 2_000_000) s += 25;
      if (ctx.temRecebíveis) s += 15;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.faturamentoAnual >= 12_000_000) m.push(`Faturamento de ${_fmt(ctx.faturamentoAnual)} — elegível para FIDC`);
      if (ctx.valor >= 2_000_000) m.push("Volume compatível com estruturação de fundo");
      if (ctx.temRecebíveis) m.push("Carteira de recebíveis para cessão ao fundo");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (ctx.faturamentoAnual < 12_000_000) a.push("FIDC exige faturamento robusto (mín. R$1M/mês)");
      if (ctx.valor < 2_000_000) a.push("Volume baixo — FIDC tem custo de estruturação elevado");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.tipo === "PF") r.push("Produto exclusivo para Pessoa Jurídica");
      if (ctx.restricao) r.push("Restrições no CNPJ — impeditivo absoluto");
      if (ctx.valor < 1_000_000) r.push("Valor mínimo para FIDC: R$ 1.000.000");
      return r;
    },
  },

  // ══ NÍVEL 3 — High Ticket ═════════════════════════════════════════════════

  {
    id: "cri",
    nome: "CRI — Certificado de Recebíveis Imobiliários",
    nivel: "NIVEL_3",
    categoria: "Securitização Imobiliária",
    descricao: "Securitização de recebíveis imobiliários. Emissor: Bloxs S.A. (white label). Lastro em contratos de locação, compra e venda ou built-to-suit.",
    cor: "#F97316",
    emoji: "🏗️",
    score: (ctx) => {
      if (ctx.tipo === "PF") return 0;
      if (ctx.restricao) return 0;
      if (ctx.valor < 5_000_000) return 5;
      let s = 30;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("imov") || fin.includes("real estate") || fin.includes("built") || fin.includes("loteamento") || fin.includes("incorpora")) s += 40;
      if (ctx.temImovel) s += 15;
      if (ctx.valor >= 10_000_000) s += 15;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("imov") || fin.includes("real estate")) m.push("Finalidade imobiliária — CRI é o instrumento ideal");
      if (ctx.temImovel) m.push("Imóvel disponível como lastro");
      if (ctx.valor >= 10_000_000) m.push("Volume alto — CRI é eficiente acima de R$10M");
      m.push("Infraestrutura Bloxs S.A. disponível para emissão");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (ctx.valor < 10_000_000) a.push("CRI é mais eficiente acima de R$10M pelo custo de estruturação");
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (!fin.includes("imov") && !fin.includes("real estate")) a.push("Finalidade não claramente imobiliária — validar");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.tipo === "PF") r.push("CRI é emitido por pessoa jurídica (SPE/incorporadora)");
      if (ctx.restricao) r.push("Restrições — impeditivo absoluto");
      if (ctx.valor < 5_000_000) r.push("Valor mínimo N3: R$ 5.000.000");
      return r;
    },
  },

  {
    id: "cra",
    nome: "CRA — Certificado de Recebíveis do Agronegócio",
    nivel: "NIVEL_3",
    categoria: "Securitização do Agronegócio",
    descricao: "Securitização de recebíveis do agronegócio. Emissor: Bloxs S.A. Lastro em CPR, contratos de compra e venda agrícola.",
    cor: "#84CC16",
    emoji: "🌾",
    score: (ctx) => {
      if (ctx.tipo === "PF") return 0;
      if (ctx.restricao) return 0;
      if (ctx.valor < 5_000_000) return 5;
      let s = 25;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("agro") || fin.includes("rural") || fin.includes("soja") || fin.includes("milho") || fin.includes("cana") || fin.includes("pecuária") || fin.includes("fazenda")) s += 50;
      if (ctx.valor >= 10_000_000) s += 15;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("agro") || fin.includes("rural")) m.push("Finalidade do agronegócio — CRA é o instrumento ideal");
      if (ctx.valor >= 10_000_000) m.push("Volume adequado para CRA");
      m.push("Infraestrutura Bloxs S.A. disponível");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (!fin.includes("agro") && !fin.includes("rural")) a.push("Finalidade não identificada como agronegócio — validar");
      if (ctx.valor < 10_000_000) a.push("CRA é mais eficiente acima de R$10M");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.tipo === "PF") r.push("CRA é emitido por pessoa jurídica do agronegócio");
      if (ctx.restricao) r.push("Restrições — impeditivo absoluto");
      if (ctx.valor < 5_000_000) r.push("Valor mínimo N3: R$ 5.000.000");
      return r;
    },
  },

  {
    id: "project_finance",
    nome: "Project Finance",
    nivel: "NIVEL_3",
    categoria: "Financiamento Estruturado de Projetos",
    descricao: "Financiamento de grandes projetos de infraestrutura, energia, mineração e real estate. Estrutura off-balance com SPE. Fundos asiáticos e americanos.",
    cor: "#A855F7",
    emoji: "🏭",
    score: (ctx) => {
      if (ctx.tipo === "PF") return 0;
      if (ctx.restricao) return 0;
      if (ctx.valor < 5_000_000) return 5;
      let s = 30;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("infraestrutura") || fin.includes("energia") || fin.includes("mineração") || fin.includes("mineracao") || fin.includes("usina") || fin.includes("porto") || fin.includes("logística")) s += 45;
      if (ctx.valor >= 20_000_000) s += 20;
      if (ctx.valor >= 50_000_000) s += 5;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("infraestrutura") || fin.includes("energia")) m.push("Finalidade de infraestrutura — Project Finance ideal");
      if (fin.includes("mineração") || fin.includes("mineracao")) m.push("Projeto de mineração — vertical prioritária V3");
      if (ctx.valor >= 20_000_000) m.push("Volume adequado para estrutura de Project Finance");
      m.push("Acesso a fundos asiáticos e americanos via V3 Partners");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (ctx.valor < 20_000_000) a.push("Project Finance é mais eficiente acima de R$20M");
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (!fin) a.push("Finalidade do projeto não informada — essencial para análise");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.tipo === "PF") r.push("Project Finance exige SPE ou PJ estruturada");
      if (ctx.restricao) r.push("Restrições — impeditivo absoluto");
      if (ctx.valor < 5_000_000) r.push("Valor mínimo N3: R$ 5.000.000");
      return r;
    },
  },

  {
    id: "real_estate",
    nome: "Real Estate Estruturado",
    nivel: "NIVEL_3",
    categoria: "SLB · BTS · BTR",
    descricao: "Sale & Leaseback, Built-to-Suit e Built-to-Rent. Estruturas sofisticadas para ativos imobiliários de alto padrão. Tokenização via Bloxs.",
    cor: "#0EA5E9",
    emoji: "🏙️",
    score: (ctx) => {
      if (ctx.tipo === "PF") return 5;
      if (ctx.restricao) return 0;
      if (ctx.valor < 5_000_000) return 5;
      let s = 30;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("sale leaseback") || fin.includes("slb") || fin.includes("built") || fin.includes("bts") || fin.includes("btr")) s += 50;
      if (fin.includes("imov") || fin.includes("real estate") || fin.includes("galpão") || fin.includes("galp") || fin.includes("lajes")) s += 20;
      if (ctx.temImovel && ctx.valorImovel >= 5_000_000) s += 15;
      if (ctx.valor >= 15_000_000) s += 10;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("slb") || fin.includes("sale leaseback")) m.push("Sale & Leaseback identificado — produto ideal");
      if (fin.includes("built") || fin.includes("bts")) m.push("Built-to-Suit — estrutura disponível");
      if (ctx.temImovel && ctx.valorImovel >= 5_000_000) m.push(`Imóvel de alto valor (${_fmt(ctx.valorImovel)}) — elegível`);
      m.push("Tokenização via Bloxs S.A. disponível");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (!ctx.temImovel) a.push("Imóvel não cadastrado — necessário para SLB/BTS");
      if (ctx.valor < 15_000_000) a.push("Real Estate Estruturado é mais eficiente acima de R$15M");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.restricao) r.push("Restrições — impeditivo absoluto");
      if (ctx.valor < 5_000_000) r.push("Valor mínimo N3: R$ 5.000.000");
      return r;
    },
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _fmt(v: number) {
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}K`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

function buildCtx(proposal: ProposalFull): AnaliseCtx {
  const meta: ProposalMeta = proposal.metadata ?? {};
  const tipo = ((meta.client_type ?? "PF") as string).toUpperCase().includes("J") ? "PJ" : "PF";
  const renda = tipo === "PF"
    ? (typeof meta.renda_mensal === "number" ? meta.renda_mensal : 0)
    : (typeof meta.faturamento_mensal === "number" ? meta.faturamento_mensal : 0);
  const imoveis = Array.isArray(meta.imoveis) ? meta.imoveis : [];
  const temImovel = imoveis.length > 0 || !!proposal.imovel_endereco;
  const valorImovel = (imoveis.reduce((s: number, im: { valor_medio?: number }) => s + (im.valor_medio ?? 0), 0)
    || proposal.imovel_valor_medio) ?? 0;
  const restricao = (meta.restricao_cliente ?? "").toLowerCase().includes("sim");
  const finalidade = (meta.finalidade ?? proposal.finalidade ?? meta.observacoes ?? "") as string;

  return {
    tipo,
    valor: proposal.requested_value ?? 0,
    renda,
    temImovel,
    valorImovel,
    finalidade,
    prazo: (meta.prazo ?? proposal.prazo ?? "") as string,
    restricao,
    nivel: proposal.current_level,
    creditLine: proposal.credit_line,
    temRecebíveis: renda > 0 && tipo === "PJ",
    faturamentoAnual: tipo === "PJ" ? renda * 12 : 0,
  };
}

interface Resultado {
  linha: RegraLinha;
  score: number;
  motivos: string[];
  alertas: string[];
  restricoes: string[];
}

// ─── Merge DB params into LINHAS scoring ──────────────────────────────────────

function mergeDBParams(linhas: RegraLinha[], dbRules: RegraDB[]): RegraLinha[] {
  if (!dbRules || dbRules.length === 0) return linhas;
  return linhas.map(l => {
    const db = dbRules.find(r => r.id === l.id);
    if (!db) return l;
    return {
      ...l,
      nome: db.nome || l.nome,
      descricao: db.descricao || l.descricao,
      categoria: db.categoria || l.categoria,
      cor: db.cor || l.cor,
      emoji: db.emoji || l.emoji,
      // Override score with DB score_base as the new base value
      score: (ctx: AnaliseCtx) => {
        // Run original scoring to get multiplier/bonuses, then re-base
        const orig = l.score(ctx);
        if (orig === 0) return 0;
        // Scale: keep relative bonus but shift base to DB score_base
        const origBase = l.score({ ...ctx, temImovel: true, restricao: false, renda: 1, valor: db.valor_minimo || 10000, faturamentoAnual: (db.min_faturamento_mensal || 0) * 12, temRecebíveis: true });
        const bonus = Math.max(0, orig - (origBase > 0 ? origBase * 0.6 : 30));
        return Math.min(100, db.score_base + bonus);
      },
      restricoes: (ctx: AnaliseCtx) => {
        const orig = l.restricoes(ctx);
        const extra: string[] = [];
        if (db.requer_imovel && !ctx.temImovel) extra.push("Imóvel obrigatório para esta linha");
        if (db.bloqueia_restricao && ctx.restricao) extra.push("Restrições no CPF/CNPJ bloqueiam esta linha");
        if (db.valor_minimo > 0 && ctx.valor < db.valor_minimo) extra.push(`Valor mínimo: ${_fmt(db.valor_minimo)}`);
        if (db.valor_maximo && ctx.valor > db.valor_maximo) extra.push(`Valor máximo: ${_fmt(db.valor_maximo)}`);
        if (db.min_faturamento_mensal > 0 && ctx.faturamentoAnual / 12 < db.min_faturamento_mensal)
          extra.push(`Faturamento mínimo: ${_fmt(db.min_faturamento_mensal)}/mês`);
        // Merge, dedup
        const all = [...orig, ...extra];
        return [...new Set(all)];
      },
    };
  });
}

function analisar(proposal: ProposalFull, dbRules: RegraDB[] = []): Resultado[] {
  const ctx = buildCtx(proposal);
  const linhas = mergeDBParams(LINHAS, dbRules);
  return linhas
    .map(l => ({
      linha: l,
      score: l.score(ctx),
      motivos: l.motivos(ctx),
      alertas: l.alertas(ctx),
      restricoes: l.restricoes(ctx),
    }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface RecomendacaoLinhaProps {
  proposal: ProposalFull;
  rulesKey?: number; // increment to force refetch
}

export function RecomendacaoLinha({ proposal, rulesKey }: RecomendacaoLinhaProps) {
  const [dbRules, setDbRules] = useState<RegraDB[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);

  useEffect(() => {
    setLoadingRules(true);
    fetch("/api/regras-linhas")
      .then(r => r.json())
      .then(({ regras }) => setDbRules(regras ?? []))
      .catch(() => {/* use hardcoded fallback */})
      .finally(() => setLoadingRules(false));
  }, [rulesKey]);

  const resultados = useMemo(() => analisar(proposal, dbRules), [proposal, dbRules]);

  if (loadingRules) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-[#C9A84C]" />
      </div>
    );
  }

  if (resultados.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-secondary/30 border border-border text-center">
        <p className="text-xs text-muted-foreground">Dados insuficientes para análise de compatibilidade.</p>
      </div>
    );
  }

  const top = resultados[0];
  const alternativas = resultados.slice(1, 4).filter(r => r.score >= 20);
  const incompativeis = resultados.filter(r => r.score < 10 && r.restricoes.length > 0).slice(0, 3);

  const scoreColor = (s: number) => s >= 75 ? "#10B981" : s >= 50 ? "#C9A84C" : s >= 25 ? "#F97316" : "#EF4444";
  const scoreLabel = (s: number) => s >= 75 ? "Alta compatibilidade" : s >= 50 ? "Compatível" : s >= 25 ? "Compatibilidade parcial" : "Baixa compatibilidade";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Sparkles className="w-3.5 h-3.5 text-[#C9A84C]" />
        <p className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Análise de Compatibilidade — Portfólio V3 Partners</p>
      </div>

      {/* Recomendação principal */}
      <div className="p-4 rounded-xl border relative overflow-hidden"
        style={{ borderColor: `${top.linha.cor}40`, background: `${top.linha.cor}08` }}>
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-5 pointer-events-none"
          style={{ background: top.linha.cor, transform: "translate(40%, -40%)" }} />

        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{top.linha.emoji}</span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white">{top.linha.nome}</p>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: `${top.linha.cor}22`, color: top.linha.cor }}>
                  {top.linha.nivel.replace("_", " ")}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">{top.linha.categoria}</p>
            </div>
          </div>
          {/* Score circular */}
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="w-12 h-12 rounded-full flex items-center justify-center font-black text-sm border-2"
              style={{ borderColor: scoreColor(top.score), color: scoreColor(top.score), background: `${scoreColor(top.score)}15` }}>
              {top.score}%
            </div>
            <p className="text-[9px] text-center mt-1" style={{ color: scoreColor(top.score) }}>{scoreLabel(top.score)}</p>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{top.linha.descricao}</p>

        <div className="grid grid-cols-1 gap-2">
          {top.motivos.length > 0 && (
            <div className="space-y-1">
              {top.motivos.map((m, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="text-[11px] text-emerald-300">{m}</span>
                </div>
              ))}
            </div>
          )}
          {top.alertas.length > 0 && (
            <div className="space-y-1">
              {top.alertas.map((a, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <AlertCircle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span className="text-[11px] text-amber-300">{a}</span>
                </div>
              ))}
            </div>
          )}
          {top.restricoes.length > 0 && (
            <div className="space-y-1">
              {top.restricoes.map((r, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <XCircle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-[11px] text-red-300">{r}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alternativas */}
      {alternativas.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Linhas Alternativas</p>
          <div className="space-y-2">
            {alternativas.map(r => (
              <div key={r.linha.id} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary/30 transition-colors">
                <span className="text-base flex-shrink-0">{r.linha.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-white truncate">{r.linha.nome}</p>
                    <span className="text-[9px] px-1 py-0.5 rounded font-bold flex-shrink-0"
                      style={{ background: `${r.linha.cor}20`, color: r.linha.cor }}>
                      {r.linha.nivel.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{r.linha.categoria}</p>
                  {r.alertas[0] && (
                    <p className="text-[10px] text-amber-400 mt-0.5">⚠ {r.alertas[0]}</p>
                  )}
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="text-sm font-black" style={{ color: scoreColor(r.score) }}>{r.score}%</span>
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Incompatíveis */}
      {incompativeis.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Linhas Incompatíveis</p>
          <div className="flex flex-wrap gap-2">
            {incompativeis.map(r => (
              <div key={r.linha.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-500/20 bg-red-500/5"
                title={r.restricoes[0]}>
                <span className="text-xs opacity-50">{r.linha.emoji}</span>
                <span className="text-[10px] text-red-400 font-medium">{r.linha.nome}</span>
                <Info className="w-2.5 h-2.5 text-red-400/60 flex-shrink-0" title={r.restricoes[0]} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nota */}
      <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
        * Análise automática baseada nos dados cadastrados. Sujeita a validação pela mesa de crédito. Portfólio V3 Partners — CNPJ 14.219.287/0001-50.
      </p>
    </div>
  );
}
