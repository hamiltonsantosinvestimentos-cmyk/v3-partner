"use client";

import { useState, useEffect } from "react";
import { Plus, Copy, Check, Link2, ToggleLeft, ToggleRight, Loader2, TrendingUp, DollarSign, MousePointerClick } from "lucide-react";
import { UNIT_PRICE_CENTS } from "@/lib/credit-analysis-pricing";

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
}

export function PartnerLinksPanel() {
  const [links, setLinks] = useState<ServiceLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", service_type: "credit_analysis", description: "", price_cents: String(UNIT_PRICE_CENTS) });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

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
        body: JSON.stringify({ ...form, price_cents: Math.round(Number(form.price_cents) || 0) }),
      });
      const d = await r.json() as { ok?: boolean; error?: string };
      if (d.error) { setCreateError(d.error); return; }
      setShowModal(false);
      setForm({ title: "", service_type: "credit_analysis", description: "", price_cents: String(UNIT_PRICE_CENTS) });
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
        <button style={s.addBtn} onClick={() => setShowModal(true)}>
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
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ color: CR, fontWeight: 600, fontSize: 14 }}>{link.title}</span>
                <span style={s.badge(link.active)}>{link.active ? "Ativo" : "Inativo"}</span>
              </div>
              <div style={{ color: MU, fontSize: 11, marginBottom: 6 }}>
                {SERVICE_OPTIONS.find(o => o.value === link.service_type)?.label ?? link.service_type}
                <span style={{ margin: "0 8px", color: N4 }}>·</span>
                <span style={{ color: GO, fontWeight: 700 }}>{fmt(link.price_cents)}</span>
                <span style={{ margin: "0 8px", color: N4 }}>·</span>
                {link.total_uses} acessos
                {link.total_paid_cents > 0 && <><span style={{ margin: "0 8px", color: N4 }}>·</span><span style={{ color: "#4ade80" }}>{fmt(link.total_paid_cents)} gerados</span></>}
              </div>
              <div style={{ fontSize: 10, color: N4, fontFamily: "monospace", wordBreak: "break-all" }}>
                {BASE_URL}/checkout/{link.token}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button style={s.copyBtn(link.token)} onClick={() => copyLink(link.token)}>
                {copied === link.token ? <Check size={11} /> : <Copy size={11} />}
                {copied === link.token ? "Copiado" : "Copiar"}
              </button>
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
                    setForm(p => ({ ...p, service_type: e.target.value, price_cents: String(opt?.price ?? 0) }));
                  }}>
                  {SERVICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
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
    </div>
  );
}
