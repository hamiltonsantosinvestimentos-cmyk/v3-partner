"use client";

import { useState, useEffect } from "react";
import { Plus, Copy, Check, Link2, ToggleLeft, ToggleRight, Loader2, TrendingUp, DollarSign, MousePointerClick, History, RefreshCw, X } from "lucide-react";
import { UNIT_PRICE_CENTS } from "@/lib/credit-analysis-pricing";

// Prazo de expiração (14/09/2026): partner escolhe em dias na criação,
// default sugerido 10. Mesma escala usada pro badge de contagem regressiva
// e pro botão "Renovar".
const DEFAULT_EXPIRES_DAYS = 10;

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function ExpirationBadge({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return null;
  const days = daysUntil(expiresAt);
  if (days < 0) {
    return <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", padding: "3px 8px", borderRadius: 4, background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}>Expirado</span>;
  }
  const soon = days <= 3;
  return (
    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", padding: "3px 8px", borderRadius: 4, background: soon ? "rgba(248,113,113,0.1)" : "rgba(201,168,76,0.1)", color: soon ? "#f87171" : "#E8C97A", border: `1px solid ${soon ? "rgba(248,113,113,0.3)" : "rgba(201,168,76,0.35)"}` }}>
      {days === 0 ? "Expira hoje" : `Expira em ${days}d`}
    </span>
  );
}

const GO = "#C9A84C", GL = "#E8C97A", CR = "#F5F1E8", MU = "#9BAFC5";
const N2 = "#13223A", N3 = "#162744", N4 = "#243A66";

// Preço sugerido ao criar o link — só um pré-preenchimento (o partner edita
// livremente). credit_analysis usa a MESMA constante do checkout direto
// (/analise-v2, modular desde 20/08/2026: R$197 por CNPJ/CPF analisado) para
// nunca mais divergir do preço oficial de 1 análise — antes ficava hardcoded
// em 49700 (R$497), preço do pacote fixo legado substituído nessa migração.
const SERVICE_OPTIONS = [
  { value: "credit_analysis", label: "Análise de Crédito Empresarial", price: UNIT_PRICE_CENTS },
  { value: "ma_intake",       label: "Intake M&A — Venda de Empresa", price: 0 },
  { value: "due_diligence",   label: "Due Diligence",                 price: 99700 },
  { value: "captacao",        label: "Formulário de Interesse (gratuito)", price: 0 },
];

function fmt(cents: number) {
  if (cents === 0) return "Gratuito";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

interface ServiceLink {
  id: string;
  token: string;
  title: string;
  service_type: string;
  description: string | null;
  price_cents: number;
  active: boolean;
  total_uses: number;
  total_paid_cents: number;
  created_at: string;
  expires_at: string | null;
  credit_desk_proposal_id?: string | null;
  ma_deal_id?: string | null;
  credit_desk_proposals?: { code: string; client_name: string } | null;
  ma_deals?: { code: string; target_company: string | null; title: string } | null;
}

interface LinkOrder {
  id: string;
  client_name: string;
  client_email: string;
  status: string;
  amount_cents: number;
  created_at: string;
  paid_at: string | null;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PAID:      { label: "Pago",       color: "#4ade80" },
  PENDING:   { label: "Pendente",   color: "#facc15" },
  CANCELLED: { label: "Cancelado",  color: "#f87171" },
  EXPIRED:   { label: "Expirado",   color: "#f87171" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// Modal de Histórico (14/09/2026) — lista real de pedidos de um link, não
// só o total agregado que já existia (total_uses/total_paid_cents).
function HistoricoModal({ link, onClose }: { link: ServiceLink; onClose: () => void }) {
  const [orders, setOrders] = useState<LinkOrder[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/partner/service-links/${link.id}/orders`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { if (d.error) setError(d.error); else setOrders(d.orders ?? []); } })
      .catch(() => { if (!cancelled) setError("Erro de rede."); });
    return () => { cancelled = true; };
  }, [link.id]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(9,8,26,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
      <div style={{ background: N2, border: `1px solid ${N4}`, borderRadius: 14, padding: 28, width: "100%", maxWidth: 560, maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: CR }}>Histórico do Link</div>
            <div style={{ fontSize: 12, color: MU, marginTop: 2 }}>{link.title}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: MU, cursor: "pointer" }}><X size={18} /></button>
        </div>

        {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 12 }}>{error}</div>}
        {!orders && !error && (
          <div style={{ textAlign: "center", padding: 32 }}><Loader2 size={24} color={GO} className="animate-spin" /></div>
        )}
        {orders && orders.length === 0 && (
          <div style={{ color: MU, fontSize: 13, textAlign: "center", padding: 24 }}>Nenhum pedido ainda para este link.</div>
        )}
        {orders && orders.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {orders.map(o => {
              const st = STATUS_LABEL[o.status] ?? { label: o.status, color: MU };
              return (
                <div key={o.id} style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 8, padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: CR, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.client_name}</div>
                    <div style={{ color: MU, fontSize: 11, marginTop: 2 }}>{fmtDate(o.created_at)}{o.paid_at ? ` · pago ${fmtDate(o.paid_at)}` : ""}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ color: GO, fontWeight: 700, fontSize: 13 }}>{fmt(o.amount_cents)}</div>
                    <div style={{ color: st.color, fontSize: 10, fontWeight: 700, marginTop: 2 }}>{st.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface DealOption { id: string; code: string; label: string }

// Vínculo a Deal (09/09/2026) — o link de Análise de Crédito criado aqui pode
// ficar preso a um Deal específico do próprio partner (Crédito ou M&A), pra
// deixar de existir a lacuna de "link só identifica o partner, nunca o
// negócio". Espelha o botão "Link Análise" que a Mesa já usa em
// proposta-detail-modal.tsx/mesa-ma-client.tsx, só que self-service.
export function PartnerLinksPanel() {
  const [links, setLinks] = useState<ServiceLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [renewing, setRenewing] = useState<string | null>(null);
  const [historico, setHistorico] = useState<ServiceLink | null>(null);
  const [form, setForm] = useState({ title: "", service_type: "credit_analysis", description: "", price_cents: String(UNIT_PRICE_CENTS), deal_type: "" as "" | "credit" | "ma", deal_id: "", expires_in_days: String(DEFAULT_EXPIRES_DAYS) });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [myDeals, setMyDeals] = useState<{ credit: DealOption[]; ma: DealOption[] } | null>(null);
  const [loadingDeals, setLoadingDeals] = useState(false);

  const BASE_URL = typeof window !== "undefined" ? window.location.origin : "https://app.v3partners.com.br";

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/partner/service-links");
      const d = await r.json() as { links: ServiceLink[] };
      setLinks(d.links ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function loadMyDeals() {
    if (myDeals) return; // já carregado — não busca de novo a cada abertura do modal
    setLoadingDeals(true);
    try {
      const r = await fetch("/api/partner/my-deals");
      const d = await r.json() as { credit?: DealOption[]; ma?: DealOption[] };
      setMyDeals({ credit: d.credit ?? [], ma: d.ma ?? [] });
    } catch {
      setMyDeals({ credit: [], ma: [] });
    } finally {
      setLoadingDeals(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    if (!form.title.trim()) { setCreateError("Título obrigatório"); return; }
    setCreating(true);
    try {
      const r = await fetch("/api/partner/service-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          price_cents: Math.round(Number(form.price_cents) || 0),
          deal_type: form.deal_type || null,
          deal_id: form.deal_id || null,
          expires_in_days: Math.round(Number(form.expires_in_days) || 0),
        }),
      });
      const d = await r.json() as { ok?: boolean; error?: string };
      if (d.error) { setCreateError(d.error); return; }
      setShowModal(false);
      setForm({ title: "", service_type: "credit_analysis", description: "", price_cents: String(UNIT_PRICE_CENTS), deal_type: "", deal_id: "", expires_in_days: String(DEFAULT_EXPIRES_DAYS) });
      await load();
    } catch {
      setCreateError("Erro de rede. Tente novamente.");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(link: ServiceLink) {
    setToggling(link.id);
    await fetch("/api/partner/service-links", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: link.id, active: !link.active }),
    });
    setLinks(prev => prev.map(l => l.id === link.id ? { ...l, active: !l.active } : l));
    setToggling(null);
  }

  // Renovar (14/09/2026): estende expires_at a partir de agora, sem recriar
  // o link (preserva token, histórico de pedidos e estatísticas).
  async function renewLink(link: ServiceLink, days: number) {
    setRenewing(link.id);
    try {
      const r = await fetch("/api/partner/service-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: link.id, renew_days: days }),
      });
      const d = await r.json() as { ok?: boolean; error?: string };
      if (!d.error) await load();
    } finally {
      setRenewing(null);
    }
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${BASE_URL}/checkout/${token}`);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  // KPIs
  const totalRevenue = links.reduce((a, l) => a + l.total_paid_cents, 0);
  const totalUses = links.reduce((a, l) => a + l.total_uses, 0);
  const activeCount = links.filter(l => l.active).length;

  const s = {
    kpiRow:  { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 },
    kpi:     { background: N2, border: `1px solid ${N4}`, borderRadius: 10, padding: "16px 20px" },
    kLabel:  { fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: GL, marginBottom: 6 },
    kVal:    { fontSize: 22, fontWeight: 800, color: CR },
    kSub:    { fontSize: 10, color: MU, marginTop: 2 },
    hdr:     { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    title:   { fontSize: 18, fontWeight: 700, color: CR },
    addBtn:  { background: GO, color: "#09081A", fontWeight: 700, fontSize: 13, padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 },
    row:     { background: N2, border: `1px solid ${N4}`, borderRadius: 10, padding: "16px 20px", marginBottom: 10, display: "flex", gap: 16, alignItems: "center" },
    badge:   (active: boolean) => ({ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, padding: "3px 8px", borderRadius: 4, background: active ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)", color: active ? "#4ade80" : "#f87171", border: `1px solid ${active ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)"}` }),
    copyBtn: (t: string) => ({ background: copied === t ? "rgba(74,222,128,0.1)" : N3, border: `1px solid ${copied === t ? "rgba(74,222,128,0.3)" : N4}`, color: copied === t ? "#4ade80" : MU, fontWeight: 600, fontSize: 11, padding: "6px 12px", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }),
    inp:     { width: "100%", background: N3, border: `1px solid ${N4}`, borderRadius: 8, padding: "9px 12px", color: CR, fontSize: 13, outline: "none" },
    lbl:     { fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: GL, marginBottom: 5, display: "block" },
  };

  return (
    <div>
      {/* KPIs */}
      <div style={s.kpiRow}>
        <div style={s.kpi}>
          <div style={s.kLabel}><Link2 size={10} style={{ display: "inline", marginRight: 4 }} />Links ativos</div>
          <div style={s.kVal}>{activeCount}</div>
          <div style={s.kSub}>{links.length} criados no total</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kLabel}><MousePointerClick size={10} style={{ display: "inline", marginRight: 4 }} />Acessos</div>
          <div style={s.kVal}>{totalUses}</div>
          <div style={s.kSub}>cliques nos links</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kLabel}><DollarSign size={10} style={{ display: "inline", marginRight: 4 }} />Receita</div>
          <div style={{ ...s.kVal, color: GO }}>{fmt(totalRevenue)}</div>
          <div style={s.kSub}>total gerado</div>
        </div>
      </div>

      {/* Header */}
      <div style={s.hdr}>
        <div style={s.title}>Meus Links de Serviço</div>
        <button style={s.addBtn} onClick={() => { setShowModal(true); loadMyDeals(); }}>
          <Plus size={14} /> Criar Link
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 32 }}><Loader2 size={24} color={GO} className="animate-spin" /></div>
      ) : links.length === 0 ? (
        <div style={{ background: N2, border: `1px solid ${N4}`, borderRadius: 10, padding: 40, textAlign: "center" }}>
          <Link2 size={32} color={N4} style={{ margin: "0 auto 12px" }} />
          <div style={{ color: CR, fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Nenhum link criado ainda</div>
          <div style={{ color: MU, fontSize: 12 }}>Crie seu primeiro link de serviço para compartilhar com clientes.</div>
        </div>
      ) : (
        links.map(link => (
          <div key={link.id} style={s.row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ color: CR, fontWeight: 600, fontSize: 14 }}>{link.title}</span>
                <span style={s.badge(link.active)}>{link.active ? "Ativo" : "Inativo"}</span>
                <ExpirationBadge expiresAt={link.expires_at} />
              </div>
              <div style={{ color: MU, fontSize: 11, marginBottom: 6 }}>
                {SERVICE_OPTIONS.find(o => o.value === link.service_type)?.label ?? link.service_type}
                <span style={{ margin: "0 8px", color: N4 }}>·</span>
                <span style={{ color: GO, fontWeight: 700 }}>{fmt(link.price_cents)}</span>
                <span style={{ margin: "0 8px", color: N4 }}>·</span>
                {link.total_uses} acessos
                {link.total_paid_cents > 0 && <><span style={{ margin: "0 8px", color: N4 }}>·</span><span style={{ color: "#4ade80" }}>{fmt(link.total_paid_cents)} gerados</span></>}
              </div>
              {(link.credit_desk_proposals || link.ma_deals) && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: GL, background: "rgba(201,168,76,0.1)", border: `1px solid ${GO}55`, borderRadius: 4, padding: "2px 7px", marginBottom: 6 }}>
                  <Link2 size={9} />
                  {link.credit_desk_proposals
                    ? `${link.credit_desk_proposals.code} · ${link.credit_desk_proposals.client_name}`
                    : `${link.ma_deals?.code} · ${link.ma_deals?.target_company ?? link.ma_deals?.title}`}
                </div>
              )}
              <div style={{ fontSize: 10, color: N4, fontFamily: "monospace", wordBreak: "break-all" }}>
                {BASE_URL}/checkout/{link.token}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center", flexWrap: "wrap" }}>
              <button style={s.copyBtn(link.token)} onClick={() => copyLink(link.token)}>
                {copied === link.token ? <Check size={11} /> : <Copy size={11} />}
                {copied === link.token ? "Copiado" : "Copiar"}
              </button>
              <button style={s.copyBtn(`h-${link.token}`)} onClick={() => setHistorico(link)} title="Ver histórico de pedidos deste link">
                <History size={11} /> Histórico
              </button>
              {link.expires_at && daysUntil(link.expires_at) <= 3 && (
                <button
                  style={s.copyBtn(`r-${link.token}`)}
                  onClick={() => renewLink(link, DEFAULT_EXPIRES_DAYS)}
                  disabled={renewing === link.id}
                  title={`Estender o prazo por mais ${DEFAULT_EXPIRES_DAYS} dias`}>
                  {renewing === link.id ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  Renovar
                </button>
              )}
              <button
                onClick={() => toggleActive(link)}
                disabled={toggling === link.id}
                style={{ background: "none", border: "none", cursor: "pointer", color: MU, display: "flex", alignItems: "center", padding: 4 }}>
                {toggling === link.id
                  ? <Loader2 size={18} className="animate-spin" />
                  : link.active ? <ToggleRight size={22} color={GO} /> : <ToggleLeft size={22} color={N4} />
                }
              </button>
            </div>
          </div>
        ))
      )}

      {/* Modal de criação */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(9,8,26,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ background: N2, border: `1px solid ${N4}`, borderRadius: 14, padding: 32, width: "100%", maxWidth: 460 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: CR, marginBottom: 24 }}>Criar Link de Serviço</div>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 16 }}>
                <label style={s.lbl}>Tipo de serviço</label>
                <select style={s.inp} value={form.service_type}
                  onChange={e => {
                    const opt = SERVICE_OPTIONS.find(o => o.value === e.target.value);
                    const clearsDeal = e.target.value !== "credit_analysis";
                    setForm(p => ({
                      ...p,
                      service_type: e.target.value,
                      price_cents: String(opt?.price ?? 0),
                      deal_type: clearsDeal ? "" : p.deal_type,
                      deal_id: clearsDeal ? "" : p.deal_id,
                    }));
                  }}>
                  {SERVICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {form.service_type === "credit_analysis" && (
                <div style={{ marginBottom: 16 }}>
                  <label style={s.lbl}>Vincular a um Deal (opcional)</label>
                  {loadingDeals ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: MU, fontSize: 12, padding: "9px 0" }}>
                      <Loader2 size={14} className="animate-spin" /> Carregando seus deals...
                    </div>
                  ) : (
                    <select
                      style={s.inp}
                      value={form.deal_type ? `${form.deal_type}:${form.deal_id}` : ""}
                      onChange={e => {
                        const v = e.target.value;
                        if (!v) { setForm(p => ({ ...p, deal_type: "", deal_id: "" })); return; }
                        const [dt, id] = v.split(":");
                        setForm(p => ({ ...p, deal_type: dt as "credit" | "ma", deal_id: id }));
                      }}
                    >
                      <option value="">Nenhum — link genérico (só identifica você)</option>
                      {(myDeals?.credit.length ?? 0) > 0 && (
                        <optgroup label="Propostas de Crédito">
                          {myDeals!.credit.map(d => <option key={d.id} value={`credit:${d.id}`}>{d.label}</option>)}
                        </optgroup>
                      )}
                      {(myDeals?.ma.length ?? 0) > 0 && (
                        <optgroup label="Deals de M&A">
                          {myDeals!.ma.map(d => <option key={d.id} value={`ma:${d.id}`}>{d.label}</option>)}
                        </optgroup>
                      )}
                      {myDeals && myDeals.credit.length === 0 && myDeals.ma.length === 0 && (
                        <option value="" disabled>Nenhum deal seu disponível ainda</option>
                      )}
                    </select>
                  )}
                  <p style={{ fontSize: 10, color: MU, marginTop: 5, lineHeight: 1.5 }}>
                    Vincule este link a um Deal seu para o pagamento já nascer associado à operação — sem isso, o link só identifica você como originador.
                  </p>
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <label style={s.lbl}>Título personalizado</label>
                <input style={s.inp} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="ex: Análise de Crédito — Sua Empresa" required />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={s.lbl}>Descrição curta (opcional)</label>
                <textarea style={{ ...s.inp, height: 70, resize: "none" }} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Descreva o que o cliente receberá..." />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={s.lbl}>Valor cobrado (R$)</label>
                <input style={s.inp} type="number" min="0" step="0.01" value={Number(form.price_cents) / 100}
                  onChange={e => setForm(p => ({ ...p, price_cents: String(Math.round(parseFloat(e.target.value || "0") * 100)) }))}
                  placeholder="0 para gratuito" />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={s.lbl}>Expira em (dias)</label>
                <input style={s.inp} type="number" min="0" step="1" value={form.expires_in_days}
                  onChange={e => setForm(p => ({ ...p, expires_in_days: e.target.value }))}
                  placeholder="0 = nunca expira" />
                <p style={{ fontSize: 10, color: MU, marginTop: 5, lineHeight: 1.5 }}>
                  Depois desse prazo o link para de funcionar pro cliente. Deixe 0 pra nunca expirar.
                </p>
              </div>
              {createError && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 12 }}>{createError}</div>}
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={() => setShowModal(false)}
                  style={{ flex: 1, background: N3, border: `1px solid ${N4}`, color: MU, fontWeight: 600, fontSize: 13, padding: "11px 0", borderRadius: 8, cursor: "pointer" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={creating}
                  style={{ flex: 2, background: creating ? N4 : GO, color: creating ? MU : "#09081A", fontWeight: 700, fontSize: 13, padding: "11px 0", borderRadius: 8, border: "none", cursor: creating ? "not-allowed" : "pointer" }}>
                  {creating ? "Criando..." : "Gerar Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historico && <HistoricoModal link={historico} onClose={() => setHistorico(null)} />}
    </div>
  );
}
