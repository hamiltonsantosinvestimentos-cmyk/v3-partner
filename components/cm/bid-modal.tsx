"use client";

import React, { useState } from "react";
import { X, Loader2, Send } from "lucide-react";

interface BidModalProps {
  listing: {
    id: string;
    anonymous_id: string;
    asset_type: string;
    valor_face: number;
    desagio_pretendido: number | null;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export function BidModal({ listing, onClose, onSuccess }: BidModalProps) {
  const [bidValue, setBidValue] = useState("");
  const [desagio, setDesagio] = useState("");
  const [tirPretendida, setTirPretendida] = useState("");
  const [paymentType, setPaymentType] = useState("a_vista");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDesagioChange = (val: string) => {
    setDesagio(val);
    if (val) {
      const custo = listing.valor_face * (1 - Number(val) / 100);
      setBidValue(custo.toFixed(0));
    }
  };

  const handleSubmit = async () => {
    if (!bidValue) { setError("Informe o valor da oferta"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/cm/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: listing.id,
          bid_value: Number(bidValue),
          desagio_oferecido: desagio ? Number(desagio) : null,
          tir_pretendida: tirPretendida ? Number(tirPretendida) : null,
          payment_type: paymentType,
          notes: notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro ao enviar proposta"); return; }
      onSuccess();
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#12112A] border border-[#C9A84C]/30 rounded-xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <div>
            <div className="text-[10px] text-[#C9A84C] font-bold tracking-wider">{listing.anonymous_id}</div>
            <div className="text-sm font-bold text-[#F5F1E8]">Fazer Oferta de Compra</div>
          </div>
          <button onClick={onClose} className="text-[#9BAFC5] hover:text-[#F5F1E8]"><X size={18} /></button>
        </div>

        {/* Info */}
        <div className="bg-[#09081A] rounded-lg p-3 mb-4 text-xs text-[#9BAFC5]">
          <div className="flex justify-between">
            <span>Valor de Face</span>
            <span className="text-[#F5F1E8] font-bold">R$ {listing.valor_face.toLocaleString("pt-BR")}</span>
          </div>
          {listing.desagio_pretendido && (
            <div className="flex justify-between mt-1">
              <span>Deságio pretendido</span>
              <span className="text-[#C9A84C] font-bold">{listing.desagio_pretendido}%</span>
            </div>
          )}
        </div>

        {/* Form */}
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-1">Deságio Oferecido (%)</label>
            <input
              type="number" value={desagio}
              onChange={(e) => handleDesagioChange(e.target.value)}
              placeholder="Ex: 30"
              className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-md px-3 py-2 text-sm text-[#F5F1E8] placeholder:text-[#9BAFC5]/40"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-1">Valor da Oferta (R$)</label>
            <input
              type="number" value={bidValue}
              onChange={(e) => setBidValue(e.target.value)}
              placeholder="Calculado automaticamente"
              className="w-full bg-[#162744] border border-[#C9A84C]/30 rounded-md px-3 py-2 text-sm text-[#F5F1E8] font-bold placeholder:text-[#9BAFC5]/40"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-1">TIR Pretendida (% a.a.)</label>
            <input
              type="number" value={tirPretendida}
              onChange={(e) => setTirPretendida(e.target.value)}
              placeholder="Opcional"
              className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-md px-3 py-2 text-sm text-[#F5F1E8] placeholder:text-[#9BAFC5]/40"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-1">Forma de Pagamento</label>
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value)}
              className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-md px-3 py-2 text-sm text-[#F5F1E8]"
            >
              <option value="a_vista">À Vista</option>
              <option value="parcelado">Parcelado</option>
              <option value="escrow">Escrow</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-1">Observações</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Condições, prazos..."
              rows={2}
              className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-md px-3 py-2 text-sm text-[#F5F1E8] placeholder:text-[#9BAFC5]/40 resize-none"
            />
          </div>
        </div>

        {error && <p className="text-red-400 text-xs mt-3">{error}</p>}

        <button
          onClick={handleSubmit} disabled={loading}
          className="w-full mt-5 py-3 bg-[#C9A84C] text-[#09081A] rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#D4B96A] transition disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {loading ? "Enviando..." : "Enviar Proposta"}
        </button>
      </div>
    </div>
  );
}
