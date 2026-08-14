"use client";

import { useState } from "react";
import Image from "next/image";
import { Search, CheckCircle2, Clock, XCircle, AlertCircle, Loader2, ArrowRight } from "lucide-react";

const STATUS_CONFIG = {
  PENDENTE: {
    icon: <Clock className="w-8 h-8 text-[#C9A84C]" />,
    label: "Aguardando Análise",
    desc: "Seu cadastro foi recebido e está na fila de análise. Em breve nossa equipe entrará em contato.",
    color: "#C9A84C",
    bg: "#C9A84C15",
    border: "#C9A84C40",
  },
  EM_ANALISE: {
    icon: <AlertCircle className="w-8 h-8 text-blue-400" />,
    label: "Em Análise",
    desc: "Nossa equipe está analisando sua documentação. Você receberá uma resposta em breve.",
    color: "#60a5fa",
    bg: "#60a5fa15",
    border: "#60a5fa40",
  },
  APROVADO: {
    icon: <CheckCircle2 className="w-8 h-8 text-emerald-400" />,
    label: "Aprovado!",
    desc: "Parabéns! Seu cadastro foi aprovado. Verifique seu e-mail para acessar a plataforma.",
    color: "#34d399",
    bg: "#34d39915",
    border: "#34d39940",
  },
  REPROVADO: {
    icon: <XCircle className="w-8 h-8 text-red-400" />,
    label: "Não Aprovado",
    desc: "Infelizmente seu cadastro não foi aprovado neste momento.",
    color: "#f87171",
    bg: "#f8717115",
    border: "#f8717140",
  },
};

const PLANO_LABEL: Record<string, string> = {
  STARTER: "V3 Starter — R$ 297/mês",
  PARTNER: "V3 Partner — R$ 908,08/mês",
  PARTNER_PRO: "V3 Partner PRO — R$ 1.324,75/mês",
  ENTERPRISE: "V3 Enterprise — R$ 4.158,08/mês",
};

export default function StatusCadastroPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    found: boolean;
    status?: string;
    plano?: string;
    nome?: string;
    observacao?: string;
    created_at?: string;
    updated_at?: string;
  } | null>(null);
  const [error, setError] = useState("");

  async function handleConsultar(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`/api/cadastro-partner/status?email=${encodeURIComponent(email.trim())}`);
      const data = await res.json();
      setResult(data);
    } catch {
      setError("Erro ao consultar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const cfg = result?.status ? STATUS_CONFIG[result.status as keyof typeof STATUS_CONFIG] : null;

  return (
    <div className="min-h-screen bg-[#09081A] flex items-center justify-center p-4">
      <div className="fixed inset-0 opacity-20 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #C9A84C08 0%, transparent 50%), radial-gradient(circle at 80% 20%, #243A6608 0%, transparent 50%)" }} />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-xl overflow-hidden mb-3"
            style={{ boxShadow: "0 0 0 1px rgba(201,168,76,0.25), 0 8px 24px rgba(0,0,0,0.5)" }}>
            <Image src="/logo.jpg" alt="V3 Partners" width={64} height={64} className="w-full h-full object-contain" priority />
          </div>
          <h1 className="text-[11px] font-bold tracking-[0.2em] text-[#C9A84C] uppercase">V3 Partners</h1>
        </div>

        {/* Card */}
        <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-2.5 mb-1">
            <Search className="w-5 h-5 text-[#C9A84C]" />
            <h2 className="text-lg font-bold text-[#F0ECE4]">Status do Cadastro</h2>
          </div>
          <p className="text-xs text-[#7A8FA8] mb-6">
            Informe seu e-mail para consultar o status da sua solicitação.
          </p>

          <form onSubmit={handleConsultar} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#7A8FA8] uppercase tracking-wide mb-1.5">
                E-mail cadastrado
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full px-4 py-3 rounded-xl border border-[#243A66] bg-[#0D1B2E] text-[#F0ECE4] text-sm placeholder:text-[#7A8FA8]/60 focus:outline-none focus:border-[#C9A84C] transition-colors"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold text-sm transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {loading ? "Consultando..." : "Consultar Status"}
            </button>
          </form>

          {/* Resultado */}
          {result !== null && (
            <div className="mt-6 pt-6 border-t border-[#243A66]">
              {!result.found ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-[#243A66]/30 border border-[#243A66]">
                  <AlertCircle className="w-5 h-5 text-[#7A8FA8] flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-[#F0ECE4]">E-mail não encontrado</p>
                    <p className="text-xs text-[#7A8FA8] mt-0.5">Verifique o e-mail informado ou entre em contato com nosso suporte.</p>
                  </div>
                </div>
              ) : cfg ? (
                <div className="rounded-xl border p-5 text-center"
                  style={{ background: cfg.bg, borderColor: cfg.border }}>
                  <div className="flex justify-center mb-3">{cfg.icon}</div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: cfg.color }}>
                    {PLANO_LABEL[result.plano ?? ""] ?? result.plano}
                  </p>
                  <p className="text-base font-bold text-[#F0ECE4] mb-2">{cfg.label}</p>
                  <p className="text-xs text-[#7A8FA8] leading-relaxed">{cfg.desc}</p>

                  {result.observacao && (
                    <div className="mt-4 p-3 rounded-lg bg-[#09081A]/50 border border-[#243A66] text-left">
                      <p className="text-[11px] font-semibold text-[#7A8FA8] uppercase tracking-wide mb-1">Observação</p>
                      <p className="text-xs text-[#F0ECE4]">{result.observacao}</p>
                    </div>
                  )}

                  {result.status === "APROVADO" && (
                    <a
                      href="/login"
                      className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors"
                      style={{ background: cfg.color, color: "#09081A" }}
                    >
                      Acessar Plataforma <ArrowRight className="w-4 h-4" />
                    </a>
                  )}

                  {result.updated_at && (
                    <p className="text-[10px] text-[#7A8FA8]/60 mt-4">
                      Última atualização: {new Date(result.updated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-[#3A5070] mt-6">
          © 2026 V3 Partners · <a href="/cadastro-partner" className="text-[#C9A84C]/70 hover:text-[#C9A84C] transition-colors">Fazer cadastro</a>
        </p>
      </div>
    </div>
  );
}
