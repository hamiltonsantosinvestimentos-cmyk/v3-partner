"use client";

import { useState } from "react";
import { UserPlus, X, Loader2, Check } from "lucide-react";
import { isValidEmail } from "@/lib/utils";

// Botao "+ Indicar Integrante/Comissionado" (13/08/2026), reaproveitado no card de Ativo
// (Mesa de Capitais, SELL_SIDE) e no card de Comprador (Demandas de Compra, BUY_SIDE).
// O lado nunca e escolhido pelo usuario -- vem travado pelo card que abriu o modal, e o
// servidor (POST /api/cm/qualifications) resolve de novo pelo mesmo principio (listing_id
// so pode virar SELL_SIDE, demand_id so pode virar BUY_SIDE), entao nao ha como um
// intermediario ser indicado no lado errado por engano em nenhuma das duas pontas.

type Side = "SELL_SIDE" | "BUY_SIDE";

const ROLE_OPTIONS: Record<Side, { value: string; label: string; hint: string }[]> = {
  SELL_SIDE: [
    { value: "finder_originacao_venda", label: "Finder / Originação", hint: "Trouxe o ativo para a V3" },
    { value: "intermediario_venda", label: "Intermediário", hint: "Participa da negociação do lado vendedor" },
    { value: "mandatario", label: "Mandatário", hint: "Representa formalmente o vendedor" },
  ],
  BUY_SIDE: [
    { value: "finder_originacao_compra", label: "Finder / Originação", hint: "Trouxe o comprador para a V3" },
    { value: "intermediario_compra", label: "Intermediário", hint: "Participa da negociação do lado comprador" },
    { value: "mandatario", label: "Mandatário", hint: "Representa formalmente o comprador" },
  ],
};

const SIDE_LABEL: Record<Side, { label: string; color: string }> = {
  SELL_SIDE: { label: "Lado Vendedor", color: "#E8935A" },
  BUY_SIDE: { label: "Lado Comprador", color: "#4ADE80" },
};

interface QuickIndicateModalProps {
  side: Side;
  listingId?: string;
  demandId?: string;
  anchorLabel: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function QuickIndicateModal({ side, listingId, demandId, anchorLabel, onClose, onSuccess }: QuickIndicateModalProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(ROLE_OPTIONS[side][0].value);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sideMeta = SIDE_LABEL[side];

  const submit = async () => {
    if (!fullName.trim() || !isValidEmail(email)) {
      setError("Informe nome completo e um e-mail válido.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/cm/qualifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: listingId,
          demand_id: demandId,
          parties: [{ full_name: fullName.trim(), email: email.trim(), role_in_document: role }],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao indicar");
      setDone(true);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao indicar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-[#09081A] border border-[#C9A84C]/20 rounded-xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-[#243A66] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#E8C97A]">
              <UserPlus size={12} /> Indicar Integrante / Comissionado
            </div>
            <div className="text-xs text-[#9BAFC5] mt-1 truncate max-w-[280px]">{anchorLabel}</div>
          </div>
          <button onClick={onClose} className="text-[#9BAFC5] hover:text-[#F5F1E8] flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="p-6 text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
              <Check size={18} className="text-emerald-400" />
            </div>
            <p className="text-sm text-[#F5F1E8] font-semibold">Integrante indicado.</p>
            <p className="text-xs text-[#9BAFC5] mt-1">A Governança dispara o link de qualificação junto com o instrumento (NDA/FPA) quando o processo avançar.</p>
            <button onClick={onClose} className="mt-4 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold px-4 py-2 hover:bg-[#E8C97A] transition-colors">
              Fechar
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-3.5">
            <span
              className="inline-flex items-center gap-1.5 text-[9px] font-bold px-2 py-1 rounded-full border w-fit"
              style={{ color: sideMeta.color, background: `${sideMeta.color}1F`, borderColor: `${sideMeta.color}4D` }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: sideMeta.color }} />
              {sideMeta.label} · travado por este card
            </span>

            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-[#9BAFC5]/70">Nome Completo</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nome do indicado"
                className="w-full mt-1 bg-[#12112A] border border-[#243A66] rounded-lg px-3 py-2 text-sm text-[#F5F1E8] outline-none focus:border-[#C9A84C]/50"
              />
            </div>

            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-[#9BAFC5]/70">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="w-full mt-1 bg-[#12112A] border border-[#243A66] rounded-lg px-3 py-2 text-sm text-[#F5F1E8] outline-none focus:border-[#C9A84C]/50"
              />
            </div>

            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-[#9BAFC5]/70 mb-1.5 block">Papel</label>
              <div className="space-y-1.5">
                {ROLE_OPTIONS[side].map((r) => (
                  <label
                    key={r.value}
                    className="flex items-start gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors"
                    style={{
                      borderColor: role === r.value ? "rgba(201,168,76,0.5)" : "#243A66",
                      background: role === r.value ? "rgba(201,168,76,0.08)" : "transparent",
                    }}
                  >
                    <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} className="mt-0.5 accent-[#C9A84C]" />
                    <div>
                      <div className="text-xs font-semibold text-[#F5F1E8]">{r.label}</div>
                      <div className="text-[10px] text-[#9BAFC5]">{r.hint}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-[11px] text-red-400">{error}</p>}

            <button
              onClick={submit}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold py-2.5 hover:bg-[#E8C97A] transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
              Indicar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
