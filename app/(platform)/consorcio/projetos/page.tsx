"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderOpen, Plus, Home, Car, Wrench, TrendingUp, ArrowRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  type: string;
  creditValue: number;
  status: string;
  client: string;
  admin: string;
  createdAt: string;
}

const SAMPLE_PROJECTS: Project[] = [
  {
    id: "1",
    name: "Aquisição Imóvel Residencial - Família Santos",
    type: "IMOVEL",
    creditValue: 450000,
    status: "EM_ANDAMENTO",
    client: "Carlos Santos",
    admin: "Porto Seguro",
    createdAt: "2026-01-15",
  },
  {
    id: "2",
    name: "Frota de Veículos - Empresa XYZ",
    type: "VEICULO",
    creditValue: 800000,
    status: "CONCLUIDO",
    client: "XYZ Transportes Ltda",
    admin: "Embracon",
    createdAt: "2025-11-20",
  },
];

const STATUS_COLORS: Record<string, string> = {
  EM_ANDAMENTO: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  CONCLUIDO: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  AGUARDANDO: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  CANCELADO: "bg-red-500/20 text-red-400 border-red-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  EM_ANDAMENTO: "Em Andamento",
  CONCLUIDO: "Concluído",
  AGUARDANDO: "Aguardando",
  CANCELADO: "Cancelado",
};

export default function ConsorcioProjetosPage() {
  const [projects, setProjects] = useState(SAMPLE_PROJECTS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", type: "IMOVEL", creditValue: "", client: "", admin: "" });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const newProject: Project = {
      id: Date.now().toString(),
      name: form.name,
      type: form.type,
      creditValue: parseFloat(form.creditValue),
      status: "AGUARDANDO",
      client: form.client,
      admin: form.admin,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setProjects([newProject, ...projects]);
    setShowForm(false);
    setForm({ name: "", type: "IMOVEL", creditValue: "", client: "", admin: "" });
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
            <p className="text-xs text-muted-foreground">
              Acompanhe projetos de aquisição via consórcio
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Incluir Projeto
        </Button>
      </div>

      {/* Quick add form */}
      {showForm && (
        <Card className="border-violet-500/30">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-4">Novo Projeto</h3>
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome do Projeto"
                required
                className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <input
                value={form.client}
                onChange={(e) => setForm({ ...form, client: e.target.value })}
                placeholder="Cliente"
                required
                className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <input
                value={form.admin}
                onChange={(e) => setForm({ ...form, admin: e.target.value })}
                placeholder="Administradora"
                required
                className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <input
                type="number"
                value={form.creditValue}
                onChange={(e) => setForm({ ...form, creditValue: e.target.value })}
                placeholder="Valor do Crédito"
                required
                min={0}
                className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none"
              >
                <option value="IMOVEL">Imóvel</option>
                <option value="VEICULO">Veículo</option>
                <option value="SERVICO">Serviço</option>
                <option value="OUTROS">Outros</option>
              </select>
              <div className="flex gap-2">
                <Button type="submit" size="sm" className="flex-1">Salvar</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Projects list */}
      <div className="space-y-3">
        {projects.map((project) => (
          <Card key={project.id} className="cursor-pointer hover:border-violet-500/30 transition-all group">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={STATUS_COLORS[project.status]}>
                      {STATUS_LABELS[project.status]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{project.type}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {project.client} · {project.admin} · {formatDate(project.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className="text-base font-bold text-white">
                    {formatCurrency(project.creditValue)}
                  </span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-violet-400 transition-colors" />
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
    </div>
  );
}
