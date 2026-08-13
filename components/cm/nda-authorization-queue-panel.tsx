"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, ShieldCheck, ExternalLink, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

type QueueItem = {
  id: string;
  anonymous_id: string;
  apelido: string | null;
  valor_face: number;
  asset_type: string;
  nda_document_url: string | null;
  nda_authorization_reason: string | null;
  nda_authorization_requested_at: string;
  requested_by: { id: string; full_name: string } | null;
};

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

export function NdaAuthorizationQueuePanel() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cm/listings/nda-queue");
      const json = await res.json();
      setItems(json.listings ?? []);
      setSelected(new Set());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Cada aprovacao/rejeicao passa pelo mesmo PATCH individual ja existente (/nda-authorize),
  // so em loop -- nunca fabrica nda_document_url/reason, so revisa o que ja foi anexado.
  const runBulk = async (action: "approve" | "reject") => {
    if (selected.size === 0) return;
    const label = action === "approve" ? "aprovar" : "rejeitar";
    if (!confirm(`Confirma ${label} ${selected.size} NDA(s) selecionado(s)? Cada um já tem anexo e motivo enviados individualmente pela Mesa.`)) return;

    setProcessing(true);
    let ok = 0, fail = 0;
    for (const id of selected) {
      try {
        const res = await fetch(`/api/cm/listings/${id}/nda-authorize`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (res.ok) ok++; else fail++;
      } catch {
        fail++;
      }
    }
    setProcessing(false);
    alert(`${ok} ${label === "aprovar" ? "aprovado(s)" : "rejeitado(s)"}.${fail > 0 ? ` ${fail} falharam.` : ""}`);
    fetchQueue();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-[#F5F1E8] flex items-center gap-2"><ShieldCheck size={16} className="text-[#C9A84C]" /> Fila de Autorização de NDA</p>
          <p className="text-xs text-[#9BAFC5]">NDAs marcados por GESTAO/Mesa Operacional, aguardando aprovação de diretor. Cada um já tem anexo e motivo enviados.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchQueue} className="flex items-center gap-1.5 rounded-lg border border-[#243A66] text-[#9BAFC5] text-xs font-semibold px-3 py-2 hover:text-[#F5F1E8] transition-colors">
            <RefreshCw size={13} /> Atualizar
          </button>
          {selected.size > 0 && (
            <>
              <button onClick={() => runBulk("reject")} disabled={processing}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/30 text-red-400 text-xs font-semibold px-3 py-2 hover:bg-red-500/10 transition-colors disabled:opacity-50">
                {processing ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />} Rejeitar Selecionados ({selected.size})
              </button>
              <button onClick={() => runBulk("approve")} disabled={processing}
                className="flex items-center gap-1.5 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold px-3 py-2 hover:bg-[#D4B96A] transition-colors disabled:opacity-50">
                {processing ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Aprovar Selecionados ({selected.size})
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={20} className="text-[#9BAFC5] animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-dashed border-[#243A66]">
          <ShieldCheck size={24} className="text-[#5A7490] mx-auto mb-3 opacity-40" />
          <p className="text-[#5A7490] text-sm">Nenhum NDA aguardando autorização.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-start gap-3 bg-[#12112A] border border-[#243A66] rounded-lg p-3">
              <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} className="mt-1 w-4 h-4 accent-[#C9A84C]" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#C9A84C]">{it.anonymous_id}</span>
                  {it.apelido && <span className="text-xs text-[#F5F1E8]">{it.apelido}</span>}
                  <span className="text-xs text-[#9BAFC5]">{formatBRL(Number(it.valor_face))}</span>
                </div>
                <div className="text-[10px] text-[#9BAFC5] mt-1">
                  Solicitado por <span className="text-[#F5F1E8] font-semibold">{it.requested_by?.full_name ?? "Usuário"}</span>
                  {" · "}{new Date(it.nda_authorization_requested_at).toLocaleString("pt-BR")}
                </div>
                {it.nda_authorization_reason && (
                  <div className="text-[11px] text-[#9BAFC5] mt-1.5 italic">"{it.nda_authorization_reason}"</div>
                )}
                {it.nda_document_url && (
                  <a href={it.nda_document_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] font-bold text-[#C9A84C] hover:text-[#E8C97A] mt-1.5 w-fit">
                    <ExternalLink size={11} /> Ver NDA anexado
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
