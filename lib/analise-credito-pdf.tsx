// Relatório de Análise de Crédito para Comitê — PDF gerado server-side
// Usa @react-pdf/renderer (já instalado no projeto)

import React from "react";
import {
  Document, Page, View, Text, StyleSheet, renderToBuffer,
} from "@react-pdf/renderer";

export interface AnaliseCredito {
  proposal_code: string;
  client_name: string;
  credit_line: string;
  current_level: string;
  requested_value: number;
  partner_name?: string;
  created_at: string;
  generated_at: string;

  // Resultado da IA
  resumo_executivo: string;
  parecer: "FAVORÁVEL" | "DESFAVORÁVEL" | "CONDICIONADO";
  score_risco: "BAIXO" | "MÉDIO" | "ALTO";

  cinco_cs: {
    carater: string;
    capacidade: string;
    capital: string;
    colateral: string;
    condicoes: string;
  };

  analise_financeira: string;
  capacidade_pagamento: string;
  comprometimento_renda: string;
  gap_analise: string;

  pontos_criticos: string[];
  pontos_atencao: string[];
  pontos_positivos: string[];

  analise_documentos: string;
  historico_operacao: string;
  parecer_final: string;
}

const GOLD = "#C9A84C";
const NAVY = "#09081A";
const NAVY2 = "#0D1929";
const CREAM = "#F0ECE4";
const MUTED = "#7A8FA8";
const RED = "#EF4444";
const AMBER = "#F59E0B";
const GREEN = "#10B981";

const styles = StyleSheet.create({
  page: {
    backgroundColor: NAVY,
    paddingHorizontal: 36,
    paddingVertical: 32,
    fontFamily: "Helvetica",
    color: CREAM,
    fontSize: 9,
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: GOLD,
    paddingBottom: 12,
    marginBottom: 16,
  },
  brand: { fontSize: 14, fontFamily: "Helvetica-Bold", color: GOLD, letterSpacing: 1.5 },
  brandSub: { fontSize: 7, color: MUTED, marginTop: 2 },
  headerRight: { alignItems: "flex-end" },
  headerCode: { fontSize: 11, fontFamily: "Helvetica-Bold", color: CREAM },
  headerDate: { fontSize: 7, color: MUTED, marginTop: 2 },
  // Parecer badge
  parecerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  parecerBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 4, borderWidth: 1,
  },
  parecerText: { fontSize: 10, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  riscoBadge: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 4, borderWidth: 1,
    marginLeft: 6,
  },
  // Section
  section: {
    marginBottom: 14,
    backgroundColor: NAVY2,
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1B3050",
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#1B3050",
    paddingBottom: 4,
  },
  text: { fontSize: 8.5, color: CREAM, lineHeight: 1.5 },
  muted: { fontSize: 7.5, color: MUTED, lineHeight: 1.4 },
  // 5Cs grid
  csGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  csItem: {
    width: "47%",
    backgroundColor: "#111F35",
    borderRadius: 5,
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
  },
  csLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: GOLD, letterSpacing: 0.5, marginBottom: 3 },
  csText: { fontSize: 8, color: CREAM, lineHeight: 1.4 },
  // Pontos
  pointRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 3 },
  bullet: { width: 12, fontSize: 8, fontFamily: "Helvetica-Bold" },
  pointText: { flex: 1, fontSize: 8, lineHeight: 1.4 },
  // Info rows
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#1B3050",
  },
  infoLabel: { fontSize: 7.5, color: MUTED },
  infoValue: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: CREAM },
  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#1B3050",
    paddingTop: 8,
  },
  footerText: { fontSize: 6.5, color: MUTED },
});

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function parecerColors(p: string) {
  if (p === "FAVORÁVEL") return { border: GREEN, text: GREEN, bg: "#052e1c" };
  if (p === "DESFAVORÁVEL") return { border: RED, text: RED, bg: "#1f0606" };
  return { border: AMBER, text: AMBER, bg: "#1a1000" };
}
function riscoColors(r: string) {
  if (r === "BAIXO") return { border: GREEN, text: GREEN };
  if (r === "ALTO") return { border: RED, text: RED };
  return { border: AMBER, text: AMBER };
}

function PointList({ items, color, prefix }: { items: string[]; color: string; prefix: string }) {
  if (!items.length) return <Text style={styles.muted}>Nenhum item identificado.</Text>;
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={styles.pointRow}>
          <Text style={[styles.bullet, { color }]}>{prefix}</Text>
          <Text style={[styles.pointText, { color: CREAM }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function AnaliseCreditoDoc({ data }: { data: AnaliseCredito }) {
  const pc = parecerColors(data.parecer);
  const rc = riscoColors(data.score_risco);
  const levelLabel: Record<string, string> = {
    NIVEL_1: "Nível 1 — Varejo",
    NIVEL_2: "Nível 2 — Estruturado",
    NIVEL_3: "Nível 3 — High Ticket",
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>V3 PARTNERS</Text>
            <Text style={styles.brandSub}>Relatório de Comitê de Crédito — Análise por Inteligência Artificial</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerCode}>{data.proposal_code}</Text>
            <Text style={styles.headerDate}>Gerado em {fmtDate(data.generated_at)}</Text>
          </View>
        </View>

        {/* PARECER BADGE */}
        <View style={styles.parecerRow}>
          <View style={[styles.parecerBadge, { borderColor: pc.border, backgroundColor: pc.bg }]}>
            <Text style={[styles.parecerText, { color: pc.text }]}>PARECER: {data.parecer}</Text>
          </View>
          <View style={[styles.riscoBadge, { borderColor: rc.border }]}>
            <Text style={[styles.parecerText, { color: rc.text, fontSize: 8 }]}>RISCO {data.score_risco}</Text>
          </View>
        </View>

        {/* INFO GERAL */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados da Operação</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cliente</Text>
            <Text style={styles.infoValue}>{data.client_name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Linha de Crédito</Text>
            <Text style={styles.infoValue}>{data.credit_line}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nível</Text>
            <Text style={styles.infoValue}>{levelLabel[data.current_level] ?? data.current_level}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Capital Solicitado</Text>
            <Text style={[styles.infoValue, { color: GOLD }]}>{fmtCurrency(data.requested_value)}</Text>
          </View>
          {data.partner_name && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Partner Responsável</Text>
              <Text style={styles.infoValue}>{data.partner_name}</Text>
            </View>
          )}
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>Data da Proposta</Text>
            <Text style={styles.infoValue}>{fmtDate(data.created_at)}</Text>
          </View>
        </View>

        {/* RESUMO EXECUTIVO */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumo Executivo</Text>
          <Text style={styles.text}>{data.resumo_executivo}</Text>
        </View>

        {/* 5 C's */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Os 5 C&apos;s do Crédito</Text>
          <View style={styles.csGrid}>
            {([
              { label: "CARÁTER", value: data.cinco_cs.carater },
              { label: "CAPACIDADE", value: data.cinco_cs.capacidade },
              { label: "CAPITAL", value: data.cinco_cs.capital },
              { label: "COLATERAL", value: data.cinco_cs.colateral },
              { label: "CONDIÇÕES", value: data.cinco_cs.condicoes },
            ]).map(({ label, value }) => (
              <View key={label} style={styles.csItem}>
                <Text style={styles.csLabel}>{label}</Text>
                <Text style={styles.csText}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ANÁLISE FINANCEIRA */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Análise Financeira</Text>
          <Text style={[styles.text, { marginBottom: 6 }]}>{data.analise_financeira}</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Capacidade de Pagamento Estimada</Text>
            <Text style={[styles.infoValue, { color: GREEN }]}>{data.capacidade_pagamento}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Comprometimento de Renda</Text>
            <Text style={styles.infoValue}>{data.comprometimento_renda}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0, marginTop: 4 }]}>
            <Text style={[styles.text, { flex: 1, color: AMBER }]}>{data.gap_analise}</Text>
          </View>
        </View>

        {/* PONTOS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pontos da Operação</Text>
          {data.pontos_criticos.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text style={[styles.csLabel, { color: RED, marginBottom: 4 }]}>🔴 CRÍTICOS</Text>
              <PointList items={data.pontos_criticos} color={RED} prefix="✕ " />
            </View>
          )}
          {data.pontos_atencao.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text style={[styles.csLabel, { color: AMBER, marginBottom: 4 }]}>🟡 ATENÇÃO</Text>
              <PointList items={data.pontos_atencao} color={AMBER} prefix="! " />
            </View>
          )}
          {data.pontos_positivos.length > 0 && (
            <View>
              <Text style={[styles.csLabel, { color: GREEN, marginBottom: 4 }]}>🟢 POSITIVOS</Text>
              <PointList items={data.pontos_positivos} color={GREEN} prefix="✓ " />
            </View>
          )}
        </View>

        {/* DOCUMENTOS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Análise de Documentos</Text>
          <Text style={styles.text}>{data.analise_documentos}</Text>
        </View>

        {/* HISTÓRICO */}
        {data.historico_operacao && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Histórico da Operação</Text>
            <Text style={styles.text}>{data.historico_operacao}</Text>
          </View>
        )}

        {/* PARECER FINAL */}
        <View style={[styles.section, { borderColor: pc.border, borderWidth: 1 }]}>
          <Text style={[styles.sectionTitle, { color: pc.text }]}>Parecer Final ao Comitê</Text>
          <Text style={styles.text}>{data.parecer_final}</Text>
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>V3 Partners — Documento Confidencial — Uso Restrito ao Comitê de Crédito</Text>
          <Text style={styles.footerText}>Análise gerada por IA (claude-sonnet-4-6) • {fmtDate(data.generated_at)}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderAnalisePDF(data: AnaliseCredito): Promise<Buffer> {
  return renderToBuffer(<AnaliseCreditoDoc data={data} />);
}
