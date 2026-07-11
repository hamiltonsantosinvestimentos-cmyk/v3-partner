// Relatório Completo de Crédito — Perfil do Cliente + OCR + Análise dos 5C's
// compilados num único PDF. Usa @react-pdf/renderer (mesmo padrão de analise-credito-pdf.tsx).

import React from "react";
import {
  Document, Page, View, Text, StyleSheet, renderToBuffer,
} from "@react-pdf/renderer";

export interface RelatorioImovel {
  endereco?: string;
  cidade?: string;
  estado?: string;
  valor_medio?: number;
}

export interface RelatorioPerfilCliente {
  client_type?: string;
  email?: string;
  telefone?: string;
  rg?: string;
  nascimento?: string;
  estado_civil?: string;
  renda_mensal?: number;
  razao_social?: string;
  nome_fantasia?: string;
  socio_responsavel?: string;
  faturamento_mensal?: number;
  endereco_rua?: string;
  endereco_cidade?: string;
  endereco_uf?: string;
  endereco_cep?: string;
  restricao_cliente?: string;
  prazo?: string;
  finalidade?: string;
  observacoes?: string;
  imoveis?: RelatorioImovel[];
}

export interface RelatorioOcrCampo {
  campo: string;
  extraido: string | null;
  esperado: string | null;
  status: "ok" | "divergente" | "ausente" | "info";
  mensagem: string;
}

export interface RelatorioOcrDoc {
  doc_id: string;
  tipo_documento: string;
  resumo: "aprovado" | "atencao" | "reprovado";
  observacoes: string;
  campos: RelatorioOcrCampo[];
  extrato_info?: { banco: string; periodo: string; media_entrada_formatada: string };
}

export interface RelatorioExtratoResumo {
  banco: string;
  media_entrada_formatada: string;
}

export interface RelatorioCincoCs {
  carater: string;
  capacidade: string;
  capital: string;
  colateral: string;
  condicoes: string;
}

export interface RelatorioAnaliseIA {
  resumo_executivo: string;
  parecer: "FAVORÁVEL" | "DESFAVORÁVEL" | "CONDICIONADO";
  score_risco: "BAIXO" | "MÉDIO" | "ALTO";
  cinco_cs: RelatorioCincoCs;
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
  generated_at?: string;
}

export interface RelatorioCompleto {
  proposal_code: string;
  client_name: string;
  client_cpf_cnpj?: string | null;
  credit_line: string;
  current_level: string;
  status: string;
  stage?: string;
  requested_value: number;
  approved_value?: number | null;
  partner_name?: string;
  created_at: string;
  generated_at: string;

  perfil: RelatorioPerfilCliente;
  ocr_docs: RelatorioOcrDoc[];
  extratos_resumo: RelatorioExtratoResumo[];
  analise: RelatorioAnaliseIA | null;
}

const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8C97A";
const NAVY = "#09081A";
const NAVY2 = "#0D1929";
const NAVY3 = "#111F35";
const CREAM = "#F0ECE4";
const MUTED = "#7A8FA8";
const RED = "#EF4444";
const AMBER = "#F59E0B";
const GREEN = "#10B981";
const BORDER = "#1B3050";

const styles = StyleSheet.create({
  page: {
    backgroundColor: NAVY,
    paddingHorizontal: 36,
    paddingVertical: 32,
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
    paddingBottom: 10,
    marginBottom: 16,
  },
  brand: { fontSize: 13, fontFamily: "Helvetica-Bold", color: GOLD, letterSpacing: 1.5 },
  brandSub: { fontSize: 7, color: MUTED, marginTop: 2 },
  headerRight: { alignItems: "flex-end" },
  headerCode: { fontSize: 10, fontFamily: "Helvetica-Bold", color: CREAM },
  headerDate: { fontSize: 7, color: MUTED, marginTop: 2 },
  section: {
    marginBottom: 12,
    backgroundColor: NAVY2,
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 4,
  },
  text: { fontSize: 8.5, color: CREAM, lineHeight: 1.5 },
  muted: { fontSize: 7.5, color: MUTED, lineHeight: 1.4 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  infoLabel: { fontSize: 7.5, color: MUTED },
  infoValue: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: CREAM, textAlign: "right", maxWidth: "60%" },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 8,
  },
  footerText: { fontSize: 6.5, color: MUTED },
  // Capa
  coverWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  coverBadgeRow: { flexDirection: "row", gap: 8, marginTop: 18 },
  coverBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 4, borderWidth: 1 },
  coverBadgeText: { fontSize: 10, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  coverTitle: { fontSize: 20, fontFamily: "Helvetica-Bold", color: CREAM, textAlign: "center", marginTop: 4 },
  coverSub: { fontSize: 9, color: MUTED, textAlign: "center", marginTop: 6, letterSpacing: 0.5 },
  coverClient: { fontSize: 15, fontFamily: "Helvetica-Bold", color: GOLD_LIGHT, textAlign: "center", marginTop: 26 },
  coverCode: { fontSize: 9, color: MUTED, textAlign: "center", marginTop: 4 },
  coverIndexItem: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  coverIndexDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: GOLD },
  coverIndexText: { fontSize: 8.5, color: CREAM },
  // OCR
  ocrDocHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  ocrDocTitle: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: CREAM },
  ocrBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 3, borderWidth: 1 },
  ocrBadgeText: { fontSize: 6.5, fontFamily: "Helvetica-Bold" },
  ocrFieldRow: { flexDirection: "row", paddingVertical: 2.5, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  ocrFieldName: { fontSize: 7, color: MUTED, width: "28%" },
  ocrFieldValue: { fontSize: 7, color: CREAM, width: "40%" },
  ocrFieldStatus: { fontSize: 6.5, fontFamily: "Helvetica-Bold", width: "32%", textAlign: "right" },
  // 5Cs
  csGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  csItem: {
    width: "47%",
    backgroundColor: NAVY3,
    borderRadius: 5,
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
  },
  csLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: GOLD, letterSpacing: 0.5, marginBottom: 3 },
  csText: { fontSize: 8, color: CREAM, lineHeight: 1.4 },
  pointRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 3 },
  bullet: { width: 12, fontSize: 8, fontFamily: "Helvetica-Bold" },
  pointText: { flex: 1, fontSize: 8, lineHeight: 1.4 },
});

function fmtCurrency(v?: number | null): string {
  if (v === undefined || v === null) return "Não informado";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function orTraco(v?: string | null): string {
  return v && v.trim() ? v : "Não informado";
}

function parecerColors(p?: string) {
  if (p === "FAVORÁVEL") return { border: GREEN, text: GREEN, bg: "#052e1c" };
  if (p === "DESFAVORÁVEL") return { border: RED, text: RED, bg: "#1f0606" };
  return { border: AMBER, text: AMBER, bg: "#1a1000" };
}
function riscoColors(r?: string) {
  if (r === "BAIXO") return { border: GREEN, text: GREEN };
  if (r === "ALTO") return { border: RED, text: RED };
  return { border: AMBER, text: AMBER };
}
function ocrResumoColors(r: string) {
  if (r === "aprovado") return { border: GREEN, text: GREEN };
  if (r === "reprovado") return { border: RED, text: RED };
  return { border: AMBER, text: AMBER };
}
function ocrCampoColor(s: string) {
  if (s === "ok") return GREEN;
  if (s === "divergente") return RED;
  if (s === "ausente") return AMBER;
  return MUTED;
}

function PageChrome({ data, children }: { data: RelatorioCompleto; children: React.ReactNode }) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>V3 PARTNERS</Text>
          <Text style={styles.brandSub}>Relatório Completo de Crédito — Perfil, Documentos e Análise IA</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.headerCode}>{data.proposal_code}</Text>
          <Text style={styles.headerDate}>{data.client_name}</Text>
        </View>
      </View>
      {children}
      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>V3 Partners — Documento Confidencial — Uso Interno</Text>
        <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages} · Gerado em ${fmtDate(data.generated_at)}`} />
      </View>
    </Page>
  );
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

function CapaPage({ data }: { data: RelatorioCompleto }) {
  const pc = data.analise ? parecerColors(data.analise.parecer) : null;
  const rc = data.analise ? riscoColors(data.analise.score_risco) : null;
  const itens = [
    "Perfil Completo do Cliente",
    `Documentos e OCR (${data.ocr_docs.length} documento${data.ocr_docs.length === 1 ? "" : "s"} validado${data.ocr_docs.length === 1 ? "" : "s"})`,
    data.analise ? "Análise dos 5 C's do Crédito (IA)" : "Análise dos 5 C's — pendente de geração",
    "Parecer Final",
  ];
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.coverWrap}>
        <Text style={styles.brand}>V3 PARTNERS</Text>
        <Text style={styles.coverTitle}>RELATÓRIO COMPLETO{"\n"}DE ANÁLISE DE CRÉDITO</Text>
        <Text style={styles.coverSub}>PERFIL DO CLIENTE · DOCUMENTOS (OCR) · ANÁLISE DOS 5 C&apos;S</Text>

        <Text style={styles.coverClient}>{data.client_name}</Text>
        <Text style={styles.coverCode}>{data.proposal_code} · {data.credit_line} · {fmtCurrency(data.requested_value)}</Text>

        {pc && rc && data.analise && (
          <View style={styles.coverBadgeRow}>
            <View style={[styles.coverBadge, { borderColor: pc.border, backgroundColor: pc.bg }]}>
              <Text style={[styles.coverBadgeText, { color: pc.text }]}>PARECER: {data.analise.parecer}</Text>
            </View>
            <View style={[styles.coverBadge, { borderColor: rc.border }]}>
              <Text style={[styles.coverBadgeText, { color: rc.text }]}>RISCO {data.analise.score_risco}</Text>
            </View>
          </View>
        )}

        <View style={{ marginTop: 40, width: 260 }}>
          {itens.map((it, i) => (
            <View key={i} style={styles.coverIndexItem}>
              <View style={styles.coverIndexDot} />
              <Text style={styles.coverIndexText}>{it}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>V3 Partners — Documento Confidencial — Uso Interno</Text>
        <Text style={styles.footerText}>Gerado em {fmtDate(data.generated_at)}</Text>
      </View>
    </Page>
  );
}

function PerfilPage({ data }: { data: RelatorioCompleto }) {
  const p = data.perfil;
  const isPJ = !!p.razao_social || p.client_type === "PJ";
  return (
    <PageChrome data={data}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dados da Operação</Text>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Cliente</Text><Text style={styles.infoValue}>{data.client_name}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>CPF/CNPJ</Text><Text style={styles.infoValue}>{orTraco(data.client_cpf_cnpj)}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Linha de Crédito</Text><Text style={styles.infoValue}>{data.credit_line}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Nível</Text><Text style={styles.infoValue}>{data.current_level}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Status / Etapa</Text><Text style={styles.infoValue}>{data.status} {data.stage ? `· ${data.stage}` : ""}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Capital Solicitado</Text><Text style={[styles.infoValue, { color: GOLD }]}>{fmtCurrency(data.requested_value)}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Capital Aprovado</Text><Text style={styles.infoValue}>{fmtCurrency(data.approved_value)}</Text></View>
        {data.partner_name && <View style={styles.infoRow}><Text style={styles.infoLabel}>Partner Responsável</Text><Text style={styles.infoValue}>{data.partner_name}</Text></View>}
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}><Text style={styles.infoLabel}>Data da Proposta</Text><Text style={styles.infoValue}>{fmtDate(data.created_at)}</Text></View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Perfil do Cliente — {isPJ ? "Pessoa Jurídica" : "Pessoa Física"}</Text>
        {isPJ ? (
          <>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Razão Social</Text><Text style={styles.infoValue}>{orTraco(p.razao_social)}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Nome Fantasia</Text><Text style={styles.infoValue}>{orTraco(p.nome_fantasia)}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Sócio Responsável</Text><Text style={styles.infoValue}>{orTraco(p.socio_responsavel)}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Faturamento Mensal</Text><Text style={styles.infoValue}>{fmtCurrency(p.faturamento_mensal)}</Text></View>
          </>
        ) : (
          <>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>RG</Text><Text style={styles.infoValue}>{orTraco(p.rg)}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Nascimento</Text><Text style={styles.infoValue}>{orTraco(p.nascimento)}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Estado Civil</Text><Text style={styles.infoValue}>{orTraco(p.estado_civil)}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Renda Mensal</Text><Text style={styles.infoValue}>{fmtCurrency(p.renda_mensal)}</Text></View>
          </>
        )}
        <View style={styles.infoRow}><Text style={styles.infoLabel}>E-mail</Text><Text style={styles.infoValue}>{orTraco(p.email)}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Telefone</Text><Text style={styles.infoValue}>{orTraco(p.telefone)}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Endereço</Text><Text style={styles.infoValue}>{orTraco(`${p.endereco_rua ?? ""} ${p.endereco_cidade ?? ""} ${p.endereco_uf ?? ""}`.trim())}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Prazo Desejado</Text><Text style={styles.infoValue}>{orTraco(p.prazo)}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Finalidade</Text><Text style={styles.infoValue}>{orTraco(p.finalidade)}</Text></View>
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}><Text style={styles.infoLabel}>Restrições</Text><Text style={styles.infoValue}>{orTraco(p.restricao_cliente)}</Text></View>
      </View>

      {p.imoveis && p.imoveis.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Imóveis Vinculados</Text>
          {p.imoveis.map((im, i) => (
            <View key={i} style={[styles.infoRow, i === (p.imoveis?.length ?? 0) - 1 ? { borderBottomWidth: 0 } : {}]}>
              <Text style={styles.infoLabel}>{orTraco(im.endereco)} — {orTraco(im.cidade)}/{orTraco(im.estado)}</Text>
              <Text style={styles.infoValue}>{fmtCurrency(im.valor_medio)}</Text>
            </View>
          ))}
        </View>
      )}

      {p.observacoes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Observações</Text>
          <Text style={styles.text}>{p.observacoes}</Text>
        </View>
      )}
    </PageChrome>
  );
}

function OcrPage({ data }: { data: RelatorioCompleto }) {
  if (data.ocr_docs.length === 0 && data.extratos_resumo.length === 0) {
    return (
      <PageChrome data={data}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documentos — Validação OCR</Text>
          <Text style={styles.muted}>Nenhum documento foi validado por OCR até o momento.</Text>
        </View>
      </PageChrome>
    );
  }
  return (
    <PageChrome data={data}>
      {data.extratos_resumo.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumo de Extratos Bancários</Text>
          {data.extratos_resumo.map((e, i) => (
            <View key={i} style={[styles.infoRow, i === data.extratos_resumo.length - 1 ? { borderBottomWidth: 0 } : {}]}>
              <Text style={styles.infoLabel}>{e.banco}</Text>
              <Text style={[styles.infoValue, { color: GOLD }]}>{e.media_entrada_formatada}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Documentos Validados por OCR ({data.ocr_docs.length})</Text>
        {data.ocr_docs.map((doc, i) => {
          const rc = ocrResumoColors(doc.resumo);
          return (
            <View key={i} style={{ marginBottom: i === data.ocr_docs.length - 1 ? 0 : 10 }}>
              <View style={styles.ocrDocHeader}>
                <Text style={styles.ocrDocTitle}>{doc.tipo_documento}</Text>
                <View style={[styles.ocrBadge, { borderColor: rc.border }]}>
                  <Text style={[styles.ocrBadgeText, { color: rc.text }]}>{doc.resumo.toUpperCase()}</Text>
                </View>
              </View>
              {doc.campos.slice(0, 8).map((c, ci) => (
                <View key={ci} style={styles.ocrFieldRow}>
                  <Text style={styles.ocrFieldName}>{c.campo}</Text>
                  <Text style={styles.ocrFieldValue}>{c.extraido ?? "—"}</Text>
                  <Text style={[styles.ocrFieldStatus, { color: ocrCampoColor(c.status) }]}>{c.status.toUpperCase()}</Text>
                </View>
              ))}
              {doc.observacoes && <Text style={[styles.muted, { marginTop: 3 }]}>{doc.observacoes}</Text>}
            </View>
          );
        })}
      </View>
    </PageChrome>
  );
}

function AnalisePage({ data }: { data: RelatorioCompleto }) {
  const a = data.analise;
  if (!a) {
    return (
      <PageChrome data={data}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Análise dos 5 C&apos;s do Crédito</Text>
          <Text style={styles.muted}>
            A análise por IA ainda não foi gerada para esta proposta. Gere a Análise IA na aba correspondente
            antes de emitir o relatório completo para ter o parecer, o score de risco e os 5 C&apos;s aqui incluídos.
          </Text>
        </View>
      </PageChrome>
    );
  }
  const pc = parecerColors(a.parecer);
  const rc = riscoColors(a.score_risco);
  return (
    <PageChrome data={data}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <View style={[styles.coverBadge, { borderColor: pc.border, backgroundColor: pc.bg }]}>
          <Text style={[styles.coverBadgeText, { color: pc.text, fontSize: 9 }]}>PARECER: {a.parecer}</Text>
        </View>
        <View style={[styles.coverBadge, { borderColor: rc.border }]}>
          <Text style={[styles.coverBadgeText, { color: rc.text, fontSize: 9 }]}>RISCO {a.score_risco}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resumo Executivo</Text>
        <Text style={styles.text}>{a.resumo_executivo}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Os 5 C&apos;s do Crédito</Text>
        <View style={styles.csGrid}>
          {([
            { label: "CARÁTER", value: a.cinco_cs.carater },
            { label: "CAPACIDADE", value: a.cinco_cs.capacidade },
            { label: "CAPITAL", value: a.cinco_cs.capital },
            { label: "COLATERAL", value: a.cinco_cs.colateral },
            { label: "CONDIÇÕES", value: a.cinco_cs.condicoes },
          ]).map(({ label, value }) => (
            <View key={label} style={styles.csItem}>
              <Text style={styles.csLabel}>{label}</Text>
              <Text style={styles.csText}>{value}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Análise Financeira</Text>
        <Text style={[styles.text, { marginBottom: 6 }]}>{a.analise_financeira}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Capacidade de Pagamento Estimada</Text>
          <Text style={[styles.infoValue, { color: GREEN }]}>{a.capacidade_pagamento}</Text>
        </View>
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.infoLabel}>Comprometimento de Renda</Text>
          <Text style={styles.infoValue}>{a.comprometimento_renda}</Text>
        </View>
        {a.gap_analise && <Text style={[styles.text, { color: AMBER, marginTop: 6 }]}>{a.gap_analise}</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pontos da Operação</Text>
        {a.pontos_criticos.length > 0 && (
          <View style={{ marginBottom: 8 }}>
            <Text style={[styles.csLabel, { color: RED, marginBottom: 4 }]}>CRÍTICOS</Text>
            <PointList items={a.pontos_criticos} color={RED} prefix="x " />
          </View>
        )}
        {a.pontos_atencao.length > 0 && (
          <View style={{ marginBottom: 8 }}>
            <Text style={[styles.csLabel, { color: AMBER, marginBottom: 4 }]}>ATENÇÃO</Text>
            <PointList items={a.pontos_atencao} color={AMBER} prefix="! " />
          </View>
        )}
        {a.pontos_positivos.length > 0 && (
          <View>
            <Text style={[styles.csLabel, { color: GREEN, marginBottom: 4 }]}>POSITIVOS</Text>
            <PointList items={a.pontos_positivos} color={GREEN} prefix="+ " />
          </View>
        )}
      </View>

      <View style={[styles.section, { borderColor: pc.border, borderWidth: 1 }]}>
        <Text style={[styles.sectionTitle, { color: pc.text }]}>Parecer Final</Text>
        <Text style={styles.text}>{a.parecer_final}</Text>
      </View>
    </PageChrome>
  );
}

function RelatorioCompletoDoc({ data }: { data: RelatorioCompleto }) {
  return (
    <Document>
      <CapaPage data={data} />
      <PerfilPage data={data} />
      <OcrPage data={data} />
      <AnalisePage data={data} />
    </Document>
  );
}

export async function renderRelatorioCompletoPDF(data: RelatorioCompleto): Promise<Buffer> {
  return renderToBuffer(<RelatorioCompletoDoc data={data} />);
}
