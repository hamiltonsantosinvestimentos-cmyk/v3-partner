"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ShoppingBag, Mail, Lock, Loader2, AlertCircle, ChevronRight } from "lucide-react";

export default function FornecedorLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/marketplace/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Erro ao fazer login");
      }

      // Store supplier info in sessionStorage
      sessionStorage.setItem("supplier_id", data.supplier_id);
      sessionStorage.setItem("supplier_status", data.supplier_status);

      window.location.href = "/fornecedor/dashboard";
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-[#C9A84C]/20 border border-[#C9A84C]/30 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-[#C9A84C]" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-[#F0ECE4]">Portal Fornecedor</h1>
          <p className="text-[#7A8FA8] text-sm mt-1">V3 Partners Marketplace</p>
        </div>

        {/* Form */}
        <div className="bg-[#0D1929] border border-[#1B3050] rounded-2xl p-8 space-y-5">
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
                  className="w-full bg-[#111F35] border border-[#1B3050] rounded-xl pl-10 pr-4 py-3 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/40 focus:outline-none focus:border-[#C9A84C]/50"
                  placeholder="email@empresa.com"
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
                  className="w-full bg-[#111F35] border border-[#1B3050] rounded-xl pl-10 pr-4 py-3 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/40 focus:outline-none focus:border-[#C9A84C]/50"
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
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="border-t border-[#1B3050] pt-4 text-center">
            <p className="text-[#7A8FA8] text-xs">
              Ainda não é fornecedor?{" "}
              <Link href="/fornecedor/cadastro" className="text-[#C9A84C] hover:underline font-medium">
                Cadastre-se
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
