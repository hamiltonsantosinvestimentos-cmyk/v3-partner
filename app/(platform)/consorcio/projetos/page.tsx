"use client";
import { confirmar } from "@/lib/aviso";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderOpen, Plus, ArrowRight, Trash2, Loader2, X } from "lucide-react";
import Link from "next/link";
import { rotuloStatusOferta, type OfertaAcompanhamento } from "@/lib/consorcio/ofertas-acompanhamento";
import { dataBR, valorBR } from "@/app/(platform)/enterprise/mesa-operacional/exibicao";
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
  const [form, setForm] = useState({ name: "", type: "IMOVEL", credit_value: "", client: "", client_cpf_cnpj: "", admin: "", status: "AGUARDANDO" });

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
      setForm({ name: "", type: "IMOVEL", credit_value: "", client: "", client_cpf_cnpj: "", admin: "", status: "AGUARDANDO" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!await confirmar("Excluir este projeto?")) return;
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
              <input value={form.client_cpf_cnpj} onChange={e => setForm({ ...form, client_cpf_cnpj: e.target.value })} placeholder="CPF/CNPJ do Cliente" className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
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

      <OfertasCotaContemplada />

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

// Ofertas de cota contemplada (BRIEF docs/briefs/2026-11-27_ofertas-cota-contemplada-em-projetos.md).
// A rota já devolve a lista fechada por papel e na ordem certa (pendentes primeiro).
function OfertasCotaContemplada() {
  const [ofertas, setOfertas] = useState<OfertaAcompanhamento[] | null>(null);
  const [interno, setInterno] = useState(false);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    fetch("/api/consorcio/ofertas/acompanhamento")
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok || !Array.isArray(j?.ofertas)) throw new Error("falha");
        setOfertas(j.ofertas);
        setInterno(!!j.interno);
      })
      .catch(() => setErro(true));
  }, []);

  const emAnalise = ofertas?.filter((o) => o.status === "pendente").length;
  const aceitas = ofertas?.filter((o) => o.status === "aceita").length;

  return (
    <section id="ofertas" className="space-y-3 scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#F0ECE4]">Ofertas de cota contemplada</h2>
          <p className="text-xs text-[#7A8FA8]">
            {interno ? "Todas as ofertas feitas nas cartas contempladas. A decisão é feita na carta." : "Ofertas que você e sua equipe fizeram nas cartas contempladas."}
          </p>
        </div>
        <div className="flex gap-2">
          <Contador rotulo="Em análise" valor={emAnalise} />
          <Contador rotulo="Aceitas" valor={aceitas} />
          <Contador rotulo="Total" valor={ofertas?.length} />
        </div>
      </div>

      {erro ? (
        <p className="rounded-xl border border-[#243A66] p-4 text-sm text-[#7A8FA8]">Não foi possível carregar as ofertas agora.</p>
      ) : ofertas === null ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#C9A84C]" /></div>
      ) : ofertas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#243A66] p-6 text-center text-sm text-[#7A8FA8]">Nenhuma oferta de cota contemplada ainda.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ofertas.map((o) => (
            <div key={o.id} className="overflow-hidden rounded-xl border border-[#243A66] bg-[#162744]">
              <div className="bg-[#C9A84C] px-4 py-1 text-[9px] font-bold tracking-[0.18em] uppercase text-[#09081A]">Oferta cota contemplada</div>
              <div className="p-4 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#C9A84C]">Carta {o.carta_code}</span>
                  <span className={o.status === "pendente" ? "rounded-full bg-[#C9A84C]/15 px-2 py-0.5 text-[10px] font-semibold text-[#E8C97A]" : "rounded-full bg-[#243A66] px-2 py-0.5 text-[10px] font-semibold text-[#F0ECE4]"}>
                    {rotuloStatusOferta(o.status)}
                  </span>
                </div>
                <p className="text-sm font-medium text-[#F0ECE4] break-words">{o.interessado_nome || "Interessado sem nome"}</p>
                {!interno && <p className="text-[11px] text-[#7A8FA8]">{o.interessado_documento}</p>}
                <p className="text-xs text-[#7A8FA8]">Crédito da carta: <span className="text-[#F0ECE4]">{valorBR(o.carta_credit_value)}</span></p>
                <p className="text-xs text-[#7A8FA8]">Valor ofertado: <span className="font-semibold text-[#E8C97A]">{valorBR(o.valor_oferta)}</span></p>
                <p className="text-[11px] text-[#7A8FA8]">Ofertado por {o.ofertado_por} em {dataBR(o.created_at)}</p>
                {interno && (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="rounded-full border border-[#C9A84C]/35 px-2 py-0.5 text-[10px] text-[#E8C97A]">{o.origem}</span>
                    <Link href="/consorcio/cartas-contempladas" className="text-xs font-semibold text-[#C9A84C] hover:underline">Abrir a carta</Link>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Contador({ rotulo, valor }: { rotulo: string; valor: number | undefined }) {
  return (
    <div className="rounded-lg border border-[#243A66] bg-[#111F35] px-3 py-1.5 text-center">
      <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[#C9A84C]">{rotulo}</p>
      <p className="text-sm font-semibold text-[#F0ECE4]">{valor ?? ""}</p>
    </div>
  );
}
