"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Trophy, Plus, Search, Home, Car, Wrench, TrendingUp, Trash2, Loader2, X, RefreshCw, CheckSquare, Square, Handshake } from "lucide-react";

type LetterType = "IMOVEL" | "VEICULO" | "SERVICO" | "OUTROS";
type LetterStatus = "DISPONIVEL" | "NEGOCIACAO" | "VENDIDA" | "UTILIZADA";

interface LetterMetadata {
  taxa_transf?: number | null;
  fundo_comum?: number | null;
  parcelas_qtd?: number | null;
  parcela_valor?: number | null;
  entrada?: number | null;
  saldo_devedor?: number | null;
  avaliacao_minima?: number | null;
}

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
  metadata?: LetterMetadata | null;
}

interface AdminUser {
  id: string;
  full_name: string;
  role: string;
}

interface OfertaForm {
  interessado_nome: string;
  interessado_tel: string;
  valor_oferta: string;
  observacoes: string;
  responsavel_id: string;
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
  const [userId, setUserId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ inserted: number; updated: number; skipped: number; error?: string; debug_sample?: unknown[] } | null>(null);
  const [form, setForm] = useState({ type: "IMOVEL" as LetterType, credit_value: "", admin: "", group_name: "", quota: "", status: "DISPONIVEL" as LetterStatus, asking_price: "", discount: "" });

  // Seleção múltipla
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Modal resumo seleção
  const [showResumoModal, setShowResumoModal] = useState(false);

  // Modal oferta
  const [ofertaModal, setOfertaModal] = useState<ContemplatedLetter | null>(null);
  const [ofertaForm, setOfertaForm] = useState<OfertaForm>({ interessado_nome: "", interessado_tel: "", valor_oferta: "", observacoes: "", responsavel_id: "" });
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [submittingOferta, setSubmittingOferta] = useState(false);
  const [ofertaSuccess, setOfertaSuccess] = useState(false);
  const [ofertaError, setOfertaError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/consorcio/cartas").then(r => r.json()),
      fetch("/api/usuarios/me").then(r => r.json()).catch(() => ({})),
    ]).then(([cartasData, meData]) => {
      if (Array.isArray(cartasData.cartas)) setLetters(cartasData.cartas);
      if (meData?.role) setUserRole(meData.role);
      if (meData?.id) setUserId(meData.id);
    }).finally(() => setLoading(false));
  }, []);

  // Busca lista de admins para o select de responsável
  useEffect(() => {
    if (ADMIN_ROLES.includes(userRole)) {
      fetch("/api/usuarios")
        .then(r => r.json())
        .then((data) => {
          const list = Array.isArray(data) ? data : (data?.usuarios ?? []);
          setAdminUsers(list.filter((u: AdminUser) => ["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(u.role)));
        })
        .catch(() => {});
    }
  }, [userRole]);

  const isAdmin = ADMIN_ROLES.includes(userRole);

  // Entrada exibida ao partner = asking_price + 5% do crédito (margem V3)
  const partnerEntrada = (l: ContemplatedLetter) => l.asking_price + l.credit_value * 0.05;
  const displayEntrada = (l: ContemplatedLetter) => isAdmin ? l.asking_price : partnerEntrada(l);

  const filtered = letters.filter(l => {
    const matchSearch = !search || l.code.includes(search) || l.admin.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || l.type === filterType;
    const matchStatus = !filterStatus || l.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const available = letters.filter(l => l.status === "DISPONIVEL");
  const totalAvailableValue = available.reduce((s, l) => s + l.credit_value, 0);
  const avgDiscount = available.length > 0 ? available.reduce((s, l) => s + l.discount, 0) / available.length : 0;

  // Seleção
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Usa todas as cartas (não só as filtradas) para a seleção
  const selectedLetters = letters.filter(l => selected.has(l.id));
  const sumCredito = selectedLetters.reduce((s, l) => s + l.credit_value, 0);
  const sumEntrada = selectedLetters.reduce((s, l) => s + displayEntrada(l), 0);
  const avgParcela = (() => {
    const withParcela = selectedLetters.filter(l => l.metadata?.parcela_valor && l.metadata.parcela_valor > 0);
    if (withParcela.length === 0) return null;
    return withParcela.reduce((s, l) => s + (l.metadata?.parcela_valor ?? 0), 0) / withParcela.length;
  })();

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
      const text = await res.text();
      let json: { ok?: boolean; error?: string; inserted?: number; updated?: number; skipped?: number; debug_sample?: unknown[] } = {};
      try { json = JSON.parse(text); } catch { setSyncResult({ inserted: 0, updated: 0, skipped: 0, error: `Resposta inválida do servidor (${res.status})` }); return; }
      if (!res.ok) { setSyncResult({ inserted: 0, updated: 0, skipped: 0, error: json.error ?? "Erro desconhecido" }); return; }
      setSyncResult({ inserted: json.inserted ?? 0, updated: json.updated ?? 0, skipped: json.skipped ?? 0, debug_sample: json.debug_sample });
      const cartasRes = await fetch("/api/consorcio/cartas");
      const cartasData = await cartasRes.json();
      if (Array.isArray(cartasData.cartas)) setLetters(cartasData.cartas);
    } catch (e) {
      setSyncResult({ inserted: 0, updated: 0, skipped: 0, error: String(e) });
    } finally {
      setSyncing(false);
    }
  };

  const openOfertaModal = (letter: ContemplatedLetter) => {
    setOfertaModal(letter);
    setOfertaForm({
      interessado_nome: "",
      interessado_tel: "",
      valor_oferta: String(displayEntrada(letter)),
      observacoes: "",
      responsavel_id: userId ?? "",
    });
    setOfertaSuccess(false);
    setOfertaError(null);
  };

  const handleSubmitOferta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ofertaModal) return;
    setSubmittingOferta(true);
    setOfertaError(null);
    try {
      const res = await fetch("/api/consorcio/ofertas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carta_id: ofertaModal.id,
          carta_code: ofertaModal.code,
          carta_credit_value: ofertaModal.credit_value,
          interessado_nome: ofertaForm.interessado_nome,
          interessado_tel: ofertaForm.interessado_tel || null,
          valor_oferta: Number(ofertaForm.valor_oferta),
          observacoes: ofertaForm.observacoes || null,
          responsavel_id: ofertaForm.responsavel_id || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setOfertaError(json.error ? (typeof json.error === "string" ? json.error : "Erro ao registrar oferta") : "Erro ao registrar oferta");
      } else {
        setOfertaSuccess(true);
        // Atualiza status local da carta
        setLetters(prev => prev.map(l => l.id === ofertaModal.id ? { ...l, status: "NEGOCIACAO" } : l));
      }
    } catch (err) {
      setOfertaError(String(err));
    } finally {
      setSubmittingOferta(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in pb-24">
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
            <div className="flex flex-col gap-1">
              <span>
                ✓ Sincronização concluída — <strong>{syncResult.inserted}</strong> novas cartas importadas · <strong>{syncResult.updated}</strong> atualizadas · <strong>{syncResult.skipped}</strong> já existentes
              </span>
              {syncResult.debug_sample && syncResult.debug_sample.length > 0 && (
                <span className="opacity-70 text-[10px]">
                  Amostra: {(syncResult.debug_sample as Array<{credit_value: number; admin: string}>).map(s => `R$${s.credit_value.toLocaleString("pt-BR")} (${s.admin})`).join(" · ")}
                </span>
              )}
            </div>
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
          { label: "Desconto Médio", value: `${avgDiscount.toFixed(1)}%`, color: "text-[#C9A84C]" },
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
          {filtered.map(letter => {
            const meta = letter.metadata;
            const isSelected = selected.has(letter.id);
            return (
              <Card key={letter.id} className={`transition-all group ${isSelected ? "border-amber-500/60 ring-1 ring-amber-500/30" : "hover:border-amber-500/30"}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {/* Checkbox de seleção */}
                      <button
                        onClick={() => toggleSelect(letter.id)}
                        className={`flex-shrink-0 transition-colors ${isSelected ? "text-amber-400" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                        title={isSelected ? "Remover da seleção" : "Selecionar"}
                      >
                        {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
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

                  {/* Dados principais */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Crédito</span>
                      <span className="font-semibold text-white">{formatCurrency(letter.credit_value)}</span>
                    </div>
                    {isAdmin ? (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Entrada (Portal)</span>
                          <span className="font-semibold text-amber-400">{formatCurrency(letter.asking_price)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Entrada Partner</span>
                          <span className="font-semibold text-[#C9A84C]">{formatCurrency(partnerEntrada(letter))}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Entrada</span>
                        <span className="font-semibold text-amber-400">{formatCurrency(partnerEntrada(letter))}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Desconto</span>
                      <span className="font-semibold text-emerald-400">{letter.discount}%</span>
                    </div>
                    {/* Dados do metadata */}
                    {meta?.parcelas_qtd && meta?.parcela_valor ? (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Parcelas</span>
                        <span className="font-semibold text-[#C9A84C]">{meta.parcelas_qtd}x {formatCurrency(meta.parcela_valor)}</span>
                      </div>
                    ) : null}
                    {meta?.taxa_transf && meta.taxa_transf > 0 ? (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Taxa Transf.</span>
                        <span className="font-medium text-foreground">{formatCurrency(meta.taxa_transf)}</span>
                      </div>
                    ) : null}
                    {meta?.fundo_comum && meta.fundo_comum > 0 ? (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Fundo Comum</span>
                        <span className="font-medium text-foreground">{formatCurrency(meta.fundo_comum)}</span>
                      </div>
                    ) : null}
                    {meta?.saldo_devedor && meta.saldo_devedor > 0 ? (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Saldo Devedor</span>
                        <span className="font-medium text-foreground">{formatCurrency(meta.saldo_devedor)}</span>
                      </div>
                    ) : null}
                    {meta?.avaliacao_minima && meta.avaliacao_minima > 0 ? (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Aval. Mínima Imóvel</span>
                        <span className="font-medium text-foreground">{formatCurrency(meta.avaliacao_minima)}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="pt-2 border-t border-border/50 flex justify-between text-xs text-muted-foreground">
                    <span>{letter.admin}</span>
                    <span>{letter.group_name ? `Grupo ${letter.group_name}` : ""}{letter.quota ? ` · Cota ${letter.quota}` : ""}</span>
                  </div>

                  {/* Botão Fazer Oferta */}
                  <button
                    onClick={() => openOfertaModal(letter)}
                    className="w-full flex items-center justify-center gap-1.5 h-8 text-xs font-medium rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors"
                  >
                    <Handshake className="w-3.5 h-3.5" />
                    Fazer Oferta
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <Trophy className="w-10 h-10 text-amber-400/50 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nenhuma carta encontrada</p>
        </div>
      )}

      {/* Botão flutuante de seleção */}
      {selected.size >= 1 && (
        <div className="fixed bottom-6 right-6 z-[200]">
          <button
            onClick={() => setShowResumoModal(true)}
            className="flex items-center gap-2 h-11 px-5 rounded-xl font-semibold text-sm shadow-xl transition-all"
            style={{ background: "#C9A84C", color: "#09081A" }}
          >
            <CheckSquare className="w-4 h-4" />
            {selected.size} {selected.size === 1 ? "carta" : "cartas"} — Ver resumo
          </button>
        </div>
      )}

      {/* Modal de resumo da seleção */}
      {showResumoModal && selected.size >= 1 && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#111F35] rounded-2xl border border-amber-500/20 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
              <h3 className="text-sm font-bold text-white">
                Resumo — {selected.size} {selected.size === 1 ? "carta selecionada" : "cartas selecionadas"}
              </h3>
              <button onClick={() => setShowResumoModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-3">
              {/* Lista das cartas selecionadas */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedLetters.map(l => (
                  <div key={l.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#162744]">
                    <div>
                      <p className="text-xs font-mono text-muted-foreground">{l.code}</p>
                      <p className="text-xs font-medium text-[#F0ECE4]">{l.admin}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-white">{formatCurrency(l.credit_value)}</p>
                      <p className="text-[10px] text-amber-400">Entrada: {formatCurrency(displayEntrada(l))}</p>
                      {isAdmin && <p className="text-[10px] text-[#C9A84C]">Partner: {formatCurrency(partnerEntrada(l))}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Totais */}
              <div className="border-t border-border/50 pt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Total de Crédito</span>
                  <span className="text-sm font-bold text-white">{formatCurrency(sumCredito)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Total de Entrada</span>
                  <span className="text-sm font-bold text-amber-400">{formatCurrency(sumEntrada)}</span>
                </div>
                {avgParcela !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Média de Parcelas</span>
                    <span className="text-sm font-bold text-[#C9A84C]">{formatCurrency(avgParcela)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Desconto Médio</span>
                  <span className="text-sm font-bold text-emerald-400">
                    {(selectedLetters.reduce((s, l) => s + l.discount, 0) / selectedLetters.length).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 pb-5 flex gap-2">
              <button
                onClick={() => setShowResumoModal(false)}
                className="flex-1 h-9 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={() => { setSelected(new Set()); setShowResumoModal(false); }}
                className="flex-1 h-9 text-xs font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Limpar seleção
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Fazer Oferta */}
      {ofertaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#111F35] rounded-2xl border border-amber-500/20 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Handshake className="w-4 h-4 text-amber-400" />
                  Fazer Oferta — {ofertaModal.code}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Crédito: {formatCurrency(ofertaModal.credit_value)}</p>
              </div>
              <button onClick={() => setOfertaModal(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {ofertaSuccess ? (
              <div className="px-6 py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-sm font-semibold text-white mb-1">Oferta registrada com sucesso!</p>
                <p className="text-xs text-muted-foreground mb-4">A carta foi marcada como Em Negociação e os administradores foram notificados.</p>
                <button
                  onClick={() => setOfertaModal(null)}
                  className="h-9 px-6 text-sm font-medium rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 transition-colors"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitOferta} className="px-6 py-5 space-y-4">
                {ofertaError && (
                  <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                    {ofertaError}
                  </div>
                )}

                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Nome do interessado <span className="text-red-400">*</span></label>
                  <input
                    value={ofertaForm.interessado_nome}
                    onChange={e => setOfertaForm(f => ({ ...f, interessado_nome: e.target.value }))}
                    placeholder="Nome completo"
                    required
                    className="w-full h-9 px-3 text-sm bg-[#162744] border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/40"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Telefone</label>
                  <input
                    value={ofertaForm.interessado_tel}
                    onChange={e => setOfertaForm(f => ({ ...f, interessado_tel: e.target.value }))}
                    placeholder="(51) 99999-0000"
                    className="w-full h-9 px-3 text-sm bg-[#162744] border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/40"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Valor da oferta (R$) <span className="text-red-400">*</span></label>
                  <input
                    value={ofertaForm.valor_oferta}
                    onChange={e => setOfertaForm(f => ({ ...f, valor_oferta: e.target.value }))}
                    type="number"
                    min={0}
                    step={0.01}
                    required
                    className="w-full h-9 px-3 text-sm bg-[#162744] border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/40"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Responsável</label>
                  <select
                    value={ofertaForm.responsavel_id}
                    onChange={e => setOfertaForm(f => ({ ...f, responsavel_id: e.target.value }))}
                    className="w-full h-9 px-3 text-sm bg-[#162744] border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/40"
                  >
                    <option value="">Selecionar responsável</option>
                    {adminUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.full_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Observações</label>
                  <textarea
                    value={ofertaForm.observacoes}
                    onChange={e => setOfertaForm(f => ({ ...f, observacoes: e.target.value }))}
                    placeholder="Detalhes da negociação..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm bg-[#162744] border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/40 resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <Button
                    type="submit"
                    disabled={submittingOferta}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-[#09081A] font-semibold"
                  >
                    {submittingOferta ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Handshake className="w-4 h-4 mr-2" />}
                    {submittingOferta ? "Registrando..." : "Registrar Oferta"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setOfertaModal(null)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
