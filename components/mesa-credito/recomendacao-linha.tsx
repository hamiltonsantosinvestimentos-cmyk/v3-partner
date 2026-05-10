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
  score: (ctx: AnaliseCtx) => number;
  motivos: (ctx: AnaliseCtx) => string[];
  alertas: (ctx: AnaliseCtx) => string[];
  restricoes: (ctx: AnaliseCtx) => string[];
  cor: string;
  emoji: string;
}

interface AnaliseCtx {
  tipo: "PF" | "PJ";
  valor: number;
  renda: number;           // PF: renda mensal | PJ: faturamento mensal
  temImovel: boolean;
  valorImovel: number;
  finalidade: string;
  prazo: string;
  restricao: boolean;
  nivel: string;
  creditLine: string;
  temRecebiveis: boolean;
  faturamentoAnual: number;
  temFrota: boolean;
  ehConstrutora: boolean;
  ehAgronegocio: boolean;
  ehExportador: boolean;
  ehImportador: boolean;
  ehInternacional: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _fmt(v: number) {
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}K`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

function ltv(ctx: AnaliseCtx) {
  return ctx.valorImovel > 0 ? ctx.valor / ctx.valorImovel : 99;
}

function kw(ctx: AnaliseCtx, ...words: string[]) {
  const f = ctx.finalidade?.toLowerCase() ?? "";
  return words.some(w => f.includes(w));
}

// ─── Portfólio V3 Partners 2026 — Linhas de Crédito ──────────────────────────

const LINHAS: RegraLinha[] = [

  // ══ NÍVEL 1 — Varejo ══════════════════════════════════════════════════════

  {
    id: "v3equity",
    nome: "V3Equity",
    nivel: "NIVEL_1",
    categoria: "Crédito com Garantia Imobiliária",
    descricao: "Linha autoral V3. Sem consulta ao BACEN. Sem endividamento adicional. Taxa a partir de 0,45% a.m. + INPC. Prazo até 220 meses. Retorno de 3–5% do Fundo de Reserva ao final.",
    cor: "#3B82F6",
    emoji: "🏠",
    score: (ctx) => {
      if (!ctx.temImovel) return 0;
      let s = 55;
      if (!ctx.restricao) s += 20;
      else s += 10; // aceita restrição (sem consulta BACEN)
      if (ctx.valor >= 300_000 && ctx.valor <= 10_000_000) s += 15;
      if (ltv(ctx) <= 0.60) s += 10;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.temImovel) m.push("Imóvel disponível como garantia — V3Equity aplicável");
      if (ctx.restricao) m.push("Aceita restrições (sem consulta ao BACEN)");
      if (ltv(ctx) <= 0.60) m.push("LTV dentro do limite de 60%");
      if (ctx.valor >= 300_000) m.push(`Valor ${_fmt(ctx.valor)} dentro da faixa R$300K–R$10M`);
      m.push("Sem endividamento adicional · Retorno do Fundo de Reserva");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (ltv(ctx) > 0.60 && ctx.valorImovel > 0) a.push(`LTV atual ${(ltv(ctx) * 100).toFixed(0)}% — limite: 60%`);
      if (ctx.valor < 300_000) a.push("Valor abaixo do mínimo recomendado: R$300K");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (!ctx.temImovel) r.push("Requer imóvel urbano ou rural quitado como garantia");
      if (ctx.valor > 10_000_000) r.push("Valor acima do teto da linha: R$10M");
      return r;
    },
  },

  {
    id: "home_equity",
    nome: "Home Equity",
    nivel: "NIVEL_1",
    categoria: "Crédito com Garantia Imobiliária",
    descricao: "Elegibilidade ágil. Aceita empresas em recuperação judicial. CET 0,7–0,9% a.m. + IPCA. Prazo 60 a 240 meses. LTV 30–50%. Aporte R$80K a R$10M.",
    cor: "#60A5FA",
    emoji: "🏡",
    score: (ctx) => {
      if (!ctx.temImovel) return 0;
      if (ctx.restricao) return 5;
      let s = 60;
      if (ctx.valor >= 80_000 && ctx.valor <= 10_000_000) s += 15;
      if (ltv(ctx) <= 0.50) s += 15;
      if (ctx.renda > 0 && ctx.valor / ctx.renda <= 300) s += 10;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.temImovel) m.push("Imóvel disponível como garantia");
      if (ltv(ctx) <= 0.50) m.push("LTV dentro do limite de 50%");
      if (ctx.renda > 0) m.push("Renda disponível para análise de comprometimento");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (ltv(ctx) > 0.50 && ctx.valorImovel > 0) a.push(`LTV atual ${(ltv(ctx) * 100).toFixed(0)}% — limite: 50%`);
      if (!ctx.prazo) a.push("Prazo não informado — pode chegar a 240 meses");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (!ctx.temImovel) r.push("Requer imóvel como garantia");
      if (ctx.restricao) r.push("Restrições no CPF/CNPJ — impeditivo (use Distressed)");
      if (ctx.valor < 80_000) r.push("Valor mínimo: R$80K");
      return r;
    },
  },

  {
    id: "distressed",
    nome: "Home Equity Distressed",
    nivel: "NIVEL_1",
    categoria: "Crédito com Garantia Imobiliária — Restrições",
    descricao: "Para clientes com restrições. Não analisa capacidade de pagamento. Taxa 2,99% a.m. LTV 30–50%. Prazo 24 a 48 meses + 24 de prorrogação.",
    cor: "#F97316",
    emoji: "🔓",
    score: (ctx) => {
      if (!ctx.temImovel) return 0;
      let s = 30;
      if (ctx.restricao) s += 40; // score AUMENTA com restrição — produto específico
      if (ctx.valor >= 80_000 && ctx.valor <= 10_000_000) s += 15;
      if (ltv(ctx) <= 0.50) s += 15;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.restricao) m.push("Restrições identificadas — Distressed é o produto indicado");
      if (ctx.temImovel) m.push("Imóvel disponível como garantia");
      if (ltv(ctx) <= 0.50) m.push("LTV adequado: até 50%");
      m.push("Não analisa capacidade de pagamento — análise personalizada");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (!ctx.restricao) a.push("Produto voltado para clientes com restrições — Home Equity pode ser mais vantajoso");
      a.push("Taxa de 2,99% a.m. — custo elevado, validar capacidade de quitação");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (!ctx.temImovel) r.push("Requer imóvel como garantia");
      if (ctx.valor < 80_000) r.push("Valor mínimo: R$80K");
      if (ctx.valor > 10_000_000) r.push("Valor acima do teto: R$10M");
      return r;
    },
  },

  {
    id: "giro_auto",
    nome: "Giro Auto",
    nivel: "NIVEL_1",
    categoria: "Crédito com Garantia Veicular",
    descricao: "Capital de giro com frota como garantia. Sem consulta ao BACEN. CET 1,0–1,45% a.m. + IPCA. Prazo 40–80 meses. R$200K–R$10M.",
    cor: "#06B6D4",
    emoji: "🚛",
    score: (ctx) => {
      if (ctx.restricao) return 5;
      let s = 30;
      if (ctx.temFrota) s += 40;
      if (ctx.valor >= 200_000 && ctx.valor <= 10_000_000) s += 20;
      if (ctx.tipo === "PJ") s += 10;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.temFrota) m.push("Frota identificada — Giro Auto é o produto ideal");
      if (ctx.tipo === "PJ") m.push("Perfil PJ — produto estruturado para empresas com frota");
      if (ctx.valor >= 200_000) m.push(`Valor ${_fmt(ctx.valor)} dentro da faixa`);
      m.push("Sem consulta ao BACEN · Retorno do Fundo de Reserva");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (!ctx.temFrota) a.push("Frota de veículos não identificada na proposta");
      if (ctx.valor < 200_000) a.push("Valor abaixo do mínimo: R$200K");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.restricao) r.push("Restrições no CPF/CNPJ — impeditivo");
      if (ctx.valor > 10_000_000) r.push("Valor acima do teto: R$10M");
      return r;
    },
  },

  {
    id: "v3auto",
    nome: "V3Auto",
    nivel: "NIVEL_1",
    categoria: "Crédito com Garantia Veicular — Pesados",
    descricao: "Processo 100% digital. Scania, Iveco, Volvo, VW, Mercedes, Fachini. Taxa a partir de 1,7% a.m. Prazo até 60 meses. R$50K–R$5M.",
    cor: "#0891B2",
    emoji: "🚚",
    score: (ctx) => {
      if (ctx.restricao) return 5;
      let s = 25;
      if (ctx.temFrota) s += 30;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("pesado") || fin.includes("scania") || fin.includes("volvo") || fin.includes("iveco") || fin.includes("mercedes") || fin.includes("carreta") || fin.includes("caminhão") || fin.includes("caminhao") || fin.includes("truck")) s += 30;
      if (ctx.valor >= 50_000 && ctx.valor <= 5_000_000) s += 15;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.temFrota) m.push("Frota de veículos identificada");
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("pesado") || fin.includes("carreta") || fin.includes("caminhao") || fin.includes("caminhão")) m.push("Veículos pesados — V3Auto ideal");
      m.push("100% digital · Sem TAC · Uso mantido durante o contrato");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (!ctx.temFrota) a.push("Veículos pesados não identificados na proposta");
      if (ctx.valor < 50_000) a.push("Valor abaixo do mínimo: R$50K");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.restricao) r.push("Restrições no CPF/CNPJ — impeditivo");
      if (ctx.valor > 5_000_000) r.push("Valor acima do teto: R$5M (use Giro Auto para volumes maiores)");
      return r;
    },
  },

  {
    id: "credito_aval",
    nome: "Crédito no Aval",
    nivel: "NIVEL_1",
    categoria: "Crédito Empresarial sem Garantia Real",
    descricao: "Sem garantia real. Aprovação por rating e histórico financeiro. Taxa 2–3,5% a.m. Prazo 6–60 meses. Até R$500K. 100% digital.",
    cor: "#8B5CF6",
    emoji: "🤝",
    score: (ctx) => {
      if (ctx.tipo !== "PJ") return 0;
      if (ctx.restricao) return 5;
      let s = 35;
      if (ctx.faturamentoAnual >= 240_000 && ctx.faturamentoAnual <= 12_000_000) s += 30;
      if (ctx.valor >= 10_000 && ctx.valor <= 500_000) s += 25;
      if (!ctx.temImovel) s += 10; // sem imóvel → aval é boa opção
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.tipo === "PJ") m.push("Perfil PJ — produto aplicável sem garantia real");
      if (ctx.faturamentoAnual >= 240_000) m.push(`Faturamento ${_fmt(ctx.faturamentoAnual)}/ano — elegível`);
      if (!ctx.temImovel) m.push("Sem imóvel cadastrado — Crédito no Aval é alternativa sólida");
      m.push("Aprovação rápida · 100% digital · Sem avalistas físicos");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (ctx.faturamentoAnual > 12_000_000) a.push("Faturamento alto — avaliar CGI ou Cash Collateral com menor taxa");
      if (ctx.valor > 500_000) a.push("Valor acima do teto: R$500K");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.tipo !== "PJ") r.push("Produto exclusivo para Pessoa Jurídica");
      if (ctx.restricao) r.push("Restrições no CNPJ — impeditivo");
      if (ctx.faturamentoAnual < 240_000) r.push("Faturamento mínimo: R$240K/ano (R$20K/mês)");
      if (ctx.valor > 500_000) r.push("Valor máximo: R$500K");
      return r;
    },
  },

  {
    id: "fin_imobiliario",
    nome: "Financiamento Imobiliário",
    nivel: "NIVEL_1",
    categoria: "Financiamento para Aquisição de Imóvel",
    descricao: "Residencial e comercial. ITBI e cartório incluídos no financiamento. Taxa a partir de 1,50% a.m. + IPCA. LTV até 60%. Prazo 168–240 meses.",
    cor: "#10B981",
    emoji: "🏘️",
    score: (ctx) => {
      if (ctx.tipo !== "PF") return 10;
      if (ctx.restricao) return 5;
      let s = 40;
      if (ctx.renda >= 4_000) s += 20;
      if (ctx.valor >= 300_000) s += 15;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("compra") || fin.includes("aquisi") || fin.includes("imovel") || fin.includes("casa") || fin.includes("apartamento") || fin.includes("apart")) s += 20;
      if (ltv(ctx) <= 0.60 && ctx.valorImovel > 0) s += 5;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.tipo === "PF") m.push("Perfil PF — produto ideal para aquisição");
      if (ctx.renda >= 4_000) m.push(`Renda ${_fmt(ctx.renda)}/mês acima do mínimo exigido`);
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("compra") || fin.includes("aquisi")) m.push("Finalidade de aquisição — match perfeito");
      m.push("ITBI e cartório incluídos no financiamento");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (ctx.tipo !== "PF") a.push("Para PJ, avaliar CGI ou CRI Cash Collateral");
      if (ctx.renda < 4_000 && ctx.renda > 0) a.push("Renda abaixo do mínimo exigido: R$4.000/mês");
      if (ltv(ctx) > 0.60 && ctx.valorImovel > 0) a.push(`LTV ${(ltv(ctx) * 100).toFixed(0)}% acima do limite de 60%`);
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.restricao) r.push("Restrições no CPF — impeditivo (avaliar repasse automático)");
      if (ctx.renda < 4_000 && ctx.renda > 0) r.push("Renda mínima: R$4.000/mês");
      return r;
    },
  },

  {
    id: "capital_maquinarios",
    nome: "Capital Maquinários",
    nivel: "NIVEL_1",
    categoria: "Crédito com Garantia de Maquinário — Agro",
    descricao: "Refinanciamento de máquinas usadas. Linha amarela, carretas e caminhões. Taxa 1,1% a.m. + IPCA. Prazo até 60 meses + 1 ano carência. R$25K–R$10M.",
    cor: "#D97706",
    emoji: "🚜",
    score: (ctx) => {
      if (ctx.restricao) return 5;
      let s = 20;
      if (ctx.ehAgronegocio) s += 40;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("maqui") || fin.includes("equipamento") || fin.includes("trator") || fin.includes("colheitadeira") || fin.includes("implemento") || fin.includes("linha amarela")) s += 30;
      if (ctx.valor >= 25_000 && ctx.valor <= 10_000_000) s += 10;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.ehAgronegocio) m.push("Setor agro identificado — Capital Maquinários ideal");
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("maqui") || fin.includes("trator")) m.push("Maquinário agrícola — produto específico disponível");
      m.push("Pesados 0km com 10% de entrada · Carência de 1 ano");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (!ctx.ehAgronegocio) a.push("Setor não identificado como agronegócio — validar elegibilidade");
      if (ctx.valor < 25_000) a.push("Valor abaixo do mínimo: R$25K");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.restricao) r.push("Restrições — impeditivo para esta linha");
      if (ctx.valor > 10_000_000) r.push("Valor acima do teto: R$10M");
      return r;
    },
  },

  // ══ NÍVEL 2 — Estruturado ═════════════════════════════════════════════════

  {
    id: "homecash",
    nome: "HomeCash",
    nivel: "NIVEL_2",
    categoria: "Crédito com Garantia Imobiliária — Fundo Compra",
    descricao: "O fundo compra o imóvel. Contratos de compra, posse e recompra garantida. Taxa 0,5% a.m. Prazo 18 meses. LTV até 60%. Liquidez imediata sem perder o uso do ativo.",
    cor: "#F59E0B",
    emoji: "💰",
    score: (ctx) => {
      if (ctx.restricao && ctx.tipo !== "PJ") return 5;
      if (!ctx.temImovel) return 0;
      let s = 40;
      if (ctx.tipo === "PJ") s += 20;
      if (ctx.valor >= 400_000) s += 20;
      if (ltv(ctx) <= 0.60) s += 20;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("liquidez") || fin.includes("capital") || fin.includes("giro")) s += 5;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.temImovel) m.push("Imóvel disponível — fundo pode adquirir como garantia");
      if (ctx.tipo === "PJ") m.push("Perfil empresarial — HomeCash ideal para liquidez rápida");
      if (ltv(ctx) <= 0.60) m.push("LTV dentro do limite de 60%");
      m.push("Liquidez imediata · Cliente mantém uso do imóvel");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      a.push("Custo final 20–30% do valor captado — avaliar custo benefício");
      if (ltv(ctx) > 0.60 && ctx.valorImovel > 0) a.push(`LTV ${(ltv(ctx) * 100).toFixed(0)}% acima do limite de 60%`);
      if (ctx.valor < 400_000) a.push("Aporte mínimo: R$400K");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (!ctx.temImovel) r.push("Requer imóvel como garantia para o fundo adquirir");
      if (ctx.valor < 400_000) r.push("Aporte mínimo: R$400K");
      return r;
    },
  },

  {
    id: "cgi_pj",
    nome: "CGI — Grandes Empresas",
    nivel: "NIVEL_2",
    categoria: "Crédito com Garantia Imobiliária — PJ Grande Porte",
    descricao: "Empresas de maior porte. Utilização gradual do limite em até 5 anos. Faturamento a partir de R$30M/ano. Taxa a partir de 1,15% a.m. + IPCA. R$30K–R$10M.",
    cor: "#10B981",
    emoji: "🏢",
    score: (ctx) => {
      if (ctx.tipo !== "PJ") return 5;
      if (!ctx.temImovel) return 0;
      if (ctx.restricao) return 5;
      let s = 40;
      if (ctx.faturamentoAnual >= 30_000_000) s += 35;
      else if (ctx.faturamentoAnual >= 10_000_000) s += 15;
      if (ltv(ctx) <= 0.60) s += 15;
      if (ctx.valor >= 1_000_000) s += 10;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.tipo === "PJ") m.push("Perfil PJ — produto ideal para grandes empresas");
      if (ctx.faturamentoAnual >= 30_000_000) m.push(`Faturamento ${_fmt(ctx.faturamentoAnual)}/ano — plenamente elegível`);
      if (ctx.temImovel) m.push("Imóvel disponível como garantia");
      m.push("Aceita Interveniente Quitante · Análise jurídica personalizada");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (ctx.faturamentoAnual < 30_000_000 && ctx.faturamentoAnual > 0) a.push(`Faturamento ${_fmt(ctx.faturamentoAnual)}/ano abaixo do exigido (R$30M/ano)`);
      if (!ctx.faturamentoAnual) a.push("Faturamento anual não informado — obrigatório para CGI");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.tipo !== "PJ") r.push("Produto exclusivo para Pessoa Jurídica");
      if (!ctx.temImovel) r.push("Requer imóvel como garantia");
      if (ctx.restricao) r.push("Restrições no CNPJ — impeditivo");
      if (ctx.faturamentoAnual < 10_000_000) r.push("Faturamento mínimo: R$30M/ano (R$2,5M/mês)");
      return r;
    },
  },

  {
    id: "cash_collateral",
    nome: "Cash Collateral",
    nivel: "NIVEL_2",
    categoria: "Crédito Empresarial com Garantia Líquida",
    descricao: "Garantias líquidas (CDB, títulos bloqueados) como alavanca para crédito de baixo custo. Taxa a partir de 12% a.a. + CDI. Até R$10M. Estruturação 15–60 dias.",
    cor: "#6366F1",
    emoji: "💎",
    score: (ctx) => {
      if (ctx.tipo !== "PJ") return 0;
      if (ctx.restricao) return 5;
      let s = 35;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("cdb") || fin.includes("garantia liquida") || fin.includes("título") || fin.includes("titulo") || fin.includes("aplicação") || fin.includes("aplicacao")) s += 40;
      if (ctx.valor >= 100_000 && ctx.valor <= 10_000_000) s += 20;
      if (ctx.tipo === "PJ") s += 5;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("cdb") || fin.includes("garantia liquida")) m.push("Garantia líquida identificada — Cash Collateral ideal");
      m.push("Juros menores pelo menor risco · Liquidez preservada");
      m.push("Alavancagem proporcional ao colateral");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      a.push("Requer comprovação de garantias líquidas (CDB, títulos) a bloquear");
      if (ctx.valor > 10_000_000) a.push("Valor acima do teto: R$10M");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.tipo !== "PJ") r.push("Produto exclusivo para Pessoa Jurídica");
      if (ctx.restricao) r.push("Restrições no CNPJ — impeditivo");
      return r;
    },
  },

  {
    id: "moradia",
    nome: "Fundo Construção — Moradia",
    nivel: "NIVEL_2",
    categoria: "Fundo Construção Residencial",
    descricao: "PF. Projeto aprovado + licença ambiental. Taxa a partir de 9% a.a. + CDI. LTV 80–99% da obra. Aporte mínimo R$300K. Portabilidade pós-conclusão.",
    cor: "#84CC16",
    emoji: "🏗️",
    score: (ctx) => {
      if (ctx.tipo !== "PF") return 5;
      if (ctx.restricao) return 5;
      let s = 30;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("constru") || fin.includes("obra") || fin.includes("moradia") || fin.includes("terreno") || fin.includes("projeto")) s += 45;
      if (ctx.valor >= 300_000) s += 15;
      if (ctx.renda > 0 && ctx.valor / ctx.renda <= 300) s += 10;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.tipo === "PF") m.push("Perfil PF — produto estruturado para construção");
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("constru") || fin.includes("obra")) m.push("Finalidade de construção — Fundo Moradia aplicável");
      if (ctx.valor >= 300_000) m.push("Aporte dentro do mínimo exigido: R$300K");
      m.push("LTV de até 99% da obra · Portabilidade pós-conclusão");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      a.push("Exige projeto aprovado e licença ambiental/alvará");
      if (ctx.valor < 300_000) a.push("Aporte abaixo do mínimo: R$300K");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.tipo !== "PF") r.push("Produto exclusivo para Pessoa Física (use Unifamiliar/Incorporadoras para PJ)");
      if (ctx.restricao) r.push("Restrições no CPF — impeditivo");
      return r;
    },
  },

  {
    id: "reforma",
    nome: "Fundo Construção — Reforma",
    nivel: "NIVEL_2",
    categoria: "Fundo Construção — Reforma e Ampliação",
    descricao: "Avaliação em até 48h. Liberação em tranches diretamente na conta. Taxa a partir de 1,15% a.m. + IPCA. LTV até 50% do imóvel. R$30K–R$10M.",
    cor: "#A78BFA",
    emoji: "🔨",
    score: (ctx) => {
      if (ctx.restricao) return 5;
      let s = 30;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("reforma") || fin.includes("renovação") || fin.includes("amplia") || fin.includes("renovacao")) s += 50;
      if (ctx.valor >= 30_000 && ctx.valor <= 10_000_000) s += 15;
      if (ctx.temImovel) s += 5;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("reforma") || fin.includes("renovação") || fin.includes("amplia")) m.push("Finalidade de reforma — produto específico disponível");
      m.push("Avaliação em 48h · Libera em tranches · Flexível na documentação");
      if (ctx.temImovel) m.push("Imóvel como garantia para LTV");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (!ctx.temImovel) a.push("Sem imóvel cadastrado — LTV será avaliado no processo");
      if (ctx.valor < 30_000) a.push("Valor abaixo do mínimo: R$30K");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.restricao) r.push("Restrições — impeditivo");
      if (ctx.valor > 10_000_000) r.push("Valor acima do teto: R$10M");
      return r;
    },
  },

  {
    id: "unifamiliar",
    nome: "Fundo Construção — Unifamiliar",
    nivel: "NIVEL_2",
    categoria: "Fundo Construção — Pequenos Construtores",
    descricao: "Pequenos e médios construtores. Tranches conforme avanço físico. Taxa IPCA + 13,9% a.a. Aporte mínimo R$300K. Sem limite máximo.",
    cor: "#EC4899",
    emoji: "🏠",
    score: (ctx) => {
      if (ctx.restricao) return 5;
      let s = 20;
      if (ctx.ehConstrutora) s += 45;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("unifamiliar") || fin.includes("construtor") || fin.includes("construção residencial") || fin.includes("construcao residencial")) s += 25;
      if (ctx.valor >= 300_000) s += 10;
      if (ctx.tipo === "PJ") s += 5;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.ehConstrutora) m.push("Perfil construtor identificado — produto ideal");
      m.push("Comprovação de investimento prévio · Controle de caixa via tranches");
      if (ctx.valor >= 300_000) m.push("Aporte acima do mínimo: R$300K");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (!ctx.ehConstrutora) a.push("Perfil de construtor não identificado — validar elegibilidade");
      if (ctx.valor < 300_000) a.push("Aporte mínimo: R$300K");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.restricao) r.push("Restrições — impeditivo");
      return r;
    },
  },

  {
    id: "geminados",
    nome: "Fundo Construção — Geminados",
    nivel: "NIVEL_2",
    categoria: "Fundo Construção — 2 a 4 Unidades",
    descricao: "2 a 4 unidades por lote. Estruturação via SPE. Taxa CDI + 9% a.a. Aporte mínimo R$500K.",
    cor: "#F472B6",
    emoji: "🏘️",
    score: (ctx) => {
      if (ctx.restricao) return 5;
      let s = 15;
      if (ctx.ehConstrutora) s += 40;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("geminado") || fin.includes("duplex") || fin.includes("2 unidades") || fin.includes("3 unidades") || fin.includes("4 unidades")) s += 30;
      if (ctx.valor >= 500_000) s += 15;
      if (ctx.tipo === "PJ") s += 5;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.ehConstrutora) m.push("Perfil construtor — Geminados aplicável");
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("geminado") || fin.includes("2 unidades")) m.push("Projeto de unidades geminadas — produto específico");
      m.push("SPE para máxima segurança jurídica · Análise de viabilidade pré-liberação");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (ctx.valor < 500_000) a.push("Aporte mínimo: R$500K");
      a.push("Exige constituição de SPE para o projeto");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.restricao) r.push("Restrições — impeditivo");
      if (ctx.valor < 500_000) r.push("Aporte mínimo: R$500K");
      return r;
    },
  },

  {
    id: "fin_exterior",
    nome: "Financiamento — Brasileiros no Exterior",
    nivel: "NIVEL_2",
    categoria: "Financiamento Imobiliário Internacional",
    descricao: "Sem tradução juramentada. Renda internacional aceita. Taxa a partir de 11,25% a.a. LTV até 70%. Praças: SP, RJ, BH, Curitiba, POA, Floripa.",
    cor: "#0EA5E9",
    emoji: "✈️",
    score: (ctx) => {
      if (ctx.restricao) return 5;
      let s = 20;
      if (ctx.ehInternacional) s += 50;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("exterior") || fin.includes("estrangeiro") || fin.includes("internacional") || fin.includes("remessa")) s += 25;
      if (ctx.valor >= 250_000) s += 5;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.ehInternacional) m.push("Operação internacional identificada");
      m.push("Sem tradução juramentada · Renda internacional aceita");
      m.push("Aprovação com restrições via repasse automático");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (!ctx.ehInternacional) a.push("Perfil internacional não identificado — validar elegibilidade");
      a.push("Praças disponíveis: SP, RJ, BH, Curitiba, POA, Florianópolis");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.restricao) r.push("Restrições graves — avaliar caso a caso");
      if (ctx.valor < 250_000) r.push("Valor mínimo: R$250K");
      return r;
    },
  },

  {
    id: "cpr_agro",
    nome: "CPR Agro",
    nivel: "NIVEL_2",
    categoria: "Crédito para Agronegócio — CPR",
    descricao: "Antecipação de CPR. Venda do produto convertida a valor presente imediato. Taxa a partir de 1,6% a.m. Aporte mínimo R$500K.",
    cor: "#65A30D",
    emoji: "🌱",
    score: (ctx) => {
      if (ctx.restricao) return 5;
      let s = 20;
      if (ctx.ehAgronegocio) s += 50;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("cpr") || fin.includes("safra") || fin.includes("colheita") || fin.includes("producao rural") || fin.includes("produção rural")) s += 30;
      if (ctx.valor >= 500_000) s += 5;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.ehAgronegocio) m.push("Setor agro identificado — CPR Agro ideal");
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("cpr") || fin.includes("safra")) m.push("CPR/safra identificado — antecipação de recebível agrícola");
      m.push("Bom histórico no mercado de capitais gera taxas mais atrativas");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (!ctx.ehAgronegocio) a.push("Setor agro não identificado — validar atividade do cliente");
      if (ctx.valor < 500_000) a.push("Aporte mínimo: R$500K");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.restricao) r.push("Restrições — impeditivo");
      if (ctx.valor < 500_000) r.push("Aporte mínimo: R$500K");
      return r;
    },
  },

  {
    id: "slb_agro",
    nome: "Sale Leaseback Agro",
    nivel: "NIVEL_2",
    categoria: "Crédito Agro — Sale Leaseback",
    descricao: "Fundo compra o imóvel rural. Cliente mantém arrendamento e recompra garantida. Taxa 12% a.a. + IPCA. LTV até 70%. Prazo 10 anos + juros anuais. R$2M–R$100M.",
    cor: "#4ADE80",
    emoji: "🌾",
    score: (ctx) => {
      if (ctx.restricao) return 5;
      if (!ctx.temImovel && !ctx.ehAgronegocio) return 0;
      let s = 25;
      if (ctx.ehAgronegocio) s += 35;
      if (ctx.temImovel) s += 20;
      if (ctx.valor >= 2_000_000) s += 20;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("fazenda") || fin.includes("rural") || fin.includes("leaseback") || fin.includes("arrendamento")) s += 10;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.ehAgronegocio) m.push("Setor agro — Sale Leaseback Agro ideal");
      if (ctx.temImovel) m.push("Imóvel rural disponível para o fundo adquirir");
      if (ctx.valor >= 2_000_000) m.push(`Valor ${_fmt(ctx.valor)} dentro da faixa R$2M–R$100M`);
      m.push("Liquidez imediata sem perder o uso do ativo rural");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      a.push("Custo do mandato: 6% (mín. R$4M) + TAC 3% do fundo");
      if (ctx.valor < 2_000_000) a.push("Aporte mínimo: R$2M");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.restricao) r.push("Restrições — impeditivo");
      if (ctx.valor < 2_000_000) r.push("Aporte mínimo: R$2M");
      if (ctx.valor > 100_000_000) r.push("Valor acima do teto: R$100M");
      return r;
    },
  },

  {
    id: "op_int_cash",
    nome: "Op. Internacional — Cash Collateral",
    nivel: "NIVEL_2",
    categoria: "Operações Internacionais",
    descricao: "A partir de USD 2M. 25% em garantia bloqueada em banco AAA na conta do cliente. Taxa 6–8% a.a. Prazo 10 anos + 3 de carência. 12 tranches.",
    cor: "#38BDF8",
    emoji: "🌎",
    score: (ctx) => {
      if (ctx.restricao) return 0;
      if (!ctx.ehInternacional) return 5;
      let s = 30;
      if (ctx.valor >= 10_000_000) s += 40; // ~USD 2M
      if (ctx.tipo === "PJ") s += 20;
      if (ctx.ehInternacional) s += 10;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.ehInternacional) m.push("Operação internacional identificada");
      if (ctx.valor >= 10_000_000) m.push(`Volume ${_fmt(ctx.valor)} compatível (mín. USD 2M)`);
      m.push("Capital internacional sem internacionalizar a empresa");
      m.push("Sem taxas antecipadas · 12 tranches de liberação");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (ctx.valor < 10_000_000) a.push("Volume mínimo: aproximadamente USD 2M (≈ R$10M)");
      a.push("Requer Business Plan e 25% de garantia bloqueada em banco AAA");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.restricao) r.push("Restrições — impeditivo absoluto");
      if (ctx.tipo !== "PJ") r.push("Produto exclusivo para Pessoa Jurídica");
      if (ctx.valor < 10_000_000) r.push("Volume mínimo: USD 2M (≈ R$10M)");
      return r;
    },
  },

  {
    id: "cambio_pronto",
    nome: "Câmbio Pronto",
    nivel: "NIVEL_2",
    categoria: "Câmbio e Operações Internacionais",
    descricao: "Conversão imediata. Liquidação no mesmo dia ou em até 2 dias úteis. Remessas, pagamentos e investimentos no exterior.",
    cor: "#22D3EE",
    emoji: "💱",
    score: (ctx) => {
      let s = 10;
      if (ctx.ehInternacional) s += 55;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("câmbio") || fin.includes("cambio") || fin.includes("remessa") || fin.includes("pagamento exterior") || fin.includes("dólar") || fin.includes("dolar") || fin.includes("usd")) s += 35;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.ehInternacional) m.push("Operação internacional — Câmbio Pronto disponível");
      m.push("Taxa travada no ato · Suporte regulatório completo");
      m.push("Liquidação no mesmo dia ou 2 dias úteis");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (!ctx.ehInternacional) a.push("Operação internacional não identificada — validar necessidade de câmbio");
      a.push("Custo: câmbio + spread + IOF sobre o valor");
      return a;
    },
    restricoes: () => [],
  },

  {
    id: "finimp",
    nome: "FINIMP — Financiamento de Importações",
    nivel: "NIVEL_2",
    categoria: "Câmbio — Importações",
    descricao: "Crédito em moeda estrangeira. Isenção de IOF com hedge disponível. Prazo 90 dias a 5 anos. Máquinas, matérias-primas e ativos do exterior.",
    cor: "#67E8F9",
    emoji: "🚢",
    score: (ctx) => {
      if (ctx.restricao) return 5;
      let s = 10;
      if (ctx.ehImportador) s += 60;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("import") || fin.includes("maquina") || fin.includes("máquina") || fin.includes("materia-prima") || fin.includes("matéria-prima") || fin.includes("finimp")) s += 30;
      if (ctx.tipo === "PJ") s += 10;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.ehImportador) m.push("Importador identificado — FINIMP ideal");
      m.push("Condições mais competitivas que crédito doméstico");
      m.push("Isenção de IOF · Hedge cambial disponível");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (!ctx.ehImportador) a.push("Perfil importador não identificado — validar operação");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.restricao) r.push("Restrições — impeditivo");
      if (ctx.tipo !== "PJ") r.push("Produto exclusivo para empresas importadoras");
      return r;
    },
  },

  {
    id: "acc",
    nome: "ACC — Adiantamento sobre Contrato de Câmbio",
    nivel: "NIVEL_2",
    categoria: "Câmbio — Exportações Pré-Embarque",
    descricao: "Capital antecipado para produção antes do envio. Prazo até 360 dias. Taxas internacionais + risco-país. Reduz pressão sobre o caixa.",
    cor: "#34D399",
    emoji: "📦",
    score: (ctx) => {
      if (ctx.restricao) return 5;
      let s = 10;
      if (ctx.ehExportador) s += 65;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("exporta") || fin.includes("acc") || fin.includes("embarque") || fin.includes("pré-embarque") || fin.includes("pre-embarque")) s += 25;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.ehExportador) m.push("Exportador identificado — ACC ideal para pré-embarque");
      m.push("Taxas mais atrativas que crédito doméstico");
      m.push("Reduz pressão sobre o caixa · Independe dos prazos do importador");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (!ctx.ehExportador) a.push("Perfil exportador não identificado — validar operação");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.restricao) r.push("Restrições — impeditivo");
      if (ctx.tipo !== "PJ") r.push("Produto para empresas exportadoras");
      return r;
    },
  },

  {
    id: "ace",
    nome: "ACE — Adiantamento sobre Cambiais Entregues",
    nivel: "NIVEL_2",
    categoria: "Câmbio — Exportações Pós-Embarque",
    descricao: "Pós-embarque. Vendas já enviadas ao exterior convertidas em liquidez imediata. Prazo 180–540 dias. Melhora o ciclo financeiro.",
    cor: "#6EE7B7",
    emoji: "🌊",
    score: (ctx) => {
      if (ctx.restricao) return 5;
      let s = 10;
      if (ctx.ehExportador) s += 60;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("exporta") || fin.includes("ace") || fin.includes("pós-embarque") || fin.includes("pos-embarque") || fin.includes("cambiais")) s += 30;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.ehExportador) m.push("Exportador identificado — ACE ideal para pós-embarque");
      m.push("Melhora o ciclo financeiro e mitiga risco externo");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (!ctx.ehExportador) a.push("Perfil exportador não identificado");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.restricao) r.push("Restrições — impeditivo");
      if (ctx.tipo !== "PJ") r.push("Produto para empresas exportadoras");
      return r;
    },
  },

  // ══ NÍVEL 3 — High Ticket ═════════════════════════════════════════════════

  {
    id: "cri_cash_collateral",
    nome: "CRI Cash Collateral",
    nivel: "NIVEL_3",
    categoria: "Securitização Imobiliária — Construtoras",
    descricao: "Para construtoras. Similar ao GERIC da CEF. Taxa 0,50–0,70% a.m. + CDI. R$5M–R$150M. Lastro em carteira de recebíveis (10–35% concluída/vendida).",
    cor: "#F97316",
    emoji: "🏗️",
    score: (ctx) => {
      if (ctx.restricao) return 0;
      if (ctx.tipo !== "PJ") return 0;
      if (ctx.valor < 5_000_000) return 5;
      let s = 30;
      if (ctx.ehConstrutora) s += 40;
      if (ctx.valor >= 10_000_000) s += 20;
      if (ctx.temRecebiveis) s += 10;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.ehConstrutora) m.push("Construtora/incorporadora — CRI Cash Collateral ideal");
      if (ctx.valor >= 10_000_000) m.push(`Volume ${_fmt(ctx.valor)} adequado para CRI`);
      m.push("Condições customizadas · Projetos residenciais, comerciais ou mistos");
      m.push("Estrutura similar ao GERIC da CEF para grandes projetos");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (!ctx.ehConstrutora) a.push("Perfil de construtora não identificado — validar");
      if (ctx.valor < 10_000_000) a.push("CRI é mais eficiente acima de R$10M pelo custo de estruturação");
      a.push("Exige carteira de recebíveis (10–35% concluída/vendida)");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.restricao) r.push("Restrições — impeditivo absoluto");
      if (ctx.tipo !== "PJ") r.push("Produto exclusivo para Pessoa Jurídica");
      if (ctx.valor < 5_000_000) r.push("Valor mínimo N3: R$5M");
      return r;
    },
  },

  {
    id: "cri_inicio_obra",
    nome: "Crédito Ponto / CRI Início de Obra",
    nivel: "NIVEL_3",
    categoria: "Fundo Construção — Incorporadoras",
    descricao: "Para incorporadoras com alvará, LI e SPE. Capital estratégico imediato. Taxa a partir de 0,89% + IPCA. Até R$10M. Amortização Price.",
    cor: "#FB923C",
    emoji: "🏢",
    score: (ctx) => {
      if (ctx.restricao) return 0;
      if (ctx.tipo !== "PJ") return 5;
      let s = 25;
      if (ctx.ehConstrutora) s += 45;
      if (ctx.valor >= 500_000 && ctx.valor <= 10_000_000) s += 20;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("alvará") || fin.includes("alvara") || fin.includes("inicio de obra") || fin.includes("início de obra") || fin.includes("spe") || fin.includes("incorpora")) s += 10;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.ehConstrutora) m.push("Incorporadora identificada — Crédito Ponto aplicável");
      if (ctx.valor >= 500_000 && ctx.valor <= 10_000_000) m.push(`Valor ${_fmt(ctx.valor)} dentro da faixa R$500K–R$10M`);
      m.push("Renda comprovada na 3ª parcela · Capital imediato para início de obra");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      a.push("Exige alvará, licença de instalação (LI) e SPE já constituída");
      if (ctx.valor < 500_000) a.push("Aporte mínimo: R$500K");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.restricao) r.push("Restrições — impeditivo absoluto");
      if (ctx.tipo !== "PJ") r.push("Produto para incorporadoras (PJ)");
      if (ctx.valor > 10_000_000) r.push("Valor máximo: R$10M (use CRI Cash Collateral para volumes maiores)");
      return r;
    },
  },

  {
    id: "bts_corporativo",
    nome: "Construtoras BTS — Build-to-Suit",
    nivel: "NIVEL_3",
    categoria: "Fundo Construção — Build-to-Suit Corporativo",
    descricao: "Build-to-Suit corporativo. Alinhamento técnico e financeiro sob medida. Taxas conforme projeto e contrato BTS. R$2M–R$100M.",
    cor: "#EF4444",
    emoji: "🏭",
    score: (ctx) => {
      if (ctx.restricao) return 0;
      if (ctx.valor < 2_000_000) return 5;
      let s = 25;
      if (ctx.ehConstrutora) s += 35;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("built to suit") || fin.includes("build to suit") || fin.includes("bts") || fin.includes("corporativo") || fin.includes("medida")) s += 30;
      if (ctx.valor >= 10_000_000) s += 10;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.ehConstrutora) m.push("Construtora identificada — BTS corporativo disponível");
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("bts") || fin.includes("built to suit")) m.push("Build-to-Suit identificado — match perfeito");
      m.push("Taxas e critérios definidos conforme o projeto e contrato BTS");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (ctx.valor < 2_000_000) a.push("Aporte mínimo: R$2M");
      if (!ctx.ehConstrutora) a.push("Perfil construtor não identificado — validar");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.restricao) r.push("Restrições — impeditivo absoluto");
      if (ctx.valor < 2_000_000) r.push("Aporte mínimo: R$2M");
      if (ctx.valor > 100_000_000) r.push("Valor acima do teto: R$100M");
      return r;
    },
  },

  {
    id: "incorporadoras",
    nome: "Fundo Incorporadoras",
    nivel: "NIVEL_3",
    categoria: "Fundo Construção — Incorporadoras High Ticket",
    descricao: "Múltiplos lançamentos simultâneos. Holdings e subholdings. Taxa a partir de 6% + CDI. Aporte mínimo R$6M.",
    cor: "#DC2626",
    emoji: "🏙️",
    score: (ctx) => {
      if (ctx.restricao) return 0;
      if (ctx.tipo !== "PJ") return 5;
      if (ctx.valor < 6_000_000) return 5;
      let s = 30;
      if (ctx.ehConstrutora) s += 40;
      if (ctx.valor >= 20_000_000) s += 20;
      const fin = ctx.finalidade?.toLowerCase() ?? "";
      if (fin.includes("incorporadora") || fin.includes("holding") || fin.includes("lançamento") || fin.includes("lancamento") || fin.includes("multiplos")) s += 10;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.ehConstrutora) m.push("Incorporadora identificada — produto de alto padrão");
      if (ctx.valor >= 6_000_000) m.push(`Volume ${_fmt(ctx.valor)} acima do mínimo: R$6M`);
      m.push("Centralização societária via holdings · Eficiência operacional e segurança jurídica");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (ctx.valor < 6_000_000) a.push("Aporte mínimo: R$6M");
      if (!ctx.ehConstrutora) a.push("Perfil incorporadora não identificado — validar");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.restricao) r.push("Restrições — impeditivo absoluto");
      if (ctx.tipo !== "PJ") r.push("Produto exclusivo para Pessoa Jurídica (incorporadoras/holdings)");
      if (ctx.valor < 6_000_000) r.push("Aporte mínimo: R$6M");
      return r;
    },
  },

  {
    id: "op_int_garantia",
    nome: "Op. Internacional — Garantia Imobiliária",
    nivel: "NIVEL_3",
    categoria: "Operações Internacionais High Ticket",
    descricao: "A partir de USD 10M. Faturamento mínimo R$25M/ano. Taxa 6–8% a.a. Prazo 10 anos + 2 de carência. Liberação única. Sem IOF.",
    cor: "#7C3AED",
    emoji: "🌐",
    score: (ctx) => {
      if (ctx.restricao) return 0;
      if (ctx.tipo !== "PJ") return 0;
      if (ctx.valor < 50_000_000) return 5;
      let s = 25;
      if (ctx.ehInternacional) s += 35;
      if (ctx.faturamentoAnual >= 25_000_000) s += 25;
      if (ctx.temImovel) s += 15;
      return Math.min(s, 100);
    },
    motivos: (ctx) => {
      const m: string[] = [];
      if (ctx.ehInternacional) m.push("Operação internacional de alto valor identificada");
      if (ctx.faturamentoAnual >= 25_000_000) m.push(`Faturamento ${_fmt(ctx.faturamentoAnual)}/ano — elegível`);
      if (ctx.temImovel) m.push("Imóvel como garantia adicional");
      m.push("Liberação única · Análise pela capacidade do Business Plan futuro · Sem IOF");
      return m;
    },
    alertas: (ctx) => {
      const a: string[] = [];
      if (ctx.faturamentoAnual < 25_000_000) a.push("Faturamento mínimo: R$25M/ano");
      if (ctx.valor < 50_000_000) a.push("Volume mínimo: USD 10M (≈ R$50M)");
      return a;
    },
    restricoes: (ctx) => {
      const r: string[] = [];
      if (ctx.restricao) r.push("Restrições — impeditivo absoluto");
      if (ctx.tipo !== "PJ") r.push("Produto exclusivo para Pessoa Jurídica");
      if (ctx.faturamentoAnual < 25_000_000) r.push("Faturamento mínimo: R$25M/ano");
      if (ctx.valor < 50_000_000) r.push("Volume mínimo: USD 10M (≈ R$50M)");
      return r;
    },
  },
];

// ─── Build context from proposal ─────────────────────────────────────────────

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
  const fin = finalidade.toLowerCase();

  const temFrota = fin.includes("frota") || fin.includes("veículo") || fin.includes("veiculo") || fin.includes("caminhão") || fin.includes("caminhao") || fin.includes("carreta") || fin.includes("scania") || fin.includes("volvo") || fin.includes("iveco");
  const ehConstrutora = fin.includes("constru") || fin.includes("incorpor") || fin.includes("bts") || fin.includes("obra") || fin.includes("spe") || fin.includes("lançamento") || fin.includes("lancamento");
  const ehAgronegocio = fin.includes("agro") || fin.includes("rural") || fin.includes("fazenda") || fin.includes("soja") || fin.includes("milho") || fin.includes("pecuária") || fin.includes("pecuaria") || fin.includes("cpr") || fin.includes("safra");
  const ehExportador = fin.includes("exporta") || fin.includes("embarque") || fin.includes("acc") || fin.includes("ace");
  const ehImportador = fin.includes("import") || fin.includes("finimp");
  const ehInternacional = fin.includes("exterior") || fin.includes("international") || fin.includes("internacional") || fin.includes("câmbio") || fin.includes("cambio") || fin.includes("dólar") || fin.includes("dolar") || fin.includes("usd") || ehExportador || ehImportador;

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
    temRecebiveis: renda > 0 && tipo === "PJ",
    faturamentoAnual: tipo === "PJ" ? renda * 12 : 0,
    temFrota,
    ehConstrutora,
    ehAgronegocio,
    ehExportador,
    ehImportador,
    ehInternacional,
  };
}

// ─── Merge DB params ─────────────────────────────────────────────────────────

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
      score: (ctx: AnaliseCtx) => {
        const orig = l.score(ctx);
        if (orig === 0) return 0;
        const bonus = Math.max(0, orig - 40);
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
        return [...new Set([...orig, ...extra])];
      },
    };
  });
}

interface Resultado {
  linha: RegraLinha;
  score: number;
  motivos: string[];
  alertas: string[];
  restricoes: string[];
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
  rulesKey?: number;
}

export function RecomendacaoLinha({ proposal, rulesKey }: RecomendacaoLinhaProps) {
  const [dbRules, setDbRules] = useState<RegraDB[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);

  useEffect(() => {
    setLoadingRules(true);
    fetch("/api/regras-linhas")
      .then(r => r.json())
      .then(({ regras }) => setDbRules(regras ?? []))
      .catch(() => {})
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
  const alternativas = resultados.slice(1, 5).filter(r => r.score >= 20);
  const incompativeis = resultados.filter(r => r.score < 10 && r.restricoes.length > 0).slice(0, 4);

  const scoreColor = (s: number) => s >= 75 ? "#10B981" : s >= 50 ? "#C9A84C" : s >= 25 ? "#F97316" : "#EF4444";
  const scoreLabel = (s: number) => s >= 75 ? "Alta compatibilidade" : s >= 50 ? "Compatível" : s >= 25 ? "Compat. parcial" : "Baixa compat.";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Sparkles className="w-3.5 h-3.5 text-[#C9A84C]" />
        <p className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Análise de Compatibilidade — Portfólio V3 Partners 2026</p>
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
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-white">{top.linha.nome}</p>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: `${top.linha.cor}22`, color: top.linha.cor }}>
                  {top.linha.nivel.replace("_", " ")}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">{top.linha.categoria}</p>
            </div>
          </div>
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
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-semibold text-white truncate">{r.linha.nome}</p>
                    <span className="text-[9px] px-1 py-0.5 rounded font-bold flex-shrink-0"
                      style={{ background: `${r.linha.cor}20`, color: r.linha.cor }}>
                      {r.linha.nivel.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{r.linha.categoria}</p>
                  {r.alertas[0] && <p className="text-[10px] text-amber-400 mt-0.5">⚠ {r.alertas[0]}</p>}
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
                <Info className="w-2.5 h-2.5 text-red-400/60 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
        * Análise automática baseada nos dados cadastrados. Sujeita a validação pela mesa de crédito. Portfólio V3 Partners 2026 — CNPJ 14.219.287/0001-50.
      </p>
    </div>
  );
}
