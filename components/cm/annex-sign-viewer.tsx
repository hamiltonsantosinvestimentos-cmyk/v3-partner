"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Lock, CheckCircle2, ShieldAlert } from "lucide-react";

interface AnnexSignViewerProps {
  token: string;
}

export function AnnexSignViewer({ token }: AnnexSignViewerProps) {
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/cm/annex-sign/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erro ao carregar documento");
        setContract(json.contract);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSign = async () => {
    setSigning(true);
    setError("");
    try {
      const res = await fetch(`/api/cm/annex-sign/${token}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao assinar");
      setContract((prev: any) => ({ ...prev, status_signature: "assinado", signed_at: json.signed_at ?? prev.signed_at }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09081A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin" />
      </div>
    );
  }

  if (error && !contract) {
    return (
      <div className="min-h-screen bg-[#09081A] flex flex-col items-center justify-center text-center px-6">
        <ShieldAlert className="w-10 h-10 text-red-400 mb-4" />
        <p className="text-sm text-[#9BAFC5]">{error}</p>
      </div>
    );
  }

  const isSigned = contract?.status_signature === "assinado";

  return (
    <div className="min-h-screen bg-[#09081A] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" className="h-10" />
          <div>
            <div className="text-sm font-bold text-[#F5F1E8]">Assinatura de Anexo</div>
            <div className="text-xs text-[#9BAFC5]">Bolsa de Ativos · V3 Partners</div>
          </div>
        </div>

        <div
          className="bg-[#162744] border border-[#9BAFC5]/10 rounded-lg p-6 mb-6 text-xs text-[#9BAFC5]/90 leading-relaxed [&_h2]:text-[#C9A84C] [&_h2]:font-bold [&_h2]:uppercase [&_h2]:text-[11px] [&_h2]:tracking-wide [&_h2]:mt-4 [&_h2]:mb-2 [&_p]:mb-3 [&_strong]:text-[#F5F1E8]"
          dangerouslySetInnerHTML={{ __html: contract.rendered_html }}
        />

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        {isSigned ? (
          <div className="flex items-center gap-2 justify-center px-6 py-4 bg-emerald-600/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm font-bold">
            <CheckCircle2 size={18} /> Anexo assinado{contract.signed_at ? ` em ${new Date(contract.signed_at).toLocaleString("pt-BR")}` : ""}
          </div>
        ) : (
          <button
            onClick={handleSign}
            disabled={signing}
            className="w-full flex items-center justify-center gap-2 px-8 py-3 bg-[#C9A84C] text-[#09081A] rounded-lg text-sm font-bold hover:bg-[#E8C97A] disabled:opacity-50 transition"
          >
            {signing ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
            Assinar Anexo
          </button>
        )}

        <p className="text-[9px] text-[#9BAFC5]/50 text-center mt-6">V3 Partners Soluções Ltda, CNPJ 14.219.287/0001-50</p>
      </div>
    </div>
  );
}
