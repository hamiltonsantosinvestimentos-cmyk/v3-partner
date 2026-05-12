"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, Plus, ChevronRight, Clock, CheckCircle2, Archive, X } from "lucide-react";

interface Workspace {
  id: string;
  name: string;
  context: string | null;
  status: "ativo" | "sintetizado" | "arquivado";
  created_at: string;
  updated_at: string;
}

interface Props {
  workspaces: Workspace[];
  userRole: string;
  userName: string;
}

const STATUS_LABEL: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ativo:       { label: "Ativo",       color: "text-[#4ade80] bg-[#4ade80]/10 border-[#4ade80]/20", icon: <Clock className="w-3 h-3" /> },
  sintetizado: { label: "Sintetizado", color: "text-[#C9A84C] bg-[#C9A84C]/10 border-[#C9A84C]/20", icon: <CheckCircle2 className="w-3 h-3" /> },
  arquivado:   { label: "Arquivado",   color: "text-[#7A8FA8] bg-[#7A8FA8]/10 border-[#7A8FA8]/20", icon: <Archive className="w-3 h-3" /> },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function DealRoomsClient({ workspaces: initial, userName }: Props) {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initial);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", context: "" });

  async function createWorkspace() {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), context: form.context.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok && data.workspace) {
        setWorkspaces(prev => [data.workspace, ...prev]);
        setShowModal(false);
        setForm({ name: "", context: "" });
        router.push(`/deal-rooms/${data.workspace.id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#09081A] p-6">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Layers className="w-5 h-5 text-[#C9A84C]" />
          <span className="text-[#C9A84C] text-xs font-bold tracking-[2px] uppercase">Deal Intelligence</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[#F0ECE4] text-3xl font-bold">Deal Rooms</h1>
            <p className="text-[#7A8FA8] text-sm mt-1">
              {workspaces.length === 0
                ? "Crie um workspace para começar a montar um deal com múltiplos squads"
                : `${workspaces.length} workspace${workspaces.length > 1 ? "s" : ""} · ${userName}`}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#C9A84C] text-[#09081A] text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-[#E8C97A] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Deal Room
          </button>
        </div>
      </div>

      {/* Empty state */}
      {workspaces.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="w-16 h-16 rounded-full bg-[#111F35] border border-[#243A66] flex items-center justify-center mb-4">
            <Layers className="w-7 h-7 text-[#243A66]" />
          </div>
          <p className="text-[#F0ECE4] text-sm font-semibold mb-1">Nenhum Deal Room criado</p>
          <p className="text-[#7A8FA8] text-xs max-w-xs">
            Um Deal Room reúne pesquisas de múltiplos squads sobre um deal. Toda inteligência num único lugar.
          </p>
        </div>
      )}

      {/* Grid de workspaces */}
      {workspaces.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {workspaces.map(ws => {
            const st = STATUS_LABEL[ws.status] ?? STATUS_LABEL.ativo;
            return (
              <button
                key={ws.id}
                onClick={() => router.push(`/deal-rooms/${ws.id}`)}
                className="text-left bg-[#111F35] border border-[#243A66] rounded-xl p-5 hover:border-[#C9A84C] hover:bg-[#162744] transition-all duration-200 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[1px] px-2 py-1 rounded-full border ${st.color}`}>
                    {st.icon}
                    {st.label}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#243A66] group-hover:text-[#C9A84C] transition-colors" />
                </div>

                <h3 className="text-[#F0ECE4] font-semibold text-sm leading-snug mb-2 group-hover:text-[#C9A84C] transition-colors">
                  {ws.name}
                </h3>

                {ws.context && (
                  <p className="text-[#7A8FA8] text-xs line-clamp-2 mb-3 leading-relaxed">
                    {ws.context}
                  </p>
                )}

                <div className="flex items-center gap-1 text-[#7A8FA8] mt-auto">
                  <Clock className="w-3 h-3" />
                  <span className="text-[10px]">Atualizado {formatDate(ws.updated_at)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Modal novo workspace */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-[#C9A84C] text-[9px] font-bold tracking-[2px] uppercase mb-1">Novo Deal Room</div>
                <h2 className="text-[#F0ECE4] text-lg font-bold">Criar workspace</h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-[#162744] hover:bg-[#243A66] text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[#7A8FA8] text-xs font-semibold uppercase tracking-[1px] mb-2">
                  Nome do Deal *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Frigoríficos Nordeste BA · R$45M"
                  className="w-full bg-[#162744] border border-[#243A66] text-[#F0ECE4] text-sm px-3 py-2.5 rounded-lg placeholder-[#243A66] focus:outline-none focus:border-[#C9A84C] transition-colors"
                  onKeyDown={e => e.key === "Enter" && createWorkspace()}
                />
              </div>

              <div>
                <label className="block text-[#7A8FA8] text-xs font-semibold uppercase tracking-[1px] mb-2">
                  Briefing inicial <span className="font-normal normal-case text-[#243A66]">(opcional)</span>
                </label>
                <textarea
                  value={form.context}
                  onChange={e => setForm(p => ({ ...p, context: e.target.value }))}
                  placeholder="Descreva o deal brevemente: setor, empresa, ticket, contexto, o que você já sabe..."
                  rows={4}
                  className="w-full bg-[#162744] border border-[#243A66] text-[#F0ECE4] text-sm px-3 py-2.5 rounded-lg placeholder-[#243A66] focus:outline-none focus:border-[#C9A84C] transition-colors resize-none"
                />
                <p className="text-[#243A66] text-[10px] mt-1">
                  Este contexto é compartilhado automaticamente com todos os squads do workspace.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-[#162744] text-[#7A8FA8] text-sm font-semibold py-2.5 rounded-lg hover:bg-[#243A66] hover:text-[#F0ECE4] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={createWorkspace}
                disabled={creating || !form.name.trim()}
                className="flex-1 bg-[#C9A84C] text-[#09081A] text-sm font-bold py-2.5 rounded-lg hover:bg-[#E8C97A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {creating ? "Criando…" : "Criar Deal Room"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
