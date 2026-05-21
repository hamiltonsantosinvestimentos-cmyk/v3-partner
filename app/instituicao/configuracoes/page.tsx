"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Building2, LogOut, Settings, Lock, CheckCircle2, AlertTriangle, Loader2, ArrowLeft } from "lucide-react";

export default function InstituicaoConfiguracoes() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");

  // Redefinir senha
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erroSenha, setErroSenha] = useState("");

  useEffect(() => {
    const n = sessionStorage.getItem("instituicao_nome");
    const e = sessionStorage.getItem("instituicao_email") ?? "";
    if (!n) { window.location.href = "/instituicao/login"; return; }
    setNome(n);
    setEmail(e);
  }, []);

  function handleLogout() {
    sessionStorage.removeItem("instituicao_id");
    sessionStorage.removeItem("instituicao_nome");
    sessionStorage.removeItem("instituicao_email");
    window.location.href = "/instituicao/login";
  }

  async function handleRedefinirSenha() {
    if (!email) {
      setErroSenha("Email não encontrado. Faça login novamente.");
      return;
    }
    setEnviando(true);
    setErroSenha("");
    try {
      const res = await fetch("/api/instituicao/senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar email.");
      setEnviado(true);
    } catch (e: unknown) {
      setErroSenha(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#09081A]">
      {/* Header */}
      <header className="border-b border-[#243A66] bg-[#09081A]/95 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.jpg" alt="V3 Partners" width={32} height={32} className="rounded-lg object-cover" />
            <div>
              <div className="text-[9px] font-bold tracking-widest text-[#C9A84C] uppercase">V3 Partners</div>
              <div className="text-xs font-semibold text-[#F0ECE4]">Portal Instituição</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded-full px-3 py-1">
              <Building2 className="w-3 h-3 text-[#C9A84C]" />
              <span className="text-[11px] font-semibold text-[#C9A84C]">{nome}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors px-2 py-1.5 rounded-lg hover:bg-[#243A66]/40"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        <div className="flex items-center gap-3">
          <a href="/instituicao/dashboard" className="p-1.5 rounded-lg text-[#7A8FA8] hover:text-[#F0ECE4] hover:bg-[#243A66]/40 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </a>
          <div>
            <h1 className="text-xl font-bold text-[#F0ECE4] flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#C9A84C]" />
              Configurações
            </h1>
            <p className="text-xs text-[#7A8FA8] mt-0.5">Gerencie as configurações do seu acesso ao portal.</p>
          </div>
        </div>

        {/* Informações da conta */}
        <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-[#F0ECE4] flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#C9A84C]" />
            Informações da Conta
          </h2>
          <div className="grid gap-3">
            <div className="bg-[#0D1929] rounded-xl px-4 py-3 border border-[#243A66]/60">
              <p className="text-[9px] font-bold text-[#7A8FA8] uppercase tracking-widest mb-1">Instituição</p>
              <p className="text-sm font-semibold text-[#F0ECE4]">{nome}</p>
            </div>
            {email && (
              <div className="bg-[#0D1929] rounded-xl px-4 py-3 border border-[#243A66]/60">
                <p className="text-[9px] font-bold text-[#7A8FA8] uppercase tracking-widest mb-1">E-mail de acesso</p>
                <p className="text-sm font-semibold text-[#F0ECE4]">{email}</p>
              </div>
            )}
          </div>
        </div>

        {/* Redefinir senha */}
        <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-[#F0ECE4] flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#C9A84C]" />
            Redefinir Senha
          </h2>
          <p className="text-xs text-[#7A8FA8]">
            Enviaremos um link de redefinição para <span className="text-[#F0ECE4] font-medium">{email || "seu email cadastrado"}</span>.
            Verifique sua caixa de entrada após clicar em enviar.
          </p>

          {enviado ? (
            <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-emerald-400">Email enviado com sucesso!</p>
                <p className="text-[10px] text-emerald-400/70 mt-0.5">Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.</p>
              </div>
            </div>
          ) : (
            <>
              {erroSenha && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-red-400 text-xs">{erroSenha}</p>
                </div>
              )}
              <button
                onClick={handleRedefinirSenha}
                disabled={enviando}
                className="flex items-center justify-center gap-2 w-full py-3 bg-[#C9A84C]/15 hover:bg-[#C9A84C]/25 border border-[#C9A84C]/30 text-[#C9A84C] font-bold rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {enviando ? "Enviando..." : "Enviar link de redefinição"}
              </button>
            </>
          )}
        </div>

        <p className="text-center text-[10px] text-[#243A66] pb-4">
          Acesso restrito · V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50
        </p>
      </main>
    </div>
  );
}
