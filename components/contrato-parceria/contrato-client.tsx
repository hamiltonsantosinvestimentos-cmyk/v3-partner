"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ScrollText, Loader2, ShieldCheck } from "lucide-react";

export function ContratoClient({ nome }: { nome: string }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const primeiroNome = nome?.trim().split(/\s+/)[0] ?? "";

  async function continuar() {
    setEnviando(true);
    setErro("");
    try {
      const res = await fetch("/api/contratos/parceria/reconhecer", { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Não foi possível continuar. Tente de novo.");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível continuar. Tente de novo.");
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#09081A] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#111F35] border border-[#243A66] rounded-2xl p-8 text-center">
        <Image src="/logo.jpg" alt="V3 Partners" width={44} height={44} className="rounded-lg mx-auto mb-6" />

        <div className="w-14 h-14 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/30 flex items-center justify-center mx-auto mb-5">
          <ScrollText className="w-6 h-6 text-[#C9A84C]" />
        </div>

        <h1 className="text-xl font-bold text-[#F0ECE4]">
          {primeiroNome ? `Bem-vindo(a), ${primeiroNome}!` : "Bem-vindo(a) à V3 Partners!"}
        </h1>
        <p className="text-sm text-[#7A8FA8] mt-3 leading-relaxed">
          Seu cadastro foi confirmado. O contrato de parceria será enviado em breve, diretamente pelo nosso time jurídico, para assinatura fora da plataforma.
        </p>
        <p className="text-xs text-[#7A8FA8] mt-3 leading-relaxed flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#C9A84C] flex-shrink-0" />
          Você já pode acessar a plataforma normalmente enquanto isso.
        </p>

        {erro && <p className="text-xs text-red-400 mt-4">{erro}</p>}

        <button
          onClick={continuar}
          disabled={enviando}
          className="mt-7 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-sm font-bold transition-colors disabled:opacity-60"
        >
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {enviando ? "Entrando..." : "Continuar para a plataforma"}
        </button>
      </div>
    </div>
  );
}
