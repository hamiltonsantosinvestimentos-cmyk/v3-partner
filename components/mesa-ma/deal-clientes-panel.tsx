"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, X, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";

type Role = "comprador" | "vendedor" | "intermediario" | null;
type Status = "prospecto" | "a_performar" | "performado";

type DealClient = {
  id: string;
  role: Role;
  status: Status;
  created_at: string;
  v3_clients: { id: string; document_number: string; document_type: string; legal_name: string | null } | null;
};

const ROLE_LABELS: Record<string, string> = { comprador: "Comprador", vendedor: "Vendedor", intermediario: "Intermediário" };
const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  prospecto:   { label: "Prospecto",   color: "#9BAFC5", bg: "rgba(155,175,197,0.1)" },
  a_performar: { label: "A Performar", color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
  performado:  { label: "Performado",  color: "#10B981", bg: "rgba(16,185,129,0.1)" },
};

// Client 360, Fase B (10-11/08/2026): a Mesa vincula clientes ao deal por
// CPF/CNPJ manualmente, já que M&A ainda não tem fluxo de qualificação
// estruturado (diferente da Bolsa de Ativos). Status (prospecto/a_performar/
// performado) é sempre automático, nunca editável aqui — ver
// app/api/ma/clicksign-webhook e app/api/ma-deals (PATCH stage=CLOSED_WON).
export function DealClientesPanel({ dealId }: { dealId: string }) {
  const [clientes, setClientes] = useState<DealClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ cpf_cnpj: "", legal_name: "", role: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/ma/deals/${dealId}/clientes`)
      .then(r => r.json())
      .then(json => setClientes(Array.isArray(json.clientes) ? json.clientes : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/ma/deals/${dealId}/clientes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf_cnpj: form.cpf_cnpj, legal_name: form.legal_name || null, role: form.role || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Erro ao vincular cliente");
        return;
      }
      setForm({ cpf_cnpj: "", legal_name: "", role: "" });
      setShowForm(false);
      load();
    } catch (err) {
      setError(`Erro de conexão: ${String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (id: string, role: string) => {
    await fetch(`/api/ma/deals/${dealId}/clientes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: role || null }),
    });
    load();
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Desvincular este cliente do deal?")) return;
    await fetch(`/api/ma/deals/${dealId}/clientes/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div style={{ padding: "16px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <p style={{ fontSize: 12, color: "#9BAFC5", margin: 0 }}>Clientes vinculados a este deal, papel e status atualizam automaticamente conforme o deal avança.</p>
        <Button size="sm" onClick={() => setShowForm(v => !v)}>
          <Plus size={14} style={{ marginRight: 6 }} />
          Vincular Cliente
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} style={{ background: "#162744", border: "1px solid #243A66", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#F5F1E8" }}>Vincular cliente por CPF/CNPJ</span>
            <button type="button" onClick={() => setShowForm(false)}><X size={14} color="#9BAFC5" /></button>
          </div>
          {error && <div style={{ padding: "8px 10px", background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 6, color: "#f87171", fontSize: 11, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <input value={form.cpf_cnpj} onChange={e => setForm(f => ({ ...f, cpf_cnpj: e.target.value }))} placeholder="CPF/CNPJ" required
              style={{ height: 34, padding: "0 10px", fontSize: 12, background: "#09081A", border: "1px solid #243A66", borderRadius: 6, color: "#F5F1E8" }} />
            <input value={form.legal_name} onChange={e => setForm(f => ({ ...f, legal_name: e.target.value }))} placeholder="Nome (opcional)"
              style={{ height: 34, padding: "0 10px", fontSize: 12, background: "#09081A", border: "1px solid #243A66", borderRadius: 6, color: "#F5F1E8" }} />
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              style={{ height: 34, padding: "0 10px", fontSize: 12, background: "#09081A", border: "1px solid #243A66", borderRadius: 6, color: "#F5F1E8" }}>
              <option value="">Papel (definir depois)</option>
              <option value="comprador">Comprador</option>
              <option value="vendedor">Vendedor</option>
              <option value="intermediario">Intermediário</option>
            </select>
          </div>
          <Button type="submit" size="sm" disabled={submitting} style={{ marginTop: 10 }}>
            {submitting ? <Loader2 size={14} className="animate-spin" /> : "Vincular"}
          </Button>
        </form>
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 24 }}><Loader2 size={18} className="animate-spin" color="#9BAFC5" /></div>
      ) : clientes.length === 0 ? (
        <div style={{ textAlign: "center", padding: 24, color: "#9BAFC5", fontSize: 12 }}>Nenhum cliente vinculado a este deal ainda.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {clientes.map(c => {
            const meta = STATUS_META[c.status];
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", background: "#162744", border: "1px solid #243A66", borderRadius: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <User size={14} color="#C9A84C" />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "#F5F1E8" }}>{c.v3_clients?.legal_name || "(nome não registrado)"}</div>
                    <div style={{ fontSize: 10.5, color: "#9BAFC5" }}>{c.v3_clients?.document_type} {c.v3_clients?.document_number}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <select value={c.role ?? ""} onChange={e => handleRoleChange(c.id, e.target.value)}
                    style={{ height: 28, padding: "0 8px", fontSize: 11, background: "#09081A", border: "1px solid #243A66", borderRadius: 6, color: "#F5F1E8" }}>
                    <option value="">Papel indefinido</option>
                    <option value="comprador">Comprador</option>
                    <option value="vendedor">Vendedor</option>
                    <option value="intermediario">Intermediário</option>
                  </select>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, color: meta.color, background: meta.bg }}>{meta.label}</span>
                  <button onClick={() => handleRemove(c.id)} title="Desvincular">
                    <Trash2 size={13} color="#9BAFC5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
