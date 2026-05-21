"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Building2, Mail, Lock, Loader2, AlertCircle, ChevronRight } from "lucide-react";

export default function InstituicaoLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/instituicao/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Email ou senha inválidos.");
      }

      sessionStorage.setItem("instituicao_id", data.instituicao_id);
      sessionStorage.setItem("instituicao_nome", data.nome);

      window.location.href = "/instituicao/dashboard";
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao fazer login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "linear-gradient(160deg, #09081A 0%, #111F35 100%)" }}>
      <div className="w-full max-w-md space-y-8">

        {/* Logo */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Image src="/logo.jpg" alt="V3 Partners" width={48} height={48} className="rounded-xl object-cover" />
            <div className="text-left">
              <div className="text-[10px] font-bold tracking-widest text-[#C9A84C] uppercase">V3 Partners</div>
              <div className="text-sm font-semibold text-[#F0ECE4]">Portal Instituição</div>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 bg-[#C9A84C]/10 border border-[#C9A84C]/25 rounded-full px-4 py-1.5 mt-1">
            <Building2 className="w-3.5 h-3.5 text-[#C9A84C]" />
            <span className="text-xs font-semibold text-[#C9A84C]">Acesso Exclusivo para Instituições Financeiras</span>
          </div>
        </div>

        {/* Form */}
        <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-8 space-y-5 shadow-2xl">
          <div className="mb-2">
            <h2 className="text-lg font-bold text-[#F0ECE4]">Entrar</h2>
            <p className="text-xs text-[#7A8FA8] mt-1">Visualize as propostas encaminhadas para sua instituição em análise ou pendência.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A8FA8]" />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-[#0D1929] border border-[#243A66] rounded-xl pl-10 pr-4 py-3 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/40 focus:outline-none focus:border-[#C9A84C]/50 transition-colors"
                  placeholder="email@instituicao.com.br"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A8FA8]" />
                <input
                  required
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-[#0D1929] border border-[#243A66] rounded-xl pl-10 pr-4 py-3 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/40 focus:outline-none focus:border-[#C9A84C]/50 transition-colors"
                  placeholder="Sua senha"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold rounded-xl text-sm transition-colors disabled:opacity-50 mt-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              {loading ? "Entrando..." : "Acessar Portal"}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-[#243A66]">
          Acesso restrito a instituições financeiras cadastradas pela V3 Partners.
        </p>
      </div>
    </div>
  );
}
