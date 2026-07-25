"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ContratoVendaIntakeForm } from "@/components/investor/contrato-venda-intake-form";

export default function ContratoVendaIntakePage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<"loading" | "ready" | "locked" | "error">("loading");
  const [data, setData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/investor/contrato-venda-intake/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (res.status === 409) {
          setState("locked");
          setErrorMsg(json.message);
          setSigned(Boolean(json.signed));
        } else if (!res.ok) {
          setState("error");
          setErrorMsg(json.error || "Link inválido");
        } else {
          setData(json);
          setState("ready");
        }
      })
      .catch(() => {
        setState("error");
        setErrorMsg("Erro de conexão");
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-[#09081A]">
      <div className="border-b border-[#C9A84C]/20 bg-[#12112A]">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" className="h-8" />
          <div>
            <p className="text-sm font-bold text-[#F5F1E8]">Contrato de Compra e Venda de Ativo Naval</p>
            <p className="text-[10px] text-[#9BAFC5]">Qualificação do vendedor, V3 Partners</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {state === "loading" && (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <Loader2 className="w-8 h-8 animate-spin text-[#C9A84C] mb-4" />
            <p className="text-sm text-[#9BAFC5]">Carregando formulário</p>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
            <h2 className="text-xl font-bold text-[#F5F1E8] mb-2">Link inválido</h2>
            <p className="text-sm text-[#9BAFC5]">{errorMsg}</p>
            <p className="text-xs text-[#9BAFC5]/50 mt-6">Entre em contato: deal@v3partners.com.br</p>
          </div>
        )}

        {state === "locked" && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <div className="w-16 h-16 rounded-full bg-[#C9A84C]/10 flex items-center justify-center mb-6">
              {signed ? <CheckCircle2 className="w-8 h-8 text-[#C9A84C]" /> : <AlertTriangle className="w-8 h-8 text-[#C9A84C]" />}
            </div>
            <h2 className="text-xl font-bold text-[#F5F1E8] mb-2">{signed ? "Contrato assinado" : "Aguardando assinatura"}</h2>
            <p className="text-sm text-[#9BAFC5] max-w-md">{errorMsg}</p>
            <p className="text-xs text-[#9BAFC5]/50 mt-6">Entre em contato: deal@v3partners.com.br</p>
          </div>
        )}

        {state === "ready" && data && <ContratoVendaIntakeForm token={token} context={data} />}
      </div>

      <div className="border-t border-[#9BAFC5]/10 mt-auto">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <p className="text-[10px] text-[#9BAFC5]/40">V3 Partners Soluções Ltda, CNPJ 14.219.287/0001-50</p>
          <p className="text-[10px] text-[#9BAFC5]/40">privacidade@v3partners.com.br</p>
        </div>
      </div>
    </div>
  );
}
