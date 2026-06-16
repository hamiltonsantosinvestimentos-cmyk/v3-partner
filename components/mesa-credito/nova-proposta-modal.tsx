"use client";

import React, { useState, useEffect } from "react";
import {
  X, User, Building2, FileText, Upload, CheckCircle2, Circle,
  ChevronRight, AlertCircle, Home, Shield, TrendingUp, Zap, Download, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

// ─── Checklists por linha e tipo de pessoa ─────────────────────────────────
export const CHECKLISTS: Record<string, Record<"PF" | "PJ", { id: string; label: string; required: boolean; hint?: string }[]>> = {
  "Home Equity": {
    PF: [
      { id: "he_pf_1", label: "RG e CPF (ou CNH)", required: true, hint: "Documento de identificação com foto" },
      { id: "he_pf_2", label: "Comprovante de renda (3 últimos meses)", required: true, hint: "Holerite, pró-labore ou decore" },
      { id: "he_pf_3", label: "Extrato bancário (3 últimos meses)", required: true },
      { id: "he_pf_4", label: "Matrícula do imóvel atualizada (máx. 30 dias)", required: true },
      { id: "he_pf_5", label: "IPTU do ano corrente", required: true },
      { id: "he_pf_6", label: "Imposto de Renda completo + recibo de entrega", required: true },
      { id: "he_pf_7", label: "Comprovante de residência (máx. 90 dias)", required: true },
      { id: "he_pf_8", label: "Certidão de casamento / divórcio", required: false, hint: "Se aplicável" },
      { id: "he_pf_9", label: "Certidão negativa de débitos cartoriais", required: false },
      { id: "he_pf_10", label: "3 fotos internas do imóvel", required: true, hint: "Ambientes principais: sala, quartos, cozinha" },
      { id: "he_pf_11", label: "3 fotos externas do imóvel", required: true, hint: "Fachada, lateral e área externa" },
    ],
    PJ: [
      { id: "he_pj_1", label: "Contrato Social + todas as alterações", required: true },
      { id: "he_pj_2", label: "Cartão CNPJ atualizado", required: true },
      { id: "he_pj_3", label: "Faturamento mensal — últimos 12 meses", required: true },
      { id: "he_pj_4", label: "Balanço Patrimonial + DRE (últimos 2 anos)", required: true },
      { id: "he_pj_5", label: "Certidão Negativa Federal, Estadual e Municipal", required: true },
      { id: "he_pj_6", label: "Matrícula do imóvel atualizada (máx. 30 dias)", required: true },
      { id: "he_pj_7", label: "IPTU do ano corrente", required: true },
      { id: "he_pj_8", label: "RG e CPF dos sócios e respectivos cônjuges", required: true },
      { id: "he_pj_9", label: "Imposto de Renda PJ (DIPJ) + recibo", required: true },
      { id: "he_pj_10", label: "Comprovante de residência dos sócios", required: true },
      { id: "he_pj_11", label: "3 fotos internas do imóvel", required: true, hint: "Ambientes principais: sala, quartos, cozinha" },
      { id: "he_pj_12", label: "3 fotos externas do imóvel", required: true, hint: "Fachada, lateral e área externa" },
    ],
  },
  "Home Equity Distressed": {
    PF: [
      { id: "hee_pf_1", label: "RG e CPF (ou CNH)", required: true, hint: "Documento de identificação com foto" },
      { id: "hee_pf_2", label: "Comprovante de renda (3 últimos meses)", required: true, hint: "Holerite, pró-labore ou decore" },
      { id: "hee_pf_3", label: "Extrato bancário (3 últimos meses)", required: true },
      { id: "hee_pf_4", label: "Matrícula do imóvel atualizada (máx. 30 dias)", required: true, hint: "Imóvel em situação estressada / alienação" },
      { id: "hee_pf_5", label: "IPTU do ano corrente", required: true },
      { id: "hee_pf_6", label: "Imposto de Renda completo + recibo de entrega", required: true },
      { id: "hee_pf_7", label: "Comprovante de residência (máx. 90 dias)", required: true },
      { id: "hee_pf_8", label: "Certidão de ônus reais atualizada", required: true, hint: "Fundamental para imóveis estressados" },
      { id: "hee_pf_9", label: "Documentação do processo / dívida em aberto", required: true, hint: "Ação judicial, protesto ou execução" },
      { id: "hee_pf_10", label: "Laudo de avaliação do imóvel", required: false, hint: "Avaliação independente" },
      { id: "hee_pf_11", label: "3 fotos internas do imóvel", required: true, hint: "Ambientes principais: sala, quartos, cozinha" },
      { id: "hee_pf_12", label: "3 fotos externas do imóvel", required: true, hint: "Fachada, lateral e área externa" },
    ],
    PJ: [
      { id: "hee_pj_1", label: "Contrato Social + todas as alterações", required: true },
      { id: "hee_pj_2", label: "Cartão CNPJ atualizado", required: true },
      { id: "hee_pj_3", label: "Faturamento mensal — últimos 12 meses", required: true },
      { id: "hee_pj_4", label: "Balanço Patrimonial + DRE (últimos 2 anos)", required: true },
      { id: "hee_pj_5", label: "Certidão Negativa Federal, Estadual e Municipal", required: true },
      { id: "hee_pj_6", label: "Matrícula do imóvel atualizada (máx. 30 dias)", required: true },
      { id: "hee_pj_7", label: "IPTU do ano corrente", required: true },
      { id: "hee_pj_8", label: "RG e CPF dos sócios e respectivos cônjuges", required: true },
      { id: "hee_pj_9", label: "Certidão de ônus reais atualizada", required: true, hint: "Fundamental para imóveis estressados" },
      { id: "hee_pj_10", label: "Documentação do processo / dívida em aberto", required: true, hint: "Ação judicial, protesto ou execução" },
      { id: "hee_pj_11", label: "Laudo de avaliação do imóvel", required: false },
      { id: "hee_pj_12", label: "3 fotos internas do imóvel", required: true, hint: "Ambientes principais: sala, quartos, cozinha" },
      { id: "hee_pj_13", label: "3 fotos externas do imóvel", required: true, hint: "Fachada, lateral e área externa" },
    ],
  },
  "Crédito no Aval": {
    PF: [
      { id: "av_pf_1", label: "RG e CPF (ou CNH)", required: true },
      { id: "av_pf_2", label: "Comprovante de renda (3 últimos meses)", required: true },
      { id: "av_pf_3", label: "Extrato bancário (3 últimos meses)", required: true },
      { id: "av_pf_4", label: "Comprovante de residência (máx. 90 dias)", required: true },
      { id: "av_pf_5", label: "Imposto de Renda completo + recibo", required: true },
      { id: "av_pf_6", label: "Certidão de casamento / divórcio", required: false },
    ],
    PJ: [
      { id: "av_pj_1", label: "Contrato Social + alterações", required: true },
      { id: "av_pj_2", label: "Cartão CNPJ atualizado", required: true },
      { id: "av_pj_3", label: "Balanço Patrimonial + DRE", required: true },
      { id: "av_pj_4", label: "Faturamento mensal — últimos 12 meses", required: true },
      { id: "av_pj_5", label: "Certidões Negativas (Federal, Estadual, Municipal)", required: true },
      { id: "av_pj_6", label: "RG e CPF dos sócios", required: true },
    ],
  },
  "FIDC": {
    PF: [
      { id: "fidc_pf_1", label: "RG e CPF dos sócios/gestores", required: true },
      { id: "fidc_pf_2", label: "Comprovante de renda e patrimônio", required: true },
      { id: "fidc_pf_3", label: "Imposto de Renda + recibo", required: true },
    ],
    PJ: [
      { id: "fidc_pj_1", label: "Contrato Social + alterações", required: true },
      { id: "fidc_pj_2", label: "Cartão CNPJ atualizado", required: true },
      { id: "fidc_pj_3", label: "Balanço Patrimonial + DRE (últimos 3 anos)", required: true },
      { id: "fidc_pj_4", label: "Carteira de recebíveis — relatório detalhado", required: true },
      { id: "fidc_pj_5", label: "Contratos de originação de crédito (amostra)", required: true },
      { id: "fidc_pj_6", label: "Inadimplência histórica por safra", required: true },
      { id: "fidc_pj_7", label: "Certidões Negativas completas", required: true },
      { id: "fidc_pj_8", label: "Relatório de auditoria independente", required: false },
    ],
  },
  "CRI Cash Collateral": {
    PF: [
      { id: "cri_pf_1", label: "RG e CPF (ou CNH)", required: true },
      { id: "cri_pf_2", label: "Comprovante de renda e patrimônio", required: true },
      { id: "cri_pf_3", label: "Matrícula do imóvel vinculado", required: true },
      { id: "cri_pf_4", label: "IPTU do ano corrente", required: true },
      { id: "cri_pf_5", label: "Imposto de Renda + recibo", required: true },
      { id: "cri_pf_6", label: "3 fotos internas do imóvel", required: true, hint: "Ambientes principais: sala, quartos, cozinha" },
      { id: "cri_pf_7", label: "3 fotos externas do imóvel", required: true, hint: "Fachada, lateral e área externa" },
    ],
    PJ: [
      { id: "cri_pj_1", label: "Contrato Social + alterações", required: true },
      { id: "cri_pj_2", label: "Cartão CNPJ atualizado", required: true },
      { id: "cri_pj_3", label: "Balanço Patrimonial + DRE (últimos 3 anos)", required: true },
      { id: "cri_pj_4", label: "Matrícula do imóvel vinculado (atualizada)", required: true },
      { id: "cri_pj_5", label: "Laudo de avaliação imobiliária (CRECI)", required: true },
      { id: "cri_pj_6", label: "Memorial descritivo do empreendimento", required: true },
      { id: "cri_pj_7", label: "Certidões Negativas completas", required: true },
      { id: "cri_pj_8", label: "3 fotos internas do imóvel", required: true, hint: "Ambientes principais: sala, quartos, cozinha" },
      { id: "cri_pj_9", label: "3 fotos externas do imóvel", required: true, hint: "Fachada, lateral e área externa" },
    ],
  },
  "CRA": {
    PF: [
      { id: "cra_pf_1", label: "RG e CPF (ou CNH)", required: true },
      { id: "cra_pf_2", label: "Comprovante de atividade rural / agroindustrial", required: true },
      { id: "cra_pf_3", label: "Imposto de Renda + recibo", required: true },
      { id: "cra_pf_4", label: "CAR — Cadastro Ambiental Rural", required: true },
    ],
    PJ: [
      { id: "cra_pj_1", label: "Contrato Social + alterações", required: true },
      { id: "cra_pj_2", label: "Cartão CNPJ atualizado", required: true },
      { id: "cra_pj_3", label: "Balanço Patrimonial + DRE (últimos 3 anos)", required: true },
      { id: "cra_pj_4", label: "Comprovante de atividade agronegócio (contratos)", required: true },
      { id: "cra_pj_5", label: "CAR — Cadastro Ambiental Rural", required: true },
      { id: "cra_pj_6", label: "Certidões Negativas completas", required: true },
    ],
  },
  "HIGH TICKET": {
    PF: [
      { id: "ht_pf_1", label: "RG e CPF (ou CNH)", required: true },
      { id: "ht_pf_2", label: "Comprovante de patrimônio e renda", required: true },
      { id: "ht_pf_3", label: "Imposto de Renda (últimos 3 anos)", required: true },
      { id: "ht_pf_4", label: "Teaser executivo da operação", required: true },
      { id: "ht_pf_5", label: "Projeções financeiras (5 anos)", required: true },
    ],
    PJ: [
      { id: "ht_pj_1", label: "Contrato Social + todas as alterações", required: true },
      { id: "ht_pj_2", label: "Cartão CNPJ atualizado", required: true },
      { id: "ht_pj_3", label: "Balanço Patrimonial + DRE (últimos 3 anos)", required: true },
      { id: "ht_pj_4", label: "Fluxo de Caixa histórico e projetado", required: true },
      { id: "ht_pj_5", label: "Teaser executivo / Information Memorandum", required: true },
      { id: "ht_pj_6", label: "Projeções financeiras detalhadas (5 anos)", required: true },
      { id: "ht_pj_7", label: "Certidões Negativas completas (PGFN, Receita, FGTS)", required: true },
      { id: "ht_pj_8", label: "Relatório de auditoria independente", required: true },
      { id: "ht_pj_9", label: "Laudo de avaliação patrimonial", required: false },
      { id: "ht_pj_10", label: "Apresentação executiva (pitch deck)", required: false },
    ],
  },
  "PROJECT FINANCE": {
    PF: [],
    PJ: [
      { id: "pf_pj_1", label: "Contrato Social + alterações", required: true },
      { id: "pf_pj_2", label: "Cartão CNPJ atualizado", required: true },
      { id: "pf_pj_3", label: "Estudo de viabilidade do projeto", required: true },
      { id: "pf_pj_4", label: "Projeções financeiras completas (10 anos)", required: true },
      { id: "pf_pj_5", label: "Licenças ambientais e regulatórias", required: true },
      { id: "pf_pj_6", label: "Contratos off-take ou receita garantida", required: false },
      { id: "pf_pj_7", label: "Balanço Patrimonial + DRE (últimos 3 anos)", required: true },
      { id: "pf_pj_8", label: "Certidões Negativas completas", required: true },
    ],
  },
  "Fundo Construção — Moradia": {
    PF: [
      { id: "fcr_pf_1", label: "RG e CPF (ou CNH)", required: true },
      { id: "fcr_pf_2", label: "Comprovante de renda (3 últimos meses)", required: true },
      { id: "fcr_pf_3", label: "Matrícula do terreno atualizada (máx. 30 dias)", required: true },
      { id: "fcr_pf_4", label: "IPTU do terreno — ano corrente", required: true },
      { id: "fcr_pf_5", label: "Projeto arquitetônico aprovado pela prefeitura", required: true },
      { id: "fcr_pf_6", label: "Alvará de construção", required: true },
      { id: "fcr_pf_7", label: "Orçamento da obra detalhado", required: true },
      { id: "fcr_pf_8", label: "Imposto de Renda completo + recibo", required: true },
      { id: "fcr_pf_9", label: "Certidão de casamento / divórcio", required: false },
      { id: "fcr_pf_10", label: "3 fotos internas do imóvel / obra", required: true, hint: "Estado atual da construção ou ambientes internos" },
      { id: "fcr_pf_11", label: "3 fotos externas do imóvel / obra", required: true, hint: "Fachada, terreno e área externa" },
    ],
    PJ: [
      { id: "fcr_pj_1", label: "Contrato Social + todas as alterações", required: true },
      { id: "fcr_pj_2", label: "Cartão CNPJ atualizado", required: true },
      { id: "fcr_pj_3", label: "Balanço Patrimonial + DRE (últimos 2 anos)", required: true },
      { id: "fcr_pj_4", label: "Matrícula do terreno atualizada", required: true },
      { id: "fcr_pj_5", label: "Projeto arquitetônico aprovado", required: true },
      { id: "fcr_pj_6", label: "Alvará de construção", required: true },
      { id: "fcr_pj_7", label: "Orçamento da obra detalhado + cronograma físico-financeiro", required: true },
      { id: "fcr_pj_8", label: "Memorial descritivo da construção", required: true },
      { id: "fcr_pj_9", label: "Certidões Negativas completas", required: true },
      { id: "fcr_pj_10", label: "RG e CPF dos sócios", required: true },
      { id: "fcr_pj_11", label: "3 fotos internas do imóvel / obra", required: true, hint: "Estado atual da construção ou ambientes internos" },
      { id: "fcr_pj_12", label: "3 fotos externas do imóvel / obra", required: true, hint: "Fachada, terreno e área externa" },
    ],
  },
  "HomeCash": {
    PF: [
      { id: "hc_pf_1", label: "RG e CPF (ou CNH)", required: true },
      { id: "hc_pf_2", label: "Comprovante de renda (3 últimos meses)", required: true },
      { id: "hc_pf_3", label: "Extrato bancário (3 últimos meses)", required: true },
      { id: "hc_pf_4", label: "Matrícula do imóvel atualizada (máx. 30 dias)", required: true },
      { id: "hc_pf_5", label: "IPTU do ano corrente", required: true },
      { id: "hc_pf_6", label: "Laudo de avaliação do imóvel (CRECI)", required: true },
      { id: "hc_pf_7", label: "Imposto de Renda completo + recibo", required: true },
      { id: "hc_pf_8", label: "Comprovante de residência (máx. 90 dias)", required: true },
      { id: "hc_pf_9", label: "Certidão de casamento / divórcio", required: false },
      { id: "hc_pf_10", label: "3 fotos internas do imóvel", required: true, hint: "Ambientes principais: sala, quartos, cozinha" },
      { id: "hc_pf_11", label: "3 fotos externas do imóvel", required: true, hint: "Fachada, lateral e área externa" },
    ],
    PJ: [
      { id: "hc_pj_1", label: "Contrato Social + todas as alterações", required: true },
      { id: "hc_pj_2", label: "Cartão CNPJ atualizado", required: true },
      { id: "hc_pj_3", label: "Balanço Patrimonial + DRE (últimos 2 anos)", required: true },
      { id: "hc_pj_4", label: "Faturamento mensal — últimos 12 meses", required: true },
      { id: "hc_pj_5", label: "Matrícula do imóvel atualizada", required: true },
      { id: "hc_pj_6", label: "Laudo de avaliação do imóvel (CRECI)", required: true },
      { id: "hc_pj_7", label: "IPTU do ano corrente", required: true },
      { id: "hc_pj_8", label: "Certidões Negativas completas", required: true },
      { id: "hc_pj_9", label: "RG e CPF dos sócios e cônjuges", required: true },
      { id: "hc_pj_10", label: "3 fotos internas do imóvel", required: true, hint: "Ambientes principais: sala, quartos, cozinha" },
      { id: "hc_pj_11", label: "3 fotos externas do imóvel", required: true, hint: "Fachada, lateral e área externa" },
    ],
  },
  "Giro Auto": {
    PF: [
      { id: "v3g_pf_1", label: "RG e CPF (ou CNH)", required: true },
      { id: "v3g_pf_2", label: "Comprovante de renda (3 últimos meses)", required: true },
      { id: "v3g_pf_3", label: "Extrato bancário (6 últimos meses)", required: true },
      { id: "v3g_pf_4", label: "Imposto de Renda completo + recibo", required: true },
    ],
    PJ: [
      { id: "v3g_pj_1", label: "Contrato Social + alterações", required: true },
      { id: "v3g_pj_2", label: "Cartão CNPJ atualizado", required: true },
      { id: "v3g_pj_3", label: "Balanço Patrimonial + DRE (últimos 2 anos)", required: true },
      { id: "v3g_pj_4", label: "Faturamento mensal — últimos 12 meses", required: true },
      { id: "v3g_pj_5", label: "Extrato bancário PJ (6 últimos meses)", required: true },
      { id: "v3g_pj_6", label: "Certidões Negativas (Federal, Estadual, Municipal)", required: true },
      { id: "v3g_pj_7", label: "RG e CPF dos sócios", required: true },
      { id: "v3g_pj_8", label: "Nota fiscal de faturamento (amostra 3 meses)", required: false },
    ],
  },
  "CGI — Grandes Empresas": {
    PF: [
      { id: "cgi_pf_1", label: "RG e CPF (ou CNH)", required: true },
      { id: "cgi_pf_2", label: "Comprovante de renda (3 últimos meses)", required: true },
      { id: "cgi_pf_3", label: "Matrícula do imóvel em garantia (máx. 30 dias)", required: true },
      { id: "cgi_pf_4", label: "IPTU do ano corrente", required: true },
      { id: "cgi_pf_5", label: "Laudo de avaliação do imóvel (CRECI)", required: true },
      { id: "cgi_pf_6", label: "Imposto de Renda completo + recibo", required: true },
      { id: "cgi_pf_7", label: "Extrato bancário (6 últimos meses)", required: true },
      { id: "cgi_pf_8", label: "3 fotos internas do imóvel em garantia", required: true, hint: "Ambientes principais: sala, quartos, cozinha" },
      { id: "cgi_pf_9", label: "3 fotos externas do imóvel em garantia", required: true, hint: "Fachada, lateral e área externa" },
    ],
    PJ: [
      { id: "cgi_pj_1", label: "Contrato Social + alterações", required: true },
      { id: "cgi_pj_2", label: "Cartão CNPJ atualizado", required: true },
      { id: "cgi_pj_3", label: "Balanço Patrimonial + DRE (últimos 2 anos)", required: true },
      { id: "cgi_pj_4", label: "Matrícula do imóvel em garantia", required: true },
      { id: "cgi_pj_5", label: "Laudo de avaliação do imóvel (CRECI)", required: true },
      { id: "cgi_pj_6", label: "IPTU do ano corrente", required: true },
      { id: "cgi_pj_7", label: "Faturamento mensal — últimos 12 meses", required: true },
      { id: "cgi_pj_8", label: "Certidões Negativas completas", required: true },
      { id: "cgi_pj_9", label: "RG e CPF dos sócios", required: true },
      { id: "cgi_pj_10", label: "3 fotos internas do imóvel em garantia", required: true, hint: "Ambientes principais: sala, quartos, cozinha" },
      { id: "cgi_pj_11", label: "3 fotos externas do imóvel em garantia", required: true, hint: "Fachada, lateral e área externa" },
    ],
  },
  "CPR Agro": {
    PF: [
      { id: "cpr_pf_1", label: "RG e CPF (ou CNH)", required: true },
      { id: "cpr_pf_2", label: "CAR — Cadastro Ambiental Rural", required: true },
      { id: "cpr_pf_3", label: "ITR — Imposto Territorial Rural", required: true },
      { id: "cpr_pf_4", label: "Comprovante de atividade rural", required: true },
      { id: "cpr_pf_5", label: "Imposto de Renda completo + recibo", required: true },
      { id: "cpr_pf_6", label: "Matrícula da propriedade rural (máx. 30 dias)", required: true },
    ],
    PJ: [
      { id: "cpr_pj_1", label: "Contrato Social + alterações", required: true },
      { id: "cpr_pj_2", label: "Cartão CNPJ atualizado", required: true },
      { id: "cpr_pj_3", label: "Balanço Patrimonial + DRE (últimos 3 anos)", required: true },
      { id: "cpr_pj_4", label: "CAR — Cadastro Ambiental Rural", required: true },
      { id: "cpr_pj_5", label: "ITR — Imposto Territorial Rural", required: true },
      { id: "cpr_pj_6", label: "Matrícula da propriedade rural", required: true },
      { id: "cpr_pj_7", label: "Contratos de comercialização (safra futura)", required: false },
      { id: "cpr_pj_8", label: "Certidões Negativas completas", required: true },
    ],
  },
  "Op. Internacional — Cash Collateral": {
    PF: [
      { id: "ficc_pf_1", label: "RG e CPF (ou CNH)", required: true },
      { id: "ficc_pf_2", label: "Comprovante de patrimônio internacional", required: true },
      { id: "ficc_pf_3", label: "Extrato de conta no exterior (6 meses)", required: true },
      { id: "ficc_pf_4", label: "Declaração BACEN (se aplicável)", required: true },
      { id: "ficc_pf_5", label: "Imposto de Renda + recibo", required: true },
    ],
    PJ: [
      { id: "ficc_pj_1", label: "Contrato Social + alterações", required: true },
      { id: "ficc_pj_2", label: "Cartão CNPJ atualizado", required: true },
      { id: "ficc_pj_3", label: "Balanço Patrimonial + DRE (últimos 3 anos)", required: true },
      { id: "ficc_pj_4", label: "Extrato de contas no exterior", required: true },
      { id: "ficc_pj_5", label: "Comprovante de capital no exterior (colateral)", required: true },
      { id: "ficc_pj_6", label: "Declaração BACEN Capital Estrangeiro", required: true },
      { id: "ficc_pj_7", label: "Certidões Negativas completas", required: true },
      { id: "ficc_pj_8", label: "Relatório de compliance AML/KYC", required: true },
    ],
  },
  "Op. Internacional — Garantia Imobiliária": {
    PF: [
      { id: "fii_pf_1", label: "RG e CPF (ou CNH)", required: true },
      { id: "fii_pf_2", label: "Imposto de Renda + recibo", required: true },
      { id: "fii_pf_3", label: "Comprovante de patrimônio e renda", required: true },
      { id: "fii_pf_4", label: "Documentação do imóvel internacional (se aplicável)", required: false },
    ],
    PJ: [
      { id: "fii_pj_1", label: "Contrato Social + alterações", required: true },
      { id: "fii_pj_2", label: "Cartão CNPJ atualizado", required: true },
      { id: "fii_pj_3", label: "Balanço Patrimonial + DRE (últimos 3 anos)", required: true },
      { id: "fii_pj_4", label: "Teaser do projeto imobiliário internacional", required: true },
      { id: "fii_pj_5", label: "Declaração BACEN Capital Estrangeiro", required: true },
      { id: "fii_pj_6", label: "Relatório de compliance AML/KYC", required: true },
      { id: "fii_pj_7", label: "Certidões Negativas completas", required: true },
    ],
  },
  "Crédito Ponto / CRI Início de Obra": {
    PF: [],
    PJ: [
      { id: "fcl_pj_1", label: "Contrato Social + todas as alterações", required: true },
      { id: "fcl_pj_2", label: "Cartão CNPJ atualizado", required: true },
      { id: "fcl_pj_3", label: "Balanço Patrimonial + DRE (últimos 3 anos)", required: true },
      { id: "fcl_pj_4", label: "Matrícula da área bruta do loteamento", required: true },
      { id: "fcl_pj_5", label: "Projeto de loteamento aprovado — SEURB/Prefeitura", required: true },
      { id: "fcl_pj_6", label: "Licença Ambiental (LP + LI + LO)", required: true },
      { id: "fcl_pj_7", label: "Orçamento de obras de infraestrutura", required: true },
      { id: "fcl_pj_8", label: "Cronograma físico-financeiro do loteamento", required: true },
      { id: "fcl_pj_9", label: "Estudo de viabilidade econômica (VGV e custos)", required: true },
      { id: "fcl_pj_10", label: "Certidões Negativas completas", required: true },
      { id: "fcl_pj_11", label: "RG e CPF dos sócios", required: true },
    ],
  },
  "Construtoras BTS — Build-to-Suit": {
    PF: [],
    PJ: [
      { id: "fce_pj_1", label: "Contrato Social + todas as alterações", required: true },
      { id: "fce_pj_2", label: "Cartão CNPJ atualizado", required: true },
      { id: "fce_pj_3", label: "Balanço Patrimonial + DRE (últimos 3 anos)", required: true },
      { id: "fce_pj_4", label: "Matrícula do terreno atualizada (máx. 30 dias)", required: true },
      { id: "fce_pj_5", label: "Projeto arquitetônico aprovado + HABITE-SE parcial (se retrofit)", required: true },
      { id: "fce_pj_6", label: "Licença Ambiental e Alvará de Construção", required: true },
      { id: "fce_pj_7", label: "Memorial descritivo do empreendimento", required: true },
      { id: "fce_pj_8", label: "Orçamento de obras + cronograma físico-financeiro", required: true },
      { id: "fce_pj_9", label: "Estudo de viabilidade (VGV, custo e margem)", required: true },
      { id: "fce_pj_10", label: "Contrato de venda de unidades (se houver)", required: false },
      { id: "fce_pj_11", label: "Certidões Negativas completas (PGFN, Receita, FGTS)", required: true },
      { id: "fce_pj_12", label: "RG e CPF dos sócios e cônjuges", required: true },
    ],
  },
};

export const DEFAULT_CHECKLIST = {
  PF: [
    { id: "def_pf_1", label: "RG e CPF (ou CNH)", required: true },
    { id: "def_pf_2", label: "Comprovante de renda (3 últimos meses)", required: true },
    { id: "def_pf_3", label: "Comprovante de residência (máx. 90 dias)", required: true },
    { id: "def_pf_4", label: "Imposto de Renda completo + recibo", required: true },
  ],
  PJ: [
    { id: "def_pj_1", label: "Contrato Social + alterações", required: true },
    { id: "def_pj_2", label: "Cartão CNPJ atualizado", required: true },
    { id: "def_pj_3", label: "Balanço Patrimonial + DRE", required: true },
    { id: "def_pj_4", label: "Certidões Negativas", required: true },
  ],
};

// ─── Linhas por nível ──────────────────────────────────────────────────────
const LEVEL_LINES: Record<string, string[]> = {
  NIVEL_1: [
    "V3Equity",
    "Home Equity",
    "Home Equity Distressed",
    "Giro Auto",
    "V3Auto",
    "Crédito no Aval",
    "Financiamento Imobiliário",
    "Capital Maquinários",
  ],
  NIVEL_2: [
    "HomeCash",
    "CGI — Grandes Empresas",
    "Cash Collateral",
    "Fundo Construção — Moradia",
    "Fundo Construção — Reforma",
    "Fundo Construção — Unifamiliar",
    "Fundo Construção — Geminados",
    "Financiamento — Brasileiros no Exterior",
    "CPR Agro",
    "Câmbio Pronto",
    "FINIMP — Financiamento de Importações",
    "ACC — Adiantamento s/ Contrato de Câmbio",
    "ACE — Adiantamento s/ Cambiais Entregues",
  ],
  NIVEL_3: [
    "Sale Leaseback Agro",
    "Op. Internacional — Cash Collateral",
    "CRI Cash Collateral",
    "Crédito Ponto / CRI Início de Obra",
    "Construtoras BTS — Build-to-Suit",
    "Fundo Incorporadoras",
    "Op. Internacional — Garantia Imobiliária",
  ],
};

type Tab = "cliente" | "operacao" | "documentos";

interface ImovelItem {
  endereco: string;
  cep: string;
  valor: string;
  cidade: string;
  estado: string;
  valorMedio: string;
  proprietarioMesmoTitular: boolean;
  proprietarioNome: string;
  zona: "" | "URBANO" | "RURAL";
  padrao: string;
  estilo: string;
  areaRural: string;
}

function defaultImovel(): ImovelItem {
  return {
    endereco: "",
    cep: "",
    valor: "",
    cidade: "",
    estado: "",
    valorMedio: "",
    proprietarioMesmoTitular: true,
    proprietarioNome: "",
    zona: "",
    padrao: "",
    estilo: "",
    areaRural: "",
  };
}

interface UploadedFile {
  fileKey: string;
  docId: string;
  name: string;
  size: number;   // KB
  status: "pending" | "uploading" | "done" | "error";
  file?: File;    // real File object, present while pending/uploading
}

// ─── Linhas que exigem Release do Cliente ─────────────────────────────────────
const RELEASE_LINES = [
  "Op. Internacional — Cash Collateral",
  "Op. Internacional — Garantia Imobiliária",
];

async function gerarReleasePDF() {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const W = 210;
  const M = 18;

  // Header navy
  doc.setFillColor(9, 8, 26);
  doc.rect(0, 0, W, 48, "F");

  // Logo
  try {
    const logoRes = await fetch("/logo.jpg");
    const blob = await logoRes.blob();
    const b64 = await new Promise<string>(res => {
      const fr = new FileReader();
      fr.onloadend = () => res(fr.result as string);
      fr.readAsDataURL(blob);
    });
    doc.addImage(b64, "JPEG", M, 8, 28, 28);
  } catch { /* logo opcional */ }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(240, 236, 228);
  doc.text("RELEASE DO CLIENTE", M + 34, 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(201, 168, 76);
  doc.text("MODELO PADRONIZADO — OPERAÇÕES INTERNACIONAIS", M + 34, 30);
  doc.setTextColor(122, 143, 168);
  doc.setFontSize(7);
  doc.text("V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · v3partners.com.br", M + 34, 38);

  // Gold line
  doc.setFillColor(201, 168, 76);
  doc.rect(0, 48, W, 0.7, "F");

  // Body bg
  doc.setFillColor(10, 22, 40);
  doc.rect(0, 48.7, W, 248.3, "F");

  let y = 60;
  const lineH = 7;
  const blank = "_____________________________";

  function gold(text: string) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(201, 168, 76);
    doc.text(text, M, y);
    y += 1.5;
    doc.setDrawColor(201, 168, 76);
    doc.setLineWidth(0.3);
    doc.line(M, y, W - M, y);
    y += 6;
  }

  function item(label: string) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(240, 236, 228);
    const lines = doc.splitTextToSize(`• ${label}: ${blank}`, W - M * 2 - 4);
    doc.text(lines, M + 3, y);
    y += lines.length * lineH;
    checkPage();
  }

  function sub(text: string) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(180, 200, 230);
    doc.text(text, M, y);
    y += lineH;
    checkPage();
  }

  function note(text: string) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(122, 143, 168);
    const lines = doc.splitTextToSize(text, W - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 5.5 + 2;
    checkPage();
  }

  function spacer(n = 4) { y += n; checkPage(); }

  function checkPage() {
    if (y > 274) {
      doc.addPage();
      doc.setFillColor(10, 22, 40);
      doc.rect(0, 0, W, 297, "F");
      y = 18;
    }
  }

  // 1. Identificação
  gold("1. IDENTIFICAÇÃO DO CLIENTE");
  item("Razão Social / Nome");
  item("CNPJ / CPF");
  item("Segmento / Atividade Principal");
  item("Tempo de Atuação no Mercado");
  item("Localização / Unidade Operacional");
  spacer();

  // 2. Resumo Executivo
  gold("2. RESUMO EXECUTIVO");
  note("Breve síntese do contexto geral do cliente, destacando perfil, momento atual e principais intenções de investimento.");
  note("Exemplo: \"Cliente com operação consolidada no segmento ___, em fase de expansão operacional, buscando captação para acelerar o projeto ___\".");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(240, 236, 228);
  for (let i = 0; i < 4; i++) {
    doc.text(blank + blank.slice(0, 10), M + 3, y);
    y += lineH;
    checkPage();
  }
  spacer();

  // 3. Planos de Investimento
  gold("3. PLANOS DE INVESTIMENTO");
  item("Objetivo da Captação");
  item("Valor Pretendido (R$)");
  sub("  Destinação dos Recursos:");
  item("Expansão");
  item("Reestruturação");
  item("Capital de Giro");
  item("Outras frentes");
  sub("  Prazos e Marcos Projetados:");
  item("Curto Prazo (0–6 meses)");
  item("Médio Prazo (6–18 meses)");
  item("Longo Prazo (18+ meses)");
  spacer();

  // 4. Situação Financeira
  gold("4. SITUAÇÃO FINANCEIRA ATUAL");
  sub("4.1 Faturamento");
  item("Média dos últimos 12 meses (R$)");
  item("Média dos últimos 24 meses (R$)");
  item("Tendência (Crescimento / Estabilidade / Queda)");
  spacer(2);
  sub("4.2 Estrutura Financeira");
  item("Endividamento Bancário");
  item("Comprometimento Mensal");
  item("Liquidez Operacional");
  spacer();

  // 5. Passivos e Exposições
  gold("5. PASSIVOS E EXPOSIÇÕES");
  sub("5.1 Apontamentos Trabalhistas");
  item("Quantidade total de ações");
  item("Principais riscos identificados");
  item("Status (ativos / arquivados / acordados)");
  item("Impacto estimado (se houver)");
  spacer(2);
  sub("5.2 Tributos em Aberto");
  item("Débitos inscritos em dívida ativa");
  item("Parcelamentos existentes");
  item("Risco de execução fiscal");
  item("Potencial impacto no fluxo de caixa");
  spacer(2);
  sub("5.3 Ações de Execução à Vista");
  note("(Execuções que exigem pagamentos imediatos ou negociáveis.)");
  item("Existência de execuções  Sim ( )  Não ( )");
  item("Valor total (R$)");
  item("Prazos e riscos");
  item("Ameaça a bens essenciais / garantias");
  spacer();

  // 6. Análise de Impacto Futuro
  gold("6. ANÁLISE DE IMPACTO FUTURO");
  note("Indicar se os passivos podem comprometer operações, garantias ou a conclusão da operação de crédito.");
  item("Impacto Potencial para Investidores / Fundo:  Baixo ( )  Médio ( )  Alto ( )");
  item("Principais pontos de atenção");
  item("Mitigações sugeridas");
  spacer();

  // 7. Considerações Finais
  gold("7. CONSIDERAÇÕES FINAIS");
  note("Sumário da viabilidade, pontos de risco e recomendação preliminar.");
  note("Exemplo: \"O cliente demonstra capacidade operacional e intenção clara de investimento. No entanto, alguns passivos trabalhistas e tributários precisam de acompanhamento para não comprometer garantias e a operação projetada.\"");
  for (let i = 0; i < 5; i++) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(240, 236, 228);
    doc.text(blank + blank, M + 3, y);
    y += lineH;
    checkPage();
  }
  spacer(6);

  // Assinatura
  doc.setDrawColor(201, 168, 76);
  doc.setLineWidth(0.3);
  doc.line(M, y, M + 70, y);
  doc.line(W - M - 70, y, W - M, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(122, 143, 168);
  doc.text("Assinatura do Responsável", M, y);
  doc.text("Data", W - M - 70, y);

  // Footer em todas as páginas
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(9, 8, 26);
    doc.rect(0, 285, W, 12, "F");
    doc.setFillColor(201, 168, 76);
    doc.rect(0, 285, W, 0.4, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(122, 143, 168);
    doc.text("v3partners.com.br  ·  Documento de uso interno — V3 Partners Soluções Ltda  ·  CNPJ 14.219.287/0001-50", W / 2, 290, { align: "center" });
    doc.text(`${p} / ${totalPages}`, W - M, 290, { align: "right" });
  }

  doc.save("release-cliente-v3partners.pdf");
}

interface NovaPropostaModalProps {
  open: boolean;
  onClose: () => void;
  level: string;
  partnerName: string;
  partnerId: string;
  onSubmit: (proposal: Record<string, unknown>) => Promise<string>;
}

export function NovaPropostaModal({ open, onClose, level, partnerName, partnerId, onSubmit }: NovaPropostaModalProps) {
  const [tab, setTab] = useState<Tab>("cliente");
  const [clientType, setClientType] = useState<"PF" | "PJ">("PF");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [gerandoPDF, setGerandoPDF] = useState(false);

  // Dados do cliente
  const [nome, setNome] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [rg, setRg] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [estadoCivil, setEstadoCivil] = useState("");
  const [renda, setRenda] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [socioResponsavel, setSocioResponsavel] = useState("");
  const [faturamento, setFaturamento] = useState("");
  const [enderecoRua, setEnderecoRua] = useState("");
  const [enderecoCity, setEnderecoCity] = useState("");
  const [enderecoUf, setEnderecoUf] = useState("");
  const [enderecoCep, setEnderecoCep] = useState("");

  // Restrição do cliente
  const [restricao, setRestricao] = useState<"" | "SIM" | "NAO">("");

  // Dados da operação
  const [creditLine, setCreditLine] = useState(LEVEL_LINES[level]?.[0] ?? "");
  const [valorSolicitado, setValorSolicitado] = useState("");
  const [prazo, setPrazo] = useState("");
  const [finalidade, setFinalidade] = useState("");
  const [imoveis, setImoveis] = useState<ImovelItem[]>([defaultImovel()]);
  const [observacoes, setObservacoes] = useState("");

  // Documentos
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  // Portfolio docs (checklist dinâmico)
  const [portfolioDocs, setPortfolioDocs] = useState<Record<string, { PF: { id: string; label: string; required: boolean }[]; PJ: { id: string; label: string; required: boolean }[] }>>({});
  // Linhas do portfolio agrupadas por nivel (vem do banco)
  const [portfolioLinesByNivel, setPortfolioLinesByNivel] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!open) return;
    fetch("/api/portfolio")
      .then(r => r.json())
      .then(({ linhas }) => {
        if (!Array.isArray(linhas)) return;
        const docsMap: Record<string, { PF: { id: string; label: string; required: boolean }[]; PJ: { id: string; label: string; required: boolean }[] }> = {};
        const nivelMap: Record<string, string[]> = {};
        for (const linha of linhas) {
          const toItems = (arr: { id: string; nome: string; obrigatorio: boolean }[]) =>
            arr.map(d => ({ id: d.id, label: d.nome, required: d.obrigatorio }));
          const pf = Array.isArray(linha.documentos_pf) && linha.documentos_pf.length > 0 ? toItems(linha.documentos_pf) : null;
          const pj = Array.isArray(linha.documentos_pj) && linha.documentos_pj.length > 0 ? toItems(linha.documentos_pj) : null;
          if (pf || pj) {
            docsMap[linha.nome.toLowerCase()] = { PF: pf ?? [], PJ: pj ?? [] };
          }
          // Agrupa nomes de linhas pelo nivel cadastrado no portfolio
          if (linha.nivel) {
            if (!nivelMap[linha.nivel]) nivelMap[linha.nivel] = [];
            nivelMap[linha.nivel].push(linha.nome);
          }
        }
        setPortfolioDocs(docsMap);
        setPortfolioLinesByNivel(nivelMap);
      })
      .catch(() => {});
  }, [open]);

  // CEP loading
  const [cepLoading, setCepLoading] = useState(false);
  const [cepLoadingIdx, setCepLoadingIdx] = useState<number | null>(null);

  // Usa linhas do portfolio pelo nivel se cadastradas, senão cai no hardcoded
  const lines = (portfolioLinesByNivel[level] ?? []).length > 0
    ? portfolioLinesByNivel[level]
    : (LEVEL_LINES[level] ?? []);
  // Usa checklist do portfólio se disponível, senão cai no hardcoded
  const checklist = portfolioDocs[creditLine.toLowerCase()]?.[clientType] ?? (CHECKLISTS[creditLine]?.[clientType]) ?? DEFAULT_CHECKLIST[clientType];

  const uploadedIds = [...new Set(uploadedFiles.filter((f) => f.status === "done" || f.status === "pending").map((f) => f.docId))];
  const requiredDocs = checklist.filter((d) => d.required);
  const completedRequired = requiredDocs.filter((d) => uploadedIds.includes(d.id)).length;

  function updateImovel(index: number, field: keyof ImovelItem, value: string | boolean) {
    setImoveis(prev => prev.map((im, i) => i === index ? { ...im, [field]: value } : im));
  }

  function queueFile(docId: string, file: File) {
    const fileKey = `${docId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const pending: UploadedFile = {
      fileKey, docId, name: file.name,
      size: Math.max(1, Math.round(file.size / 1024)),
      status: "pending",
      file,
    };
    setUploadedFiles((prev) => [...prev, pending]);
  }

  function removeFile(fileKey: string) {
    setUploadedFiles((prev) => prev.filter((f) => f.fileKey !== fileKey));
  }

  async function buscarCep(cep: string) {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return null;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.erro ? null : data as { logradouro: string; bairro: string; localidade: string; uf: string };
    } catch { return null; }
  }

  function maskCep(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  }

  async function handleEnderecoCepChange(value: string) {
    const masked = maskCep(value);
    setEnderecoCep(masked);
    if (value.replace(/\D/g, "").length === 8) {
      setCepLoading(true);
      const addr = await buscarCep(value);
      setCepLoading(false);
      if (addr) {
        setEnderecoRua(addr.logradouro ? `${addr.logradouro}${addr.bairro ? `, ${addr.bairro}` : ""}` : "");
        setEnderecoCity(addr.localidade ?? "");
        setEnderecoUf(addr.uf ?? "");
      }
    }
  }

  async function handleImovelCepChange(idx: number, value: string) {
    const masked = maskCep(value);
    updateImovel(idx, "cep", masked);
    if (value.replace(/\D/g, "").length === 8) {
      setCepLoadingIdx(idx);
      const addr = await buscarCep(value);
      setCepLoadingIdx(null);
      if (addr) {
        setImoveis(prev => prev.map((im, i) => i !== idx ? im : {
          ...im,
          cep: masked,
          endereco: addr.logradouro ? `${addr.logradouro}${addr.bairro ? `, ${addr.bairro}` : ""}` : im.endereco,
          cidade: addr.localidade ?? im.cidade,
          estado: addr.uf ?? im.estado,
        }));
      }
    }
  }

  function handleFileChange(docId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles: UploadedFile[] = Array.from(files).map((file) => ({
        fileKey: `${docId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        docId,
        name: file.name,
        size: Math.max(1, Math.round(file.size / 1024)),
        status: "pending" as const,
        file,
      }));
      setUploadedFiles((prev) => [...prev, ...newFiles]);
    }
    e.target.value = "";
  }

  async function handleSubmit() {
    setSaving(true);
    setSaveError(null);
    const code = `CRED-26-${String(Date.now()).slice(-6)}`;
    const clientName = clientType === "PF" ? nome : (razaoSocial || nomeFantasia);
    const imoveisData = imoveis.map(im => ({
      endereco: im.endereco || undefined,
      cep: im.cep || undefined,
      valor_medio: parseBRL(im.valorMedio) || undefined,
      cidade: im.cidade || undefined,
      estado: im.estado || undefined,
      zona: im.zona || undefined,
      padrao: im.padrao || undefined,
      estilo: im.estilo || undefined,
      area_rural: im.areaRural || undefined,
      proprietario: im.proprietarioMesmoTitular ? "MESMO_TITULAR" : (im.proprietarioNome || undefined),
    }));
    const metadata = {
      client_type: clientType,
      email: email || undefined,
      telefone: telefone || undefined,
      prazo: prazo || undefined,
      finalidade: finalidade || undefined,
      restricao_cliente: restricao || undefined,
      imoveis: imoveisData,
      observacoes: observacoes || undefined,
      // Dados PF
      rg: rg || undefined,
      nascimento: nascimento || undefined,
      estado_civil: estadoCivil || undefined,
      renda_mensal: renda ? parseBRL(renda) || undefined : undefined,
      // Dados PJ
      razao_social: razaoSocial || undefined,
      nome_fantasia: nomeFantasia || undefined,
      socio_responsavel: socioResponsavel || undefined,
      faturamento_mensal: faturamento ? parseBRL(faturamento) || undefined : undefined,
      // Endereço
      endereco_rua: enderecoRua || undefined,
      endereco_cidade: enderecoCity || undefined,
      endereco_uf: enderecoUf || undefined,
      endereco_cep: enderecoCep || undefined,
    };
    const proposal = {
      id: `new-${Date.now()}`,
      code,
      title: `${creditLine} — ${clientName}`,
      client_name: clientName,
      client_type: clientType,
      cpf_cnpj: cpfCnpj,
      email,
      telefone,
      credit_line: creditLine,
      requested_value: parseBRL(valorSolicitado),
      approved_value: null,
      prazo,
      finalidade,
      current_level: level,
      status: "PENDING",
      stage: "RECEBIDO",
      partner_id: partnerId,
      partner_name: partnerName,
      docs_uploaded: uploadedIds.length,
      docs_required: requiredDocs.length,
      created_at: new Date().toISOString(),
      restricao_cliente: restricao || undefined,
      imoveis: imoveisData,
      metadata,
    };
    try {
      const proposalId = await onSubmit(proposal);

      // Upload real dos arquivos selecionados
      const toUpload = uploadedFiles.filter(f => f.status === "pending" && f.file);
      for (const uf of toUpload) {
        setUploadedFiles(prev => prev.map(f => f.fileKey === uf.fileKey ? { ...f, status: "uploading" } : f));
        try {
          const form = new FormData();
          form.append("file", uf.file!);
          form.append("proposal_id", proposalId);
          form.append("doc_id", uf.docId);
          const res = await fetch("/api/credit-proposals/documents", { method: "POST", body: form });
          if (res.ok) {
            setUploadedFiles(prev => prev.map(f => f.fileKey === uf.fileKey ? { ...f, status: "done", file: undefined } : f));
          } else {
            setUploadedFiles(prev => prev.map(f => f.fileKey === uf.fileKey ? { ...f, status: "error" } : f));
          }
        } catch {
          setUploadedFiles(prev => prev.map(f => f.fileKey === uf.fileKey ? { ...f, status: "error" } : f));
        }
      }

      setSubmitted(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro ao salvar proposta. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setSubmitted(false);
    setSaving(false);
    setSaveError(null);
    setTab("cliente");
    setClientType("PF");
    // Dados PF
    setNome(""); setCpfCnpj(""); setEmail(""); setTelefone("");
    setRg(""); setNascimento(""); setEstadoCivil(""); setRenda("");
    // Dados PJ
    setRazaoSocial(""); setNomeFantasia(""); setSocioResponsavel(""); setFaturamento("");
    // Endereço
    setEnderecoRua(""); setEnderecoCity(""); setEnderecoUf(""); setEnderecoCep("");
    // Operação
    setCreditLine(LEVEL_LINES[level]?.[0] ?? "");
    setValorSolicitado(""); setPrazo(""); setFinalidade("");
    setRestricao(""); setObservacoes("");
    setImoveis([defaultImovel()]);
    setUploadedFiles([]);
    onClose();
  }

  if (!open) return null;

  const tabLabels: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "cliente", label: "Dados do Cliente", icon: <User className="w-4 h-4" /> },
    { key: "operacao", label: "Operação", icon: <TrendingUp className="w-4 h-4" /> },
    { key: "documentos", label: `Documentos (${completedRequired}/${requiredDocs.length})`, icon: <FileText className="w-4 h-4" /> },
  ];

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-card border border-border rounded-2xl p-10 max-w-md w-full text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Proposta Enviada!</h2>
          <p className="text-sm text-muted-foreground mb-1">
            A proposta foi registrada e vinculada ao partner:
          </p>
          <p className="text-base font-semibold text-primary mb-4">{partnerName}</p>
          <p className="text-xs text-muted-foreground mb-6">
            A Mesa Operacional irá analisar e mover para a próxima etapa.
          </p>
          <Button onClick={handleClose} className="w-full">Fechar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-white">Nova Proposta</h2>
            <p className="text-xs text-muted-foreground">Partner: <span className="text-primary">{partnerName}</span></p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* PF / PJ Toggle */}
        <div className="px-6 pt-4 flex gap-2">
          <button
            onClick={() => setClientType("PF")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
              clientType === "PF"
                ? "bg-primary/15 border-primary/40 text-primary"
                : "border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            <User className="w-4 h-4" /> Pessoa Física (PF)
          </button>
          <button
            onClick={() => setClientType("PJ")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
              clientType === "PJ"
                ? "bg-primary/15 border-primary/40 text-primary"
                : "border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            <Building2 className="w-4 h-4" /> Pessoa Jurídica (PJ)
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-3 flex gap-1 border-b border-border">
          {tabLabels.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all -mb-px border-b-2 ${
                tab === t.key
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── BANNER: Release do Cliente (Op. Internacional) ── */}
          {RELEASE_LINES.includes(creditLine) && (
            <div className="mb-5 rounded-xl border border-[#C9A84C]/40 bg-[#C9A84C]/08 p-4"
              style={{ background: "rgba(201,168,76,0.07)" }}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.35)" }}>
                  <FileText className="w-4 h-4 text-[#C9A84C]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-wide mb-0.5">
                    Release do Cliente — Obrigatório
                  </p>
                  <p className="text-[11px] text-[#7A8FA8] leading-relaxed">
                    Esta linha exige o preenchimento do <strong className="text-[#F0ECE4]">Release do Cliente</strong> pelo prospect antes da análise. Baixe o formulário, envie ao cliente e anexe o PDF preenchido à proposta.
                  </p>
                </div>
                <button
                  onClick={async () => {
                    setGerandoPDF(true);
                    try { await gerarReleasePDF(); } finally { setGerandoPDF(false); }
                  }}
                  disabled={gerandoPDF}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold flex-shrink-0 transition-all disabled:opacity-60"
                  style={{
                    background: "rgba(201,168,76,0.15)",
                    border: "1px solid rgba(201,168,76,0.4)",
                    color: "#C9A84C",
                  }}
                >
                  {gerandoPDF
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando…</>
                    : <><Download className="w-3.5 h-3.5" /> Baixar Release</>}
                </button>
              </div>
            </div>
          )}

          {/* ── TAB: CLIENTE ── */}
          {tab === "cliente" && (
            <div className="space-y-4">
              {clientType === "PF" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Nome completo *" value={nome} onChange={setNome} placeholder="João da Silva" />
                    <Field label="CPF *" value={cpfCnpj} onChange={setCpfCnpj} placeholder="000.000.000-00" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="RG" value={rg} onChange={setRg} placeholder="00.000.000-0" />
                    <Field label="Data de Nascimento *" value={nascimento} onChange={setNascimento} type="date" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="E-mail *" value={email} onChange={setEmail} placeholder="joao@email.com" type="email" />
                    <Field label="Telefone *" value={telefone} onChange={setTelefone} placeholder="(11) 99999-0000" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField label="Estado Civil" value={estadoCivil} onChange={setEstadoCivil}
                      options={["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União Estável"]} />
                    <CurrencyField label="Renda Mensal (R$) *" value={renda} onChange={setRenda} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <CepField label="CEP" value={enderecoCep} onChange={handleEnderecoCepChange} loading={cepLoading} />
                    <Field label="UF" value={enderecoUf} onChange={setEnderecoUf} placeholder="SP" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Endereço" value={enderecoRua} onChange={setEnderecoRua} placeholder="Rua, número, bairro" />
                    <Field label="Cidade" value={enderecoCity} onChange={setEnderecoCity} placeholder="São Paulo" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Restrição cadastral / financeira *</label>
                    <div className="flex gap-2">
                      {[{ val: "NAO", label: "Sem restrição", color: "emerald" }, { val: "SIM", label: "Com restrição", color: "red" }].map(opt => (
                        <button key={opt.val} type="button"
                          onClick={() => setRestricao(opt.val as "SIM" | "NAO")}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
                            restricao === opt.val
                              ? opt.color === "emerald"
                                ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-400"
                                : "bg-red-500/15 border-red-500/50 text-red-400"
                              : "bg-transparent border-border text-muted-foreground hover:border-primary/40"
                          }`}
                        >{opt.label}</button>
                      ))}
                    </div>
                    {restricao === "SIM" && (
                      <p className="text-[10px] text-red-400 mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Cliente possui restrição — detalhar em Observações
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Razão Social *" value={razaoSocial} onChange={setRazaoSocial} placeholder="Empresa Ltda" />
                    <Field label="CNPJ *" value={cpfCnpj} onChange={setCpfCnpj} placeholder="00.000.000/0001-00" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Nome Fantasia" value={nomeFantasia} onChange={setNomeFantasia} placeholder="Nome fantasia" />
                    <Field label="Sócio Responsável *" value={socioResponsavel} onChange={setSocioResponsavel} placeholder="Nome do sócio" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="E-mail *" value={email} onChange={setEmail} placeholder="contato@empresa.com" type="email" />
                    <Field label="Telefone *" value={telefone} onChange={setTelefone} placeholder="(11) 3000-0000" />
                  </div>
                  <CurrencyField label="Faturamento Anual (R$) *" value={faturamento} onChange={setFaturamento} />
                  <div className="grid grid-cols-2 gap-3">
                    <CepField label="CEP da Empresa" value={enderecoCep} onChange={handleEnderecoCepChange} loading={cepLoading} />
                    <Field label="UF" value={enderecoUf} onChange={setEnderecoUf} placeholder="SP" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Endereço da Empresa" value={enderecoRua} onChange={setEnderecoRua} placeholder="Rua, número, bairro" />
                    <Field label="Cidade" value={enderecoCity} onChange={setEnderecoCity} placeholder="São Paulo" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Restrição cadastral / financeira *</label>
                    <div className="flex gap-2">
                      {[{ val: "NAO", label: "Sem restrição", color: "emerald" }, { val: "SIM", label: "Com restrição", color: "red" }].map(opt => (
                        <button key={opt.val} type="button"
                          onClick={() => setRestricao(opt.val as "SIM" | "NAO")}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
                            restricao === opt.val
                              ? opt.color === "emerald"
                                ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-400"
                                : "bg-red-500/15 border-red-500/50 text-red-400"
                              : "bg-transparent border-border text-muted-foreground hover:border-primary/40"
                          }`}
                        >{opt.label}</button>
                      ))}
                    </div>
                    {restricao === "SIM" && (
                      <p className="text-[10px] text-red-400 mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Empresa possui restrição — detalhar em Observações
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── TAB: OPERAÇÃO ── */}
          {tab === "operacao" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Linha de Crédito *"
                  value={creditLine}
                  onChange={setCreditLine}
                  options={lines}
                />
                <CurrencyField label="Valor Solicitado (R$) *" value={valorSolicitado} onChange={setValorSolicitado} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Prazo desejado"
                  value={prazo}
                  onChange={setPrazo}
                  options={["12 meses", "24 meses", "36 meses", "48 meses", "60 meses", "84 meses", "120 meses", "180 meses", "240 meses"]}
                />
                <SelectField
                  label="Finalidade"
                  value={finalidade}
                  onChange={setFinalidade}
                  options={["Capital de Giro", "Investimento", "Refinanciamento", "Aquisição", "Expansão", "Outro"]}
                />
              </div>

              {(creditLine === "Home Equity" || creditLine === "Home Equity Distressed" || creditLine === "V3Equity" || creditLine === "CRI Cash Collateral" || creditLine === "HomeCash" || creditLine === "CGI — Grandes Empresas" || creditLine === "Fundo Construção — Moradia" || creditLine === "Fundo Construção — Reforma" || creditLine === "Fundo Construção — Unifamiliar" || creditLine === "Fundo Construção — Geminados" || creditLine === "Crédito Ponto / CRI Início de Obra" || creditLine === "Construtoras BTS — Build-to-Suit" || creditLine === "Fundo Incorporadoras" || creditLine === "Sale Leaseback Agro" || creditLine === "Op. Internacional — Garantia Imobiliária") && (
                <div className="space-y-3">
                  {imoveis.map((im, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                          <Home className="w-3.5 h-3.5" /> {imoveis.length > 1 ? `Imóvel ${idx + 1}` : "Dados do Imóvel em Garantia"}
                        </p>
                        {imoveis.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setImoveis(prev => prev.filter((_, i) => i !== idx))}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
                          >
                            <X className="w-3 h-3" /> Remover
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <CepField label="CEP do Imóvel" value={im.cep} onChange={v => handleImovelCepChange(idx, v)} loading={cepLoadingIdx === idx} />
                        <Field label="Endereço do Imóvel" value={im.endereco} onChange={v => updateImovel(idx, "endereco", v)} placeholder="Rua, número, bairro" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Cidade do Imóvel *" value={im.cidade} onChange={v => updateImovel(idx, "cidade", v)} placeholder="Ex: São Paulo" />
                        <SelectField
                          label="Estado (UF) *"
                          value={im.estado}
                          onChange={v => updateImovel(idx, "estado", v)}
                          options={["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <CurrencyField label="Valor Médio de Avaliação (R$) *" value={im.valorMedio} onChange={v => updateImovel(idx, "valorMedio", v)} />
                        <CurrencyField label="Valor Estimado pelo Cliente (R$)" value={im.valor} onChange={v => updateImovel(idx, "valor", v)} />
                      </div>
                      {(() => {
                        const baseVal = parseBRL(im.valorMedio || im.valor);
                        const solVal  = parseBRL(valorSolicitado);
                        if (baseVal > 0 && solVal > 0) {
                          const ltv = (solVal / baseVal) * 100;
                          return (
                            <div className="text-xs text-muted-foreground">
                              LTV estimado:{" "}
                              <span className={`font-bold ${ltv > 70 ? "text-red-400" : "text-emerald-400"}`}>
                                {ltv.toFixed(1)}%
                              </span>
                              <span className="ml-1 text-muted-foreground">(máx. 70%)</span>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Zona / Tipo / Padrão */}
                      <div className="border-t border-amber-500/20 pt-3 space-y-3">
                        <p className="text-xs font-semibold text-amber-400">Características do Imóvel</p>

                        {/* Urbano / Rural */}
                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Localização *</label>
                          <div className="flex gap-2">
                            {[{ val: "URBANO", label: "Imóvel Urbano" }, { val: "RURAL", label: "Imóvel Rural" }].map(opt => (
                              <button key={opt.val} type="button"
                                onClick={() => {
                                  setImoveis(prev => prev.map((im2, i2) =>
                                    i2 === idx ? { ...im2, zona: opt.val as "URBANO" | "RURAL", estilo: "", padrao: "", areaRural: "" } : im2
                                  ));
                                }}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
                                  im.zona === opt.val
                                    ? "bg-amber-500/15 border-amber-500/50 text-amber-400"
                                    : "bg-transparent border-border text-muted-foreground hover:border-primary/40"
                                }`}
                              >{opt.label}</button>
                            ))}
                          </div>
                        </div>

                        {/* URBANO: padrão + estilo */}
                        {im.zona === "URBANO" && (
                          <>
                            <div>
                              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Padrão do Imóvel *</label>
                              <div className="flex gap-2">
                                {[
                                  { val: "BAIXO", label: "Baixo Padrão" },
                                  { val: "MEDIO", label: "Médio Padrão" },
                                  { val: "ALTO", label: "Alto Padrão" },
                                ].map(opt => (
                                  <button key={opt.val} type="button"
                                    onClick={() => updateImovel(idx, "padrao", opt.val)}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
                                      im.padrao === opt.val
                                        ? "bg-primary/15 border-primary/40 text-primary"
                                        : "bg-transparent border-border text-muted-foreground hover:border-primary/40"
                                    }`}
                                  >{opt.label}</button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Tipo / Estilo do Imóvel *</label>
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  "Casa de Rua",
                                  "Apartamento",
                                  "Casa em Condomínio",
                                  "Sala Comercial",
                                  "Terreno",
                                  "Imóvel Operacional",
                                ].map(opt => (
                                  <button key={opt} type="button"
                                    onClick={() => updateImovel(idx, "estilo", opt)}
                                    className={`py-2 rounded-lg text-xs font-bold border transition-colors ${
                                      im.estilo === opt
                                        ? "bg-primary/15 border-primary/40 text-primary"
                                        : "bg-transparent border-border text-muted-foreground hover:border-primary/40"
                                    }`}
                                  >{opt}</button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}

                        {/* RURAL: tamanho da propriedade */}
                        {im.zona === "RURAL" && (
                          <Field
                            label="Tamanho da Propriedade Rural *"
                            value={im.areaRural}
                            onChange={v => updateImovel(idx, "areaRural", v)}
                            placeholder="Ex: 150 hectares, 500 alqueires..."
                          />
                        )}
                      </div>

                      {/* Proprietário na matrícula */}
                      <div className="border-t border-amber-500/20 pt-3 space-y-2">
                        <p className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5" /> Proprietário conforme Matrícula
                        </p>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={im.proprietarioMesmoTitular}
                            onChange={e => {
                              updateImovel(idx, "proprietarioMesmoTitular", e.target.checked);
                              if (e.target.checked) updateImovel(idx, "proprietarioNome", "");
                            }}
                            className="w-4 h-4 accent-amber-400"
                          />
                          <span className="text-xs text-white">Mesmo titular da operação</span>
                        </label>
                        {!im.proprietarioMesmoTitular && (
                          <Field
                            label="Nome do proprietário conforme matrícula *"
                            value={im.proprietarioNome}
                            onChange={v => updateImovel(idx, "proprietarioNome", v)}
                            placeholder="Nome exato conforme consta na matrícula do imóvel"
                          />
                        )}
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setImoveis(prev => [...prev, defaultImovel()])}
                    className="w-full py-2.5 rounded-xl border border-dashed border-amber-500/40 text-xs font-bold text-amber-400 hover:bg-amber-500/5 transition-colors flex items-center justify-center gap-2"
                  >
                    + Adicionar Imóvel
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Observações adicionais</label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={3}
                  placeholder="Informações relevantes sobre a operação..."
                  className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                />
              </div>

              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs font-semibold text-primary mb-1">Partner Vinculado</p>
                <p className="text-sm text-white">{partnerName}</p>
                <p className="text-xs text-muted-foreground">ID: {partnerId}</p>
              </div>
            </div>
          )}

          {/* ── TAB: DOCUMENTOS ── */}
          {tab === "documentos" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">
                  Checklist para <span className="font-semibold text-white">{creditLine}</span> — {clientType === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
                </p>
                <Badge className={`text-xs ${completedRequired === requiredDocs.length && requiredDocs.length > 0 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border-amber-500/30"}`}>
                  {completedRequired}/{requiredDocs.length} obrigatórios
                </Badge>
              </div>

              {checklist.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Selecione a linha de crédito na aba Operação.</p>
              ) : (
                checklist.map((doc) => {
                  const docFiles = uploadedFiles.filter((f) => f.docId === doc.id);
                  const hasUploading = docFiles.some((f) => f.status === "uploading");
                  const hasPending = docFiles.some((f) => f.status === "pending");
                  const hasDone = docFiles.some((f) => f.status === "done");
                  return (
                    <div key={doc.id} className={`p-3 rounded-xl border transition-all ${
                      hasDone
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : hasPending
                        ? "border-primary/30 bg-primary/5"
                        : "border-border bg-secondary/30"
                    }`}>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {hasDone ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : hasUploading ? (
                            <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                          ) : hasPending ? (
                            <CheckCircle2 className="w-5 h-5 text-primary/70" />
                          ) : (
                            <Circle className={`w-5 h-5 ${doc.required ? "text-amber-400" : "text-muted-foreground"}`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${hasDone ? "text-emerald-300" : "text-foreground"}`}>
                            {doc.label}
                            {doc.required && <span className="text-red-400 ml-1">*</span>}
                          </p>
                          {"hint" in doc && (doc as { hint?: string }).hint && <p className="text-xs text-muted-foreground">{(doc as { hint?: string }).hint}</p>}
                          {docFiles.length > 0 && (
                            <div className="mt-1.5 space-y-1">
                              {docFiles.map((f) => (
                                <div key={f.fileKey} className="flex items-center gap-2">
                                  {f.status === "uploading" ? (
                                    <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
                                  ) : f.status === "error" ? (
                                    <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                                  ) : f.status === "pending" ? (
                                    <div className="w-3 h-3 rounded-full border-2 border-primary/50 flex-shrink-0" />
                                  ) : (
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                                  )}
                                  <span className={`text-xs truncate flex-1 ${f.status === "error" ? "text-red-400" : "text-muted-foreground"}`}>
                                    {f.name} — {f.size} KB{f.status === "pending" ? " · aguardando envio" : f.status === "error" ? " · erro no envio" : ""}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeFile(f.fileKey)}
                                    className="text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <label className="flex-shrink-0 cursor-pointer">
                          <input type="file" multiple className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => handleFileChange(doc.id, e)} />
                          <span className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            hasDone
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-secondary border border-border text-muted-foreground hover:text-white hover:border-primary/50"
                          }`}>
                            <Upload className="w-3 h-3" />
                            {hasDone ? "+ Adicionar" : "Upload"}
                          </span>
                        </label>
                      </div>
                    </div>
                  );
                })
              )}

              <p className="text-xs text-muted-foreground pt-2">
                Formatos aceitos: PDF, JPG, PNG, DOC, DOCX · Tamanho máximo: 10 MB por arquivo
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
          <div className="flex gap-2">
            {tab !== "cliente" && (
              <Button variant="outline" size="sm" onClick={() => setTab(tab === "documentos" ? "operacao" : "cliente")}>
                Voltar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
            {tab !== "documentos" ? (
              <Button size="sm" onClick={() => setTab(tab === "cliente" ? "operacao" : "documentos")}>
                Próximo <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <div className="flex flex-col items-end gap-1">
                {saveError && (
                  <p className="text-xs text-red-400 max-w-xs text-right">{saveError}</p>
                )}
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={(!nome && !razaoSocial) || saving}
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  {saving ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Salvando...
                    </span>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-1.5" />
                      Enviar Proposta
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function parseBRL(v: string): number {
  if (!v) return 0;
  return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
}

function applyBRLMask(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10);
  return (num / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
      />
    </div>
  );
}

function CepField({ label, value, onChange, loading }: {
  label: string; value: string; onChange: (v: string) => void; loading?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}</label>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="00000-000"
          maxLength={9}
          className="w-full h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}
      </div>
      {loading && <p className="text-[10px] text-muted-foreground mt-1">Buscando endereço...</p>}
    </div>
  );
}

function CurrencyField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none pointer-events-none">R$</span>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(applyBRLMask(e.target.value))}
          placeholder={placeholder ?? "0,00"}
          className="w-full h-9 pl-8 pr-3 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
      >
        <option value="">Selecione...</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
