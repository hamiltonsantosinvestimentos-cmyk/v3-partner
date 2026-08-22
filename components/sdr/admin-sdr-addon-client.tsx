"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, Clock, Loader2, MessageSquare } from "lucide-react";

type Pedido = {
  partner_id: string;
  status: string;
  whatsapp_phone: string | null;
  addon_ativo: boolean;
  addon_solicitado_em: string | null;
  addon_ativado_em: string | null;
  partner_nome: string | null;
  partner_email: string | null;
};

export function AdminSdrAddonClient() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [ativando, setAtivando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sdr-addon");
      const d = await res.json();
      setPedidos(d.pedidos ?? []);
    } catch { /* silencioso */ }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function ativar(partnerId: string) {
    setAtivando(partnerId);
    try {
      await fetch(`/api/admin/sdr-addon/${partnerId}/ativar`, { method: "PATCH" });
      await carregar();
    } catch { /* silencioso */ }
    setAtivando(null);
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#F0ECE4] flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-[#C9A84C]" /> Add-on: Atendimento IA WhatsApp
        </h1>
        <p className="text-sm text-[#7A8FA8] mt-1">Pedidos de contratação — confirme o pagamento (R$29,90/mês) e ative.</p>
      </div>

      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin text-[#C9A84C]" />
      ) : pedidos.length === 0 ? (
        <p className="text-sm text-[#7A8FA8]">Nenhum pedido ainda.</p>
      ) : (
        <div className="bg-[#111F35] border border-[#243A66] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#243A66]">
                {["Partner", "E-mail", "WhatsApp", "Pedido em", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wide text-[#7A8FA8]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.partner_id} className="border-b border-[#243A66]/50">
                  <td className="px-5 py-3 text-[#F0ECE4] font-semibold">{p.partner_nome ?? "—"}</td>
                  <td className="px-5 py-3 text-[#7A8FA8]">{p.partner_email ?? "—"}</td>
                  <td className="px-5 py-3 text-[#7A8FA8]">{p.whatsapp_phone ?? "—"}</td>
                  <td className="px-5 py-3 text-[#7A8FA8]">
                    {p.addon_solicitado_em ? new Date(p.addon_solicitado_em).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-5 py-3">
                    {p.addon_ativo ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                        <Clock className="w-3 h-3" /> Pendente
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {!p.addon_ativo && (
                      <button
                        onClick={() => ativar(p.partner_id)}
                        disabled={ativando === p.partner_id}
                        className="px-3 py-1.5 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold disabled:opacity-60"
                      >
                        {ativando === p.partner_id ? "Ativando..." : "Ativar"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
