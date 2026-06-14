"use client";

import { useState, useEffect } from "react";
import {
  Plus, X, Loader2, Plane, Car, Building2, Trash2, Pencil,
  TrendingDown, TrendingUp, Minus, ArrowRight,
} from "lucide-react";

// ─── Paleta V4.2 ────────────────────────────────────────────────────────────
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

// ─── Types ────────────────────────────────────────────────────────────────
type Category = "voo" | "carro" | "locacao";
type Status = "monitorando" | "reservado" | "concluido" | "cancelado";

type LogisticsItem = {
  id: string;
  category: Category;
  title: string;
  origin?: string | null;
  destination?: string | null;
  origin_iata?: string | null;
  destination_iata?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  provider?: string | null;
  target_price?: number | null;
  current_price?: number | null;
  currency: string;
  status: Status;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

type PriceHistoryEntry = {
  id: string;
  item_id: string;
  price: number;
  currency: string;
  source?: string | null;
  checked_at: string;
};

type Form = {
  title: string;
  origin: string;
  destination: string;
  origin_iata: string;
  destination_iata: string;
  start_date: string;
  end_date: string;
  provider: string;
  target_price: string;
  current_price: string;
  currency: string;
  status: Status;
  notes: string;
};

const EMPTY_FORM: Form = {
  title: "", origin: "", destination: "", origin_iata: "", destination_iata: "",
  start_date: "", end_date: "",
  provider: "", target_price: "", current_price: "", currency: "BRL",
  status: "monitorando", notes: "",
};

// ─── Config por categoria ─────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<Category, {
  label: string; singular: string; icon: React.ElementType;
  originLabel: string; destinationLabel: string; providerLabel: string;
  showRoute: boolean;
}> = {
  voo: {
    label: "Voos", singular: "Voo", icon: Plane,
    originLabel: "Origem", destinationLabel: "Destino", providerLabel: "Companhia Aérea",
    showRoute: true,
  },
  carro: {
    label: "Carros", singular: "Carro", icon: Car,
    originLabel: "Retirada", destinationLabel: "Devolução", providerLabel: "Locadora",
    showRoute: true,
  },
  locacao: {
    label: "Locações", singular: "Locação", icon: Building2,
    originLabel: "Cidade / UF", destinationLabel: "Endereço", providerLabel: "Plataforma / Proprietário",
    showRoute: false,
  },
};

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string }> = {
  monitorando: { label: "Monitorando", color: V3.amber, bg: "rgba(232,155,58,.12)" },
  reservado:   { label: "Reservado",   color: V3.gold,  bg: "rgba(201,168,76,.12)" },
  concluido:   { label: "Concluído",   color: V3.green, bg: "rgba(74,222,128,.12)" },
  cancelado:   { label: "Cancelado",   color: V3.red,   bg: "rgba(248,113,113,.12)" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────
function fmtMoney(v?: number | null, currency = "BRL") {
  if (v == null) return "—";
  const locale = currency === "BRL" ? "pt-BR" : "en-US";
  return `${currency} ${v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR");
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: V3.navyC,
  border: `1px solid ${V3.navyM}`, borderRadius: 6,
  padding: "9px 12px", color: V3.cream,
  fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none",
  boxSizing: "border-box",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: "block", fontSize: 9, fontWeight: 700,
        letterSpacing: "0.15em", textTransform: "uppercase",
        color: V3.goldL, marginBottom: 6, fontFamily: "'DM Sans', sans-serif",
      }}>{label}</label>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
      textTransform: "uppercase", color: cfg.color,
      background: cfg.bg, border: `1px solid ${cfg.color}30`,
      padding: "3px 8px", borderRadius: 20, fontFamily: "'DM Sans', sans-serif",
    }}>
      {cfg.label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────
export function LogisticaClient({ category, initialItems }: { category: Category; initialItems: LogisticsItem[] }) {
  const cfg = CATEGORY_CONFIG[category];
  const Icon = cfg.icon;

  const [items, setItems]       = useState<LogisticsItem[]>(initialItems);
  const [loading, setLoading]   = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]   = useState<LogisticsItem | null>(null);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState<Form>(EMPTY_FORM);

  // Histórico de preço (Voos)
  const [history, setHistory]     = useState<PriceHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [newPrice, setNewPrice]   = useState("");
  const [addingPrice, setAddingPrice] = useState(false);

  // Recarrega a categoria atual
  const reload = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/logistica/items?category=${category}`);
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {}
    setLoading(false);
  };

  // Carrega histórico de preço quando edita um voo
  useEffect(() => {
    if (!editing || category !== "voo") { setHistory([]); return; }
    setHistoryLoading(true);
    fetch(`/api/logistica/items/${editing.id}/price-history`)
      .then(r => r.json())
      .then(d => setHistory(Array.isArray(d.history) ? d.history : []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [editing, category]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (item: LogisticsItem) => {
    setEditing(item);
    setForm({
      title: item.title,
      origin: item.origin ?? "",
      destination: item.destination ?? "",
      origin_iata: item.origin_iata ?? "",
      destination_iata: item.destination_iata ?? "",
      start_date: item.start_date ?? "",
      end_date: item.end_date ?? "",
      provider: item.provider ?? "",
      target_price: item.target_price != null ? String(item.target_price) : "",
      current_price: item.current_price != null ? String(item.current_price) : "",
      currency: item.currency,
      status: item.status,
      notes: item.notes ?? "",
    });
    setNewPrice("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setHistory([]);
  };

  const buildPayload = () => {
    const isVoo = category === "voo";
    // Para Voos, origem/destino são os próprios códigos IATA (normalizados a 3 letras)
    const originIata = isVoo && form.origin_iata.length === 3 ? form.origin_iata : null;
    const destinationIata = isVoo && form.destination_iata.length === 3 ? form.destination_iata : null;
    return {
      title: form.title,
      origin: isVoo ? originIata : (form.origin || null),
      destination: isVoo ? destinationIata : (form.destination || null),
      origin_iata: originIata,
      destination_iata: destinationIata,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      provider: form.provider || null,
      target_price: form.target_price ? Number(form.target_price) : null,
      current_price: form.current_price ? Number(form.current_price) : null,
      currency: form.currency || "BRL",
      status: form.status,
      notes: form.notes || null,
    };
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/logistica/items/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        });
        if (res.ok) { await reload(); closeModal(); }
      } else {
        const res = await fetch(`/api/logistica/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...buildPayload(), category }),
        });
        if (res.ok) { await reload(); closeModal(); }
      }
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Excluir este ${cfg.singular.toLowerCase()}?`)) return;
    try {
      const res = await fetch(`/api/logistica/items/${id}`, { method: "DELETE" });
      if (res.ok) await reload();
    } catch {}
  };

  const handleAddPrice = async () => {
    if (!editing || !newPrice) return;
    setAddingPrice(true);
    try {
      const res = await fetch(`/api/logistica/items/${editing.id}/price-history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: Number(newPrice), currency: form.currency || "BRL", source: "manual" }),
      });
      const data = await res.json();
      if (data.entry) {
        setHistory(prev => [...prev, data.entry]);
        setForm(prev => ({ ...prev, current_price: newPrice }));
        setNewPrice("");
        await reload();
      }
    } catch {}
    setAddingPrice(false);
  };

  // ── KPIs ──
  const kpis = [
    { label: "Total",        value: items.length,                                            color: V3.cream },
    { label: "Monitorando",  value: items.filter(i => i.status === "monitorando").length,    color: V3.amber },
    { label: "Reservado",    value: items.filter(i => i.status === "reservado").length,      color: V3.gold },
    { label: "Concluído",    value: items.filter(i => i.status === "concluido").length,      color: V3.green },
  ];

  // ── Variação de preço ──
  const priceDelta = (item: LogisticsItem) => {
    if (item.target_price == null || item.current_price == null) return null;
    return item.current_price - item.target_price;
  };

  return (
    <div style={{ color: V3.cream, fontFamily: "'DM Sans', sans-serif" }}>
      {/* ── Action bar + KPIs ── */}
      <div style={{ padding: "20px 24px" }}>
        <div className="flex items-center justify-between mb-4">
          <p style={{ fontSize: 11, color: V3.muted, margin: 0 }}>
            {items.length} {items.length === 1 ? "registro" : "registros"} em {cfg.label.toLowerCase()}
          </p>
          <button
            onClick={openNew}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: V3.gold, color: V3.navy,
              border: "none", borderRadius: 6, padding: "8px 16px",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <Plus size={14} /> Novo {cfg.singular}
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-5">
          {kpis.map(k => (
            <div key={k.label} style={{ background: V3.navyC, border: `1px solid ${V3.navyM}`, borderRadius: 8, padding: "12px 16px" }}>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: V3.goldL, margin: "0 0 4px" }}>{k.label}</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: k.color, margin: 0 }}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* ── Lista ── */}
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2" style={{ color: V3.muted }}>
            <Loader2 size={18} className="animate-spin" style={{ color: V3.gold }} />
            <span style={{ fontSize: 13 }}>Carregando...</span>
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="text-center py-16" style={{ color: V3.muted }}>
            <Icon size={32} style={{ color: V3.navyM, margin: "0 auto 12px" }} />
            <p style={{ fontSize: 13, margin: 0 }}>Nenhum registro de {cfg.singular.toLowerCase()} ainda.</p>
            <p style={{ fontSize: 11, margin: "4px 0 0", color: V3.navyM }}>Clique em &quot;Novo {cfg.singular}&quot; para começar.</p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div style={{ display: "grid", gap: 10 }}>
            {items.map(item => {
              const delta = priceDelta(item);
              return (
                <div
                  key={item.id}
                  onClick={() => openEdit(item)}
                  className="cursor-pointer group"
                  style={{
                    background: V3.navyB, border: `1px solid ${V3.navyC}`,
                    borderRadius: 8, padding: "14px 18px",
                    transition: "border-color 0.2s",
                  }}
                  onMouseOver={e => (e.currentTarget.style.borderColor = "rgba(201,168,76,.35)")}
                  onMouseOut={e => (e.currentTarget.style.borderColor = V3.navyC)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <StatusBadge status={item.status} />
                        {item.start_date && (
                          <span style={{ fontSize: 9, color: V3.muted, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                            {fmtDate(item.start_date)}{item.end_date ? ` → ${fmtDate(item.end_date)}` : ""}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: V3.cream, margin: "0 0 4px" }}>
                        {item.title}
                      </p>
                      <div className="flex items-center gap-3 flex-wrap" style={{ fontSize: 11, color: V3.muted }}>
                        {cfg.showRoute && (item.origin || item.destination) && (
                          <span className="flex items-center gap-1">
                            {item.origin || "—"} <ArrowRight size={10} /> {item.destination || "—"}
                          </span>
                        )}
                        {!cfg.showRoute && item.destination && <span>{item.destination}</span>}
                        {item.provider && <span style={{ color: V3.navyM }}>•</span>}
                        {item.provider && <span>{item.provider}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: V3.goldL, margin: "0 0 2px" }}>
                          {category === "voo" ? "Preço atual" : "Valor"}
                        </p>
                        <p style={{ fontSize: 15, fontWeight: 800, color: V3.cream, margin: 0 }}>
                          {fmtMoney(item.current_price, item.currency)}
                        </p>
                        {item.target_price != null && (
                          <p className="flex items-center justify-end gap-1" style={{ fontSize: 10, color: V3.muted, margin: "2px 0 0" }}>
                            meta {fmtMoney(item.target_price, item.currency)}
                            {delta != null && (
                              delta > 0
                                ? <TrendingUp size={11} color={V3.red} />
                                : delta < 0
                                  ? <TrendingDown size={11} color={V3.green} />
                                  : <Minus size={11} color={V3.muted} />
                            )}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                        style={{ background: "transparent", border: "none", color: V3.muted, cursor: "pointer", padding: 4 }}
                        title="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal Criar/Editar ── */}
      {showModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(9,8,26,.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 100, padding: 20,
          }}
          onClick={closeModal}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: V3.navyB, border: `1px solid ${V3.navyC}`,
              borderRadius: 10, padding: 24, width: "100%", maxWidth: 560,
              maxHeight: "90vh", overflowY: "auto",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Icon size={16} color={V3.gold} />
                <h2 style={{ fontSize: 14, fontWeight: 700, color: V3.cream, margin: 0 }}>
                  {editing ? `Editar ${cfg.singular}` : `Novo ${cfg.singular}`}
                </h2>
              </div>
              <button onClick={closeModal} style={{ background: "transparent", border: "none", color: V3.muted, cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <Field label="Título">
              <input style={inputStyle} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={`Ex.: ${category === "voo" ? "GIG → MIA, ida e volta" : category === "carro" ? "SUV — congresso SP" : "Apto temporada — RJ"}`} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              {category === "voo" ? (
                <>
                  <Field label="Origem (IATA)">
                    <input
                      style={{ ...inputStyle, fontFamily: "monospace", letterSpacing: "0.2em", textTransform: "uppercase" }}
                      value={form.origin_iata} maxLength={3} placeholder="GIG"
                      onChange={e => setForm({ ...form, origin_iata: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) })}
                    />
                  </Field>
                  <Field label="Destino (IATA)">
                    <input
                      style={{ ...inputStyle, fontFamily: "monospace", letterSpacing: "0.2em", textTransform: "uppercase" }}
                      value={form.destination_iata} maxLength={3} placeholder="MIA"
                      onChange={e => setForm({ ...form, destination_iata: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) })}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label={cfg.originLabel}>
                    <input style={inputStyle} value={form.origin} onChange={e => setForm({ ...form, origin: e.target.value })} />
                  </Field>
                  <Field label={cfg.destinationLabel}>
                    <input style={inputStyle} value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} />
                  </Field>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Data Início">
                <input type="date" style={inputStyle} value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
              </Field>
              <Field label="Data Fim">
                <input type="date" style={inputStyle} value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
              </Field>
            </div>

            <Field label={cfg.providerLabel}>
              <input style={inputStyle} value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Preço Meta">
                <input type="number" step="0.01" style={inputStyle} value={form.target_price} onChange={e => setForm({ ...form, target_price: e.target.value })} />
              </Field>
              <Field label="Preço Atual">
                <input type="number" step="0.01" style={inputStyle} value={form.current_price} onChange={e => setForm({ ...form, current_price: e.target.value })} />
              </Field>
              <Field label="Moeda">
                <input style={inputStyle} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={3} />
              </Field>
            </div>

            <Field label="Status">
              <select style={inputStyle} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Status })}>
                {Object.entries(STATUS_CONFIG).map(([key, c]) => (
                  <option key={key} value={key}>{c.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Observações">
              <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </Field>

            {/* ── Histórico de preço (somente Voos, em edição) ── */}
            {category === "voo" && editing && (
              <div style={{ marginTop: 8, marginBottom: 18, borderTop: `1px solid ${V3.navyC}`, paddingTop: 14 }}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: V3.goldL, margin: "0 0 8px" }}>
                  Histórico de Preço
                </p>
                {historyLoading && (
                  <p style={{ fontSize: 11, color: V3.muted, margin: 0 }}>Carregando...</p>
                )}
                {!historyLoading && history.length === 0 && (
                  <p style={{ fontSize: 11, color: V3.muted, margin: 0 }}>Nenhum registro de preço ainda.</p>
                )}
                {!historyLoading && history.length > 0 && (
                  <div style={{ display: "grid", gap: 4, marginBottom: 10 }}>
                    {history.slice().reverse().map(h => (
                      <div key={h.id} className="flex items-center justify-between" style={{ fontSize: 11, color: V3.muted }}>
                        <span>{new Date(h.checked_at).toLocaleString("pt-BR")}</span>
                        <span style={{ color: V3.cream, fontWeight: 600 }}>{fmtMoney(h.price, h.currency)}</span>
                        <span style={{ fontSize: 9, color: V3.navyM, textTransform: "uppercase" }}>{h.source ?? "manual"}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="number" step="0.01" placeholder="Novo preço observado"
                    style={{ ...inputStyle, flex: 1 }}
                    value={newPrice} onChange={e => setNewPrice(e.target.value)}
                  />
                  <button
                    onClick={handleAddPrice}
                    disabled={!newPrice || addingPrice}
                    style={{
                      background: V3.navyM, color: V3.cream, border: "none",
                      borderRadius: 6, padding: "9px 14px", fontSize: 12, fontWeight: 700,
                      cursor: !newPrice || addingPrice ? "not-allowed" : "pointer",
                      opacity: !newPrice || addingPrice ? 0.5 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {addingPrice ? "Salvando..." : "Registrar"}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2" style={{ marginTop: 8 }}>
              <button
                onClick={closeModal}
                style={{ background: "transparent", border: `1px solid ${V3.navyM}`, color: V3.muted, borderRadius: 6, padding: "9px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim()}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: V3.gold, color: V3.navy, border: "none",
                  borderRadius: 6, padding: "9px 16px", fontSize: 12, fontWeight: 700,
                  cursor: saving || !form.title.trim() ? "not-allowed" : "pointer",
                  opacity: saving || !form.title.trim() ? 0.6 : 1,
                }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
                {editing ? "Salvar alterações" : "Criar registro"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
