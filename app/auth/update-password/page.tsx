"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import Image from "next/image";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // Handles PKCE flow: user arrives after /auth/callback already with session
    // Also handles implicit flow: PASSWORD_RECOVERY event fires from hash fragment
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    // Check if already in session (PKCE flow — user is already authenticated)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/perfil"), 2500);
  }

  return (
    <div className="min-h-screen bg-[#09081A] flex items-center justify-center p-4">
      {/* Background grid */}
      <div className="fixed inset-0 bg-grid-sidebar opacity-30 pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-2xl overflow-hidden mb-3"
            style={{ boxShadow: "0 0 0 1px rgba(201,168,76,0.25), 0 8px 32px rgba(0,0,0,0.5)" }}>
            <Image src="/logo.jpg" alt="V3 Partners" width={80} height={80} className="w-full h-full object-contain" priority />
          </div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-[#C9A84C] uppercase">V3 Partners</p>
        </div>

        {/* Card */}
        <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-2.5 mb-1">
            <Lock className="w-5 h-5 text-[#C9A84C]" />
            <h1 className="text-lg font-bold text-[#F0ECE4]">Nova Senha</h1>
          </div>
          <p className="text-xs text-[#7A8FA8] mb-6">
            Defina sua nova senha de acesso à plataforma.
          </p>

          {success ? (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Senha alterada com sucesso!</p>
                <p className="text-xs mt-0.5 opacity-80">Redirecionando para o seu perfil...</p>
              </div>
            </div>
          ) : !ready ? (
            <div className="flex items-center justify-center gap-2 py-8 text-[#7A8FA8]">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Verificando sessão...</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nova senha */}
              <div>
                <label className="block text-xs font-semibold text-[#7A8FA8] mb-1.5">
                  Nova Senha
                </label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                    className="w-full h-10 px-3 pr-10 text-sm rounded-lg border bg-[#0A1628] border-[#243A66] text-[#F0ECE4] placeholder:text-[#3A5070] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 focus:border-[#C9A84C]/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirmar senha */}
              <div>
                <label className="block text-xs font-semibold text-[#7A8FA8] mb-1.5">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repita a senha"
                    required
                    className="w-full h-10 px-3 pr-10 text-sm rounded-lg border bg-[#0A1628] border-[#243A66] text-[#F0ECE4] placeholder:text-[#3A5070] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 focus:border-[#C9A84C]/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-lg bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Salvando..." : "Salvar Nova Senha"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
