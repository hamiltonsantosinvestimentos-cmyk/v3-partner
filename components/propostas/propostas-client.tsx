"use client";

import { useState, useEffect, useRef } from "react";
import {
  FileCheck2, Plus, X, Send, MessageSquare, Bell,
  Eye, PenLine, Clock, ChevronRight, Loader2,
  Building2, Mail, User, DollarSign, FileText, Check,
} from "lucide-react";

// ─── Paleta V4.2 ──────────────────────────────────────────────────────────────
const V3 = {
  navy:  "#09081A",
  navyB: "#13223A",
  navyC: "#162744",
  navyM: "#243A66",
  gold:  "#C9A84C",
  goldL: "#E8C97A",
  cream: "#F5F1E8",
  muted: "#9BAFC5",
  green: "#4ade80",
  red:   "#f87171",
  amber: "#E89B3A",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type ServiceType = "due_diligence" | "relatorio_premium" | "consultoria" | "narrativa_venda" | "outro";
type PropostaStatus = "draft" | "sent" | "viewed" | "signed" | "rejected" | "expired";
type MsgType = "internal_note" | "system_event" | "client_update";

type Proposta = {
  id: string;
  code: string;
  title: string;
  service_type: ServiceType;
  status: PropostaStatus;
  created_by: string;
  partner_id?: string;
  partner_name?: string;
  partner_email?: string;
  recipient_name: string;
  recipient_email: string;
  recipient_company?: string;
  value?: number;
  description?: string;
  deal_id?: string;
  clicksign_url?: string;
  sent_at?: string;
  signed_at?: string;
  expires_at?: string;
  created_at: string;
};

type PropostaMsg = {
  id: string;
  proposal_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  type: MsgType;
  created_at: string;
};

type NewForm = {
  title: string;
  service_type: ServiceType;
  recipient_name: string;
  recipient_email: string;
  recipient_company: string;
  value: string;
  description: string;
  deal_id: string;
  partner_id: string;
  partner_name: string;
  partner_email: string;
};

// ─── Configs ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<PropostaStatus, { label: string; color: string; bg: string }> = {
  draft:    { label: "Rascunho",    color: V3.muted,  bg: "rgba(155,175,197,.12)" },
  sent:     { label: "Enviada",     color: V3.amber,  bg: "rgba(232,155,58,.12)"  },
  viewed:   { label: "Visualizada", color: V3.gold,   bg: "rgba(201,168,76,.12)"  },
  signed:   { label: "Assinada",    color: V3.green,  bg: "rgba(74,222,128,.12)"  },
  rejected: { label: "Recusada",    color: V3.red,    bg: "rgba(248,113,113,.12)" },
  expired:  { label: "Expirada",    color: V3.muted,  bg: "rgba(155,175,197,.08)" },
};

const SERVICE_LABELS: Record<ServiceType, string> = {
  due_diligence:    "Due Diligence",
  relatorio_premium:"Relatório Premium",
  consultoria:      "Consultoria",
  narrativa_venda:  "Narrativa de Venda (IA)",
  outro:            "Outro",
};

const MSG_CONFIG: Record<MsgType, { icon: React.ElementType; color: string; label: string }> = {
  internal_note: { icon: MessageSquare, color: V3.muted,  label: "Nota interna" },
  system_event:  { icon: Bell,          color: V3.gold,   label: "Sistema"      },
  client_update: { icon: Send,          color: V3.green,  label: "Cliente"      },
};

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtBRL(v?: number) {
  if (!v) return "—";
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}
function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}
function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `há ${d}d`;
  if (h > 0) return `há ${h}h`;
  if (m > 0) return `há ${m}min`;
  return "agora";
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: PropostaStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
      textTransform: "uppercase", color: cfg.color,
      background: cfg.bg, border: `1px solid ${cfg.color}30`,
      padding: "3px 8px", borderRadius: 20,
    }}>
      {cfg.label}
    </span>
  );
}

// ─── Input helper ─────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: "block", fontSize: 9, fontWeight: 700,
        letterSpacing: "0.15em", textTransform: "uppercase",
        color: V3.goldL, marginBottom: 6,
      }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: V3.navyC,
  border: `1px solid ${V3.navyM}`, borderRadius: 6,
  padding: "9px 12px", color: V3.cream,
  fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none",
  boxSizing: "border-box",
};

// ─── Main Component ───────────────────────────────────────────────────────────
export function PropostasClient({
  userRole,
  userId,
  userName,
  complianceOk = true,
}: {
  userRole: string;
  userId: string;
  userName: string;
  complianceOk?: boolean;
}) {
  const canAccess = ALLOWED.includes(userRole);

  const [propostas, setPropostas]       = useState<Proposta[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selected, setSelected]         = useState<Proposta | null>(null);
  const [detailTab, setDetailTab]       = useState<"detalhes" | "conversas">("detalhes");
  const [showNew, setShowNew]           = useState(false);
  const [creating, setCreating]         = useState(false);
  const [sending, setSending]           = useState(false);
  const [sendOk, setSendOk]             = useState(false);
  const [msgs, setMsgs]                 = useState<PropostaMsg[]>([]);
  const [msgsLoading, setMsgsLoading]   = useState(false);
  const [newNote, setNewNote]           = useState("");
  const [savingNote, setSavingNote]     = useState(false);
  const msgsEndRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<NewForm>({
    title: "", service_type: "consultoria",
    recipient_name: "", recipient_email: "", recipient_company: "",
    value: "", description: "",
    deal_id: "", partner_id: "", partner_name: "", partner_email: "",
  });

  // ── Buscar Deal (pré-preencher a partir de um deal existente) ──
  const [dealCode, setDealCode] = useState("");
  const [dealSearching, setDealSearching] = useState(false);
  const [dealFound, setDealFound] = useState<{ id: string; code: string; title: string; sector: string | null; value: number | null } | null>(null);
  const [dealSearchError, setDealSearchError] = useState("");
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeError, setNarrativeError] = useState("");

  // ── Carregar propostas ──
  useEffect(() => {
    fetch("/api/propostas")
      .then(r => r.json())
      .then(({ proposals }) => setPropostas(Array.isArray(proposals) ? proposals : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Carregar mensagens ao abrir conversas ──
  useEffect(() => {
    if (!selected || detailTab !== "conversas") return;
    setMsgsLoading(true);
    fetch(`/api/propostas/${selected.id}/messages`)
      .then(r => r.json())
      .then(({ messages }) => setMsgs(Array.isArray(messages) ? messages : []))
      .catch(() => {})
      .finally(() => setMsgsLoading(false));
  }, [selected?.id, detailTab]);

  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  // ── Criar proposta ──
  const handleCreate = async () => {
    if (!form.title || !form.recipient_name || !form.recipient_email) return;
    setCreating(true);
    try {
      const res = await fetch("/api/propostas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          value: form.value ? Number(form.value) : undefined,
          deal_id: form.deal_id || undefined,
          partner_id: form.partner_id || undefined,
          partner_name: form.partner_name || undefined,
          partner_email: form.partner_email || undefined,
        }),
      });
      const { proposal } = await res.json();
      if (proposal) {
        setPropostas(prev => [proposal, ...prev]);
        setShowNew(false);
        setForm({
          title: "", service_type: "consultoria",
          recipient_name: "", recipient_email: "", recipient_company: "",
          value: "", description: "",
          deal_id: "", partner_id: "", partner_name: "", partner_email: "",
        });
        setDealCode(""); setDealFound(null); setDealSearchError("");
      }
    } catch {}
    setCreating(false);
  };

  // ── Buscar deal por código ──
  const handleSearchDeal = async () => {
    if (!dealCode.trim()) return;
    setDealSearching(true);
    setDealSearchError("");
    setDealFound(null);
    try {
      const res = await fetch(`/api/propostas/deal-lookup?code=${encodeURIComponent(dealCode.trim())}`);
      const data = await res.json();
      if (!res.ok || !data.found) {
        setDealSearchError(data.error ?? "Deal não encontrado.");
        return;
      }
      setDealFound(data.deal);
      const comprador = (data.participants ?? []).find((p: { role: string }) => p.role === "comprador")
        ?? (data.participants ?? [])[0];
      setForm(f => ({
        ...f,
        deal_id: data.deal.id,
        title: f.title || `Proposta Comercial · ${data.deal.title}`,
        value: data.deal.value ? String(data.deal.value) : f.value,
        recipient_name: comprador?.name ?? f.recipient_name,
        recipient_email: comprador?.email ?? f.recipient_email,
        recipient_company: comprador?.role === "comprador" ? String(data.deal.title ?? f.recipient_company) : f.recipient_company,
      }));
    } catch {
      setDealSearchError("Erro de conexão. Tente novamente.");
    } finally {
      setDealSearching(false);
    }
  };

  // ── Gerar narrativa de venda com IA a partir do deal vinculado ──
  const handleGerarNarrativa = async () => {
    if (!form.deal_id) return;
    setNarrativeLoading(true);
    setNarrativeError("");
    try {
      const res = await fetch("/api/propostas/gerar-narrativa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal_id: form.deal_id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setNarrativeError(data.error ?? "Erro ao gerar narrativa.");
        return;
      }
      setForm(f => ({ ...f, description: data.descricao_sugerida, service_type: "narrativa_venda" }));
    } catch {
      setNarrativeError("Erro de conexão. Tente novamente.");
    } finally {
      setNarrativeLoading(false);
    }
  };

  // ── Enviar proposta ──
  const handleSend = async () => {
    if (!selected || !complianceOk) return;
    setSending(true);
    try {
      const res = await fetch(`/api/propostas/${selected.id}/send`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        const updated = { ...selected, status: "sent" as PropostaStatus, sent_at: new Date().toISOString() };
        setSelected(updated);
        setPropostas(prev => prev.map(p => p.id === selected.id ? updated : p));
        setSendOk(true);
        setTimeout(() => setSendOk(false), 4000);
      }
    } catch {}
    setSending(false);
  };

  // ── Nova nota interna ──
  const handleNote = async () => {
    if (!selected || !newNote.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/propostas/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote.trim(), type: "internal_note" }),
      });
      const { message } = await res.json();
      if (message) {
        setMsgs(prev => [...prev, message]);
        setNewNote("");
      }
    } catch {}
    setSavingNote(false);
  };

  if (!canAccess) return (
    <div className="flex items-center justify-center h-48" style={{ color: V3.muted }}>
      <p style={{ fontSize: 13 }}>Acesso restrito — Mesa M&A e Gestão</p>
    </div>
  );

  // ── KPIs ──
  const kpis = [
    { label: "Total",     value: propostas.length,                                        color: V3.cream },
    { label: "Rascunhos", value: propostas.filter(p => p.status === "draft").length,      color: V3.muted },
    { label: "Enviadas",  value: propostas.filter(p => p.status === "sent").length,       color: V3.amber },
    { label: "Assinadas", value: propostas.filter(p => p.status === "signed").length,     color: V3.green },
  ];

  return (
    <div style={{ minHeight: "100vh", background: V3.navy, color: V3.cream, fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ borderBottom: `1px solid ${V3.navyC}`, background: V3.navyB, padding: "20px 24px" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div style={{ width: 36, height: 36, borderRadius: 8, background: `rgba(201,168,76,.15)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileCheck2 size={18} color={V3.gold} />
            </div>
            <div>
              <h1 style={{ fontSize: 15, fontWeight: 700, color: V3.cream, margin: 0 }}>Propostas Comerciais</h1>
              <p style={{ fontSize: 11, color: V3.muted, margin: 0 }}>Serviços extras V3 Partners</p>
            </div>
          </div>
          <button
            onClick={() => setShowNew(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: V3.gold, color: V3.navy,
              border: "none", borderRadius: 6, padding: "8px 16px",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            <Plus size={14} /> Nova Proposta
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3">
          {kpis.map(k => (
            <div key={k.label} style={{ background: V3.navyC, border: `1px solid ${V3.navyM}`, borderRadius: 8, padding: "12px 16px" }}>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: V3.goldL, margin: "0 0 4px" }}>{k.label}</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: k.color, margin: 0 }}>{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Lista ── */}
      <div style={{ padding: "20px 24px" }}>
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2" style={{ color: V3.muted }}>
            <Loader2 size={18} className="animate-spin" style={{ color: V3.gold }} />
            <span style={{ fontSize: 13 }}>Carregando propostas...</span>
          </div>
        )}

        {!loading && propostas.length === 0 && (
          <div className="text-center py-16" style={{ color: V3.muted }}>
            <FileCheck2 size={32} style={{ color: V3.navyM, margin: "0 auto 12px" }} />
            <p style={{ fontSize: 13, margin: 0 }}>Nenhuma proposta criada ainda.</p>
            <p style={{ fontSize: 11, margin: "4px 0 0", color: V3.navyM }}>Clique em "Nova Proposta" para começar.</p>
          </div>
        )}

        {!loading && propostas.length > 0 && (
          <div style={{ display: "grid", gap: 10 }}>
            {propostas.map(p => (
              <div
                key={p.id}
                onClick={() => { setSelected(p); setDetailTab("detalhes"); setSendOk(false); }}
                className="cursor-pointer group"
                style={{
                  background: V3.navyB, border: `1px solid ${V3.navyC}`,
                  borderRadius: 8, padding: "14px 18px",
                  transition: "border-color 0.2s",
                }}
                onMouseOver={e => (e.currentTarget.style.borderColor = `rgba(201,168,76,.35)`)}
                onMouseOut={e => (e.currentTarget.style.borderColor = V3.navyC)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <StatusBadge status={p.status} />
                      <span style={{ fontSize: 9, color: V3.navyM, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                        {p.code}
                      </span>
                      <span style={{ fontSize: 9, color: V3.muted, background: V3.navyC, padding: "2px 7px", borderRadius: 4 }}>
                        {SERVICE_LABELS[p.service_type]}
                      </span>
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: V3.cream, margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.title}
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1" style={{ fontSize: 11, color: V3.muted }}>
                        <User size={10} /> {p.recipient_name}
                        {p.recipient_company && ` — ${p.recipient_company}`}
                      </span>
                      {p.value && (
                        <span style={{ fontSize: 11, color: V3.goldL, fontWeight: 700 }}>{fmtBRL(p.value)}</span>
                      )}
                      {p.partner_name && (
                        <span className="flex items-center gap-1" style={{ fontSize: 10, color: V3.muted }}>
                          <Building2 size={9} /> CC: {p.partner_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <ChevronRight size={14} color={V3.navyM} />
                    <span style={{ fontSize: 10, color: V3.navyM }}>{fmtDate(p.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal de Detalhe ── */}
      {selected && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(9,8,26,.88)", backdropFilter: "blur(4px)",
          zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center",
          padding: 16,
        }}>
          <div style={{
            background: V3.navyB, border: `1px solid ${V3.navyM}`,
            borderRadius: 12, width: "100%", maxWidth: 600,
            maxHeight: "90vh", display: "flex", flexDirection: "column",
            boxShadow: "0 24px 72px rgba(0,0,0,.7)",
          }}>
            {/* Header modal */}
            <div style={{ padding: "20px 24px 0", flexShrink: 0 }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={selected.status} />
                    <span style={{ fontSize: 10, color: V3.navyM, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>{selected.code}</span>
                  </div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: V3.cream, margin: 0 }}>{selected.title}</h2>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: V3.muted, padding: 4 }}>
                  <X size={18} />
                </button>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: `1px solid ${V3.navyC}` }}>
                {(["detalhes", "conversas"] as const).map(tab => (
                  <button key={tab} onClick={() => setDetailTab(tab)}
                    style={{
                      padding: "8px 16px", fontSize: 12, fontWeight: 500,
                      background: "none", border: "none", cursor: "pointer",
                      borderBottom: detailTab === tab ? `2px solid ${V3.gold}` : "2px solid transparent",
                      color: detailTab === tab ? V3.gold : V3.muted,
                      textTransform: "capitalize",
                    }}>
                    {tab === "detalhes" ? "Detalhes" : "Conversas"}
                  </button>
                ))}
              </div>
            </div>

            {/* Conteúdo */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
              {/* ── TAB DETALHES ── */}
              {detailTab === "detalhes" && (
                <div style={{ display: "grid", gap: 14 }}>
                  {/* Destinatário */}
                  <div style={{ background: V3.navyC, border: `1px solid ${V3.navyM}`, borderRadius: 8, padding: 14 }}>
                    <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: V3.goldL, margin: "0 0 8px" }}>Destinatário</p>
                    <div style={{ display: "grid", gap: 4 }}>
                      <span className="flex items-center gap-2" style={{ fontSize: 12, color: V3.cream }}>
                        <User size={11} color={V3.muted} /> {selected.recipient_name}
                      </span>
                      <span className="flex items-center gap-2" style={{ fontSize: 12, color: V3.muted }}>
                        <Mail size={11} color={V3.muted} /> {selected.recipient_email}
                      </span>
                      {selected.recipient_company && (
                        <span className="flex items-center gap-2" style={{ fontSize: 12, color: V3.muted }}>
                          <Building2 size={11} color={V3.muted} /> {selected.recipient_company}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Serviço + Valor */}
                  <div className="grid grid-cols-2 gap-3">
                    <div style={{ background: V3.navyC, border: `1px solid ${V3.navyM}`, borderRadius: 8, padding: 14 }}>
                      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: V3.goldL, margin: "0 0 4px" }}>Serviço</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: V3.cream, margin: 0 }}>{SERVICE_LABELS[selected.service_type]}</p>
                    </div>
                    <div style={{ background: V3.navyC, border: `1px solid ${V3.navyM}`, borderRadius: 8, padding: 14 }}>
                      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: V3.goldL, margin: "0 0 4px" }}>Valor</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: V3.gold, margin: 0 }}>{fmtBRL(selected.value)}</p>
                    </div>
                  </div>

                  {/* Partner CC */}
                  {selected.partner_name && (
                    <div style={{ background: `rgba(201,168,76,.05)`, borderLeft: `3px solid ${V3.gold}`, borderRadius: "0 6px 6px 0", padding: "10px 14px" }}>
                      <p style={{ fontSize: 10, color: V3.goldL, fontWeight: 700, margin: "0 0 2px" }}>Partner em cópia</p>
                      <p style={{ fontSize: 12, color: V3.muted, margin: 0 }}>{selected.partner_name} — {selected.partner_email}</p>
                    </div>
                  )}

                  {/* Descrição */}
                  {selected.description && (
                    <div style={{ background: V3.navyC, border: `1px solid ${V3.navyM}`, borderRadius: 8, padding: 14 }}>
                      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: V3.goldL, margin: "0 0 6px" }}>Descrição da Proposta</p>
                      <p style={{ fontSize: 12, color: V3.muted, lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>{selected.description}</p>
                    </div>
                  )}

                  {/* Datas */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: V3.muted, margin: "0 0 2px" }}>Criada em</p>
                      <p style={{ fontSize: 12, color: V3.cream, margin: 0 }}>{fmtDate(selected.created_at)}</p>
                    </div>
                    {selected.sent_at && (
                      <div>
                        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: V3.muted, margin: "0 0 2px" }}>Enviada em</p>
                        <p style={{ fontSize: 12, color: V3.cream, margin: 0 }}>{fmtDate(selected.sent_at)}</p>
                      </div>
                    )}
                    {selected.signed_at && (
                      <div>
                        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: V3.green, margin: "0 0 2px" }}>Assinada em</p>
                        <p style={{ fontSize: 12, color: V3.green, margin: 0, fontWeight: 600 }}>{fmtDate(selected.signed_at)}</p>
                      </div>
                    )}
                    {selected.expires_at && (
                      <div>
                        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: V3.muted, margin: "0 0 2px" }}>Expira em</p>
                        <p style={{ fontSize: 12, color: V3.muted, margin: 0 }}>{fmtDate(selected.expires_at)}</p>
                      </div>
                    )}
                  </div>

                  {/* Link ClickSign */}
                  {selected.clicksign_url && (
                    <a href={selected.clicksign_url} target="_blank" rel="noopener noreferrer"
                      style={{
                        display: "flex", alignItems: "center", gap: 6, justifyContent: "center",
                        padding: "9px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                        color: V3.gold, border: `1px solid rgba(201,168,76,.35)`,
                        background: "rgba(201,168,76,.07)", textDecoration: "none",
                      }}>
                      <Eye size={13} /> Ver documento ClickSign
                    </a>
                  )}
                </div>
              )}

              {/* ── TAB CONVERSAS ── */}
              {detailTab === "conversas" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {msgsLoading && (
                    <div className="flex items-center justify-center py-8 gap-2" style={{ color: V3.muted }}>
                      <Loader2 size={16} className="animate-spin" style={{ color: V3.gold }} />
                      <span style={{ fontSize: 12 }}>Carregando conversas...</span>
                    </div>
                  )}

                  {!msgsLoading && msgs.length === 0 && (
                    <div className="text-center py-8" style={{ color: V3.muted }}>
                      <MessageSquare size={24} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                      <p style={{ fontSize: 12, margin: 0 }}>Nenhuma nota ainda.</p>
                    </div>
                  )}

                  {!msgsLoading && msgs.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                      {msgs.map(msg => {
                        const cfg = MSG_CONFIG[msg.type];
                        const Icon = cfg.icon;
                        return (
                          <div key={msg.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: `${cfg.color}18`, border: `1px solid ${cfg.color}30`,
                            }}>
                              <Icon size={12} color={cfg.color} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="flex items-center gap-2 mb-1">
                                <span style={{ fontSize: 10, fontWeight: 600, color: cfg.color }}>{msg.sender_name}</span>
                                <span style={{ fontSize: 9, color: V3.navyM, background: `${cfg.color}12`, padding: "1px 6px", borderRadius: 10 }}>{cfg.label}</span>
                                <span style={{ fontSize: 9, color: V3.navyM, marginLeft: "auto" }}>{relTime(msg.created_at)}</span>
                              </div>
                              <div style={{
                                background: msg.type === "system_event" ? `rgba(201,168,76,.07)` : V3.navyC,
                                border: `1px solid ${msg.type === "system_event" ? `rgba(201,168,76,.2)` : V3.navyM}`,
                                borderRadius: 8, padding: "8px 12px",
                              }}>
                                <p style={{ fontSize: 12, color: V3.cream, margin: 0, lineHeight: 1.6 }}>{msg.content}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={msgsEndRef} />
                    </div>
                  )}

                  {/* Caixa de nova nota */}
                  <div style={{ borderTop: `1px solid ${V3.navyC}`, paddingTop: 12, display: "flex", gap: 8 }}>
                    <textarea
                      rows={2}
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      placeholder="Adicionar nota interna..."
                      style={{
                        ...inputStyle, resize: "none", flex: 1,
                        fontSize: 12, padding: "8px 12px",
                      }}
                      onFocus={e => (e.target.style.borderColor = `rgba(201,168,76,.4)`)}
                      onBlur={e => (e.target.style.borderColor = V3.navyM)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleNote(); }}}
                    />
                    <button
                      onClick={handleNote}
                      disabled={savingNote || !newNote.trim()}
                      style={{
                        width: 36, height: 36, borderRadius: 6, alignSelf: "flex-end", flexShrink: 0,
                        background: V3.gold, color: V3.navy, border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        opacity: savingNote || !newNote.trim() ? 0.5 : 1,
                      }}
                    >
                      {savingNote ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer modal — ação de envio */}
            {selected.status === "draft" && (
              <div style={{ padding: "14px 24px", borderTop: `1px solid ${V3.navyC}`, flexShrink: 0 }}>
                {sendOk && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 12px",
                    borderRadius: 6, background: "rgba(74,222,128,.1)", border: "1px solid rgba(74,222,128,.2)",
                    marginBottom: 10,
                  }}>
                    <Check size={12} color={V3.green} />
                    <span style={{ fontSize: 12, color: V3.green }}>Proposta enviada com sucesso! Email + ClickSign disparados.</span>
                  </div>
                )}
                {!complianceOk && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 12px",
                    borderRadius: 6, background: "rgba(232,155,58,.08)", border: "1px solid rgba(232,155,58,.2)",
                    marginBottom: 10,
                  }}>
                    <Bell size={12} color={V3.amber} />
                    <span style={{ fontSize: 11, color: V3.amber }}>Aguardando confirmação de compliance para ativar o envio.</span>
                  </div>
                )}
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setSelected(null)}
                    style={{
                      padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                      background: "transparent", color: V3.muted,
                      border: `1px solid rgba(155,175,197,.25)`, cursor: "pointer",
                    }}
                  >
                    Fechar
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sending || !complianceOk}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "8px 18px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                      background: complianceOk ? V3.gold : V3.navyM,
                      color: complianceOk ? V3.navy : V3.muted,
                      border: "none", cursor: complianceOk ? "pointer" : "not-allowed",
                      opacity: sending ? 0.7 : 1,
                    }}
                  >
                    {sending
                      ? <><Loader2 size={13} className="animate-spin" /> Enviando...</>
                      : <><Send size={13} /> Enviar + ClickSign</>
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Nova Proposta ── */}
      {showNew && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(9,8,26,.88)", backdropFilter: "blur(4px)",
          zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center",
          padding: 16,
        }}>
          <div style={{
            background: V3.navyB, border: `1px solid ${V3.navyM}`,
            borderRadius: 12, width: "100%", maxWidth: 520,
            maxHeight: "92vh", overflowY: "auto",
            boxShadow: "0 24px 72px rgba(0,0,0,.7)",
          }}>
            <div style={{ padding: 24 }}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: V3.goldL, margin: "0 0 2px" }}>Nova Proposta</p>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: V3.cream, margin: 0 }}>Criar proposta comercial</h2>
                </div>
                <button onClick={() => setShowNew(false)} style={{ background: "none", border: "none", cursor: "pointer", color: V3.muted }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ background: V3.navyC, border: `1px solid ${V3.navyM}`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: V3.goldL, margin: "0 0 8px" }}>Buscar Deal (opcional)</p>
                <div className="flex gap-2">
                  <input style={{ ...inputStyle, flex: 1 }} value={dealCode}
                    onChange={e => setDealCode(e.target.value)}
                    placeholder="Ex: MA-26-30823"
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleSearchDeal())} />
                  <button onClick={handleSearchDeal} disabled={dealSearching || !dealCode.trim()}
                    style={{
                      padding: "9px 16px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                      background: V3.navyM, color: V3.cream, border: "none",
                      cursor: dealSearching ? "not-allowed" : "pointer",
                      opacity: !dealCode.trim() ? 0.5 : 1, whiteSpace: "nowrap",
                    }}>
                    {dealSearching ? <Loader2 size={13} className="animate-spin" /> : "Buscar"}
                  </button>
                </div>
                {dealSearchError && <p style={{ fontSize: 11, color: V3.red, margin: "8px 0 0" }}>{dealSearchError}</p>}
                {dealFound && (
                  <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(201,168,76,.08)", border: `1px solid rgba(201,168,76,.25)`, borderRadius: 6 }}>
                    <p style={{ fontSize: 12, color: V3.cream, margin: "0 0 2px", fontWeight: 600 }}>{dealFound.title}</p>
                    <p style={{ fontSize: 10, color: V3.muted, margin: "0 0 8px" }}>{dealFound.code} · {dealFound.sector ?? "—"}</p>
                    <button onClick={handleGerarNarrativa} disabled={narrativeLoading}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "7px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: V3.gold, color: V3.navy, border: "none",
                        cursor: narrativeLoading ? "not-allowed" : "pointer",
                      }}>
                      {narrativeLoading ? <><Loader2 size={12} className="animate-spin" /> Gerando narrativa...</> : "Gerar Narrativa com IA →"}
                    </button>
                    {narrativeError && <p style={{ fontSize: 11, color: V3.red, margin: "8px 0 0" }}>{narrativeError}</p>}
                  </div>
                )}
              </div>

              <Field label="Título da Proposta *">
                <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Ex: Due Diligence — Expansão Operacional"
                  onFocus={e => (e.target.style.borderColor = `rgba(201,168,76,.4)`)}
                  onBlur={e => (e.target.style.borderColor = V3.navyM)} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo de Serviço *">
                  <select style={{ ...inputStyle, cursor: "pointer" }}
                    value={form.service_type}
                    onChange={e => setForm(f => ({ ...f, service_type: e.target.value as ServiceType }))}
                    onFocus={e => (e.target.style.borderColor = `rgba(201,168,76,.4)`)}
                    onBlur={e => (e.target.style.borderColor = V3.navyM)}>
                    <option value="consultoria">Consultoria</option>
                    <option value="due_diligence">Due Diligence</option>
                    <option value="relatorio_premium">Relatório Premium</option>
                    <option value="narrativa_venda">Narrativa de Venda (IA)</option>
                    <option value="outro">Outro</option>
                  </select>
                </Field>
                <Field label="Valor (R$)">
                  <input style={inputStyle} type="number" value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                    placeholder="Ex: 15000"
                    onFocus={e => (e.target.style.borderColor = `rgba(201,168,76,.4)`)}
                    onBlur={e => (e.target.style.borderColor = V3.navyM)} />
                </Field>
              </div>

              <div style={{ borderTop: `1px solid ${V3.navyC}`, margin: "4px 0 14px", paddingTop: 14 }}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: V3.muted, margin: "0 0 10px" }}>Destinatário Externo</p>
                <Field label="Nome *">
                  <input style={inputStyle} value={form.recipient_name}
                    onChange={e => setForm(f => ({ ...f, recipient_name: e.target.value }))}
                    placeholder="Nome do contato"
                    onFocus={e => (e.target.style.borderColor = `rgba(201,168,76,.4)`)}
                    onBlur={e => (e.target.style.borderColor = V3.navyM)} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email *">
                    <input style={inputStyle} type="email" value={form.recipient_email}
                      onChange={e => setForm(f => ({ ...f, recipient_email: e.target.value }))}
                      placeholder="email@empresa.com.br"
                      onFocus={e => (e.target.style.borderColor = `rgba(201,168,76,.4)`)}
                      onBlur={e => (e.target.style.borderColor = V3.navyM)} />
                  </Field>
                  <Field label="Empresa">
                    <input style={inputStyle} value={form.recipient_company}
                      onChange={e => setForm(f => ({ ...f, recipient_company: e.target.value }))}
                      placeholder="Razão social"
                      onFocus={e => (e.target.style.borderColor = `rgba(201,168,76,.4)`)}
                      onBlur={e => (e.target.style.borderColor = V3.navyM)} />
                  </Field>
                </div>
              </div>

              <div style={{ borderTop: `1px solid ${V3.navyC}`, margin: "4px 0 14px", paddingTop: 14 }}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: V3.muted, margin: "0 0 10px" }}>Partner em Cópia (opcional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nome do Partner">
                    <input style={inputStyle} value={form.partner_name}
                      onChange={e => setForm(f => ({ ...f, partner_name: e.target.value }))}
                      placeholder="Nome"
                      onFocus={e => (e.target.style.borderColor = `rgba(201,168,76,.4)`)}
                      onBlur={e => (e.target.style.borderColor = V3.navyM)} />
                  </Field>
                  <Field label="Email do Partner">
                    <input style={inputStyle} value={form.partner_email}
                      onChange={e => setForm(f => ({ ...f, partner_email: e.target.value }))}
                      placeholder="partner@email.com"
                      onFocus={e => (e.target.style.borderColor = `rgba(201,168,76,.4)`)}
                      onBlur={e => (e.target.style.borderColor = V3.navyM)} />
                  </Field>
                </div>
              </div>

              <Field label="Descrição / Corpo da Proposta">
                <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 100 }} rows={4}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Detalhe o escopo, entregáveis e condições da proposta..."
                  onFocus={e => (e.target.style.borderColor = `rgba(201,168,76,.4)`)}
                  onBlur={e => (e.target.style.borderColor = V3.navyM)} />
              </Field>

              <div className="flex gap-3 justify-end mt-2">
                <button onClick={() => setShowNew(false)}
                  style={{
                    padding: "9px 18px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: "transparent", color: V3.muted,
                    border: `1px solid rgba(155,175,197,.25)`, cursor: "pointer",
                  }}>
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !form.title || !form.recipient_name || !form.recipient_email}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "9px 20px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: V3.gold, color: V3.navy, border: "none", cursor: "pointer",
                    opacity: creating || !form.title || !form.recipient_name || !form.recipient_email ? 0.5 : 1,
                  }}>
                  {creating ? <><Loader2 size={13} className="animate-spin" /> Criando...</> : <><FileText size={13} /> Criar Rascunho</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
