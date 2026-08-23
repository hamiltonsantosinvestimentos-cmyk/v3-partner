"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, Clock, Loader2, MessageSquare, Pause, Play, Ban, RotateCw, AlertTriangle } from "lucide-react";

type Pedido = {
  partner_id: string;
  status: string;
  whatsapp_phone: string | null;
  addon_ativo: boolean;
  addon_status: "nao_contratado" | "ativo" | "pausado" | "cancelado";
  addon_solicitado_em: string | null;
  addon_ativado_em: string | null;
  addon_pausado_em: string | null;
  addon_cancelado_em: string | null;
  addon_ultimo_pagamento_em: string | null;
  addon_proxima_cobranca: string | null;
  atrasado: boolean;
  partner_nome: string | null;
  partner_email: string | null;
};

const STATUS_BADGE: Record<Pedido["addon_status"], { label: string; cls: string; icon: React.ElementType }> = {
  nao_contratado: { label: "Pendente", cls: "text-amber-400 bg-amber-500/15 border-amber-500/30", icon: Clock },
  ativo: { label: "Ativo", cls: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30", icon: CheckCircle2 },
  pausado: { label: "Pausado", cls: "text-orange-400 bg-orange-500/15 border-orange-500/30", icon: Pause },
  cancelado: { label: "Cancelado", cls: "text-red-400 bg-red-500/15 border-red-500/30", icon: Ban },
};

const dataFmt = (d: string | null) => (d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("pt-BR") : "—");

export function AdminSdrAddonClient() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sdr-addon");
      const d = await res.json();
      setPedidos(d.pedidos ?? []);
    } catch { /* silencioso */ }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function acao(partnerId: string, rota: string, body?: object) {
    setProcessando(partnerId);
    try {
      await fetch(`/api/admin/sdr-addon/${partnerId}/${rota}`, {
        method: "PATCH",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      await carregar();
    } catch { /* silencioso */ }
    setProcessando(null);
  }

  function renovar(p: Pedido) {
    const sugestao = new Date();
    sugestao.setDate(sugestao.getDate() + 30);
    const input = window.prompt(
      `Confirmar pagamento de ${p.partner_nome ?? "partner"} e definir a próxima cobrança (AAAA-MM-DD):`,
      sugestao.toISOString().slice(0, 10)
    );
    if (!input) return;
    acao(p.partner_id, "renovar", { proxima_cobranca: input });
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#F0ECE4] flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-[#C9A84C]" /> Add-on: Atendimento IA WhatsApp
        </h1>
        <p className="text-sm text-[#7A8FA8] mt-1">Pedidos, assinaturas ativas e controle de cobrança (R$29,90/mês, confirmação manual).</p>
      </div>

      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin text-[#C9A84C]" />
      ) : pedidos.length === 0 ? (
        <p className="text-sm text-[#7A8FA8]">Nenhum pedido ainda.</p>
      ) : (
        <div className="bg-[#111F35] border border-[#243A66] rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#243A66]">
                {["Partner", "E-mail", "WhatsApp", "Status", "Ativado em", "Último pagamento", "Próxima cobrança", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-[#7A8FA8] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => {
                const badge = STATUS_BADGE[p.addon_status] ?? STATUS_BADGE.nao_contratado;
                const BadgeIcon = badge.icon;
                const proc = processando === p.partner_id;
                return (
                  <tr key={p.partner_id} className="border-b border-[#243A66]/50">
                    <td className="px-4 py-3 text-[#F0ECE4] font-semibold whitespace-nowrap">{p.partner_nome ?? "—"}</td>
                    <td className="px-4 py-3 text-[#7A8FA8] whitespace-nowrap">{p.partner_email ?? "—"}</td>
                    <td className="px-4 py-3 text-[#7A8FA8] whitespace-nowrap">{p.whatsapp_phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold border px-2 py-0.5 rounded-full whitespace-nowrap ${badge.cls}`}>
                        <BadgeIcon className="w-3 h-3" /> {badge.label}
                      </span>
                      {p.atrasado && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/15 border border-red-500/30 px-2 py-0.5 rounded-full ml-1.5 whitespace-nowrap">
                          <AlertTriangle className="w-3 h-3" /> Atrasado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#7A8FA8] whitespace-nowrap">{dataFmt(p.addon_ativado_em)}</td>
                    <td className="px-4 py-3 text-[#7A8FA8] whitespace-nowrap">{dataFmt(p.addon_ultimo_pagamento_em)}</td>
                    <td className={`px-4 py-3 whitespace-nowrap ${p.atrasado ? "text-red-400 font-semibold" : "text-[#7A8FA8]"}`}>{dataFmt(p.addon_proxima_cobranca)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        {p.addon_status === "nao_contratado" && (
                          <button onClick={() => acao(p.partner_id, "ativar")} disabled={proc}
                            className="px-3 py-1.5 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold disabled:opacity-60">
                            {proc ? "..." : "Ativar"}
                          </button>
                        )}
                        {p.addon_status === "ativo" && (
                          <>
                            <button onClick={() => renovar(p)} disabled={proc}
                              title="Confirmar pagamento e definir próxima cobrança"
                              className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 disabled:opacity-60">
                              <RotateCw className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => acao(p.partner_id, "pausar")} disabled={proc}
                              title="Pausar" className="p-1.5 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 disabled:opacity-60">
                              <Pause className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => confirm(`Cancelar o add-on de ${p.partner_nome ?? "partner"}?`) && acao(p.partner_id, "cancelar")} disabled={proc}
                              title="Cancelar" className="p-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 disabled:opacity-60">
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {p.addon_status === "pausado" && (
                          <>
                            <button onClick={() => acao(p.partner_id, "retomar")} disabled={proc}
                              title="Retomar" className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 disabled:opacity-60">
                              <Play className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => confirm(`Cancelar o add-on de ${p.partner_nome ?? "partner"}?`) && acao(p.partner_id, "cancelar")} disabled={proc}
                              title="Cancelar" className="p-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 disabled:opacity-60">
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {p.addon_status === "cancelado" && (
                          <button onClick={() => acao(p.partner_id, "ativar")} disabled={proc}
                            className="px-3 py-1.5 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold disabled:opacity-60">
                            {proc ? "..." : "Reativar"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
