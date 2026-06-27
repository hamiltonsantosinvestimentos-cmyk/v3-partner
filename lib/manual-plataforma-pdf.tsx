import React from "react";
import {
  Document, Page, Text, View, StyleSheet, Image, Font,
} from "@react-pdf/renderer";

// ── Paleta V3 ────────────────────────────────────────────────────────────────
const GOLD   = "#C9A84C";
const NAVY   = "#09081A";
const NAVY2  = "#111F35";
const NAVY3  = "#162744";
const NAVY4  = "#243A66";
const CREAM  = "#F0ECE4";
const MUTED  = "#7A8FA8";
const WHITE  = "#FFFFFF";

const styles = StyleSheet.create({
  page: {
    backgroundColor: NAVY,
    fontFamily: "Helvetica",
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 44,
  },
  pageCover: {
    backgroundColor: NAVY,
    fontFamily: "Helvetica",
    padding: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Cover ──────────────────────────────────────────────────────────────────
  coverBg: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: NAVY,
  },
  coverAccent: {
    position: "absolute", top: 0, left: 0, right: 0,
    height: 6,
    backgroundColor: GOLD,
  },
  coverContent: {
    flex: 1, justifyContent: "center", alignItems: "center",
    paddingHorizontal: 60, paddingVertical: 80,
  },
  coverTag: {
    fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 3,
    color: GOLD, textTransform: "uppercase", marginBottom: 20,
  },
  coverTitle: {
    fontSize: 36, fontFamily: "Helvetica-Bold", color: CREAM,
    textAlign: "center", marginBottom: 12, lineHeight: 1.2,
  },
  coverSubtitle: {
    fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 1.5, marginBottom: 40,
  },
  coverDivider: {
    width: 60, height: 2, backgroundColor: GOLD, marginBottom: 40,
  },
  coverMeta: {
    fontSize: 10, color: MUTED, textAlign: "center", lineHeight: 1.6,
  },
  coverFooter: {
    position: "absolute", bottom: 32, left: 0, right: 0,
    alignItems: "center",
  },
  coverFooterText: {
    fontSize: 9, color: NAVY4, letterSpacing: 1,
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 32, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: NAVY3,
  },
  headerBrand: { fontSize: 9, fontFamily: "Helvetica-Bold", color: GOLD, letterSpacing: 2 },
  headerPage: { fontSize: 9, color: MUTED },

  // ── Section title ──────────────────────────────────────────────────────────
  sectionTag: {
    fontSize: 7, fontFamily: "Helvetica-Bold", color: GOLD,
    letterSpacing: 3, textTransform: "uppercase", marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 20, fontFamily: "Helvetica-Bold", color: CREAM,
    marginBottom: 6, lineHeight: 1.2,
  },
  sectionSubtitle: {
    fontSize: 11, color: MUTED, lineHeight: 1.6, marginBottom: 20,
  },
  divider: {
    height: 1, backgroundColor: NAVY3, marginBottom: 24,
  },

  // ── Module card ────────────────────────────────────────────────────────────
  moduleCard: {
    backgroundColor: NAVY2, borderRadius: 8, padding: 16,
    marginBottom: 12, borderLeftWidth: 3, borderLeftColor: GOLD,
  },
  moduleTitle: {
    fontSize: 13, fontFamily: "Helvetica-Bold", color: CREAM, marginBottom: 4,
  },
  moduleDesc: {
    fontSize: 10, color: MUTED, lineHeight: 1.6, marginBottom: 8,
  },
  moduleSteps: { marginTop: 6 },

  // ── Steps ──────────────────────────────────────────────────────────────────
  step: { flexDirection: "row", gap: 10, marginBottom: 8, alignItems: "flex-start" },
  stepNum: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: NAVY3, borderWidth: 1, borderColor: GOLD,
    justifyContent: "center", alignItems: "center", flexShrink: 0,
  },
  stepNumText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: GOLD },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: CREAM, marginBottom: 2 },
  stepDesc: { fontSize: 10, color: MUTED, lineHeight: 1.55 },

  // ── Info box ───────────────────────────────────────────────────────────────
  infoBox: {
    backgroundColor: NAVY3, borderRadius: 8, padding: 14,
    marginBottom: 14, borderWidth: 1, borderColor: NAVY4,
  },
  infoBoxTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: GOLD, letterSpacing: 1, marginBottom: 8 },
  infoBoxText: { fontSize: 10, color: MUTED, lineHeight: 1.6 },

  // ── Tip box ───────────────────────────────────────────────────────────────
  tipBox: {
    backgroundColor: "#C9A84C10", borderRadius: 8, padding: 14,
    marginBottom: 14, borderWidth: 1, borderColor: "#C9A84C30",
  },
  tipText: { fontSize: 10, color: GOLD, lineHeight: 1.6 },

  // ── Table ──────────────────────────────────────────────────────────────────
  table: { marginBottom: 16 },
  tableHeader: {
    flexDirection: "row", backgroundColor: NAVY3,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, marginBottom: 4,
  },
  tableHeaderCell: { fontSize: 8, fontFamily: "Helvetica-Bold", color: GOLD, flex: 1 },
  tableRow: {
    flexDirection: "row", paddingVertical: 8, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: NAVY3,
  },
  tableCell: { fontSize: 10, color: MUTED, flex: 1, lineHeight: 1.4 },
  tableCellBold: { fontSize: 10, fontFamily: "Helvetica-Bold", color: CREAM, flex: 1 },

  // ── Badge ──────────────────────────────────────────────────────────────────
  badge: {
    backgroundColor: NAVY3, borderRadius: 4, paddingVertical: 2,
    paddingHorizontal: 6, marginRight: 4,
  },
  badgeText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: GOLD },

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer: {
    position: "absolute", bottom: 24, left: 44, right: 44,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  footerText: { fontSize: 8, color: NAVY4 },
  footerPage: { fontSize: 8, color: NAVY4 },

  // ── Two columns ────────────────────────────────────────────────────────────
  row2: { flexDirection: "row", gap: 12, marginBottom: 12 },
  col: { flex: 1 },

  // ── Misc ───────────────────────────────────────────────────────────────────
  mb4:  { marginBottom: 4 },
  mb8:  { marginBottom: 8 },
  mb12: { marginBottom: 12 },
  mb16: { marginBottom: 16 },
  mb24: { marginBottom: 24 },
});

// ── Sub-components ───────────────────────────────────────────────────────────

function PageHeader({ label }: { label: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerBrand}>V3 PARTNERS</Text>
      <Text style={styles.headerPage}>{label}</Text>
    </View>
  );
}

function PageFooter({ page }: { page: string }) {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>Manual da Plataforma V3 Partners · Confidencial</Text>
      <Text style={styles.footerPage}>{page}</Text>
    </View>
  );
}

function SectionHeader({ tag, title, subtitle }: { tag: string; title: string; subtitle: string }) {
  return (
    <View style={styles.mb24}>
      <Text style={styles.sectionTag}>{tag}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      <View style={styles.divider} />
    </View>
  );
}

function ModuleCard({ title, desc, children }: { title: string; desc: string; children?: React.ReactNode }) {
  return (
    <View style={styles.moduleCard}>
      <Text style={styles.moduleTitle}>{title}</Text>
      <Text style={styles.moduleDesc}>{desc}</Text>
      {children}
    </View>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDesc}>{desc}</Text>
      </View>
    </View>
  );
}

function InfoBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.infoBox}>
      <Text style={styles.infoBoxTitle}>{title}</Text>
      {children}
    </View>
  );
}

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.tipBox}>
      <Text style={styles.tipText}>{children as string}</Text>
    </View>
  );
}

// ── DOCUMENTO PRINCIPAL ───────────────────────────────────────────────────────

export function ManualPlataformaPDF() {
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <Document title="Manual da Plataforma V3 Partners" author="V3 Partners">

      {/* ── CAPA ──────────────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.pageCover}>
        <View style={styles.coverAccent} />
        <View style={styles.coverContent}>
          <Text style={styles.coverTag}>Plataforma Financeira Institucional</Text>
          <Text style={styles.coverTitle}>Manual Completo{"\n"}V3 Partners</Text>
          <View style={styles.coverDivider} />
          <Text style={styles.coverSubtitle}>
            Guia didático para uso da plataforma:{"\n"}
            Dashboard · CRM · Mesa de Crédito · M&A · Chat · Academy e muito mais.
          </Text>
          <Text style={styles.coverMeta}>
            Versão 1.0 · {today}{"\n"}
            Documento Confidencial — uso interno
          </Text>
        </View>
        <View style={styles.coverFooter}>
          <Text style={styles.coverFooterText}>app.v3partners.com.br</Text>
        </View>
      </Page>

      {/* ── SUMÁRIO ───────────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <PageHeader label="Sumário" />
        <SectionHeader
          tag="Índice"
          title="O que você vai encontrar"
          subtitle="Este manual cobre todos os módulos da plataforma V3 Partners de forma didática e objetiva."
        />
        <View style={styles.table}>
          {[
            ["1", "Visão Geral da Plataforma", "Perfis, acesso e navegação"],
            ["2", "Dashboard", "KPIs, gráficos e market ticker"],
            ["3", "CRM", "Gestão de contatos e leads"],
            ["4", "Mesa de Crédito", "Propostas N1, N2 e N3"],
            ["5", "Mesa Operacional", "Tickets e acompanhamento"],
            ["6", "Mesa M&A", "Pipeline de fusões e aquisições"],
            ["7", "Chat", "Comunicação interna e com instituições"],
            ["8", "IA Partner", "Assistente de inteligência artificial"],
            ["9", "Academy", "Treinamentos e certificações"],
            ["10", "Marketplace", "Produtos e fornecedores"],
            ["11", "Financeiro", "Comissões e assinaturas"],
            ["12", "Configurações", "Perfil, senha e preferências"],
          ].map(([num, title, desc]) => (
            <View key={num} style={styles.tableRow}>
              <Text style={[styles.tableCellBold, { flex: 0.2 }]}>{num}</Text>
              <Text style={[styles.tableCellBold, { flex: 1 }]}>{title}</Text>
              <Text style={[styles.tableCell, { flex: 1.2 }]}>{desc}</Text>
            </View>
          ))}
        </View>
        <TipBox>
          💡 Dica: Use Ctrl+F (ou Cmd+F no Mac) para buscar qualquer termo neste documento PDF.
        </TipBox>
        <PageFooter page="2" />
      </Page>

      {/* ── 1. VISÃO GERAL ────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <PageHeader label="Visão Geral" />
        <SectionHeader
          tag="Capítulo 1"
          title="Visão Geral da Plataforma"
          subtitle="A plataforma V3 Partners centraliza toda a operação da boutique financeira: desde originação de deals até gestão de partners, crédito, M&A e comissões."
        />

        <InfoBox title="🌐 COMO ACESSAR">
          <Text style={styles.infoBoxText}>
            URL: app.v3partners.com.br{"\n"}
            No primeiro acesso você receberá um e-mail com seu login e senha temporária.{"\n"}
            Você será solicitado a definir uma nova senha pessoal antes de continuar.
          </Text>
        </InfoBox>

        <Text style={[styles.sectionTag, styles.mb8]}>Perfis de Acesso</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderCell}>Perfil</Text>
            <Text style={styles.tableHeaderCell}>O que pode fazer</Text>
          </View>
          {[
            ["PARTNER", "Dashboard, CRM, Propostas de Crédito N1/N2, Consórcio, Academy, Comissões, M&A"],
            ["PARTNER PRO", "Tudo do Partner + Crédito N3 (High Ticket ≥ R$5M), Academy M&A avançado"],
            ["MESA OPERACIONAL", "Dashboard, IA, Mesa de Crédito, Mesa Operacional, Consórcio, Academy"],
            ["GESTÃO", "Acesso completo exceto Gestão de Usuários"],
            ["ADMIN", "Acesso total à plataforma incluindo Gestão de Usuários"],
          ].map(([role, access]) => (
            <View key={role} style={styles.tableRow}>
              <Text style={[styles.tableCellBold, { flex: 0.7 }]}>{role}</Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>{access}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTag, styles.mb8]}>Navegação Principal</Text>
        <View style={styles.row2}>
          <ModuleCard title="Sidebar (menu lateral)" desc="Acesse qualquer módulo clicando nos ícones do menu esquerdo. Em mobile, toque no ícone de hambúrguer no canto superior." />
          <ModuleCard title="Topbar (barra superior)" desc="Acesse notificações, seu perfil e configurações. O sino mostra alertas de propostas, mensagens e comissões." />
        </View>
        <PageFooter page="3" />
      </Page>

      {/* ── 2. DASHBOARD ─────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <PageHeader label="Dashboard" />
        <SectionHeader
          tag="Capítulo 2"
          title="Dashboard"
          subtitle="Visão consolidada da operação V3 Partners com KPIs em tempo real, gráficos e market ticker."
        />
        <ModuleCard
          title="📊 KPIs Principais"
          desc="No topo do dashboard você verá os indicadores mais importantes da sua operação:"
        >
          <View style={styles.moduleSteps}>
            <Step n={1} title="Volume Total de Propostas" desc="Soma de todas as propostas enviadas no período selecionado." />
            <Step n={2} title="Taxa de Aprovação" desc="Percentual de propostas que passaram por todas as etapas com sucesso." />
            <Step n={3} title="Comissões do Mês" desc="Total de comissões geradas no mês corrente." />
            <Step n={4} title="Partners Ativos" desc="Quantidade de partners com acesso ativo à plataforma." />
          </View>
        </ModuleCard>
        <ModuleCard
          title="📈 Market Ticker"
          desc="Faixa rolante no topo com cotações em tempo real: dólar, euro, Ibovespa, ouro e bitcoin. Atualização automática a cada 60 segundos."
        />
        <TipBox>
          💡 O dashboard é personalizado pelo seu perfil — partners veem seus próprios dados; admins veem o consolidado de toda a rede.
        </TipBox>
        <PageFooter page="4" />
      </Page>

      {/* ── 3. CRM ───────────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <PageHeader label="CRM" />
        <SectionHeader
          tag="Capítulo 3"
          title="CRM — Gestão de Contatos"
          subtitle="Central de relacionamento para gerenciar seus leads, clientes e oportunidades de negócio."
        />
        <ModuleCard
          title="📋 Como cadastrar um lead"
          desc="Passo a passo para registrar um novo contato no CRM:"
        >
          <View style={styles.moduleSteps}>
            <Step n={1} title="Acesse o CRM" desc="Clique em 'CRM' no menu lateral esquerdo." />
            <Step n={2} title="Clique em + Novo Lead" desc="Botão no canto superior direito da tela." />
            <Step n={3} title="Preencha os dados" desc="Nome, telefone, e-mail, segmento, valor estimado e observações." />
            <Step n={4} title="Defina o estágio" desc="Escolha entre: Prospect → Contatado → Interessado → Proposta → Fechado." />
            <Step n={5} title="Salve e acompanhe" desc="O lead aparece no pipeline. Agende follow-ups para não perder o contato." />
          </View>
        </ModuleCard>
        <InfoBox title="📅 FOLLOW-UPS AUTOMÁTICOS">
          <Text style={styles.infoBoxText}>
            A plataforma envia um e-mail diário com seus follow-ups agendados para o dia.{"\n"}
            Leads sem contato há 7+ dias são destacados em vermelho como alerta.
          </Text>
        </InfoBox>
        <TipBox>
          💡 Mantenha os dados do CRM atualizados — ele alimenta os relatórios de performance e o ranking de partners.
        </TipBox>
        <PageFooter page="5" />
      </Page>

      {/* ── 4. MESA DE CRÉDITO ───────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <PageHeader label="Mesa de Crédito" />
        <SectionHeader
          tag="Capítulo 4"
          title="Mesa de Crédito"
          subtitle="Submeta e acompanhe propostas de crédito estruturado. Dividida em 3 níveis conforme o ticket e complexidade."
        />
        <View style={styles.row2}>
          <ModuleCard
            title="N1 — Crédito Varejo"
            desc="Propostas até R$5M. CGI residencial, crédito com garantia imobiliária, home equity. Fluxo simplificado com análise automatizada."
          />
          <ModuleCard
            title="N2 — Crédito Estruturado"
            desc="Propostas de R$500K a R$5M com estruturas mais complexas: CGI PJ, consórcio de imóveis, SLB, BTS."
          />
        </View>
        <ModuleCard
          title="N3 — High Ticket (≥ R$5M)"
          desc="Exclusivo para Partner PRO. Operações de alto valor: FIDC, CRI, precatórios, fundos. Análise personalizada pela mesa."
        />

        <Text style={[styles.sectionTag, styles.mb8]}>Como submeter uma proposta</Text>
        <View style={styles.moduleSteps}>
          <Step n={1} title="Escolha o nível" desc="Acesse Mesa de Crédito → N1, N2 ou N3 conforme o valor do cliente." />
          <Step n={2} title="Clique em + Nova Proposta" desc="Preencha os dados do cliente: nome, CPF/CNPJ, valor, finalidade e renda." />
          <Step n={3} title="Anexe os documentos" desc="RG, CPF, comprovante de renda, matrícula do imóvel (quando aplicável)." />
          <Step n={4} title="Envie para análise" desc="A proposta vai automaticamente para a fila da Mesa Operacional." />
          <Step n={5} title="Acompanhe o status" desc="Você recebe notificações por e-mail e na plataforma a cada mudança de etapa." />
        </View>

        <InfoBox title="📋 ETAPAS DA PROPOSTA">
          <Text style={styles.infoBoxText}>
            TRIAGEM → ANÁLISE → PENDÊNCIA → APROVADO → FORMALIZAÇÃO → FINALIZADO{"\n"}
            Cada etapa tem um prazo de SLA definido. Propostas em atraso são destacadas automaticamente.
          </Text>
        </InfoBox>
        <PageFooter page="6" />
      </Page>

      {/* ── 5. MESA OPERACIONAL ──────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <PageHeader label="Mesa Operacional" />
        <SectionHeader
          tag="Capítulo 5"
          title="Mesa Operacional"
          subtitle="Central de acompanhamento e suporte às propostas. Exclusivo para equipe interna (Mesa, Gestão, Admin)."
        />
        <ModuleCard
          title="🎯 O que a Mesa Operacional faz"
          desc="A mesa recebe todas as propostas submetidas pelos partners, faz a triagem, solicita documentos pendentes, encaminha para instituições financeiras e atualiza o status de cada operação."
        />

        <Text style={[styles.sectionTag, styles.mb8]}>Fluxo de trabalho diário</Text>
        <View style={styles.moduleSteps}>
          <Step n={1} title="Verificar novas propostas" desc="Acesse Mesa Operacional → veja as propostas na etapa TRIAGEM. Abra o modal para ver todos os detalhes." />
          <Step n={2} title="Analisar documentação" desc="No modal da proposta, acesse a aba Anexos para visualizar todos os documentos enviados." />
          <Step n={3} title="Mover de etapa" desc="Use o seletor de status para mover a proposta: Análise → Pendência → Aprovado → Formalização." />
          <Step n={4} title="Adicionar comentários" desc="Registre observações no campo de comentários. O partner recebe notificação automaticamente." />
          <Step n={5} title="Encaminhar para instituição" desc="Selecione a instituição financeira no campo 'Encaminhar para' e a proposta aparece no portal deles." />
        </View>

        <InfoBox title="💬 CHAT COM PARTNERS E INSTITUIÇÕES">
          <Text style={styles.infoBoxText}>
            Cada proposta tem um chat dedicado para comunicação direta.{"\n"}
            Mensagens enviadas geram notificação por e-mail automaticamente para o destinatário.{"\n"}
            O widget de chat flutuante (ícone dourado, canto inferior direito) permite resposta rápida sem sair da tela.
          </Text>
        </InfoBox>
        <PageFooter page="7" />
      </Page>

      {/* ── 6. MESA M&A ──────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <PageHeader label="Mesa M&A" />
        <SectionHeader
          tag="Capítulo 6"
          title="Mesa M&A"
          subtitle="Pipeline completo de fusões, aquisições e estruturação de deals. Com geração de materiais por IA (FORJA)."
        />
        <ModuleCard
          title="🏗️ FORJA — Geração de Kit por IA"
          desc="O sistema FORJA usa inteligência artificial para gerar automaticamente o kit completo de um deal:"
        >
          <View style={styles.moduleSteps}>
            <Step n={1} title="Fase 1 — Score e Validação" desc="A IA analisa os dados do deal e gera um score de viabilidade com justificativas detalhadas." />
            <Step n={2} title="Fase 2 — Narrativa e Tese" desc="Geração automática da tese de investimento e narrativa estratégica do deal." />
            <Step n={3} title="Kit de Criativos" desc="CIM (Confidential Information Memorandum), Teaser Cego, post LinkedIn e Story Instagram." />
          </View>
        </ModuleCard>

        <ModuleCard
          title="🎯 Matching de Investidores"
          desc="Cadastre perfis de investidores e a plataforma faz o matching automático por setor, UF e ticket. Score calculado: Setor (40pts) + UF (30pts) + Ticket (30pts)."
        />

        <ModuleCard
          title="📁 Deal Rooms"
          desc="Workspace virtual por deal com VDR (Virtual Data Room), Q&A entre compradores e vendedores, histórico de documentos e rastreamento de acesso."
        />

        <TipBox>
          💡 O Teaser Cego protege a identidade do ativo até que o investidor assine o NDA dentro da plataforma.
        </TipBox>
        <PageFooter page="8" />
      </Page>

      {/* ── 7. CHAT ──────────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <PageHeader label="Chat" />
        <SectionHeader
          tag="Capítulo 7"
          title="Chat — Comunicação Interna"
          subtitle="Sistema de chat em tempo real integrado à plataforma para comunicação entre partners, mesa e instituições."
        />
        <View style={styles.row2}>
          <ModuleCard
            title="💬 Widget Flutuante"
            desc="Ícone dourado no canto inferior direito de todas as páginas. Clique para abrir o chat sem sair da tela atual. Badge vermelho indica mensagens não lidas."
          />
          <ModuleCard
            title="🔔 Notificações"
            desc="Som de notificação ao receber mensagem nova. E-mail automático enviado ao destinatário. Badge de contagem de mensagens não lidas."
          />
        </View>
        <ModuleCard
          title="📱 Como usar o chat"
          desc="Passo a passo para enviar e receber mensagens:"
        >
          <View style={styles.moduleSteps}>
            <Step n={1} title="Partners" desc="Clique no ícone dourado → Digite sua mensagem → Enter ou botão enviar. A mesa responde e você recebe e-mail de aviso." />
            <Step n={2} title="Mesa/Admin — Resposta Rápida" desc="O widget mostra a conversa mais recente. Digite e envie sem abrir o chat completo." />
            <Step n={3} title="Chat Completo" desc="Acesse /chat no menu para ver todas as conversas organizadas por sala (partner ou instituição)." />
          </View>
        </ModuleCard>
        <InfoBox title="🏛️ CHAT COM INSTITUIÇÕES">
          <Text style={styles.infoBoxText}>
            As instituições financeiras (ex: Oxigênio Capital) têm acesso ao portal institucional com chat dedicado.{"\n"}
            Mensagens da mesa para a instituição geram e-mail automático para o contato cadastrado.
          </Text>
        </InfoBox>
        <PageFooter page="9" />
      </Page>

      {/* ── 8. IA PARTNER ────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <PageHeader label="IA Partner" />
        <SectionHeader
          tag="Capítulo 8"
          title="V3 IA Partner"
          subtitle="Assistente de inteligência artificial com 7 squads especializados para suporte à operação."
        />
        <Text style={[styles.sectionTag, styles.mb8]}>Os 7 Squads de IA</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderCell}>Squad</Text>
            <Text style={styles.tableHeaderCell}>Especialidade</Text>
          </View>
          {[
            ["Crédito", "Análise de propostas, estruturação de operações de crédito e garantias"],
            ["M&A", "Avaliação de empresas, tese de investimento, due diligence"],
            ["Jurídico", "Contratos, compliance, regulatório CVM/BACEN"],
            ["Financeiro", "Modelagem financeira, projeções, valuation"],
            ["Comercial", "Scripts de vendas, objeções, pitch para investidores"],
            ["Marketing", "Conteúdo, copywriting, estratégia de comunicação"],
            ["Operações", "Processos internos, fluxos, automações"],
          ].map(([squad, spec]) => (
            <View key={squad} style={styles.tableRow}>
              <Text style={[styles.tableCellBold, { flex: 0.6 }]}>{squad}</Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>{spec}</Text>
            </View>
          ))}
        </View>
        <ModuleCard
          title="💡 Como usar a IA"
          desc="Acesse IA Partner no menu → Selecione o squad desejado → Digite sua pergunta em linguagem natural → A IA responde com base no contexto V3 Partners."
        />
        <TipBox>
          💡 Quanto mais contexto você der à IA (valor da operação, perfil do cliente, objetivo), mais precisa será a resposta. Use a IA para preparar reuniões, revisar propostas e criar materiais.
        </TipBox>
        <PageFooter page="10" />
      </Page>

      {/* ── 9. ACADEMY ───────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <PageHeader label="Academy" />
        <SectionHeader
          tag="Capítulo 9"
          title="V3 Academy"
          subtitle="Plataforma de treinamento com trilhas, vídeos, quizzes e certificações para partners."
        />
        <View style={styles.row2}>
          <ModuleCard
            title="🎓 Trilhas de Aprendizado"
            desc="Conteúdo organizado por categoria: Fundamentos V3, Crédito Estruturado, M&A, Consórcio e Academy M&A (exclusivo Partner PRO)."
          />
          <ModuleCard
            title="🏆 Certificações"
            desc="Complete as trilhas e faça os quizzes para obter certificados V3 Partners. Certificações aumentam credibilidade junto aos clientes."
          />
        </View>
        <ModuleCard
          title="📱 Como acessar o Academy"
          desc="Passo a passo:"
        >
          <View style={styles.moduleSteps}>
            <Step n={1} title="Acesse o Academy" desc="Clique em 'Academy' no menu lateral." />
            <Step n={2} title="Escolha uma trilha" desc="Selecione a categoria de interesse. Trilhas marcadas como 'PRO' são exclusivas para Partner PRO." />
            <Step n={3} title="Assista os vídeos" desc="O progresso é salvo automaticamente. Você pode retomar de onde parou." />
            <Step n={4} title="Faça o quiz" desc="Ao finalizar uma trilha, responda o quiz para liberar o certificado." />
            <Step n={5} title="Baixe seu certificado" desc="Certificados disponíveis na aba 'Meus Certificados' em PDF." />
          </View>
        </ModuleCard>
        <PageFooter page="11" />
      </Page>

      {/* ── 10. MARKETPLACE ──────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <PageHeader label="Marketplace" />
        <SectionHeader
          tag="Capítulo 10"
          title="Marketplace"
          subtitle="Catálogo de produtos e serviços financeiros disponíveis para oferecer aos seus clientes."
        />
        <ModuleCard
          title="🛒 O que é o Marketplace"
          desc="O marketplace reúne produtos curados pela V3 Partners que os partners podem oferecer aos clientes: seguros, consórcios, investimentos, produtos bancários e soluções financeiras especializadas."
        />
        <ModuleCard
          title="📋 Como gerar um lead pelo Marketplace"
          desc="Passo a passo para indicar um produto ao cliente:"
        >
          <View style={styles.moduleSteps}>
            <Step n={1} title="Acesse o Marketplace" desc="Menu lateral → Marketplace." />
            <Step n={2} title="Navegue pelos produtos" desc="Filtre por categoria: Crédito, Seguro, Investimento, Consórcio etc." />
            <Step n={3} title="Clique em 'Tenho interesse'" desc="Preencha os dados do cliente interessado." />
            <Step n={4} title="Acompanhe o lead" desc="O lead aparece no seu histórico. A equipe V3 entrará em contato com o cliente." />
          </View>
        </ModuleCard>
        <TipBox>
          💡 Cada lead convertido pelo marketplace gera comissão para o partner. As taxas variam por produto e estão descritas em cada card.
        </TipBox>
        <PageFooter page="12" />
      </Page>

      {/* ── 11. FINANCEIRO ───────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <PageHeader label="Financeiro" />
        <SectionHeader
          tag="Capítulo 11"
          title="Financeiro — Comissões e Assinatura"
          subtitle="Acompanhe suas comissões e gerencie sua assinatura V3 Partners."
        />
        <View style={styles.row2}>
          <ModuleCard
            title="💰 Comissões"
            desc="Visualize todas as comissões geradas por suas operações fechadas. Histórico mensal com filtro por período e status (pendente, pago, estornado)."
          />
          <ModuleCard
            title="🔀 Split Fiscal"
            desc="Configuração de divisão de receitas entre partners em operações compartilhadas. Percentuais definidos no momento da proposta."
          />
        </View>
        <InfoBox title="💳 ASSINATURA — PARTNER vs PARTNER PRO">
          <Text style={styles.infoBoxText}>
            Partner: R$197/mês → 30% de comissionamento nas operações{"\n"}
            Partner PRO: R$397/mês → 50% de comissionamento + co-branding + acesso a N3 e Academy M&A{"\n"}
            {"\n"}
            Pagamento via Pix ou boleto. Acesse 'Minha Assinatura' para renovar ou fazer upgrade.
          </Text>
        </InfoBox>
        <ModuleCard
          title="📄 Minha Assinatura"
          desc="Acesse Menu → Minha Assinatura para ver: data de vencimento, histórico de pagamentos, botão de renovação e opção de upgrade de plano."
        />
        <PageFooter page="13" />
      </Page>

      {/* ── 12. CONFIGURAÇÕES E DICAS ─────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <PageHeader label="Configurações e Dicas" />
        <SectionHeader
          tag="Capítulo 12"
          title="Configurações e Dicas Finais"
          subtitle="Personalize seu perfil, gerencie sua senha e aproveite ao máximo a plataforma."
        />
        <ModuleCard
          title="⚙️ Configurações do Perfil"
          desc="Acesse seu avatar no canto superior direito → Perfil para:"
        >
          <View style={styles.moduleSteps}>
            <Step n={1} title="Atualizar dados pessoais" desc="Nome, telefone, CPF/CNPJ, foto de perfil." />
            <Step n={2} title="Alterar senha" desc="Recomendado trocar a senha temporária do primeiro acesso." />
            <Step n={3} title="Notificações" desc="Configure quais alertas deseja receber por e-mail e na plataforma." />
          </View>
        </ModuleCard>

        <Text style={[styles.sectionTag, styles.mb8]}>Dicas para Usar Bem a Plataforma</Text>
        <View style={styles.moduleCard}>
          {[
            ["✅", "Mantenha o CRM atualizado", "Follow-ups em dia aumentam taxa de conversão em até 3x."],
            ["✅", "Use a IA antes das reuniões", "Os squads de IA preparam scripts e antecipam objeções dos clientes."],
            ["✅", "Ative notificações por e-mail", "Você não perde atualizações de propostas mesmo fora da plataforma."],
            ["✅", "Complete o Academy", "Certificações V3 aumentam sua credibilidade com clientes e instituições."],
            ["✅", "Acompanhe o chat diariamente", "A mesa responde em horário comercial — mantenha a comunicação ativa."],
          ].map(([icon, title, desc]) => (
            <View key={title} style={[styles.step, styles.mb8]}>
              <Text style={{ fontSize: 12, flexShrink: 0 }}>{icon}</Text>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>{title}</Text>
                <Text style={styles.stepDesc}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <InfoBox title="🆘 SUPORTE">
          <Text style={styles.infoBoxText}>
            Dúvidas? Use o chat da plataforma para falar diretamente com a Mesa V3 Partners.{"\n"}
            Horário de atendimento: Segunda a Sexta, das 9h às 18h (horário de Brasília).{"\n"}
            E-mail: contato@v3partners.com.br
          </Text>
        </InfoBox>
        <PageFooter page="14" />
      </Page>

      {/* ── CONTRA-CAPA ───────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.pageCover}>
        <View style={styles.coverAccent} />
        <View style={styles.coverContent}>
          <Text style={styles.coverTag}>V3 Partners · Plataforma Financeira</Text>
          <Text style={[styles.coverTitle, { fontSize: 24 }]}>
            Boutique institucional multiproduto{"\n"}de securitização e estruturação financeira.
          </Text>
          <View style={styles.coverDivider} />
          <Text style={styles.coverSubtitle}>
            Securitização · Real Estate · Mineração{"\n"}M&A · Cross-Border · Crédito Estruturado
          </Text>
          <Text style={styles.coverMeta}>
            app.v3partners.com.br{"\n"}
            contato@v3partners.com.br{"\n"}
            {"\n"}
            © 2026 V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50
          </Text>
        </View>
        <View style={styles.coverFooter}>
          <Text style={styles.coverFooterText}>Documento Confidencial — uso interno</Text>
        </View>
      </Page>

    </Document>
  );
}
