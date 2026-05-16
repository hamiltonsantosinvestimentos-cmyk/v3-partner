"use client";

import { CheckCircle2, Clock, AlertTriangle, XCircle, ChevronRight } from "lucide-react";

interface Props { userRole: string; userName: string; }

const STATUS = {
  done:    { icon: CheckCircle2, color: "#4ade80",  label: "Produção"        },
  active:  { icon: Clock,        color: "#C9A84C",  label: "Em andamento"    },
  pending: { icon: Clock,        color: "#7A8FA8",  label: "Pendente"        },
  risk:    { icon: AlertTriangle,color: "#fb923c",  label: "Atenção"         },
  blocked: { icon: XCircle,      color: "#f87171",  label: "Bloqueado"       },
};

type StatusKey = keyof typeof STATUS;

function StatusBadge({ type }: { type: StatusKey }) {
  const s = STATUS[type];
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase",
      color: s.color, background: `${s.color}18`, border: `1px solid ${s.color}35`,
      padding: "2px 8px", borderRadius: 3, whiteSpace: "nowrap",
    }}>
      {s.label}
    </span>
  );
}

const SPRINT_DONE = [
  { feature: "Integração Cora Bank (mTLS + Pix/boleto)",    date: "12/05", commits: "cbb96ef→e7319be" },
  { feature: "Teaser Cego FORJA — whitelist + blind geo",    date: "13-14/05", commits: "c17154a→a34b027" },
  { feature: "FORJA Two-Phase anti-504",                     date: "14/05", commits: "9c2b886→901d546"  },
  { feature: "Deal Matching Engine (investor_profiles)",     date: "13/05", commits: "92c2972"           },
  { feature: "Deal Discovery (detect-opportunities)",        date: "14/05", commits: "860cd22"           },
  { feature: "Transferência de Deal + notificação email",    date: "13/05", commits: "fa66cd6"           },
  { feature: "Squads IA — maxTokens + export consolidado",   date: "15/05", commits: "d8c9741"           },
  { feature: "Botão Apresentação V3 nos Squads",             date: "15/05", commits: "f0b8f45"           },
  { feature: "Sistema Anti-Falha (hooks v2/v3 + n8n W0)",   date: "13/05", commits: "—"                 },
];

const SPRINT_ACTIVE = [
  { feature: "n8n → Railway (migração cloud)", deadline: "Esta semana", owner: "Hamilton", status: "risk" as StatusKey },
  { feature: "Credit Engine — Schema Supabase (4 tabelas)", deadline: "25/05", owner: "Hamilton", status: "pending" as StatusKey },
  { feature: "Revisão LGPD + consentimento (Credit Engine)", deadline: "05/06", owner: "Robson Lino", status: "pending" as StatusKey },
  { feature: "Contrato Serasa Experian API", deadline: "05/06", owner: "João Lemos", status: "pending" as StatusKey },
  { feature: "Credit Engine — APIs pagas (Serasa+SPC+Jusbrasil)", deadline: "15/06", owner: "Hamilton", status: "pending" as StatusKey },
  { feature: "Credit Engine — Score V3 + Relatório PDF", deadline: "20/06", owner: "Hamilton", status: "pending" as StatusKey },
  { feature: "Beta fechado (5 partners selecionados)", deadline: "20/06", owner: "João Lemos", status: "pending" as StatusKey },
];

const RISKS = [
  { id: "R-01", desc: "n8n local — se PC reiniciar, W0/W2/W3 param", severity: "blocked" as StatusKey, action: "Migrar para Railway esta semana" },
  { id: "R-02", desc: "LGPD Credit Engine — consentimento não implementado", severity: "risk" as StatusKey, action: "Robson Lino revisar antes de testes com dados reais" },
  { id: "R-03", desc: "Investor profiles sem cadastros — matching inativo", severity: "pending" as StatusKey, action: "Cadastrar primeiros 3–5 perfis" },
];

const AGENTS = [
  // Mesa M&A
  { name:"ma-supervisor",    persona:"MAESTRO",  cat:"Mesa M&A",    color:"#C9A84C", desc:"Supervisor Central — conhece TODO o contexto de João Lemos. Orquestra os demais agentes e entrega soluções integradas.",             invoke:"@ma-supervisor",    path:"~/.claude/agents/ma-supervisor.md" },
  { name:"ma-deal-hunter",   persona:"SCOUT",    cat:"Mesa M&A",    color:"#C9A84C", desc:"Prospecção ativa de ativos e investidores no mercado brasileiro. Filtra e valida deals qualificados para o pipeline V3.",             invoke:"@ma-deal-hunter",   path:"~/.claude/agents/ma-deal-hunter.md" },
  { name:"ma-estruturador",  persona:"FORJA",    cat:"Mesa M&A",    color:"#C9A84C", desc:"Estrutura kit completo de peças M&A: CIM, Teaser Cego, LinkedIn Post e Story — PT-BR e EN — prontos para PDF.",                     invoke:"@ma-estruturador",  path:"~/.claude/agents/ma-estruturador.md" },
  { name:"buyside-agro-ma",  persona:"AGRO",     cat:"Mesa M&A",    color:"#C9A84C", desc:"Buyside M&A especializado em frigoríficos e usinas de açúcar/etanol. Qualifica por Regra dos 5 SIMs V3.",                            invoke:"@buyside-agro-ma",  path:"~/.claude/agents/buyside-agro-ma.md" },
  { name:"v3-scout",         persona:"V3 SCOUT", cat:"Mesa M&A",    color:"#C9A84C", desc:"Deal hunter nas 4 verticais V3: recebíveis, real estate, mineração e M&A cross-border. Qualifica pela tese V3.",                     invoke:"@v3-scout",         path:"~/.claude/agents/v3-scout.md" },
  // Brand & Visual
  { name:"identity-chief",   persona:"ID CHIEF", cat:"Brand",       color:"#E8C97A", desc:"Chefe de identidade. Decisões centrais de identidade visual, coordena brand-strategist, visual-director e logo-architect.",           invoke:"@identity-chief",   path:"~/.claude/agents/identity-chief.md" },
  { name:"brand-strategist", persona:"BRAND",    cat:"Brand",       color:"#E8C97A", desc:"Estratégia de marca V3. Posicionamento, voz da marca, arquitetura de mensagem e consistência institucional.",                        invoke:"@brand-strategist", path:"~/.claude/agents/brand-strategist.md" },
  { name:"visual-director",  persona:"VISUAL",   cat:"Brand",       color:"#E8C97A", desc:"Revisão final de peças visuais — paleta navy/ouro, DM Sans, logo, regra 90/8/2 e mobile-first em HTML/CSS.",                        invoke:"@visual-director",  path:"~/.claude/agents/visual-director.md" },
  { name:"brand-guardian",   persona:"GUARDIAN", cat:"Brand",       color:"#E8C97A", desc:"Conformidade da identidade visual V3. Verifica logo, cores navy/ouro, DM Sans e regra 90/8/2 em qualquer peça.",                    invoke:"@brand-guardian",   path:"~/.claude/agents/brand-guardian.md" },
  { name:"logo-architect",   persona:"LOGO",     cat:"Brand",       color:"#E8C97A", desc:"Logo e ativos visuais V3. Verifica uso correto das variantes (flat-gold, mono-cream, 3d) e regras de aplicação.",                    invoke:"@logo-architect",   path:"~/.claude/agents/logo-architect.md" },
  // Produto & Engenharia
  { name:"v3-feature-architect", persona:"ORION",cat:"Produto",     color:"#60a5fa", desc:"Arquiteto de features V3. Especifica, revisa e planeja novas funcionalidades com contexto completo de stack e roadmap.",             invoke:"@v3-feature-architect", path:"~/.claude/agents/v3-feature-architect.md" },
  { name:"hooks-architect",  persona:"LATCH",    cat:"Produto",     color:"#60a5fa", desc:"Arquiteto de hooks do lifecycle Claude Code. Cria, audita e depura hooks nos 17 eventos — gates de segurança e pipelines.",          invoke:"@hooks-architect",  path:"~/.claude/agents/hooks-architect.md" },
  { name:"swarm-orchestrator",persona:"SWARM",   cat:"Produto",     color:"#60a5fa", desc:"Orquestrador de swarms paralelos. Decompõe tarefas complexas em sub-tarefas, coordena múltiplos agentes e consolida resultados.",    invoke:"@swarm-orchestrator",path:"~/.claude/agents/swarm-orchestrator.md" },
  { name:"config-engineer",  persona:"CONFIG",   cat:"Produto",     color:"#60a5fa", desc:"Engenheiro de configuração Claude Code. Ajusta settings.json, permissions, deny/allow rules e variáveis de ambiente.",              invoke:"@config-engineer",  path:"~/.claude/agents/config-engineer.md" },
  { name:"mcp-integrator",   persona:"MCP",      cat:"Produto",     color:"#60a5fa", desc:"Integração de servidores MCP. Descobre, configura, audita e diagnostica MCPs em settings.json.",                                    invoke:"@mcp-integrator",   path:"~/.claude/agents/mcp-integrator.md" },
  { name:"claude-mastery-chief",persona:"MASTERY",cat:"Produto",    color:"#60a5fa", desc:"Orquestrador do setup Claude Code. Audita, configura, otimiza e diagnostica o ambiente — hooks, settings, MCPs, CLAUDE.md.",        invoke:"@claude-mastery-chief",path:"~/.claude/agents/claude-mastery-chief.md" },
  { name:"skill-craftsman",  persona:"CRAFT",    cat:"Produto",     color:"#60a5fa", desc:"Criador de skills e slash commands. Projeta, escreve e registra novos skills — definição, frontmatter e dependências.",             invoke:"@skill-craftsman",  path:"~/.claude/agents/skill-craftsman.md" },
  { name:"project-integrator",persona:"INTEGRA", cat:"Produto",     color:"#60a5fa", desc:"Integração de projetos no Claude Code. Conecta repositórios, estrutura CLAUDE.md e integra squads ao ambiente.",                   invoke:"@project-integrator",path:"~/.claude/agents/project-integrator.md" },
  // Gestão & Governança
  { name:"project-pm",       persona:"AXIS",     cat:"Gestão",      color:"#c084fc", desc:"Technical PM V3. Governança Agile/Scrum para time de 2, guardião do Handbook de identidade visual e estrutura modular.",            invoke:"@project-pm",       path:"~/.claude/agents/project-pm.md" },
  { name:"roadmap-sentinel", persona:"SENTINEL", cat:"Gestão",      color:"#c084fc", desc:"Guardião do roadmap V3. Rastreia OKRs, monitora entregas pendentes e sinaliza desvios de prazo nas frentes ativas.",               invoke:"@roadmap-sentinel",  path:"~/.claude/agents/roadmap-sentinel.md" },
  // Database
  { name:"data-engineer",    persona:"DARA",     cat:"Database",    color:"#4ade80", desc:"Database Architect & Operations Engineer (AIOX). Schema design, migrations, RLS policies, query optimization, snapshots.",          invoke:"@data-engineer",    path:"AIOX:agents:data-engineer (skill userSettings)" },
];

const AGENT_CATS = ["Mesa M&A","Brand","Produto","Gestão","Database"];
const CAT_COLORS: Record<string,string> = {
  "Mesa M&A":"#C9A84C","Brand":"#E8C97A","Produto":"#60a5fa","Gestão":"#c084fc","Database":"#4ade80"
};

const ADRS = [
  { id: "ADR-001", decision: "FORJA two-phase (anti-504)",       date: "14/05", reason: "Vercel timeout 60s — chamada única excedia limite" },
  { id: "ADR-002", decision: "Teaser Cego whitelist",            date: "14/05", reason: "Blacklist causava vazamento de localização" },
  { id: "ADR-003", decision: "maxTokens por squad",              date: "15/05", reason: "Executor precisa 6000 tokens; outros 4096" },
  { id: "ADR-004", decision: "getBaseUrl(req) para blob URLs",   date: "14/05", reason: "Paths relativos não resolvem em blob: context" },
  { id: "ADR-005", decision: "Haiku sem docs · Sonnet com docs", date: "14/05", reason: "FORJA de 30s para 5s sem PDFs" },
  { id: "ADR-006", decision: "sanitizeDeal — exclui 16+ campos", date: "14/05", reason: "forja_result (9.6KB) estourava contexto Claude" },
  { id: "ADR-007", decision: "n8n W0 error catch universal",     date: "13/05", reason: "W2+W3 precisavam de captura centralizada" },
  { id: "ADR-008", decision: "credit_consents obrigatório",      date: "16/05", reason: "LGPD Art.7 — consentimento explícito por fonte" },
];

export function GovernancaClient({ userRole, userName }: Props) {
  const gold = "#C9A84C";
  const navy = "#09081A";
  const navyB = "#111F35";
  const navyC = "#162744";
  const navyM = "#243A66";
  const cream = "#F0ECE4";
  const muted = "#7A8FA8";

  return (
    <div style={{ minHeight: "100vh", background: navy, color: cream, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "48px 24px" }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 22, height: 2, background: gold }} />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: gold }}>
              Governança Corporativa · Portal V3
            </span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: cream, marginBottom: 8, letterSpacing: -1 }}>
            Roadmap de Implantação
          </h1>
          <p style={{ color: muted, fontSize: 13, lineHeight: 1.7, maxWidth: 580 }}>
            Rastreabilidade técnica completa — features em produção, sprint ativo, decisões de arquitetura e riscos operacionais. Atualizado a cada ciclo de desenvolvimento.
          </p>
          <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
            {[
              { label: "Commits Mai/2026", value: "38" },
              { label: "Tabelas Supabase", value: "57" },
              { label: "Go-Live Credit Engine", value: "25/Jun" },
              { label: "Migrações aplicadas", value: "10/10" },
            ].map(k => (
              <div key={k.label} style={{ background: navyC, border: `1px solid ${navyM}`, borderRadius: 8, padding: "12px 18px" }}>
                <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: muted, marginBottom: 4 }}>{k.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: gold }}>{k.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Sprint Concluído */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: gold, textTransform: "uppercase", letterSpacing: 2, marginBottom: 14 }}>
            Sprint Mai/2026 — Concluído
          </h2>
          <div style={{ background: navyB, border: `1px solid ${navyM}`, borderRadius: 10, overflow: "hidden" }}>
            {SPRINT_DONE.map((item, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "11px 18px", borderBottom: i < SPRINT_DONE.length - 1 ? `1px solid ${navyC}` : "none",
                flexWrap: "wrap", gap: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <CheckCircle2 size={14} color="#4ade80" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: cream }}>{item.feature}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 10, color: muted }}>{item.date}</span>
                  <code style={{ fontSize: 9, color: gold, background: navyC, padding: "2px 6px", borderRadius: 3, fontFamily: "monospace" }}>
                    {item.commits}
                  </code>
                  <StatusBadge type="done" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Sprint Ativo */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: gold, textTransform: "uppercase", letterSpacing: 2, marginBottom: 14 }}>
            Sprint Jun/2026 — Em andamento · Go-Live 25/Jun
          </h2>
          <div style={{ background: navyB, border: `1px solid ${navyM}`, borderRadius: 10, overflow: "hidden" }}>
            {SPRINT_ACTIVE.map((item, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "11px 18px", borderBottom: i < SPRINT_ACTIVE.length - 1 ? `1px solid ${navyC}` : "none",
                flexWrap: "wrap", gap: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Clock size={14} color={item.status === "risk" ? "#fb923c" : muted} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: cream }}>{item.feature}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 10, color: muted }}>até {item.deadline}</span>
                  <span style={{ fontSize: 10, color: gold, fontWeight: 600 }}>{item.owner}</span>
                  <StatusBadge type={item.status} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Riscos */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#fb923c", textTransform: "uppercase", letterSpacing: 2, marginBottom: 14 }}>
            Riscos e Alertas Ativos
          </h2>
          <div style={{ display: "grid", gap: 10 }}>
            {RISKS.map((r, i) => (
              <div key={i} style={{
                background: navyB, border: `1px solid ${r.severity === "blocked" ? "#f8717135" : "#fb923c35"}`,
                borderLeft: `3px solid ${r.severity === "blocked" ? "#f87171" : "#fb923c"}`,
                borderRadius: "0 8px 8px 0", padding: "12px 16px",
                display: "flex", gap: 12, alignItems: "flex-start",
              }}>
                <AlertTriangle size={14} color={r.severity === "blocked" ? "#f87171" : "#fb923c"} style={{ marginTop: 1, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <code style={{ fontSize: 9, color: gold, fontFamily: "monospace" }}>{r.id}</code>
                    <span style={{ fontSize: 12, color: cream, fontWeight: 600 }}>{r.desc}</span>
                  </div>
                  <span style={{ fontSize: 11, color: muted }}>Ação: {r.action}</span>
                </div>
                <StatusBadge type={r.severity} />
              </div>
            ))}
          </div>
        </section>

        {/* ADRs */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: gold, textTransform: "uppercase", letterSpacing: 2, marginBottom: 14 }}>
            Decisões de Arquitetura (ADRs)
          </h2>
          <div style={{ background: navyB, border: `1px solid ${navyM}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 60px", background: navyC, padding: "8px 18px", borderBottom: `1px solid ${navyM}` }}>
              {["ID", "Decisão", "Contexto / Motivo", "Data"].map(h => (
                <span key={h} style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: gold }}>{h}</span>
              ))}
            </div>
            {ADRS.map((a, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "80px 1fr 1fr 60px",
                padding: "10px 18px", borderBottom: i < ADRS.length - 1 ? `1px solid ${navyC}` : "none",
                alignItems: "start",
              }}>
                <code style={{ fontSize: 9, color: gold, fontFamily: "monospace" }}>{a.id}</code>
                <span style={{ fontSize: 12, color: cream, paddingRight: 12 }}>{a.decision}</span>
                <span style={{ fontSize: 11, color: muted, paddingRight: 12 }}>{a.reason}</span>
                <span style={{ fontSize: 10, color: muted }}>{a.date}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Banco de Agentes V3 */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: gold, textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>
            Banco de Agentes V3 — {AGENTS.length} agentes
          </h2>
          <p style={{ fontSize: 12, color: muted, marginBottom: 16, lineHeight: 1.6 }}>
            Ativação via Claude Code terminal: <code style={{ color: gold, fontFamily: "monospace", fontSize: 11, background: navyC, padding: "1px 5px", borderRadius: 3 }}>@nome-do-agente</code>&nbsp;
            · Arquivos em <code style={{ color: gold, fontFamily: "monospace", fontSize: 11, background: navyC, padding: "1px 5px", borderRadius: 3 }}>C:\Users\jlemo\.claude\agents\</code>
            · Pre-Execution Gate ativo em todos via <code style={{ color: gold, fontFamily: "monospace", fontSize: 11, background: navyC, padding: "1px 5px", borderRadius: 3 }}>~/.claude/rules/v3-agent-execution-protocol.md</code>
          </p>

          {AGENT_CATS.map(cat => {
            const catAgents = AGENTS.filter(a => a.cat === cat);
            const catColor = CAT_COLORS[cat];
            return (
              <div key={cat} style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 3, height: 16, background: catColor, borderRadius: 2 }} />
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: catColor }}>
                    {cat} · {catAgents.length} agente{catAgents.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
                  {catAgents.map(agent => (
                    <div key={agent.name} style={{
                      background: navyB, border: `1px solid ${navyM}`,
                      borderLeft: `3px solid ${agent.color}`,
                      borderRadius: "0 8px 8px 0", padding: "12px 14px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            fontSize: 8, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase",
                            color: navyB, background: agent.color, padding: "2px 7px", borderRadius: 3,
                          }}>
                            {agent.persona}
                          </span>
                          <code style={{ fontSize: 10, color: agent.color, fontFamily: "monospace" }}>
                            {agent.invoke}
                          </code>
                        </div>
                      </div>
                      <p style={{ fontSize: 11, color: muted, lineHeight: 1.55, margin: 0, marginBottom: 6 }}>
                        {agent.desc}
                      </p>
                      <code style={{ fontSize: 9, color: "#4b5563", fontFamily: "monospace" }}>
                        {agent.path}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Protocolo entre agentes */}
          <div style={{
            background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.2)",
            borderRadius: 8, padding: "14px 18px", marginTop: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 3, height: 16, background: "#60a5fa", borderRadius: 2 }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#60a5fa" }}>
                Protocolo de Colaboração ORION + Dara
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 28px 1fr 28px 1fr", gap: 0, alignItems: "center" }}>
              {[
                { step: "1", label: "ORION", detail: "*spec [feature] → BRIEF obrigatório → aprovação usuário", color: "#60a5fa" },
                null,
                { step: "2", label: "DARA", detail: "Recebe HANDOFF → executa próprio BRIEF → migration SQL", color: "#4ade80" },
                null,
                { step: "3", label: "ORION", detail: "*review [resultado] → valida padrões V3", color: "#60a5fa" },
              ].map((item, i) => item ? (
                <div key={i} style={{ background: navyC, border: `1px solid ${item.color}30`, borderRadius: 6, padding: "10px 12px" }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: item.color, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
                    STEP {item.step} · {item.label}
                  </div>
                  <div style={{ fontSize: 10, color: muted, lineHeight: 1.5 }}>{item.detail}</div>
                </div>
              ) : (
                <div key={i} style={{ textAlign: "center", color: "#243A66", fontSize: 18, fontWeight: 700 }}>→</div>
              ))}
            </div>
            <p style={{ fontSize: 10, color: "#4b5563", marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
              Nenhum agente escreve código ou SQL sem executar BRIEF e receber aprovação explícita.
              Regras em <code style={{ fontFamily: "monospace" }}>~/.claude/rules/v3-agent-execution-protocol.md</code>
              · <code style={{ fontFamily: "monospace" }}>~/.claude/rules/v3-dara-gate.md</code>
            </p>
          </div>
        </section>

        {/* Footer info */}
        <div style={{ background: navyB, border: `1px solid ${navyM}`, borderRadius: 8, padding: "14px 18px", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ width: 3, height: 36, background: gold, borderRadius: 2, flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: gold, marginBottom: 4 }}>
              Fonte de verdade
            </p>
            <p style={{ fontSize: 12, color: muted }}>
              Este painel é gerado a partir de <code style={{ color: gold, fontFamily: "monospace", fontSize: 11 }}>GOVERNANCE.md</code> no repositório principal.
              Atualizado a cada push para <code style={{ color: gold, fontFamily: "monospace", fontSize: 11 }}>main</code> — Vercel auto-deploys em segundos.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
