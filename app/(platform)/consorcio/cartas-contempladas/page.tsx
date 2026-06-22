"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Trophy, Plus, Search, Home, Car, Wrench, TrendingUp, Trash2, Loader2, X, RefreshCw } from "lucide-react";

type LetterType = "IMOVEL" | "VEICULO" | "SERVICO" | "OUTROS";
type LetterStatus = "DISPONIVEL" | "NEGOCIACAO" | "VENDIDA" | "UTILIZADA";

interface ContemplatedLetter {
  id: string;
  code: string;
  type: LetterType;
  credit_value: number;
  admin: string;
  group_name?: string | null;
  quota?: string | null;
  status: LetterStatus;
  asking_price: number;
  discount: number;
  created_at?: string;
}

const TYPE_LABELS: Record<LetterType, string> = { IMOVEL: "Imóvel", VEICULO: "Veículo", SERVICO: "Serviço", OUTROS: "Outros" };
const TYPE_ICONS: Record<LetterType, React.ReactNode> = {
  IMOVEL: <Home className="w-4 h-4" />, VEICULO: <Car className="w-4 h-4" />,
  SERVICO: <Wrench className="w-4 h-4" />, OUTROS: <TrendingUp className="w-4 h-4" />,
};
const STATUS_COLORS: Record<LetterStatus, string> = {
  DISPONIVEL: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  NEGOCIACAO: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  VENDIDA: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  UTILIZADA: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};
const STATUS_LABELS: Record<LetterStatus, string> = { DISPONIVEL: "Disponível", NEGOCIACAO: "Em Negociação", VENDIDA: "Vendida", UTILIZADA: "Utilizada" };
const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export default function CartasContempladasPage() {
  const [letters, setLetters] = useState<ContemplatedLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("DISPONIVEL");
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ inserted: number; updated: number; skipped: number; error?: string } | null>(null);
  const [form, setForm] = useState({ type: "IMOVEL" as LetterType, credit_value: "", admin: "", group_name: "", quota: "", status: "DISPONIVEL" as LetterStatus, asking_price: "", discount: "" });

  useEffect(() => {
    Promise.all([
      fetch("/api/consorcio/cartas").then(r => r.json()),
      fetch("/api/usuarios/me").then(r => r.json()).catch(() => ({})),
    ]).then(([cartasData, meData]) => {
      if (Array.isArray(cartasData.cartas)) setLetters(cartasData.cartas);
      if (meData?.role) setUserRole(meData.role);
    }).finally(() => setLoading(false));
  }, []);

  const isAdmin = ADMIN_ROLES.includes(userRole);

  const filtered = letters.filter(l => {
    const matchSearch = !search || l.code.includes(search) || l.admin.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || l.type === filterType;
    const matchStatus = !filterStatus || l.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const available = letters.filter(l => l.status === "DISPONIVEL");
  const totalAvailableValue = available.reduce((s, l) => s + l.credit_value, 0);
  const avgDiscount = available.length > 0 ? available.reduce((s, l) => s + l.discount, 0) / available.length : 0;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/consorcio/cartas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, credit_value: Number(form.credit_value), asking_price: Number(form.asking_price), discount: Number(form.discount) }),
    });
    const json = await res.json();
    if (json.carta) {
      setLetters(prev => [json.carta, ...prev]);
      setShowForm(false);
      setForm({ type: "IMOVEL", credit_value: "", admin: "", group_name: "", quota: "", status: "DISPONIVEL", asking_price: "", discount: "" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta carta?")) return;
    setDeleting(id);
    const res = await fetch(`/api/consorcio/cartas?id=${id}`, { method: "DELETE" });
    if (res.ok) setLetters(prev => prev.filter(l => l.id !== id));
    setDeleting(null);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/consorcio/sync-contemplados", { method: "POST" });
      const json = await res.json();
      if (!res.ok) { setSyncResult({ inserted: 0, updated: 0, skipped: 0, error: json.error ?? "Erro desconhecido" }); return; }
      setSyncResult({ inserted: json.inserted, updated: json.updated, skipped: json.skipped });
      // Recarrega lista
      const cartasRes = await fetch("/api/consorcio/cartas");
      const cartasData = await cartasRes.json();
      if (Array.isArray(cartasData.cartas)) setLetters(cartasData.cartas);
    } catch (e) {
      setSyncResult({ inserted: 0, updated: 0, skipped: 0, error: String(e) });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Cartas Contempladas</h1>
            <p className="text-xs text-muted-foreground">Cartas disponíveis para venda ou uso imediato</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}
              className="gap-1.5 border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {syncing ? "Sincronizando..." : "Sincronizar Portal"}
            </Button>
          )}
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Incluir Carta
          </Button>
        </div>
      </div>

      {/* Resultado do sync */}
      {syncResult && (
        <div className={`px-4 py-3 rounded-xl text-xs flex items-center justify-between ${syncResult.error ? "bg-red-500/10 border border-red-500/30 text-red-400" : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"}`}>
          {syncResult.error ? (
            <span>⚠ Erro na sincronização: {syncResult.error}</span>
          ) : (
            <span>
              ✓ Sincronização concluída — <strong>{syncResult.inserted}</strong> novas cartas importadas · <strong>{syncResult.updated}</strong> atualizadas · <strong>{syncResult.skipped}</strong> já existentes
            </span>
          )}
          <button onClick={() => setSyncResult(null)} className="ml-4 opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <Card className="border-amber-500/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Nova Carta Contemplada</h3>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as LetterType })} className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input value={form.credit_value} onChange={e => setForm({ ...form, credit_value: e.target.value })} placeholder="Valor do Crédito (R$)" required type="number" min={0} className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none" />
              <input value={form.admin} onChange={e => setForm({ ...form, admin: e.target.value })} placeholder="Administradora" required className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none" />
              <input value={form.group_name} onChange={e => setForm({ ...form, group_name: e.target.value })} placeholder="Grupo (ex: G2847)" className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none" />
              <input value={form.quota} onChange={e => setForm({ ...form, quota: e.target.value })} placeholder="Cota (ex: Q-142)" className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none" />
              <input value={form.asking_price} onChange={e => setForm({ ...form, asking_price: e.target.value })} placeholder="Preço de Venda (R$)" required type="number" min={0} className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none" />
              <input value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} placeholder="Desconto (%)" required type="number" min={0} max={100} step={0.1} className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none" />
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as LetterStatus })} className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none">
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <div className="flex gap-2">
                <Button type="submit" size="sm" className="flex-1">Salvar</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total de Cartas", value: letters.length, color: "text-white" },
          { label: "Disponíveis", value: available.length, color: "text-emerald-400" },
          { label: "Volume Disponível", value: formatCurrency(totalAvailableValue), color: "text-amber-400" },
          { label: "Desconto Médio", value: `${avgDiscount.toFixed(1)}%`, color: "text-blue-400" },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={`text-xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por código, administradora..." className="w-full h-9 pl-9 pr-4 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none">
          <option value="">Todos os tipos</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(letter => (
            <Card key={letter.id} className="cursor-pointer hover:border-amber-500/30 transition-all group">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                      {TYPE_ICONS[letter.type]}
                    </div>
                    <div>
                      <p className="text-xs font-mono text-muted-foreground">{letter.code}</p>
                      <p className="text-sm font-medium text-foreground">{TYPE_LABELS[letter.type]}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={STATUS_COLORS[letter.status]}>{STATUS_LABELS[letter.status]}</Badge>
                    {isAdmin && (
                      <button onClick={() => handleDelete(letter.id)} disabled={deleting === letter.id} className="text-red-400/60 hover:text-red-400 transition-colors p-1">
                        {deleting === letter.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Crédito</span>
                    <span className="font-semibold text-white">{formatCurrency(letter.credit_value)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Preço de Venda</span>
                    <span className="font-semibold text-amber-400">{formatCurrency(letter.asking_price)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Desconto</span>
                    <span className="font-semibold text-emerald-400">{letter.discount}%</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-border/50 flex justify-between text-xs text-muted-foreground">
                  <span>{letter.admin}</span>
                  <span>{letter.group_name ? `Grupo ${letter.group_name}` : ""}{letter.quota ? ` · Cota ${letter.quota}` : ""}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <Trophy className="w-10 h-10 text-amber-400/50 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nenhuma carta encontrada</p>
        </div>
      )}
    </div>
  );
}
