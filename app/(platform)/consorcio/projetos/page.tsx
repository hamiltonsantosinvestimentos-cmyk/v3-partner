"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderOpen, Plus, ArrowRight, Trash2, Loader2, X } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  type: string;
  credit_value: number;
  status: string;
  client: string;
  admin: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  EM_ANDAMENTO: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  CONCLUIDO: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  AGUARDANDO: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  CANCELADO: "bg-red-500/20 text-red-400 border-red-500/30",
};
const STATUS_LABELS: Record<string, string> = { EM_ANDAMENTO: "Em Andamento", CONCLUIDO: "Concluído", AGUARDANDO: "Aguardando", CANCELADO: "Cancelado" };
const TYPE_LABELS: Record<string, string> = { IMOVEL: "Imóvel", VEICULO: "Veículo", SERVICO: "Serviço", OUTROS: "Outros" };
const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export default function ConsorcioProjetosPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", type: "IMOVEL", credit_value: "", client: "", admin: "", status: "AGUARDANDO" });

  useEffect(() => {
    Promise.all([
      fetch("/api/consorcio/projetos").then(r => r.json()),
      fetch("/api/usuarios/me").then(r => r.json()).catch(() => ({})),
    ]).then(([projData, meData]) => {
      if (Array.isArray(projData.projetos)) setProjects(projData.projetos);
      if (meData?.role) setUserRole(meData.role);
    }).finally(() => setLoading(false));
  }, []);

  const isAdmin = ADMIN_ROLES.includes(userRole);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/consorcio/projetos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, credit_value: Number(form.credit_value) }),
    });
    const json = await res.json();
    if (json.projeto) {
      setProjects(prev => [json.projeto, ...prev]);
      setShowForm(false);
      setForm({ name: "", type: "IMOVEL", credit_value: "", client: "", admin: "", status: "AGUARDANDO" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este projeto?")) return;
    setDeleting(id);
    const res = await fetch(`/api/consorcio/projetos?id=${id}`, { method: "DELETE" });
    if (res.ok) setProjects(prev => prev.filter(p => p.id !== id));
    setDeleting(null);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <FolderOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Projetos de Consórcio</h1>
            <p className="text-xs text-muted-foreground">Acompanhe projetos de aquisição via consórcio</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Incluir Projeto
        </Button>
      </div>

      {showForm && (
        <Card className="border-violet-500/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Novo Projeto</h3>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome do Projeto" required className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
              <input value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} placeholder="Cliente" required className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
              <input value={form.admin} onChange={e => setForm({ ...form, admin: e.target.value })} placeholder="Administradora" required className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
              <input type="number" value={form.credit_value} onChange={e => setForm({ ...form, credit_value: e.target.value })} placeholder="Valor do Crédito" required min={0} className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none">
                <option value="IMOVEL">Imóvel</option>
                <option value="VEICULO">Veículo</option>
                <option value="SERVICO">Serviço</option>
                <option value="OUTROS">Outros</option>
              </select>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none">
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <div className="flex gap-2 lg:col-span-3">
                <Button type="submit" size="sm" className="flex-1">Salvar</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading && <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>}

      {!loading && (
        <div className="space-y-3">
          {projects.map(project => (
            <Card key={project.id} className="hover:border-violet-500/30 transition-all group">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={STATUS_COLORS[project.status] ?? STATUS_COLORS.AGUARDANDO}>
                        {STATUS_LABELS[project.status] ?? project.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{TYPE_LABELS[project.type] ?? project.type}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {project.client} · {project.admin} · {formatDate(project.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="text-base font-bold text-white">{formatCurrency(project.credit_value)}</span>
                    {isAdmin ? (
                      <button onClick={() => handleDelete(project.id)} disabled={deleting === project.id} className="text-red-400/60 hover:text-red-400 transition-colors p-1">
                        {deleting === project.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    ) : (
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-violet-400 transition-colors" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {projects.length === 0 && (
            <div className="text-center py-16">
              <FolderOpen className="w-10 h-10 text-violet-400/50 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Nenhum projeto cadastrado</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
