"use client";

import { useState } from "react";
import { Lock, MessageSquare, CheckCircle2, Loader2, Bot, Send, Zap } from "lucide-react";

export function SdrAddonLocked({ jaSolicitado }: { jaSolicitado: boolean }) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">(jaSolicitado ? "ok" : "idle");

  async function solicitar() {
    setStatus("loading");
    try {
      const res = await fetch("/api/partner/sdr/solicitar-addon", { method: "POST" });
      setStatus(res.ok ? "ok" : "err");
    } catch {
      setStatus("err");
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-10 animate-fade-in">
      <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-8 text-center"
        style={{ boxShadow: "0 0 0 1px rgba(201,168,76,0.08), 0 8px 32px rgba(0,0,0,0.3)" }}>
        <div className="w-16 h-16 rounded-2xl bg-[#C9A84C]/15 flex items-center justify-center mx-auto mb-5">
          <Lock className="w-8 h-8 text-[#C9A84C]" />
        </div>

        <h1 className="text-2xl font-bold text-[#F0ECE4]">Atendimento IA no WhatsApp</h1>
        <p className="text-sm text-[#7A8FA8] mt-2 max-w-md mx-auto">
          Conecte o seu próprio número de WhatsApp e deixe uma IA configurada por você
          responder, qualificar e agendar com os seus leads — automaticamente.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 text-left">
          {[
            { icon: <Bot className="w-4 h-4 text-[#C9A84C]" />, label: "Sua própria IA", desc: "Nome, contexto e regras que você define" },
            { icon: <MessageSquare className="w-4 h-4 text-[#C9A84C]" />, label: "Seu WhatsApp", desc: "Conecta com QR Code, número só seu" },
            { icon: <Send className="w-4 h-4 text-[#C9A84C]" />, label: "Envio em massa", desc: "Dispare campanhas pros seus contatos" },
          ].map((f) => (
            <div key={f.label} className="bg-[#0D1929] border border-[#243A66] rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">{f.icon}<p className="text-xs font-bold text-[#F0ECE4]">{f.label}</p></div>
              <p className="text-[11px] text-[#7A8FA8]">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-7 flex items-center justify-center gap-2">
          <Zap className="w-4 h-4 text-[#C9A84C]" />
          <p className="text-2xl font-bold text-[#C9A84C]">R$29,90<span className="text-sm font-normal text-[#7A8FA8]">/mês</span></p>
        </div>

        <div className="mt-6">
          {status === "ok" ? (
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4" /> Pedido enviado — aguarde a ativação
            </div>
          ) : (
            <button
              onClick={solicitar}
              disabled={status === "loading"}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-sm font-bold transition-all disabled:opacity-60"
            >
              {status === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              {status === "loading" ? "Enviando..." : "Quero Contratar"}
            </button>
          )}
          {status === "err" && <p className="text-xs text-red-400 mt-2">Não foi possível enviar o pedido. Tente novamente.</p>}
        </div>
        <p className="text-[11px] text-[#7A8FA8] mt-4">
          Após o pedido, nossa equipe confirma o pagamento e libera o acesso.
        </p>
      </div>
    </div>
  );
}
