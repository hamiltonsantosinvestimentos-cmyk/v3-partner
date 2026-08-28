// Comprovante / Demonstrativo de Comissão do Partner — PDF gerado server-side
// Usa @react-pdf/renderer (mesmo padrão de lib/analise-credito-pdf.tsx)

import React from "react";
import {
  Document, Page, View, Text, StyleSheet, renderToBuffer,
} from "@react-pdf/renderer";

export interface ComprovanteComissao {
  code: string;
  partnerName: string;
  operationType: string;
  operationDescription: string;
  operationCode?: string | null;
  operationValue: number;
  commissionPercent: number;
  grossValue: number;
  taxPercent: number;
  taxValue: number;
  netValue: number;
  status: string;
  operationClosedAt?: string | null;
  paymentDate?: string | null;
  generatedAt: string;
  notes?: string | null;
}

const GOLD = "#C9A84C";
const NAVY = "#09081A";
const NAVY2 = "#0D1929";
const CREAM = "#F0ECE4";
const MUTED = "#7A8FA8";
const GREEN = "#10B981";

const styles = StyleSheet.create({
  page: {
    backgroundColor: NAVY,
    paddingHorizontal: 40,
    paddingVertical: 36,
    fontFamily: "Helvetica",
    color: CREAM,
    fontSize: 9,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: GOLD,
    paddingBottom: 12,
    marginBottom: 18,
  },
  brand: { fontSize: 15, fontFamily: "Helvetica-Bold", color: GOLD, letterSpacing: 1.5 },
  brandSub: { fontSize: 7, color: MUTED, marginTop: 3 },
  headerRight: { alignItems: "flex-end" },
  headerCode: { fontSize: 12, fontFamily: "Helvetica-Bold", color: CREAM },
  headerDate: { fontSize: 7, color: MUTED, marginTop: 3 },

  docTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: CREAM,
    marginBottom: 4,
  },
  docSubtitle: { fontSize: 8, color: MUTED, marginBottom: 18 },

  section: {
    marginBottom: 14,
    backgroundColor: NAVY2,
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1B3050",
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1B3050",
    paddingBottom: 4,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#1B3050",
  },
  infoRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  infoLabel: { fontSize: 8, color: MUTED },
  infoValue: { fontSize: 8, fontFamily: "Helvetica-Bold", color: CREAM },

  totalBox: {
    marginTop: 4,
    padding: 16,
    backgroundColor: "#0A2018",
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: GREEN,
  },
  totalLabel: { fontSize: 9, color: MUTED, marginBottom: 4 },
  totalValue: { fontSize: 24, fontFamily: "Helvetica-Bold", color: GREEN },

  calcRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  calcLabel: { fontSize: 8.5, color: CREAM },
  calcValue: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: CREAM },
  calcValueNeg: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#EF6B6B" },
  calcDivider: { borderBottomWidth: 1, borderBottomColor: "#1B3050", marginVertical: 4 },

  notes: { fontSize: 8, color: CREAM, lineHeight: 1.5 },

  disclaimer: {
    marginTop: 18,
    fontSize: 7,
    color: MUTED,
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#1B3050",
    paddingTop: 8,
  },
  footerText: { fontSize: 6.5, color: MUTED },
});

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);
}
function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const TIPO_LABEL: Record<string, string> = {
  CREDITO: "Crédito", MA: "M&A", CONSORCIO: "Consórcio", MARKETPLACE: "Marketplace",
};

function ComprovanteComissaoDoc({ data }: { data: ComprovanteComissao }) {
  const pago = data.status === "PAGA";
  const titulo = pago ? "Comprovante de Pagamento de Comissão" : "Demonstrativo de Comissão";
  const subtitulo = pago
    ? "Documento comprobatório da liquidação da comissão do parceiro."
    : "Demonstrativo dos valores da comissão. Não constitui comprovante de pagamento.";

  return (
    <Document
      title={`${titulo} — ${data.code}`}
      author="V3 Partners"
      subject={`Comissão ${data.code} — ${data.partnerName}`}
    >
      <Page size="A4" style={styles.page}>
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>V3 PARTNERS</Text>
            <Text style={styles.brandSub}>V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · v3partners.com.br</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerCode}>{data.code}</Text>
            <Text style={styles.headerDate}>Emitido em {fmtDateTime(data.generatedAt)}</Text>
          </View>
        </View>

        <Text style={styles.docTitle}>{titulo}</Text>
        <Text style={styles.docSubtitle}>{subtitulo}</Text>

        {/* PARCEIRO */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Parceiro</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nome</Text>
            <Text style={styles.infoValue}>{data.partnerName}</Text>
          </View>
          <View style={styles.infoRowLast}>
            <Text style={styles.infoLabel}>Código da comissão</Text>
            <Text style={styles.infoValue}>{data.code}</Text>
          </View>
        </View>

        {/* OPERAÇÃO */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Operação</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tipo</Text>
            <Text style={styles.infoValue}>{TIPO_LABEL[data.operationType] ?? data.operationType}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Descrição</Text>
            <Text style={styles.infoValue}>{data.operationDescription}</Text>
          </View>
          {data.operationCode ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Código da operação</Text>
              <Text style={styles.infoValue}>{data.operationCode}</Text>
            </View>
          ) : null}
          <View style={styles.infoRowLast}>
            <Text style={styles.infoLabel}>Operação finalizada em</Text>
            <Text style={styles.infoValue}>{fmtDate(data.operationClosedAt)}</Text>
          </View>
        </View>

        {/* MEMÓRIA DE CÁLCULO */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Memória de cálculo</Text>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Valor da operação (base)</Text>
            <Text style={styles.calcValue}>{fmtCurrency(data.operationValue)}</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Percentual de comissão</Text>
            <Text style={styles.calcValue}>{data.commissionPercent}%</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Comissão bruta</Text>
            <Text style={styles.calcValue}>{fmtCurrency(data.grossValue)}</Text>
          </View>
          <View style={styles.calcDivider} />
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>
              ({"-"}) Impostos {data.taxPercent > 0 ? `(${data.taxPercent}%)` : ""}
            </Text>
            <Text style={styles.calcValueNeg}>
              {data.taxValue > 0 ? `- ${fmtCurrency(data.taxValue)}` : fmtCurrency(0)}
            </Text>
          </View>
        </View>

        {/* VALOR LÍQUIDO */}
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>
            {pago ? "Valor líquido pago ao parceiro" : "Valor líquido a receber"}
          </Text>
          <Text style={styles.totalValue}>{fmtCurrency(data.netValue)}</Text>
        </View>

        {/* PAGAMENTO */}
        <View style={[styles.section, { marginTop: 14 }]}>
          <Text style={styles.sectionTitle}>Pagamento</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Situação</Text>
            <Text style={[styles.infoValue, { color: pago ? GREEN : GOLD }]}>
              {pago ? "PAGA" : data.status === "A_PAGAR" ? "A PAGAR" : data.status}
            </Text>
          </View>
          <View style={styles.infoRowLast}>
            <Text style={styles.infoLabel}>{pago ? "Data do pagamento" : "Previsão de pagamento"}</Text>
            <Text style={styles.infoValue}>{fmtDate(data.paymentDate)}</Text>
          </View>
        </View>

        {data.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observações</Text>
            <Text style={styles.notes}>{data.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.disclaimer}>
          Documento gerado eletronicamente pela plataforma V3 Partners. Os valores acima refletem o
          comissionamento apurado sobre a operação identificada, já deduzidos os impostos aplicáveis.
          {pago
            ? " O pagamento foi registrado na data indicada."
            : " Este demonstrativo não constitui comprovante de pagamento."}
        </Text>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>V3 Partners · Documento de comissionamento</Text>
          <Text style={styles.footerText}>{data.code} · Emitido em {fmtDateTime(data.generatedAt)}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderComprovanteComissaoPDF(data: ComprovanteComissao): Promise<Buffer> {
  return renderToBuffer(<ComprovanteComissaoDoc data={data} />);
}
