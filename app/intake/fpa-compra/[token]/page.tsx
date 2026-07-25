"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { FpaIntakeForm } from "@/components/investor/fpa-intake-form";

export default function FpaCompraIntakePage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<"loading" | "ready" | "locked" | "error">("loading");
  const [data, setData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/investor/fpa-compra-intake/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (res.status === 409) {
          setState("locked");
          setErrorMsg(json.message);
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
            <p className="text-sm font-bold text-[#F5F1E8]">FPA Compra, Cadastro de Comissionados</p>
            <p className="text-[10px] text-[#9BAFC5]">Lado da compra, V3 Partners</p>
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
              <CheckCircle2 className="w-8 h-8 text-[#C9A84C]" />
            </div>
            <h2 className="text-xl font-bold text-[#F5F1E8] mb-2">Cadastro já enviado</h2>
            <p className="text-sm text-[#9BAFC5] max-w-md">{errorMsg}</p>
            <p className="text-xs text-[#9BAFC5]/50 mt-6">Entre em contato: deal@v3partners.com.br</p>
          </div>
        )}

        {state === "ready" && data && (
          <FpaIntakeForm token={token} apiPath="fpa-compra-intake" dealCode={data.deal_code} />
        )}
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
