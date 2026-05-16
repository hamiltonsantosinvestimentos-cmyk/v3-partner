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
