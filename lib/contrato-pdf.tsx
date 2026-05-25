// Gera o certificado PDF de assinatura do Contrato de Mandato
// Usa @react-pdf/renderer — roda no servidor, sem browser

import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

interface AssinanteInfo {
  papel: string;
  nome: string;
  email: string;
  cpf?: string | null;
  ip?: string | null;
  data?: string | null;
}

export interface ContratoPDFData {
  proposal_code: string | null;
  client_name: string;
  client_email: string;
  client_cpf: string | null;
  credit_line: string | null;
  deal_value: number | null;
  commission_perc: number;
  signed_at: string | null;
  ip_address: string | null;
  v3_signer_name: string | null;
  v3_email: string | null;
  v3_signed_at: string | null;
  v3_ip_address: string | null;
  testemunha_nome: string | null;
  testemunha_email: string | null;
  testemunha_cpf: string | null;
  testemunha_signed_at: string | null;
  testemunha_ip_address: string | null;
  testemunha2_nome: string | null;
  testemunha2_email: string | null;
  testemunha2_cpf: string | null;
  testemunha2_signed_at: string | null;
  testemunha2_ip_address: string | null;
}

function fmtData(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function moeda(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const GOLD = "#C9A84C";
const NAVY = "#0D1F35";
const MUTED = "#5A6B7D";
const LIGHT = "#F5F3EF";
const WHITE = "#FFFFFF";
const GREEN = "#10B981";

const styles = StyleSheet.create({
  page: {
    backgroundColor: WHITE,
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: NAVY,
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottom: `2px solid ${GOLD}`,
  },
  logoBox: {
    width: 36,
    height: 36,
    backgroundColor: GOLD,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  logoText: {
    color: NAVY,
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  headerInfo: { flex: 1 },
  headerTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: NAVY,
  },
  headerSubtitle: { fontSize: 8, color: MUTED, marginTop: 1 },
  headerCode: { alignItems: "flex-end" },
  headerCodeLabel: { fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 1 },
  headerCodeValue: { fontFamily: "Helvetica-Bold", fontSize: 11, color: GOLD, marginTop: 2 },

  // Title banner
  titleBanner: {
    backgroundColor: NAVY,
    borderRadius: 8,
    padding: "12 16",
    alignItems: "center",
    marginBottom: 16,
  },
  titleTag: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 4,
  },
  titleMain: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: WHITE,
    marginBottom: 2,
  },
  titleSub: { fontSize: 8, color: MUTED },

  // Section
  section: {
    backgroundColor: LIGHT,
    borderRadius: 6,
    padding: "10 14",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },

  // Data rows
  row: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottom: `0.5px solid #D1D5DB`,
  },
  rowLabel: { width: "40%", color: MUTED, fontSize: 8 },
  rowValue: { flex: 1, fontFamily: "Helvetica-Bold", fontSize: 8, color: NAVY },

  // Signer blocks
  signerBlock: {
    borderLeft: `3px solid ${GOLD}`,
    paddingLeft: 10,
    paddingVertical: 6,
    marginBottom: 8,
    backgroundColor: WHITE,
    borderRadius: 4,
  },
  signerPapel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 3,
  },
  signerNome: { fontFamily: "Helvetica-Bold", fontSize: 9, color: NAVY, marginBottom: 1 },
  signerEmail: { fontSize: 7, color: MUTED, marginBottom: 4 },
  signerMeta: { flexDirection: "row", gap: 16 },
  signerMetaItem: { fontSize: 7, color: MUTED },
  signerMetaValue: { fontSize: 7, color: NAVY, fontFamily: "Helvetica-Bold" },

  // Legal
  legalBox: {
    borderLeft: `3px solid ${GOLD}`,
    paddingLeft: 10,
    paddingVertical: 8,
    backgroundColor: "#FEF9EC",
    borderRadius: 4,
    marginBottom: 12,
  },
  legalText: { fontSize: 7.5, color: MUTED, lineHeight: 1.6 },

  // Footer
  footer: {
    borderTop: `1px solid #D1D5DB`,
    paddingTop: 10,
    alignItems: "center",
  },
  footerText: { fontSize: 7, color: MUTED, textAlign: "center", lineHeight: 1.5 },

  // Status badge
  statusBadge: {
    backgroundColor: "#D1FAE5",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  statusText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: GREEN },
});

function SignerBlock({ a }: { a: AssinanteInfo }) {
  return (
    <View style={styles.signerBlock}>
      <Text style={styles.signerPapel}>{a.papel}</Text>
      <Text style={styles.signerNome}>{a.nome || "—"}</Text>
      <Text style={styles.signerEmail}>{a.email || "—"}{a.cpf ? ` · CPF/CNPJ: ${a.cpf}` : ""}</Text>
      <View style={styles.signerMeta}>
        <Text style={styles.signerMetaItem}>Data: <Text style={styles.signerMetaValue}>{fmtData(a.data)}</Text></Text>
        <Text style={styles.signerMetaItem}>IP: <Text style={styles.signerMetaValue}>{a.ip || "—"}</Text></Text>
      </View>
    </View>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function CertificadoPDF({ c }: { c: ContratoPDFData }) {
  const assinantes: AssinanteInfo[] = [
    {
      papel: "Contratante (Cliente)",
      nome: c.client_name,
      email: c.client_email,
      cpf: c.client_cpf,
      ip: c.ip_address,
      data: c.signed_at,
    },
    {
      papel: "Contratada — V3 Partners",
      nome: c.v3_signer_name ?? "V3 Partners Soluções Ltda",
      email: c.v3_email ?? "joao.lemos@v3partners.com.br",
      cpf: null,
      ip: c.v3_ip_address,
      data: c.v3_signed_at,
    },
    {
      papel: "1ª Testemunha (Parceiro Originador)",
      nome: c.testemunha_nome ?? "—",
      email: c.testemunha_email ?? "—",
      cpf: c.testemunha_cpf,
      ip: c.testemunha_ip_address,
      data: c.testemunha_signed_at,
    },
    {
      papel: "2ª Testemunha (Institucional)",
      nome: c.testemunha2_nome ?? "Aline Rodrigues dos Santos",
      email: c.testemunha2_email ?? "financeiro@v3partners.com.br",
      cpf: c.testemunha2_cpf,
      ip: c.testemunha2_ip_address,
      data: c.testemunha2_signed_at,
    },
  ];

  const geradoEm = fmtData(new Date().toISOString());

  return (
    <Document
      title={`Certificado de Assinatura — ${c.proposal_code ?? ""}`}
      author="V3 Partners Soluções Ltda"
    >
      <Page size="A4" style={styles.page}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>V3</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>V3 PARTNERS SOLUÇÕES LTDA</Text>
            <Text style={styles.headerSubtitle}>CNPJ 14.219.287/0001-50 · v3partners.com.br</Text>
          </View>
          <View style={styles.headerCode}>
            <Text style={styles.headerCodeLabel}>Proposta</Text>
            <Text style={styles.headerCodeValue}>{c.proposal_code ?? "—"}</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleBanner}>
          <Text style={styles.titleTag}>✓ Contrato Totalmente Assinado</Text>
          <Text style={styles.titleMain}>Certificado de Assinatura Eletrônica</Text>
          <Text style={styles.titleSub}>Instrumento Particular de Mandato de Representação</Text>
        </View>

        {/* Status */}
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>✓ ASSINADO POR TODAS AS PARTES</Text>
        </View>

        {/* Dados da operação */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados da Operação</Text>
          <DataRow label="Cliente / Contratante" value={c.client_name} />
          <DataRow label="CPF / CNPJ" value={c.client_cpf ?? "—"} />
          <DataRow label="Linha de Crédito" value={c.credit_line ?? "—"} />
          {c.deal_value ? <DataRow label="Valor da Operação" value={moeda(c.deal_value)} /> : null}
          <DataRow label="Remuneração de Sucesso" value={`${c.commission_perc}%`} />
        </View>

        {/* Assinaturas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Registro de Assinaturas Eletrônicas</Text>
          {assinantes.map((a) => <SignerBlock key={a.papel} a={a} />)}
        </View>

        {/* Validade jurídica */}
        <View style={styles.legalBox}>
          <Text style={styles.legalText}>
            Este certificado comprova a assinatura eletrônica do instrumento acima nos termos da MP 2.200-2/2001
            e da Lei 14.063/2020. As assinaturas foram registradas com data, hora e endereço IP de cada signatário,
            constituindo prova eletrônica com plena validade jurídica.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Certificado gerado em {geradoEm} (Horário de Brasília){"\n"}
            V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50{"\n"}
            Rua Visconde de Pirajá, 414/Sala 718 – Ipanema – Rio de Janeiro – RJ · CEP 22.410-002
          </Text>
        </View>

      </Page>
    </Document>
  );
}

export async function gerarCertificadoPDF(c: ContratoPDFData): Promise<Buffer> {
  const element = React.createElement(CertificadoPDF, { c });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(element as any) as Promise<Buffer>;
}
