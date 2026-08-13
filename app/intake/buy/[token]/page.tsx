"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import { BuyIntakeWizard } from "@/components/cm/buy-intake-wizard";

// UUID v4-ish, o suficiente pra descartar lixo antes de mandar pro servidor validar de verdade
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function BuyIntakePageInner() {
  const { token } = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const partnerParam = searchParams.get("partner");
  const originPartnerId = partnerParam && UUID_RE.test(partnerParam) ? partnerParam : undefined;
  const [state, setState] = useState<"loading" | "ready" | "locked" | "error">("loading");
  const [data, setData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/cm/intake/buy/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (res.status === 409) { setState("locked"); setErrorMsg(json.error); }
        else if (!res.ok) { setState("error"); setErrorMsg(json.error || "Link inválido"); }
        else { setData(json); setState("ready"); }
      })
      .catch(() => { setState("error"); setErrorMsg("Erro de conexão"); });
  }, [token]);

  return (
    <div className="min-h-screen bg-[#09081A]">
      <div className="border-b border-[#C9A84C]/20 bg-[#12112A]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" className="h-8" />
          <div>
            <p className="text-sm font-bold text-[#F5F1E8]">Bolsa de Ativos</p>
            <p className="text-[10px] text-[#9BAFC5]">Registro de Interesse — Comprador</p>
          </div>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-10">
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
          <div>
            <div className="flex flex-col items-center text-center mb-8">
              <AlertTriangle className="w-8 h-8 text-[#C9A84C] mb-4" />
              <h2 className="text-xl font-bold text-[#F5F1E8] mb-2">Formulário já enviado</h2>
              <p className="text-sm text-[#9BAFC5] max-w-md">{errorMsg}</p>
            </div>
            {/* Cadastro travado, mas documentos continuam abertos -- "enviar depois" agora e real */}
            <BuyIntakeWizard token={token} prefill={{}} lockedFollowUp />
          </div>
        )}
        {state === "ready" && data && (
          <BuyIntakeWizard token={token} prefill={data.prefill} originPartnerId={originPartnerId} />
        )}
      </div>
      <div className="border-t border-[#9BAFC5]/10 mt-auto">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <p className="text-[10px] text-[#9BAFC5]/40">V3 Partners Soluções Ltda — CNPJ 14.219.287/0001-50</p>
          <p className="text-[10px] text-[#9BAFC5]/40">privacidade@v3partners.com.br</p>
        </div>
      </div>
    </div>
  );
}

export default function BuyIntakePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#09081A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#C9A84C]" />
      </div>
    }>
      <BuyIntakePageInner />
    </Suspense>
  );
}
